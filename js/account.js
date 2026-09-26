const loggedOutBox = document.getElementById("loggedOut");
const loggedInBox = document.getElementById("loggedIn");
const authMsg = document.getElementById("authMsg");
const orderList = document.getElementById("orderList");

function readForm() {
  return {
    email: document.getElementById("email").value.trim(),
    password: document.getElementById("password").value
  };
}

document.getElementById("loginBtn").addEventListener("click", async function () {
  const f = readForm();
  authMsg.textContent = "";
  if (!f.email || !f.password) {
    authMsg.textContent = "Please type your email and password.";
    return;
  }
  try {
    await signIn(f.email, f.password);
  } catch (e) {
    authMsg.textContent = friendlyAuthError(e);
  }
});

document.getElementById("signupBtn").addEventListener("click", async function () {
  const f = readForm();
  authMsg.textContent = "";
  if (!f.email || !f.password) {
    authMsg.textContent = "Please type your email and choose a password.";
    return;
  }
  try {
    await signUp(f.email, f.password);
  } catch (e) {
    authMsg.textContent = friendlyAuthError(e);
  }
});

document.getElementById("resetBtn").addEventListener("click", async function () {
  const f = readForm();
  authMsg.textContent = "";
  if (!f.email) {
    authMsg.textContent = "Type your email in the email box first, then click 'Forgot password?'.";
    return;
  }
  try {
    await auth.sendPasswordResetEmail(f.email);
    authMsg.textContent = "If this email has an account, we sent a link to reset the password. Check your inbox and spam folder.";
  } catch (e) {
    authMsg.textContent = friendlyAuthError(e);
  }
});

document.getElementById("logoutBtn").addEventListener("click", function () {
  logOut();
});

auth.onAuthStateChanged(function (user) {
  if (user) {
    loggedOutBox.style.display = "none";
    loggedInBox.style.display = "block";
    document.getElementById("userEmail").textContent = user.email;
    document.getElementById("adminLink").style.display = isAdmin(user) ? "block" : "none";
    loadMyOrders(user);
  } else {
    loggedInBox.style.display = "none";
    loggedOutBox.style.display = "block";
    orderList.textContent = "";
  }
});

function methodText(method) {
  return method === "cod" ? "Cash on delivery" : "JazzCash / Bank";
}

function orderTime(o) {
  return o.createdAt && o.createdAt.toMillis ? o.createdAt.toMillis() : Date.now();
}

function itemText(item) {
  const extra = [];
  if (item.size) extra.push("size " + item.size);
  if (item.color) extra.push(item.color);
  if (item.mode === "studio") extra.push("we design it");
  if (item.mode === "self") extra.push("your own design");
  return "- " + (item.name || "Item") + " x" + clampQty(item.qty) +
    (extra.length ? " (" + extra.join(", ") + ")" : "");
}

async function loadMyOrders(user) {
  orderList.textContent = "Loading...";
  try {
    const snap = await db.collection("orders").where("userId", "==", user.uid).get();

    if (snap.empty) {
      orderList.textContent = "You have no orders yet.";
      return;
    }

    const orders = snap.docs.map(function (d) { return d.data(); });
    orders.sort(function (a, b) { return orderTime(b) - orderTime(a); });

    orderList.textContent = "";
    orders.forEach(function (o) {
      const items = o.items || [];
      const total = o.total != null
        ? o.total
        : items.reduce(function (sum, i) { return sum + lineTotal(i); }, 0);
      const date = o.createdAt && o.createdAt.toDate
        ? o.createdAt.toDate().toLocaleDateString("en-GB")
        : "Just now";

      const div = document.createElement("div");
      div.style.borderBottom = "1px solid #ccc";
      div.style.padding = "10px 0";

            const head = document.createElement("p");
      const b = document.createElement("b");
      b.textContent = (o.orderNo ? o.orderNo + " - " : "") + date + " - " + formatPrice(total);
      head.appendChild(b);
      head.appendChild(document.createTextNode(" - " + methodText(o.paymentMethod)));
      head.appendChild(document.createElement("br"));
      head.appendChild(document.createTextNode(
        o.deliveryMethod === "pickup" ? "Pickup from the shop" : "Delivered to your address"
      ));
      div.appendChild(head);

      const status = document.createElement("p");
      status.textContent = "Status: " + statusInfo(o.status).customer;
      div.appendChild(status);

      items.forEach(function (item) {
        const line = document.createElement("div");
        line.style.marginLeft = "15px";
        line.textContent = itemText(item);
        div.appendChild(line);
      });

      orderList.appendChild(div);
    });
  } catch (e) {
    orderList.textContent = "Could not load your orders. Please refresh the page.";
    console.error(e);
  }
}