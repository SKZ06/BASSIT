require("dotenv").config();
const express = require("express");
const cors = require("cors");
const mongoose = require("mongoose");
 
const app = express();
const PORT = process.env.PORT || 3000;
 
// --- CORS : uniquement les origines prévues (variable ALLOWED_ORIGINS) ---
const allowed = (process.env.ALLOWED_ORIGINS || "")
  .split(",").map((s) => s.trim()).filter(Boolean);
 
app.use(cors({
  origin(origin, cb) {
    if (!origin) return cb(null, true);                       // curl, Postman
    if (allowed.includes(origin)) return cb(null, true);
    if (allowed.length === 0 && process.env.NODE_ENV !== "production") return cb(null, true);
    return cb(null, false);
  },
}));
app.use(express.json());
 
// --- Modèle Mongoose ---
const itemSchema = new mongoose.Schema({
  name: { type: String, required: true, trim: true, maxlength: 100 },
  description: { type: String, trim: true, default: "", maxlength: 500 },
  requestId: { type: String, unique: true, sparse: true },    // anti-doublons (Test D)
}, { timestamps: true });
const Item = mongoose.models.Item || mongoose.model("Item", itemSchema);
 
// --- Connexion MongoDB (réutilisée, compatible Vercel serverless) ---
let connecting = null;
function connectDB() {
  const mongoUri = process.env.MONGODB_URI || process.env.MONGO_URI || process.env.mongoURI;
  if (!mongoUri) return Promise.reject(new Error("MONGO_URI manquant dans le fichier .env"));
  if (!connecting) {
    connecting = mongoose
      .connect(mongoUri, { serverSelectionTimeoutMS: 8000 })
      .catch((err) => { connecting = null; throw err; });
  }
  return connecting;
}
async function needDB(req, res, next) {
  try { await connectDB(); next(); }
  catch (err) {
    console.error("MongoDB :", err.message);
    res.status(503).json({ error: "Base de données indisponible" });
  }
}
 
// --- Routes ---
app.get("/", (req, res) => {
  res.json({
    message: "Backend is running",
    health: "/api/health",
    items: "/api/items",
  });
});

app.get("/api/health", (req, res) => {
  const state = mongoose.connection.readyState;
  if (state === 0) connectDB().catch(() => {});
  const database = state === 1 ? "connected" : state === 2 ? "connecting" : "disconnected";
  res.status(database === "connected" ? 200 : 503).json({
    status: database === "connected" ? "ok" : "degraded",
    server: "connected",
    database,
    env: process.env.NODE_ENV || "development",
  });
});
 
app.get("/api/items", needDB, async (req, res) => {
  try {
    res.json(await Item.find().sort({ createdAt: -1 }));
  } catch (err) {
    res.status(500).json({ error: "Erreur serveur" });
  }
});
 
app.post("/api/items", needDB, async (req, res) => {
  const { name, description, requestId } = req.body || {};
  if (typeof name !== "string" || name.trim() === "" || name.length > 100) {
    return res.status(400).json({ error: "Le champ name est obligatoire (1 à 100 caractères)" });
  }
  if (requestId !== undefined && typeof requestId !== "string") {
    return res.status(400).json({ error: "requestId doit être une chaîne" });
  }
  try {
    if (requestId) {                                           // requête déjà traitée ?
      const existing = await Item.findOne({ requestId });
      if (existing) return res.status(200).json(existing);
    }
    const item = await Item.create({ name, description, requestId });
    res.status(201).json(item);
  } catch (err) {
    if (err.code === 11000) {                                  // deux requêtes simultanées
      return res.status(200).json(await Item.findOne({ requestId }));
    }
    if (err.name === "ValidationError") return res.status(400).json({ error: err.message });
    res.status(500).json({ error: "Erreur serveur" });
  }
});
 
app.use((req, res) => res.status(404).json({ error: "Route introuvable" }));
 
// --- Démarrage ---
if (!process.env.VERCEL) {
  app.listen(PORT, () => {
    console.log(`Serveur sur http://localhost:${PORT}`);
    connectDB()
      .then(() => console.log("MongoDB connectée"))
      .catch((err) => console.error("MongoDB indisponible :", err.message));
  });
}
 
module.exports = app;
