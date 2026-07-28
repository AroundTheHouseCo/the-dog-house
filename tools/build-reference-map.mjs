#!/usr/bin/env node
/**
 * Build the Reference Map dataset for THE DOGHOUSE.
 *
 *   node tools/build-reference-map.mjs --csv "<export.csv>" [options]
 *
 * Takes a CRM export containing street addresses, geocodes each one ONCE at
 * build time, applies a privacy jitter, and writes a static JSON file that
 * ships with the app. Nothing geocodes at runtime — the app only ever reads
 * the baked file.
 *
 * ---------------------------------------------------------------------------
 * PRIVACY — this data ends up on a PUBLIC website. Three deliberate defenses:
 *
 *  1. Jitter. Every pin is displaced 100–300 ft on a random bearing, so a pin
 *     lands on the right block but never on the customer's parcel.
 *
 *  2. Deterministic jitter. The offset is seeded from the address itself, so
 *     re-running this script reproduces the SAME offset. If the jitter were
 *     re-rolled each build, anyone diffing two published builds could average
 *     the offsets and recover the true coordinate. Stable jitter closes that.
 *
 *  3. Abbreviated names. Only the given name(s) plus a last initial are
 *     written to the JSON — "Dale & Regina Hitchcock" ships as
 *     "Dale & Regina H." The file is publicly fetchable, so anything written
 *     here is effectively published in bulk regardless of how the UI reveals
 *     it. Pass --full-names to override (see the note in the final report).
 *
 * Street addresses are used for geocoding and are then DISCARDED — they are
 * never written to the output file.
 * ---------------------------------------------------------------------------
 *
 * Geocoding, in two passes, both free and neither needing an API key:
 *
 *   1. US Census Bureau batch geocoder — official US address data, one HTTP
 *      request for the whole batch. Chosen as primary because OSM simply
 *      does not contain many newer Colorado subdivisions: a Nominatim-only
 *      run lost ~30% of real addresses, and the misses were concentrated in
 *      exactly the newer neighbourhoods that matter most as social proof.
 *   2. Nominatim for whatever Census can't match, at <=1 request/second
 *      with a real User-Agent, per their usage policy.
 *
 * Results are cached to disk, so re-runs and added rows cost only the new
 * lookups. No paid service and no API key is used anywhere.
 */
import fs from "node:fs";
import path from "node:path";
import crypto from "node:crypto";

// ---------------------------------------------------------------- args ----
const argv = process.argv.slice(2);
const arg = (k, d = null) => {
  const i = argv.indexOf(`--${k}`);
  return i >= 0 && argv[i + 1] && !argv[i + 1].startsWith("--") ? argv[i + 1] : d;
};
const flag = (k) => argv.includes(`--${k}`);

const CSV        = arg("csv");
const COL_ADDR   = arg("address-col", "Address");
const COL_CITY   = arg("city-col", "City");
const COL_ZIP    = arg("zip-col", "Zip");
const COL_NAME   = arg("name-col", null);          // auto-detected if omitted
const COL_STATUS = arg("status-col", null);
const KEEP_STATUS = arg("keep-status", null);       // "|"- or ","-separated allowlist
// Status can live in a SECOND export, joined on a shared column. The CRM
// can emit address columns or status columns but not both in one view.
const STATUS_CSV = arg("status-csv", null);
const JOIN_COL   = arg("join-col", "Name");
const STATE      = arg("state", "CO");
const OUT        = arg("out", "data/reference-map.json");
const CACHE      = arg("cache", "tools/.geocode-cache.json");
const LIMIT      = parseInt(arg("limit", "0"), 10) || 0;
const FULL_NAMES = flag("full-names");
const DRY        = flag("dry-run");                 // parse + report, no geocoding

const UA = "ATH-DOGHOUSE-reference-map/1.0 (one-time batch; contact jack@aroundthehouseco.com)";

if (!CSV) {
  console.error("usage: node tools/build-reference-map.mjs --csv <file> [--address-col X] [--city-col Y] [--status-col S --keep-status 'Paid & Closed,...'] [--dry-run]");
  process.exit(2);
}

// ------------------------------------------------------------- csv ------
// Small RFC4180-ish parser: handles quoted fields, embedded commas/newlines
// and doubled quotes. Avoids adding a dependency to a no-build-step project.
function parseCsv(text) {
  const rows = [];
  let row = [], field = "", inQuotes = false;
  for (let i = 0; i < text.length; i++) {
    const c = text[i];
    if (inQuotes) {
      if (c === '"') {
        if (text[i + 1] === '"') { field += '"'; i++; }
        else inQuotes = false;
      } else field += c;
    } else if (c === '"') inQuotes = true;
    else if (c === ",") { row.push(field); field = ""; }
    else if (c === "\n") { row.push(field); rows.push(row); row = []; field = ""; }
    else if (c !== "\r") field += c;
  }
  if (field.length || row.length) { row.push(field); rows.push(row); }
  const header = rows.shift().map((h) => h.trim().replace(/^﻿/, ""));
  return rows
    .filter((r) => r.some((v) => v && v.trim()))
    .map((r) => Object.fromEntries(header.map((h, i) => [h, (r[i] ?? "").trim()])));
}

function readTextGuessEncoding(file) {
  const buf = fs.readFileSync(file);
  const utf8 = buf.toString("utf8");
  // CRM exports are frequently cp1252 (smart quotes); U+FFFD means utf8 failed
  return utf8.includes("�") ? buf.toString("latin1") : utf8;
}

// -------------------------------------------------------- normalizing ----
const squash = (s) => (s || "").replace(/\s+/g, " ").trim();

// Obvious misspellings seen in the export. Deliberately conservative: only
// entries where the intended town is unambiguous. Anything genuinely unclear
// (e.g. "Coloraodo") is left alone so it fails geocoding and gets reported,
// rather than being silently reassigned to the wrong town.
const CITY_ALIASES = {
  "colorado spring": "colorado springs",
  "colorado sprins": "colorado springs",
  "rock ford": "rocky ford",          // Rocky Ford is the real CO town
};
// City values that aren't places at all (stray header text, etc.)
const CITY_JUNK = new Set(["address", "city", "tbd", "n/a", "none", "-"]);

// Grouping key: accent-folded so "Cañon City" and "Canon City" are one town,
// then alias-corrected. Folding matters — those two were splitting into
// separate list entries and reading as sloppy to a customer.
const fold = (s) => s.normalize("NFD").replace(/[\u0300-\u036f]/g, "");
const cityKey = (s) => {
  const k = fold(squash(s).toLowerCase());
  return CITY_ALIASES[k] || k;
};
// Display form. Capitalises only at the start and after a space or hyphen —
// NOT at every regex word boundary, which treated "ñ" as a boundary and
// rendered "Cañon City" as "CañOn City".
const cityLabel = (s) =>
  squash(s).toLowerCase().replace(/(^|[\s\-])([a-z\u00e0-\u00ff])/g,
    (m, sep, ch) => sep + ch.toUpperCase());

// Abbreviate a CRM "Name" down to given name(s) + a single initial.
//
// This field is a JOB title, not a person: only about a third are a clean
// "First Last". The rest carry product/year/parenthetical noise, job
// numbers, notes, even two households --
//   "Mandy & Charlie Sulfrian Awning"      "Amy Rivard 2026"
//   "Joe Cunningham Awning Contrator"      "Ed & Susan Stump/McCannon"
//
// Deliberately STRUCTURAL rather than a denylist of product words. A
// denylist cannot be completed -- every pass found another descriptor
// ("Eng", "Lead", "Contrator") that shunted the real surname into the
// "keep" side and published it in full. Instead: emit at most the first
// given name, optionally a partner's given name joined by &/and, then ONE
// initial, and discard everything after. A surname cannot survive that,
// whatever vocabulary the CRM uses. The trade-off is that the initial is
// occasionally a middle name's rather than the surname's -- which errs
// toward less information, the right direction for a public file.
function shortName(full){
  let n = squash(full);
  if (!n) return "";
  if (FULL_NAMES) return n;

  n = n.replace(/\([^)]*\)?/g, " ").replace(/[+/,\-]/g, " ");
  const words = squash(n).split(" ")
    .map((w) => w.replace(/[^A-Za-z&']/g, ""))     // strip job numbers/years
    .filter(Boolean);
  if (!words.length) return "";

  const isJoin = (w) => /^(&|and)$/i.test(w);
  const given = [words[0]];
  let i = 1;
  if (words.length > 2 && isJoin(words[1])) { given.push("&", words[2]); i = 3; }

  const next = words[i];                              // the surname slot
  const initial = next && /[A-Za-z]/.test(next[0]) ? next[0].toUpperCase() + "." : "";
  return squash(given.join(" ") + " " + initial);
}

// obvious test/placeholder junk
const isTestRow = (name, city, addr) => {
  const n = (name || "").toLowerCase(), c = cityKey(city), a = (addr || "").toLowerCase();
  return /\bzzz\b/.test(n) || /delete me/.test(n) ||
         CITY_JUNK.has(c) ||
         /^tbd\b/.test(n) || a === "tbd" || /test job/.test(n);
};

// ----------------------------------------------------------- jitter ------
// Deterministic PRNG seeded from the address, so the same input always
// produces the same offset (see privacy note 2 in the header).
function seededRandom(seedStr) {
  const h = crypto.createHash("sha256").update(seedStr).digest();
  let s = h.readUInt32BE(0) || 1;
  return () => { // xorshift32
    s ^= s << 13; s >>>= 0;
    s ^= s >> 17;
    s ^= s << 5;  s >>>= 0;
    return s / 4294967296;
  };
}
const FT_PER_DEG_LAT = 364000; // ~110.6 km
function jitter(lat, lon, seedStr) {
  const rnd = seededRandom(seedStr);
  const dist = 100 + rnd() * 200;            // 100–300 ft, per spec
  const bearing = rnd() * 2 * Math.PI;
  const dLat = (dist * Math.cos(bearing)) / FT_PER_DEG_LAT;
  const dLon = (dist * Math.sin(bearing)) / (FT_PER_DEG_LAT * Math.cos((lat * Math.PI) / 180));
  return [ +(lat + dLat).toFixed(6), +(lon + dLon).toFixed(6) ];
}

// --------------------------------------------------------- geocoding -----
const cache = fs.existsSync(CACHE) ? JSON.parse(fs.readFileSync(CACHE, "utf8")) : {};
const saveCache = () => {
  fs.mkdirSync(path.dirname(CACHE), { recursive: true });
  fs.writeFileSync(CACHE, JSON.stringify(cache, null, 1));
};
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

// US Census batch geocoder. One request for the whole list; returns
// "lon,lat" per input id. Rows it can't match come back No_Match and fall
// through to Nominatim.
async function censusBatch(items){
  if (!items.length) return new Map();
  const csv = items.map((u, i) => {
    const cell = (v) => `"${String(v || "").replace(/"/g, "")}"`;
    return [i, cell(u.addr), cell(u.city), cell(STATE), cell(u.zip)].join(",");
  }).join("\n");

  const form = new FormData();
  form.append("benchmark", "Public_AR_Current");
  form.append("addressFile", new Blob([csv], { type: "text/csv" }), "addresses.csv");

  const out = new Map();
  try {
    const res = await fetch("https://geocoding.geo.census.gov/geocoder/locations/addressbatch",
      { method: "POST", body: form });
    if (!res.ok) return out;
    const text = await res.text();
    for (const line of text.split("\n")) {
      if (!line.trim()) continue;
      const cols = line.match(/"([^"]*)"/g)?.map((c) => c.slice(1, -1)) || [];
      if (cols.length < 6 || cols[2] !== "Match") continue;
      const [lon, lat] = cols[5].split(",").map(Number);
      if (Number.isFinite(lat) && Number.isFinite(lon) &&
          lat > 36 && lat < 42 && lon > -110 && lon < -101) {
        out.set(parseInt(cols[0], 10), { lat, lon });
      }
    }
  } catch { /* fall through — everything just goes to Nominatim */ }
  return out;
}

async function geocode(street, city, zip) {
  const key = `${squash(street)}|${cityKey(city)}|${squash(zip)}`.toLowerCase();
  if (key in cache && cache[key] !== null) return cache[key];   // retry past failures

  // Progressively looser attempts. Newer subdivisions are often in OSM at
  // street level but not house level, and the postalcode constraint in
  // particular rejects otherwise-good matches, so a single strict structured
  // query loses ~30% of real addresses.
  const attempts = [
    { street: squash(street), city: squash(city), state: STATE, country: "USA", postalcode: squash(zip) },
    { street: squash(street), city: squash(city), state: STATE, country: "USA" },
    { q: `${squash(street)}, ${squash(city)}, ${STATE}, USA` },
  ];

  let out = null;
  for (const params of attempts) {
    const url = new URL("https://nominatim.openstreetmap.org/search");
    url.searchParams.set("format", "jsonv2");
    url.searchParams.set("limit", "1");
    url.searchParams.set("addressdetails", "1");
    for (const [k, v] of Object.entries(params)) if (v) url.searchParams.set(k, v);

    try {
      const res = await fetch(url, { headers: { "User-Agent": UA, "Accept-Language": "en" } });
      if (res.ok) {
        const j = await res.json();
        if (Array.isArray(j) && j.length) {
          const hit = j[0];
          const lat = parseFloat(hit.lat), lon = parseFloat(hit.lon);
          const a = hit.address || {};
          // Must resolve to at least a road. A bare city/place hit would drop
          // every unmatched address onto one identical town-centre point —
          // exactly the stacked-pin failure this is meant to avoid.
          const streetLevel = !!(a.road || a.house_number);
          if (streetLevel && Number.isFinite(lat) && Number.isFinite(lon) &&
              lat > 36 && lat < 42 && lon > -110 && lon < -101) {
            out = { lat, lon };
          }
        }
      }
    } catch { /* network hiccup — fall through to the next attempt */ }
    await sleep(1100);                        // Nominatim policy: <=1 req/sec
    if (out) break;
  }
  cache[key] = out;
  saveCache();
  return out;
}

// -------------------------------------------------------------- main -----
let rows = parseCsv(readTextGuessEncoding(CSV));

// Join a status column in from a second export keyed on JOIN_COL. Only rows
// with exactly one unambiguous match get a status; duplicates are left blank
// and therefore filtered out by --keep-status rather than guessed at.
let joinStats = null;
if (STATUS_CSV) {
  const other = parseCsv(readTextGuessEncoding(STATUS_CSV));
  const statusCol = COL_STATUS || "Status";
  const byKey = new Map();
  for (const r of other) {
    const k = squash(r[JOIN_COL]).toLowerCase();
    if (!k) continue;
    if (byKey.has(k)) byKey.set(k, null);       // ambiguous -> refuse to guess
    else byKey.set(k, r[statusCol] || "");
  }
  let matched = 0, ambiguous = 0, missed = 0;
  rows = rows.map((r) => {
    const k = squash(r[JOIN_COL]).toLowerCase();
    const v = byKey.get(k);
    if (v === undefined) { missed++; return r; }
    if (v === null) { ambiguous++; return r; }
    matched++;
    return { ...r, [statusCol]: v };
  });
  joinStats = { matched, ambiguous, missed, from: path.basename(STATUS_CSV) };
}

// auto-detect a name column if not given
const nameCol = COL_NAME || ["Name", "Primary", "Customer", "First Name", "First"]
  .find((c) => rows[0] && c in rows[0]) || null;
const hasFirstLast = rows[0] && "First" in rows[0] && "Last" in rows[0];
const rowName = (r) => hasFirstLast ? squash(`${r.First || ""} ${r.Last || ""}`)
                                    : (nameCol ? r[nameCol] : "");

const missingCols = [COL_ADDR, COL_CITY].filter((c) => !(rows[0] && c in rows[0]));
if (missingCols.length) {
  console.error(`\nFATAL: required column(s) not present in ${path.basename(CSV)}: ${missingCols.join(", ")}`);
  console.error(`Columns found: ${Object.keys(rows[0] || {}).join(", ")}`);
  console.error(`\nThis export cannot be mapped — re-export including street address and city.\n`);
  process.exit(1);
}

const keep = KEEP_STATUS
  ? KEEP_STATUS.split(KEEP_STATUS.includes("|") ? "|" : ",").map((s) => s.trim().toLowerCase())
  : null;
const skipped = { noAddress: 0, noCity: 0, testRow: 0, status: 0, geocodeFailed: 0 };
const usable = [];

for (const r of rows) {
  const addr = squash(r[COL_ADDR]), city = squash(r[COL_CITY]), name = rowName(r);
  if (isTestRow(name, city, addr)) { skipped.testRow++; continue; }
  if (!addr) { skipped.noAddress++; continue; }
  if (!city) { skipped.noCity++; continue; }
  if (keep && COL_STATUS) {
    if (!keep.includes((r[COL_STATUS] || "").trim().toLowerCase())) { skipped.status++; continue; }
  }
  usable.push({ addr, city, zip: squash(r[COL_ZIP] || ""), name });
}

const work = LIMIT ? usable.slice(0, LIMIT) : usable;

console.log(`\n  source        ${path.basename(CSV)}`);
console.log(`  total rows    ${rows.length}`);
console.log(`  usable        ${usable.length}${LIMIT ? `  (limited to ${work.length} for this run)` : ""}`);
console.log(`  skipped       ${Object.entries(skipped).filter(([, v]) => v).map(([k, v]) => `${k}=${v}`).join("  ") || "none"}`);
if (joinStats) console.log(`  status join   ${joinStats.matched} matched, ${joinStats.ambiguous} ambiguous, ${joinStats.missed} unmatched  (from ${joinStats.from})`);
if (!keep) console.log(`  NOTE          no status filter applied — every usable row will be plotted`);
if (FULL_NAMES) console.log(`  NOTE          --full-names: full customer names will be written to a PUBLIC file`);

if (DRY) {
  const byCity = {};
  for (const u of work) { const k = cityLabel(cityKey(u.city)); byCity[k] = (byCity[k] || 0) + 1; }
  console.log(`\n  per-city (dry run, ${Object.keys(byCity).length} towns):`);
  for (const [c, n] of Object.entries(byCity).sort((a, b) => b[1] - a[1])) console.log(`    ${String(n).padStart(4)}  ${c}`);
  process.exit(0);
}

const townMap = new Map();  // cityKey -> { city, pins[] }

// Pass 1: everything not already cached goes to Census in one request.
const ckey = (u) => `${squash(u.addr)}|${cityKey(u.city)}|${squash(u.zip)}`.toLowerCase();
const need = work.filter((u) => !(ckey(u) in cache) || cache[ckey(u)] === null);
if (need.length) {
  process.stdout.write(`  census batch  ${need.length} addresses…`);
  const got = await censusBatch(need);
  need.forEach((u, i) => { if (got.has(i)) cache[ckey(u)] = got.get(i); });
  saveCache();
  console.log(` ${got.size} matched, ${need.length - got.size} to Nominatim`);
}

// Pass 2: per-address Nominatim for whatever Census missed.
let done = 0;
for (const u of work) {
  const hit = await geocode(u.addr, u.city, u.zip);
  done++;
  if (!hit) { skipped.geocodeFailed++; process.stdout.write(`\r  geocoding     ${done}/${work.length}  (${skipped.geocodeFailed} failed)`); continue; }
  const [lat, lon] = jitter(hit.lat, hit.lon, `${u.addr}|${u.city}`);
  const k = cityKey(u.city);
  if (!townMap.has(k)) townMap.set(k, { city: cityLabel(k), pins: [] });
  // NOTE: only the abbreviated name and the jittered point are kept.
  townMap.get(k).pins.push({ n: shortName(u.name), ll: [lat, lon] });
  process.stdout.write(`\r  geocoding     ${done}/${work.length}  (${skipped.geocodeFailed} failed)`);
}
console.log("");

const towns = [...townMap.values()]
  .map((t) => {
    const lat = t.pins.reduce((s, p) => s + p.ll[0], 0) / t.pins.length;
    const lon = t.pins.reduce((s, p) => s + p.ll[1], 0) / t.pins.length;
    return { city: t.city, count: t.pins.length, center: [+lat.toFixed(5), +lon.toFixed(5)], pins: t.pins };
  })
  .sort((a, b) => b.count - a.count || a.city.localeCompare(b.city));

fs.mkdirSync(path.dirname(OUT), { recursive: true });
fs.writeFileSync(OUT, JSON.stringify({
  generated: new Date().toISOString().slice(0, 10),
  jitterFeet: [100, 300],
  namesAbbreviated: !FULL_NAMES,
  totalPins: towns.reduce((s, t) => s + t.count, 0),
  towns
}, null, 0));

console.log(`\n  wrote         ${OUT}  (${towns.length} towns, ${towns.reduce((s, t) => s + t.count, 0)} pins)`);
console.log(`  geocode fail  ${skipped.geocodeFailed}`);
console.log(`\n  per-city:`);
for (const t of towns) console.log(`    ${String(t.count).padStart(4)}  ${t.city}`);
console.log("");
