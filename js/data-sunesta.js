const DECK = {
  "WHY SUNESTA": [
    {
      id:"introvideo", type:"videoloop",
      title:"Opening Video Loop",
      // 12s people-under-awning segment from the ATH YouTube intro video, looped muted.
      // Edit start/end (seconds) to retime the loop — no code changes needed.
      youtube:{id:"4tQexUOsUhg", start:24, end:36},
      script:"PRE-FRAME — spoken as this loop plays (Tone: friendly & confident):\n\n\"Awesome — well thanks for having us out. Not everyone we meet offers us water/coffee and is as nice as you all, so I appreciate that. What we'll do today is take about 10–15 minutes to walk you through how these systems work, what makes them different, and how we design this specifically for your outdoor space. We'll look at some options together and figure out what makes the most sense for your home.\"\n\nTransition: \"Sound ok?\" (Get a yes). \"Awesome, let's dive in.\"\n\n👉 This positions you as the guide, not a presenter. Let the loop run while they settle — it's doing the warm-up work for you.",
      talkingPoints:["PRE-FRAME: 10–15 minutes · guide, not presenter · get the 'Sound ok?' yes","12-second lifestyle loop from our YouTube intro video — plays muted, loops automatically, logo bottom-right","Timestamps are editable in js/data.js (youtube: start/end)"],
      coach:"⚠️ The clip streams from YouTube, so it needs internet at the appointment. If the home has no signal, the slide falls back to the branded placeholder — just move on naturally."
    },
    {
      id:"dealer", type:"splittext", image: IMAGES.dealerFamily,
      title:"Your Exclusive Sunesta Dealer",
      bullets:["Family-owned & operated — founded 2004, based in Monument","20+ years · thousands of projects across southern Colorado","Exclusive Sunesta dealer for Southern Colorado","You call us, you get us — local design, install & service"],
      script:"A quick background on us —\n\nWe are Around the House Home Solutions. We're a local, family-owned company based right up in Monument. We've been in business since 2004 — a little over 20 years — and in that time we've completed thousands of projects throughout southern Colorado, so this isn't something we just picked up last year.\n\nOur focus is the exterior of the house — high-quality shade solutions so homeowners can enjoy their outdoor living space, and living in Colorado, to the fullest.\n\nSomething our clients really appreciate — we're not some big corporation out of Denver… you call us, you get us. As a company we care deeply about our customers, our employees, and the local communities we serve.\n\n👉 INSERT PERSONAL TOUCH — why YOU work here (see the editable block below; swap it for your own story)\n\nTransition: \"Outside of family, your home is typically your largest investment — so we only install quality products, to the highest standards, with great warranties to back them up.\"",
      personalTouch:"Myself, I've actually been in the home remodeling industry since I graduated from college in 2014. I've worked with organizations ranging from large national remodeling companies to small owner-operated contractors, helping design and deliver projects from full home additions to interior remodels and outdoor improvements like decks and concrete patios. Over the years I realized I have to be happy and love where I work — so when I met Jack and his brother Maxx, I couldn't pass up the opportunity to work with good people who have integrity and communicate well. I'm really happy to have found my home here at Around the House.",
      talkingPoints:["Founded 2004 · family-owned · based in Monument","Thousands of projects — 20+ years, not picked up last year","Not a Denver corporation: you call us, you get us","Founded by Kirt & Vicki, now led with sons Maxx & Jack","End on the largest-investment transition — it sets up Our Products"],
      coach:"Keep this warm and personal — don't sound like a commercial. The Personal Touch block below is Matt's version: each rep should replace it with their own story (edit personalTouch in js/data.js)."
    },
    {
      id:"products", type:"productcards",
      title:"Our Products",
      paragraph:"Outside of family, your home is typically your largest investment — so we only install quality products, to the highest standards, with great warranties to back them up.",
      rows:[
        {icon:IMAGES.prodGutter, photo:IMAGES.prodGutterPhoto, logo:IMAGES.logoGutterHelmet, label:"Gutter Helmet & Helmet Heat", sublabel:"4,000+ customers in Southern Colorado", detail:"We've been the exclusive Gutter Helmet and heat-cable dealer in Southern Colorado, with over 4,000 Gutter Helmet customers. Leaf and debris protection for gutters and roofline — designed to be maintenance-free and help prolong the life of the exterior of your home."},
        {icon:IMAGES.prodScreen, photo:IMAGES.prodScreenPhoto, logo:IMAGES.logoEclipse, label:"Motorized Screens & Track Systems", sublabel:"UV, heat & wind resistance", detail:"An extremely popular investment here — high UV and heat blocking plus real wind resistance, with the screen held firm in side tracks."},
        {icon:IMAGES.prodLouver, photo:IMAGES.prodLouverPhoto, logo:IMAGES.logoEclipse, label:"Motorized Louvered Roofs", sublabel:"Attached & freestanding", detail:"Commercial-grade louvered roof systems built to handle the wind and harsh weather we deal with in Colorado. Often paired with our motorized screens to combat wind and sun and create a true three-season outdoor living experience."}
      ],
      script:"We've been the exclusive dealer for Gutter Helmet and heat cable systems in Southern Colorado, with over 4,000 Gutter Helmet customers — that's a leaf-and-debris protection system for your gutters and roofline, designed to be maintenance-free and help prolong the life of the exterior of your home.\n\nWe also install motorized screen and track systems — those have become an extremely popular investment because of the UV, heat, and wind resistance they provide.\n\nAnd motorized louvered roof systems — attached or freestanding — which are commercial grade to handle the wind and weather we deal with here in Colorado. Often we pair those with the screens to create a real three-season outdoor living experience.\n\n👉 Anchor service + accountability — this is cross-sell context, not a pitch. Plant seeds and move on.",
      talkingPoints:["Exclusive Gutter Helmet dealer — 4,000+ local customers","Motorized screens: UV + heat + wind resistance","Louvered roofs: commercial grade, pairs with screens for 3-season living","Plant seeds — don't pitch. Tap a card for detail."],
      coach:"One breath per product. If they perk up on one, note it for later — don't derail the awning demo."
    },
    {
      id:"training", type:"splittext", image: IMAGES.trainingPhoto, cert: IMAGES.trainingCert,
      title:"Sunesta Factory Training",
      bullets:["Trained by ATH and directly by Sunesta — Jacksonville, FL","Licensed & insured — permits pulled, everyone protected","Our crews & longstanding partners work for us, and only us","ATH final inspection on every project"],
      script:"Something that is really important — all of our installers are trained directly by us and through Sunesta down in Jacksonville, Florida.\n\nSo when we mount your awning, we're not guessing… we're making sure it's structurally correct for wind, load, and long-term performance.\n\nA lot of companies… it's kind of a 'chuck in a truck' situation — often they only install a few of these a year, so they just slap it up and hope for the best. There's no real consistency from one install to the next, which can lead to homeowners paying for the project multiple times. You can pick a great product, but if it's not installed correctly and to manufacturer standards, you won't have a real warranty.\n\n👉 Slight smile — let that land.\n\nWe're also a licensed and insured contractor — we hold a license for projects that require a permit, and if something were to happen on the job, you're protected and we're protected as well.\n\nWe go beyond what the manufacturer requires on mounting points, and when we're done, the wiring is run properly and the conduit is painted to match your home.\n\nTransition: \"We're a get-it-right-the-first-time company that stands behind our work — if your new awning ever has any issues, just give us a call and we'll schedule a time to come take a look. This is what we do, day in and day out.\"",
      talkingPoints:["Trained by ATH + Sunesta (Jacksonville) — we're not guessing","'Chuck in a truck' competitors → inconsistent installs → voided warranties","Licensed & insured — permits handled, both sides protected","Beyond-spec mounting points · conduit painted to match","If asked about subcontractors: partners who work for us and only us — see the Subcontractor FAQ"],
      coach:"Slight pause after the competitor comment. Let it land, then move with confidence. Photo and certificate are placeholders — real resolution coming."
    },
    {
      id:"doypeople", type:"splittext", image: IMAGES.award,
      title:"Dealer of the Year — Our People",
      bullets:["National Dealer of the Year 2025 — #1 awning/shade dealer in the western U.S.","In business 20+ years — thousands of projects managed","Certified technicians + a fully staffed operations department + longstanding partners","Trained to manufacturer specs AND our own standards"],
      script:"Retractable awnings have largely been adopted by the eastern half of the United States — mainly due to manufacturing locations, European influence, and climate. If you've ever visited countries like France, Germany, or Italy, retractable awnings are on every corner. They're much more popular in the Midwest, the East Coast, and of course the Southeast, where they're manufactured. On the other side of the coin, the western United States has seen a slower adoption of retractable shade.\n\nWe've been on a mission to change this. We live in one of the most beautiful climates in the whole country, but we find that many homeowners still struggle to actually enjoy their beautiful views and outdoor spaces. Options for quality retractable shade have been largely underserved here in Southern Colorado, and it's been our mission to change that — with shade solutions engineered for our climate, designed to meet the architectural trends, and a reputable team that can deliver that value to our community.\n\nIn 2025, we were honored to be named National Dealer of the Year by our manufacturer, Sunesta — recognized as the #1 awning and shade dealer in the western United States.\n\nAnd of course — you can build a great company and a great process, but if you don't have the right people for a project, it's unlikely to go well. When it comes to people, the questions are simple:\n\nHow long has the contractor been in business? We've been around over twenty years and installed thousands of projects. That requires a whole lot of people management.\n\nWho will be responsible to perform the work? We have our certified technicians, a fully staffed operations department, and longstanding subcontractor partners.\n\nAre they qualified? Our teams are trained to install to both manufacturer specifications as well as our own standards. The reason we do this is simple — we want your project to look great and last as long as possible.",
      talkingPoints:["Humble, not boastful: 'we deliver quality in an underserved market,' not 'we sold the most'","Mission story: East adopted awnings first — the West has been underserved, we're changing that","DoY 2025 = manufacturer's validation, based on installs + service","Three people questions: how long · who does the work · are they qualified","This slide answers the subcontractor question before it's asked"],
      coach:"📝 FIRST DRAFT — assembled from Matt's bullets + the mission paragraph; neither Jack nor Matt has scripted this page directly yet. Deliver the three questions as questions — pause after each. Photo is the award-ceremony shot."
    },
    {
      id:"local", type:"photogrid",
      title:"Fall In Love With Your Home Again",
      photos:[IMAGES.fallLoveQ1, IMAGES.fallLoveQ2, IMAGES.fallLoveQ3, IMAGES.fallLoveQ4],
      script:"Here's a couple of photos of our local projects. This is one we installed in Falcon — probably one of the windiest areas around here.\n\nThis homeowner had the exact same issue — direct west sun, heat, and wind.\n\n👉 Tie to their problem: \"Very similar to the problems you all are dealing with.\"\n\nAnd here's a look from the inside looking out. You'll notice it still gives you your view — there's color, there's openness. It provides privacy and sun control, but you don't feel boxed in.\n\nTap any photo to expand it full-screen if they want a closer look.",
      talkingPoints:["Always tie the photo to their specific situation","Reference their wind exposure or sun direction","This is proof, not a gallery","Tap a photo to expand — good for showing detail up close"],
      coach:"If their deck faces west, point that out. If they mentioned wind, reference it. Photos are placeholders — real resolution coming."
    }
  ],
  "STORY OF SUNESTA": [
    {
      id:"difference", type:"difference",
      title:"Experience the Sunesta Difference",
      paragraph:"Over 40 years ago, the founders of Sunesta Shade Systems had an idea that transformed the American awning industry.",
      rows:[
        {style:"plain", icon:IMAGES.badge45years, label:"45 Years in Business"},
        {style:"banner", icon:IMAGES.iconRuler, label:"Professional Installation"},
        {style:"plain", icon:IMAGES.americanBuilt, label:"American Made", sublabel:"MADE IN AMERICA"}
      ],
      script:"We've been around since 2004 — but Sunesta has been around since 1981. They were actually one of the first awning manufacturers in the country, and they've stayed at the top in engineering and quality.\n\nThat matters because the product has been tried and tested for over 40 years, in every climate and region. We get some pretty extreme weather here in southern Colorado — sometimes all four seasons in a single day — so knowing your new awning is built to last is great peace of mind.\n\nEverything is made right here in the United States — the arms, the fabric, the frame components — except for the motor, which is hand assembled in Spain. That motor is Somfy — the most trusted motor brand in the world for this type of system.\n\nTransition: \"It's important for us to use products made in the USA, so we keep as many of our components as local as possible.\"\n\n⚠️ UNVERIFIED — confirm before repeating to a customer: fabric manufactured in North Carolina; arms and frame made in Florida.",
      talkingPoints:["Sunesta since 1981 — one of the first awning manufacturers in the country","Four seasons in a single day — built for Colorado extremes","American made, except the Somfy motor (hand-assembled in Spain)","Multi-channel remote controls awning + LED lights"],
      coach:"Icons are placeholder crops for now — title, paragraph, and all three row labels are fully editable text."
    },
    {
      id:"badges", type:"credibility",
      title:"Trust & Credibility",
      paragraph:"Reputation matters to us. In an industry known for complaints, we've stacked up the proof — third-party certifications, national awards, and hundreds of five-star reviews from local homeowners.",
      rows:[
        {icon:IMAGES.badgeMiamiDade, label:"Miami-Dade County Approved", sublabel:"Tested to 98 mph before arm failure — hurricane-zone rated", detail:"Sunesta is the first retractable awning manufacturer to exceed Miami-Dade's strict standards (NOA #24-0401.03). Arms tested to 98 mph before failure."},
        {icon:IMAGES.badgeSkinCancer, label:"Skin Cancer Foundation", sublabel:"UV blockage tested & approved — their seal of recommendation", detail:"The fabric's UV blockage is tested and approved by The Skin Cancer Foundation — it carries their seal of recommendation for effective sun protection. At Colorado elevation, where UV exposure runs significantly higher than people expect, that matters."},
        {icon:null, label:"Around The House Home Solutions", sublabel:"4.9 ★★★★★ · 200+ local reviews", link:"https://share.google/00IDfj15biWj76ERJ"},
        {icon:IMAGES.award, label:"Award-Winning Team", sublabel:"National Dealer of the Year 2025 · 4x Customer Satisfaction", detail:"Sunesta's National Dealer of the Year for 2025 — recognized as the #1 awning/shade dealer in the western United States — plus a 4x Customer Satisfaction award winner with Gutter Helmet, two years in a row. Because we're able to achieve higher volume, we get a high-quality product at a more affordable price."},
        {icon:IMAGES.badgeBBB, label:"Better Business Bureau", sublabel:"Zero unresolved complaints in our company history", detail:"A+ rated and accredited. It doesn't mean we're perfect, but we have zero unresolved complaints in our company history — and what that really means is when something comes up, we take care of it."}
      ],
      script:"Our awning systems are Miami-Dade County approved — they've been tested in hurricane conditions, and the arms held up to about 98 mph winds before failure.\n\n👉 Use THEIR home as the example: \"Your home is in Falcon — one of the most wind-prone areas in the Springs\" or \"You mentioned the wind can rip through the back porch.\"\n\nWhile we don't deal with hurricanes in southern Colorado, we certainly get hit with some major winds. The good news is we install a wind sensor on our motorized awnings as a standard feature — your awning closes automatically if the wind picks up. I'll cover that again in a bit.\n\nSKIN CANCER FOUNDATION — technical fact first, then the emotional angle: \"The fabric's UV blockage is actually tested and approved by The Skin Cancer Foundation — it carries their seal of recommendation for effective sun protection. And that matters out here — you either need sunscreen… or shade. Especially in Colorado, where the sun can be absolutely brutal and relentless, and at our altitude the UV exposure is significantly higher. Super important to stay protected.\"\n\nGOOGLE REVIEWS: \"Here locally, we've also got over 200 five-star reviews. Our reputation is important to us, so we've worked hard to communicate well and create happy customers.\"\n\nAWARDS — delivered so they smile: \"We're a 4x Customer Satisfaction award winner — two years in a row — with Gutter Helmet. In an industry like home remodeling that's pretty notorious for complaints, it's pretty cool that we're winning awards. And as I mentioned, in 2025 Sunesta named us their National Dealer of the Year — we're really proud of the relationship we've built with them. Because we're able to achieve higher volume, we get a high-quality product at a more affordable price.\"\n\nBBB — last on purpose: \"It doesn't mean we're perfect, but we have zero unresolved complaints in our company history.\"\n\n👉 If they push on it: \"What that really means is when something comes up, we take care of it.\"",
      talkingPoints:["Badge order is deliberate: Miami-Dade → Skin Cancer → Google → Awards → BBB last","Localize the wind point: THEIR neighborhood, their own words","Wind sensor comes STANDARD on motorized units — tease it here","SCF: technical fact first, then the altitude/health angle","Awards: 4x Customer Satisfaction + DoY callback + 'higher volume → more affordable price'","BBB verbatim: zero unresolved complaints · if pushed: 'when something comes up, we take care of it'","Tap any badge for detail — Google row opens real reviews"],
      coach:"Stack credibility fast and keep moving. BBB sits last deliberately — Matt: it 'always felt very disruptive' up front. Each badge shows its proof line on the slide; tap for fuller detail; the Google row links out to the live review page."
    },
    {
      id:"process", type:"processsteps",
      title:"Our Proven Process",
      subtext:"Five steps, zero surprises — the process behind our Dealer of the Year award.",
      steps:[
        {icon:IMAGES.procManager, title:"Your Project Manager", text:"One point of contact — HOA packets handled too"},
        {icon:IMAGES.procSite, title:"A Respectful Site", text:"Clean & professional, start to finish"},
        {icon:IMAGES.procInstall, title:"Half-Day Install", text:"Most projects finish in a morning"},
        {icon:IMAGES.procWalkthrough, title:"Final Walk-Through", text:"Pitch & clearance dialed to your space"},
        {icon:IMAGES.procWarranty, title:"Warranty Activated", text:"Packet sent — you're covered for the long haul"}
      ],
      trust:"One of the reasons Sunesta named us 2025 National Dealer of the Year",
      script:"👉 Engagement question: \"Have you had any work done at your home? How was that experience?\"\nIf good: \"That's awesome — we love hearing that.\" If bad: the industry is notorious for complaints — communication and project timelines most of all — assure them we focus on communication and delivering a great experience.\n\nThis is actually one of the factors that helped us win our Sunesta Dealer of the Year award. As you move forward with us, here is our proven process that you can rely on:\n\nOnce the details are finalized, we'll assign you a project manager who will reach out to identify and manage your needs. If an HOA is involved, we'll prepare a packet you can send in for review and approval — and if the HOA requires any additional information or paperwork, we're always happy to help.\n\nInstallation typically takes about half a day. If it happens to take more than one day — due to weather or a more complex install — we'll typically come back the following day to ensure your project is completed as soon as possible.\n\nWe'll maintain a clean, respectful, and professional construction site from start to finish.\n\nWe'll perform a final walk-through of the project for quality assurance and craftsmanship — we'll check the pitch and head clearance versus your space to make sure the setup works best for you.\n\nAnd at the end of it all, we'll activate and send out your warranty packets and leave you with a home you can be happy with and a relationship with the Around the House team you can count on.",
      talkingPoints:["Early in the deck on purpose — what it's like to work with us, before the product","Engagement Q: 'Have you had any work done at your home?' — handle good or bad answers","Tie to the award: this process helped win Dealer of the Year","HOA? We prepare the packet and help with the paperwork","Half-day install — honest expectations · walk-through dials pitch + head clearance"],
      coach:"Moved early per the finalized script — working-with-us before the product. If they had a bad contractor experience before, this is where you address it: the industry is notorious for communication complaints; we're the opposite."
    },
    {
      id:"refmap", type:"refmap", image: IMAGES.refMapPlaceholder,
      title:"We've Worked in Your Neighborhood",
      subtext:"Projects completed all over the greater Colorado Springs area.",
      script:"\"A lot of folks ask us if we've done work in the area. And we have — we've completed projects all over the greater Colorado Springs area.\" (Show reference map.)\n\nThat's the whole beat — one line, point at the map, keep moving.",
      talkingPoints:["One line — say it, point at the map, move on","If they ask about their specific neighborhood, name nearby projects (the Photo Library in the Coach can back you up)"],
      coach:"Interactive reference map, grouped into three regions (Pikes Peak, Southern Colorado, Denver Metro) — tap a region to see its pins, tap a pin for the customer name. Pin locations are deliberately approximate (shown to the block, not the address). Map imagery needs a connection; the region list works offline."
    },
    {
      id:"tenreasons", type:"reasonsgrid",
      title:"10 Reasons to Choose Sunesta",
      reasons:[
        {title:"40+ Years Proven", text:"Building awnings since 1981 — tested in every U.S. climate. Not a startup."},
        {title:"American Made", text:"Arms, fabric, and frame built in the USA."},
        {title:"Somfy Motor", text:"The world's most trusted motor, hand-assembled in Spain. Dimmable, multi-channel remote."},
        {title:"Rust-Proof Arms", text:"Four PVC-coated steel cables inside each arm — no rusting bicycle chains."},
        {title:"SmartCase Protection", text:"Fully encloses the fabric when retracted — rain, snow, UV, hail, pine needles."},
        {title:"98 MPH Tested", text:"Miami-Dade approved; arms held to 98 mph. 30 mph continuous wind rating."},
        {title:"Lifetime Warranty", text:"Lifetime arms & hardware, 10-yr fabric & motor — and it's transferable."},
        {title:"Built to the Inch", text:"Custom sizing up to 40' wide and 14'8\" projection — made for your home."},
        {title:"Local Install & Service", text:"Sunesta-trained ATH installers and free lifetime pitch adjustments."},
        {title:"One Warranty, One Call", text:"National brand, local team — no Frankenstein parts, no runaround."}
      ],
      script:"This is the quick version of everything we've walked through — ten reasons Sunesta stands apart. I won't read every one to you, but the ones that matter most for your situation are… (pick the two or three that map to their Accomplish List).\n\nThe theme through all ten is the same: it's engineered to last in Colorado weather, it's backed by one national warranty, and it's installed and serviced by us, locally.",
      talkingPoints:["Use this as a recap — don't read all ten","Pick the 2–3 reasons that map to THEIR Accomplish List","Every reason ties back to: built to last, one warranty, local service"],
      coach:"This is a scanning slide, not a reading slide. Let them look while you highlight the two or three that matter to them."
    }
  ],
  "AWNINGS": [
    {
      id:"reasons", type:"reasonsphoto", image: IMAGES.reasonsPhoto,
      title:"Reasons for Shade",
      script:"👉 Engagement question: \"What sort of things do you all like to do outside in this space?\" Draw out more if you need to — \"Have drinks? Dinner? Play games?\"\n\n👉 Re-anchor THEIR why\n\n\"Most people we work with are trying to solve 2–3 things: Heat, glare, and actually being able to use the space.\"\n\n*Click the temperature gauge.* \"Under these awnings, they typically keep the area at least 20 degrees cooler — so it can turn a 90 degree day into a cool 70.\"\n\n\"Adds some protection for your flooring and furniture, helping prevent them from fading.\"\n\n👉 Tie directly:\n\n\"For you guys, it sounded like the biggest ones were…\"\n\n👉 (List their exact Accomplish List items)\n\n\"These awnings can make a really big difference — allowing you to create a perfect day in the space most days of the week.\"\n\n*Perhaps add:* \"Our awning products can also be used when it rains — so whether it's during the day or you just want to enjoy your space in the evening while it's raining, it'll give you coverage. Comes in handy if you want to BBQ outside while it's raining too. In Colorado, though, you want to be careful with rain because it's often followed by hail — so not something we recommend leaving retracted while you're away, but a great feature, especially with a lighting package in the evening to set some ambience or do some reading. I'll show you a bit more about the lights here in a bit.\"",
      talkingPoints:["Open with the engagement question — what do they DO out here? (drinks? dinner? games?)","Tap each bubble to reveal the reason","Re-anchor with THEIR exact Accomplish List items — say them back","Rain/evening/hail caution + lighting teaser is optional color, not required"],
      coach:"Click the temperature gauge live during this line for effect. Tie straight back to what they told you earlier — use their words, not generic ones.",
      hotspots:[
        {x:0.70,y:0.13,label:"Rain Coverage",photo:IMAGES.reasonRain,content:"Usable even while it rains — great for BBQing or relaxing outside. Not recommended to leave retracted unattended in Colorado, since rain often brings hail."},
        {x:0.48,y:0.34,label:"Temperature Control",photo:IMAGES.reasonThermometer,content:"Keeps the area at least 20 degrees cooler — turns a 90 degree day into a cool 70."},
        {x:0.48,y:0.70,label:"Protects What's Inside",photo:IMAGES.reasonUvWood,content:"Adds protection for your flooring and furniture, helping prevent fading from the sun's UV rays."},
        {x:0.80,y:0.60,label:"Skin Health",photo:IMAGES.badgeSkinCancer,content:"Recommended by the Skin Cancer Foundation as effective UVA/UVB protection."}
      ]
    },
    {
      id:"scrub", type:"videoscrub",
      frameBase:"images/awning-frames/frame-", frameCount:32, framePad:2, frameExt:".jpg",
      hint:"Drag to project the awning in & out",
      title:"See it in action",
      script:"We like to explain how it works like the human body —\n\nShoulders = the mounting structure, anchored into your home. Elbows = the arm pivots that carry everything out. Wrists = what keeps the fabric taut as it extends.\n\nThat's what lets it extend out strong and hold the fabric tight.\n\n👉 Personality: \"Unfortunately it doesn't come with the beach… but hey, I'll take our Mountain Views over the beach most days.\" (Get a laugh or smile.)\n\nGo ahead and drag the slider — you can run the awning all the way out and back in, and watch exactly how it projects over the space.",
      talkingPoints:["Drag the slider to project the awning in & out — real footage of this exact unit","Human body: shoulders = mount, elbows = pivots, wrists = tension","Hand them the iPad and let them drive it themselves — it lands better than any diagram"],
      coach:"This is real video of a Sunesta extending, scrubbed by the slider. Let the customer drag it. Keep it accessible — no engineering talk. Crossarms explainer is still coming from Matt; don't improvise engineering answers until it lands."
    },
    {
      id:"models", type:"models",
      title:"Custom Made For You",
      script:"So we've got three models — Sunlight, Sunstyle, and Sunesta.\n\nThe Sunlight is more of an industry standard — comparable to a lot of our competitors — and something we rarely install. Out here it's typically choosing between our flagship, the Sunesta, and the Sunstyle. 90% of our projects are the Sunesta — unless the site is better suited for the Sunstyle, it's what we recommend. Here's why.\n\n(Hand them the arm sample) Go ahead and feel that — solid extruded aluminum, engineered to hold. Inside each arm are four PVC-coated steel cables — they will not rust. A lot of competitors run a bicycle-chain system inside their arms; out here with the elements, those corrode over time and you end up with an awning that doesn't function. Not something you'll deal with here.\n\nIt handles 30 mph winds day-to-day and it's been tested to 98 mph before failure. And it takes a strong arm to project out to nearly 15 feet.\n\nWarranty — straight from the official Sunesta warranty: lifetime on the frame and on the Sunesta's arms. Fabric and motor are ten years, and in practice the fabric lasts 15–20+ years. The Sunstyle is a solid product too — its arms carry a 15-year warranty instead of lifetime, and the Sunlight's arms are twelve. All three: lifetime frame, 10-year fabric, 10-year motor — the arms are the difference.\n\nWIND DEPTH — the quiet difference: all three models carry a 24–30 mph wind class, but only the Sunesta holds it deep into its reach — all the way through 13 feet of projection. The Sunstyle drops a wind class past 8'3\", the Sunlight past 6'8\". If they want reach AND wind performance, there's really one answer.\n\nTHE SMART CASE — something we include as standard that a lot of competitors skip. A lot of awnings are installed with little to no protection, so the fabric sits exposed year-round and gets torn up after a few years — we call it the 'string cheese' effect. You've maybe seen it around town, or off the side of RVs. The Smart Case fully encloses the fabric when it's retracted — rain, snow, UV, hail, pine needles — none of it sits on your fabric. That's why we see fabrics lasting 15 to 20-plus years.\n\n👉 Educate — care: \"If it gets wet, let it dry before you retract it — moisture closed up in the case for a long stretch can grow mildew. Fortunately in Colorado it dries out fast. Cleaning is easy too: hose it down, let it dry, roll it in.\"\n\nPITCH ADJUSTMENT — the arms adjust in pitch, and we offer free lifetime adjustments. After install, if you want more head clearance or more coverage, we come back out and dial it in — no charge. Rule of thumb: about an inch of drop per foot of projection, and keep at least a foot and a half of clearance over your tallest family member.\n\n⚠️ UNVERIFIED — confirm before repeating to a customer: the spec sheet rates the arm CABLES at 80,000 movements of working life (that's roughly 10 open/closes a day for 20 years). Jack is confirming the right attribution with Sunesta — keep it out of customer conversations until then.",
      talkingPoints:["Lead with the flagship — 90% choose the Sunesta","Tap a model card → fullscreen spec popup with the warranty grid · ⇄ compares all three","Arm warranty is the separator: Sunesta LIFETIME · Sunstyle 15-yr · Sunlight 12-yr (frame lifetime + fabric/motor 10-yr on all three)","Wind-class depth: Sunesta holds 24–30 mph thru 13' · Sunstyle thru 8'3\" · Sunlight thru 6'8\"","Arm sample + cable story: PVC-coated steel, no bicycle chains","Smart Case = standard; tell the 'string cheese' story","Free lifetime pitch adjustments — inch of drop per foot of projection"],
      coach:"THIS IS YOUR MONEY SLIDE. Slow down. Build the value. ⚠️ Careful with the spring-loaded arm sample — it can fly open and whack someone in the face. Control it, then hand it over. Note: older printed spec sheets show outdated frame/motor warranty lines — the 2026 warranty doc (lifetime frame, 10-yr motor) governs. ⚠️ FLAG FOR JACK — the three model card graphics now render distinct case housings and arm thickness per model (data fields on each model: caseType, armGauge). caseType and maxProjectionFt restate numbers already confirmed elsewhere on this slide (Fabric protection / Projection options), but armGauge (1–3) is my own visual read of the relative arm language, not a manufacturer spec — confirm the case silhouettes and arm-thickness ratio against real Sunstyle/Sunlight units before relying on this graphic with a customer.",
      models:[
        {name:"Sunesta", tag:"Flagship — 90% of our installs", c1:"#1b5e3f", c2:"#2e7d4f", armYears:"Lifetime",
         // Render-only fields for the model-card silhouette (app.js awningSVG).
         // maxProjectionFt is the same number already printed in "Projection
         // options" below — restated here as a number so the graphic can
         // scale reach honestly instead of drawing all three identically.
         // caseType is the same fact as "Fabric protection" below, restated
         // as full|semi|open. armGauge (1-3) has no source number — it's my
         // visual read of "four cables + up to three tension springs" vs.
         // Sunstyle's plain four-cable arm vs. Sunlight's stated
         // "lighter-duty" arm — NOT a manufacturer spec. Flagged in this
         // slide's coach note for Jack to confirm against real units before
         // this ships to a customer.
         maxProjectionFt:14.667, caseType:"full", armGauge:3,
         chips:["To 14'8\" projection","Widths to 40'","24–30 mph thru 13'"],
         specs:[
           ["Projection options","Seven: 5' · 6'8\" · 8'3\" · 10' · 11'6\" · 13' · 14'8\""],
           ["Maximum width","40 feet — custom-built to the inch"],
           ["Wind rating","Holds its full 24–30 mph wind class through 13' of projection (17–23 mph at 14'8\")"],
           ["Arms","Solid extruded aluminum — four PVC-coated steel cables and up to three tension springs per arm"],
           ["Motor","Somfy 50 Nm — wired or wireless (manual gear available)"],
           ["Frame colors","White · Beige · Brown · Clay"],
           ["Fabric protection","SmartCase full cassette — standard on every ATH install"]
         ],
         bestFor:"The Colorado pick — biggest reach, strongest arms, and the only model that keeps its full wind class deep into its projection range."},
        {name:"Sunstyle", tag:"Mid-line — the comparison option", c1:"#27435f", c2:"#3a5a7d", armYears:"15 years",
         maxProjectionFt:11.5, caseType:"semi", armGauge:2,
         chips:["To 11'6\" projection","Widths to 40'","24–30 mph @ 8'3\""],
         specs:[
           ["Projection options","Five: 5' · 6'8\" · 8'3\" · 10' · 11'6\""],
           ["Maximum width","40 feet — custom-built to the inch"],
           ["Wind rating","24–30 mph at 8'3\" — drops to 17–23 mph at 10' and 11'6\""],
           ["Arms","Extruded aluminum — four PVC-coated steel cables per arm"],
           ["Motor","Somfy 50 Nm — wired or wireless (manual gear available)"],
           ["Frame colors","White · Beige · Brown · Clay"],
           ["Fabric protection","SmartCase cassette available as an option"]
         ],
         bestFor:"A solid product for smaller spaces — but past 8'3\" of projection its wind class drops a full step."},
        {name:"Sunlight", tag:"Entry level — rarely our recommendation", c1:"#8a6c48", c2:"#b6a27c", armYears:"12 years",
         maxProjectionFt:10, caseType:"open", armGauge:1,
         chips:["To 10' projection","Widths to 24'","24–30 mph thru 6'8\""],
         specs:[
           ["Projection options","Four: 5' · 6'8\" · 8'3\" · 10'"],
           ["Maximum width","24 feet — custom-built to the inch"],
           ["Wind rating","24–30 mph only through 6'8\" — 17–23 mph at 8'3\" and 10'"],
           ["Arms","Lighter-duty arm design than the Sunesta and Sunstyle"],
           ["Motor","Somfy 25 Nm — half the torque of the other two models"],
           ["Frame colors","White · Beige · Clay"],
           ["Fabric protection","No cassette listed on the spec sheet"]
         ],
         bestFor:"A budget option for small, sheltered spaces — not engineered for our wind."}
      ],
      modelCompare:{
        cats:[
          {key:"warranty", label:"Warranty", rows:[
            {label:"Frame", cells:[["check","Lifetime"],["check","Lifetime"],["check","Lifetime"]]},
            {label:"Arms", cells:[["check","Lifetime"],["warn","15 years"],["warn","12 years"]]},
            {label:"Fabric", cells:[["check","10 years"],["check","10 years"],["check","10 years"]]},
            {label:"Motor", cells:[["check","10 years"],["check","10 years"],["check","10 years"]]}
          ]},
          {key:"size", label:"Size & Reach", rows:[
            {label:"Max projection", cells:[["check","14'8\""],["warn","11'6\""],["x","10'"]]},
            {label:"Max width", cells:[["check","40'"],["check","40'"],["x","24'"]]},
            {label:"Projection options", cells:[["check","Seven"],["warn","Five"],["x","Four"]]}
          ]},
          {key:"eng", label:"Engineering", rows:[
            {label:"Full wind class (24–30 mph)", cells:[["check","Through 13'"],["warn","Through 8'3\""],["x","Through 6'8\""]]},
            {label:"Arm cables", cells:[["check","4 PVC-coated steel"],["check","4 PVC-coated steel"],["warn","Lighter-duty"]]},
            {label:"Motor torque", cells:[["check","Somfy 50 Nm"],["check","Somfy 50 Nm"],["warn","Somfy 25 Nm"]]},
            {label:"SmartCase cassette", cells:[["check","Standard w/ ATH"],["warn","Optional"],["x","Not listed"]]},
            {label:"Frame colors", cells:[["check","Four"],["check","Four"],["warn","Three"]]}
          ]}
        ]
      },
      gallery:[
        {img:IMAGES.optFabric,label:"Fabric on the extruded arm"},
        {img:IMAGES.optArm,label:"Full arm mechanism"},
        {img:IMAGES.optMountWide,label:"Mounting hardware"},
        {img:IMAGES.optMountClose,label:"Mounting hardware — close"},
        {img:IMAGES.optDropScreen,label:"Drop screen installed"},
        {native:"warranty",label:"Nation's best warranty coverage"}
      ],
      comparison:{
        columns:[
          {name:"Sunesta",sub:"Installed by ATH",badge:"★ OUR PICK"},
          {name:"Liberty Home Products",sub:"Denver, CO Installer"},
          {name:"SunSetter",sub:"National Retail / DIY"}
        ],
        rows:[
          {label:"Frame Warranty",cells:[{s:"check",t:"Lifetime"},{s:"warn",t:"Lifetime*"},{s:"x",t:"Limited / 1–3 Yr"}]},
          {label:"Arm Warranty",cells:[{s:"check",t:"Lifetime"},{s:"warn",t:"10 Years"},{s:"x",t:"3–5 Years"}]},
          {label:"Transferable to New Owner?",cells:[{s:"check",t:"Yes — adds resale value"},{s:"x",t:"No"},{s:"x",t:"No"}]},
          {label:"Wind Rating",cells:[{s:"check",t:"Defined & tested"},{s:"x",t:"Not defined"},{s:"x",t:"Not defined"}]},
          {label:"Sizing",cells:[{s:"check",t:"Custom — built to your home"},{s:"warn",t:"Limited options"},{s:"x",t:"Pre-built / stock sizes"}]},
          {label:"Service Calls",cells:[{s:"check",t:"Free — local ATH team"},{s:"x",t:"Paid — drive from Denver"},{s:"x",t:"800 number only"}]},
          {label:"1-Year Service Visit",cells:[{s:"check",t:"Included"},{s:"x",t:"Not offered"},{s:"x",t:"Not offered"}]}
        ],
        footer:"Liberty's lifetime frame warranty is non-prorated and non-transferable. Wind ratings not defined. Always request the full written warranty before comparing."
      }
    },
    {
      id:"fabrics", type:"splittext", image: IMAGES.fabricSwatches,
      docViewer:{title:"Sunesta Fabric Collection", tapLabel:"Tap to browse the fabric book",
        pages:["images/fabric-pages/page-01.jpg","images/fabric-pages/page-02.jpg","images/fabric-pages/page-03.jpg","images/fabric-pages/page-04.jpg","images/fabric-pages/page-05.jpg","images/fabric-pages/page-06.jpg","images/fabric-pages/page-07.jpg","images/fabric-pages/page-08.jpg","images/fabric-pages/z-frame-colors.jpg","images/fabric-pages/z-smartdrop-colors.jpg"]},
      title:"Fabrics & Frame Colors",
      bullets:["100+ colorfast fabrics — solids and stripes","100% solution-dyed acrylic — the color runs through the fiber, not printed on","Antimicrobial & water-resistant — resists fading, mold and mildew","Endorsed by The Skin Cancer Foundation for blocking UV","Sewn with PTFE GORE TENARA thread — won't rot or break down in the sun","Armorcoated frames in white, beige, clay, black & brown"],
      script:"This is where it gets fun — you've got over a hundred fabric choices, solids and stripes, so we can match or complement your home.\n\nThe fabric is a 100% solution-dyed acrylic — that means the color runs all the way through the fiber instead of being printed on top, so it holds its color for the long haul. Compare that to vinyl: acrylic is more fibrous, it breathes, it's water-resistant, and it's antimicrobial — it resists fading, mold, and mildew.\n\nIt's also endorsed by the Skin Cancer Foundation for blocking harmful UV — which matters a lot at our elevation. With the Smart Case protecting it, we see these fabrics lasting 20-plus years. Even the thread is special — it's Tenara, which won't break down in the sun the way standard thread does.\n\nAnd the frame itself comes in five colors — white, beige, clay, black, and brown — so the whole system looks like it belongs on your home.",
      talkingPoints:["100+ fabrics — hand them the swatch book here","Solution-dyed acrylic vs. vinyl: color through the fiber, breathable, antimicrobial","Resists fading, mold & mildew · water-resistant","Skin Cancer Foundation endorsed — elevation UV angle","20+ year fabric life with the Smart Case","Frame in 5 colors: white, beige, clay, black, brown"],
      coach:"Hand them the fabric samples and tie color choice to their home's exterior. The swatch graphic is illustrative — the real fabric book is the prop that sells this slide."
    }
  ],
  "SMART TECHNOLOGY": [
    {
      id:"smarttitle", type:"herosplit", image: IMAGES.smartTechIllus,
      title:"Smart Technology",
      subtext:"Somfy-powered control — remote, wall switch, app, or full home automation. And wind protection comes standard on every motorized unit.",
      script:"A few optional upgrades — totally based on preference. The system runs on a Somfy motor. Standard operation is a handheld remote or a wireless wall switch. If you want to go further, you can control it through an app or integrate it into a home automation system.\n\nOne thing that's not optional with us: every motorized awning we install includes a wind sensor as a standard feature. I'll show you that in a second.",
      talkingPoints:["Upgrades are optional and addable later — don't oversell","Wind sensor is STANDARD on every motorized unit, not an add-on","Don't feel like you have to decide on all of it right now"],
      coach:"Rebuilt as a native layout — the old slide was a screenshot with its title baked in."
    },
    {
      id:"dropscreen", type:"splittext",
      cert:"images/library/sunesta/charcoal-solid-charcoal-siding-wall-mount-with-drop-screen.jpg",
      scrub:{frameBase:"images/dropscreen-frames/frame-", frameCount:28, framePad:2, frameExt:".jpg", hint:"Slide to raise & lower the screen", ends:["◄ Screen up","Screen down ►"]},
      title:"Drop Screen — Block the Low Sun",
      bullets:["A vertical panel drops from the front bar — down when you want it, gone when you don't","Blocks the low-angle morning and evening sun the awning can't reach","Adds privacy and cuts wind along the open front edge","Manual or motorized — operates independently of the awning","Available on the Sunesta & Sunstyle (not the Sunlight)","Add it now or later — the system is designed for both","Choose a lighter mesh to keep your view, or solid for full shade"],
      script:"The drop screen — Sunesta calls it the SmartDrop — is a panel that hangs from the front of the awning when you want it, and rolls away when you don't. It's great for that low-angle sun the awning itself doesn't block, for extra wind reduction, or for a little privacy along the open front.\n\nA question we get a lot: if both the awning and the drop screen are motorized, do they work together? They operate independently — you choose when each one goes up or down. The one habit to build is rolling the drop screen up before you retract the awning, so it doesn't drag on the deck.\n\nYou can add this now or come back and add it later — the system is designed for it either way. We'll show you both in the pricing.\n\n👉 Rep guidance — pricing (value first, never lead with this): the drop-screen motor adds a little over $1,000, so most folks choose the manual — the screen is much lighter than the awning itself. It can be added later, but a retrofit costs a bit more since we swap parts and add the motor. It's available on both models you'll be pricing (not the Sunlight).\n\n👉 If low sun or privacy is on their Accomplish List, build the value here — for them it's essential, not an accessory.",
      talkingPoints:["Blocks low-angle sun, adds privacy, cuts wind at the front edge","Manual or motorized — operates independently of the awning","Roll the screen UP before retracting the awning","Motor ≈ $1,000+ — most choose manual; retrofit costs more (rep guidance, not a slide line)","Available on Sunesta & Sunstyle — not the Sunlight","Lighter mesh keeps the view; solid gives full shade"],
      coach:"If they mentioned evening/morning glare or privacy, tie straight back to it. Matt still owes full selling points/warranty details for the screen — flagged, don't improvise them. Photo is a placeholder — real drop-screen export coming."
    },
    {
      id:"mylink", type:"splittext",
      images:[
        {src: IMAGES.mylinkAppPhone, caption:"Somfy App"},
        {src: IMAGES.mylinkTahomaHub, caption:"TaHoma Hub"}
      ],
      title:"myLink — Your Awning on Your Phone",
      bullets:["Connects your Somfy motor to Wi-Fi with the myLink hub","Open, close, and dim your lights from the Somfy app — from anywhere","Set schedules and scenes — auto-extend on hot afternoons","Works with Amazon Alexa and Google Assistant","One hub controls the awning, drop screen, and LED lights together","Optional and addable anytime — no rewiring"],
      script:"If you want to go a step beyond the remote, this is where it gets modern. The myLink hub connects your awning to your home Wi-Fi, and now you can run everything from the Somfy app on your phone — from anywhere.\n\nYou can put it on a schedule so it extends on its own on those hot afternoons, or tie it into Alexa or Google if that's how your home already works. One hub can run the awning, the drop screen, and the LED lights together.\n\nThis is completely optional and you can add it anytime — I just want you to know the ceiling on what this system can do.",
      talkingPoints:["myLink hub = control from your phone, anywhere","Schedules & scenes (auto-extend on hot afternoons)","Works with Alexa & Google","One hub runs awning + drop screen + lights","Optional, addable anytime — don't oversell"],
      coach:"Keep this light and preference-based. It's a 'nice to know the ceiling' slide, not a push. Photos are the Somfy app (phone) and the TaHoma hub — real product shots. Note: the hardware/app shown is branded TaHoma; slide copy says 'myLink' throughout — flagged for Jack to confirm this is still the correct product name to use."
    },
    {
      id:"sensors", type:"reasonsphoto", image: IMAGES.sensorsIllus,
      title:"Automatic Sensors — Wind, Rain, Sun",
      script:"Here's the peace-of-mind slide — and it starts with something that's standard with us, not an add-on.\n\nEvery motorized awning we install comes with a wind sensor as a standard feature. If you step out, forget the awning's extended, and one of our Colorado afternoon storms blows through — it retracts automatically. You don't have to be home. You don't have to babysit it. We've had customers tell us it paid for itself the first summer.\n\nThe rain and sun sensors are optional add-ons. The rain sensor retracts the fabric when a sudden downpour moves in, and the sun sensor can extend the awning on its own when direct sun hits — so the space is already shaded before you even walk outside.\n\n⚠️ UNVERIFIED — confirm before repeating to a customer: the wind sensor may actually be a motion sensor that needs ~5–7 seconds of sustained movement to trigger (so a single gust doesn't cycle it). Jack is confirming with Sunesta.",
      talkingPoints:["Wind sensor: STANDARD on every motorized unit — lead with it","Rain & sun sensors: optional add-ons","Colorado afternoon storms + travel = the emotional hook","'You don't have to babysit it'","Tap each pill to reveal the sensor"],
      coach:"Risk-removal close — tie the wind sensor to their travel or busy schedule. Rebuilt as a native layout; the old slide was a screenshot with leftover LED-lights text baked in. Wind hotspot now has a real product photo in its popover. Rain and Sun stay text-only — Jack is confirming sensor-type ID on a candidate photo before either gets a real image; don't add one on your own.",
      hotspots:[
        {x:0.52,y:0.178,label:"Wind — Standard",photo:IMAGES.sensorWind,content:"Included as a standard feature on every motorized awning we install. Retracts the awning automatically when wind picks up — whether you're home or not."},
        {x:0.52,y:0.50,label:"Rain",content:"Optional — retracts the fabric automatically when a sudden downpour moves in, so it isn't left out wet."},
        {x:0.52,y:0.822,label:"Sun",content:"Optional — extends the awning automatically once direct sun is detected. The space is shaded before you step outside."}
      ]
    },
    {
      id:"led", type:"herosplit", image: IMAGES.ledAwningArms,
      title:"LED Lighting — Enjoy the Space After Dark",
      subtext:"Our most popular add-on. Dimmable, one remote with the awning — under-arm task lighting or top-mounted underglow, the crowd favorite.",
      script:"This is actually our most popular add-on — LED lighting.\n\nIt completely changes the space at night — soft ambiance for dinner on the patio, or full brightness for an evening gathering. It's all dimmable, and it's the same remote that's already in your hand for the awning.\n\nWe can place the lights under the arms for functional task lighting, or on top of the arms for an underglow effect — that's our more popular option. It's integrated into the awning, not a clip-on afterthought. They can be added later too, but it typically costs a little more because it requires a return trip.\n\nThe number of customers who add this and then tell us 'I can't imagine not having it' — it's most of them. Just something to consider.\n\nAnd one more thing — with all of our awnings, we include a free one-year service. Let me show you what that covers.\n\n[Transition] \"Well, thanks for your time on that. Any questions about anything? Our company, products, me — anything at all?\"",
      talkingPoints:["Most popular add-on — lifestyle close","Under-arm = task light · top-of-arm = underglow (most popular)","Dimmable, one remote with the awning","Add-later possible but costs more (return trip) — rep guidance","Segue: free one-year service → next slide","End with the open question — company, products, me, anything"],
      coach:"Paint the evening picture — dinner, a glass of wine, the game. Real photo now — a lit patio at night under the awning arms."
    },
  ],
  "THE WRAP-UP": [
    {
      id:"warrantyrecap", type:"warrantyrecap",
      title:"The Warranty — Recapped",
      subtext:"One national warranty, backed three ways — and your first year of service on us.",
      tiles:[
        {num:"Lifetime", label:"Frame", sub:"incl. powder coating — chips, fade, defects"},
        {num:"Lifetime", label:"Arms — Sunesta", sub:"Sunstyle 15 yr · Sunlight 12 yr", hero:true},
        {num:"10 years", label:"Fabric", sub:"20+ yr lifespan with the Smart Case"},
        {num:"10 years", label:"Motor", sub:"hand-assembled Somfy"},
        {num:"5 years", label:"Electronics", sub:"remotes & controls"}
      ],
      nodes:[
        {id:"ath", kind:"logo-ath", title:"Around The House", detail:"Your local team — design, installation, and service all handled by us, right here. Family-owned in Monument: founded by Kirt & Vicki, now run with their sons Maxx & Jack. National brand backing, local accountability.", photo:IMAGES.triAthFamily},
        {id:"sunesta", kind:"logo", title:"Sunesta", detail:"The manufacturer itself — designed, engineered, and warrantied by one company. Not an assembly of parts from five different suppliers.", photo:IMAGES.triSunestaAwning},
        {id:"gibraltar", kind:"text", title:"Gibraltar", detail:"Sunesta's parent financial backing — Gibraltar Industries — is what makes the nation's-best warranty coverage possible and dependable over the long run.", photo:null}
      ],
      service:{title:"First year of service — on us", items:["Cleaning & inspection","Remote battery replacement","Pitch & tension adjustments"], foot:"Additional service packages available beyond year one"},
      script:"Before we look at options, let me quickly recap what's actually backing all of this.\n\nThe hardware carries a lifetime warranty — that includes the powder coating, so chips, fading, and defects are covered. The fabric is a 10-year warranty — and like I mentioned, with the Smart Case we routinely see 20-plus years out of it. The arms depend on the model — twelve years on the Sunlight, fifteen on the Sunstyle, and lifetime on the Sunesta — that's part of why we lean toward the flagship. The motor carries a 10-year warranty, and the electronics — the remotes and controls — carry five.\n\nDEEP-DIVE — ARMS & MOTOR (competitor contrast): \"Two of those are worth a second longer. The arms — that's where cheap awnings die. Two-cable arms, thin hardware, chain-style systems that corrode… when those fail, you're not fixing a part, you're replacing the unit. Ours are the PVC-coated steel-cable arms we talked about, and they're warrantied accordingly.\n\nAnd the motor — a lot of what's sold out there runs an imported motor with a one-year warranty. When it fails in year three, that company charges you a trip fee just to come look at it, and then parts and labor on top — you get nickel-and-dimed for the life of the awning. Ours is the hand-assembled Somfy, ten years, and we're local.\n\nOne more thing worth knowing: every manufacturer requires correct installation for the warranty to be valid at all. A guy off Craigslist might get it on the wall — but if it's not installed to spec, there may be no warranty behind it at all.\"\n\nTRIANGLE OF STRENGTH: \"Sunesta is a national brand — so yes, we're your local company… but you also have a national warranty backing you.\n\nA lot of other companies piece together parts from a bunch of different manufacturers — we call those Frankenstein awnings (Get a laugh). When that company goes out of business, your warranty typically goes with them, so it's nice knowing a national brand has you covered.\n\nYour new awning comes with a unique QR code which contains all the important data about your awning — product type, measurements, fabric information — which makes the warranty process simple and efficient. And the warranty is fully transferable to the next homeowner, so it adds some good value to the project and the home.\"\n\n1-YEAR FREE SERVICE: \"And with all of our awnings, your first year of service is on us — we come back out, clean the unit, replace the remote battery, and make any adjustments needed. Additional service packages are available beyond that first year too.\"\n\nTransition / engagement question: \"Any questions about the warranties?\"",
      talkingPoints:["Recap the grid, then go deeper on just TWO components: arms + motor","Arms = where cheap awnings die · motor = imported one-year warranties, trip fees, nickel-and-diming","Doubt-plant: warranty requires correct installation — a Craigslist install may carry no warranty at all","Frankenstein awnings — get the laugh, then go serious for QR + transferable","First year of service on us: cleaning · battery · adjustments","End on: 'Any questions about the warranties?'"],
      coach:"⏱ Keep this tight: 1.5–2 minutes, NOT 15 (Matt's explicit note). Tap a triangle logo for detail — the family and awning photos are in the popups. Service inclusions are DRAFT from Matt's outline — confirm before leaning on specifics."
    },
    {
      // Photo credits (CC via Openverse/Flickr): tier1 "First Shot, New Lens" by tdlucas5000 (CC BY 2.0);
      // tier2 "Fix broken awning frame, patch awning" by sf-dvs (CC BY 2.0); tier3 "Collapsed Awning" by
      // Fire At Will [Photography] (CC BY-SA 2.0); tier4 "Red Retractable Awning" by ersshading (CC BY 2.0).
      // tier5 + tier6 are ATH's own photos (Sunesta beauty shot · Latitude pergola from aroundthehouseco.com).
      id:"pricecond", type:"costscale",
      eyebrow:"Know the market — position, don't surprise",
      title:"Not All Shade Costs the Same",
      paragraph:"Five tiers of shade, from a sail on poles to a motorized louvered roof. Tap any tier to see what your money actually buys.",
      // 5 rungs — matches the price-conditioning script's 5 price points
      // exactly (data/doghouse-content-v1.json, s22: blocks b2/b3/b4 walk
      // shade-sails -> online/handyman -> low-end-companies -> [pergolas
      // top / our-tier middle]). No dollar figures here — the rep speaks
      // the PRICE_* values live; the slide shows relative position only.
      //
      // NOTE for Jack: the old 6-tile grid also carried a "Mid-tier —
      // hood, no cassette, fees after install" rung between low-end and
      // our-tier. The current script (s22) only narrates 5 price points
      // and has no beat for it, so it has no home in this rebuild and was
      // dropped from the slide. Content kept here in case you want it
      // folded back in somewhere:
      //   label: "Mid-tier", sublabel: "Hood, no cassette · fees after install"
      //   detail: "A decent-looking product — a hood but no full cassette,
      //   1–5 year motor warranties, and trip charges and service-call
      //   fees after the install."
      rungs:[
        {n:1, photo:IMAGES.pcTier1, popPhoto:IMAGES.pcTier1, label:"Shade sails / cheap manual overhead", detail:"Entry-level overhead fabric — no engineering, no wind rating, no real warranty to speak of."},
        {n:2, photo:IMAGES.pcTier2, popPhoto:IMAGES.pcTier2, label:"Buy online + handyman install", detail:"Stock units shipped in a box. Whoever installs it owns the mistakes — and the manufacturer may not honor the warranty. Sooner or later, you're the one on the ladder patching it."},
        {n:3, photo:IMAGES.pcTier3, popPhoto:IMAGES.pcTier3, label:"Low-end companies", detail:"Manual awnings with low wind ratings — or if motorized, an imported motor with a 1-year warranty, 2-cable arms, and thinner hardware. This is what failure looks like: a buckled arm and the fabric on the railing."},
        {n:4, photo:IMAGES.pcTier5, popPhoto:IMAGES.pcTier5, label:"Professionally installed quality awning", athMarker:true, detail:"Something like what we offer — higher-quality hardware, a full SmartCase protecting the fabric, lifetime arms, and a local team behind it."},
        {n:5, photo:IMAGES.pcTier6, popPhoto:IMAGES.pcTier6, label:"Pergolas / louvered roof systems", detail:"Motorized louvered roofs with screens — the top of the shade market, at a very different budget. That's our own Latitude line in the photo; we install these too."}
      ],
      script:"Walk the ladder low to high — their quote should feel positioned, not surprising. Reference competitor estimates and photos as they're available.\n\n(LOW END — verbatim): \"If anyone comes in here and asks for $X.00 for a motorized retractable awning — ask them a lot of questions… How is it so cheap? How long have you been in business? Where do you get your installers? This is almost certainly an awning that will fail sooner than you'd like, and you may have to replace it within a few years.\"\n\n(HIGH END): \"If anyone comes in here and asks for $X.00 —\"\n🕳 UNFINISHED IN SOURCE — the high-end rebuttal cuts off exactly here in Matt's notes. Needs Matt's ending — don't improvise it.\n\n(MID TO UPSCALE — verbatim): \"A professionally installed, high-quality awning with a legitimate company and warranty will cost somewhere between $X and $X. We're typically going to fall somewhere in between this range…\"",
      talkingPoints:["Position the market BEFORE your number lands","Low-end objection: ask a lot of questions — how is it so cheap?","Dollar figures stay verbal — nothing on the slide","Rungs 3–5 are where competitors live; we sit high-mid with lifetime arms + Smart Case standard","High-end rebuttal is unfinished — parked until Matt supplies the ending"],
      coach:"Tier photos are in — CC-licensed finds plus our own Sunesta and Latitude shots (credits in js/data.js). Tap a rung and the popup shows the photo big. Still waiting on Matt: competitor ESTIMATE photos for the training layer, and the high-end rebuttal ending. Sets up the Transition to Pricing (see the Close reference in the Coach). ⚠️ FLAG FOR JACK — rebuilt as a 5-rung cost scale (was a 2x3 photo grid); the old grid's 4th tile (\"Mid-tier — hood, no cassette, fees after install\") had no home in the current 5-price-point script and was dropped — see the code comment above `rungs` in data-sunesta.js if you want it folded back in somewhere."
    }
  ]
};

// ── Training Mode reference library ─────────────────────────────────────────
// Rep-facing only. Rendered in the Training Mode side panel (never on slides).
// Edit freely — same rule as the deck: content lives here, engine in app.js.

const TRAINING_REFERENCE = {

  doDont: {
    // Sunesta-specific additions only — the shared Do & Don't core + Four Sales
    // live in TRAINING_SHARED (js/registry.js) and render on every product.
    dont: [],
    do: [
      "Slow down at the money slide (Models) — that's the whole game"
    ]
  },

  faqs: [
    {tag:"FAQ", q:"Do you all offer any financing?",
     a:"Yes, absolutely. We have some great options available. Unlike credit cards with yearly fees and interest rates as high as 29%, we work with home-improvement lenders. There's no prepayment penalty, and everything extra you pay goes directly toward the principal. We have low monthly budget plans with rates as low as 10.99%, or a 12-month no-interest / same-as-cash option. These are popular either way you go because there's no money down, and the first payment isn't due until after the installation is complete.\n\nWe can look into getting you pre-approved with no impact on your credit score. Is that something you'd be interested in?"},
    {tag:"FAQ", q:"Will you all be doing this work or do you use subcontractors?",
     a:"Yes! We work with subcontractor partners. We train with them, critique, and perform final inspections. They work for us and only us. All of our partners install to the specifications required by the manufacturers and are trained directly as well. Around the House manages and warranties the work, and will perform a final walk-through to ensure quality and satisfaction."},
    {tag:"Objection", q:"\"We want to think about it.\"",
     a:"What it usually means: something is unresolved — price, value, trust, or a missing decision-maker.\n\n\"Totally fair — help me understand where you're at. On a scale of 1 to 10, how close does this feel to being the right move?\"\n\n(If 7 or above — find what's holding them back and address it directly.)\n(If below 7 — something bigger is unresolved. Deeper escalation scripts are pending the official Profectus material.)"},
    {tag:"Objection", q:"\"We want to get another quote.\"",
     a:"\"Completely reasonable — I'd do the same thing. When you're comparing, a few things worth checking: What cassette system are they using? What is the warranty — is it one warranty or multiple? And do they use a steel cable or a chain system inside the arms? Those three things tell you a lot about what you're actually buying.\""},
    {tag:"Objection", q:"\"It's more than we expected to spend.\"",
     a:"\"I hear you — let's look at this together. Of everything we've walked through, what feels most important to keep and what could we potentially revisit? We can always right-size this so it fits where you're at.\"\n\n👉 Remove items the homeowner chooses to remove — do not discount blindly."},
    {tag:"Objection", q:"\"We need to talk to our spouse / partner.\"",
     a:"\"Of course. Is there anything you feel like we haven't covered that would help them understand the value when you talk it through? And is there any chance we could get them on a quick call so I can answer any questions directly?\""},
    {tag:"Objection", q:"\"We're thinking about doing a pergola instead.\"",
     a:"\"That makes sense — and honestly, the two work really well together. A lot of our customers end up doing an awning first and adding a pergola later, or vice versa. We actually do both. If you want, I can show you how that could look combined.\""},
    {tag:"Objection", q:"\"I'm worried about the wind.\"",
     a:"\"Great question — and it's one of the most common things we hear in Colorado. The arms are tested to 98 miles per hour before they break. The system is 30 mph wind rated for continuous operation. And the wind sensor — which comes standard on every motorized unit we install — retracts it automatically before conditions get serious. Wind is actually one of the reasons we recommend the Sunesta over the lighter models.\""},
    {tag:"Objection", q:"\"Will it block our view?\"",
     a:"\"It actually won't — and that's one of the things people are always pleasantly surprised by. The awning shades the space from above without blocking your sightline outward. And if you add a drop screen, you can choose a lighter mesh that blocks the sun glare while still letting you see through it.\""},
    {tag:"Objection", q:"\"What if it hails or storms?\"",
     a:"\"Really windy — retract it. Rain — it's designed for it, just let it dry before storing for extended periods. Hail — if a significant storm is coming, retract it. The Smart Case protects the fabric when it's retracted, and the valance is inexpensive to replace if it ever takes a hit. For catastrophic weather events, that's typically a homeowners-insurance conversation.\""},
    {tag:"Objection", q:"\"We might wait until next season.\"",
     a:"\"Totally your call — and I want to be straight with you. We're typically three to five weeks out right now. As we get into the busy season, that stretches to eight to ten weeks and pricing often adjusts. If you're going to do this, sooner is usually better just from a logistics standpoint. But I'll never pressure you — whenever it's right for you is the right time.\""}
  ],

  close: {
    note: "Rep-facing only — this is spoken over the live estimate. Per Jack: no customer-facing pricing slides.",
    sections: [
      {title:"🔥 Laying Off Pricing (Confident & Excited)",
       body:"\"Are you all excited?\" (Get the homeowner to laugh or smile — you can even ask for a drum roll if the rapport is there.)\n\n\"So based on everything we talked about — and your goals of…\"\n👉 (repeat their Accomplish List — their words)\n\"…this is what I put together for you.\"\n\nBuild value as you present: \"These numbers include installing your new ______ with a ______ warranty.\" (If applicable) \"We will pull all necessary permits.\" \"We're ____ to ____ weeks out for installation, and your project is typically completed in about half a day. Most importantly — you'll get to enjoy your outdoor space year-round with all the features we covered.\"\n\n(Review Estimate)\n\nRebuild value and any real urgency during the estimate recap, then:\n\"Which option works best for you all?\""},
      {title:"💰 Price Presentation Frame (Profectus)",
       body:"Tie to the list FIRST: \"This option is designed to give you everything you said you wanted…\"\n\nThen show options:\n• Option 1 = Ideal — the full solution\n• Option 2 = Rightsized — never presented first, and built by removing what THEY choose to remove, not by discounting"},
      {title:"🔥 Rebuild Excitement + The One-Year Price",
       body:"\"And the good news is — you actually caught us at a great time…\"\n👉 Insert promo naturally — never lead with it.\n\nIndifference is key — avoid the homeowner sensing 'commission breath,' like you're only there to sell them.\n\nSelling the one-year price:\n\"This price is good for the next year, which is great. You can call me tomorrow, six months from now, 364 days from now — this price is locked in for you. It's very competitive with what you'll find in our industry.\""},
      {title:"🧠 Micro-Close",
       body:"\"Does this all make sense so far?\"\n\n👉 Stop talking. Wait. Do not fill the silence.\n\n\"Any questions about the one-year prices?\"\n\nIf yes and engaged — move to close. If they hesitate — something is unresolved. Find it before you ask for the decision."},
      {title:"🟢 Close Transition",
       body:"\"So between the two options we've narrowed down together, which stands out as an initial preference?\"\n\n*90% of customers: \"For the difference in cost between the Sunesta and Sunstyle, we'd rather have the stronger awning.\"\n*10% of customers: \"Whatever is cheapest is good for us — we don't plan to be out there when it's windy.\"\n\n👉 NOT: \"What do you think?\" · \"Any questions?\"\nThe close is a preference question, not a yes/no."}
    ]
  },

  preDemo: {
    intro: "Before the deck — recap at the table and confirm understanding of the offer (the awning vs. their outdoor space and logistics).",
    body: "\"Before I show you the product — how long have you guys been in the home?\" (Or: \"You said you've been in the home X years, is that right?\")\n\n\"And this space here… is this where you spend most of your time outside?\"\n\n\"Is this something you've been thinking about for a while?\"\n\n👉 Tie back to the Accomplish List (subtle reminder): \"Perfect — so really making this usable, cooler, and protected is the goal.\"\n\nMEASUREMENT RECAP: \"To recap what we looked at outside — I measured X feet in width to cover the desired space, with an X projection away from the home. When we factor in some pitch, that places the end of your new awning near the end of the deck. During installation our technicians will work with you to dial in pitch versus head clearance.\"\n\nCABLE MANAGEMENT: \"These awnings require 110v power, so we'll plan to plug into this outlet here. The cords are outdoor-rated and typically stay plugged in year-round. They come in X and X colors, but we can also paint them to match your siding or stucco if you have paint available. We typically run the wiring as discreetly as possible down your window or door trim.\"\n\n\"Do you have a preference on painting the cord versus the cord color options?\"\n\nSUN ORIENTATION: \"Based on your orientation versus the sun (reference Lumos photos if possible), this will provide great coverage from X to X hours and make this space much more usable and cooler throughout the year.\"\n\nDROP SCREEN (if it's essential for them): explain why and build value here. You can add it later with both models you'll be priced on (not available on the Sunlight).\n\n\"Based on what I went over, do you feel this is the right option for you and your home?\"\n\n👉 GET A YES!!!!!! If it's a no, a maybe, or anything short of a yes — ask more questions, uncover the objection, and handle it during the presentation."
  },

  tenSteps: {
    intro: "The 10-step sales process — the full arc of every in-home visit. The deck covers steps 4–6; everything around it is you.",
    steps: [
      {n:1,  title:"Introduction / Warm Up & Set Agenda", stage:"At the door / table"},
      {n:2,  title:"Discovery Q & A / Needs Analysis", stage:"At the table"},
      {n:3,  title:"Recap at Table & Confirm Understanding of the Offer", stage:"At the table", detail:"Awnings/screens etc. vs. their outdoor space and logistics — see the Pre-Demo Recap reference."},
      {n:4,  title:"Company Story through Installation & Manufacturer Info", stage:"Presentation"},
      {n:5,  title:"Product Options & Product Demo — Problem / Feature / Benefit", stage:"Presentation"},
      {n:6,  title:"Warranties & Price Conditioning", stage:"Presentation"},
      {n:7,  title:"First Visit Discount through Laying Off Price", stage:"Pricing", detail:"Rebuild value, pricing & financing / payment options — see the Pricing & Close reference."},
      {n:8,  title:"Ask For the Business / Next Steps", stage:"Close"},
      {n:9,  title:"Uncover, Manage & Overcome Objections", stage:"Close", detail:"See FAQs & Objections for the response scripts."},
      {n:10, title:"Ask for Referrals · Close / Reset Agenda (If no sale)", stage:"Close"}
    ]
  }
};

// ── Product registration ────────────────────────────────────────────────────
// THE DOGHOUSE registry (js/registry.js). app.js binds the active product via
// setProduct(key) and reads everything from this object — the consts above are
// just how this file builds it.
PRODUCT_DATA.sunesta = {
  deck: DECK,
  training: TRAINING_REFERENCE,
  logo: IMAGES.sunestaLogo,                                // brand node in videoloop / triangle / warrantyrecap
  brandHTML: 'Around The House · <b>Sunesta® Awnings</b>', // present-mode topbar (customers see this, never DOGHOUSE)
  photoCats: ["sunesta","sunstyle","sunlight","awnings","screens"], // Photo Library pill order
  docs: DOC_LIBRARY,
  docsCard: {name:"Spec Sheets & Fabrics", sub:"Model spec sheets, fabric collection, color charts"}
};
