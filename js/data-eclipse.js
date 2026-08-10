// ─────────────────────────────────────────────────────────────────────────────
// ECLIPSE® E-ZIP MOTORIZED SCREENS — customer-facing deck
//
// Rebuilt per docs/ezip-rebuild/ATH_EZip_Deck_Build_Spec.md (v1.0): 14 slides -> 21,
// 3 tabs -> 5. Slide ORDER and SECTION membership are owned here (authority
// rule); all script/coaching content lives in data/training-content-eclipse.json
// and joins by that file's deck_map.
//
// The legacy per-slide script/talkingPoints/coach fields are GONE as of this
// rebuild (spec §2.4, oi07). They were byte-identical to the content JSON at
// migration time and would have gone stale the moment the script rewrite
// landed — and js/app.js renderRehearsal() actively served them on content-load
// failure, so a stale copy was a live path to a rep reading pre-rewrite script.
// renderRehearsal() no longer reads them at all; see its three-state fallback.
//
// Hard content rules still in force (see project memory: eclipse-ezip-sources):
// - Wind: "Class 6 wind resistance tested to 80 mph" is scoped to the 4"/5"
//   systems. No mph figure is published for the 7" — it carries the Class 6 /
//   Super Duty designation without a number. The 130-mph figure is a 2013
//   FABRIC test, not a system rating: never in a spec table (spec §2.2, oi01).
// - Warranty: PPP is included on every ATH quote, so customer copy may say
//   "Platinum Protection Plus included".
// - Sensors are ADD-ONS for E-Zip (opposite of the Sunesta wind-sensor ruling).
// - Subcontractor ruling: "work for us — and only us"; never "not subcontractors".
// - Rep-only $ figures never appear on a slide — they live in the content JSON.
// ─────────────────────────────────────────────────────────────────────────────

const ECLIPSE_DECK = {

"WHY ATH": [
  {
    id:"ez-intro", type:"herosplit",
    title:"Eclipse® E-Zip Motorized Screens",
    // Item 1 (Jack, 2026-08-10): bump subtext size on this cover slide only --
    // bigSubtext scopes the CSS bump to ez-intro so e20/smarttitle/led (the
    // other herosplit slides, shared .hero-subtext class) are unaffected.
    bigSubtext: true,
    subtext:"Control the sun. Beat the wind. Love your outdoor space.",
    image: IMAGES.ezHeroDusk,
    // Source photo has a slight camera-roll tilt (horizon + deck railing both
    // lean up-right) — leveled here with a small CSS rotation rather than a
    // forced crop; scale compensates for the corner gap the rotation opens up.
    imageRotate: 1.3, imageScale: 1.07
  },
  {
    id:"ez-dealer", type:"splittext",
    // Retitled per the e02 content flag (Jack, 2026-08-07): the slide's content
    // is entirely ATH — the script never mentions Eclipse, which gets its own
    // moment at ez-eclipse/e06.
    // Item 6 (Jack, 2026-08-10): consolidated to highlight fragments per his
    // draft, with a line-3 edit ("not three states away" restored) -- was
    // "Founded in 2004 — over 20 years, family-owned, based in Monument" /
    // "Thousands of installations across the Front Range" / "You call us, you
    // get us — not a call center, not someone three states away" / "Same
    // trained install team as our awning division" / "Eclipse: a nationally
    // recognized screen brand, backed by a local company that stands behind
    // every install".
    title:"Who We Are — Local & Family-Owned",
    bullets:[
      "Founded 2004 · Family-owned · Monument, CO",
      "Thousands of installs, Front Range",
      "You call us — not a call center, not three states away",
      "Same crew as our awning division",
      "Local company, nationally recognized brand"
    ],
    image: IMAGES.dealerFamily
  },
  {
    id:"ez-lineup", type:"productcards",
    title:"Your Home Solutions Experts",
    paragraph:"We're not just a screen company — we handle the full outdoor living spectrum, so whatever you do today works with whatever you might want to add later.",
    rows:[
      {photo: IMAGES.prodScreenPhoto, logo: IMAGES.ezLogoEclipse, label:"Eclipse® E-Zip Screens", sublabel:"Today's focus — motorized zipper-track screens",
       detail:"Motorized exterior screens with zipper retention — sun, wind, bug, and privacy control for patios, decks, and porches. Custom made to your exact opening."},
      // Item 3 (Jack, 2026-08-10), option 3: object-position:top so the
      // symmetric object-fit:cover crop doesn't eat into the roofline/canopy
      // -- these two photos put their subject in the upper portion of frame
      // with excess patio/lawn below, unlike the other two rows (subject
      // spans the frame evenly, left at the object-fit default).
      {photo: IMAGES.triSunestaAwning, logo: IMAGES.sunestaLogo, label:"Sunesta® Retractable Awnings", sublabel:"Overhead shade on demand",
       detail:"Custom retractable awnings — shade over the whole space when you want it, sun when you don't. Pairs beautifully with E-Zip screens.",
       photoPosition:"top"},
      {photo: IMAGES.prodGutterPhoto, logo: IMAGES.logoGutterhelmet, label:"Gutter Helmet®", sublabel:"Never clean your gutters again",
       detail:"Gutter protection and seamless gutters — the other side of what we do around the house."},
      {photo: IMAGES.prodLouverPhoto, logo: IMAGES.ezLogoEclipse, label:"Eclipse® Latitude™ Louvered Roofs", sublabel:"A true outdoor room",
       detail:"Motorized louvered roof systems — overhead coverage that opens and closes. Many customers pair a louvered roof with E-Zip screens on the sides.",
       photoPosition:"top"}
    ]
  },
  {
    id:"ez-install", type:"splitphoto",
    title:"Installed In-House — Level, Parallel, To the Inch",
    subtext:"The tracks have to be perfectly level and parallel or the screen won't run right — it's not like hanging a curtain. We surface-mount or recess into the structure — pergola posts, stucco, wood framing, brick, or soffit. Most installs are a standard 110-volt plug-in, done in a day.",
    image: IMAGES.ezRecessedStone
  },
  {
    // oi13 RESOLVED 2026-08-10 (Jack): real install-crew photo supplied --
    // installer mid-job on a porch, ladders and tools in frame. Replaces the
    // labeled placeholder; two prior searches (the Eclipse PDF's p2 group shot,
    // then the full 18-photo screens library) had turned up nothing usable.
    id:"ez-people", type:"splittext",
    title:"Our People — Who Actually Shows Up",
    bullets:[
      "Twenty-two years and thousands of projects across the Front Range",
      "Certified technicians and install teams who work with us and only us",
      "Trained to Eclipse specification — and to our standards on top of that",
      "A full operations team on every project, so nothing depends on one person remembering"
    ],
    image: IMAGES.ezPeopleInstalling
  }
],

"WHY ECLIPSE": [
  {
    // oi09 RESOLVED 2026-08-09 (Jack): "use the Sunesta dealer photo for now."
    // Two candidates carried that description -- dealer-family.jpg (cleared, no
    // manufacturer branding, already used on e02 and the warranty ATH node) and
    // the Sunesta awards-ceremony photo (disqualified per oi13: dense Sunesta
    // branding, costume attire). Confirmed dealer-family.jpg at full resolution
    // before assigning -- reusing Sunesta branding on a slide titled "Eclipse
    // Authorized Dealer" would have been a direct content contradiction.
    id:"ez-eclipse", type:"splittext",
    title:"Eclipse® Authorized Dealer",
    bullets:[
      "Eclipse Shading Systems — Middletown, New York, with manufacturing in Statesville, North Carolina",
      "Building the E-Zip since 2002 · the 7-inch line since 2019",
      "Custom made in the USA, built to the inch for every opening",
      "ATH is a licensed and insured Eclipse authorized dealer",
      "Two companies behind your project — not a system assembled from four suppliers"
    ],
    image: IMAGES.dealerFamily
  },
  {
    // Item 5 (Jack, 2026-08-10), specified against an annotated screenshot:
    // the old Row 1 (Eclipse logo/"Building the E-Zip since 2013"/Middletown
    // sublabel) is gone -- its logo promoted to a standalone headerLogo above
    // the headline, its "Middletown, New York since [date]" fact was already
    // fully covered by the paragraph below (no new clause needed there, just
    // the 2002 correction). 3 rows remain: Somfy, Phifer, Class 6.
    id:"ez-credibility", type:"credibility",
    headerLogo: IMAGES.ezLogoEclipse,
    title:"Why Eclipse",
    paragraph:"Eclipse Shading Systems has manufactured the E-Zip in Middletown, New York since 2002 — residential and commercial applications across the country. A proven, refined product line — not something pieced together from multiple sources.",
    rows:[
      {icon: IMAGES.ezLogoSomfy, label:"Powered by Somfy", sublabel:"The industry's gold-standard motors",
       detail:"Somfy motors come standard — the same brand used in premium motorized systems around the world. Handheld remote, wireless wall switch, or app control, with home-automation integration available."},
      {icon: IMAGES.ezLogoPhifer, label:"Phifer SunTex® fabrics", sublabel:"GREENGUARD Gold certified",
       detail:"Phifer is one of the most respected shading-fabric manufacturers in the world. SunTex is GREENGUARD Gold certified and built specifically for exterior applications — and it carries its own 10-year exterior fabric warranty from Phifer."},
      {icon: IMAGES.ezBadgeClass6Wind, label:"Class 6 wind resistance", sublabel:"Tested to 80 mph — 4\" & 5\" systems",
       detail:"The zipper retention locks the fabric edge into the side track, so the screen stays flat and taut instead of billowing and flapping like a generic roll-down screen."}
    ]
  },
  {
    // The first two are the SAME 18-foot Monument opening, up then down --
    // they're the before/after pair the coaching note leans on, so they stay
    // adjacent and first. arched-deck and part-way-up were both sitting in the
    // IMAGES map unreferenced; they're real local installs, which is exactly
    // what this slide is for, and part-way-up also shows the stop-at-any-height
    // point. Eight photos tile as a clean 4x2.
    id:"ez-gallery", type:"photogrid",
    title:"Real Projects — Right Here on the Front Range",
    photos:[ IMAGES.ezMonUp, IMAGES.ezMonDown, IMAGES.ezThreePorch, IMAGES.ezNight,
             IMAGES.ezSunroom, IMAGES.ezWithAwning, IMAGES.ezArchedDeck, IMAGES.ezPartWayUp ]
  },
  {
    // oi06 RESOLVED 2026-08-09 (Jack): use a generic map graphic rather than
    // wait on Eclipse-specific install pins from Maxx. This USED to be
    // type:"refmap", mirroring Sunesta's slide (s10) exactly and rendering the
    // live interactive map -- but with no Eclipse pin data, that map fell back
    // to showing real Sunesta customer locations labeled "combined ATH
    // projects," and none of those are actual screen installs. type:"splitphoto"
    // instead, same slide shape, with a plain non-data-driven map illustration
    // (images/eclipse/refmap-generic.svg) that makes no specific-location claim.
    id:"ez-refmap", type:"splitphoto", image: IMAGES.ezRefMapGeneric,
    title:"We've Worked in Your Neighborhood",
    subtext:"Projects completed all over the greater Colorado Springs area."
  }
],

"THE E-ZIP": [
  {
    id:"ez-reasons", type:"reasonsphoto",
    title:"What's Pushing You Back Inside?",
    image: IMAGES.ezGarciaInside,
    hotspots:[
      {x:0.30, y:0.20, label:"Harsh sun & glare", photo: IMAGES.ezSunroom,
       content:"Block the harsh afternoon or morning sun without losing the feel of being outside — and cut the heat and glare reaching the rooms behind the space."},
      {x:0.66, y:0.32, label:"Wind", photo: IMAGES.ezThreePorch,
       content:"The fabric edge is zipped into the side tracks, so the screen stays flat and taut instead of flapping — the space is actually comfortable to sit in."},
      {x:0.42, y:0.62, label:"Privacy", photo: IMAGES.ezMonDown,
       content:"A dark fabric reads almost like a mirror from outside during the day — neighbors can't see in, you can still see out."},
      {x:0.74, y:0.76, label:"Bugs & no-see-ums", photo: IMAGES.ezWaterlander,
       content:"The tight SunTex weave and the hem bar's brush seal keep no-see-ums, mosquitoes, and other small insects out — evenings become enjoyable again."}
    ]
  },
  {
    id:"ez-how", type:"splittext",
    title:"How the E-Zip Works",
    bullets:[
      "The screen stores inside a protective aluminum cassette — rain, UV, and debris never sit on the fabric",
      "Press a button: the fabric edges zip into the side tracks, locked flat and taut — no flapping in the wind",
      "The hem bar's brush seal meets the floor — a real seal, no gaps along the bottom",
      "Stop it at any height — partial shade, partial wind block, or full enclosure"
    ],
    image: IMAGES.ezHowItWorks
  },
  {
    id:"ez-systems", type:"models", cardGraphic:"screen",
    title:"Cassette Sizes & System Options",
    sub:"Three cassette sizes — we size the system to your exact opening. Every unit is custom made to the inch, in two-piece powder-coated extruded aluminum.",
    models:[
      {name:"4-inch", tag:"Standard duty · smaller openings", c1:"#3a6ea5", c2:"#5a8fc0", chipHero:false,
       heroChip:"STANDARD DUTY",
       chips:["To 14' wide","To 12' drop","70mm roller"],
       warrantyTiles:[{num:"Lifetime",label:"Frame"},{num:"Lifetime",label:"Fabric",hero:true},{num:"Lifetime",label:"Motor"},{num:"Lifetime",label:"Electronics"}],
       specs:[
         ["Max width","14 feet — custom-built to the inch"],
         ["Max drop","12 feet (fabric-dependent)"],
         ["Roller tube","70 mm — largest for the size, so fabric hangs flat"],
         ["Duty level","Standard duty only"],
         ["Wind","Class 6 wind resistance — tested to 80 mph"],
         ["Operation","Motorized Somfy — manual crank optional"],
         ["Mounting","Surface, recessed, or between-post"],
         ["Cassette","Two-piece powder-coated extruded aluminum"]
       ],
       bestFor:"Smaller openings — porches, single windows, and tighter spans up to about 14 feet."},
      {name:"5-inch", tag:"Our most common — Standard or Super Duty", c1:"#1b5e3f", c2:"#2e7d4f", chipHero:true,
       heroChip:"STANDARD or SUPER DUTY",
       chips:["To 24' wide","To 16'+ drop","78mm roller"],
       warrantyTiles:[{num:"Lifetime",label:"Frame"},{num:"Lifetime",label:"Fabric",hero:true},{num:"Lifetime",label:"Motor"},{num:"Lifetime",label:"Electronics"}],
       specs:[
         ["Max width","24 feet — custom-built to the inch"],
         ["Max drop","16 feet (20 ft with select fabrics)"],
         ["Roller tube","78 mm — larger tube, sag-resistant across the span"],
         ["Duty level","Standard or Super Duty"],
         ["Wind","Class 6 wind resistance — tested to 80 mph"],
         ["Operation","Motorized Somfy — manual crank optional"],
         ["Mounting","Surface, recessed, or between-post"],
         ["Cassette","Two-piece powder-coated extruded aluminum"]
       ],
       bestFor:"The vast majority of residential openings — and the only size offered in both Standard and Super Duty, so it fits almost any situation."},
      {name:"7-inch", tag:"Super Duty · the largest openings", c1:"#5a5f66", c2:"#7c828a", chipHero:false,
       heroChip:"SUPER DUTY",
       chips:["To 26' wide","To 20' drop","Largest roller"],
       warrantyTiles:[{num:"Lifetime",label:"Frame"},{num:"Lifetime",label:"Fabric",hero:true},{num:"Lifetime",label:"Motor"},{num:"Lifetime",label:"Electronics"}],
       specs:[
         ["Max width","26 feet — custom-built to the inch"],
         ["Max drop","20 feet (fabric-dependent)"],
         ["Roller tube","Largest available (up to 140 mm)"],
         ["Duty level","Super Duty only"],
         ["Wind","Engineered for the widest spans and highest exposure"],
         ["Operation","Motorized Somfy only"],
         // Mounting corrected per spec §2.1 — all three sizes share identical
         // mounting options (confirmed by Jack). Previously read "Surface mount
         // only" here, which contradicted the compare table on the same slide.
         ["Mounting","Surface, recessed, or between-post"],
         ["Cassette","Two-piece powder-coated extruded aluminum"]
       ],
       bestFor:"The largest openings and full enclosures — Super Duty engineering, motorized, and mountable the same three ways as the smaller sizes."}
    ],
    modelCompare:{
      title:"4-inch · 5-inch · 7-inch",
      columns:[
        {name:"4-inch", sub:"Standard duty"},
        {name:"5-inch", sub:"Most common"},
        {name:"7-inch", sub:"Super Duty"}
      ],
      cats:[
        {key:"size", label:"Sizing & Reach", rows:[
          {label:"Max width", cells:[["check","14'"],["check","24'"],["check","26'"]]},
          {label:"Max drop", cells:[["check","12'"],["check","16–20'"],["check","20'"]]},
          {label:"Roller tube", cells:[["check","70 mm"],["check","78 mm"],["check","Up to 140 mm"]]}
        ]},
        {key:"duty", label:"Duty & Operation", rows:[
          {label:"Duty level", cells:[["warn","Standard only"],["check","Standard or Super"],["warn","Super only"]]},
          {label:"Operation", cells:[["check","Motor or crank"],["check","Motor or crank"],["warn","Motorized only"]]},
          // spec §2.1 — 7-inch now matches the other two sizes.
          {label:"Mounting", cells:[["check","Surface · recess · post"],["check","Surface · recess · post"],["check","Surface · recess · post"]]}
        ]},
        {key:"eng", label:"Engineering", rows:[
          // spec §2.2 — the 7-inch carries the Class 6 / Super Duty designation.
          // No mph figure is published for it; the 130 MPH number is a 2013
          // FABRIC test result and must never appear in this table (oi01).
          {label:"Wind rating", cells:[["check","Class 6 · 80 mph"],["check","Class 6 · 80 mph"],["check","Class 6 · Super Duty"]]},
          {label:"Cassette", cells:[["check","2-pc extruded alum."],["check","2-pc extruded alum."],["check","2-pc extruded alum."]]},
          {label:"In production since", cells:[["check","2002"],["check","2002"],["check","2019"]]}
        ]}
      ]
    },
    gallery:[
      {img:IMAGES.ezRecessedStone, label:"Recessed cassette — clean, built-in look"},
      {img:IMAGES.ezHowItWorks, label:"Cassette · zipper track · hem bar"},
      {img:IMAGES.ezThreePorch, label:"Side tracks across a full porch enclosure"},
      {img:IMAGES.ezMonUp, label:"Cassette up — barely there"}
    ]
    // The three-column Eclipse / roll-down / sunroom comparison that used to
    // live here moved to ez-options in THE WRAP-UP (spec §2.3) and grew a
    // fourth column. The money slide is now about sizing and duty class only.
  },
  {
    id:"ez-fabric", type:"splittext",
    title:"The Fabric — SunTex® by Phifer",
    bullets:[
      "Every fabric is Phifer SunTex® — GREENGUARD Gold certified, built for the outdoors",
      "All colors cost the same — the only real decision is openness: how much UV it blocks vs. how much you see through",
      "SunTex 95 is the most popular — blocks ~95% of UV, keeps your view, and reads like a mirror from outside by day",
      "Want full blackout instead? A solid fabric gives total shade and privacy for extreme exposures",
      "6 colors on SunTex 80/90, 10 on SunTex 95/97 — near-black to white"
    ],
    image: IMAGES.ezMonOutside
  },
  {
    // NEW (spec §3.4). Three views of ONE project, cropped from slide 11 of the
    // current Eclipse slide PDF. photogrid renders 3 photos across a single row
    // and shows the per-photo caption — see js/app.js.
    id:"ez-transform", type:"photogrid",
    title:"Before · After · Inside",
    photos:[
      {src: IMAGES.ezTransformBefore, caption:"BEFORE"},
      {src: IMAGES.ezTransformAfter,  caption:"AFTER"},
      {src: IMAGES.ezTransformInside, caption:"INSIDE"}
    ]
  }
],

"SMART CONTROL": [
  {
    // e16 (myLink) was merged into this slide 2026-08-09 per Jack: a standalone
    // "screens on your phone" slide was redundant with the bullet below, and
    // folding it in gave the tab a real second half instead of a thin extra
    // slide. Image is the myLink photo that used to live on e16 -- Somfy stock,
    // phone in hand, cropped from the Eclipse slide PDF, dated handset; fine as
    // a stand-in, oi10 stays open (relocated here) for a current shot.
    id:"ez-smart", type:"splittext",
    title:"Smart Control — One Button, Total Command",
    bullets:[
      "Motorized is standard — not an upgrade. Touch a button; stop it at any height",
      "Somfy drive — the industry's gold standard, covered for life under Platinum Protection Plus",
      "Control by handheld remote, wireless wall switch, or the app on your phone",
      "Integrates with home automation — works right alongside the rest of your smart home",
      "Sun and wind sensors available as add-ons — automate it to the weather",
      "Standard 110-volt plug-in in most homes — no panel upgrades, no complicated wiring"
    ],
    image: IMAGES.ezMylinkPhone
  }
],

"THE WRAP-UP": [
  {
    id:"ez-process", type:"processsteps",
    title:"Our Proven Process",
    subtext:"From first measurement to final walk-through — one accountable local team.",
    steps:[
      {icon: IMAGES.procSite,        title:"Site Visit & Measure",  text:"Exact opening dimensions — every screen is custom made to the inch."},
      {icon: IMAGES.procManager,     title:"Project Manager",       text:"One point of contact keeps your project moving and you informed."},
      {icon: IMAGES.procInstall,     title:"Installation Day",      text:"Our trained crew sets the tracks level and parallel — most jobs done in a day."},
      {icon: IMAGES.procWalkthrough, title:"Final Walk-Through",    text:"We run every screen with you and don't leave until you're happy."},
      {icon: IMAGES.procWarranty,    title:"Warranty Activated",    text:"We register your coverage and service it locally — you call us, not an 800 number."},
      {icon: IMAGES.procService,     title:"12-Month Shade Service", text:"A free cleaning visit at the one-year mark — on us."}
    ],
    trust:"Serving the Front Range since 2004"
  },
  {
    id:"ez-warranty", type:"warrantyrecap",
    title:"The Warranty — Recapped",
    subtext:"Platinum Protection Plus — included on every ATH quote. Lifetime coverage on the frame, fabric, motor, and electronics.<br><span style=\"font-size:.82em;opacity:.72\">Most SunTex fabrics; optional clear windows excluded. Backed and serviced locally by ATH.</span>",
    tiles:[
      {num:"Lifetime", label:"Frame", sub:"extruded aluminum & powder coat"},
      {num:"Lifetime", label:"Fabric", sub:"most SunTex fabrics", hero:true},
      {num:"Lifetime", label:"Motor", sub:"Somfy drive"},
      {num:"Lifetime", label:"Electronics", sub:"remotes & controls"},
      {num:"Included", label:"Platinum Protection Plus", sub:"standard on every ATH quote"}
    ],
    nodes:[
      {id:"ath", kind:"logo-ath", title:"Around The House", detail:"Your local team — design, install, and warranty service all handled right here in Monument. When you need service, you call us, not a national 800 number.", photo:IMAGES.dealerFamily},
      {id:"eclipse", kind:"logo", logo:IMAGES.ezLogoEclipse, title:"Eclipse", detail:"The manufacturer — Eclipse Shading Systems has built the E-Zip since 2002. Platinum Protection Plus is the coverage that takes the frame, fabric, motor, and electronics to lifetime.", photo:null},
      {id:"phifer", kind:"text", title:"Phifer", detail:"The fabric maker. Phifer's SunTex carries its own 10-year exterior fabric warranty and GREENGUARD Gold certification — the foundation under the PPP fabric coverage.", photo:null}
    ],
    serviceBadge: IMAGES.ezServiceBadge,
    service:{title:"Serviced locally — for the life of the system", items:["You call us — never an 800 number","Same team that installed it","PPP registered at install"], foot:"Included with every ATH installation"},
    triLabel:"One system, backed three ways — tap a logo"
  },
  {
    // NEW (spec §3.6). The three-column comparison migrated off ez-systems
    // (§2.3) and grew a fourth column for hurricane-rated coastal systems.
    // DIY sails and umbrellas stay in script only — a fifth column would make
    // the table unreadable at presentation distance.
    id:"ez-options", type:"difference",
    title:"Other Options — An Honest Comparison",
    paragraph:"Not every shade product is solving the same problem. Here is where the E-Zip actually sits against the alternatives homeowners most often price against.",
    comparison:{
      title:"Other Options — An Honest Comparison",
      columns:[
        {name:"Eclipse E-Zip", sub:"Installed by ATH", badge:"★ OUR PICK"},
        {name:"Generic Roll-Down", sub:"No zipper track"},
        {name:"Glass Sunroom", sub:"Permanent structure"},
        {name:"Hurricane-Rated", sub:"Coastal storm systems"}
      ],
      rows:[
        {label:"Holds fabric in wind", cells:[{s:"check",t:"Zipper-locked, stays taut"},{s:"x",t:"Flaps & billows"},{s:"check",t:"Solid — but sealed in"},{s:"check",t:"Overbuilt for here"}]},
        {label:"Keeps the outdoor feel", cells:[{s:"check",t:"Air moves through"},{s:"check",t:"It's a screen"},{s:"x",t:"Traps heat"},{s:"check",t:"It's a screen"}]},
        {label:"Bug & no-see-um seal", cells:[{s:"check",t:"Tight SunTex + brush seal"},{s:"warn",t:"Depends on fit"},{s:"check",t:"Sealed"},{s:"check",t:"Yes"}]},
        {label:"Retracts out of sight", cells:[{s:"check",t:"Into the cassette"},{s:"warn",t:"Basic housing"},{s:"x",t:"Permanent"},{s:"check",t:"Yes"}]},
        {label:"Warranty", cells:[{s:"check",t:"Lifetime via PPP"},{s:"x",t:"Limited / by component"},{s:"warn",t:"Varies by builder"},{s:"check",t:"Varies"}]},
        // Sits directly above Investment on purpose: it's the row that carries
        // the actual argument, and it lands right before price. It's also what
        // makes the table read correctly — every check cell gets the same green
        // tint, so without this row the hurricane-rated column looks nearly as
        // strong as ours. Here its one non-check falls on exactly the point the
        // rep is making.
        {label:"Right-sized for Front Range weather", cells:[{s:"check",t:"Built for our wind and sun"},{s:"x",t:"Fails in real wind"},{s:"x",t:"Solves a different problem"},{s:"warn",t:"Engineered for coastal storms"}]},
        {label:"Investment", cells:[{s:"check",t:"A fraction of a glass room"},{s:"check",t:"Low — but short-lived"},{s:"x",t:"$50,000+"},{s:"x",t:"$20,000+"}]}
      ],
      footer:"Glass sunrooms commonly run $50,000 and up and trap heat by design. Generic roll-downs without a zipper track flap in the wind and fail. Hurricane-rated systems are excellent engineering for coastal storm zones — and overkill on the Front Range. Always ask what's actually behind the price."
    }
  },
  {
    // NEW (spec §3.7). Shape mirrors Sunesta's costscale slide (s22). Dollar
    // ranges live in each rung's popover detail, not on the face of the slide —
    // the track itself shows relative position via the $ marks, same as Sunesta.
    // oi12 RESOLVED 2026-08-10 (Jack): tiers 2 and 4 photos supplied directly
    // (a low-end/broken zipper shade; a glassed-in porch) rather than reusing
    // Sunesta's awning-shot tier images, which would have shown the wrong
    // product. Both are small source files (194x259 / 780x421) -- fine for the
    // 68px .cs-thumb circle; the popover's .reason-pop-img (max-height:190px,
    // object-fit:contain) will letterbox tier 2's portrait crop rather than
    // fill the width, which is expected given the source, not a bug.
    // Tier 1 photo credit (CC via Openverse/Flickr): "First Shot, New Lens"
    // by tdlucas5000 (CC BY 2.0) — shared with Sunesta's price-conditioning slide.
    id:"ez-pricecond", type:"costscale",
    eyebrow:"Know the market — position, don't surprise",
    title:"Not All Shade Costs the Same",
    paragraph:"Four tiers of outdoor shade, from a bamboo roll-up to a full glass room. Tap any tier to see what that money actually buys.",
    rungs:[
      {n:1, photo:IMAGES.pcTier1, popPhoto:IMAGES.pcTier1, label:"DIY & temporary",
       detail:"$500 – $1,000. Bamboo roll-ups, shade sails, outdoor curtains. Fine for a season — no engineering, no wind rating, no warranty to speak of."},
      {n:2, photo:IMAGES.ezPcTier2, popPhoto:IMAGES.ezPcTier2, label:"Low-end installed",
       detail:"$1,000 – $3,000 per opening. Usually manual, no zipper track, and a one-year warranty on components. This is the tier where the screen flaps in the wind and fails early."},
      {n:3, photo:IMAGES.ezMonDown, popPhoto:IMAGES.ezMonDown, label:"Quality motorized — where we live", athMarker:true,
       detail:"$4,000 – $12,000. Zipper retention, name-brand Phifer fabric, a real lifetime warranty through PPP, and professional installation by the team that stands behind it."},
      {n:4, photo:IMAGES.ezPcTier4, popPhoto:IMAGES.ezPcTier4, label:"Hurricane-rated & glass rooms",
       detail:"$20,000 – $100,000+. MagnaTrack-class storm systems and full glass sunrooms. Excellent engineering — built for a different problem, at a very different budget."}
    ]
  },
  {
    id:"ez-viewstays", type:"herosplit",
    title:"Up, It Disappears. Down, It's Protected.",
    subtext:"It's more like a wall you can make disappear whenever you want. The view stays — the sun, the wind, and the bugs don't.",
    image: IMAGES.ezHalfDeployed
  }
]

};

// ── Product registration ─────────────────────────────────────────────────────
// Rep-only reference content (Do & Don't, FAQs & Objections, Pricing & Close)
// and every slide's script/coaching live in data/training-content-eclipse.json,
// same schema as Sunesta's file — see js/training-content.js. The 10-step
// process is genuinely ATH-wide, so it lives once in
// data/training-content-shared.json and both products resolve it via
// tcSequence("ten_steps") instead of one product aliasing the other's copy.
PRODUCT_DATA.eclipse = {
  deck: ECLIPSE_DECK,
  trainingContentFile: "data/training-content-eclipse.json",
  logo: IMAGES.ezLogoEclipse,
  brandHTML: 'Around The House · <b>Eclipse® E-Zip Screens</b>',
  photoCats: ["screens"],
  docs: [
    {name:"SunTex 80 / 90 — Fabric Samples & Specs (Phifer)", file:"docs/suntex-80-90-samples.pdf", kind:"pdf"},
    {name:"SunTex 95 / 97 — Fabric Samples & Specs (Phifer)", file:"docs/suntex-95-97-samples.pdf", kind:"pdf"}
  ],
  docsCard: {name:"Fabric Specs & Samples", sub:"Phifer SunTex spec sheets — all four collections"}
};
