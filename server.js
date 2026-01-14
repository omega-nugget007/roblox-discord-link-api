import "dotenv/config";
import express from "express";
import cors from "cors";
import { Client, GatewayIntentBits } from "discord.js";

const app = express();
app.use(cors());
app.use(express.json());

// ---------- CONFIG ----------
const DISCORD_BOT_TOKEN = process.env.DISCORD_BOT_TOKEN;
const DISCORD_GUILD_ID = process.env.DISCORD_GUILD_ID;
const API_PORT = process.env.API_PORT || 3000;
const API_KEY = 'KJH87sd98sdf98sdf98sdf98sdf98SDf';

// ---------- DISCORD CLIENT ----------
const client = new Client({
  intents: [GatewayIntentBits.Guilds, GatewayIntentBits.GuildMembers]
});

client.once("ready", () => {
  console.log(`Bot connecté en tant que ${client.user.tag}`);
});

client.login(DISCORD_BOT_TOKEN);

// ---------- STOCKAGE TEMPORAIRE ----------
// code -> discordId
const pendingLinks = new Map();
// robloxId -> discordId
const linkedAccounts = new Map();

// ---------- MIDDLEWARE SECURITE ----------
function checkApiKey(req, res, next) {
  const key = req.headers["x-api-key"];
  if (!API_KEY || key !== API_KEY) {
    return res.status(403).json({ error: "API key invalide" });
  }
  next();
}

// ---------- ROUTE POUR LE BOT : CREER UN CODE ----------
// Appelée par ton bot Discord quand un user fait /link
app.post("/createCode", async (req, res) => {
  const { discordId } = req.body;
  if (!discordId) return res.status(400).json({ error: "discordId manquant" });

  // code simple à 6 chiffres
  const code = Math.floor(100000 + Math.random() * 900000).toString();

  pendingLinks.set(code, {
    discordId,
    createdAt: Date.now()
  });

  return res.json({ code });
});

// ---------- ROUTE POUR ROBLOX : LIER LE COMPTE ----------
// Roblox envoie: robloxId, code
app.post("/link", checkApiKey, async (req, res) => {
  const { robloxId, code } = req.body;

  if (!robloxId || !code) {
    return res.status(400).json({ success: false, error: "robloxId ou code manquant" });
  }

  const entry = pendingLinks.get(code);
  if (!entry) {
    return res.json({ success: false, error: "Code invalide ou expiré" });
  }

  const { discordId, createdAt } = entry;

  // Optionnel: expiration du code (5 minutes)
  if (Date.now() - createdAt > 5 * 60 * 1000) {
    pendingLinks.delete(code);
    return res.json({ success: false, error: "Code expiré" });
  }

  // On associe définitivement
  linkedAccounts.set(String(robloxId), String(discordId));
  pendingLinks.delete(code);

  console.log(`Lien créé: Roblox ${robloxId} <-> Discord ${discordId}`);

  return res.json({
    success: true,
    discordId
  });
});

// ---------- ROUTE POUR ROBLOX : VERIFIER SI DANS LE SERVEUR ----------
// Roblox envoie: robloxId
app.post("/checkMember", checkApiKey, async (req, res) => {
  const { robloxId } = req.body;

  if (!robloxId) {
    return res.status(400).json({ error: "robloxId manquant" });
  }

  const discordId = linkedAccounts.get(String(robloxId));
  if (!discordId) {
    return res.json({ isLinked: false, isMember: false });
  }

  try {
    const guild = await client.guilds.fetch(DISCORD_GUILD_ID);
    const member = await guild.members.fetch(discordId).catch(() => null);

    return res.json({
      isLinked: true,
      isMember: !!member,
      discordId
    });
  } catch (err) {
    console.error("Erreur checkMember:", err);
    return res.status(500).json({ error: "Erreur serveur Discord" });
  }
});

// ---------- DEMARRAGE ----------
app.listen(API_PORT, () => {
  console.log(`API en ligne sur le port ${API_PORT}`);
});



