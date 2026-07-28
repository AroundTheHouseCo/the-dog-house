// THE DOGHOUSE product registry.
// Each product ships its own js/data-<key>.js which registers itself into
// PRODUCT_DATA (deck, training, logo, brandHTML, photoCats, docs, …).
// app.js binds the active product via setProduct(key) — nothing below is
// read at script-load time, so product files can load in any order after this one.
const PRODUCT_DATA = {};

// Drives the Presentations picker and the Training Center coach picker.
// Flip ready:true when a product's deck/coach ships (a product is only
// enterable once its data file has registered into PRODUCT_DATA).
const PRODUCTS = [
  {key:"sunesta",      icon:ICON.awning,  name:"Sunesta® Awnings",   coach:"Sunesta",       tag:"Retractable awnings — the full demo deck", ready:true},
  {key:"eclipse",      icon:ICON.screen,  name:"Eclipse® Screens",   coach:"Eclipse",       tag:"Motorized screens & track systems", ready:true},
  {key:"gutterhelmet", icon:ICON.gutter,  name:"Gutter Helmet®",     coach:"Gutter Helmet", tag:"Gutter protection · Helmet Heat", ready:false},
  {key:"pergola",      icon:ICON.pergola, name:"Louvered Pergolas",  coach:"Pergola",       tag:"Motorized louvered roofs", ready:false}
];

// Shared rep training — ATH / Profectus method, true for every product.
// Product-specific rules live in each product's training.doDont ({dont:[],do:[]})
// and are appended to these lists in the Do & Don't view.
const TRAINING_SHARED = {
  doDont: {
    dont: [
      "Don't read slides — know the slides",
      "Don't info dump",
      "Don't skip tying back to their goals"
    ],
    do: [
      "Always relate back to THEIR situation",
      "Build emotion → then logic → then close"
    ],
    fourSales: {
      intro: "Per the ATH / Profectus framework — the customer needs to be sold on all four before they commit:",
      items: [
        "Do the project — they believe the problem is worth solving",
        "Do it right — they believe the quality justifies the investment",
        "Do it with ATH — they trust you and the company",
        "Do it now — they have a reason to move forward today"
      ],
      footer: "If you lose the sale, trace it back to which of these four was not fully closed. That is your gap."
    }
  }
};
