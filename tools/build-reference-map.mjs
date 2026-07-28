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
 * Geocoding uses OpenStreetMap Nominatim: no key, free, and fine for a
 * one-time batch provided we stay at <=1 request/second and send a real
 * User-Agent (their usage policy). Results are cached to disk, so re-runs
 * and added rows cost only the new lookups.
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
const KEEP_STATUS = arg("keep-status", null);       // comma-separated allowlist
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
const cityKey = (s) => squash(s).toLowerCase();          // grouping key
const cityLabel = (s) =>                                  // display form
  squash(s).toLowerCase().replace(/\b([a-z])/g, (m) => m.toUpperCase());

// "Dale & Regina Hitchcock" -> "Dale & Regina H."   (privacy: see header)
function shortName(full) {
  const n = squash(full);
  if (!n) return "";
  if (FULL_NAMES) return n;
  const parts = n.split(" ");
  if (parts.length === 1) return parts[0];
  const last = parts[parts.length - 1];
  const initial = /[A-Za-z]/.test(last[0]) ? last[0].toUpperCase() + "." : "";
  return squash(parts.slice(0, -1).join(" ") + " " + initial);
}

// obvious test/placeholder junk
const isTestRow = (name, city, addr) => {
  const n = (name || "").toLowerCase(), c = cityKey(city), a = (addr || "").toLowerCase();
  return /\bzzz\b/.test(n) || /delete me/.test(n) ||
         c === "tbd" || c === "n/a" || c === "none" ||
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

async function geocode(street, city, zip) {
  const key = `${squash(street)}|${cityKey(city)}|${squash(zip)}`.toLowerCase();
  if (key in cache) return cache[key];

  const url = new URL("https://nominatim.openstreetmap.org/search");
  url.searchParams.set("format", "jsonv2");
  url.searchParams.set("limit", "1");
  url.searchParams.set("street", squash(street));
  url.searchParams.set("city", squash(city));
  url.searchParams.set("state", STATE);
  url.searchParams.set("country", "USA");
  if (squash(zip)) url.searchParams.set("postalcode", squash(zip));

  let out = null;
  try {
    const res = await fetch(url, { headers: { "User-Agent": UA, "Accept-Language": "en" } });
    if (res.ok) {
      const j = await res.json();
      if (Array.isArray(j) && j.length) {
        const lat = parseFloat(j[0].lat), lon = parseFloat(j[0].lon);
        // sanity: reject 0,0 and anything outside a generous Colorado box
        if (Number.isFinite(lat) && Number.isFinite(lon) &&
            lat > 36 && lat < 42 && lon > -110 && lon < -101) {
          out = { lat, lon };
        }
      }
    }
  } catch (e) {
    out = null; // treated as a failure; reported, never silently dropped
  }
  cache[key] = out;
  saveCache();
  await sleep(1100);           // Nominatim policy: <= 1 request / second
  return out;
}

// -------------------------------------------------------------- main -----
const rows = parseCsv(readTextGuessEncoding(CSV));

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

const keep = KEEP_STATUS ? KEEP_STATUS.split(",").map((s) => s.trim().toLowerCase()) : null;
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
if (!keep) console.log(`  NOTE          no status filter applied — every usable row will be plotted`);
if (FULL_NAMES) console.log(`  NOTE          --full-names: full customer names will be written to a PUBLIC file`);

if (DRY) {
  const byCity = {};
  for (const u of work) byCity[cityLabel(u.city)] = (byCity[cityLabel(u.city)] || 0) + 1;
  console.log(`\n  per-city (dry run, ${Object.keys(byCity).length} towns):`);
  for (const [c, n] of Object.entries(byCity).sort((a, b) => b[1] - a[1])) console.log(`    ${String(n).padStart(4)}  ${c}`);
  process.exit(0);
}

const townMap = new Map();  // cityKey -> { city, pins[] }
let done = 0;
for (const u of work) {
  const hit = await geocode(u.addr, u.city, u.zip);
  done++;
  if (!hit) { skipped.geocodeFailed++; process.stdout.write(`\r  geocoding     ${done}/${work.length}  (${skipped.geocodeFailed} failed)`); continue; }
  const [lat, lon] = jitter(hit.lat, hit.lon, `${u.addr}|${u.city}`);
  const k = cityKey(u.city);
  if (!townMap.has(k)) townMap.set(k, { city: cityLabel(u.city), pins: [] });
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
