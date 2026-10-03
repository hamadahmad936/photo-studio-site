const params = new URLSearchParams(window.location.search);
const productId = params.get("id");
let currentProduct = null;
const box = document.getElementById("detailBox");
const stickyBar = document.getElementById("stickyBar");
const stickyInfo = document.getElementById("stickyInfo");
const stickyBtn = document.getElementById("stickyBtn");

function row(label, list) {
  if (!Array.isArray(list) || list.length === 0) return null;
  const p = document.createElement("p");
  const b = document.createElement("b");
  b.textContent = label + ": ";
  p.appendChild(b);
  p.appendChild(document.createTextNode(list.join(", ")));
  return p;
}

async function loadDetail() {
  if (!productId) {
    box.textContent = "No product selected. Go back to the home page.";
    return;
  }
  try {
    const doc = await db.collection("products").doc(productId).get();
    if (!doc.exists || doc.data().active === false) {
      box.textContent = "This product is not available. Please go back to the home page.";
      return;
    }
        const p = doc.data();
    currentProduct = p;
    box.textContent = "";

    const wrap = document.createElement("div");
    wrap.className = "detail-wrap";

        const photoBox = document.createElement("div");
    photoBox.className = "detail-photo-box";

    const img = document.createElement("img");
    img.className = "detail-photo";
    img.src = p.imageUrl;
    img.alt = p.name;
    photoBox.appendChild(img);

    const allPhotos = [p.imageUrl].concat(Array.isArray(p.galleryUrls) ? p.galleryUrls : []);
    if (allPhotos.length > 1) {
      const thumbs = document.createElement("div");
      thumbs.className = "detail-thumbs";
      allPhotos.forEach(function (url, i) {
        const t = document.createElement("img");
        t.src = url;
        t.alt = p.name + " photo " + (i + 1);
        if (i === 0) t.className = "active";
        t.onclick = function () {
          img.src = url;
          thumbs.querySelectorAll("img").forEach(function (x) { x.className = ""; });
          t.className = "active";
        };
        thumbs.appendChild(t);
      });
      photoBox.appendChild(thumbs);
    }

    wrap.appendChild(photoBox);
    revealOnScroll(photoBox);

    const info = document.createElement("div");
    info.className = "detail-info";

    const h2 = document.createElement("h2");
    h2.textContent = p.name;
    info.appendChild(h2);

      const price = document.createElement("p");
    price.id = "detailPrice";
    const pct = discountPercent(p);
    if (pct > 0) {
      const was = document.createElement("s");
      was.textContent = formatPrice(p.price);
      was.style.marginRight = "8px";
      price.appendChild(was);
      price.appendChild(document.createTextNode(formatPrice(effectivePrice(p))));
      const badge = document.createElement("span");
      badge.className = "sale-badge sale-badge-inline";
      badge.textContent = "-" + pct + "%";
      price.appendChild(badge);
    } else {
      price.textContent = formatPrice(p.price);
    }
    info.appendChild(price);

    if (p.description) {
      const desc = document.createElement("p");
      desc.textContent = p.description;
      info.appendChild(desc);
    }

    const sizeRow = row("Available sizes", p.sizes);
    if (sizeRow) info.appendChild(sizeRow);
    const colorRow = row("Available colors", p.colors);
    if (colorRow) info.appendChild(colorRow);

    const bigBtn = document.createElement("a");
    bigBtn.className = "customize-btn";
    bigBtn.id = "bigCustomizeBtn";
    bigBtn.href = "product.html?id=" + encodeURIComponent(productId);
    bigBtn.textContent = "Customize this product";
    info.appendChild(bigBtn);

    wrap.appendChild(info);
    revealOnScroll(info);
    box.appendChild(wrap);

    if (p.guideFile) {
      const sample = document.createElement("div");
      sample.className = "sample-box";
      const h3 = document.createElement("h3");
      h3.textContent = "Where your design will be printed";
      sample.appendChild(h3);
      const sImg = document.createElement("img");
      sImg.src = "assets/templates/" + p.guideFile;
      sImg.alt = "Print area sample";
      sample.appendChild(sImg);
      box.appendChild(sample);
      revealOnScroll(sample);
    }

     stickyInfo.textContent = p.name + " - " + formatPrice(effectivePrice(p));
    stickyBtn.href = "product.html?id=" + encodeURIComponent(productId);
    stickyBar.style.display = "flex";
  } catch (e) {
    box.textContent = "Could not load this product. Please refresh the page.";
    console.error(e);
  }
}

// ===== REVIEWS =====
function starsText(rating) {
  const r = Math.max(1, Math.min(5, Math.round(Number(rating) || 0)));
  return "\u2605".repeat(r) + "\u2606".repeat(5 - r);
}

async function loadReviews() {
  const summaryBox = document.getElementById("reviewSummary");
  const listBox = document.getElementById("reviewList");
  if (!productId) {
    summaryBox.textContent = "";
    return;
  }
  try {
    const snap = await db.collection("reviews")
      .where("productId", "==", productId)
      .where("approved", "==", true)
      .get();

    const reviews = snap.docs.map(function (d) { return d.data(); });
    reviews.sort(function (a, b) {
      const at = a.createdAt && a.createdAt.toMillis ? a.createdAt.toMillis() : 0;
      const bt = b.createdAt && b.createdAt.toMillis ? b.createdAt.toMillis() : 0;
      return bt - at;
    });

    if (reviews.length === 0) {
      summaryBox.textContent = "No reviews yet. Be the first to write one!";
      listBox.textContent = "";
      return;
    }

    const avg = reviews.reduce(function (sum, r) { return sum + Number(r.rating || 0); }, 0) / reviews.length;
    summaryBox.textContent = starsText(avg) + " " + avg.toFixed(1) + " out of 5 (" + reviews.length +
      (reviews.length === 1 ? " review)" : " reviews)");

    listBox.textContent = "";
    reviews.forEach(function (r) {
      const card = document.createElement("div");
      card.className = "review-card";

      const head = document.createElement("p");
      const stars = document.createElement("span");
      stars.className = "review-stars";
      stars.textContent = starsText(r.rating);
      head.appendChild(stars);
      head.appendChild(document.createTextNode(" " + (r.name || "Customer")));
      card.appendChild(head);

      if (r.comment) {
        const comment = document.createElement("p");
        comment.textContent = r.comment;
        card.appendChild(comment);
      }

      listBox.appendChild(card);
    });
  } catch (e) {
    summaryBox.textContent = "Could not load reviews right now.";
    console.error(e);
  }
}

document.getElementById("submitReviewBtn").addEventListener("click", async function () {
  const btn = this;
  const msgEl = document.getElementById("reviewMsg");
  const name = document.getElementById("revName").value.trim();
  const rating = Number(document.getElementById("revRating").value);
  const comment = document.getElementById("revComment").value.trim();

  if (!productId) {
    msgEl.textContent = "No product selected.";
    return;
  }
  if (!name) {
    msgEl.textContent = "Please tell us your name.";
    return;
  }
  if (!comment) {
    msgEl.textContent = "Please write a short comment.";
    return;
  }

  btn.disabled = true;
  msgEl.textContent = "Sending your review...";
  try {
    await db.collection("reviews").add({
      productId: productId,
      productName: (currentProduct && currentProduct.name) || "",
      name: name,
      rating: rating,
      comment: comment,
      approved: false,
      createdAt: firebase.firestore.FieldValue.serverTimestamp()
    });
    msgEl.textContent = "Thank you! Your review will appear here once we check it.";
    document.getElementById("revName").value = "";
    document.getElementById("revComment").value = "";
    document.getElementById("revRating").value = "5";
  } catch (e) {
    msgEl.textContent = "Could not send your review. Please try again.";
    console.error(e);
  } finally {
    btn.disabled = false;
  }
});

loadDetail();
loadReviews();
