# Environment Variables Example

Copy this configuration to your `.env` file in the BACKEND directory.

```bash
# === DATABASE ===
MONGO_URI=mongodb://localhost:27017/amigos
# ou pour MongoDB Atlas: mongodb+srv://username:password@cluster.mongodb.net/amigos

# === JWT ===
JWT_SECRET=votre_jwt_secret_tres_long_et_securise_ici
JWT_EXPIRE=7d

# === WINSMS SMS GATEWAY (TUNISIA) ===
# Service SMS pour les numéros tunisiens (+216)
# Obtenez vos clés depuis https://www.winsms.tn/
# Documentation complète: docs/WINSMS_SETUP.md
# Test de connexion: GET /api/auth/test-winsms
# Monitoring: GET /api/auth/winsms/status
WINSMS_API_KEY=votre_cle_api_winsms_ici
WINSMS_SENDER_ID=votre_sender_id_ici
WINSMS_API_URL=https://api.winsms.tn/v1/sms/send

# === TWILIO SMS GATEWAY (INTERNATIONAL) ===
# Service SMS pour les numéros internationaux (non +216)
# Obtenez vos clés depuis https://www.twilio.com/
TWILIO_ACCOUNT_SID=votre_twilio_account_sid_ici
TWILIO_AUTH_TOKEN=votre_twilio_auth_token_ici
TWILIO_PHONE_NUMBER=+1234567890

# === NODE ENVIRONMENT ===
NODE_ENV=development
# NODE_ENV=production

# === DEBUG ===
# Pour activer les logs détaillés WinSMS:
# DEBUG=winsms:*

# === SECURITY CODE ===
# Configuration pour la génération des codes de sécurité livreurs
REQUIRE_DELIVERER_SECURITY_CODE=true

# === SERVER CONFIGURATION ===
PORT=5000
```

## Instructions

1. **Copiez** ce fichier vers `.env` dans le répertoire BACKEND
2. **Modifiez** les valeurs avec vos vraies clés d'API
3. **Ne jamais** commiter le fichier `.env` dans Git
4. **Redémarrez** le serveur après avoir modifié les variables

## Sécurité

- Gardez vos clés d'API secrètes
- Utilisez des clés différentes pour développement et production
- Effectuez une rotation régulière des clés sensibles
- Limitez l'accès au fichier `.env` aux personnes nécessaires

## Validation

Pour valider votre configuration WinSMS :
```bash
npm run validate:winsms
```

Pour tester la connexion WinSMS :
```bash
curl -X GET http://localhost:5000/api/auth/test-winsms \
  -H "Authorization: Bearer VOTRE_TOKEN_ADMIN"
```
