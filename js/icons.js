// THE DOGHOUSE icon set — one native-SVG visual language for the whole app.
//
// Replaces the emoji that used to sit in the product picker, home cards,
// coach cards and Quote Builder. Emoji were never really "ours": they
// render differently on every OS and font, they carry colour we don't
// control, and next to the deck's hand-built graphics (chevron dividers,
// warranty tiles, the awning glyph) they read as placeholder art.
//
// House rules — every icon obeys all of these, which is what makes the set
// look like a set rather than a pile of clip art:
//   · 24×24 viewBox, drawn on that grid
//   · stroke only, never fill — colour comes from `currentColor`
//   · 1.8 stroke width, round caps and joins
//   · optically centred with ~2.5u of breathing room at the edges
//
// Sizing is the caller's job: `.icon` is 1em, so the container's font-size
// drives it (see .home-card-icon / .center-card-icon in styles.css).
const ICON_ATTRS =
  'viewBox="0 0 24 24" fill="none" stroke="currentColor" ' +
  'stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"';

function svgIcon(body){
  return `<svg class="icon" ${ICON_ATTRS}>${body}</svg>`;
}

const ICON = {
  // ---- products -------------------------------------------------------
  // retractable awning: canopy dome over a scalloped valance
  awning: svgIcon(
    '<path d="M2.5 10.5V9.5a9.5 9.5 0 0 1 19 0v1"/>' +
    '<path d="M2.5 10.5a1.9 1.9 0 0 0 3.8 0 1.9 1.9 0 0 0 3.8 0 1.9 1.9 0 0 0 3.8 0 1.9 1.9 0 0 0 3.8 0 1.9 1.9 0 0 0 3.8 0"/>'
  ),
  // motorised screen: cassette, mesh, weighted bottom bar
  screen: svgIcon(
    '<rect x="3" y="3" width="18" height="3.4" rx="1.2"/>' +
    '<path d="M5.6 6.4v8.6M18.4 6.4v8.6"/>' +
    '<path d="M5.6 9.6h12.8M5.6 12.3h12.8"/>' +
    '<rect x="4.4" y="15" width="15.2" height="2.6" rx="1.1"/>'
  ),
  // gutter guard: roof pitch, the helmet cap, the trough beneath
  gutter: svgIcon(
    '<path d="M3 12 12 5l9 7"/>' +
    '<path d="M4.5 14.8v2.7a2.5 2.5 0 0 0 2.5 2.5h10a2.5 2.5 0 0 0 2.5-2.5v-2.7"/>' +
    '<path d="M4.5 14.8c3.2-2.6 11.8-2.6 15 0"/>'
  ),
  // louvered pergola: slatted roof on posts
  pergola: svgIcon(
    '<path d="M2.5 10h19"/>' +
    '<path d="M5.5 10v10M18.5 10v10"/>' +
    '<path d="M4 7.4h16M4 5.2h16M4 3h16"/>'
  ),

  // ---- home ------------------------------------------------------------
  play: svgIcon('<path d="M8 5.2v13.6L19 12z"/>'),
  cap: svgIcon(
    '<path d="M12 3.8 2.5 8.6 12 13.4l9.5-4.8z"/>' +
    '<path d="M6.6 10.6V16c0 1.6 2.4 3 5.4 3s5.4-1.4 5.4-3v-5.4"/>' +
    '<path d="M21.5 8.6v5.2"/>'
  ),
  calculator: svgIcon(
    '<rect x="4.5" y="2.5" width="15" height="19" rx="2.5"/>' +
    '<rect x="7.5" y="5.5" width="9" height="3.4" rx="1"/>' +
    '<path d="M8.2 13h.01M12 13h.01M15.8 13h.01M8.2 17h.01M12 17h.01M15.8 17h.01"/>'
  ),

  // ---- training coach cards -------------------------------------------
  monitor: svgIcon(
    '<rect x="2.5" y="4" width="19" height="13" rx="2"/>' +
    '<path d="M12 17v3.5M9 20.5h6"/>'
  ),
  steps: svgIcon('<path d="M3 20.5h5.5V15H14V9.5h5.5V4"/>'),
  camera: svgIcon(
    '<path d="M3 8.8a2 2 0 0 1 2-2h2.3l1.3-2h6.8l1.3 2H19a2 2 0 0 1 2 2v8a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"/>' +
    '<circle cx="12" cy="12.6" r="3.4"/>'
  ),
  doc: svgIcon(
    '<path d="M14 2.5H7a2 2 0 0 0-2 2v15a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2V7.5z"/>' +
    '<path d="M14 2.5V7.5h5"/>' +
    '<path d="M8.5 12.5h7M8.5 16h5"/>'
  ),
  clipboard: svgIcon(
    '<path d="M9 4H7a2 2 0 0 0-2 2v13a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2V6a2 2 0 0 0-2-2h-2"/>' +
    '<rect x="9" y="2.5" width="6" height="3.4" rx="1.2"/>' +
    '<path d="M8.5 11h7M8.5 15h4.5"/>'
  ),
  target: svgIcon(
    '<circle cx="12" cy="12" r="8.5"/>' +
    '<circle cx="12" cy="12" r="4.6"/>' +
    '<path d="M12 12h.01"/>'
  ),
  chat: svgIcon(
    '<path d="M20.5 11.6a7.6 7.6 0 0 1-8.2 7.5 8.7 8.7 0 0 1-2.4-.4L4.5 20.5l1.6-4.3a7.4 7.4 0 0 1-1.6-4.6 7.6 7.6 0 0 1 8-7.5 7.6 7.6 0 0 1 8 7.5z"/>'
  ),
  tag: svgIcon(
    '<path d="M20.6 13.4 13.4 20.6a2 2 0 0 1-2.8 0L3 13V3h10l7.6 7.6a2 2 0 0 1 0 2.8z"/>' +
    '<path d="M7.6 7.6h.01"/>'
  ),

  // ---- inline / UI -----------------------------------------------------
  close: svgIcon('<path d="M6.2 6.2 17.8 17.8M17.8 6.2 6.2 17.8"/>'),
  // side-by-side comparison — replaces the ⇄ on "Compare all three"
  compare: svgIcon('<path d="M4 8.5h13M13.5 5 17 8.5 13.5 12"/><path d="M20 15.5H7M10.5 12 7 15.5 10.5 19"/>'),
  checkCircle: svgIcon('<circle cx="12" cy="12" r="9"/><path d="M8 12.3l2.7 2.7 5.5-5.5"/>'),
  xCircle: svgIcon('<circle cx="12" cy="12" r="9"/><path d="M9.2 9.2l5.6 5.6M14.8 9.2l-5.6 5.6"/>'),
  // coach guidance — replaces the 👉 that prefixed every coach note
  bulb: svgIcon(
    '<path d="M12 2.6a6.5 6.5 0 0 0-4 11.6V16a1 1 0 0 0 1 1h6a1 1 0 0 0 1-1v-1.8a6.5 6.5 0 0 0-4-11.6z"/>' +
    '<path d="M9.5 20h5M10.2 22h3.6"/>'
  ),
  pencil: svgIcon('<path d="M16.4 3.6a2.1 2.1 0 0 1 3 3L7.4 18.6l-4 1 1-4z"/>'),
  book: svgIcon(
    '<path d="M3 4.5h5.5a3.5 3.5 0 0 1 3.5 3.5v11.5a2.6 2.6 0 0 0-2.6-2.6H3z"/>' +
    '<path d="M21 4.5h-5.5A3.5 3.5 0 0 0 12 8v11.5a2.6 2.6 0 0 1 2.6-2.6H21z"/>'
  ),
  signal: svgIcon(
    '<path d="M2.6 9.4a14.5 14.5 0 0 1 18.8 0"/>' +
    '<path d="M5.6 13a10 10 0 0 1 12.8 0"/>' +
    '<path d="M8.7 16.5a5.6 5.6 0 0 1 6.6 0"/>' +
    '<path d="M12 20h.01"/>'
  ),
  warn: svgIcon(
    '<path d="M10.3 3.9 2.1 18.1A2 2 0 0 0 3.8 21h16.4a2 2 0 0 0 1.7-2.9L13.7 3.9a2 2 0 0 0-3.4 0z"/>' +
    '<path d="M12 9.5v4M12 17h.01"/>'
  ),
  lock: svgIcon(
    '<rect x="4.6" y="10.4" width="14.8" height="10.6" rx="2.2"/>' +
    '<path d="M8 10.4V7a4 4 0 0 1 8 0v3.4"/>'
  ),
  palette: svgIcon(
    '<path d="M12 21.5a9.5 9.5 0 1 1 9.5-9.5c0 2-1.7 3.1-3.6 3.1h-1.7a2.2 2.2 0 0 0-1.6 3.7 2 2 0 0 1-1.5 3.3z"/>' +
    '<path d="M7.6 12.2h.01M10.1 8h.01M15 8.4h.01"/>'
  )
};

// Product key -> icon, so the picker and Quote Builder can't drift apart.
const PRODUCT_ICON = {
  sunesta: ICON.awning,
  eclipse: ICON.screen,
  gutterhelmet: ICON.gutter,
  pergola: ICON.pergola
};
