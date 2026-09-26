// =====================================================================
//  DEFAULT SHOP SETTINGS
//  These are used until the admin saves real settings in the Store
//  Settings section of admin.html. After that, the saved values in
//  Firestore ("settings" / "shop") take over automatically.
//
//  The only thing that STAYS in code (for security) is your admin
//  email below. Everything else can be changed from admin.html.
// =====================================================================
const DEFAULT_SHOP = {
  name: "ChromaCraft Studio & labs",
  adminEmail: "nobodyknows936371@gmail.com",

  whatsapp: "92XXXXXXXXXX",
  phoneText: "03XX-XXXXXXX",
  email: "",
  address: "Your shop address, city, Pakistan",
  hours: "Monday to Saturday, 10 am to 8 pm",

  facebook: "",
  instagram: "",
  tiktok: "",

  jazzcash: { number: "0302-6352998", name: "Saqib Elahi sajjad" },
  bank: { bankName: "", accountTitle: "", iban: "" },

  deliveryFee: 250,
  freeDeliveryAbove: 3000,
  deliveryTime: "3 to 5 working days after your design is approved",
  codNote: "For custom-printed items we may ask for a small advance payment on JazzCash/Bank before we start printing.",

    codEnabled: true,        // turn this off in Settings to stop accepting Cash on Delivery
  pickupEnabled: true,     // turn this off in Settings to remove the "pick up myself" option
  advancePercent: 0,       // 0 = no advance needed for COD orders; e.g. 50 = customer must pay 50% upfront
  selfDesignFee: 100,      // Rs extra when a customer designs their own product
  announcement: { enabled: false, text: "", link: "" },
  theme: { ink: "#14121f", paper: "#f4f0ff", cyan: "#19c8ff", magenta: "#ff3d9a", yellow: "#ffe234", butter: "#fff7b8" }
};

let SHOP = Object.assign({}, DEFAULT_SHOP);
const ADMIN_EMAIL = SHOP.adminEmail;

// =====================================================================
//  MONEY AND TEXT
// =====================================================================
function formatPrice(amount) {
  return "Rs " + Number(amount || 0).toLocaleString("en-PK");
}

function escapeHtml(text) {
  const div = document.createElement("div");
  div.textContent = text == null ? "" : String(text);
  return div.innerHTML;
}

function safeUrl(url) {
  return /^https?:\/\//i.test(url || "") ? url : "";
}

// The price to actually charge for a product, after a sale price if set
function effectivePrice(p) {
  const price = Number((p && p.price) || 0);
  const sale = Number((p && p.salePrice) || 0);
  return (sale > 0 && sale < price) ? sale : price;
}

// 0 if no discount, otherwise a whole-number percent off
function discountPercent(p) {
  const price = Number((p && p.price) || 0);
  const sale = Number((p && p.salePrice) || 0);
  if (!(sale > 0 && sale < price)) return 0;
  return Math.round((1 - sale / price) * 100);
}

// =====================================================================
//  CART
// =====================================================================
function clampQty(q) {
  q = parseInt(q, 10);
  if (isNaN(q) || q < 1) return 1;
  return Math.min(q, 99);
}

function getCart() {
  try {
    const cart = JSON.parse(localStorage.getItem("cart") || "[]");
    return Array.isArray(cart) ? cart : [];
  } catch (e) {
    return [];
  }
}

function saveCart(cart) {
  localStorage.setItem("cart", JSON.stringify(cart));
  updateCartCount();
}

function addToCart(item) {
  const cart = getCart();
  item.qty = clampQty(item.qty);
  cart.push(item);
  saveCart(cart);
}

function setQty(index, qty) {
  const cart = getCart();
  if (!cart[index]) return;
  cart[index].qty = clampQty(qty);
  saveCart(cart);
}

function removeFromCart(index) {
  const cart = getCart();
  cart.splice(index, 1);
  saveCart(cart);
}

function clearCart() {
  saveCart([]);
}

function lineTotal(item) {
  return Number(item.price || 0) * clampQty(item.qty);
}

function cartSubtotal() {
  return getCart().reduce(function (sum, item) { return sum + lineTotal(item); }, 0);
}

function deliveryFeeFor(subtotal) {
  if (subtotal <= 0) return 0;
  if (SHOP.freeDeliveryAbove > 0 && subtotal >= SHOP.freeDeliveryAbove) return 0;
  return Number(SHOP.deliveryFee || 0);
}

function cartGrandTotal() {
  const sub = cartSubtotal();
  return sub + deliveryFeeFor(sub);
}

function updateCartCount() {
  const el = document.getElementById("cartCount");
  if (el) {
    el.textContent = getCart().reduce(function (sum, item) { return sum + clampQty(item.qty); }, 0);
  }
}

// =====================================================================
//  LOGIN
// =====================================================================
function signUp(email, password) {
  return auth.createUserWithEmailAndPassword(email, password);
}

function signIn(email, password) {
  return auth.signInWithEmailAndPassword(email, password);
}

function logOut() {
  return auth.signOut();
}

function isAdmin(user) {
  return !!user && user.email === ADMIN_EMAIL;
}

function friendlyAuthError(error) {
  const messages = {
    "auth/invalid-email": "That email address is not valid.",
    "auth/invalid-credential": "Wrong email or password.",
    "auth/wrong-password": "Wrong email or password.",
    "auth/user-not-found": "No account found with this email.",
    "auth/email-already-in-use": "This email already has an account. Try logging in.",
    "auth/weak-password": "Password must be at least 6 characters.",
    "auth/too-many-requests": "Too many tries. Please wait a few minutes."
  };
  return messages[error.code] || "Something went wrong. Please try again.";
}

// =====================================================================
//  ORDER STAGES
// =====================================================================
const ORDER_STATUSES = [
  { value: "pending",   label: "Waiting for payment check", customer: "We are checking your payment" },
  { value: "COD",       label: "Cash on delivery (new)",    customer: "Order received - cash on delivery" },
  { value: "paid",      label: "Paid",                      customer: "Payment received" },
  { value: "designing", label: "Designing",                 customer: "We are designing your order" },
  { value: "proof",     label: "Preview sent to customer",  customer: "We sent you a design preview. Please check WhatsApp and reply to approve it" },
  { value: "printing",  label: "Printing",                  customer: "Your order is being printed" },
  { value: "shipped",   label: "Shipped",                   customer: "Your order is on the way" },
  { value: "done",      label: "Delivered / finished",      customer: "Completed. Thank you for ordering!" },
  { value: "cancelled", label: "Cancelled",                 customer: "This order was cancelled" }
];

function statusInfo(value) {
  const found = ORDER_STATUSES.find(function (s) { return s.value === value; });
  return found || { value: value, label: String(value), customer: String(value) };
}

// =====================================================================
//  PHOTO UPLOAD (ImgBB)
// =====================================================================
async function uploadToImgBBFull(file) {
  if (!file) throw new Error("No file selected.");
  if (!file.type.startsWith("image/")) {
    throw new Error("Please choose an image file (JPG or PNG).");
  }
  if (file.size > 10 * 1024 * 1024) {
    throw new Error("Image is too big. Maximum size is 10 MB.");
  }

  const formData = new FormData();
  formData.append("image", file);

  const res = await fetch("https://api.imgbb.com/1/upload?key=" + IMGBB_API_KEY, {
    method: "POST",
    body: formData
  });
  const data = await res.json();

  if (!data.success) {
    throw new Error("Upload failed. Please try again.");
  }
  const d = data.data;
  return {
    url: d.url,
    thumb: d.thumb ? d.thumb.url : d.url,
    medium: d.medium ? d.medium.url : d.url
  };
}

async function uploadToImgBB(file) {
  const result = await uploadToImgBBFull(file);
  return result.url;
}

// =====================================================================
//  WHATSAPP AND PHONE HELPERS
// =====================================================================
function hasWhatsApp() {
  return /^\d{10,15}$/.test(SHOP.whatsapp || "");
}

function waLink(number, text) {
  return "https://wa.me/" + number + (text ? "?text=" + encodeURIComponent(text) : "");
}

function phoneToWa(phone) {
  let d = String(phone || "").replace(/\D/g, "");
  if (d.startsWith("00")) d = d.slice(2);
  else if (d.startsWith("0")) d = "92" + d.slice(1);
  else if (d.length === 10 && d.startsWith("3")) d = "92" + d;
  return d;
}

// =====================================================================
//  THEME COLORS (set by the admin in Store settings)
// =====================================================================
function applyTheme() {
  const t = SHOP.theme || {};
  const map = { ink: "--ink", paper: "--paper", cyan: "--cyan", magenta: "--magenta", yellow: "--yellow", butter: "--butter" };
  Object.keys(map).forEach(function (key) {
    if (t[key]) document.documentElement.style.setProperty(map[key], t[key]);
  });
}

// =====================================================================
//  ANNOUNCEMENT / OFFER BAR (set by the admin in Store settings)
// =====================================================================
function buildAnnouncementBar() {
  if (document.getElementById("adminDashboard") || document.getElementById("adminLogin")) return;
  const a = SHOP.announcement || {};
  if (!a.enabled || !a.text) return;
  if (sessionStorage.getItem("announceDismissed") === a.text) return;
  if (document.getElementById("announceBar")) return;

  const bar = document.createElement("div");
  bar.id = "announceBar";

  const content = safeUrl(a.link) ? document.createElement("a") : document.createElement("span");
  if (safeUrl(a.link)) {
    content.href = a.link;
    content.target = "_blank";
    content.rel = "noopener";
  }
  content.textContent = a.text;
  content.className = "announce-text";
  bar.appendChild(content);

  const close = document.createElement("button");
  close.className = "announce-close";
  close.setAttribute("aria-label", "Close");
  close.textContent = "\u00D7";
  close.onclick = function () {
    sessionStorage.setItem("announceDismissed", a.text);
    bar.remove();
  };
  bar.appendChild(close);

  document.body.insertBefore(bar, document.body.firstChild);
}

// =====================================================================
//  SHOP DETAILS ON THE PAGE (text, footer, WhatsApp button)
// =====================================================================
function fillShopText() {
  const texts = {
    name: SHOP.name,
    phone: SHOP.phoneText,
    email: SHOP.email,
    address: SHOP.address,
    hours: SHOP.hours,
    deliveryFee: formatPrice(SHOP.deliveryFee),
    deliveryTime: SHOP.deliveryTime,
    freeDelivery: SHOP.freeDeliveryAbove > 0
      ? "Orders above " + formatPrice(SHOP.freeDeliveryAbove) + " get free delivery."
      : "",
    codNote: SHOP.codNote
  };
  document.querySelectorAll("[data-shop]").forEach(function (el) {
    const value = texts[el.dataset.shop];
    if (value !== undefined) el.textContent = value;
  });

  document.querySelectorAll("[data-shop-link]").forEach(function (a) {
    const kind = a.dataset.shopLink;
    if (kind === "whatsapp" && hasWhatsApp()) {
      a.href = waLink(SHOP.whatsapp, "Hello " + SHOP.name);
    } else if (kind === "phone") {
      a.href = "tel:" + String(SHOP.phoneText).replace(/[^\d+]/g, "");
    } else if (kind === "email" && SHOP.email) {
      a.href = "mailto:" + SHOP.email;
    }
  });
}

function makeEl(tag, text, attrs) {
  const el = document.createElement(tag);
  if (text) el.textContent = text;
  if (attrs) {
    Object.keys(attrs).forEach(function (k) { el.setAttribute(k, attrs[k]); });
  }
  return el;
}

function buildFooter() {
  if (document.getElementById("adminDashboard") || document.getElementById("adminLogin")) return;
  if (document.getElementById("siteFooter")) return;

  const footer = makeEl("footer", "", { id: "siteFooter" });
  const wrap = makeEl("div", "", { class: "footer-grid" });

  const c1 = makeEl("div");
  c1.appendChild(makeEl("h3", SHOP.name));
  c1.appendChild(makeEl("p", "Custom printed mugs, shirts, pillows and more."));
  if (SHOP.hours) c1.appendChild(makeEl("p", "Open: " + SHOP.hours));
  wrap.appendChild(c1);

  const c2 = makeEl("div");
  c2.appendChild(makeEl("h3", "Contact us"));
  if (SHOP.phoneText) {
    const p = makeEl("p");
    p.appendChild(makeEl("a", SHOP.phoneText, { href: "tel:" + String(SHOP.phoneText).replace(/[^\d+]/g, "") }));
    c2.appendChild(p);
  }
  if (hasWhatsApp()) {
    const p = makeEl("p");
    p.appendChild(makeEl("a", "Chat on WhatsApp", {
      href: waLink(SHOP.whatsapp, "Hello " + SHOP.name),
      target: "_blank",
      rel: "noopener"
    }));
    c2.appendChild(p);
  }
  if (SHOP.email) {
    const p = makeEl("p");
    p.appendChild(makeEl("a", SHOP.email, { href: "mailto:" + SHOP.email }));
    c2.appendChild(p);
  }
  if (SHOP.address) c2.appendChild(makeEl("p", SHOP.address));
  wrap.appendChild(c2);

  const c3 = makeEl("div");
  c3.appendChild(makeEl("h3", "Help"));
  [
    ["Delivery", "info.html#delivery"],
    ["Returns", "info.html#returns"],
    ["Privacy", "info.html#privacy"],
    ["Terms", "info.html#terms"],
    ["About us", "info.html#about"]
  ].forEach(function (pair) {
    const p = makeEl("p");
    p.appendChild(makeEl("a", pair[0], { href: pair[1] }));
    c3.appendChild(p);
  });
  [["Facebook", SHOP.facebook], ["Instagram", SHOP.instagram], ["TikTok", SHOP.tiktok]].forEach(function (pair) {
    const link = safeUrl(pair[1]);
    if (!link) return;
    const p = makeEl("p");
    p.appendChild(makeEl("a", pair[0], { href: link, target: "_blank", rel: "noopener" }));
    c3.appendChild(p);
  });
  wrap.appendChild(c3);

  footer.appendChild(wrap);
  footer.appendChild(makeEl("p", "\u00A9 " + new Date().getFullYear() + " " + SHOP.name, { class: "footer-small" }));
  document.body.appendChild(footer);

  if (hasWhatsApp()) {
    document.body.appendChild(makeEl("a", "WhatsApp", {
      id: "waFloat",
      href: waLink(SHOP.whatsapp, "Hello " + SHOP.name + ", I need help with an order."),
      target: "_blank",
      rel: "noopener"
    }));
  }
}

// =====================================================================
//  LOAD REAL SETTINGS FROM FIRESTORE (falls back to the defaults above)
// =====================================================================
const SHOP_READY = (async function () {
  try {
    if (typeof db !== "undefined") {
      const doc = await db.collection("settings").doc("shop").get();
      if (doc.exists) {
        const data = doc.data() || {};
        SHOP = Object.assign({}, DEFAULT_SHOP, data);
        // keep the admin email safe: it is never read from Firestore
        SHOP.adminEmail = DEFAULT_SHOP.adminEmail;
      }
    }
  } catch (e) {
    console.error("Could not load shop settings, using defaults.", e);
  }
  applyTheme();
  buildAnnouncementBar();
  fillShopText();
  buildFooter();
  return SHOP;
})();

// =====================================================================
//  SCROLL ANIMATIONS AND HEADER HIDE/SHOW
// =====================================================================
let __revealObserver = null;
function revealOnScroll(el) {
  if (!el) return;
  if (typeof IntersectionObserver === "undefined") {
    el.classList.add("reveal", "in-view");
    return;
  }
  el.classList.add("reveal");
  if (!__revealObserver) {
    __revealObserver = new IntersectionObserver(function (entries) {
      entries.forEach(function (entry) {
        if (entry.isIntersecting) {
          entry.target.classList.add("in-view");
          __revealObserver.unobserve(entry.target);
        }
      });
    }, { threshold: 0.12 });
  }
  __revealObserver.observe(el);
}

function setupHeaderScroll() {
  const header = document.querySelector("header");
  if (!header) return;
  let lastY = window.scrollY;
  let ticking = false;
  window.addEventListener("scroll", function () {
    if (ticking) return;
    ticking = true;
    window.requestAnimationFrame(function () {
      const y = window.scrollY;
      if (y > lastY && y > 80) header.classList.add("header-hide");
      else header.classList.remove("header-hide");
      lastY = y;
      ticking = false;
    });
  }, { passive: true });
}

function startPage() {
  updateCartCount();
  setupHeaderScroll();
  document.querySelectorAll(".reveal").forEach(revealOnScroll);
}

if (document.readyState === "loading") {
  document.addEventListener("DOMContentLoaded", startPage);
} else {
  startPage();
}