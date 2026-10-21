// Edit these to rebrand the game for another restaurant.
const CONFIG = {
  restaurant: "Royal Arabian Restaurant, Sirkali",
  contactEmail: "hello@example.com",
  duration: 90,
  maxStrikes: 3,
};

const MENU = [
  { id: "cmandi", name: "Chicken Mandi", price: 280, emoji: "🍗" },
  { id: "mmandi", name: "Mutton Mandi", price: 420, emoji: "🍖" },
  { id: "shawarma", name: "Shawarma", price: 120, emoji: "🌯" },
  { id: "alfaham", name: "Alfaham", price: 260, emoji: "🔥" },
  { id: "platter", name: "Grill Platter", price: 550, emoji: "🍢" },
  { id: "hummus", name: "Hummus & Khubz", price: 150, emoji: "🫓" },
  { id: "kunafa", name: "Kunafa", price: 180, emoji: "🍮" },
  { id: "mint", name: "Lime Mint", price: 90, emoji: "🍹" },
];
const TABLES = ["T1", "T2", "T3", "T4", "T5", "T6", "T7", "T8"];
const RIDERS = ["Imran", "Karthik", "Salman", "Ravi"];
const NAMES = ["Arif", "Priya", "Fathima", "Vijay", "Ayesha", "Suresh", "Nisha", "Rahul", "Zainab", "Kumar"];
const STREETS = ["Main Rd", "Kovil St", "Bus Stand Rd", "Market St", "Railway Rd", "Gandhi Nagar", "Pidari St"];
const MODE_LABEL = { dine: "🍽️ Dine-in", take: "🥡 Takeaway", delivery: "🛵 Delivery" };

const $ = (id) => document.getElementById(id);
const pick = (arr) => arr[Math.floor(Math.random() * arr.length)];
const rand = (min, max) => min + Math.random() * (max - min);

let state;

function freshState() {
  return {
    running: false,
    timeLeft: CONFIG.duration,
    score: 0,
    combo: 1,
    served: 0,
    strikes: 0,
    wrong: 0,
    serveTimes: [],
    nextId: 101,
    nextToken: 1,
    tickets: [],
    activeId: null,
    mode: null,
    table: null,
    rider: null,
    cart: {},
    busyTables: {}, // table -> ms until free
    busyRiders: {}, // rider -> ms until back
    spawnIn: 800,
    lastTick: 0,
  };
}

// ---------- order generation ----------

function freeTables() {
  const claimed = new Set(state.tickets.filter((t) => t.type === "dine").map((t) => t.table));
  return TABLES.filter((t) => !state.busyTables[t] && !claimed.has(t));
}

function spawnTicket() {
  if (state.tickets.length >= 5) return;
  const elapsed = CONFIG.duration - state.timeLeft;
  let type = pick(["dine", "dine", "take", "delivery"]);
  const tables = freeTables();
  if (type === "dine" && !tables.length) type = "take";

  const items = {};
  const lines = elapsed > 40 ? Math.ceil(rand(1, 4)) : Math.ceil(rand(1, 3));
  while (Object.keys(items).length < lines) {
    items[pick(MENU).id] = Math.random() < 0.3 ? 2 : 1;
  }

  // customers get less patient as the rush builds
  const patience = Math.max(16, 32 - elapsed / 6) * 1000;
  const ticket = { id: state.nextId++, type, items, patience, left: patience, born: performance.now() };
  if (type === "dine") ticket.table = pick(tables);
  if (type === "take") ticket.name = pick(NAMES);
  if (type === "delivery") {
    ticket.name = pick(NAMES);
    ticket.address = `${Math.ceil(rand(1, 120))}, ${pick(STREETS)}`;
  }
  state.tickets.push(ticket);
  renderTickets();
}

// ---------- game loop ----------

function startGame() {
  state = freshState();
  state.running = true;
  state.lastTick = performance.now();
  $("overlay").classList.add("hidden");
  setFeedback("");
  renderAll();
  requestAnimationFrame(loop);
}

function loop(now) {
  if (!state.running) return;
  const dt = Math.min(now - state.lastTick, 250);
  state.lastTick = now;

  state.timeLeft -= dt / 1000;
  if (state.timeLeft <= 0) {
    state.timeLeft = 0;
    endGame("time");
    return;
  }

  for (const map of [state.busyTables, state.busyRiders]) {
    for (const key of Object.keys(map)) {
      map[key] -= dt;
      if (map[key] <= 0) {
        delete map[key];
        renderModePanel();
      }
    }
  }

  state.spawnIn -= dt;
  if (state.spawnIn <= 0) {
    spawnTicket();
    const elapsed = CONFIG.duration - state.timeLeft;
    state.spawnIn = rand(3500, 6000) - Math.min(elapsed * 30, 2200);
  }

  for (const t of [...state.tickets]) {
    t.left -= dt;
    if (t.left <= 0) customerLeft(t);
  }
  if (!state.running) return;

  updatePatienceBars();
  renderHud();
  requestAnimationFrame(loop);
}

function customerLeft(ticket) {
  state.tickets = state.tickets.filter((t) => t !== ticket);
  state.strikes++;
  state.combo = 1;
  state.score = Math.max(0, state.score - 50);
  if (state.activeId === ticket.id) resetWorking();
  setFeedback(`😠 Order #${ticket.id} waited too long and left. −50`, "bad");
  renderAll();
  if (state.strikes >= CONFIG.maxStrikes) endGame("strikes");
}

function endGame(reason) {
  state.running = false;
  renderHud();
  const avg = state.serveTimes.length
    ? (state.serveTimes.reduce((a, b) => a + b, 0) / state.serveTimes.length / 1000).toFixed(1)
    : "–";
  let best = 0;
  try {
    best = Number(localStorage.getItem("elaiBest") || 0);
    if (state.score > best) {
      localStorage.setItem("elaiBest", String(state.score));
    }
  } catch (e) { /* storage unavailable */ }
  const isBest = state.score > best;

  const rank =
    state.score >= 2500 ? ["🏆", "Rush Hour Hero"] :
    state.score >= 1400 ? ["⭐", "Floor Manager"] :
    state.score >= 600 ? ["👍", "Head Cashier"] : ["🧑‍🍳", "Trainee Cashier"];

  $("overlayCard").innerHTML = `
    <div class="badge">${rank[0]}</div>
    <h2>${rank[1]}</h2>
    <p>${reason === "strikes" ? "Three customers walked out. The rush got you this time!" : "Time's up! Service is closed."}</p>
    <div class="stats">
      <div><strong>${state.score}</strong><span>Score</span></div>
      <div><strong>${state.served}</strong><span>Orders served</span></div>
      <div><strong>${avg}s</strong><span>Avg per order</span></div>
    </div>
    <p class="best">${isBest ? "🎉 New personal best!" : best ? `Your best: ${best}` : ""}</p>
    <p>Real restaurants handle this every day. Elai POS makes it this simple.</p>
    <div class="overlay-actions">
      <button class="btn btn-gold" id="againBtn">Play again</button>
      <a class="btn btn-ghost" href="#contact">Book a free demo</a>
    </div>`;
  $("overlay").classList.remove("hidden");
  $("againBtn").onclick = startGame;
}

function showIntro() {
  $("overlayCard").innerHTML = `
    <div class="badge">🍽️</div>
    <h2>Rush Hour at ${CONFIG.restaurant.split(",")[0]}</h2>
    <ol>
      <li>Tap an <strong>order ticket</strong> on the left.</li>
      <li>Pick <strong>Dine-in</strong> (choose the table), <strong>Takeaway</strong>, or <strong>Delivery</strong> (assign a rider).</li>
      <li>Tap the <strong>menu items</strong> to match the order.</li>
      <li>Hit <strong>Send to kitchen</strong>. Faster orders score more points.</li>
    </ol>
    <p class="best">Let ${CONFIG.maxStrikes} customers wait too long and service ends.</p>
    <div class="overlay-actions"><button class="btn btn-gold" id="startBtn">Start the rush</button></div>`;
  $("startBtn").onclick = startGame;
}

// ---------- player actions ----------

function selectTicket(id) {
  if (!state.running) return;
  if (state.activeId !== id) {
    state.activeId = id;
    state.cart = {};
    state.mode = null;
    state.table = null;
    state.rider = null;
  }
  renderAll();
}

function setMode(mode) {
  if (!state.running) return;
  state.mode = mode;
  state.table = null;
  state.rider = null;
  renderAll();
}

function addItem(id, el) {
  if (!state.running) return;
  state.cart[id] = (state.cart[id] || 0) + 1;
  if (el) {
    el.classList.remove("bump");
    void el.offsetWidth;
    el.classList.add("bump");
  }
  renderMenu();
  renderCart();
}

function removeItem(id) {
  if (!state.cart[id]) return;
  state.cart[id]--;
  if (!state.cart[id]) delete state.cart[id];
  renderMenu();
  renderCart();
}

function resetWorking() {
  state.activeId = null;
  state.mode = null;
  state.table = null;
  state.rider = null;
  state.cart = {};
}

function sendOrder() {
  if (!state.running) return;
  const t = state.tickets.find((x) => x.id === state.activeId);
  if (!t) return setFeedback("Pick an order ticket first.", "bad");
  if (!state.mode) return setFeedback("Choose Dine-in, Takeaway or Delivery.", "bad");
  if (state.mode === "dine" && !state.table) return setFeedback("Choose a table for this dine-in order.", "bad");
  if (state.mode === "delivery" && !state.rider) return setFeedback("Assign a delivery rider.", "bad");
  if (!Object.keys(state.cart).length) return setFeedback("The bill is empty. Add items from the menu.", "bad");

  const problems = [];
  if (state.mode !== t.type) problems.push(`this is a ${MODE_LABEL[t.type]} order`);
  else if (t.type === "dine" && state.table !== t.table) problems.push(`the guest is at ${t.table}`);
  const ids = new Set([...Object.keys(t.items), ...Object.keys(state.cart)]);
  for (const id of ids) {
    if ((t.items[id] || 0) !== (state.cart[id] || 0)) {
      problems.push("the items don't match the ticket");
      break;
    }
  }

  if (problems.length) {
    state.wrong++;
    state.combo = 1;
    state.score = Math.max(0, state.score - 30);
    setFeedback(`✗ Not quite: ${problems.join(", and ")}. −30`, "bad");
    floatText("−30", "var(--bad)");
    renderHud();
    return;
  }

  const speed = t.left / t.patience;
  const itemCount = Object.values(t.items).reduce((a, b) => a + b, 0);
  const points = Math.round((100 + itemCount * 20 + speed * 80) * state.combo);
  state.score += points;
  state.served++;
  state.serveTimes.push(performance.now() - t.born);
  state.combo = Math.min(state.combo + 1, 5);

  let msg;
  if (t.type === "dine") {
    state.busyTables[t.table] = rand(12000, 20000);
    msg = `✓ KOT sent for ${t.table}!`;
  } else if (t.type === "take") {
    msg = `✓ Token #${state.nextToken++} ready for ${t.name}!`;
  } else {
    state.busyRiders[state.rider] = rand(10000, 16000);
    msg = `✓ ${state.rider} is out for delivery!`;
  }
  setFeedback(`${msg} +${points}${state.combo > 2 ? ` · combo x${state.combo - 1}` : ""}`, "ok");
  floatText(`+${points}`, "var(--ok)");

  state.tickets = state.tickets.filter((x) => x !== t);
  resetWorking();
  if (state.tickets.length === 0) state.spawnIn = Math.min(state.spawnIn, 900);
  renderAll();
}

// ---------- rendering ----------

function renderAll() {
  renderHud();
  renderTickets();
  renderModes();
  renderModePanel();
  renderMenu();
  renderCart();
}

function renderHud() {
  const time = Math.ceil(state.timeLeft);
  $("hudTime").textContent = time;
  $("hudTime").classList.toggle("low", time <= 10);
  $("hudScore").textContent = state.score;
  $("hudCombo").textContent = `x${state.combo}`;
  $("hudServed").textContent = state.served;
  $("hudStrikes").textContent = "●".repeat(state.strikes) + "○".repeat(Math.max(0, CONFIG.maxStrikes - state.strikes));
  $("hudStrikes").classList.toggle("low", state.strikes > 0);
}

function ticketSubtitle(t) {
  if (t.type === "dine") return `Table ${t.table}`;
  if (t.type === "take") return `Pickup · ${t.name}`;
  return `${t.name} · ${t.address}`;
}

function renderTickets() {
  const box = $("tickets");
  if (!state.tickets.length) {
    box.innerHTML = `<p class="empty">${state.running ? "Waiting for customers…" : "Orders will appear here"}</p>`;
    return;
  }
  box.innerHTML = state.tickets.map((t) => `
    <button class="ticket ${t.id === state.activeId ? "active" : ""}" data-id="${t.id}">
      <div class="ticket-head"><span>#${t.id}</span><span>${MODE_LABEL[t.type]}</span></div>
      <div class="ticket-sub">${ticketSubtitle(t)}</div>
      <ul>${Object.entries(t.items).map(([id, q]) => `<li>${q} × ${MENU.find((m) => m.id === id).name}</li>`).join("")}</ul>
      <div class="patience"><i style="width:${(t.left / t.patience) * 100}%"></i></div>
    </button>`).join("");
  box.querySelectorAll(".ticket").forEach((el) => {
    el.onclick = () => selectTicket(Number(el.dataset.id));
  });
}

function updatePatienceBars() {
  for (const t of state.tickets) {
    const el = document.querySelector(`.ticket[data-id="${t.id}"]`);
    if (!el) continue;
    const pct = (t.left / t.patience) * 100;
    el.querySelector(".patience i").style.width = `${pct}%`;
    el.classList.toggle("urgent", pct < 30);
  }
}

function renderModes() {
  document.querySelectorAll(".mode").forEach((b) => {
    b.classList.toggle("active", b.dataset.mode === state.mode);
  });
  const t = state.tickets.find((x) => x.id === state.activeId);
  const w = $("working");
  w.classList.toggle("idle", !t);
  w.textContent = t ? `Working on order #${t.id} · ${ticketSubtitle(t)}` : "No order selected. Tap a ticket";
}

function renderModePanel() {
  const panel = $("modePanel");
  if (state.mode === "dine") {
    panel.innerHTML = `<h3 class="panel-title">Choose table</h3><div class="choice-grid">${TABLES.map((tb) => {
      const busy = !!state.busyTables[tb];
      return `<button class="choice ${state.table === tb ? "selected" : ""}" data-table="${tb}" ${busy ? "disabled" : ""}>${tb}<small>${busy ? "Occupied" : "Free"}</small></button>`;
    }).join("")}</div>`;
    panel.querySelectorAll("[data-table]").forEach((b) => {
      b.onclick = () => { state.table = b.dataset.table; renderModePanel(); renderCart(); };
    });
  } else if (state.mode === "delivery") {
    panel.innerHTML = `<h3 class="panel-title">Assign rider</h3><div class="choice-grid">${RIDERS.map((r) => {
      const busy = !!state.busyRiders[r];
      return `<button class="choice ${state.rider === r ? "selected" : ""}" data-rider="${r}" ${busy ? "disabled" : ""}>🛵 ${r}<small>${busy ? "On a delivery" : "Available"}</small></button>`;
    }).join("")}</div>`;
    panel.querySelectorAll("[data-rider]").forEach((b) => {
      b.onclick = () => { state.rider = b.dataset.rider; renderModePanel(); renderCart(); };
    });
  } else if (state.mode === "take") {
    panel.innerHTML = `<h3 class="panel-title">Takeaway</h3><p class="panel-note">A pickup token is printed automatically when you send the order.</p>`;
  } else {
    panel.innerHTML = `<h3 class="panel-title">Order type</h3><p class="panel-note">Pick an order type above to continue.</p>`;
  }
}

function renderMenu() {
  $("menu").innerHTML = MENU.map((m) => `
    <button class="dish" data-id="${m.id}">
      ${state.cart[m.id] ? `<span class="qty">${state.cart[m.id]}</span>` : ""}
      <span class="emoji">${m.emoji}</span>
      <span class="name">${m.name}</span>
      <span class="price">₹${m.price}</span>
    </button>`).join("");
  $("menu").querySelectorAll(".dish").forEach((el) => {
    el.onclick = () => addItem(el.dataset.id, el);
  });
}

function renderCart() {
  const meta = [];
  if (state.mode) meta.push(MODE_LABEL[state.mode]);
  if (state.table) meta.push(state.table);
  if (state.rider) meta.push(`Rider: ${state.rider}`);
  $("cartMeta").textContent = meta.join(" · ");

  const entries = Object.entries(state.cart);
  $("cartItems").innerHTML = entries.length
    ? entries.map(([id, q]) => {
        const m = MENU.find((x) => x.id === id);
        return `<li><span class="line-name">${q} × ${m.name}</span><span>₹${m.price * q}</span><button data-remove="${id}" aria-label="Remove one ${m.name}">−</button></li>`;
      }).join("")
    : `<li class="empty">No items yet</li>`;
  $("cartItems").querySelectorAll("[data-remove]").forEach((b) => {
    b.onclick = () => removeItem(b.dataset.remove);
  });
  const total = entries.reduce((sum, [id, q]) => sum + MENU.find((x) => x.id === id).price * q, 0);
  $("cartTotal").textContent = `₹${total}`;
}

function setFeedback(text, kind) {
  const el = $("feedback");
  el.textContent = text;
  el.className = `feedback ${kind || ""}`;
}

function floatText(text, color) {
  const btn = $("sendBtn").getBoundingClientRect();
  const el = document.createElement("div");
  el.className = "float";
  el.textContent = text;
  el.style.color = color;
  el.style.left = `${btn.left + btn.width / 2 - 20}px`;
  el.style.top = `${btn.top - 10}px`;
  document.body.appendChild(el);
  setTimeout(() => el.remove(), 900);
}

// ---------- wiring ----------

document.querySelectorAll(".mode").forEach((b) => {
  b.onclick = () => setMode(b.dataset.mode);
});
$("sendBtn").onclick = sendOrder;
$("clearBtn").onclick = () => {
  if (!state.running) return;
  state.cart = {};
  renderMenu();
  renderCart();
  setFeedback("");
};
document.addEventListener("keydown", (e) => {
  if (!state.running || e.target.closest("input, textarea")) return;
  if (e.key === "1") setMode("dine");
  else if (e.key === "2") setMode("take");
  else if (e.key === "3") setMode("delivery");
  else if (e.key === "Enter") { e.preventDefault(); sendOrder(); }
});

$("restaurantName").textContent = CONFIG.restaurant;
$("contactBtn").href = `mailto:${CONFIG.contactEmail}?subject=${encodeURIComponent("Elai POS demo")}`;
$("year").textContent = new Date().getFullYear();

state = freshState();
renderAll();
showIntro();
