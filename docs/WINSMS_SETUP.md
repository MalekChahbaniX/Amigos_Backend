# WinSMS Setup Guide

## Introduction et Prérequis

WinSMS est le fournisseur SMS principal pour les numéros tunisiens (+216) dans l'application AMIGOS. Ce service est utilisé pour l'envoi des codes OTP (One-Time Password) lors de l'authentification des utilisateurs.

### Prérequis
- Compte WinSMS actif sur https://www.winsms.tn/
- Clé API valide
- Sender ID (identifiant d'expéditeur) approuvé
- Solde suffisant sur le compte (minimum recommandé : 100 TND)
- Accès administrateur à l'environnement backend AMIGOS

## Obtention des Credentials

### Étape 1 : Création du Compte
1. Visitez https://www.winsms.tn/
2. Créez un compte professionnel ou entreprise
3. Validez votre email et votre numéro de téléphone
4. Complétez votre profil d'entreprise

### Étape 2 : Configuration API
1. Connectez-vous au tableau de bord WinSMS
2. Naviguez vers **"API Settings"** ou **"Paramètres API"**
3. Cliquez sur **"Générer une nouvelle API Key"**
4. Copiez et sauvegardez votre clé API (elle ne sera plus affichée)

### Étape 3 : Configuration Sender ID
1. Dans les paramètres, accédez à **"Sender ID"**
2. Soumettez votre identifiant d'expéditeur (ex: "AMIGOS", "SERVICE")
3. Attendez l'approbation de WinSMS (peut prendre 24-48h)

### Étape 4 : Vérification du Solde
1. Accédez à la section **"Solde"** ou **"Balance"**
2. Vérifiez que vous avez suffisamment de crédits
3. Rechargez si nécessaire (minimum 100 TND recommandé pour les tests)

## Configuration des Variables d'Environnement

Ajoutez les variables suivantes dans votre fichier `BACKEND/.env` :

```bash
# === WINSMS SMS GATEWAY (TUNISIA) ===
# Service SMS pour les numéros tunisiens (+216)
# Obtenez vos clés depuis https://www.winsms.tn/
# Documentation complète: docs/WINSMS_SETUP.md
# Test de connexion: GET /api/auth/test-winsms
# Monitoring: GET /api/auth/winsms/status
WINSMS_API_KEY=votre_cle_api_winsms_ici
WINSMS_SENDER_ID=votre_sender_id_ici
WINSMS_API_URL=https://api.winsms.tn/v1/sms/send
```

### Description des Variables

- **WINSMS_API_KEY** : Clé d'authentification API (obligatoire)
  - Format: chaîne de caractères alphanumériques
  - Exemple: `winsms_prod_1234567890abcdef`
  - Rotation recommandée: tous les 90 jours

- **WINSMS_SENDER_ID** : Identifiant d'expéditeur (obligatoire)
  - Format: chaîne de 3-11 caractères alphanumériques
  - Exemple: `AMIGOS`, `SERVICE`
  - Doit être pré-approuvé par WinSMS

- **WINSMS_API_URL** : URL de l'API (optionnel)
  - Valeur par défaut: `https://api.winsms.tn/v1/sms/send`
  - Ne modifiez que si vous utilisez un endpoint personnalisé

### ⚠️ Notes de Sécurité

- **Ne jamais committer** le fichier `.env` dans Git
- Utilisez des variables d'environnement en production
- Effectuez une **rotation régulière** de l'API key (tous les 90 jours)
- Limitez l'accès aux credentials aux personnes nécessaires
- Surveillez l'utilisation anormale via le dashboard WinSMS

## Validation de la Configuration

### Test de Connexion (sans envoi de SMS)

```bash
curl -X GET http://localhost:5000/api/auth/test-winsms \
  -H "Authorization: Bearer VOTRE_TOKEN_SUPER_ADMIN"
```

**Réponse attendue en cas de succès :**
```json
{
  "message": "WinSMS connection successful",
  "timestamp": "2026-02-03T18:45:00.000Z",
  "data": {
    "provider": "winsms",
    "connected": true,
    "balance": 5000,
    "error": null
  }
}
```

**Réponse en cas d'erreur :**
```json
{
  "message": "WinSMS connection failed",
  "timestamp": "2026-02-03T18:45:00.000Z",
  "data": {
    "provider": "winsms",
    "connected": false,
    "balance": null,
    "error": "Authentication error: Invalid API key"
  }
}
```

### Test d'Envoi SMS Réel

```bash
curl -X POST http://localhost:5000/api/auth/winsms/test \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer VOTRE_TOKEN_SUPER_ADMIN" \
  -d '{"phoneNumber": "+21612345678"}'
```

**Réponse attendue :**
```json
{
  "message": "Test SMS sent successfully",
  "data": {
    "phoneNumber": "+21612345678",
    "provider": "winsms",
    "messageId": "winsms_1234567890",
    "responseTime": 1250
  }
}
```

## Monitoring et Santé du Service

### Endpoints de Monitoring Disponibles

| Endpoint | Description | Authentification |
|----------|-------------|------------------|
| `GET /api/auth/winsms/health` | Vérification de santé du service | Token admin requis |
| `GET /api/auth/winsms/metrics` | Métriques détaillées d'utilisation | Token admin requis |
| `GET /api/auth/winsms/status` | Statut complet du service | Token admin requis |
| `GET /api/auth/sms/dashboard` | Dashboard unifié WinSMS + Twilio | Token admin requis |

### Documentation Complète

Pour la documentation détaillée des endpoints de monitoring, référez-vous à :
- `../Docs/WINSMS_MONITORING_ENDPOINTS.md`

## Troubleshooting

### Tableau de Diagnostic

| Symptôme | Cause Probable | Solution |
|----------|----------------|----------|
| `"WINSMS_API_KEY not configured"` | Variable manquante dans `.env` | Vérifier `.env` et redémarrer le serveur |
| `"Authentication error"` | API Key invalide ou expirée | Régénérer l'API key sur le portail WinSMS |
| `"Insufficient balance"` | Solde insuffisant | Recharger le compte WinSMS |
| `"Invalid phone number"` | Format incorrect | Vérifier le format +216XXXXXXXX |
| `"Connection timeout"` | Problème réseau/firewall | Vérifier la connectivité vers api.winsms.tn |
| `"Sender ID not approved"` | Sender ID non approuvé | Contacter le support WinSMS |
| `"Rate limit exceeded"` | Trop de requêtes | Attendre et réessayer plus tard |

### Logs de Débogage

Pour activer les logs détaillés, définissez `DEBUG=winsms:*` dans vos variables d'environnement :

```bash
DEBUG=winsms:* npm start
```

## Architecture et Flux

### Flux d'Envoi SMS

```mermaid
sequenceDiagram
    participant Client as Client Mobile
    participant Auth as authController
    participant Router as SMSRouterService
    participant WinSMS as winSmsService
    participant API as WinSMS API
    participant DB as WinSMSLog

    Client->>Auth: POST /api/auth/login (+216...)
    Auth->>Router: sendOTP(phoneNumber, otp)
    Router->>Router: Détecte +216 (Tunisie)
    Router->>WinSMS: sendOTP(phoneNumber, otp)
    WinSMS->>WinSMS: validateCredentials()
    WinSMS->>API: POST /v1/sms/send
    API-->>WinSMS: {success, messageId}
    WinSMS->>DB: Log (status: success)
    WinSMS-->>Router: {success: true, channel: 'sms'}
    Router-->>Auth: {success: true, provider: 'winsms'}
    Auth-->>Client: OTP envoyé
```

### Architecture Technique

```
┌─────────────────┐    ┌──────────────────┐    ┌─────────────────┐
│   authController │    │ SMSRouterService │    │ winSmsService   │
│                 │    │                  │    │                 │
│ - loginUser()   │───▶│ - sendOTP()      │───▶│ - sendOTP()     │
│ - registerUser()│    │ - routeByCountry()│    │ - validateCreds()│
│                 │    │                  │    │ - retryLogic()  │
└─────────────────┘    └──────────────────┘    └─────────────────┘
                                                       │
                                                       ▼
                                              ┌─────────────────┐
                                              │   WinSMS API    │
                                              │                 │
                                              │ - /v1/sms/send  │
                                              │ - Authentication│
                                              └─────────────────┘
```

## Intégration avec le Code

### Dans `BACKEND/services/smsRouterService.js`

Le service de routage SMS détecte automatiquement les numéros tunisiens :

```javascript
// Détection automatique
if (phoneNumber.startsWith('+216')) {
  // Routage vers WinSMS pour les numéros tunisiens
  return await winSmsService.sendOTP(phoneNumber, otp);
} else {
  // Routage vers Twilio pour les autres pays
  return await twilioService.sendOTP(phoneNumber, otp);
}
```

### Dans `BACKEND/controllers/authController.js`

Les fonctions d'authentification utilisent le routeur SMS :

```javascript
// Dans loginUser()
const smsResult = await SMSRouterService.sendOTP(phoneNumber, otp);

// Gestion automatique des erreurs WinSMS
if (!smsResult.success) {
  return res.status(smsResult.statusCode).json({
    message: smsResult.message,
    canRetry: smsResult.canRetry
  });
}
```

### Dans `BACKEND/services/winSmsService.js`

Le service WinSMS inclut :

- **Retry automatique** : 3 tentatives avec backoff exponentiel
- **Cache des credentials** : TTL 5 minutes pour éviter les validations répétées
- **Logging détaillé** : Chaque tentative est loggée dans `WinSMSLog`
- **Gestion d'erreurs** : Mapping des erreurs WinSMS vers messages utilisateur

## Logs et Monitoring

### Logs Console

Les logs suivants sont disponibles dans la console :

```bash
# Initialisation
📱 WinSMSService initialized successfully
✓ WinSMS credentials configured

# Envoi OTP
📱 WinSMS: Sending OTP to +21612345678
🔄 [WinSMS] Tentative 1/3 - +21612345678
✓ WinSMS: OTP sent successfully to +21612345678

# Erreurs
❌ WinSMS: Failed to send OTP to +21612345678
🚨 [WinSMS] Authentication error detected
```

### Logs Base de Données

Le modèle `WinSMSLog` dans `BACKEND/models/WinSMSLog.js` stocke :

```javascript
{
  phoneNumber: "+21612345678",
  otp: "123456",
  status: "success", // success, failed, pending
  attempts: 1,
  responseTime: 1250,
  errorDetails: null,
  credentialsValid: true,
  createdAt: ISODate,
  messageId: "winsms_1234567890"
}
```

**Rétention automatique :** 90 jours (TTL configuré dans MongoDB)

### Alertes Automatiques

Le système génère des alertes pour :

- 🚨 **Critique** : 5+ échecs en 15 minutes
- ⚠️ **Avertissement** : Taux de succès < 80% sur 1 heure
- 📊 **Info** : Changement de statut du service

### Métriques Disponibles

Via `GET /api/auth/winsms/metrics` :

```json
{
  "totalSent": 1250,
  "successRate": 95.2,
  "averageResponseTime": 1200,
  "last24h": {
    "sent": 45,
    "success": 43,
    "failed": 2
  },
  "errors": {
    "authentication": 0,
    "insufficient_funds": 0,
    "invalid_number": 1,
    "network": 1
  }
}
```

## Bonnes Pratiques

### Performance

- Utilisez le cache des credentials (TTL 5 minutes)
- Configurez des timeouts appropriés (10s recommandé)
- Surveillez les temps de réponse (> 2s = anomalie)

### Sécurité

- Rotation régulière des API keys
- Surveillance des accès anormaux
- Validation stricte des numéros de téléphone

### Fiabilité

- Testez régulièrement la connexion
- Surveillez le solde du compte
- Configurez des alertes pour les échecs

## Support et Contact

### Support WinSMS

- **Email** : support@winsms.tn
- **Téléphone** : +216 71 XXX XXX
- **Documentation** : https://docs.winsms.tn/

### Support Technique AMIGOS

Pour toute question sur l'intégration WinSMS dans AMIGOS :

- Consultez les logs dans `WinSMSLog` collection
- Utilisez les endpoints de monitoring
- Référez-vous à `../Docs/WINSMS_MONITORING_ENDPOINTS.md`

---

**Dernière mise à jour :** 3 février 2026  
**Version :** 1.0
