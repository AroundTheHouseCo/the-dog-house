// RAVN lesson markdown → HTML (RAVN step 4; the course player in step 6
// uses the same function). Deliberately small: the subset Jack's course
// files use — headings, paragraphs, **bold**, *italic*, `code`, links,
// "- " / "1." lists, "> " quotes, fenced code and horizontal rules.
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
  function render(md) {
    const lines = String(md || "").replace(/\r\n?/g, "\n").split("\n");
    const out = [];
    let para = [], list = null, quote = [];
    const flushPara = () => { if (para.length) { out.push(`<p>${inline(para.join(" "))}</p>`); para = []; } };
    const flushList = () => { if (list) { out.push(`<${list.tag}>${list.items.map((i) => `<li>${inline(i)}</li>`).join("")}</${list.tag}>`); list = null; } };
    const flushQuote = () => { if (quote.length) { out.push(`<blockquote>${render(quote.join("\n"))}</blockquote>`); quote = []; } };
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
      const h = /^(#{1,6})\s+(.*)$/.exec(t);
      if (h) { flushAll(); const n = Math.min(6, h[1].length + 2); out.push(`<h${n}>${inline(h[2])}</h${n}>`); continue; }
      if (/^(-{3,}|\*{3,})$/.test(t)) { flushAll(); out.push("<hr>"); continue; }
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
  g.ravnMd = render;
  g.ravnEsc = esc;
})(typeof self !== "undefined" ? self : this);
