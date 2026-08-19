// Multi-product: content comes from PRODUCT_DATA (js/registry.js, filled by each
// js/data-<key>.js). setProduct(key) rebinds everything the engine reads — nothing
// content-derived may be evaluated at script-load time, or it silently pins the
// boot product. Sunesta boots as the default so a refresh lands somewhere sane.
let activeProduct = null; // key into PRODUCT_DATA
let PROD = null;          // PRODUCT_DATA[activeProduct]
let PDECK = null;         // PROD.deck — {tabName:[slides]}
let tabs = [];
let FLAT_SLIDES = [];
function productInfo(){ return PRODUCTS.find(p=>p.key===activeProduct) || {}; }
function setProduct(key){
  activeProduct = key;
  PROD = PRODUCT_DATA[key];
  PDECK = PROD.deck;
  tabs = Object.keys(PDECK);
  FLAT_SLIDES = tabs.flatMap(t => PDECK[t]);
  activeTab = tabs[0];
  activeIndex = 0;
  libCat = (PROD.photoCats && PROD.photoCats[0]) || Object.keys(PHOTO_LIBRARY)[0];
  // Fire-and-forget: fetches + indexes this product's training content JSON
  // if not already cached (js/training-content.js). Async and non-blocking,
  // same pattern as the service worker registration below — the content
  // isn't ready on this same tick, but tcEnsureProductContent() re-renders
  // via onTrainingContentReady() once it settles.
  if (typeof tcEnsureProductContent === "function") tcEnsureProductContent(key);
}
function globalSlideNumber(){
  return FLAT_SLIDES.indexOf(currentSlide()) + 1;
}
let activeTab = null;
let activeIndex = 0;
let mode = "present";
let trainingView = "slide"; // persists across slides so a rep can keep FAQs open while advancing
// THE DOGHOUSE app shell: home -> Presentations or Training Center -> product.
// Customers never see training UI in present mode.
// appView: "home" | "presentations" (product picker) | "coaches" (product picker)
//        | "present" (in-home deck) | "center" (per-product Training Coach hub) | "training-deck"
let appView = "home";
let centerView = null; // null = hub; else "tensteps"|"dodont"|"faq"|"close"|"recap"|"library"|"docs"
let libCat = null;       // active photo-library category (set by setProduct)
let libPhoto = null;     // lightbox index within the active category
let docViewer = null;    // in-app document viewer: {title, pages[]} or null (fabric book, etc.)
let modelSpec = null;    // fullscreen spec popup: model index or null
let modelCompare = false; // fullscreen 3-model comparison
let cmpCats = {warranty:true, size:true, eng:true}; // compare category toggles
let galleryOpen = false, galleryIndex = 0;
let compareOpen = false;
let openHotspot = null;
let lightboxIndex = null;
let triNodeOpen = null;

function currentSlide(){ return PDECK[activeTab][activeIndex]; }

function renderTabs(){
  const bar = document.getElementById("tabbar");
  bar.innerHTML = "";
  tabs.forEach(t=>{
    const b = document.createElement("button");
    b.textContent = t;
    if(t===activeTab) b.className="active";
    b.onclick = ()=>{ activeTab=t; activeIndex=0; resetSlideState(); renderAll(); };
    bar.appendChild(b);
  });
}

function resetSlideState(){
  modelSpec=null; modelCompare=false; cmpCats={warranty:true,size:true,eng:true}; docViewer=null;
  galleryOpen=false; compareOpen=false; openHotspot=null; lightboxIndex=null; triNodeOpen=null;
  if(typeof refmapReset==="function") refmapReset();
}

function renderDots(){
  const dots = document.getElementById("dots");
  dots.innerHTML="";
  PDECK[activeTab].forEach((s,i)=>{
    const d = document.createElement("span");
    if(i===activeIndex) d.className="active";
    dots.appendChild(d);
  });
  document.getElementById("count").textContent = (activeIndex+1)+" / "+PDECK[activeTab].length;
}

function goNext(){
  const idx = tabs.indexOf(activeTab);
  if(activeIndex < PDECK[activeTab].length-1){
    activeIndex++;
  } else if(idx < tabs.length-1){
    activeTab = tabs[idx+1];
    activeIndex = 0;
  } else {
    activeTab = tabs[0];
    activeIndex = 0;
  }
  resetSlideState(); renderAll();
}
function goPrev(){
  const idx = tabs.indexOf(activeTab);
  if(activeIndex > 0){
    activeIndex--;
  } else if(idx > 0){
    activeTab = tabs[idx-1];
    activeIndex = PDECK[activeTab].length-1;
  } else {
    activeTab = tabs[tabs.length-1];
    activeIndex = PDECK[activeTab].length-1;
  }
  resetSlideState(); renderAll();
}

function addNavZones(area){
  const left = document.createElement("div");
  left.className="navzone left";
  left.onclick=(e)=>{ e.stopPropagation(); goPrev(); };
  area.appendChild(left);
  const right = document.createElement("div");
  right.className="navzone right";
  right.onclick=(e)=>{ e.stopPropagation(); goNext(); };
  area.appendChild(right);
}

// Customer-facing ("present" mode) swipe navigation. Mirrors exactly what
// resetSlideState() clears — the full set of per-slide overlay/popup state
// (fabric-book viewer, gallery, compare, model spec, triangle popover,
// hotspot popover, photogrid lightbox). Gating on these flags directly,
// rather than relying on each overlay's own event.stopPropagation(), is
// deliberate: several overlays (docViewer, the photogrid lightbox) only
// stop "click", not touch events, so a bubbling touch listener here would
// otherwise still see touches meant for scrolling/interacting with them.
function isSlideOverlayOpen(){
  return !!(docViewer || galleryOpen || compareOpen || modelSpec !== null ||
    modelCompare || triNodeOpen !== null || openHotspot !== null || lightboxIndex !== null ||
    (typeof refmapIsOpen === "function" && refmapIsOpen()));
}

// Attached once at boot to the stable #slideArea node (renderSlide() only
// rebuilds its innerHTML, never replaces the node itself) rather than
// re-attached per render. Present-mode only — Training Mode keeps its
// arrow buttons and is untouched by this. Videoscrub's own <input
// type="range"> already stops touchstart from bubbling (js/app.js, the
// videoscrub and mini-scrub blocks), so a drag that starts on the scrub
// control itself never reaches this handler — no conflict with drag-to-
// extend/drag-to-scrub, which keeps owning its own strip of the slide.
function initSwipeNav(){
  const area = document.getElementById("slideArea");
  const H_THRESHOLD = 60;   // minimum horizontal travel, px, to count as a swipe
  const V_TOLERANCE = 1.5;  // horizontal travel must exceed vertical by this ratio
  const MAX_DURATION = 800; // ms — slower than this reads as a hold/scroll, not a swipe
  let tracking = false, axis = null, startX = 0, startY = 0, startTime = 0;

  area.addEventListener("touchstart", (e) => {
    tracking = appView === "present" && !isSlideOverlayOpen() && e.touches.length === 1;
    if(!tracking) return;
    axis = null;
    startX = e.touches[0].clientX;
    startY = e.touches[0].clientY;
    startTime = Date.now();
  }, {passive:true});

  area.addEventListener("touchmove", (e) => {
    if(!tracking) return;
    const t = e.touches[0];
    const dx = t.clientX - startX, dy = t.clientY - startY;
    if(axis === null && (Math.abs(dx) > 10 || Math.abs(dy) > 10)){
      axis = Math.abs(dx) > Math.abs(dy) * V_TOLERANCE ? "x" : "y";
    }
    if(axis === "x") e.preventDefault(); // own the gesture — no rubber-band scroll fighting the swipe
  }, {passive:false});

  area.addEventListener("touchend", (e) => {
    if(!tracking) return;
    tracking = false;
    if(axis !== "x") return;
    if(appView !== "present" || isSlideOverlayOpen()) return; // re-check — state may have changed mid-gesture
    const dx = e.changedTouches[0].clientX - startX, dy = e.changedTouches[0].clientY - startY;
    if(Date.now() - startTime > MAX_DURATION) return;
    if(Math.abs(dx) < H_THRESHOLD || Math.abs(dx) < Math.abs(dy) * V_TOLERANCE) return;
    if(dx < 0) goNext(); else goPrev();
  }, {passive:true});

  area.addEventListener("touchcancel", () => { tracking = false; axis = null; });
}

// Model-card silhouette (slide 14, "models"). Three visible, data-driven
// differences between the three cards — same viewBox/anchor points/fabric
// treatment for all three, so the comparison stays honest and the only
// things that change are the ones the model data says are actually
// different:
//
//   caseType ("full"|"semi"|"open") -> housing over the roller tube.
//     Maps directly to each model's already-shipped "Fabric protection"
//     spec line (SmartCase standard / optional / not listed).
//   armGauge (1-3) -> stroke-width of the diagonal support arm.
//     No manufacturer number exists for this — it's a relative read of
//     each model's "Arms" spec line, flagged in the slide's coach note.
//   maxProjectionFt -> how many fabric panels are drawn, right-aligned
//     against the wall mount. Same already-shipped number as "Projection
//     options" below, just scaled here instead of restated as a chip.
//
// opts is optional so any other caller (none today — see comment above the
// "models" call site) gets the old fixed-full-reach look by default.
function awningSVG(c1="#1b5e3f", c2="#2e7d4f", opts={}){
  const { caseType="full", armGauge=3, maxProjectionFt=null, overallMaxFt=null } = opts;
  const stripeW = 18, TOTAL = 9;
  // Reach: draw only the panels nearest the wall mount, so the far (loose)
  // end is what shortens — a real awning's mounted edge doesn't move.
  const count = maxProjectionFt && overallMaxFt
    ? Math.max(3, Math.min(TOTAL, Math.round(TOTAL * maxProjectionFt / overallMaxFt)))
    : TOTAL;
  const istart = TOTAL - count;
  const leftX = 20 + istart*stripeW;   // fabric's loose front edge, this model

  let stripes = "", scallops = "";
  for(let i=istart;i<TOTAL;i++){
    const x = 20 + i*stripeW;
    const color = i%2===0 ? c1 : c2;
    stripes += `<polygon points="${x},95 ${x+stripeW},95 ${x+stripeW-40},20 ${x-40},20" fill="${color}"/>`;
    const cx = x + stripeW/2 - 20;
    scallops += `<path d="M ${cx-9} 95 Q ${cx} 108 ${cx+9} 95 Z" fill="${color}"/>`;
  }

  // Diagonal support arm — real structural element (not a decorative line),
  // gauge-thick, running from the fabric's front edge to the wall plate.
  // Mount point is fixed regardless of case type (see housing comment
  // below), so the arm always plugs cleanly into the hardware above it —
  // no per-type geometry to keep back in sync.
  const MOUNT_X = 206, MOUNT_Y = 32;
  const armW = {1:3.5, 2:5, 3:7}[armGauge] ?? 7;
  const arm = `
    <line x1="${leftX}" y1="93" x2="${MOUNT_X}" y2="${MOUNT_Y}" stroke="#6f6f6f" stroke-width="${armW}" stroke-linecap="round"/>
    <line x1="${leftX}" y1="93" x2="${MOUNT_X}" y2="${MOUNT_Y}" stroke="#fff" stroke-width="1" opacity=".3" stroke-linecap="round"/>`;

  // Housing over the roller tube. Same fixed footprint (x:172-232, y:4-32)
  // for all three case types — ONLY the fill within that footprint changes
  // — so the wall-plate/arm attachment point never has to move or risk a
  // gap: full case = the footprint solid; semi = just its top half solid,
  // tube visible in the bottom half; open = no case fill at all, tube sits
  // alone in the same footprint. That graduated "how much of the same box
  // is covered" reads as more/less enclosed at a glance, and reuses one
  // set of anchor points instead of three different silhouettes to keep
  // aligned with the wall plate below.
  const wallPlate = `<rect x="${MOUNT_X-7}" y="${MOUNT_Y-4}" width="14" height="8" rx="2" fill="#a8a8a8"/>`;
  const housing = caseType === "full"
    ? `<rect x="172" y="4" width="60" height="28" rx="6" fill="#8f8f8f"/>
       <rect x="172" y="23" width="60" height="5" fill="#7c7c7c"/>`
    : caseType === "semi"
    ? `<rect x="172" y="4" width="60" height="14" rx="6" fill="#8f8f8f"/>
       <ellipse cx="202" cy="24" rx="17" ry="8" fill="#6b6b6b"/>`
    : `<ellipse cx="202" cy="22" rx="18" ry="9" fill="#6b6b6b"/>
       <circle cx="186" cy="22" r="3.5" fill="#565656"/>
       <circle cx="218" cy="22" r="3.5" fill="#565656"/>`;

  // Crop the viewBox to the drawn content and render each card's graphic at
  // a WIDTH proportional to that crop, wall-mount edge pinned to the card's
  // right side (margin-left:auto). Pixels-per-foot stays identical across
  // all three cards either way — this step is what makes that honest scale
  // actually visible: without it, a shorter reach just left blank padding
  // inside an identically-sized box, which the eye doesn't register as
  // "shorter" at a glance. With it, the whole graphic — hardware included,
  // since hardware isn't touched by the crop — sits in a visibly smaller
  // box, which is the "under two seconds" legibility the slide needs.
  const FULL_VB_W = 234;                     // Sunesta's (count=9) crop width
  const minX = leftX - 14;
  const vbW = 240 - minX;
  const pct = Math.round((vbW / FULL_VB_W) * 100);

  return `
  <svg viewBox="${minX} 0 ${vbW} 130" xmlns="http://www.w3.org/2000/svg" style="width:${pct}%;height:auto;margin-left:auto;display:block;">
    ${housing}
    ${wallPlate}
    ${arm}
    ${stripes}
    ${scallops}
  </svg>`;
}

// Cassette-over-screen glyph for the Eclipse "models" cards — same 240×130 box as awningSVG.
// Selected per-card via s.cardGraphic==="screen"; without it the models slide draws the awning (Sunesta unchanged).
function screenSVG(c1="#1b5e3f", c2="#2e7d4f"){
  const pid = "scr"+c2.replace('#','');
  return `
  <svg viewBox="0 0 240 130" xmlns="http://www.w3.org/2000/svg" style="width:100%;height:auto;">
    <defs>
      <pattern id="${pid}" width="11" height="11" patternUnits="userSpaceOnUse">
        <rect width="11" height="11" fill="${c2}" opacity="0.14"/>
        <path d="M0 5.5 H11 M5.5 0 V11" stroke="${c2}" stroke-width="1" opacity="0.5"/>
      </pattern>
    </defs>
    <rect x="46" y="30" width="9" height="80" rx="3" fill="${c2}"/>
    <rect x="185" y="30" width="9" height="80" rx="3" fill="${c2}"/>
    <rect x="55" y="34" width="130" height="74" fill="url(#${pid})"/>
    <rect x="38" y="10" width="164" height="26" rx="7" fill="${c1}"/>
    <circle cx="60" cy="23" r="7" fill="${c2}"/>
    <rect x="52" y="104" width="136" height="12" rx="4" fill="${c1}"/>
  </svg>`;
}

// --- YouTube segment loop (intro videoloop slide) ---
// Streams a [start,end] window of the ATH YouTube video, muted, looping.
// If the IFrame API can't load (no internet at the appointment), nothing is
// created and the branded placeholder underneath simply stays visible.
let ytLoopTimer = null;
function sizeYtLoopFrame(){
  const wrap = document.querySelector(".videoloop-embed");
  const fr = wrap && wrap.querySelector("iframe");
  if(!wrap || !fr) return;
  // cover-fit a 16:9 frame, oversized 32% so YouTube's title bar / caption /
  // suggested-video chrome is cropped outside the visible slide area
  const scale = Math.max(wrap.clientWidth/16, wrap.clientHeight/9) * 1.32;
  fr.style.width = Math.ceil(16*scale)+"px";
  fr.style.height = Math.ceil(9*scale)+"px";
}
function initYouTubeLoop(cfg){
  if(ytLoopTimer){ clearInterval(ytLoopTimer); ytLoopTimer = null; }
  const boot = ()=>{
    const mount = document.getElementById("ytLoopMount");
    if(!mount || !window.YT || !window.YT.Player) return;
    const player = new YT.Player("ytLoopMount", {
      videoId: cfg.id,
      playerVars: {autoplay:1, mute:1, controls:0, start:cfg.start, end:cfg.end,
                   playsinline:1, rel:0, iv_load_policy:3, disablekb:1, fs:0},
      events:{
        onReady: e=>{
          e.target.mute();
          try{ e.target.unloadModule("captions"); e.target.unloadModule("cc"); }catch(err){}
          e.target.playVideo(); sizeYtLoopFrame();
        },
        onStateChange: e=>{ if(e.data===YT.PlayerState.ENDED){ e.target.seekTo(cfg.start, true); e.target.playVideo(); } }
      }
    });
    window.__ytLoopPlayer = player; // debug/verification handle
    ytLoopTimer = setInterval(()=>{
      if(!document.querySelector(".videoloop-embed iframe")){ clearInterval(ytLoopTimer); ytLoopTimer = null; return; }
      sizeYtLoopFrame();
      try{
        const t = player.getCurrentTime ? player.getCurrentTime() : 0;
        // loop back just before the end mark; also recover if YT restarts from 0
        if(t >= cfg.end - 0.3 || t < cfg.start - 1){ player.seekTo(cfg.start, true); player.playVideo(); }
        // ambient loop is uncontrollable by design — self-heal if it's unstarted
        // (autoplay race), paused, or merely cued. Must stay muted for autoplay policy.
        const st = player.getPlayerState ? player.getPlayerState() : null;
        if(st === -1 || st === 2 || st === 5){ player.mute(); player.playVideo(); }
      }catch(err){}
    }, 500);
  };
  if(window.YT && window.YT.Player){ boot(); return; }
  window.onYouTubeIframeAPIReady = boot;
  if(!document.getElementById("ytApiScript")){
    const tag = document.createElement("script");
    tag.id = "ytApiScript";
    tag.src = "https://www.youtube.com/iframe_api";
    document.head.appendChild(tag);
  }
}

function footerBannerHTML(title, centered){
  return `<div class="footer-banner${centered?' footer-centered':''}"><img src="${IMAGES.athLogo}"><div class="footer-title">${title}</div></div>`;
}

function renderSlide(){
  const area = document.getElementById("slideArea");
  area.innerHTML = "";
  const s = currentSlide();

  if(s.type==="videoloop"){
    const panel = document.createElement("div");
    panel.className="videoloop-panel";
    panel.innerHTML = `
      ${s.youtube ? "" : `<div class="videoloop-label">Video loop — placeholder</div>`}
      <div class="videoloop-play"></div>
      ${s.youtube ? `<div class="videoloop-embed"><div id="ytLoopMount"></div></div>` : ""}
      <img class="videoloop-logo" src="${s.logo || PROD.logo}">
    `;
    area.appendChild(panel);
    if(s.youtube) initYouTubeLoop(s.youtube);
    addNavZones(area);
  }

  if(s.type==="photogrid"){
    const panel = document.createElement("div");
    panel.className="photogrid-panel";
    const grid = document.createElement("div");
    grid.className="photogrid-grid";
    // Grid shape follows the actual photo count instead of a hardcoded 2x2 —
    // with more than 4 photos (e.g. a 6-photo gallery), the old fixed
    // grid-template-rows:1fr 1fr left the extra items in an implicit auto
    // row sized by content, which could collapse the explicit rows and push
    // photos past the visible card edge depending on viewport aspect ratio.
    // A photo is either a bare path (the common case) or {src, caption} when
    // the set needs labelling — e.g. the Eclipse Before/After/Inside slide,
    // where the caption IS the content. Normalised once so everything below
    // reads the same shape.
    const photos = s.photos.map(p => typeof p === "string" ? {src:p} : p);
    // Column count is chosen so the photos actually fill the rows: 3 reads as
    // one row of three rather than a 2x2 with a hole, and 7-8 go four wide so
    // eight lands as a clean 4x2 instead of a 3x3 missing its last two cells.
    // The counts already in use are unchanged -- 4 stays 2x2, 6 stays 3x2.
    const gridCols = photos.length > 6 ? 4 : (photos.length === 3 || photos.length > 4) ? 3 : 2;
    const gridRows = Math.ceil(photos.length / gridCols);
    grid.style.gridTemplateColumns = `repeat(${gridCols},1fr)`;
    grid.style.gridTemplateRows = `repeat(${gridRows},1fr)`;
    photos.forEach((p,i)=>{
      const cell = document.createElement("div");
      cell.className="photogrid-cell";
      cell.innerHTML = `<img src="${p.src}"><div class="expand-ring"></div>${
        p.caption?`<div class="photogrid-caption">${p.caption}</div>`:""}`;
      cell.onclick=(e)=>{ e.stopPropagation(); lightboxIndex=i; renderSlide(); };
      grid.appendChild(cell);
    });
    panel.appendChild(grid);
    panel.insertAdjacentHTML("beforeend", footerBannerHTML(s.title));
    area.appendChild(panel);
    if(lightboxIndex!==null){
      const lb = document.createElement("div");
      lb.className="lightbox";
      lb.innerHTML = `<button class="dismiss-btn on-dark lightbox-close">${ICON.close} Close</button><img src="${photos[lightboxIndex].src}">`;
      lb.onclick=(e)=>{ e.stopPropagation(); if(e.target===lb){ lightboxIndex=null; renderSlide(); } };
      lb.querySelector(".lightbox-close").onclick=(e)=>{ e.stopPropagation(); lightboxIndex=null; renderSlide(); };
      area.appendChild(lb);
    }
  }

  if(s.type==="reasonsphoto"){
    const panel = document.createElement("div");
    panel.className="reasons-panel";
    panel.innerHTML = `
      <div class="reasons-left"><h2>${s.title}</h2></div>
      <svg class="reasons-chevron" viewBox="0 0 100 500" preserveAspectRatio="none">
        <polygon points="0,0 55,0 100,250 55,500 0,500 38,250" fill="#2e7d4f"/>
      </svg>
      <div class="reasons-photo"><img src="${s.image}"></div>
    `;
    area.appendChild(panel);
    const photoBox = panel.querySelector(".reasons-photo");
    if(s.hotspots){
      s.hotspots.forEach((h,i)=>{
        const dot = document.createElement("div");
        dot.className="hotspot-pill";
        dot.textContent = h.label;
        dot.style.left=(h.x*100)+"%"; dot.style.top=(h.y*100)+"%";
        dot.onclick=(e)=>{ e.stopPropagation(); openHotspot=i; renderSlide(); };
        photoBox.appendChild(dot);
      });
      if(openHotspot!==null){
        const h = s.hotspots[openHotspot];
        const pop = document.createElement("div");
        pop.className="popover";
        pop.style.zIndex=20;
        pop.innerHTML = `<div class="popover-card"><button class="dismiss-btn popover-close">${ICON.close} Close</button>${h.photo?`<img class="reason-pop-img" src="${h.photo}">`:""}<h3>${h.label}</h3><p>${h.content}</p></div>`;
        pop.onclick=(e)=>{ e.stopPropagation(); if(e.target===pop){ openHotspot=null; renderSlide(); } };
        pop.querySelector(".popover-close").onclick=(e)=>{ e.stopPropagation(); openHotspot=null; renderSlide(); };
        area.appendChild(pop);
      }
    }
    addNavZones(area);
  }

  if(s.type==="difference"){
    const panel = document.createElement("div");
    if(s.comparison){
      // Table variant. Same job as the badge-row layout below — "here is how
      // we actually stack up" — but the payload is a side-by-side comparison,
      // shown inline on the slide rather than behind the modal the models
      // slide uses for its own comparison. Reuses .compare-table3, which is
      // table-layout:fixed and so takes any column count.
      const cmp = s.comparison;
      const iconFor = st => st==="check" ? '<span class="ct-icon ct-check">✓</span>'
        : st==="warn" ? '<span class="ct-icon ct-warn">!</span>'
        : '<span class="ct-icon ct-x">✕</span>';
      panel.className="cmp-panel";
      panel.innerHTML = `
        <div class="cmp-head">
          <h2>${s.title}</h2>
          ${s.paragraph?`<p>${s.paragraph}</p>`:""}
        </div>
        <div class="cmp-scroll">
          <table class="compare-table3">
            <tr>
              <th class="ct-label"></th>
              ${cmp.columns.map(c=>`
                <th class="${c.badge?'ct-hero':''}">
                  ${c.badge?`<div class="ct-badge">${c.badge}</div>`:""}
                  <div class="ct-colname">${c.name}</div>
                  <div class="ct-colsub">${c.sub}</div>
                </th>`).join("")}
            </tr>
            ${cmp.rows.map(row=>`
              <tr>
                <td class="ct-label">${row.label}</td>
                ${row.cells.map(c=>`<td class="${c.s==='check'?'ct-hero-cell':''}">${iconFor(c.s)}<span class="ct-text">${c.t}</span></td>`).join("")}
              </tr>`).join("")}
          </table>
        </div>
        ${cmp.footer?`<div class="compare-footer">${cmp.footer}</div>`:""}
      `;
    } else {
      panel.className="difference-panel";
      const rowsHTML = (s.rows||[]).map(r=>{
        if(r.style==="banner"){
          return `<div class="diff-row banner"><div class="diff-banner"><img src="${r.icon}"><div class="diff-label">${r.label}</div></div></div>`;
        }
        return `<div class="diff-row plain"><div class="diff-logo"><img src="${r.icon}"></div><div><div class="diff-label">${r.label}</div>${r.sublabel?`<div class="diff-sublabel">${r.sublabel}</div>`:""}</div></div>`;
      }).join("");
      panel.innerHTML = `
        <div class="diff-left">${rowsHTML}</div>
        <svg class="diff-chevron" viewBox="0 0 100 500" preserveAspectRatio="none">
          <polygon points="0,0 55,0 100,250 55,500 0,500 38,250" fill="#2e7d4f"/>
        </svg>
        <div class="diff-right">
          <h2>${s.title}</h2>
          ${s.paragraph?`<p>${s.paragraph}</p>`:""}
        </div>
      `;
    }
    area.appendChild(panel);
    addNavZones(area);
  }

  const GOOGLE_ICON_SVG = `<svg viewBox="0 0 48 48"><path fill="#4285F4" d="M45.12 24.5c0-1.56-.14-3.06-.4-4.5H24v8.51h11.84c-.51 2.75-2.06 5.08-4.39 6.64v5.52h7.11c4.16-3.83 6.56-9.47 6.56-16.17z"/><path fill="#34A853" d="M24 46c5.94 0 10.92-1.97 14.56-5.33l-7.11-5.52c-1.97 1.32-4.49 2.1-7.45 2.1-5.73 0-10.58-3.87-12.31-9.07H4.34v5.7C7.96 41.07 15.4 46 24 46z"/><path fill="#FBBC05" d="M11.69 28.18C11.25 26.86 11 25.45 11 24s.25-2.86.69-4.18v-5.7H4.34C2.85 17.09 2 20.45 2 24s.85 6.91 2.34 9.88l7.35-5.7z"/><path fill="#EA4335" d="M24 10.75c3.23 0 6.13 1.11 8.41 3.29l6.31-6.31C34.91 4.18 29.93 2 24 2 15.4 2 7.96 6.93 4.34 14.12l7.35 5.7c1.73-5.2 6.58-9.07 12.31-9.07z"/></svg>`;

  if(s.type==="credibility"){
    const panel = document.createElement("div");
    panel.className="credibility-panel";
    const rowsHTML = s.rows.map((r,i)=>`
      <div class="cred-row" data-i="${i}">
        <div class="cred-icon-box">${r.icon?`<img src="${r.icon}">`:(r.link?GOOGLE_ICON_SVG:"")}</div>
        <div>
          <div class="cred-label">${r.label}</div>
          ${r.sublabel?`<div class="cred-sublabel">${r.sublabel.replace(/(★+)/,'<span class="stars">$1</span>')}</div>`:""}
        </div>
        <div class="hotspot cred-hotspot"></div>
      </div>`).join("");
    panel.innerHTML = `
      <div class="cred-left">
        ${s.headerLogo?`<img class="cred-header-logo" src="${s.headerLogo}">`:""}
        <h2>${s.title}</h2>
        <p>${s.paragraph}</p>
      </div>
      <svg class="cred-chevron" viewBox="0 0 100 500" preserveAspectRatio="none">
        <polygon points="0,0 55,0 100,250 55,500 0,500 38,250" fill="#2e7d4f"/>
      </svg>
      <div class="cred-right">${rowsHTML}</div>
    `;
    area.appendChild(panel);
    panel.querySelectorAll(".cred-row").forEach(el=>{
      el.onclick=(e)=>{
        e.stopPropagation();
        const i = parseInt(el.dataset.i);
        const row = s.rows[i];
        if(row.link){ window.open(row.link, "_blank"); return; }
        openHotspot = i; renderSlide();
      };
    });
    if(openHotspot!==null && s.rows[openHotspot] && !s.rows[openHotspot].link){
      const r = s.rows[openHotspot];
      const pop = document.createElement("div");
      pop.className="popover";
      pop.style.zIndex=20;
      pop.innerHTML = `<div class="popover-card"><button class="dismiss-btn popover-close">${ICON.close} Close</button><h3>${r.label}</h3><p>${r.detail}</p></div>`;
      pop.onclick=(e)=>{ e.stopPropagation(); if(e.target===pop){ openHotspot=null; renderSlide(); } };
      pop.querySelector(".popover-close").onclick=(e)=>{ e.stopPropagation(); openHotspot=null; renderSlide(); };
      area.appendChild(pop);
    }
    addNavZones(area);
  }

  if(s.type==="productcards"){
    const panel = document.createElement("div");
    panel.className="products-panel"+(s.rows.length>3?" dense":"");
    const cardsHTML = s.rows.map((r,i)=>`
      <div class="pcard" data-i="${i}">
        <div class="pcard-photo">
          <img src="${r.photo}" alt=""${r.photoPosition?` style="object-position:${r.photoPosition}"`:""}>
          ${r.icon?`<div class="pcard-icon"><img src="${r.icon}"></div>`:""}
          ${r.num?`<div class="pcard-num">${r.num}</div>`:""}
        </div>
        <div class="pcard-body">
          <div class="pcard-name">${r.label}</div>
          ${r.sublabel?`<div class="pcard-sub">${r.sublabel}</div>`:""}
          <div class="pcard-foot">
            ${r.logo?`<img class="pcard-logo" src="${r.logo}" alt="">`:`<span></span>`}
            <span class="pcard-more">Tap for detail ›</span>
          </div>
        </div>
      </div>`).join("");
    panel.innerHTML = `
      <div class="products-head">
        <div class="products-eyebrow">${s.eyebrow||"Around The House · Home Solutions"}</div>
        <h2>${s.title}</h2>
        ${s.paragraph?`<p>${s.paragraph}</p>`:""}
      </div>
      <div class="products-cards${s.rows.length===4?" grid-2x2":""}">${cardsHTML}</div>
    `;
    area.appendChild(panel);
    panel.querySelectorAll(".pcard").forEach(el=>{
      el.onclick=(e)=>{ e.stopPropagation(); openHotspot=parseInt(el.dataset.i); renderSlide(); };
    });
    if(openHotspot!==null && s.rows[openHotspot]){
      const r = s.rows[openHotspot];
      const pop = document.createElement("div");
      pop.className="popover";
      pop.style.zIndex=20;
      pop.innerHTML = `<div class="popover-card"><button class="dismiss-btn popover-close">${ICON.close} Close</button>
        ${r.popPhoto?`<img class="reason-pop-img" src="${r.popPhoto}">`:""}
        ${r.logo?`<img class="popover-logo" src="${r.logo}">`:""}
        <h3>${r.label}</h3><p>${r.detail}</p></div>`;
      pop.onclick=(e)=>{ e.stopPropagation(); if(e.target===pop){ openHotspot=null; renderSlide(); } };
      pop.querySelector(".popover-close").onclick=(e)=>{ e.stopPropagation(); openHotspot=null; renderSlide(); };
      area.appendChild(pop);
    }
    addNavZones(area);
  }

  // Horizontal least-expensive-to-most-expensive scale (price-conditioning
  // slide only). Deliberately a separate type from "productcards" — that
  // renderer (and its .dense/.grid-2x2 CSS) is shared with Eclipse's
  // product-lineup slide, which keeps its plain grid untouched.
  if(s.type==="costscale"){
    const panel = document.createElement("div");
    // s.bigThumbs opts a deck into the doubled-circle treatment; the renderer
    // and its CSS are shared with Sunesta's own costscale slide, which keeps
    // the original 68px circles.
    panel.className="costscale-panel"+(s.bigThumbs?" cs-big":"");
    // Even spacing across the track — the "not at either end" read comes from
    // position, not styling. Computed from the rung count rather than a fixed
    // list so a 4-tier scale doesn't leave a gap at the right; for the 5-rung
    // Sunesta scale this yields exactly the previous 10/30/50/70/90.
    const n = s.rungs.length;
    const pos = s.rungs.map((_,i)=> n === 1 ? 50 : 10 + i * (80 / (n - 1)));
    const nodesHTML = s.rungs.map((r,i)=>`
      <button class="cs-node${r.athMarker?" cs-node-ath":""}" data-i="${i}" style="left:${pos[i]}%">
        ${r.athMarker?`<div class="cs-ath-pin">ATH</div>`:""}
        <div class="cs-dollars">${"$".repeat(r.n)}</div>
        <div class="cs-thumb${r.photo?"":" cs-thumb-empty"}">${r.photo?`<img src="${r.photo}" alt="">`:""}</div>
        <div class="cs-label">${r.label}</div>
      </button>`).join("");
    panel.innerHTML = `
      <div class="products-head">
        <div class="products-eyebrow">${s.eyebrow||"Around The House · Home Solutions"}</div>
        <h2>${s.title}</h2>
        ${s.paragraph?`<p>${s.paragraph}</p>`:""}
      </div>
      <div class="cs-track-wrap">
        <div class="cs-track"></div>
        ${nodesHTML}
      </div>
    `;
    area.appendChild(panel);
    panel.querySelectorAll(".cs-node").forEach(el=>{
      el.onclick=(e)=>{ e.stopPropagation(); openHotspot=parseInt(el.dataset.i); renderSlide(); };
    });
    if(openHotspot!==null && s.rungs[openHotspot]){
      const r = s.rungs[openHotspot];
      const pop = document.createElement("div");
      // .popover-card is shared by every popover in both decks, so the matching
      // scale-up rides the same s.bigThumbs opt-in rather than a bare class.
      pop.className="popover"+(s.bigThumbs?" cs-pop-big":"");
      pop.style.zIndex=20;
      // The photo only gets its positioned wrapper when there's a badge to hang
      // on it, so a deck without priceRange (Eclipse) renders the exact same
      // bare <img> it always did — no wrapper, no layout shift.
      const photoHTML = !r.popPhoto ? ""
        : r.priceRange
          ? `<div class="reason-pop-photo-wrap"><img class="reason-pop-img" src="${r.popPhoto}"><div class="cs-price-badge">${r.priceRange}</div></div>`
          : `<img class="reason-pop-img" src="${r.popPhoto}">`;
      pop.innerHTML = `<div class="popover-card"><button class="dismiss-btn popover-close">${ICON.close} Close</button>
        ${photoHTML}
        <h3>${r.label}</h3><p>${r.detail}</p></div>`;
      pop.onclick=(e)=>{ e.stopPropagation(); if(e.target===pop){ openHotspot=null; renderSlide(); } };
      pop.querySelector(".popover-close").onclick=(e)=>{ e.stopPropagation(); openHotspot=null; renderSlide(); };
      area.appendChild(pop);
    }
    addNavZones(area);
  }

  if(s.type==="triangle"){
    const panel = document.createElement("div");
    panel.className="triangle-panel";
    let bgLines = "";
    for(let i=0;i<14;i++){
      const x = -100 + i*45;
      bgLines += `<line x1="${x}" y1="0" x2="${x+260}" y2="340" stroke="#2e7d4f" stroke-width="${i%3===0?3:1.5}" opacity="${i%3===0?0.10:0.06}"/>`;
    }
    // Equilateral: with preserveAspectRatio="none" the ~590x560 container maps
    // % straight to px, so these give three equal ~354px sides, vertically centered.
    const positions = [
      {top:22.6, left:50},
      {top:77.4, left:20},
      {top:77.4, left:80}
    ];
    panel.innerHTML = `
      <div class="triangle-left"><h2>${s.title}</h2>${s.subtext?`<div class="tri-subtext">${s.subtext}</div>`:""}</div>
      <svg class="tri-page-chevron" viewBox="0 0 100 500" preserveAspectRatio="none">
        <polygon points="0,0 55,0 100,250 55,500 0,500 38,250" fill="#2e7d4f"/>
      </svg>
      <div class="triangle-right">
        <svg class="tri-bg-lines" viewBox="0 0 420 340" preserveAspectRatio="none">${bgLines}</svg>
        <svg viewBox="0 0 100 100" preserveAspectRatio="none" style="position:absolute;inset:0;z-index:1;">
          <polygon points="50,36.5 31.4,70.5 68.6,70.5" fill="#2e7d4f"/>
          <polygon points="50,38.7 33.3,69.3 66.7,69.3" fill="#245e3f"/>
        </svg>
        <svg class="tri-connect-lines" viewBox="0 0 100 100" preserveAspectRatio="none">
          <line x1="${positions[0].left}" y1="${positions[0].top}" x2="${positions[1].left}" y2="${positions[1].top}" stroke="#2e7d4f" stroke-width="0.6" stroke-dasharray="2,2"/>
          <line x1="${positions[0].left}" y1="${positions[0].top}" x2="${positions[2].left}" y2="${positions[2].top}" stroke="#2e7d4f" stroke-width="0.6" stroke-dasharray="2,2"/>
          <line x1="${positions[1].left}" y1="${positions[1].top}" x2="${positions[2].left}" y2="${positions[2].top}" stroke="#2e7d4f" stroke-width="0.6" stroke-dasharray="2,2"/>
        </svg>
      </div>
    `;
    area.appendChild(panel);
    const right = panel.querySelector(".triangle-right");
    right.style.position="relative";
    s.nodes.forEach((n,i)=>{
      const box = document.createElement("div");
      box.className="tri-node";
      box.style.top=positions[i].top+"%"; box.style.left=positions[i].left+"%"; box.style.transform="translate(-50%,-50%)";
      if(n.kind==="logo"){
        box.innerHTML = `<img src="${n.logo || PROD.logo}">`;
      } else if(n.kind==="logo-ath"){
        box.innerHTML = `<img src="${IMAGES.athLogo}">`;
      } else {
        box.classList.add("text-only");
        box.innerHTML = `<div class="gibraltar-logotype">${n.title}</div>`;
      }
      box.onclick=(e)=>{ e.stopPropagation(); triNodeOpen=i; renderSlide(); };
      right.appendChild(box);
    });
    if(triNodeOpen!==null){
      const n = s.nodes[triNodeOpen];
      const pop = document.createElement("div");
      pop.className="popover";
      pop.style.zIndex=20;
      pop.innerHTML = `<div class="popover-card tri-detail-card"><button class="dismiss-btn popover-close">${ICON.close} Close</button>
        ${n.photo?`<img src="${n.photo}">`:""}
        <h3>${n.title}</h3><p>${n.detail}</p></div>`;
      pop.onclick=(e)=>{ e.stopPropagation(); if(e.target===pop){ triNodeOpen=null; renderSlide(); } };
      pop.querySelector(".popover-close").onclick=(e)=>{ e.stopPropagation(); triNodeOpen=null; renderSlide(); };
      area.appendChild(pop);
    }
    addNavZones(area);
  }

  // Reference Map — town list -> focused town map (js/reference-map.js).
  // Falls back to the original "asset pending" placeholder whenever the
  // dataset hasn't been built, so the slide never looks finished early.
  // Only takes over once a dataset has actually been built. Without one it
  // deliberately falls through to the splitphoto branch below, so the slide
  // renders the exact same "asset pending" placeholder it always has —
  // no half-built map, and nothing internal shown to a customer.
  if(s.type==="refmap" && refmapHasData()){
    renderReferenceMap(area, s);
    // nav zones only in the list view — inside a town map the whole panel
    // is interactive (pan/zoom/tap pins) and must not advance the deck
    if(!refmapIsOpen()) addNavZones(area);
    return;
  }

  if(s.type==="splitphoto" || s.type==="splittext" || s.type==="refmap"){
    const panel = document.createElement("div");
    panel.className="split-panel";
    const textHTML = (s.type==="splitphoto" || s.type==="refmap")
      ? `<h2>${s.title}</h2>${s.subtext?`<div class="split-subtext">${s.subtext}</div>`:""}`
      : `<h2>${s.title}</h2><ul class="split-bullets">${s.bullets.map(b=>`<li>${b}</li>`).join("")}</ul>${s.cert?`<img class="split-cert" src="${s.cert}">`:""}`;
    // optional mini video-scrubber in the photo box (frame-swap, Apple-style)
    const sc = s.scrub;
    const scN = sc ? sc.frameCount : 0;
    const scFrame = sc ? (i)=> sc.frameBase + String(i).padStart(sc.framePad||2,'0') + sc.frameExt : null;
    const photoBoxHTML = sc
      ? `<div class="split-photo-box scrub">
           <div class="mini-scrub">
             <img class="ms-img" src="${scFrame(0)}" alt="">
             <div class="ms-hint">${sc.hint || 'Slide to raise & lower'}</div>
             <div class="ms-bar">
               <input type="range" class="ms-range" min="0" max="${scN-1}" value="0" step="1" aria-label="Drop screen position">
               <div class="ms-ends"><span>${sc.ends?sc.ends[0]:'▲ Up'}</span><span>${sc.ends?sc.ends[1]:'Down ▼'}</span></div>
             </div>
           </div>
         </div>`
      : (s.docViewer
        ? `<div class="split-photo-box doc-open-box"><img src="${s.image}"><div class="doc-open-badge">${ICON.book} ${s.docViewer.tapLabel||'Tap to open'}</div></div>`
        : (s.images
          ? `<div class="split-photo-box dual">${s.images.map(im=>`
             <div class="dual-photo-item">
               <img src="${im.src}" alt="${im.alt||''}">
               ${im.caption?`<div class="dual-photo-caption">${im.caption}</div>`:""}
             </div>`).join("")}</div>`
          : `<div class="split-photo-box"><img src="${s.image}"></div>`));
    panel.innerHTML = `
      <div class="split-content">
        ${photoBoxHTML}
        <div class="split-text">${textHTML}</div>
      </div>
      ${footerBannerHTML(s.title, true)}
    `;
    area.appendChild(panel);
    if(s.docViewer){
      const box = panel.querySelector(".doc-open-box");
      box.onclick = (e)=>{ e.stopPropagation(); docViewer = s.docViewer; renderSlide(); };
    }
    if(docViewer){
      const dv = document.createElement("div");
      dv.className = "doc-viewer";
      dv.style.zIndex = 60; // above the slide-number badge (z-index 50) — full-screen viewer
      dv.innerHTML = `
        <div class="doc-viewer-head">
          <div class="doc-viewer-title">${docViewer.title}</div>
          <button class="dismiss-btn on-dark doc-viewer-close" aria-label="Close">${ICON.close} Close</button>
        </div>
        <div class="doc-viewer-scroll">
          ${docViewer.pages.map((p,i)=>`<img src="${p}" alt="Page ${i+1}"${i<2?'':' loading="lazy"'}>`).join("")}
        </div>`;
      dv.addEventListener("click",(e)=>e.stopPropagation());
      dv.querySelector(".doc-viewer-close").onclick = (e)=>{ e.stopPropagation(); docViewer=null; renderSlide(); };
      area.appendChild(dv);
    }
    if(sc){
      const wrap = panel.querySelector(".mini-scrub");
      const img = wrap.querySelector(".ms-img");
      const hint = wrap.querySelector(".ms-hint");
      const range = wrap.querySelector(".ms-range");
      const cache = [];
      for(let i=0;i<scN;i++){ const im=new Image(); im.src=scFrame(i); cache[i]=im; }
      range.addEventListener("input",(e)=>{ e.stopPropagation(); img.src=scFrame(+range.value); if(+range.value>0) hint.classList.add("hidden"); });
      ["mousedown","touchstart","pointerdown","click"].forEach(ev=> range.addEventListener(ev,(e)=>e.stopPropagation()));
      wrap.addEventListener("click",(e)=>e.stopPropagation());
    }
    addNavZones(area);
  }

  if(s.type==="herosplit"){
    const panel = document.createElement("div");
    panel.className="hero-panel";
    panel.innerHTML = `
      <div class="hero-content">
        <div class="hero-photo"><img src="${s.image}"${s.imageRotate?` style="transform:rotate(${s.imageRotate}deg) scale(${s.imageScale||1.06})"`:""}><div class="hero-fade"></div></div>
        <div class="hero-text">
          <h2>${s.title}</h2>
          ${s.subtext?`<div class="hero-subtext${s.bigSubtext?" lg":""}">${s.subtext}</div>`:""}
        </div>
      </div>
      ${footerBannerHTML(s.title)}
    `;
    area.appendChild(panel);
    addNavZones(area);
  }

  if(s.type==="static" || s.type==="hotspot"){
    const img = document.createElement("img");
    img.className="slide-img"; img.src = s.image;
    area.appendChild(img);
    const cap = document.createElement("div");
    cap.className="slide-caption"; cap.textContent = s.title;
    area.appendChild(cap);
    if(s.hotspots){
      s.hotspots.forEach((h,i)=>{
        const dot = document.createElement("div");
        dot.className="hotspot";
        dot.style.left=(h.x*100)+"%"; dot.style.top=(h.y*100)+"%";
        dot.style.zIndex=10;
        dot.onclick=(e)=>{ e.stopPropagation(); openHotspot=i; renderSlide(); };
        area.appendChild(dot);
      });
      if(openHotspot!==null){
        const h = s.hotspots[openHotspot];
        const pop = document.createElement("div");
        pop.className="popover";
        pop.style.zIndex=20;
        pop.innerHTML = `<div class="popover-card"><button class="dismiss-btn popover-close">${ICON.close} Close</button>${h.photo?`<img class="reason-pop-img" src="${h.photo}">`:""}<h3>${h.label}</h3><p>${h.content}</p></div>`;
        pop.onclick=(e)=>{ e.stopPropagation(); if(e.target===pop){ openHotspot=null; renderSlide(); } };
        pop.querySelector(".popover-close").onclick=(e)=>{ e.stopPropagation(); openHotspot=null; renderSlide(); };
        area.appendChild(pop);
      }
    }
    addNavZones(area);
  }

  if(s.type==="slider"){
    const wrap = document.createElement("div");
    wrap.className="slider-wrap";
    wrap.innerHTML = `
      <img class="slider-after" src="${s.after}">
      <div class="slider-before" id="sliderBefore" style="width:50%">
        <img src="${s.before}">
      </div>
      <div class="slider-handle" id="sliderHandle" style="left:50%"></div>
      <div class="slider-hint">${s.hint || 'Drag to compare'}</div>
    `;
    area.appendChild(wrap);
    let dragging=false;
    const before = wrap.querySelector("#sliderBefore");
    const handle = wrap.querySelector("#sliderHandle");
    function setPos(clientX){
      const rect = wrap.getBoundingClientRect();
      let pct = ((clientX-rect.left)/rect.width)*100;
      pct = Math.max(0,Math.min(100,pct));
      before.style.width = pct+"%";
      handle.style.left = pct+"%";
      before.querySelector("img").style.width = rect.width+"px";
    }
    wrap.addEventListener("mousedown",e=>{e.stopPropagation(); dragging=true; setPos(e.clientX);});
    window.addEventListener("mousemove",e=>{if(dragging) setPos(e.clientX);});
    window.addEventListener("mouseup",()=>dragging=false);
    wrap.addEventListener("touchstart",e=>{e.stopPropagation(); dragging=true; setPos(e.touches[0].clientX);});
    wrap.addEventListener("touchmove",e=>{if(dragging) setPos(e.touches[0].clientX);});
    wrap.addEventListener("touchend",()=>dragging=false);
    wrap.addEventListener("click",e=>{e.stopPropagation();});
    setTimeout(()=>{ const rect=wrap.getBoundingClientRect(); before.querySelector("img").style.width = rect.width+"px"; },0);
  }

  if(s.type==="videoscrub"){
    const pad = s.framePad || 2;
    const N = s.frameCount;
    const frame = (i)=> s.frameBase + String(i).padStart(pad,'0') + s.frameExt;
    const wrap = document.createElement("div");
    wrap.className="scrub-wrap";
    wrap.innerHTML = `
      <img class="scrub-img" src="${frame(0)}" alt="">
      <div class="scrub-hint">${s.hint || 'Drag to extend the awning'}</div>
      <div class="scrub-bar">
        <input type="range" class="scrub-range" min="0" max="${N-1}" value="0" step="1" aria-label="${s.ariaLabel || 'Position'}">
        <div class="scrub-ends"><span>${s.ends ? s.ends[0] : '◄ Retracted'}</span><span>${s.ends ? s.ends[1] : 'Extended ►'}</span></div>
      </div>
    `;
    area.appendChild(wrap);
    const img = wrap.querySelector(".scrub-img");
    const hint = wrap.querySelector(".scrub-hint");
    const range = wrap.querySelector(".scrub-range");
    // preload every frame so scrubbing is instant
    const cache = [];
    for(let i=0;i<N;i++){ const im=new Image(); im.src=frame(i); cache[i]=im; }
    range.addEventListener("input",(e)=>{ e.stopPropagation(); img.src=frame(+range.value); if(+range.value>0) hint.classList.add("hidden"); });
    // keep slider gestures from bubbling to slide navigation
    ["mousedown","touchstart","pointerdown","click"].forEach(ev=> range.addEventListener(ev,(e)=>e.stopPropagation()));
    wrap.addEventListener("click",(e)=>e.stopPropagation());
  }

  if(s.type==="processsteps"){
    const panel = document.createElement("div");
    panel.className="ps-panel";
    panel.innerHTML = `
      <div class="ps-head">
        <h2>${s.title}</h2>
        ${s.subtext?`<div class="ps-sub">${s.subtext}</div>`:""}
      </div>
      <div class="ps-steps" style="grid-template-columns:repeat(${s.steps.length},1fr);">
        <div class="ps-line"></div>
        ${s.steps.map((st,i)=>`
          <div class="ps-step">
            <div class="ps-icon"><img src="${st.icon}" alt=""><div class="ps-num">${i+1}</div></div>
            <div class="ps-title">${st.title}</div>
            <div class="ps-text">${st.text}</div>
          </div>`).join("")}
      </div>
      ${s.trust?`<div class="ps-trust"><img src="${IMAGES.athLogo}" alt="Around The House"><span>${s.trust}</span></div>`:""}
    `;
    area.appendChild(panel);
    addNavZones(area);
  }

  if(s.type==="warrantyrecap"){
    const panel = document.createElement("div");
    panel.className="wr-panel";
    panel.innerHTML = `
      <div class="wr-head">
        <h2>${s.title}</h2>
        ${s.subtext?`<div class="wr-sub">${s.subtext}</div>`:""}
      </div>
      <div class="warranty-tiles five">
        ${s.tiles.map(t=>`
          <div class="wt ${t.hero?'hero':''}">
            <div class="wt-num">${t.num}</div>
            <div class="wt-label">${t.label}</div>
            ${t.sub?`<div class="wt-sub">${t.sub}</div>`:""}
          </div>`).join("")}
      </div>
      <div class="wr-body">
        <div class="wr-tri">
          <svg viewBox="0 0 100 100" preserveAspectRatio="none" class="wr-tri-bg">
            <polygon points="50,30 29,76 71,76" fill="#2e7d4f"/>
            <polygon points="50,36 34,73 66,73" fill="#245e3f"/>
          </svg>
          <div class="wr-tri-label">${s.triLabel || 'One warranty, backed three ways — tap a logo'}</div>
        </div>
        <div class="wr-service">
          <img src="${s.serviceBadge || IMAGES.serviceBadge}" alt="">
          <div>
            <div class="wr-service-title">${s.service.title}</div>
            <div class="wr-service-items">${s.service.items.map(i=>`<span>${i}</span>`).join("")}</div>
            <div class="wr-service-foot">${s.service.foot}</div>
          </div>
        </div>
      </div>
    `;
    area.appendChild(panel);
    // triangle nodes — same interaction pattern (and state) as the old triangle slide
    const tri = panel.querySelector(".wr-tri");
    const positions = [{top:16,left:50},{top:79,left:24},{top:79,left:76}];
    s.nodes.forEach((n,i)=>{
      const box = document.createElement("div");
      box.className="tri-node wr-node";
      box.style.top=positions[i].top+"%"; box.style.left=positions[i].left+"%"; box.style.transform="translate(-50%,-50%)";
      if(n.kind==="logo"){
        box.innerHTML = `<img src="${n.logo || PROD.logo}">`;
      } else if(n.kind==="logo-ath"){
        box.innerHTML = `<img src="${IMAGES.athLogo}">`;
      } else {
        box.classList.add("text-only");
        box.innerHTML = `<div class="gibraltar-logotype">${n.title}</div>`;
      }
      box.onclick=(e)=>{ e.stopPropagation(); triNodeOpen=i; renderSlide(); };
      tri.appendChild(box);
    });
    if(triNodeOpen!==null){
      const n = s.nodes[triNodeOpen];
      const pop = document.createElement("div");
      pop.className="popover";
      pop.style.zIndex=20;
      pop.innerHTML = `<div class="popover-card tri-detail-card"><button class="dismiss-btn popover-close">${ICON.close} Close</button>
        ${n.photo?`<img src="${n.photo}">`:""}
        <h3>${n.title}</h3><p>${n.detail}</p></div>`;
      pop.onclick=(e)=>{ e.stopPropagation(); if(e.target===pop){ triNodeOpen=null; renderSlide(); } };
      pop.querySelector(".popover-close").onclick=(e)=>{ e.stopPropagation(); triNodeOpen=null; renderSlide(); };
      area.appendChild(pop);
    }
    addNavZones(area);
  }

  if(s.type==="models"){
    const panel = document.createElement("div");
    panel.className="models-panel v2";
    panel.innerHTML = `
      <div class="mv2-head">
        <h2>${s.title}</h2>
        <div class="mv2-sub">${s.sub || 'Every unit custom-built to the inch. All three: lifetime frame · 10-yr fabric · 10-yr motor — <b>the arm warranty is the difference.</b>'}</div>
      </div>
      <div class="mv2-cards">
        ${(()=>{ const overallMaxFt = Math.max(...s.models.map(m=>m.maxProjectionFt||0)) || null; return s.models.map((mo,i)=>`
          <div class="mv2-card" data-i="${i}">
            ${s.cardGraphic==="screen" ? screenSVG(mo.c1,mo.c2) : awningSVG(mo.c1,mo.c2,{caseType:mo.caseType, armGauge:mo.armGauge, maxProjectionFt:mo.maxProjectionFt, overallMaxFt})}
            <div class="mv2-name">${mo.name}</div>
            <div class="mv2-tag">${mo.tag}</div>
            <div class="mv2-chips">${mo.chips.map(c=>`<span>${c}</span>`).join("")}</div>
            <div class="mv2-arm ${(mo.chipHero!==undefined ? mo.chipHero : i===0)?'hero':''}">${mo.heroChip || ((mo.armYears==="Lifetime"?"LIFETIME":mo.armYears.toUpperCase().replace(" YEARS","-YEAR"))+" ARM WARRANTY")}</div>
            <div class="mv2-more">Tap for full specs ›</div>
          </div>`).join(""); })()}
      </div>
      <div class="mv2-actions">
        <button id="btnModelCompare">${ICON.compare} Compare all three</button>
        <button class="secondary" id="btnGallery">Options gallery</button>
        <button class="secondary" id="btnCompare">vs. the competition</button>
      </div>
    `;
    area.appendChild(panel);
    panel.onclick=(e)=>{ e.stopPropagation(); };
    panel.querySelectorAll(".mv2-card").forEach(el=>{
      el.onclick=(e)=>{ e.stopPropagation(); modelSpec=parseInt(el.dataset.i); renderSlide(); };
    });
    panel.querySelector("#btnModelCompare").onclick=(e)=>{ e.stopPropagation(); modelCompare=true; renderSlide(); };
    panel.querySelector("#btnGallery").onclick=(e)=>{ e.stopPropagation(); galleryOpen=true; galleryIndex=0; renderSlide(); };
    panel.querySelector("#btnCompare").onclick=(e)=>{ e.stopPropagation(); compareOpen=true; renderSlide(); };

    // Fullscreen model spec popup
    if(modelSpec!==null && s.models[modelSpec]){
      const mo = s.models[modelSpec];
      const modal = document.createElement("div");
      modal.className="spec-modal";
      modal.style.zIndex=30;
      modal.innerHTML=`
        <div class="spec-head" style="border-bottom-color:${mo.c1};">
          <div>
            <div class="spec-name" style="color:${mo.c1};">${mo.name}</div>
            <div class="spec-tag">${mo.tag}</div>
          </div>
          <button class="dismiss-btn spec-close" id="specClose">${ICON.close} Close</button>
        </div>
        <div class="spec-body">
          <div class="warranty-tiles">
            ${(mo.warrantyTiles || [
              {num:"Lifetime", label:"Frame"},
              {num:mo.armYears, label:"Arms", hero:true},
              {num:"10 years", label:"Fabric"},
              {num:"10 years", label:"Motor"}
            ]).map(t=>`<div class="wt${t.hero?' hero':''}"><div class="wt-num">${t.num}</div><div class="wt-label">${t.label}</div></div>`).join("")}
          </div>
          <div class="spec-rows">
            ${mo.specs.map(([k,v])=>`<div class="spec-row"><div class="spec-k">${k}</div><div class="spec-v">${v}</div></div>`).join("")}
          </div>
          <div class="spec-best">${mo.bestFor}</div>
        </div>`;
      modal.onclick=(e)=>{ e.stopPropagation(); };
      modal.querySelector("#specClose").onclick=(e)=>{ e.stopPropagation(); modelSpec=null; renderSlide(); };
      area.appendChild(modal);
    }

    // Fullscreen 3-model comparison with category toggles
    if(modelCompare && s.modelCompare){
      const mc = s.modelCompare;
      const iconFor = st => st==="check" ? '<span class="ct-icon ct-check">✓</span>' : st==="warn" ? '<span class="ct-icon ct-warn">!</span>' : '<span class="ct-icon ct-x">✕</span>';
      const activeCats = mc.cats.filter(c=>cmpCats[c.key]);
      const modal = document.createElement("div");
      modal.className="spec-modal";
      modal.style.zIndex=30;
      modal.innerHTML=`
        <div class="spec-head">
          <div>
            <div class="spec-name">${mc.title || 'Sunesta · Sunstyle · Sunlight'}</div>
            <div class="spec-tag">Tap a category chip to show or hide it</div>
          </div>
          <button class="dismiss-btn spec-close" id="mcClose">${ICON.close} Close</button>
        </div>
        <div class="mc-toggles">
          ${mc.cats.map(c=>`<button class="mc-chip ${cmpCats[c.key]?'on':''}" data-k="${c.key}">${c.label}</button>`).join("")}
        </div>
        <div class="spec-body">
          ${activeCats.length===0 ? '<div class="mc-empty">All categories hidden — tap a chip above to bring them back.</div>' : `
          <table class="compare-table3 mc-table">
            <tr>
              <th class="ct-label"></th>
              ${(mc.columns || [
                {badge:"★ OUR PICK", name:"Sunesta", sub:"Flagship"},
                {name:"Sunstyle", sub:"Mid-line"},
                {name:"Sunlight", sub:"Entry"}
              ]).map(c=>`<th${c.badge?' class="ct-hero"':''}>${c.badge?`<div class="ct-badge">${c.badge}</div>`:""}<div class="ct-colname">${c.name}</div><div class="ct-colsub">${c.sub}</div></th>`).join("")}
            </tr>
            ${activeCats.map(cat=>`
              <tr class="mc-cat"><td colspan="4">${cat.label}</td></tr>
              ${cat.rows.map(r=>`
                <tr>
                  <td class="ct-label">${r.label}</td>
                  ${r.cells.map((c,i)=>`<td class="${i===0?'ct-hero-cell':''}">${iconFor(c[0])}<span class="ct-text">${c[1]}</span></td>`).join("")}
                </tr>`).join("")}
            `).join("")}
          </table>`}
        </div>`;
      modal.onclick=(e)=>{ e.stopPropagation(); };
      modal.querySelector("#mcClose").onclick=(e)=>{ e.stopPropagation(); modelCompare=false; renderSlide(); };
      modal.querySelectorAll(".mc-chip").forEach(ch=>{
        ch.onclick=(e)=>{ e.stopPropagation(); cmpCats[ch.dataset.k]=!cmpCats[ch.dataset.k]; renderSlide(); };
      });
      area.appendChild(modal);
    }

    if(galleryOpen){
      const g = s.gallery[galleryIndex];
      const bodyContent = g.native==="warranty"
        ? `<div class="warranty-badge"><div class="hex"><div class="stars">★★★</div><div class="nations">The Nation's Best</div><div class="warranty-word">WARRANTY</div><div class="coverage">COVERAGE</div><div class="stars">★★★</div></div></div>`
        : `<img src="${g.img}">`;
      const modal = document.createElement("div");
      modal.className="gallery-modal";
      modal.style.zIndex=30;
      modal.innerHTML=`
        <div class="gallery-card">
          <div class="gallery-head">Options <button id="gClose" class="dismiss-btn">${ICON.close} Close</button></div>
          <div class="gallery-body">
            <button class="gallery-nav prev">‹</button>
            ${bodyContent}
            <button class="gallery-nav next">›</button>
          </div>
          <div class="gallery-dots">${s.gallery.map((_,i)=>`<span class="${i===galleryIndex?'active':''}"></span>`).join("")}</div>
        </div>`;
      modal.onclick=(e)=>{ e.stopPropagation(); if(e.target===modal){galleryOpen=false; renderSlide();} };
      modal.querySelector("#gClose").onclick=(e)=>{ e.stopPropagation(); galleryOpen=false; renderSlide();};
      modal.querySelector(".prev").onclick=(e)=>{ e.stopPropagation(); galleryIndex=(galleryIndex-1+s.gallery.length)%s.gallery.length; renderSlide();};
      modal.querySelector(".next").onclick=(e)=>{ e.stopPropagation(); galleryIndex=(galleryIndex+1)%s.gallery.length; renderSlide();};
      area.appendChild(modal);
    }

    if(compareOpen){
      const cmp = s.comparison;
      const iconFor = st => st==="check" ? '<span class="ct-icon ct-check">✓</span>' : st==="warn" ? '<span class="ct-icon ct-warn">!</span>' : '<span class="ct-icon ct-x">✕</span>';
      const modal = document.createElement("div");
      modal.className="gallery-modal";
      modal.style.zIndex=30;
      modal.innerHTML=`
        <div class="gallery-card compare-card">
          <div class="gallery-head">${cmp.title || 'Not All Awnings Are Created Equal'} <button id="cClose" class="dismiss-btn">${ICON.close} Close</button></div>
          <div class="compare-scroll">
            <table class="compare-table3">
              <tr>
                <th class="ct-label"></th>
                ${cmp.columns.map(c=>`
                  <th class="${c.badge?'ct-hero':''}">
                    ${c.badge?`<div class="ct-badge">${c.badge}</div>`:""}
                    <div class="ct-colname">${c.name}</div>
                    <div class="ct-colsub">${c.sub}</div>
                  </th>`).join("")}
              </tr>
              ${cmp.rows.map(row=>`
                <tr>
                  <td class="ct-label">${row.label}</td>
                  ${row.cells.map(c=>`<td class="${c.s==='check'?'ct-hero-cell':''}">${iconFor(c.s)}<span class="ct-text">${c.t}</span></td>`).join("")}
                </tr>`).join("")}
            </table>
          </div>
          ${cmp.footer?`<div class="compare-footer">${cmp.footer}</div>`:""}
        </div>`;
      modal.onclick=(e)=>{ e.stopPropagation(); if(e.target===modal){compareOpen=false; renderSlide();} };
      modal.querySelector("#cClose").onclick=(e)=>{ e.stopPropagation(); compareOpen=false; renderSlide();};
      area.appendChild(modal);
    }
  }

  if(s.type==="reasonsgrid"){
    const panel = document.createElement("div");
    panel.className="reasonsgrid-panel";
    panel.innerHTML = `
      <h2>${s.title}</h2>
      <div class="reasonsgrid-grid">
        ${s.reasons.map((r,i)=>`
          <div class="reason-card">
            <div class="reason-num">${i+1}</div>
            <div class="reason-body"><h3>${r.title}</h3><p>${r.text}</p></div>
          </div>`).join("")}
      </div>`;
    if(s.columns===1){ panel.querySelector(".reasonsgrid-grid").style.gridTemplateColumns = "1fr"; }
    area.appendChild(panel);
    addNavZones(area);
  }

  const badge = document.createElement("div");
  badge.className = "slide-num-badge";
  badge.textContent = `#${globalSlideNumber()} — ${s.title || s.id}`;
  area.appendChild(badge);
}

// Shared reference-body builders — used by both the rehearsal side panel (tabs)
// and the Training Center's full-page resource views.
function trainingBodyHTML(view){
  if(typeof tcvIsView === "function" && tcvIsView(view)) return tcvBodyHTML(view);
  // dodont/faq/close/recap/tensteps used to read a per-product TRAINING_REFERENCE
  // / ECLIPSE_TRAINING const, rendered as raw unescaped innerHTML with no
  // {{TOKEN}} support. That content is now migrated into each product's
  // training content JSON (ref_dodont / ref_faq / ref_close / ref_predemo
  // entries, looked up via tcEntry()) or, for genuinely shared content —
  // the 10-step process and the ATH/Profectus core (do_dont, four_sales,
  // formerly registry.js's TRAINING_SHARED const) — the shared content
  // file via tcSequence()/tcSharedRef() (see js/training-content.js for
  // why those moved instead of staying static code). Every interpolated
  // string below now goes through tcField(), which resolves (escapes +
  // {{TOKENS}}) AND tags the field with its content path for Edit Mode —
  // closing the raw-innerHTML gap while reproducing the exact same HTML
  // shape/CSS classes as before, so this is a data-source change, not a
  // redesign. joinFields renders an array field as one flowing block
  // (matching this page's pre-existing look) while keeping each array
  // element its OWN editable span, same schema-honest approach
  // tcBlockHTML uses on the walk screen; liFields does the same for a
  // field that renders as separate <li> items instead of one block.
  const joinFields = (id, pathPrefix, arr) =>
    (arr || []).map((_, i) => tcField(id, `${pathPrefix}.${i}`)).join("\n\n");
  const liFields = (id, pathPrefix, arr) =>
    (arr || []).map((_, i) => `<li>${tcField(id, `${pathPrefix}.${i}`)}</li>`).join("");
  if(view==="dodont"){
    // Shared ATH/Profectus core (tcSharedRef — every product falls back to
    // the same committed copy, editable from any product's Coach) + this
    // product's own additions (ref_dodont.training_notes).
    const shared = tcSharedRef("do_dont") || {do_not:[], do:[]};
    const fourSales = tcSharedRef("four_sales") || {intro:"", items:[], footer:""};
    const ownEntry = typeof tcEntry === "function" ? tcEntry("ref_dodont") : null;
    const own = (ownEntry && ownEntry.training_notes) || {};
    const dontHTML = liFields("ref:do_dont", "do_not", shared.do_not)
      + liFields("ref_dodont", "training_notes.do_not", own.do_not);
    const dosHTML = liFields("ref:do_dont", "do", shared.do)
      + liFields("ref_dodont", "training_notes.do", own.do);
    return `
      <div class="eyebrow">Reference — every call</div>
      <h2>Do & Don't</h2>
      <div class="tref-section"><h3 class="tref-h3 bad">${ICON.xCircle} What NOT to do</h3><ul class="talking-points">${dontHTML}</ul></div>
      <div class="tref-section"><h3 class="tref-h3 good">${ICON.checkCircle} What TO do</h3><ul class="talking-points">${dosHTML}</ul></div>
      <div class="tref-section"><h3 class="tref-h3">${ICON.target} The Four Sales</h3><div class="script-block">${tcField("ref:four_sales", "intro")}</div><ul class="talking-points">${liFields("ref:four_sales", "items", fourSales.items)}</ul><div class="coach-note">${ICON.bulb} ${tcField("ref:four_sales", "footer")}</div></div>
    `;
  }
  if(view==="faq"){
    // The pricing module's own reactive_scripts (the "If they ask…" drawer
    // content, financing/subcontractors) are the SAME data as this page's
    // matching entries, not a duplicate copy — concatenated here rather
    // than repeated in ref_faq, so there's exactly one place to edit each
    // answer. Eclipse has no module, so its list is ref_faq alone. Each
    // source keeps its own entryId + in-source index for correct paths.
    const m = typeof tcModule === "function" ? tcModule() : null;
    const refFaq = typeof tcEntry === "function" ? tcEntry("ref_faq") : null;
    const sources = [
      ...((m && m.reactive_scripts) || []).map((f,i) => ({f, id:m.module_id, i})),
      ...((refFaq && refFaq.reactive_scripts) || []).map((f,i) => ({f, id:"ref_faq", i})),
    ];
    return `
      <div class="eyebrow">Reference — any slide, any time</div>
      <h2>FAQs & Objections</h2>
      ${sources.map(({f,id,i})=>`
        <div class="faq-item">
          <div class="faq-q"><span class="faq-tag${f.tag==='Objection'?' obj':''}">${tcEsc(f.tag||"FAQ")}</span>${tcField(id, `reactive_scripts.${i}.question`)}</div>
          <div class="script-block faq-a">${joinFields(id, `reactive_scripts.${i}.answer`, f.answer)}</div>
        </div>`).join("")}
    `;
  }
  if(view==="close"){
    const c = typeof tcEntry === "function" ? tcEntry("ref_close") : null;
    if(!c) return `<div class="tc-empty">No Pricing & Close reference loaded for this product.</div>`;
    return `
      <div class="eyebrow">Reference — the pricing moment</div>
      <h2>Pricing & Close</h2>
      <div class="coach-note tref-gap">${ICON.bulb} ${tcField("ref_close", "coaching_note")}</div>
      ${(c.blocks||[]).map((b,bi)=>`<div class="tref-section"><h3 class="tref-h3">${tcField("ref_close", `blocks.${bi}.label`)}</h3><div class="script-block">${joinFields("ref_close", `blocks.${bi}.script`, b.script)}</div></div>`).join("")}
    `;
  }
  if(view==="recap"){
    const p = typeof tcEntry === "function" ? tcEntry("ref_predemo") : null;
    if(!p) return `<div class="tc-empty">No Pre-Demo Recap reference loaded for this product.</div>`;
    return `
      <div class="eyebrow">Reference — before slide 1</div>
      <h2>Pre-Demo Recap at the Table</h2>
      <div class="coach-note tref-gap">${ICON.bulb} ${tcField("ref_predemo", "coaching_note")}</div>
      <div class="script-block">${joinFields("ref_predemo", "blocks.0.script", p.blocks && p.blocks[0] && p.blocks[0].script)}</div>
    `;
  }
  if(view==="tensteps"){
    const t = typeof tcSequence === "function" ? tcSequence("ten_steps") : null;
    if(!t) return `<div class="tc-empty">10-step process not loaded.</div>`;
    const seqId = "seq:ten_steps";
    return `
      <div class="eyebrow">Reference — the whole visit</div>
      <h2>Our 10-Step Sales Process</h2>
      <div class="coach-note tref-gap">${ICON.bulb} ${tcField(seqId, "intro")}</div>
      <ol class="ten-steps">
        ${t.steps.map((st,sti)=>`
          <li class="ten-step">
            <div class="ten-step-num">${st.n}</div>
            <div class="ten-step-body">
              <div class="ten-step-title">${tcField(seqId, `steps.${sti}.title`)}</div>
              <div class="ten-step-stage">${tcField(seqId, `steps.${sti}.stage`)}</div>
              ${st.detail?`<div class="ten-step-detail">${tcField(seqId, `steps.${sti}.detail`)}</div>`:""}
            </div>
          </li>`).join("")}
      </ol>
    `;
  }
  return "";
}

function renderRehearsal(){
  const panel = document.getElementById("rehearsalPanel");
  const s = currentSlide();
  const views = [["slide","This Slide"],["dodont","Do & Don't"],["faq","FAQs"],["close","Close"],["recap","Pre-Demo"]];
  const tabsHTML = `<div class="training-tabs">${views.map(([k,l])=>`<button class="${k===trainingView?'active':''}" data-view="${k}">${l}</button>`).join("")}</div>`;
  let body = "";

  if(trainingView==="slide"){
    // Training content comes from data/doghouse-content-v1.json via the
    // adapter, joined by slide id. Fallback policy differs by product:
    //   · Covered product (sunesta), content loaded, slide unmapped ->
    //     VISIBLE gap state. Never the legacy fields: a rep silently reading
    //     stale pre-overhaul content is worse than a visible hole, and the
    //     startup audit (tcAuditMapping) has already flagged it loudly.
    //   · Covered product, content file failed to load -> legacy fields
    //     WITH a warning banner (different failure, still never silent).
    //   · Content still loading -> legacy fields, unchanged, no banner.
    // Both products carry a trainingContentFile now (training-mode-v2 Phase
    // 2 migration), so "covered" is no longer a per-product distinction —
    // it's just "does this product declare a content file at all", which
    // only a hypothetical future uncovered product would fail.
    const covered = !!(PROD && PROD.trainingContentFile);
    const tc = covered && (typeof tcForDeckSlide === "function") ? tcForDeckSlide(s.id) : null;
    if(tc){
      body = `<div class="tc-panel">${tcEntryHTML(tc, {section: activeTab})}</div>`;
    } else if(covered && typeof tcReady === "function" && tcReady()){
      body = `
        <div class="tc-missing">
          <div class="tc-missing-k">${ICON.warn} No training content for this slide</div>
          <p>Deck slide <code>${s.id}</code> has no entry in the training content file.
          Nothing stale is shown in its place — add a <code>deck_map</code> entry in
          this product's content JSON (the console lists every gap at load).</p>
        </div>`;
    } else if(covered && typeof tcLoadFailed === "function" && tcLoadFailed()){
      // Settled and failed. The legacy per-slide script/talkingPoints/coach
      // fields used to render here, but they're gone from js/data-eclipse.js
      // (and were already stale on Sunesta — 0 of 22 still matched the content
      // JSON). Showing a rep pre-rewrite script is worse than showing nothing,
      // so this state is now the banner alone.
      body = `
        <div class="tc-loadfail">${ICON.warn} Training content file failed to load — no script available for this slide. Reconnect or reinstall the app.</div>
        <div class="eyebrow">Training mode — Slide #${globalSlideNumber()}</div>
        <h2>${s.title}</h2>`;
    } else {
      // Still in flight. Deliberately NOT the unmapped gap state — that reads
      // as "this slide has no content", which is wrong and alarming during a
      // perfectly normal fetch. tcEnsureProductContent() calls
      // onTrainingContentReady() when it settles, which re-renders this panel.
      body = `
        <div class="eyebrow">Training mode — Slide #${globalSlideNumber()}</div>
        <h2>${s.title}</h2>
        <div class="tc-empty">Loading training content…</div>`;
    }
  } else {
    body = trainingBodyHTML(trainingView);
  }

  panel.innerHTML = tabsHTML + body;
  panel.querySelectorAll(".training-tabs button").forEach(b=>{
    b.onclick = ()=>{ trainingView = b.dataset.view; renderRehearsal(); };
  });
  if(typeof tcBindToggles === "function") tcBindToggles(panel, renderRehearsal);
}

// Called by the content adapter once the JSON resolves.
function onTrainingContentReady(){
  if(mode === "rehearse" && document.getElementById("rehearsalPanel").style.display !== "none") renderRehearsal();
  if(appView === "center") renderCenter();
}

function renderAll(){
  renderTabs();
  renderDots();
  renderSlide();
  document.getElementById("stage").className = "stage"+(mode==="rehearse"?" rehearsal":"");
  document.getElementById("rehearsalPanel").style.display = mode==="rehearse" ? "block":"none";
  if(mode==="rehearse") renderRehearsal();
}

// ===== App shell: home screen · in-home presentation · training center =====

function renderHome(){
  const el = document.getElementById("homeScreen");
  el.innerHTML = `
    <div class="home-hero">
      <img class="home-logo" src="${IMAGES.athLogo}" alt="Around The House">
      <h1>THE DOGHOUSE</h1>
      <div class="home-sub">Around The House Home Solutions · Sales & Training</div>
    </div>
    <div class="home-cards">
      <div class="home-card" id="homeGoPresent">
        <div class="home-card-icon">${ICON.play}</div>
        <div class="home-card-name">Presentations</div>
        <div class="home-card-sub">Customer-facing product demos</div>
      </div>
      <div class="home-card secondary" id="homeGoCenter">
        <div class="home-card-icon">${ICON.cap}</div>
        <div class="home-card-name">Training Center</div>
        <div class="home-card-sub">Rep-only — coaches, scripts & tools</div>
      </div>
      <div class="home-card secondary" id="homeGoQuote">
        <div class="home-card-icon">${ICON.calculator}</div>
        <div class="home-card-name">Quote Builder</div>
        <div class="home-card-sub">Live pricing from Cockpit — works offline</div>
      </div>
    </div>
  `;
  document.getElementById("homeGoPresent").onclick = ()=>{ appView = "presentations"; renderApp(); };
  document.getElementById("homeGoCenter").onclick = ()=>{ appView = "coaches"; renderApp(); };
  document.getElementById("homeGoQuote").onclick = ()=>{ appView = "quote"; renderApp(); };
}

// Product picker — shared by Presentations and Training Center entry points.
function renderPicker(){
  const el = document.getElementById("trainingCenter");
  const isPres = appView === "presentations";
  el.innerHTML = `
    <div class="center-head">
      <div class="eyebrow">${isPres ? "Customer-facing" : "Rep-only"}</div>
      <h1>${isPres ? "Presentations" : "Training Center"}</h1>
    </div>
    <div class="center-cards">
      ${PRODUCTS.map(p=>`
        <div class="center-card product${p.ready?"":" soon"}" data-key="${p.key}">
          <div class="center-card-icon">${p.icon}</div>
          <div>
            <div class="center-card-name">${isPres ? p.name : p.coach + " Training Coach"}</div>
            <div class="center-card-sub">${p.ready ? p.tag : "Coming soon"}</div>
          </div>
          ${p.ready ? "" : '<span class="soon-chip">SOON</span>'}
        </div>`).join("")}
    </div>
  `;
  el.querySelectorAll(".center-card.product").forEach(card=>{
    card.onclick = ()=>{
      const p = PRODUCTS.find(x=>x.key===card.dataset.key);
      if(!p || !p.ready || !PRODUCT_DATA[p.key]) return;
      setProduct(p.key);
      resetSlideState();
      if(isPres){ appView = "present"; }
      else { appView = "center"; centerView = null; }
      renderApp();
    };
  });
}

function renderCenter(){
  const el = document.getElementById("trainingCenter");
  if(centerView === null){
    const photoCount = (PROD.photoCats || Object.keys(PHOTO_LIBRARY))
      .reduce((n,c)=>n+(PHOTO_LIBRARY[c]?PHOTO_LIBRARY[c].photos.length:0),0);
    const docsCard = PROD.docsCard || {name:"Docs & Spec Sheets", sub:"Product documents"};
    const cards = [
      {key:"deck",     icon:ICON.monitor, name:"Training Presentation", sub:"The full deck with word-for-word scripts & coach notes"},
      {key:"tensteps", icon:ICON.steps, name:"Our 10-Step Sales Process", sub:"The whole visit, start to finish"},
      {key:"library",  icon:ICON.camera, name:"Photo Library", sub:photoCount+" real project photos — by model & category"},
      {key:"docs",     icon:ICON.doc, name:docsCard.name, sub:docsCard.sub},
      {key:"recap",    icon:ICON.clipboard, name:"Pre-Demo Recap", sub:"At the table, before slide 1"},
      {key:"dodont",   icon:ICON.target, name:"Do & Don't", sub:"Every call · The Four Sales"},
      {key:"faq",      icon:ICON.chat, name:"FAQs & Objections", sub:"Verbatim responses, any slide any time"},
      {key:"close",    icon:ICON.tag, name:"Pricing & Close", sub:"The pricing moment, spoken over the estimate"},
      // Training v2 views (js/training-coach.js) — only offered when the
      // JSON content file covers this product and has loaded.
      ...((typeof tcvHubCards === "function") ? tcvHubCards() : [])
    ];
    el.innerHTML = `
      <div class="center-head">
        <div class="eyebrow">${productInfo().name} — rep-only</div>
        <h1>${productInfo().coach} Training Coach</h1>
      </div>
      <div class="center-cards">
        ${cards.map(c=>`
          <div class="center-card" data-key="${c.key}">
            <div class="center-card-icon">${c.icon}</div>
            <div>
              <div class="center-card-name">${c.name}</div>
              <div class="center-card-sub">${c.sub}</div>
            </div>
          </div>`).join("")}
      </div>
    `;
    el.querySelectorAll(".center-card").forEach(card=>{
      card.onclick = ()=>{
        const k = card.dataset.key;
        if(k==="deck"){
          activeTab = tabs[0]; activeIndex = 0; resetSlideState(); trainingView = "slide";
          appView = "training-deck"; renderApp();
        } else {
          centerView = k; libPhoto = null; renderCenter();
        }
      };
    });
  } else if(centerView === "library"){
    const cats = (PROD.photoCats || Object.keys(PHOTO_LIBRARY)).filter(c=>PHOTO_LIBRARY[c]);
    const cur = PHOTO_LIBRARY[libCat];
    el.innerHTML = `
      <div class="center-head resource">
        <button class="back-btn" id="resourceBack">‹ ${productInfo().coach} Coach</button>
      </div>
      <div class="resource-page wide">
        <div class="eyebrow">Photo Library</div>
        <h2>${cur.label} — ${cur.photos.length} photos</h2>
        <div class="lib-pills">
          ${cats.map(c=>`<button class="${c===libCat?'active':''}" data-c="${c}">${PHOTO_LIBRARY[c].label} · ${PHOTO_LIBRARY[c].photos.length}</button>`).join("")}
        </div>
        <div class="lib-grid">
          ${cur.photos.map((p,i)=>`<div class="lib-cell" data-i="${i}"><img decoding="async" ${i<24?`src="${p.t}"`:`data-src="${p.t}"`} alt=""></div>`).join("")}
        </div>
      </div>
    `;
    // First 24 thumbs load eagerly (first screenful). The tail lazy-loads via
    // IntersectionObserver, with a scroll-position fallback for environments
    // where render-tied observers don't fire.
    const pending = [...el.querySelectorAll(".lib-cell img[data-src]")];
    const io = new IntersectionObserver(entries=>{
      entries.forEach(en=>{
        if(en.isIntersecting){ const t=en.target; if(t.dataset.src){ t.src=t.dataset.src; delete t.dataset.src; } io.unobserve(t); }
      });
    }, {root: el, rootMargin: "700px"});
    pending.forEach(t=>io.observe(t));
    el.onscroll = ()=>{
      const lim = el.scrollTop + el.clientHeight + 900;
      pending.forEach(t=>{
        if(t.dataset.src && t.closest(".lib-cell").offsetTop < lim){ t.src=t.dataset.src; delete t.dataset.src; }
      });
    };
    document.getElementById("resourceBack").onclick = ()=>{ centerView = null; libPhoto = null; renderCenter(); };
    el.querySelectorAll(".lib-pills button").forEach(b=>{
      b.onclick = ()=>{ libCat = b.dataset.c; libPhoto = null; renderCenter(); el.scrollTop = 0; };
    });
    el.querySelectorAll(".lib-cell").forEach(cell=>{
      cell.onclick = ()=>{ libPhoto = parseInt(cell.dataset.i); renderCenter(); };
    });
    if(libPhoto !== null && cur.photos[libPhoto]){
      const ph = cur.photos[libPhoto];
      const lb = document.createElement("div");
      lb.className = "lib-lightbox";
      lb.innerHTML = `
        <button class="dismiss-btn on-dark lightbox-close">${ICON.close} Close</button>
        <button class="lib-nav prev">‹</button>
        <figure><img src="${ph.f}"><figcaption>${ph.c}</figcaption></figure>
        <button class="lib-nav next">›</button>
      `;
      lb.onclick = (e)=>{ if(e.target===lb){ libPhoto=null; renderCenter(); } };
      lb.querySelector(".lightbox-close").onclick = ()=>{ libPhoto=null; renderCenter(); };
      lb.querySelector(".prev").onclick = ()=>{ libPhoto=(libPhoto-1+cur.photos.length)%cur.photos.length; renderCenter(); };
      lb.querySelector(".next").onclick = ()=>{ libPhoto=(libPhoto+1)%cur.photos.length; renderCenter(); };
      el.appendChild(lb);
    }
  } else if(centerView === "docs"){
    el.innerHTML = `
      <div class="center-head resource">
        <button class="back-btn" id="resourceBack">‹ ${productInfo().coach} Coach</button>
      </div>
      <div class="resource-page">
        <div class="eyebrow">Documents</div>
        <h2>${(PROD.docsCard || {}).name || "Docs & Spec Sheets"}</h2>
        <div class="doc-list">
          ${(PROD.docs || []).map(d=>`
            <a class="doc-row" href="${d.file}" target="_blank" rel="noopener">
              <span class="doc-icon">${d.kind==="pdf"?ICON.doc:ICON.palette}</span>
              <span class="doc-name">${d.name}</span>
              <span class="doc-open">${d.kind==="pdf"?"Open PDF ›":"View ›"}</span>
            </a>`).join("")}
        </div>
        <div class="coach-note" style="margin-top:16px;">${ICON.bulb} Documents open in a new tab — hand the iPad over for fabric browsing, or AirDrop the PDF to the customer.</div>
      </div>
    `;
    document.getElementById("resourceBack").onclick = ()=>{ centerView = null; renderCenter(); };
    el.scrollTop = 0;
  } else {
    // Edit Mode + Export live in this one shared header because every
    // dodont/faq/close/recap/tensteps/script/setup/cflags view routes
    // through here — one place to wire instead of eight. Both are inert
    // no-ops on views with no editable text (setup/cflags), so there's no
    // need to special-case them out.
    const showEditControls = typeof tcReady === "function" && tcReady();
    el.innerHTML = `
      <div class="center-head resource">
        <button class="back-btn" id="resourceBack">‹ ${productInfo().coach} Coach</button>
        ${showEditControls ? `<div class="resource-actions">${tcEditToggleHTML()}${tcExportButtonHTML()}</div>` : ""}
      </div>
      ${(typeof tcEditOn !== "undefined" && tcEditOn) ? `<div class="tcv-edit-hint">${ICON.pencil} Edit Mode is on — tap any highlighted text to edit it. Enter saves, Shift+Enter for a new line, Esc cancels.</div>` : ""}
      <div class="resource-page">${trainingBodyHTML(centerView)}</div>
    `;
    document.getElementById("resourceBack").onclick = ()=>{ centerView = null; renderCenter(); };
    if(showEditControls){
      const rerender = () => renderCenter();
      // The 'script' view's editable spans live inside #tcvRoot, filled in
      // by tcvBind()/tcvRenderWalk() below (a separate render pass) — bind
      // only the header controls here and let that pass bind its own spans.
      const editRoot = centerView === "script" ? null : el.querySelector(".resource-page");
      tcvBindEditControls(el.querySelector(".center-head.resource"), editRoot, rerender);
    }
    if(typeof tcvIsView === "function" && tcvIsView(centerView)) tcvBind(el, centerView);
    el.scrollTop = 0;
  }
}

function renderTopbarNav(){
  const nav = document.getElementById("topbarNav");
  const deckNav = document.getElementById("slidebarLead");
  let html = "";
  if(appView==="present"){
    // deliberately unlabeled — customers just see a quiet close control
    html = `<button class="exit-btn" id="exitBtn" aria-label="Exit">${ICON.close}</button>`;
  } else if(appView==="training-deck"){
    html = `<button class="back-btn" id="backCenterBtn">‹ ${productInfo().coach} Coach</button>`;
  } else if(appView==="center"){
    html = `<button class="back-btn" id="backCoachesBtn">‹ Training Center</button>`;
  } else if(appView==="presentations" || appView==="coaches"){
    html = `<button class="back-btn" id="homeBtn">‹ Home</button>`;
  } else if(appView==="quote"){
    const label = qbView==="picker" ? "Home" : "Quote Builder";
    html = `<button class="back-btn" id="backQuoteBtn">‹ ${label}</button>`;
  }
  // Deck views hide the top bar (full-bleed), so their exit/back control
  // renders into the slide-counter row instead. Exactly one container is
  // populated at a time, so the button ids stay unique either way.
  const inDeck = appView==="present" || appView==="training-deck";
  nav.innerHTML     = inDeck ? "" : html;
  deckNav.innerHTML = inDeck ? html : "";
  const ex = document.getElementById("exitBtn");   if(ex) ex.onclick = goHome;
  const hm = document.getElementById("homeBtn");   if(hm) hm.onclick = goHome;
  const bc = document.getElementById("backCenterBtn"); if(bc) bc.onclick = ()=>{ appView="center"; centerView=null; renderApp(); };
  const bk = document.getElementById("backCoachesBtn"); if(bk) bk.onclick = ()=>{ appView="coaches"; centerView=null; libPhoto=null; renderApp(); };
  const bq = document.getElementById("backQuoteBtn"); if(bq) bq.onclick = ()=>{
    if(qbView==="picker"){ goHome(); }
    else { qbResetToPicker(); renderApp(); }
  };
}

function goHome(){ appView = "home"; centerView = null; libPhoto = null; if(typeof qbResetToPicker==="function") qbResetToPicker(); resetSlideState(); renderApp(); }

function renderApp(){
  const showDeck = appView==="present" || appView==="training-deck";
  // Full-bleed edge-to-edge layout, deck views only (see css "FULL-BLEED
  // DECK LAYOUT"). Gated on appView, so both product decks get it and the
  // home/picker/Quote Builder card layouts are left alone.
  document.body.classList.toggle("deck-full", showDeck);
  const showPanel = appView==="center" || appView==="presentations" || appView==="coaches";
  document.getElementById("homeScreen").style.display     = appView==="home" ? "" : "none";
  document.getElementById("trainingCenter").style.display = showPanel ? "" : "none";
  document.getElementById("quoteBuilder").style.display    = appView==="quote" ? "" : "none";
  document.getElementById("stage").style.display          = showDeck ? "" : "none";
  document.querySelector(".slidebar").style.display       = showDeck ? "" : "none";
  document.getElementById("tabbar").style.display         = showDeck ? "" : "none";
  // Customer-facing mode navigates by swipe (see initSwipeNav) — the tap
  // arrows are Training Mode only, where the existing nav is untouched.
  const showArrows = showDeck && appView !== "present";
  document.getElementById("prevBtn").style.display = showArrows ? "" : "none";
  document.getElementById("nextBtn").style.display = showArrows ? "" : "none";
  document.querySelector(".note").style.display           = appView==="home" ? "" : "none";
  // customers see the product brand, not the internal DOGHOUSE name
  document.getElementById("brandText").innerHTML = (appView==="present")
    ? (PROD.brandHTML || ('Around The House · <b>'+productInfo().name+'</b>'))
    : 'Around The House · <b>THE DOGHOUSE</b>';
  renderTopbarNav();
  if(appView==="home") renderHome();
  if(appView==="center") renderCenter();
  if(appView==="presentations" || appView==="coaches") renderPicker();
  if(appView==="quote") renderQuoteBuilder();
  if(showDeck){
    mode = appView==="training-deck" ? "rehearse" : "present";
    renderAll();
  }
}

document.getElementById("prevBtn").onclick=goPrev;
document.getElementById("nextBtn").onclick=goNext;
initSwipeNav();

// Boot on the default product so a bare refresh always has a bound deck.
// The picker rebinds via setProduct() when a different product is chosen.
setProduct("sunesta");
renderApp();

// Offline support. Registration is async and non-blocking, so it's safe
// to fire immediately rather than gate on window "load" (which on some
// embedded/automation browser contexts can already have fired by the
// time this script runs).
if("serviceWorker" in navigator){
  navigator.serviceWorker.register("sw.js").then(() => {
    // Nudge Tier 2 (Photo Library + Docs) background caching on every
    // online app open, not just first install — a pass interrupted by
    // spotty wifi (or a version bump that added new Tier 2 files) picks
    // back up here instead of silently staying incomplete. Cheap no-op
    // once everything is already cached (sw.js skips files it already has).
    return navigator.serviceWorker.ready;
  }).then((reg) => {
    if(navigator.onLine && reg.active){
      reg.active.postMessage({type:"CACHE_TIER2"});
      // Same idea for Tier 3 (Quote Builder pricing) — re-checks Cockpit's
      // freshness stamp on every online open, not just first sync.
      reg.active.postMessage({type:"SYNC_PRICING"});
    }
  }).catch((err) => {
    console.warn("Service worker registration failed:", err);
  });
}
