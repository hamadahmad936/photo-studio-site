const loginBox = document.getElementById("adminLogin");
const dashboard = document.getElementById("adminDashboard");
const loginMsg = document.getElementById("loginMsg");
const productMsg = document.getElementById("productMsg");

const GUIDE_BY_TYPE = {
  mug: "mug-guide.png",
  shirt: "shirt-guide.png",
  pillow: "pillow-guide.png",
  frame: "frame-guide.png"
};

let editingId = null;
let ordersList = [];

document.getElementById("loginBtn").addEventListener("click", async function () {
  const email = document.getElementById("loginEmail").value.trim();
  const password = document.getElementById("loginPassword").value;
  loginMsg.textContent = "";
  try {
    await signIn(email, password);
  } catch (e) {
    loginMsg.textContent = friendlyAuthError(e);
  }
});

document.getElementById("logoutBtn").addEventListener("click", function () {
  logOut();
});

auth.onAuthStateChanged(function (user) {
  if (isAdmin(user)) {
    loginBox.style.display = "none";
    dashboard.style.display = "block";
    loadProducts();
    loadOrders();
    loadSettingsForm();
    loadReviewsAdmin();
  } else {
    dashboard.style.display = "none";
    loginBox.style.display = "block";
    if (user) {
      loginMsg.textContent = "This account is not the admin.";
      logOut();
    }
  }
});

const fName = document.getElementById("pName");
const fPrice = document.getElementById("pPrice");
const fSalePrice = document.getElementById("pSalePrice");
const fType = document.getElementById("pType");
const fGuide = document.getElementById("pGuide");
const fDesc = document.getElementById("pDesc");
const fSizes = document.getElementById("pSizes");
const fColors = document.getElementById("pColors");
const fActive = document.getElementById("pActive");
const fPhoto = document.getElementById("pPhoto");
const fGallery = document.getElementById("pGallery");
const saveBtn = document.getElementById("saveProductBtn");
const cancelBtn = document.getElementById("cancelEditBtn");

function parseList(text) {
  const list = [];
  String(text || "").split(",").forEach(function (part) {
    const value = part.trim();
    if (value && list.indexOf(value) === -1 && list.length < 12) list.push(value);
  });
  return list;
}

fType.addEventListener("change", function () {
  const current = fGuide.value.trim();
  const isDefault = Object.keys(GUIDE_BY_TYPE).some(function (k) {
    return GUIDE_BY_TYPE[k] === current;
  });
  if (!current || isDefault) fGuide.value = GUIDE_BY_TYPE[fType.value] || "";
});

function resetForm() {
  editingId = null;
  document.getElementById("formTitle").textContent = "Add a product";
  saveBtn.textContent = "Add product";
  cancelBtn.style.display = "none";
    document.getElementById("photoNote").textContent = "";
  document.getElementById("galleryNote").textContent = "";
    fName.value = "";
  fPrice.value = "";
  fSalePrice.value = "";
  fType.value = "mug";
  fGuide.value = GUIDE_BY_TYPE.mug;
  fDesc.value = "";
  fSizes.value = "";
  fColors.value = "";
  fActive.checked = true;
    fPhoto.value = "";
  fGallery.value = "";
}

function startEdit(id, p) {
  editingId = id;
  document.getElementById("formTitle").textContent = "Edit product";
  saveBtn.textContent = "Save changes";
  cancelBtn.style.display = "inline-block";
    document.getElementById("photoNote").textContent = "(leave empty to keep the current photo)";
  document.getElementById("galleryNote").textContent = (p.galleryUrls && p.galleryUrls.length)
    ? "(" + p.galleryUrls.length + " saved - choosing new ones replaces all of them)"
    : "(none yet)";
    fName.value = p.name || "";
  fPrice.value = p.price || "";
  fSalePrice.value = p.salePrice || "";
  fType.value = p.type || "mug";
  fGuide.value = p.guideFile || "";
  fDesc.value = p.description || "";
  fSizes.value = (p.sizes || []).join(", ");
  fColors.value = (p.colors || []).join(", ");
  fActive.checked = p.active !== false;
    fPhoto.value = "";
  fGallery.value = "";
  productMsg.textContent = "";
  document.getElementById("formTitle").scrollIntoView();
}

cancelBtn.addEventListener("click", function () {
  resetForm();
  productMsg.textContent = "";
});

saveBtn.addEventListener("click", async function () {
  const name = fName.value.trim();
  const price = Number(fPrice.value);
  const salePrice = fSalePrice.value.trim() === "" ? 0 : Number(fSalePrice.value);
  const type = fType.value;
  const guideFile = fGuide.value.trim();
  const file = fPhoto.files[0];

  if (!name || !(price > 0) || !guideFile) {
    productMsg.textContent = "Please fill the name, price and guide file name.";
    return;
  }
  if (!editingId && !file) {
    productMsg.textContent = "Please choose a product photo.";
    return;
  }

  saveBtn.disabled = true;
  try {
        const data = {
      name: name,
      price: price,
      salePrice: (salePrice > 0 && salePrice < price) ? salePrice : 0,
      type: type,
      guideFile: guideFile,
      guideFile: guideFile,
      description: fDesc.value.trim(),
      sizes: parseList(fSizes.value),
      colors: parseList(fColors.value),
      active: fActive.checked,
      updatedAt: firebase.firestore.FieldValue.serverTimestamp()
    };

        if (file) {
      productMsg.textContent = "Uploading main photo...";
      const photo = await uploadToImgBBFull(file);
      data.imageUrl = photo.url;
      data.thumbUrl = photo.thumb;
    }

    const galleryFiles = Array.from(fGallery.files).slice(0, 4);
    if (galleryFiles.length) {
      const galleryUrls = [];
      for (let i = 0; i < galleryFiles.length; i++) {
        productMsg.textContent = "Uploading extra photo " + (i + 1) + " of " + galleryFiles.length + "...";
        const g = await uploadToImgBBFull(galleryFiles[i]);
        galleryUrls.push(g.url);
      }
      data.galleryUrls = galleryUrls;
    }

    if (editingId) {
      await db.collection("products").doc(editingId).update(data);
      productMsg.textContent = "Product updated.";
    } else {
      data.createdAt = firebase.firestore.FieldValue.serverTimestamp();
      await db.collection("products").add(data);
      productMsg.textContent = "Product added.";
    }
    resetForm();
    loadProducts();
  } catch (e) {
    productMsg.textContent = e.message || "Something went wrong.";
    console.error(e);
  } finally {
    saveBtn.disabled = false;
  }
});

async function loadProducts() {
  const box = document.getElementById("productList");
  box.textContent = "Loading...";
  try {
    const snap = await db.collection("products").orderBy("createdAt", "desc").get();
    box.textContent = "";
    if (snap.empty) {
      box.textContent = "No products yet.";
      return;
    }
    snap.forEach(function (doc) {
      const p = doc.data();
      const isActive = p.active !== false;

      const row = document.createElement("div");
      row.style.margin = "10px 0";

      const img = document.createElement("img");
      img.src = safeUrl(p.thumbUrl || p.imageUrl);
      img.width = 60;
      img.style.verticalAlign = "middle";
      row.appendChild(img);

            const pct = discountPercent(p);
      const label = document.createElement("span");
      label.textContent = " " + p.name + " | " + p.type + " | " + formatPrice(p.price) +
        (pct > 0 ? " (sale " + formatPrice(p.salePrice) + ", -" + pct + "%)" : "") +
        (isActive ? "" : " | HIDDEN") + " ";
      row.appendChild(label);

      const edit = document.createElement("button");
      edit.textContent = "Edit";
      edit.onclick = function () { startEdit(doc.id, p); };
      row.appendChild(edit);

      const toggle = document.createElement("button");
      toggle.textContent = isActive ? "Hide" : "Show";
      toggle.onclick = async function () {
        await doc.ref.update({ active: !isActive });
        loadProducts();
      };
      row.appendChild(toggle);

      const del = document.createElement("button");
      del.textContent = "Delete";
      del.onclick = async function () {
        if (confirm("Delete " + p.name + "? This cannot be undone.")) {
          await doc.ref.delete();
          loadProducts();
        }
      };
      row.appendChild(del);

      box.appendChild(row);
    });
  } catch (e) {
    box.textContent = "Could not load products.";
    console.error(e);
  }
}

function addLink(parent, label, url) {
  const link = safeUrl(url);
  if (!link) return;
  const a = document.createElement("a");
  a.href = link;
  a.target = "_blank";
  a.rel = "noopener noreferrer";
  a.textContent = label;
  a.style.marginRight = "12px";
  parent.appendChild(a);
}

function isOpen(status) {
  return status !== "done" && status !== "cancelled";
}

document.getElementById("orderFilter").addEventListener("change", renderOrders);

async function loadOrders() {
  const box = document.getElementById("orders");
  box.textContent = "Loading...";
  try {
    const snap = await db.collection("orders").orderBy("createdAt", "desc").get();
    ordersList = snap.docs.map(function (doc) {
      return { ref: doc.ref, data: doc.data() };
    });
    renderOrders();
  } catch (e) {
    box.textContent = "Could not load orders.";
    console.error(e);
  }
}

function renderOrders() {
  const box = document.getElementById("orders");
  const filter = document.getElementById("orderFilter").value;
  box.textContent = "";

  const shown = ordersList.filter(function (entry) {
    const s = entry.data.status;
    if (filter === "open") return isOpen(s);
    if (filter === "done") return s === "done";
    if (filter === "cancelled") return s === "cancelled";
    return true;
  });

  if (shown.length === 0) {
    box.textContent = "No orders here.";
    return;
  }

  shown.forEach(function (entry) {
    const o = entry.data;
    const items = o.items || [];
    const subtotal = o.subtotal != null
      ? o.subtotal
      : items.reduce(function (sum, i) { return sum + lineTotal(i); }, 0);
    const delivery = o.deliveryFee || 0;
    const total = o.total != null ? o.total : subtotal + delivery;
    const date = o.createdAt && o.createdAt.toDate
      ? o.createdAt.toDate().toLocaleString("en-GB")
      : "";

    const card = document.createElement("div");
    card.className = "order-card";

    const head = document.createElement("p");
    const title = document.createElement("b");
    title.textContent = (o.orderNo || "Order") + " - " + statusInfo(o.status).label;
    head.appendChild(title);
        const who = document.createElement("span");
    who.style.display = "block";
    const getWord = o.deliveryMethod === "pickup" ? "PICKUP" : "Delivery to " + (o.city || "") + ", " + o.address;
    who.textContent = date + " | " + o.name + " | " + o.phone + " | " + getWord;
    head.appendChild(who);
    card.appendChild(head);

    const pay = document.createElement("p");
    pay.appendChild(document.createTextNode(
      "Payment: " + (o.paymentMethod === "cod" ? "Cash on delivery" : "JazzCash / Bank") +
      (o.transactionId ? " | Txn ID: " + o.transactionId : "") + " "
    ));
    addLink(pay, "Payment screenshot", o.paymentProof);
    card.appendChild(pay);

    items.forEach(function (item) {
      const line = document.createElement("div");
      line.className = "order-item";

      const extra = [];
      if (item.size) extra.push("Size " + item.size);
      if (item.color) extra.push(item.color);
      if (item.mode === "studio") extra.push("WE DESIGN IT (free)");
      if (item.mode === "self") extra.push("CUSTOMER DESIGNED (extra " + formatPrice(item.designFee || 0) + ")");

      const t = document.createElement("b");
      t.textContent = clampQty(item.qty) + " x " + (item.name || "item") + " - " +
        formatPrice(lineTotal(item)) + (extra.length ? " | " + extra.join(" | ") : "");
      line.appendChild(t);

      if (item.notes) {
        const n = document.createElement("div");
        n.textContent = "Notes: " + item.notes;
        line.appendChild(n);
      }

      const links = document.createElement("div");
      if (item.mode === "self") addLink(links, "Preview", item.previewUrl);
      const urls = item.designUrls || (item.designUrl ? [item.designUrl] : []);
      urls.forEach(function (url, i) { addLink(links, "Photo " + (i + 1), url); });
      line.appendChild(links);

      card.appendChild(line);
    });

        const sums = document.createElement("p");
    sums.textContent = "Items " + formatPrice(subtotal) + " + Delivery " +
      (delivery === 0 ? "Free" : formatPrice(delivery)) + " = Total " + formatPrice(total);
    sums.style.fontWeight = "700";
    card.appendChild(sums);

    if (o.advanceAmount > 0 && o.advanceAmount < total) {
      const adv = document.createElement("p");
      adv.textContent = "Advance paid: " + formatPrice(o.advanceAmount) + " (" + (o.advancePercent || 0) +
        "%) | Remaining on delivery: " + formatPrice(o.remainingAmount || (total - o.advanceAmount));
      card.appendChild(adv);
    } else if (o.paymentMethod === "manual" && o.advanceAmount) {
      const adv = document.createElement("p");
      adv.textContent = "Paid in full: " + formatPrice(o.advanceAmount);
      card.appendChild(adv);
    }

    const select = document.createElement("select");
    ORDER_STATUSES.forEach(function (s) {
      const opt = document.createElement("option");
      opt.value = s.value;
      opt.textContent = s.label;
      select.appendChild(opt);
    });
    select.value = o.status;
    card.appendChild(select);

    const save = document.createElement("button");
    save.textContent = "Save stage";
    save.onclick = async function () {
      save.disabled = true;
      try {
        await entry.ref.update({ status: select.value });
        loadOrders();
      } catch (e) {
        alert("Could not save. Please try again.");
        console.error(e);
        save.disabled = false;
      }
    };
    card.appendChild(save);

    const number = phoneToWa(o.phone);
    if (number) {
      const wa = document.createElement("a");
      wa.href = waLink(number, "Hello " + o.name + ", update on your order " + (o.orderNo || "") +
        ": " + statusInfo(select.value).customer + ".");
      wa.target = "_blank";
      wa.rel = "noopener noreferrer";
      wa.className = "customize-btn";
      wa.textContent = "WhatsApp customer";
      card.appendChild(wa);
      select.addEventListener("change", function () {
        wa.href = waLink(number, "Hello " + o.name + ", update on your order " + (o.orderNo || "") +
          ": " + statusInfo(select.value).customer + ".");
      });
    }

    const del = document.createElement("button");
    del.textContent = "Delete order";
    del.onclick = async function () {
      if (confirm("Delete this order? This cannot be undone.")) {
        await entry.ref.delete();
        loadOrders();
      }
    };
    card.appendChild(del);

    box.appendChild(card);
  });
}

// =====================================================================
//  STORE SETTINGS
// =====================================================================
const settingsMsg = document.getElementById("settingsMsg");

async function loadSettingsForm() {
  await SHOP_READY;
  document.getElementById("sName").value = SHOP.name || "";
  document.getElementById("sPhone").value = SHOP.phoneText || "";
  document.getElementById("sWhatsapp").value = SHOP.whatsapp || "";
  document.getElementById("sEmail").value = SHOP.email || "";
  document.getElementById("sAddress").value = SHOP.address || "";
  document.getElementById("sHours").value = SHOP.hours || "";
  document.getElementById("sFacebook").value = SHOP.facebook || "";
  document.getElementById("sInstagram").value = SHOP.instagram || "";
  document.getElementById("sTiktok").value = SHOP.tiktok || "";

  const jc = SHOP.jazzcash || {};
  document.getElementById("sJazzcashNumber").value = jc.number || "";
  document.getElementById("sJazzcashName").value = jc.name || "";
  const bank = SHOP.bank || {};
  document.getElementById("sBankName").value = bank.bankName || "";
  document.getElementById("sBankTitle").value = bank.accountTitle || "";
  document.getElementById("sBankIban").value = bank.iban || "";

   document.getElementById("sCodEnabled").checked = SHOP.codEnabled !== false;
  document.getElementById("sPickupEnabled").checked = SHOP.pickupEnabled !== false;
  document.getElementById("sAdvancePercent").value = SHOP.advancePercent || 0;
  document.getElementById("sSelfDesignFee").value = SHOP.selfDesignFee || 0;

  document.getElementById("sDeliveryFee").value = SHOP.deliveryFee || 0;
  document.getElementById("sFreeDeliveryAbove").value = SHOP.freeDeliveryAbove || 0;
  document.getElementById("sDeliveryTime").value = SHOP.deliveryTime || "";
  document.getElementById("sCodNote").value = SHOP.codNote || "";

  const ann = SHOP.announcement || {};
  document.getElementById("sAnnounceEnabled").checked = !!ann.enabled;
  document.getElementById("sAnnounceText").value = ann.text || "";
  document.getElementById("sAnnounceLink").value = ann.link || "";

  fillThemeInputs(SHOP.theme || {});
}

function fillThemeInputs(theme) {
  const defaults = DEFAULT_SHOP.theme;
  document.getElementById("cInk").value = theme.ink || defaults.ink;
  document.getElementById("cPaper").value = theme.paper || defaults.paper;
  document.getElementById("cCyan").value = theme.cyan || defaults.cyan;
  document.getElementById("cMagenta").value = theme.magenta || defaults.magenta;
  document.getElementById("cYellow").value = theme.yellow || defaults.yellow;
  document.getElementById("cButter").value = theme.butter || defaults.butter;
}

document.getElementById("resetThemeBtn").addEventListener("click", function () {
  fillThemeInputs({});
});

document.getElementById("saveSettingsBtn").addEventListener("click", async function () {
  const btn = document.getElementById("saveSettingsBtn");
  btn.disabled = true;
  settingsMsg.textContent = "Saving...";

  try {
    const data = {
      name: document.getElementById("sName").value.trim() || DEFAULT_SHOP.name,
      phoneText: document.getElementById("sPhone").value.trim(),
      whatsapp: document.getElementById("sWhatsapp").value.trim(),
      email: document.getElementById("sEmail").value.trim(),
      address: document.getElementById("sAddress").value.trim(),
      hours: document.getElementById("sHours").value.trim(),
      facebook: document.getElementById("sFacebook").value.trim(),
      instagram: document.getElementById("sInstagram").value.trim(),
      tiktok: document.getElementById("sTiktok").value.trim(),

      jazzcash: {
        number: document.getElementById("sJazzcashNumber").value.trim(),
        name: document.getElementById("sJazzcashName").value.trim()
      },
      bank: {
        bankName: document.getElementById("sBankName").value.trim(),
        accountTitle: document.getElementById("sBankTitle").value.trim(),
        iban: document.getElementById("sBankIban").value.trim()
      },

            codEnabled: document.getElementById("sCodEnabled").checked,
      pickupEnabled: document.getElementById("sPickupEnabled").checked,
      advancePercent: Math.max(0, Math.min(100, Number(document.getElementById("sAdvancePercent").value) || 0)),
      selfDesignFee: Math.max(0, Number(document.getElementById("sSelfDesignFee").value) || 0),

      deliveryFee: Math.max(0, Number(document.getElementById("sDeliveryFee").value) || 0),
      freeDeliveryAbove: Math.max(0, Number(document.getElementById("sFreeDeliveryAbove").value) || 0),
      deliveryTime: document.getElementById("sDeliveryTime").value.trim(),
      codNote: document.getElementById("sCodNote").value.trim(),

      announcement: {
        enabled: document.getElementById("sAnnounceEnabled").checked,
        text: document.getElementById("sAnnounceText").value.trim(),
        link: document.getElementById("sAnnounceLink").value.trim()
      },

      theme: {
        ink: document.getElementById("cInk").value,
        paper: document.getElementById("cPaper").value,
        cyan: document.getElementById("cCyan").value,
        magenta: document.getElementById("cMagenta").value,
        yellow: document.getElementById("cYellow").value,
        butter: document.getElementById("cButter").value
      },

      updatedAt: firebase.firestore.FieldValue.serverTimestamp()
    };

    await db.collection("settings").doc("shop").set(data);

    Object.assign(SHOP, data);
    SHOP.adminEmail = DEFAULT_SHOP.adminEmail;
    applyTheme();

    settingsMsg.textContent = "Settings saved.";
  } catch (e) {
    settingsMsg.textContent = "Could not save settings. Please try again.";
    console.error(e);
  } finally {
    btn.disabled = false;
  }
});

// =====================================================================
//  REVIEWS
// =====================================================================
let reviewsList = [];

function starsText(rating) {
  const r = Math.max(1, Math.min(5, Math.round(Number(rating) || 0)));
  return "\u2605".repeat(r) + "\u2606".repeat(5 - r);
}

document.getElementById("reviewFilter").addEventListener("change", renderReviewsAdmin);

async function loadReviewsAdmin() {
  const box = document.getElementById("reviewsAdmin");
  box.textContent = "Loading...";
  try {
    const snap = await db.collection("reviews").orderBy("createdAt", "desc").get();
    reviewsList = snap.docs.map(function (doc) { return { ref: doc.ref, data: doc.data() }; });
    renderReviewsAdmin();
  } catch (e) {
    box.textContent = "Could not load reviews.";
    console.error(e);
  }
}

function renderReviewsAdmin() {
  const box = document.getElementById("reviewsAdmin");
  const filter = document.getElementById("reviewFilter").value;
  box.textContent = "";

  const shown = reviewsList.filter(function (entry) {
    if (filter === "pending") return entry.data.approved !== true;
    if (filter === "approved") return entry.data.approved === true;
    return true;
  });

  if (shown.length === 0) {
    box.textContent = "No reviews here.";
    return;
  }

  shown.forEach(function (entry) {
    const r = entry.data;
    const date = r.createdAt && r.createdAt.toDate ? r.createdAt.toDate().toLocaleString("en-GB") : "";

    const card = document.createElement("div");
    card.className = "review-card";

    const head = document.createElement("p");
    const b = document.createElement("b");
    b.textContent = starsText(r.rating) + " " + (r.name || "Customer") + " - " + (r.productName || "Unknown product");
    head.appendChild(b);
    const small = document.createElement("small");
    small.style.display = "block";
    small.textContent = date + " - " + (r.approved ? "Approved" : "Waiting for approval");
    head.appendChild(small);
    card.appendChild(head);

    if (r.comment) {
      const comment = document.createElement("p");
      comment.textContent = r.comment;
      card.appendChild(comment);
    }

    if (!r.approved) {
      const approve = document.createElement("button");
      approve.textContent = "Approve";
      approve.onclick = async function () {
        await entry.ref.update({ approved: true });
        loadReviewsAdmin();
      };
      card.appendChild(approve);
    }

    const del = document.createElement("button");
    del.textContent = "Delete";
    del.onclick = async function () {
      if (confirm("Delete this review?")) {
        await entry.ref.delete();
        loadReviewsAdmin();
      }
    };
    card.appendChild(del);

    box.appendChild(card);
  });
}