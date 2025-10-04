import express from "express";
import bodyParser from "body-parser";
import mongoose from "mongoose";
import fetch from "node-fetch";

const app = express();
app.use(bodyParser.json());

// -------------------
// 🔌 Connexion MongoDB
// -------------------
const MONGO_URI = "mongodb+srv://malekchb0621_db_user:amigos2025**@amigos.gyjfexc.mongodb.net/?retryWrites=true&w=majority&appName=amigos";
mongoose.connect(MONGO_URI, { useNewUrlParser: true, useUnifiedTopology: true })
  .then(() => console.log("✅ MongoDB Connected"))
  .catch(err => console.error("❌ MongoDB Error:", err));

// -------------------
// 📦 Schéma OTP
// -------------------
const otpSchema = new mongoose.Schema({
  phone: { type: String, required: true },
  code: { type: String, required: true },
  createdAt: { type: Date, default: Date.now, expires: 300 } // expire après 5 min
});

const OTP = mongoose.model("OTP", otpSchema);

// -------------------
// 🔑 Génération OTP 4 chiffres
// -------------------
function generateOTP() {
  return Math.floor(1000 + Math.random() * 9000).toString(); // 4 chiffres
}

// -------------------
// 📤 Route: envoyer OTP
// -------------------
app.post("/send-otp", async (req, res) => {
  const { phone } = req.body;
  if (!phone) return res.status(400).json({ error: "Phone required" });

  const otp = generateOTP();

  try {
    // Sauvegarde dans Mongo
    await OTP.create({ phone, code: otp });

    // ⚠️ Remplace par ta vraie API Key WAnotifier
    const response = await fetch("https://app.wanotifier.com/webhooks/OiTDxouGS2NTuF8ti769", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Authorization": "Bearer VOTRE_API_KEY"
      },
      body: JSON.stringify({
        to: phone,
        message: `🔐 Votre code de vérification est : ${otp}`
      })
    });

    const data = await response.json();
    return res.json({ success: true, otpSent: true, data });

  } catch (error) {
    console.error("❌ Erreur envoi OTP:", error);
    return res.status(500).json({ error: "Erreur serveur" });
  }
});

// -------------------
// ✅ Route: vérifier OTP
// -------------------
app.post("/verify-otp", async (req, res) => {
  const { phone, otp } = req.body;

  if (!phone || !otp) return res.status(400).json({ error: "Phone + OTP required" });

  try {
    const record = await OTP.findOne({ phone, code: otp });
    if (record) {
      await OTP.deleteMany({ phone }); // supprimer après succès
      return res.json({ success: true, message: "Vérification réussie ✅" });
    } else {
      return res.status(400).json({ success: false, message: "Code invalide ❌" });
    }
  } catch (error) {
    console.error("❌ Erreur vérification:", error);
    return res.status(500).json({ error: "Erreur serveur" });
  }
});

// -------------------
// 🚀 Lancement serveur
// -------------------
app.listen(3000, () => {
  console.log("🚀 Serveur OTP prêt sur http://localhost:3000");
});
