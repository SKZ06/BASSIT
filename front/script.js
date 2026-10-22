const API_URL = "http://localhost:3000/api";

const form = document.querySelector("#item-form");
const nameInput = document.querySelector("#item-name");
const descriptionInput = document.querySelector("#item-description");
const message = document.querySelector("#form-message");
const itemsElement = document.querySelector("#items");
const countElement = document.querySelector("#item-count");
const serverDot = document.querySelector("#server-dot");
const serverLabel = document.querySelector("#server-label");
const databaseDot = document.querySelector("#database-dot");
const databaseLabel = document.querySelector("#database-label");
const submitButton = form.querySelector("button[type='submit']");

function setStatus(dot, label, state, name) {
  dot.className = `status-dot ${state === "connected" ? "online" : state === "connecting" ? "connecting" : "offline"}`;
  label.textContent = `${name} ${state}`;
}

async function checkHealth() {
  try {
    const response = await fetch(`${API_URL}/health`);
    const health = await response.json();
    setStatus(serverDot, serverLabel, health.server, "Server");
    setStatus(databaseDot, databaseLabel, health.database, "Database");
    return health.database === "connected";
  } catch {
    setStatus(serverDot, serverLabel, "disconnected", "Server");
    setStatus(databaseDot, databaseLabel, "disconnected", "Database");
    return false;
  }
}

function showMessage(text, type = "") {
  message.textContent = text;
  message.className = `form-message ${type}`;
}

function makeCard(item) {
  const card = document.createElement("article");
  card.className = "item-card";

  const title = document.createElement("h3");
  title.textContent = item.name;
  card.append(title);

  if (item.description) {
    const description = document.createElement("p");
    description.textContent = item.description;
    card.append(description);
  }

  if (item.createdAt) {
    const date = document.createElement("time");
    date.className = "item-date";
    date.dateTime = item.createdAt;
    date.textContent = new Intl.DateTimeFormat(undefined, { dateStyle: "medium" }).format(new Date(item.createdAt));
    card.append(date);
  }

  return card;
}

async function loadItems() {
  itemsElement.innerHTML = '<p class="empty-state">Loading your collection…</p>';
  try {
    const response = await fetch(`${API_URL}/items`);
    if (!response.ok) throw new Error(response.status === 503 ? "The database is unavailable." : "Could not load your collection.");
    const items = await response.json();
    countElement.textContent = items.length;
    itemsElement.replaceChildren();

    if (items.length === 0) {
      itemsElement.innerHTML = '<p class="empty-state">Your collection is waiting for its first little thing.</p>';
      return;
    }
    items.forEach((item) => itemsElement.append(makeCard(item)));
  } catch (error) {
    countElement.textContent = "—";
    itemsElement.innerHTML = `<p class="error-state"><strong>Can’t load your collection.</strong><br>${error.message} Check the server and database indicators above.</p>`;
  }
}

form.addEventListener("submit", async (event) => {
  event.preventDefault();
  showMessage("");
  submitButton.disabled = true;

  try {
    const response = await fetch(`${API_URL}/items`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name: nameInput.value.trim(), description: descriptionInput.value.trim() }),
    });
    const result = await response.json();
    if (!response.ok) throw new Error(result.error || "Could not save this item.");
    form.reset();
    showMessage("Saved to your collection.", "success");
    await loadItems();
    nameInput.focus();
  } catch (error) {
    showMessage(`${error.message} Check that the backend and database are running.`, "error");
  } finally {
    submitButton.disabled = false;
  }
});

document.querySelector("#refresh-button").addEventListener("click", loadItems);
checkHealth();
window.setInterval(checkHealth, 10000);
loadItems();
