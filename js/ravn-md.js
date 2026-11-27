// RAVN lesson markdown → HTML (RAVN step 4; the course player in step 6
// uses the same function). Deliberately small: the subset Jack's course
// files use — headings, paragraphs, **bold**, *italic*, `code`, links,
// "- " / "1." lists, "> " quotes, fenced code, horizontal rules and pipe
// tables.
//
// Lesson look (Jack, 2026-11-27):
// - A line that is ONLY bold text ("**The Close**") is a section label:
//   rendered as a sub-heading, and ravnMd.sections() splits there so long
//   lessons can be shown one card at a time.
// - "> Coaching notes" (or any quote) is a callout card; its first line,
//   when it reads like a title ("Coaching notes:"), becomes the card title.
// - Script lines ("REP: …", "HOMEOWNER: …", also bold "**REP:**") are each
//   their own chat line with a speaker label.
// - Pipe tables ("| a | b |" + "|---|---|") become real tables; every cell
//   carries its column name (data-label) so a phone can stack each row as
//   a card.
//
// SAFE BY CONSTRUCTION: every piece of text is HTML-escaped before any tag
// is added, and links are only ever http(s) with rel="noopener". Lesson text
// is typed by owners, but it is still never trusted as HTML.
(function (g) {
  function esc(s) {
    return String(s == null ? "" : s).replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
  }
  function inline(t) {
    let s = esc(t);
    s = s.replace(/`([^`]+)`/g, "<code>$1</code>");
    s = s.replace(/\*\*([^*]+)\*\*/g, "<strong>$1</strong>");
    s = s.replace(/(^|[^*])\*([^*\s][^*]*)\*/g, "$1<em>$2</em>");
    s = s.replace(/\[([^\]]+)\]\((https?:\/\/[^)\s]+)\)/g, (m, txt, url) =>
      `<a href="${url}" target="_blank" rel="noopener noreferrer">${txt}</a>`);
    return s;
  }
  // "**Title**" or "**Title:**" alone on a line.
  const SECTION = /^\*\*([^*]+?)\*\*:?$/;
  // "REP:", "**REP:**", "Homeowner (wife):" …
  const SPEAKER = /^\*{0,2}(REP|HOMEOWNER|HOMEOWNERS|CUSTOMER|SPOUSE|PARTNER|HO)(\s*\([^)]{1,30}\))?\s*:\*{0,2}\s*(.*)$/i;
  const SPEAKER_KIND = { rep: "rep" };
  const COACH = /^\*{0,2}coaching notes?:?\*{0,2}:?$/i;
  const isRow = (t) => /^\|.*\|$/.test(t);
  const cells = (t) => t.replace(/^\|/, "").replace(/\|$/, "").split("|").map((c) => c.trim());
  const isDivider = (t) => isRow(t) && cells(t).every((c) => /^:?-{2,}:?$/.test(c));

  function render(md) {
    const lines = String(md || "").replace(/\r\n?/g, "\n").split("\n");
    const out = [];
    let para = [], list = null, quote = [];
    const flushPara = () => { if (para.length) { out.push(`<p>${inline(para.join(" "))}</p>`); para = []; } };
    const flushList = () => { if (list) { out.push(`<${list.tag} class="md-list">${list.items.map((i) => `<li>${inline(i)}</li>`).join("")}</${list.tag}>`); list = null; } };
    const flushQuote = () => {
      if (!quote.length) return;
      const q = quote.slice(); quote = [];
      // A short first line ending in ":" (or bold alone) is the callout's title.
      let title = "";
      const first = q[0].trim(), sec = SECTION.exec(first);
      if (sec) { title = sec[1].replace(/:$/, ""); q.shift(); }
      else if (/^[^.!?]{2,40}:$/.test(first)) { title = first.replace(/:$/, ""); q.shift(); }
      out.push(`<aside class="md-callout">${title ? `<div class="md-callout-title">${inline(title)}</div>` : ""}${render(q.join("\n"))}</aside>`);
    };
    const flushAll = () => { flushPara(); flushList(); flushQuote(); };
    for (let i = 0; i < lines.length; i++) {
      const l = lines[i], t = l.trim();
      if (/^(```|~~~)/.test(t)) {
        flushAll();
        const fence = t.slice(0, 3), code = [];
        for (i++; i < lines.length && !lines[i].trim().startsWith(fence); i++) code.push(lines[i]);
        out.push(`<pre><code>${esc(code.join("\n"))}</code></pre>`);
        continue;
      }
      if (/^>\s?/.test(t)) { flushPara(); flushList(); quote.push(t.replace(/^>\s?/, "")); continue; }
      flushQuote();
      if (!t) { flushPara(); flushList(); continue; }
      // Pipe table: a header row followed by a |---| divider row.
      if (isRow(t) && i + 1 < lines.length && isDivider(lines[i + 1].trim())) {
        flushAll();
        const head = cells(t), rows = [];
        for (i += 2; i < lines.length && isRow(lines[i].trim()); i++) rows.push(cells(lines[i].trim()));
        i--;
        out.push(`<div class="md-table"><table><thead><tr>${head.map((h) => `<th>${inline(h)}</th>`).join("")}</tr></thead><tbody>${
          rows.map((r) => `<tr>${head.map((h, k) => `<td data-label="${esc(h.replace(/\*/g, ""))}">${inline(r[k] || "")}</td>`).join("")}</tr>`).join("")
        }</tbody></table></div>`);
        continue;
      }
      const h = /^(#{1,6})\s+(.*)$/.exec(t);
      if (h) { flushAll(); const n = Math.min(6, h[1].length + 2); out.push(`<h${n}>${inline(h[2])}</h${n}>`); continue; }
      // "Coaching notes:" followed by a list (no "> ") is a callout too.
      if (COACH.test(t)) {
        flushAll();
        const body = [];
        let j = i + 1;
        while (j < lines.length && !lines[j].trim()) j++;
        for (; j < lines.length; j++) {
          const u = lines[j].trim();
          if (/^([-*+]|\d+[.)])\s+/.test(u) || (body.length && /^\s{2,}\S/.test(lines[j]))) body.push(lines[j]);
          else break;
        }
        if (body.length) { quote = ["Coaching notes:"].concat(body); flushQuote(); i = j - 1; continue; }
      }
      const sec = SECTION.exec(t);
      if (sec) { flushAll(); out.push(`<h3 class="md-section">${inline(sec[1].replace(/:$/, ""))}</h3>`); continue; }
      if (/^(-{3,}|\*{3,})$/.test(t)) { flushAll(); out.push("<hr>"); continue; }
      const sp = SPEAKER.exec(t);
      if (sp) {
        flushAll();
        const who = sp[1].toUpperCase(), kind = SPEAKER_KIND[who.toLowerCase()] || "home";
        const label = who === "HO" ? "HOMEOWNER" : who;
        out.push(`<div class="md-say md-say-${kind}"><div class="md-who">${esc(label)}${sp[2] ? " " + esc(sp[2].trim()) : ""}</div><div class="md-line">${inline(sp[3])}</div></div>`);
        continue;
      }
      const ul = /^[-*+]\s+(.*)$/.exec(t), ol = /^\d+[.)]\s+(.*)$/.exec(t);
      if (ul || ol) {
        flushPara();
        const tag = ul ? "ul" : "ol";
        if (list && list.tag !== tag) flushList();
        if (!list) list = { tag, items: [] };
        list.items.push((ul || ol)[1]);
        continue;
      }
      if (list && /^\s{2,}\S/.test(l)) { list.items[list.items.length - 1] += " " + t; continue; }
      flushList();
      para.push(t);
    }
    flushAll();
    return out.join("\n");
  }

  /* sections(md) → [{title, md}] split at each section-label line (outside
     code fences). Text before the first label is a part with no title. */
  function sections(md) {
    const lines = String(md || "").replace(/\r\n?/g, "\n").split("\n");
    const parts = [{ title: "", lines: [] }];
    let fence = null;
    for (const l of lines) {
      const t = l.trim();
      if (/^(```|~~~)/.test(t)) fence = fence ? null : t.slice(0, 3);
      // A coaching-notes label stays with the section it belongs to.
      const s = !fence && !COACH.test(t) && SECTION.exec(t);
      if (s) parts.push({ title: s[1].replace(/:$/, ""), lines: [l] });
      else parts[parts.length - 1].lines.push(l);
    }
    return parts.map((p) => ({ title: p.title, md: p.lines.join("\n").trim() })).filter((p) => p.md);
  }

  render.sections = sections;
  g.ravnMd = render;
  g.ravnEsc = esc;
})(typeof self !== "undefined" ? self : this);
