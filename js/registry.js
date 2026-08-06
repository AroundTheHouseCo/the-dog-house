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
// Used to be a static TRAINING_SHARED const here (do_dont core + four_sales
// framework), migrated into data/training-content-shared.json's
// `reference` block so it's tap-to-edit like everything else the content
// editor covers (js/training-content.js's tcSharedRef()). Product-specific
// additions still live in each product's own content file
// (ref_dodont.training_notes) and get appended to these lists in the Do &
// Don't view (js/app.js trainingBodyHTML).
