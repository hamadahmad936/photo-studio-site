const itemsBox = document.getElementById("cartItems");
const summaryBox = document.getElementById("summaryBox");
const checkoutBox = document.getElementById("checkoutBox");
const confirmBox = document.getElementById("confirmBox");
const pickupOption = document.getElementById("pickupOption");
const deliveryFields = document.getElementById("deliveryFields");
const pickupInfo = document.getElementById("pickupInfo");
const codOption = document.getElementById("codOption");
const codLabelText = document.getElementById("codLabelText");
const manualBox = document.getElementById("manualBox");
const codBox = document.getElementById("codBox");
const codAdvanceBox = document.getElementById("codAdvanceBox");
const payAmount = document.getElementById("payAmount");
const payDetails = document.getElementById("payDetails");
const advancePayDetails = document.getElementById("advancePayDetails");
const orderMsg = document.getElementById("orderMsg");
const placeBtn = document.getElementById("placeOrder");

function fillPayDetailsBox(box) {
  box.textContent = "";
  const lines = [];
  const jc = SHOP.jazzcash || {};
  if (jc.number) lines.push("JazzCash: " + jc.number + (jc.name ? " (" + jc.name + ")" : ""));
  const bank = SHOP.bank || {};
  if (bank.iban) {
    const parts = [bank.bankName, bank.accountTitle, "IBAN " + bank.iban].filter(function (x) { return x; });
    lines.push("Bank: " + parts.join(", "));
  }
  lines.forEach(function (text) {
    const p = document.createElement("p");
    p.textContent = text;
    box.appendChild(p);
  });
}

// ===== DELIVERY METHOD (Home Delivery vs Store Pickup) =====
function getDeliveryMethod() {
  if (SHOP.pickupEnabled === false) return "delivery";
  const checked = document.querySelector('input[name="getOrder"]:checked');
  return checked ? checked.value : "delivery";
}

function currentDeliveryFee(subtotal) {
  return getDeliveryMethod() === "pickup" ? 0 : deliveryFeeFor(subtotal);
}

function applyDeliveryMethodUI() {
  if (SHOP.pickupEnabled === false) {
    pickupOption.style.display = "none";
    document.querySelector('input[name="getOrder"][value="delivery"]').checked = true;
  } else {
    pickupOption.style.display = "block";
  }

  const isPickup = getDeliveryMethod() === "pickup";
  deliveryFields.style.display = isPickup ? "none" : "block";
  pickupInfo.style.display = isPickup ? "block" : "none";
  codLabelText.textContent = isPickup ? "Pay Cash at Pickup" : "Cash on Delivery";
  updateSummary();
}

document.querySelectorAll('input[name="getOrder"]').forEach(function (r) {
  r.addEventListener("change", applyDeliveryMethodUI);
});

// ===== PAYMENT METHOD =====
function applyPaymentSettings() {
  if (!SHOP.codEnabled) {
    codOption.style.display = "none";
    const codRadio = document.querySelector('input[name="pay"][value="cod"]');
    if (codRadio && codRadio.checked) {
      document.querySelector('input[name="pay"][value="manual"]').checked = true;
    }
  } else {
    codOption.style.display = "block";
  }
  fillPayDetailsBox(payDetails);
  fillPayDetailsBox(advancePayDetails);
  updateAdvanceBox();
}

function itemLines(item) {
  const parts = [];
  if (item.size) parts.push("Size: " + item.size);
  if (item.color) parts.push("Color: " + item.color);
  if (item.mode === "studio") parts.push("We design it for you (free)");
  if (item.mode === "self") parts.push("You designed it (design fee " + formatPrice(item.designFee || 0) + " included)");
  return parts.join(" | ");
}

function renderCart() {
  const cart = getCart();
  itemsBox.textContent = "";

  if (cart.length === 0) {
    itemsBox.textContent = "Your cart is empty.";
    summaryBox.style.display = "none";
    checkoutBox.style.display = "none";
    return;
  }

  summaryBox.style.display = "block";
  checkoutBox.style.display = "block";

  cart.forEach(function (item, index) {
    const row = document.createElement("div");

    const url = safeUrl(item.previewUrl);
    if (url) {
      const img = document.createElement("img");
      img.src = url;
      img.alt = "";
      img.width = 100;
      row.appendChild(img);
    }

    const text = document.createElement("span");
    text.textContent = (item.name || "Item") + " - " + formatPrice(item.price || 0) + " each";
    const details = itemLines(item);
    if (details) {
      const small = document.createElement("small");
      small.style.display = "block";
      small.textContent = details;
      text.appendChild(small);
    }
    row.appendChild(text);

    const qty = document.createElement("span");
    qty.className = "qty";
    const minus = document.createElement("button");
    minus.textContent = "-";
    minus.setAttribute("aria-label", "Less");
    minus.onclick = function () {
      setQty(index, clampQty(item.qty) - 1);
      renderCart();
    };
    const number = document.createElement("b");
    number.textContent = " " + clampQty(item.qty) + " ";
    const plus = document.createElement("button");
    plus.textContent = "+";
    plus.setAttribute("aria-label", "More");
    plus.onclick = function () {
      setQty(index, clampQty(item.qty) + 1);
      renderCart();
    };
    qty.appendChild(minus);
    qty.appendChild(number);
    qty.appendChild(plus);
    row.appendChild(qty);

    const line = document.createElement("span");
    line.className = "line-total";
    line.textContent = formatPrice(lineTotal(item));
    row.appendChild(line);

    if (item.notes) {
      const notes = document.createElement("div");
      notes.textContent = "Your notes: " + item.notes;
      row.appendChild(notes);
    }

    const rm = document.createElement("button");
    rm.textContent = "Remove";
    rm.onclick = function () {
      removeFromCart(index);
      renderCart();
    };
    row.appendChild(rm);

    itemsBox.appendChild(row);
  });

  updateSummary();
}

function updateSummary() {
  const sub = cartSubtotal();
  const fee = currentDeliveryFee(sub);
  const total = sub + fee;
  const isPickup = getDeliveryMethod() === "pickup";

  document.getElementById("sumItems").textContent = formatPrice(sub);
  document.getElementById("sumDelivery").textContent = isPickup ? "Free (pickup)" : (fee === 0 ? "Free" : formatPrice(fee));
  document.getElementById("sumTotal").textContent = formatPrice(total);
  payAmount.textContent = formatPrice(total);

  const hint = document.getElementById("freeHint");
  if (!isPickup && fee > 0 && SHOP.freeDeliveryAbove > 0) {
    hint.textContent = "(Add " + formatPrice(SHOP.freeDeliveryAbove - sub) + " more for free delivery)";
  } else {
    hint.textContent = "";
  }
  updateAdvanceBox();
}

// ===== ADVANCE PAYMENT FOR COD / PAY-AT-PICKUP ORDERS =====
function currentAdvance() {
  const sub = cartSubtotal();
  const total = sub + currentDeliveryFee(sub);
  const percent = Number(SHOP.advancePercent || 0);
  const advance = Math.round(total * percent / 100);
  return { total: total, percent: percent, advance: advance, remaining: total - advance };
}

function updateAdvanceBox() {
  const info = currentAdvance();
  if (getMethod() === "cod" && info.percent > 0 && info.advance > 0) {
    codAdvanceBox.style.display = "block";
    document.getElementById("advanceAmountText").textContent = formatPrice(info.advance) + " (" + info.percent + "%)";
    document.getElementById("remainingAmountText").textContent = formatPrice(info.remaining);
  } else {
    codAdvanceBox.style.display = "none";
  }
}

function getMethod() {
  const checked = document.querySelector('input[name="pay"]:checked');
  return checked ? checked.value : "manual";
}

document.querySelectorAll('input[name="pay"]').forEach(function (r) {
  r.addEventListener("change", function () {
    manualBox.style.display = getMethod() === "manual" ? "block" : "none";
    codBox.style.display = getMethod() === "cod" ? "block" : "none";
    updateAdvanceBox();
  });
});

function makeOrderNo() {
  const time = (Date.now() % 1679616).toString(36).toUpperCase().padStart(4, "0");
  const rand = Math.random().toString(36).slice(2, 4).toUpperCase().padEnd(2, "X");
  return "ORD-" + time + rand;
}

function buildWhatsAppText(order) {
  const lines = [];
  lines.push("Hello " + SHOP.name + ", I placed order " + order.orderNo + ".");
  lines.push("Name: " + order.name);
  lines.push("Phone: " + order.phone);
  if (order.deliveryMethod === "pickup") {
    lines.push("Getting order: I will pick it up myself");
  } else {
    lines.push("City: " + order.city);
  }
  lines.push("");
  lines.push("Items:");
  order.items.forEach(function (item, i) {
    const extra = [];
    if (item.size) extra.push("size " + item.size);
    if (item.color) extra.push(item.color);
    lines.push((i + 1) + ". " + (item.name || "Item") + " x" + clampQty(item.qty) +
      (extra.length ? " (" + extra.join(", ") + ")" : "") + " - " + formatPrice(lineTotal(item)));
  });
  lines.push("");
  lines.push("Delivery: " + (order.deliveryMethod === "pickup" ? "Store pickup (free)" : (order.deliveryFee === 0 ? "Free" : formatPrice(order.deliveryFee))));
  lines.push("Total: " + formatPrice(order.total));
  if (order.paymentMethod === "manual") {
    lines.push("Payment: JazzCash / Bank (paid in full), Transaction ID " + order.transactionId);
  } else if (order.advanceAmount > 0) {
    const payWord = order.deliveryMethod === "pickup" ? "at pickup" : "on delivery";
    lines.push("Payment: Cash " + payWord + " with an advance of " + formatPrice(order.advanceAmount) +
      " (Transaction ID " + order.transactionId + "), remaining " + formatPrice(order.remainingAmount) + " " + payWord + ".");
  } else {
    lines.push("Payment: Cash " + (order.deliveryMethod === "pickup" ? "at pickup" : "on delivery"));
  }
  return lines.join("\n");
}

placeBtn.addEventListener("click", async function () {
  const name = document.getElementById("custName").value.trim();
  const phone = document.getElementById("custPhone").value.trim();
  const deliveryMethod = getDeliveryMethod();
  const isPickup = deliveryMethod === "pickup";
  const city = isPickup ? "Pickup" : document.getElementById("custCity").value.trim();
  const address = isPickup ? "Customer will pick up in person" : document.getElementById("custAddress").value.trim();
  const proofFile = document.getElementById("proofFile").files[0];
  const method = getMethod();
  const info = currentAdvance();

  const needsAdvance = method === "cod" && info.percent > 0 && info.advance > 0;
  const txnId = method === "manual"
    ? document.getElementById("txnId").value.trim()
    : (needsAdvance ? document.getElementById("codTxnId").value.trim() : "");

  if (!name || !phone) {
    orderMsg.textContent = "Please fill your name and phone.";
    return;
  }
  if (!isPickup && (!city || !address)) {
    orderMsg.textContent = "Please fill your city and address, or choose pickup instead.";
    return;
  }
  if (phone.replace(/\D/g, "").length < 10) {
    orderMsg.textContent = "Please enter a correct phone number.";
    return;
  }
  if ((method === "manual" || needsAdvance) && !txnId) {
    orderMsg.textContent = needsAdvance
      ? "Please send the advance payment first, then type your Transaction ID."
      : "Please send the money first, then type your Transaction ID.";
    return;
  }
  if (!document.getElementById("agreeBox").checked) {
    orderMsg.textContent = "Please tick the box to agree to our policies.";
    return;
  }

  const cart = getCart();
  if (cart.length === 0) {
    orderMsg.textContent = "Your cart is empty.";
    return;
  }

  placeBtn.disabled = true;
  orderMsg.textContent = "Placing your order...";

  try {
    let paymentProof = "";
    if (method === "manual" && proofFile) {
      orderMsg.textContent = "Uploading your payment screenshot...";
      paymentProof = await uploadToImgBB(proofFile);
    }

    const subtotal = cartSubtotal();
    const deliveryFee = currentDeliveryFee(subtotal);
    const total = subtotal + deliveryFee;
    const user = auth.currentUser;

    const advancePercent = method === "manual" ? 100 : (needsAdvance ? info.percent : 0);
    const advanceAmount = method === "manual" ? total : (needsAdvance ? info.advance : 0);
    const remainingAmount = total - advanceAmount;

    const order = {
      orderNo: makeOrderNo(),
      name: name,
      phone: phone,
      city: city,
      address: address,
      deliveryMethod: deliveryMethod,
      items: cart,
      subtotal: subtotal,
      deliveryFee: deliveryFee,
      total: total,
      paymentMethod: method,
      transactionId: txnId,
      paymentProof: paymentProof,
      advancePercent: advancePercent,
      advanceAmount: advanceAmount,
      remainingAmount: remainingAmount,
      status: (method === "manual" || needsAdvance) ? "pending" : "COD",
      userId: user ? user.uid : null,
      email: user ? user.email : "",
      createdAt: firebase.firestore.FieldValue.serverTimestamp()
    };

    orderMsg.textContent = "Placing your order...";
    await db.collection("orders").add(order);

    document.getElementById("confirmNo").textContent = order.orderNo;
    const waBtn = document.getElementById("confirmWa");
    if (hasWhatsApp()) {
      waBtn.href = waLink(SHOP.whatsapp, buildWhatsAppText(order));
      waBtn.style.display = "inline-block";
      document.getElementById("confirmText").textContent =
        "Please send your order details on WhatsApp so we can start quickly. Save your order number: " +
        "you will need it if you contact us." +
        (user ? " You can also follow your order in Account, My orders." : "");
    } else {
      waBtn.style.display = "none";
      document.getElementById("confirmText").textContent =
        "We will contact you soon on the phone number you gave. Save your order number." +
        (user ? " You can also follow your order in Account, My orders." : "");
    }

    clearCart();
    itemsBox.style.display = "none";
    summaryBox.style.display = "none";
    checkoutBox.style.display = "none";
    confirmBox.style.display = "block";
    window.scrollTo(0, 0);
  } catch (e) {
    orderMsg.textContent = e && e.message && e.message.indexOf("Upload") === 0
      ? e.message
      : "Something went wrong. Please try again.";
    console.error(e);
  } finally {
    placeBtn.disabled = false;
  }
});

SHOP_READY.then(function () {
  applyPaymentSettings();
  applyDeliveryMethodUI();
  renderCart();
});