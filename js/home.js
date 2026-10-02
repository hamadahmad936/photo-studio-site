let allProducts = [];
let activeType = "all";

const grid = document.getElementById("productGrid");
const filtersBox = document.getElementById("filters");
const searchBox = document.getElementById("searchBox");

const TYPE_NAMES = { mug: "Mugs", shirt: "Shirts", pillow: "Pillows", frame: "Frames" };

function typeName(type) {
  if (TYPE_NAMES[type]) return TYPE_NAMES[type];
  return type ? type.charAt(0).toUpperCase() + type.slice(1) : "Other";
}

async function loadProducts() {
  try {
    const snap = await db.collection("products").orderBy("createdAt", "desc").get();
    allProducts = [];
    snap.forEach(function (doc) {
      const p = doc.data();
      if (p.active === false) return; // hidden by the admin
      allProducts.push({ id: doc.id, data: p });
    });
    buildFilters();
    renderProducts();
  } catch (e) {
    grid.textContent = "Could not load products. Please refresh the page.";
    console.error(e);
  }
}

function buildFilters() {
  filtersBox.textContent = "";
  const types = [];
  allProducts.forEach(function (item) {
    if (types.indexOf(item.data.type) === -1) types.push(item.data.type);
  });
  if (types.length < 2) return; // no need for filters with one kind of product

  ["all"].concat(types).forEach(function (type) {
    const btn = document.createElement("button");
    btn.textContent = type === "all" ? "All" : typeName(type);
    if (type === activeType) btn.className = "active";
    btn.setAttribute("aria-pressed", type === activeType ? "true" : "false");
    btn.setAttribute("aria-label", "Show " + (type === "all" ? "all products" : typeName(type)));
    btn.onclick = function () {
      activeType = type;
      buildFilters();
      renderProducts();
    };
    filtersBox.appendChild(btn);
  });
}

function renderProducts() {
  const term = searchBox.value.trim().toLowerCase();
  grid.textContent = "";

  const shown = allProducts.filter(function (item) {
    const p = item.data;
    if (activeType !== "all" && p.type !== activeType) return false;
    if (!term) return true;
    return (p.name || "").toLowerCase().indexOf(term) !== -1
      || (p.description || "").toLowerCase().indexOf(term) !== -1;
  });

  if (allProducts.length === 0) {
    grid.textContent = "No products yet. Please check back soon.";
    return;
  }
  if (shown.length === 0) {
    grid.textContent = "No products match your search.";
    return;
  }

    shown.forEach(function (item) {
    const p = item.data;

    const card = document.createElement("a");
    card.className = "product-card";
    card.href = "product-detail.html?id=" + encodeURIComponent(item.id);

    const img = document.createElement("img");
    img.src = p.thumbUrl || p.imageUrl;
    img.alt = p.name;
    img.loading = "lazy";
    card.appendChild(img);

    const name = document.createElement("h3");
    name.textContent = p.name;
    card.appendChild(name);

        const price = document.createElement("p");
    const pct = discountPercent(p);
    if (pct > 0) {
      price.className = "price-discount";
      const was = document.createElement("s");
      was.textContent = formatPrice(p.price);
      price.appendChild(was);
      price.appendChild(document.createTextNode(" " + formatPrice(effectivePrice(p))));
      const badge = document.createElement("span");
      badge.className = "sale-badge";
      badge.textContent = "-" + pct + "%";
      card.insertBefore(badge, card.firstChild);
    } else {
      price.textContent = formatPrice(p.price);
    }
    card.appendChild(price);

    const view = document.createElement("span");
    view.className = "customize-btn";
    view.textContent = "View details";
    card.appendChild(view);

    revealOnScroll(card);
    grid.appendChild(card);
  });
}

searchBox.addEventListener("input", renderProducts);
loadProducts();