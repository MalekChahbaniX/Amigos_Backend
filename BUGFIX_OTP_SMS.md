# 🔧 Bugfix: Vérification OTP par SMS

## Problème identifié
Le service OTP utilisait un mauvais nom de classe (`WASenderService`) et tentait d'envoyer via WhatsApp au lieu du SMS.

## Solutions apportées

### 1. **Correction du service OTP** (`services/otpService.js`)
✅ Renommé la classe de `WASenderService` à `OTPService`
✅ Supprimé la tentative d'envoi WhatsApp (fallback compliqué)
✅ Implémentation directe et fiable de l'envoi SMS via Twilio
✅ Ajouté des logs détaillés pour le debugging
✅ Validation robuste des paramètres

### 2. **Mise à jour du contrôleur d'authentification** (`controllers/authController.js`)
✅ Changé l'import de `WASenderService` à `OTPService`
✅ Mis à jour la fonction `testConnection()` pour tester Twilio correctement
✅ Modifié `loginUser()` pour envoyer le SMS directement au lieu de WhatsApp
✅ Messages de réponse clarifiés (SMS au lieu de WhatsApp)

## Variables d'environnement requises (dans `.env`)
```
TWILIO_ACCOUNT_SID=ACaa1148d162b670444c434e6fa49ad9ff
TWILIO_AUTH_TOKEN=61b5915390cd426cbcdb4c01d80cc1c1
TWILIO_PHONE_NUMBER=+13142378635
```

## Flux d'authentification corrigé

### Étape 1: Connexion (POST /api/auth/login)
```
Client: { phoneNumber: "+216xxxxxxxx" }
        ↓
Serveur: Génère un OTP (4 chiffres)
        ↓
Twilio SMS: Envoie le code par SMS
        ↓
Réponse: { otpSent: true, message: "Code envoyé par SMS" }
```

### Étape 2: Vérification (POST /api/auth/verify)
```
Client: { phoneNumber: "+216xxxxxxxx", otp: "1234" }
        ↓
Serveur: Valide le code dans la base de données
        ↓
JWT Token: Génère le token de session
        ↓
Réponse: { token: "...", isVerified: true }
```

## Tests recommandés

1. **Test de connexion Twilio**
   ```
   GET /api/auth/test
   ```
   Doit retourner le status de Twilio

2. **Test d'envoi SMS**
   ```
   POST /api/auth/login
   Body: { "phoneNumber": "+216xxxxxxxx" }
   ```
   Doit recevoir un SMS avec le code OTP

3. **Test de vérification**
   ```
   POST /api/auth/verify
   Body: { "phoneNumber": "+216xxxxxxxx", "otp": "XXXX" }
   ```
   Doit valider et retourner un token

## Logs utiles pour déboguer
- `✓ Twilio SMS initialisé` = Configuration correcte
- `❌ Twilio non configuré` = Variables d'environnement manquantes
- `📱 Envoi OTP SMS vers` = Tentative d'envoi en cours
- `✓ SMS envoyé avec succès` = Envoi réussi
- `❌ Erreur lors de l'envoi du SMS` = Problème avec Twilio

## Notes importantes
⚠️ Assurez-vous que `twilio` est installé: `npm install twilio`
⚠️ Les numbers Twilio en test mode n'envoient que sur les numéros vérifiés
⚠️ Vérifiez le format du numéro: doit commencer par `+216` (Tunisie)
