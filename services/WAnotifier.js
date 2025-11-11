import express from "express";
import bodyParser from "body-parser";
import mongoose from "mongoose";
import twilio from "twilio";
import dotenv from "dotenv";

// Charger les variables d'environnement
dotenv.config();

const app = express();
app.use(bodyParser.json());

// -------------------
// 🔌 Connexion MongoDB
// -------------------
const MONGO_URI = process.env.MONGODB_URI || "mongodb+srv://malekchb0621_db_user:amigos2025**@amigos.gyjfexc.mongodb.net/?retryWrites=true&w=majority&appName=amigos";
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
// � Configuration Twilio
// -------------------
const twilioClient = twilio(
  process.env.TWILIO_ACCOUNT_SID,
  process.env.TWILIO_AUTH_TOKEN
);

const smsFrom = process.env.TWILIO_PHONE_NUMBER;
const whatsappFrom = process.env.TWILIO_WHATSAPP_FROM;

// -------------------
// �📤 Route: envoyer OTP
// -------------------
app.post("/send-otp", async (req, res) => {
  const { phone } = req.body;
  if (!phone) return res.status(400).json({ error: "Phone required" });

  const otp = generateOTP();

  try {
    // Sauvegarde dans Mongo
    await OTP.create({ phone, code: otp });
    
    const messageText = `🔐 Votre code de vérification AMIGOS est : ${otp}`;
    let sendResult;

    // Tentative WhatsApp d'abord si configuré
    if (whatsappFrom) {
      try {
        console.log('Tentative envoi WhatsApp vers:', phone);
        const waResponse = await twilioClient.messages.create({
          from: whatsappFrom.startsWith('whatsapp:') ? whatsappFrom : `whatsapp:${whatsappFrom}`,
          to: `whatsapp:${phone}`,
          body: messageText
        });
        sendResult = { channel: 'whatsapp', success: true, data: waResponse };
      } catch (waError) {
        console.error('Échec WhatsApp, fallback SMS:', waError.message);
        // Continue vers SMS
      }
    }

    // Si pas de WhatsApp ou échec, on essaie SMS
    if (!sendResult && smsFrom) {
      console.log('Tentative envoi SMS vers:', phone);
      const smsResponse = await twilioClient.messages.create({
        from: smsFrom,
        to: phone,
        body: messageText
      });
      sendResult = { channel: 'sms', success: true, data: smsResponse };
    }

    if (!sendResult) {
      throw new Error('Aucun canal de communication disponible');
    }

    return res.json({ 
      success: true, 
      otpSent: true, 
      channel: sendResult.channel,
      messageId: sendResult.data.sid 
    });

  } catch (error) {
    console.error("❌ Erreur envoi OTP:", error);
    return res.status(500).json({ 
      error: "Erreur serveur",
      details: process.env.NODE_ENV === 'development' ? error.message : undefined 
    });
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
