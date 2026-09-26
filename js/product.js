// ===== PRINT AREA (where the design is allowed) =====
// Numbers are a share of the guide picture: x and y = top-left corner,
// w and h = width and height. 0.5 means half of the picture.
const ZONES = {
  mug:    { x: 0.03, y: 0.08, w: 0.94, h: 0.84 },
  shirt:  { x: 0.05, y: 0.10, w: 0.90, h: 0.80 },
  pillow: { x: 0.05, y: 0.10, w: 0.90, h: 0.80 },
  frame:  { x: 0.15, y: 0.15, w: 0.70, h: 0.70 }
};

// ===== SETTINGS (change these numbers) =====
const MAX_PHOTOS = 4;           // most photos in the editor (customer designs it)
const STUDIO_MAX_PHOTOS = 10;   // most photos when you design it
// The self-design fee now comes from SHOP.selfDesignFee (set in admin.html > Store settings)

const params = new URLSearchParams(window.location.search);
const productId = params.get("id");

const backLink = document.getElementById("backLink");
if (backLink && productId) {
  backLink.href = "product-detail.html?id=" + encodeURIComponent(productId);
  backLink.textContent = "\u2190 Back to product details";
}

const titleEl = document.getElementById("productTitle");
const priceEl = document.getElementById("productPrice");
const descEl = document.getElementById("productDesc");
const msg = document.getElementById("msg");
const warnMsg = document.getElementById("warnMsg");
const photoCountEl = document.getElementById("photoCount");
const controls = document.getElementById("controls");
const addBtn = document.getElementById("addToCartBtn");
const studioPanel = document.getElementById("studioPanel");
const selfPanel = document.getElementById("selfPanel");
const studioThumbs = document.getElementById("studioThumbs");
const studioNotes = document.getElementById("studioNotes");
const totalText = document.getElementById("totalText");
const optionsBox = document.getElementById("optionsBox");
const sizeRow = document.getElementById("sizeRow");
const colorRow = document.getElementById("colorRow");
const sizeSelect = document.getElementById("sizeSelect");
const colorSelect = document.getElementById("colorSelect");
const qtyInput = document.getElementById("qtyInput");

let product = null;
let canvas = null;
let zoneBox = null;    // the dashed rectangle
let zone = null;       // print area in pixels
let designs = [];      // editor photos: { obj: picture on the canvas, file: original file }
let studioFiles = [];  // photos for "design it for me"
let needSize = false;
let needColor = false;

// ===== LOAD THE PRODUCT =====
async function loadProduct() {
  if (!productId) {
    titleEl.textContent = "No product selected. Go back to the home page.";
    return;
  }
  try {
    const doc = await db.collection("products").doc(productId).get();
    if (!doc.exists) {
      titleEl.textContent = "This product was not found.";
      return;
    }
    product = doc.data();
    if (product.active === false) {
      product = null;
      titleEl.textContent = "This product is not available right now.";
      addBtn.disabled = true;
      return;
    }
    titleEl.textContent = product.name;
    priceEl.textContent = "";
    const pct = discountPercent(product);
    if (pct > 0) {
      const was = document.createElement("s");
      was.textContent = formatPrice(product.price);
      was.style.marginRight = "8px";
      priceEl.appendChild(was);
      priceEl.appendChild(document.createTextNode(formatPrice(effectivePrice(product)) + " (" + pct + "% off)"));
    } else {
      priceEl.textContent = formatPrice(product.price);
    }
    descEl.textContent = product.description || "";
    setupOptions();
    setupCanvas();
  } catch (e) {
    titleEl.textContent = "Could not load the product. Please refresh.";
    console.error(e);
  }
}

// ===== SIZE AND COLOR BOXES =====
function fillSelect(select, row, list, placeholder) {
  select.textContent = "";
  if (!Array.isArray(list) || list.length === 0) {
    row.style.display = "none";
    return false;
  }
  const first = document.createElement("option");
  first.value = "";
  first.textContent = placeholder;
  select.appendChild(first);
  list.forEach(function (value) {
    const o = document.createElement("option");
    o.value = value;
    o.textContent = value;
    select.appendChild(o);
  });
  row.style.display = "block";
  return true;
}

function setupOptions() {
  needSize = fillSelect(sizeSelect, sizeRow, product.sizes, "Choose a size");
  needColor = fillSelect(colorSelect, colorRow, product.colors, "Choose a color");
  optionsBox.style.display = (needSize || needColor) ? "block" : "none";
}

function checkOptions() {
  if (needSize && !sizeSelect.value) {
    msg.textContent = "Please choose a size.";
    return false;
  }
  if (needColor && !colorSelect.value) {
    msg.textContent = "Please choose a color.";
    return false;
  }
  return true;
}

// ===== SET UP THE CANVAS WITH THE GUIDE PICTURE =====
function setupCanvas() {
  const width = Math.min(500, window.innerWidth - 30);
  canvas = new fabric.Canvas("designCanvas", {
    selection: false,
    preserveObjectStacking: true
  });

  fabric.Image.fromURL("assets/templates/" + product.guideFile, function (img) {
    if (!img) {
      msg.textContent = "Guide picture not found: assets/templates/" + product.guideFile;
      return;
    }
    const scale = width / img.width;
    img.scale(scale);
    canvas.setWidth(width);
    canvas.setHeight(img.height * scale);
    canvas.setBackgroundImage(img, canvas.renderAll.bind(canvas));

    const z = ZONES[product.type] || ZONES.mug;
    zone = {
      left: z.x * canvas.getWidth(),
      top: z.y * canvas.getHeight(),
      width: z.w * canvas.getWidth(),
      height: z.h * canvas.getHeight()
    };

    zoneBox = new fabric.Rect({
      left: zone.left,
      top: zone.top,
      width: zone.width,
      height: zone.height,
      fill: "rgba(0,0,0,0)",
      stroke: "#0066cc",
      strokeWidth: 2,
      strokeDashArray: [6, 4],
      selectable: false,
      evented: false
    });
    canvas.add(zoneBox);

    // Keep each photo's center inside the print area
    canvas.on("object:moving", function (e) {
      const o = e.target;
      o.left = Math.max(zone.left, Math.min(o.left, zone.left + zone.width));
      o.top = Math.max(zone.top, Math.min(o.top, zone.top + zone.height));
    });
  });
}

// ===== EDITOR HELPERS =====
function loadFabricImage(file) {
  return new Promise(function (resolve) {
    const reader = new FileReader();
    reader.onload = function (ev) {
      fabric.Image.fromURL(ev.target.result, function (img) {
        resolve(img);
      });
    };
    reader.readAsDataURL(file);
  });
}

function updateStatus() {
  photoCountEl.textContent = designs.length
    ? "Photos: " + designs.length + " of " + MAX_PHOTOS
    : "";
  controls.style.display = designs.length ? "block" : "none";
  const anySmall = designs.some(function (d) { return d.obj.width < 800; });
  warnMsg.textContent = anySmall
    ? "One of your photos is small, so the print may look blurry. Bigger photos (1500 px wide or more) print better."
    : "";
}

// The selected photo (or the only photo if there is just one)
function activeDesign() {
  const obj = canvas && canvas.getActiveObject();
  if (obj && designs.some(function (d) { return d.obj === obj; })) return obj;
  if (designs.length === 1) return designs[0].obj;
  return null;
}

function addDesign(img, file) {
  img.set({
    originX: "center",
    originY: "center",
    cornerSize: 14,
    transparentCorners: false,
    cornerColor: "#0066cc",
    borderColor: "#0066cc",
    // anything outside the print area is hidden
    clipPath: new fabric.Rect({
      left: zone.left,
      top: zone.top,
      width: zone.width,
      height: zone.height,
      absolutePositioned: true
    })
  });
  img.setControlsVisibility({ mt: false, mb: false, ml: false, mr: false });
  canvas.add(img);
  designs.push({ obj: img, file: file });
}

// Put all photos in a neat grid inside the print area
function arrangeDesigns() {
  const count = designs.length;
  if (!count) return;

  const wide = zone.width > zone.height;
  let cols = 1;
  if (count === 2) cols = wide ? 2 : 1;
  else if (count === 3) cols = wide ? 3 : 2;
  else if (count >= 4) cols = 2;
  const rows = Math.ceil(count / cols);

  const cellW = zone.width / cols;
  const cellH = zone.height / rows;

  designs.forEach(function (d, i) {
    const col = i % cols;
    const row = Math.floor(i / cols);
    const fit = Math.min((cellW * 0.95) / d.obj.width, (cellH * 0.95) / d.obj.height);
    d.obj.set({
      scaleX: fit,
      scaleY: fit,
      angle: 0,
      left: zone.left + cellW * (col + 0.5),
      top: zone.top + cellH * (row + 0.5)
    });
    d.obj.setCoords();
  });

  canvas.bringToFront(zoneBox);
  canvas.discardActiveObject();
  canvas.renderAll();
}

// ===== EDITOR: CUSTOMER CHOOSES PHOTOS =====
document.getElementById("designFile").addEventListener("change", async function (e) {
  const files = Array.from(e.target.files);
  e.target.value = "";
  if (!files.length) return;

  if (!canvas || !zone) {
    msg.textContent = "Please wait, the page is still loading.";
    return;
  }

  const room = MAX_PHOTOS - designs.length;
  if (room <= 0) {
    msg.textContent = "You can add up to " + MAX_PHOTOS + " photos. Remove one first.";
    return;
  }

  msg.textContent = files.length > room
    ? "Only " + MAX_PHOTOS + " photos are allowed, so some were skipped."
    : "";

  const chosen = files.slice(0, room);
  for (const file of chosen) {
    if (!file.type.startsWith("image/")) {
      msg.textContent = "Please choose image files only (JPG or PNG).";
      continue;
    }
    if (file.size > 10 * 1024 * 1024) {
      msg.textContent = "One image is too big. Maximum size is 10 MB.";
      continue;
    }
    const img = await loadFabricImage(file);
    addDesign(img, file);
  }

  arrangeDesigns();
  updateStatus();
});

// ===== EDITOR BUTTONS =====
function needSelection() {
  msg.textContent = "Tap a photo first to select it.";
}

function changeScale(factor) {
  const o = activeDesign();
  if (!o) return needSelection();
  msg.textContent = "";
  o.scaleX = o.scaleX * factor;
  o.scaleY = o.scaleY * factor;
  o.setCoords();
  canvas.renderAll();
}

document.getElementById("biggerBtn").addEventListener("click", function () { changeScale(1.1); });
document.getElementById("smallerBtn").addEventListener("click", function () { changeScale(0.9); });

document.getElementById("rotateBtn").addEventListener("click", function () {
  const o = activeDesign();
  if (!o) return needSelection();
  msg.textContent = "";
  o.rotate((o.angle + 15) % 360);
  o.setCoords();
  canvas.renderAll();
});

document.getElementById("removeBtn").addEventListener("click", function () {
  const o = activeDesign();
  if (!o) return needSelection();
  msg.textContent = "";
  canvas.remove(o);
  designs = designs.filter(function (d) { return d.obj !== o; });
  canvas.discardActiveObject();
  canvas.renderAll();
  updateStatus();
});

document.getElementById("arrangeBtn").addEventListener("click", function () {
  msg.textContent = "";
  arrangeDesigns();
});

// ===== WHICH OPTION IS SELECTED =====
function getMode() {
  return document.querySelector('input[name="mode"]:checked').value;
}

function getQty() {
  return clampQty(qtyInput.value);
}

// price of ONE item
function currentPrice() {
  if (!product) return 0;
  return effectivePrice(product) + (getMode() === "self" ? Number(SHOP.selfDesignFee || 0) : 0);
}

function updateTotal() {
  if (!product) {
    totalText.textContent = "";
    return;
  }
  const unit = currentPrice();
  const qty = getQty();
  totalText.textContent = qty > 1
    ? "Price: " + formatPrice(unit) + " x " + qty + " = " + formatPrice(unit * qty)
    : "Price for this item: " + formatPrice(unit);
}

qtyInput.addEventListener("input", updateTotal);
qtyInput.addEventListener("change", function () {
  qtyInput.value = getQty();
  updateTotal();
});

function refreshMode() {
  const self = getMode() === "self";
  studioPanel.style.display = self ? "none" : "block";
  selfPanel.style.display = self ? "block" : "none";
  msg.textContent = "";
  if (self && canvas) {
    canvas.calcOffset();
    canvas.renderAll();
  }
  updateTotal();
}

document.querySelectorAll('input[name="mode"]').forEach(function (r) {
  r.addEventListener("change", refreshMode);
});

// details that every cart item carries
function itemDetails() {
  return {
    productId: productId,
    name: product.name,
    type: product.type,
    size: sizeSelect.value || "",
    color: colorSelect.value || "",
    qty: getQty()
  };
}

// ===== OPTION 1: PHOTOS FOR YOUR STUDIO (free) =====
document.getElementById("studioFiles").addEventListener("change", function (e) {
  const files = Array.from(e.target.files);
  e.target.value = "";
  msg.textContent = "";

  for (const file of files) {
    if (studioFiles.length >= STUDIO_MAX_PHOTOS) {
      msg.textContent = "You can add up to " + STUDIO_MAX_PHOTOS + " photos.";
      break;
    }
    if (!file.type.startsWith("image/")) {
      msg.textContent = "Please choose image files only (JPG or PNG).";
      continue;
    }
    if (file.size > 10 * 1024 * 1024) {
      msg.textContent = "One image is too big. Maximum size is 10 MB.";
      continue;
    }
    studioFiles.push(file);
  }
  showStudioThumbs();
});

function showStudioThumbs() {
  studioThumbs.textContent = "";
  studioFiles.forEach(function (file, i) {
    const box = document.createElement("div");
    box.style.display = "inline-block";
    box.style.margin = "6px";
    box.style.textAlign = "center";

    const img = document.createElement("img");
    img.src = URL.createObjectURL(file);
    img.width = 80;
    box.appendChild(img);
    box.appendChild(document.createElement("br"));

    const rm = document.createElement("button");
    rm.textContent = "Remove";
    rm.onclick = function () {
      studioFiles.splice(i, 1);
      showStudioThumbs();
    };
    box.appendChild(rm);

    studioThumbs.appendChild(box);
  });
}

async function addStudioToCart() {
  if (studioFiles.length === 0) {
    msg.textContent = "Please choose at least one photo first.";
    return false;
  }

  const designUrls = [];
  for (let i = 0; i < studioFiles.length; i++) {
    msg.textContent = "Uploading photo " + (i + 1) + " of " + studioFiles.length + "...";
    designUrls.push(await uploadToImgBB(studioFiles[i]));
  }

  const item = itemDetails();
  item.mode = "studio";
  item.price = effectivePrice(product);
  item.designFee = 0;
  item.designUrl = designUrls[0];
  item.designUrls = designUrls;
  item.previewUrl = designUrls[0];
  item.notes = studioNotes.value.trim();
  addToCart(item);

  studioFiles = [];
  studioNotes.value = "";
  showStudioThumbs();
  return true;
}

// ===== OPTION 2: CUSTOMER DESIGNS IT (extra fee) =====
async function addSelfDesignToCart() {
  if (designs.length === 0) {
    msg.textContent = "Please choose at least one photo first.";
    return false;
  }

  msg.textContent = "Saving your design... please wait.";

  // 1. The original photos (used for printing)
  const designUrls = await Promise.all(designs.map(function (d) {
    return uploadToImgBB(d.file);
  }));

  // 2. One preview picture that shows how everything sits on the product
  canvas.discardActiveObject();
  zoneBox.visible = false;
  canvas.renderAll();
  const dataUrl = canvas.toDataURL({ format: "png", multiplier: 2 });
  zoneBox.visible = true;
  canvas.renderAll();

  const blob = await (await fetch(dataUrl)).blob();
  const previewFile = new File([blob], "preview.png", { type: "image/png" });
  const previewUrl = await uploadToImgBB(previewFile);

  const W = canvas.getWidth();
  const H = canvas.getHeight();
  const placements = designs.map(function (d) {
    return {
      centerX: d.obj.left / W,
      centerY: d.obj.top / H,
      widthFraction: d.obj.getScaledWidth() / W,
      angle: d.obj.angle
    };
  });

  const item = itemDetails();
  item.mode = "self";
  item.price = currentPrice();
  item.designFee = Number(SHOP.selfDesignFee || 0);
  item.designUrl = designUrls[0];
  item.designUrls = designUrls;
  item.previewUrl = previewUrl;
  item.placements = placements;
  addToCart(item);
  return true;
}

// ===== ADD TO CART BUTTON =====
addBtn.addEventListener("click", async function () {
  if (!product) return;
  msg.textContent = "";
  if (!checkOptions()) return;

  addBtn.disabled = true;

  try {
    const added = getMode() === "studio"
      ? await addStudioToCart()
      : await addSelfDesignToCart();

    if (added) {
      msg.textContent = "Added to cart! ";
      const link = document.createElement("a");
      link.href = "cart.html";
      link.textContent = "Go to cart";
      msg.appendChild(link);
    }
  } catch (e) {
    msg.textContent = e.message || "Something went wrong. Please try again.";
    console.error(e);
  } finally {
    addBtn.disabled = false;
  }
});

SHOP_READY.then(function () {
  document.getElementById("feeText").textContent =
    SHOP.selfDesignFee > 0 ? "+" + formatPrice(SHOP.selfDesignFee) + " extra" : "no extra charge";
  loadProduct().then(updateTotal);
});