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

function awningSVG(c1="#1b5e3f", c2="#2e7d4f"){
  let stripes = "";
  const stripeW = 18;
  for(let i=0;i<9;i++){
    const x = 20 + i*stripeW;
    const color = i%2===0 ? c1 : c2;
    stripes += `<polygon points="${x},95 ${x+stripeW},95 ${x+stripeW-40},20 ${x-40},20" fill="${color}"/>`;
  }
  let scallops = "";
  for(let i=0;i<9;i++){
    const cx = 20 + i*stripeW + stripeW/2 - 40*0.5;
    scallops += `<path d="M ${cx-9} 95 Q ${cx} 108 ${cx+9} 95 Z" fill="${i%2===0?c1:c2}"/>`;
  }
  return `
  <svg viewBox="0 0 240 130" xmlns="http://www.w3.org/2000/svg" style="width:100%;height:auto;">
    <rect x="180" y="8" width="50" height="15" rx="2" fill="#9a9a9a"/>
    <rect x="205" y="20" width="8" height="14" fill="#b5b5b5"/>
    ${stripes}
    ${scallops}
    <line x1="20" y1="95" x2="230" y2="23" stroke="#fff" stroke-width="1" opacity=".25"/>
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
    const gridCols = s.photos.length > 4 ? 3 : 2;
    const gridRows = Math.ceil(s.photos.length / gridCols);
    grid.style.gridTemplateColumns = `repeat(${gridCols},1fr)`;
    grid.style.gridTemplateRows = `repeat(${gridRows},1fr)`;
    s.photos.forEach((p,i)=>{
      const cell = document.createElement("div");
      cell.className="photogrid-cell";
      cell.innerHTML = `<img src="${p}"><div class="expand-ring"></div>`;
      cell.onclick=(e)=>{ e.stopPropagation(); lightboxIndex=i; renderSlide(); };
      grid.appendChild(cell);
    });
    panel.appendChild(grid);
    panel.insertAdjacentHTML("beforeend", footerBannerHTML(s.title));
    area.appendChild(panel);
    if(lightboxIndex!==null){
      const lb = document.createElement("div");
      lb.className="lightbox";
      lb.innerHTML = `<button class="lightbox-close">${ICON.close}</button><img src="${s.photos[lightboxIndex]}">`;
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
        pop.innerHTML = `<div class="popover-card"><button class="popover-close">${ICON.close}</button>${h.photo?`<img class="reason-pop-img" src="${h.photo}">`:""}<h3>${h.label}</h3><p>${h.content}</p></div>`;
        pop.onclick=(e)=>{ e.stopPropagation(); if(e.target===pop){ openHotspot=null; renderSlide(); } };
        pop.querySelector(".popover-close").onclick=(e)=>{ e.stopPropagation(); openHotspot=null; renderSlide(); };
        area.appendChild(pop);
      }
    }
    addNavZones(area);
  }

  if(s.type==="difference"){
    const panel = document.createElement("div");
    panel.className="difference-panel";
    const rowsHTML = s.rows.map(r=>{
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
        <p>${s.paragraph}</p>
      </div>
    `;
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
      pop.innerHTML = `<div class="popover-card"><button class="popover-close">${ICON.close}</button><h3>${r.label}</h3><p>${r.detail}</p></div>`;
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
          <img src="${r.photo}" alt="">
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
      pop.innerHTML = `<div class="popover-card"><button class="popover-close">${ICON.close}</button>
        ${r.popPhoto?`<img class="reason-pop-img" src="${r.popPhoto}">`:""}
        ${r.logo?`<img class="popover-logo" src="${r.logo}">`:""}
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
      pop.innerHTML = `<div class="popover-card tri-detail-card"><button class="popover-close">${ICON.close}</button>
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
          <button class="doc-viewer-close" aria-label="Close">${ICON.close}</button>
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
          ${s.subtext?`<div class="hero-subtext">${s.subtext}</div>`:""}
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
        pop.innerHTML = `<div class="popover-card"><button class="popover-close">${ICON.close}</button>${h.photo?`<img class="reason-pop-img" src="${h.photo}">`:""}<h3>${h.label}</h3><p>${h.content}</p></div>`;
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
      pop.innerHTML = `<div class="popover-card tri-detail-card"><button class="popover-close">${ICON.close}</button>
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
        ${s.models.map((mo,i)=>`
          <div class="mv2-card" data-i="${i}">
            ${s.cardGraphic==="screen" ? screenSVG(mo.c1,mo.c2) : awningSVG(mo.c1,mo.c2)}
            <div class="mv2-name">${mo.name}</div>
            <div class="mv2-tag">${mo.tag}</div>
            <div class="mv2-chips">${mo.chips.map(c=>`<span>${c}</span>`).join("")}</div>
            <div class="mv2-arm ${(mo.chipHero!==undefined ? mo.chipHero : i===0)?'hero':''}">${mo.heroChip || ((mo.armYears==="Lifetime"?"LIFETIME":mo.armYears.toUpperCase().replace(" YEARS","-YEAR"))+" ARM WARRANTY")}</div>
            <div class="mv2-more">Tap for full specs ›</div>
          </div>`).join("")}
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
          <button class="spec-close" id="specClose">${ICON.close}</button>
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
          <button class="spec-close" id="mcClose">${ICON.close}</button>
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
          <div class="gallery-head">Options <button id="gClose">${ICON.close}</button></div>
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
          <div class="gallery-head">${cmp.title || 'Not All Awnings Are Created Equal'} <button id="cClose">${ICON.close}</button></div>
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
  if(view==="dodont"){
    // Shared ATH/Profectus core (TRAINING_SHARED, js/registry.js) + this
    // product's own additions appended to each list.
    const shared = TRAINING_SHARED.doDont;
    const own = (PROD.training && PROD.training.doDont) || {};
    const dont = shared.dont.concat(own.dont || []);
    const dos  = shared.do.concat(own.do || []);
    const fs = shared.fourSales;
    return `
      <div class="eyebrow">Reference — every call</div>
      <h2>Do & Don't</h2>
      <div class="tref-section"><h3 class="tref-h3 bad">${ICON.xCircle} What NOT to do</h3><ul class="talking-points">${dont.map(t=>`<li>${t}</li>`).join("")}</ul></div>
      <div class="tref-section"><h3 class="tref-h3 good">${ICON.checkCircle} What TO do</h3><ul class="talking-points">${dos.map(t=>`<li>${t}</li>`).join("")}</ul></div>
      <div class="tref-section"><h3 class="tref-h3">${ICON.target} The Four Sales</h3><div class="script-block">${fs.intro}</div><ul class="talking-points">${fs.items.map(t=>`<li>${t}</li>`).join("")}</ul><div class="coach-note">${ICON.bulb} ${fs.footer}</div></div>
    `;
  }
  if(view==="faq"){
    return `
      <div class="eyebrow">Reference — any slide, any time</div>
      <h2>FAQs & Objections</h2>
      ${PROD.training.faqs.map(f=>`
        <div class="faq-item">
          <div class="faq-q"><span class="faq-tag${f.tag==='Objection'?' obj':''}">${f.tag}</span>${f.q}</div>
          <div class="script-block faq-a">${f.a}</div>
        </div>`).join("")}
    `;
  }
  if(view==="close"){
    const c = PROD.training.close;
    return `
      <div class="eyebrow">Reference — the pricing moment</div>
      <h2>Pricing & Close</h2>
      <div class="coach-note tref-gap">${ICON.bulb} ${c.note}</div>
      ${c.sections.map(sec=>`<div class="tref-section"><h3 class="tref-h3">${sec.title}</h3><div class="script-block">${sec.body}</div></div>`).join("")}
    `;
  }
  if(view==="recap"){
    const p = PROD.training.preDemo;
    return `
      <div class="eyebrow">Reference — before slide 1</div>
      <h2>Pre-Demo Recap at the Table</h2>
      <div class="coach-note tref-gap">${ICON.bulb} ${p.intro}</div>
      <div class="script-block">${p.body}</div>
    `;
  }
  if(view==="tensteps"){
    const t = PROD.training.tenSteps;
    return `
      <div class="eyebrow">Reference — the whole visit</div>
      <h2>Our 10-Step Sales Process</h2>
      <div class="coach-note tref-gap">${ICON.bulb} ${t.intro}</div>
      <ol class="ten-steps">
        ${t.steps.map(st=>`
          <li class="ten-step">
            <div class="ten-step-num">${st.n}</div>
            <div class="ten-step-body">
              <div class="ten-step-title">${st.title}</div>
              <div class="ten-step-stage">${st.stage}</div>
              ${st.detail?`<div class="ten-step-detail">${st.detail}</div>`:""}
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
    // Training content now comes from data/doghouse-content-v1.json via the
    // adapter, joined by slide id. The legacy data-sunesta.js script/coach
    // fields remain the fallback for any deck slide the JSON has no entry
    // for (and for the Eclipse deck, which has no JSON content yet).
    const tc = (typeof tcForDeckSlide === "function") ? tcForDeckSlide(s.id) : null;
    if(tc){
      body = `<div class="tc-panel">${tcEntryHTML(tc, {section: activeTab})}</div>`;
    } else {
      body = `
        <div class="eyebrow">Training mode — Slide #${globalSlideNumber()}</div>
        <h2>${s.title}</h2>
        ${s.script.trim()==="" ? '<span class="visual-only-tag">Visual only — no script yet</span>' : `<div class="script-block">${s.script}</div>`}
        ${s.personalTouch ? `<div class="personal-touch"><div class="pt-label">${ICON.pencil} Personal touch — editable per rep (js/data-*.js → personalTouch)</div><div class="pt-body">${s.personalTouch}</div></div>` : ""}
        ${s.talkingPoints ? `<ul class="talking-points">${s.talkingPoints.map(t=>`<li>${t}</li>`).join("")}</ul>` : ""}
        ${s.coach ? `<div class="coach-note">${ICON.bulb} ${s.coach}</div>` : ""}
      `;
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
  if(appView === "center" && centerView === "coach") renderCenter();
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
      {key:"close",    icon:ICON.tag, name:"Pricing & Close", sub:"The pricing moment, spoken over the estimate"}
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
        <button class="lightbox-close">${ICON.close}</button>
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
    el.innerHTML = `
      <div class="center-head resource">
        <button class="back-btn" id="resourceBack">‹ ${productInfo().coach} Coach</button>
      </div>
      <div class="resource-page">${trainingBodyHTML(centerView)}</div>
    `;
    document.getElementById("resourceBack").onclick = ()=>{ centerView = null; renderCenter(); };
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
