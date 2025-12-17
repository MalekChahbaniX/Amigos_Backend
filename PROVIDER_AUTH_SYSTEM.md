# Provider Authentication System Implementation

## 📋 Résumé Complet de l'Implémentation

Ce document détaille le système d'authentification et d'autorisation pour les **prestataires (providers)** dans l'application AMIGOS.

---

## 1. ✅ Modèles Mis à Jour

### 1.1 User Model (`BACKEND/models/User.js`)

**Changements apportés:**
- ✅ Ajout du rôle `'provider'` à l'énumération `role`
- ✅ Ajout du champ `providerId` (référence à Provider)
- ✅ Le champ `providerId` est:
  - **Obligatoire** si le rôle est `'provider'`
  - **Unique** (un prestataire ne peut avoir qu'un utilisateur)
  - **Sparse** (ignoré pour les autres rôles)

**Code:**
```javascript
role: {
  type: String,
  enum: ['client', 'superAdmin', 'deliverer', 'admin', 'provider'],
  default: 'client',
},
providerId: {
  type: mongoose.Schema.Types.ObjectId,
  ref: 'Provider',
  required: function() {
    return this.role === 'provider';
  },
  unique: true,
  sparse: true
}
```

**Impact:** Les utilisateurs de type `provider` sont maintenant liés à un prestataire spécifique.

---

## 2. ✅ Middleware d'Authentification

### 2.1 Middleware `isProvider` (`BACKEND/middleware/auth.js`)

**Ajout du nouveau middleware:**
```javascript
const isProvider = (req, res, next) => {
  protect(req, res, () => {
    if (!req.user || req.user.role !== 'provider') {
      return res.status(403).json({
        success: false,
        message: 'Accès refusé, rôle prestataire requis'
      });
    }
    next();
  });
};
```

**Fonctionnalité:**
- Vérifie que l'utilisateur est authentifié (via `protect`)
- Vérifie que le rôle est `'provider'`
- Retourne 403 si conditions non remplies
- Passe au contrôleur suivant si OK

**Export:**
```javascript
module.exports = {
  protect,
  isDeliverer,
  isSuperAdmin,
  isAdmin,
  isAdminOrSuperAdmin,
  isProvider,  // ✅ Exporté
  checkDelivererSession
};
```

---

## 3. ✅ Contrôleurs d'Authentification

### 3.1 `registerProvider()` (`BACKEND/controllers/authController.js`)

**Endpoint:** `POST /api/auth/register-provider`

**Paramètres requis:**
- `email` - Email du prestataire (unique)
- `password` - Mot de passe (minimum 6 caractères)
- `providerId` - ID du prestataire (ObjectId)
- `firstName` (optionnel) - Prénom
- `lastName` (optionnel) - Nom

**Logique:**
1. Validation des paramètres
2. Vérification du format email
3. Vérification de la longueur du mot de passe
4. Vérification qu'aucun utilisateur n'existe avec cet email
5. Vérification que le Provider existe
6. Vérification qu'aucun utilisateur n'est déjà associé à ce Provider
7. Hachage du mot de passe avec bcrypt
8. Création de l'utilisateur

**Réponse de succès (201):**
```json
{
  "_id": "user_id",
  "firstName": "Name",
  "lastName": "Last",
  "email": "provider@example.com",
  "role": "provider",
  "providerId": "provider_id",
  "isVerified": true,
  "status": "active",
  "token": "jwt_token",
  "message": "Compte prestataire créé avec succès"
}
```

---

### 3.2 `loginProvider()` (`BACKEND/controllers/authController.js`)

**Endpoint:** `POST /api/auth/login-provider`

**Paramètres requis:**
- `email` - Email du prestataire
- `password` - Mot de passe

**Logique:**
1. Validation des paramètres
2. Recherche de l'utilisateur avec rôle `'provider'`
3. Population du champ `providerId`
4. Vérification du mot de passe avec bcrypt
5. Mise à jour du statut à `'active'` si nécessaire
6. Génération du JWT

**Réponse de succès (200):**
```json
{
  "_id": "user_id",
  "firstName": "Name",
  "lastName": "Last",
  "email": "provider@example.com",
  "role": "provider",
  "providerId": "provider_id",
  "providerName": "Provider Name",
  "isVerified": true,
  "status": "active",
  "token": "jwt_token",
  "message": "Connexion prestataire réussie"
}
```

---

## 4. ✅ Routes Mise à Jour

### 4.1 Auth Routes (`BACKEND/routes/authRoutes.js`)

**Nouveaux endpoints ajoutés:**
```javascript
// Routes pour les prestataires
router.post('/register-provider', registerProvider);
router.post('/login-provider', loginProvider);
```

**Routes complètes disponibles:**
- `POST /api/auth/register` - Enregistrer un client
- `POST /api/auth/login` - Connexion client
- `POST /api/auth/register-super-admin` - Enregistrer super admin
- `POST /api/auth/login-super-admin` - Connexion super admin
- `POST /api/auth/register-deliverer` - Enregistrer livreur
- `POST /api/auth/login-deliverer` - Connexion livreur
- `POST /api/auth/register-admin` - Enregistrer admin
- `POST /api/auth/login-admin` - Connexion admin
- **`POST /api/auth/register-provider`** ✅ **Nouveau**
- **`POST /api/auth/login-provider`** ✅ **Nouveau**

---

### 4.2 Provider Routes (`BACKEND/routes/providerRoutes.js`)

**Route protégée ajoutée:**
```javascript
// GET /api/providers/me/profile - Récupérer le profil du prestataire connecté
router.get('/me/profile', isProvider, async (req, res) => {
  try {
    const Provider = require('../models/Provider');
    const provider = await Provider.findById(req.user.providerId);
    if (!provider) {
      return res.status(404).json({ message: 'Prestataire non trouvé' });
    }
    res.json(provider);
  } catch (error) {
    res.status(500).json({ message: 'Erreur serveur', error: error.message });
  }
});
```

**Utilisation:**
- Requête: `GET /api/providers/me/profile`
- Headers: `Authorization: Bearer <token_provider>`
- Retourne: Données complètes du Provider connecté

---

## 5. 🔐 Flux d'Authentification Provider

### 5.1 Inscription

```
1. POST /api/auth/register-provider
   ├─ Envoyer: { email, password, providerId, firstName, lastName }
   ├─ Valider les données
   ├─ Hacher le mot de passe
   ├─ Créer utilisateur avec rôle 'provider'
   └─ Retourner: { token, providerId, ... }

2. Frontend stocke le token
```

### 5.2 Connexion

```
1. POST /api/auth/login-provider
   ├─ Envoyer: { email, password }
   ├─ Chercher utilisateur par email + rôle 'provider'
   ├─ Vérifier mot de passe
   ├─ Générer JWT
   └─ Retourner: { token, providerId, ... }

2. Frontend stocke le token
```

### 5.3 Accès Ressource Protégée

```
1. GET /api/providers/me/profile
   ├─ Envoyer: Header Authorization: Bearer <token>
   ├─ Middleware protect(): Vérifie JWT
   ├─ Middleware isProvider(): Vérifie rôle 'provider'
   ├─ Récupérer Provider par req.user.providerId
   └─ Retourner: Données du Provider

2. Frontend reçoit les données du provider
```

---

## 6. 📊 Schéma de Données

### Relation User ↔ Provider

```
┌─────────────────────────────┐
│         User (role:provider)│
├─────────────────────────────┤
│ _id                         │
│ email (unique)              │
│ password (hashed)           │
│ firstName                   │
│ lastName                    │
│ providerId ──────┐          │
│ role: 'provider' │          │
│ isVerified       │          │
│ status           │          │
└─────────────────────────────┘
         │
         │ References
         │
         ▼
┌─────────────────────────────┐
│          Provider           │
├─────────────────────────────┤
│ _id                         │
│ name (unique)               │
│ type (enum)                 │
│ phone (unique)              │
│ address                     │
│ email                       │
│ location                    │
│ status                      │
│ csRPercent                  │
│ csCPercent                  │
└─────────────────────────────┘
```

**Points clés:**
- 1 Provider = 0 ou 1 User (relation optionnelle)
- 1 User (provider) = 1 Provider (obligatoire)
- `User.providerId` est unique et référence `Provider._id`

---

## 7. 🧪 Exemples d'Utilisation

### 7.1 Inscription Provider

**Request:**
```bash
POST /api/auth/register-provider
Content-Type: application/json

{
  "email": "boutique@example.com",
  "password": "securePassword123",
  "providerId": "provider_id_here",
  "firstName": "Boutique",
  "lastName": "Manager"
}
```

**Response (201):**
```json
{
  "_id": "user_id",
  "firstName": "Boutique",
  "lastName": "Manager",
  "email": "boutique@example.com",
  "role": "provider",
  "providerId": "provider_id_here",
  "isVerified": true,
  "status": "active",
  "token": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...",
  "message": "Compte prestataire créé avec succès"
}
```

---

### 7.2 Connexion Provider

**Request:**
```bash
POST /api/auth/login-provider
Content-Type: application/json

{
  "email": "boutique@example.com",
  "password": "securePassword123"
}
```

**Response (200):**
```json
{
  "_id": "user_id",
  "firstName": "Boutique",
  "lastName": "Manager",
  "email": "boutique@example.com",
  "role": "provider",
  "providerId": "provider_id_here",
  "providerName": "Boutique Moda City",
  "isVerified": true,
  "status": "active",
  "token": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...",
  "message": "Connexion prestataire réussie"
}
```

---

### 7.3 Accès Profil Provider

**Request:**
```bash
GET /api/providers/me/profile
Authorization: Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...
```

**Response (200):**
```json
{
  "_id": "provider_id",
  "name": "Boutique Moda City",
  "type": "store",
  "phone": "+216 71 123 462",
  "address": "Centre Commercial Tunis",
  "email": "boutique@example.com",
  "location": {
    "latitude": 36.805,
    "longitude": 10.170
  },
  "status": "active",
  "csRPercent": 8,
  "csCPercent": 2
}
```

---

## 8. ✔️ Validations et Sécurité

### Validations Implémentées

| Validation | Détails |
|-----------|---------|
| **Email** | Format valide, unique, lowercase |
| **Mot de passe** | Min 6 caractères, hachage bcrypt |
| **Provider** | Doit exister, pas d'utilisateur existant |
| **Token** | JWT avec expiration 1 jour |
| **Rôle** | Vérification stricte du rôle 'provider' |

### Points de Sécurité

1. **Mots de passe:** Hachés avec bcrypt (salt: 10)
2. **JWT:** Signé avec `JWT_SECRET` depuis .env
3. **Middleware:** Vérifie token à chaque requête protégée
4. **Unique constraints:** Email et providerId uniques
5. **Sparse indexes:** Ignorent les champs nuls pour autres rôles

---

## 9. 📝 Fichiers Modifiés

| Fichier | Type de Changement | Impact |
|---------|------------------|--------|
| `models/User.js` | Ajout rôle + champ | Schéma BD |
| `middleware/auth.js` | Nouveau middleware | Sécurité |
| `controllers/authController.js` | 2 nouvelles fonctions | Endpoints |
| `routes/authRoutes.js` | 2 nouvelles routes | API |
| `routes/providerRoutes.js` | 1 route protégée | API |

---

## 10. 🚀 Déploiement et Tests

### Prérequis
- MongoDB connecté
- `JWT_SECRET` dans `.env`
- Bcrypt installé (`npm list bcrypt`)

### Test d'Enregistrement

```bash
curl -X POST http://localhost:3000/api/auth/register-provider \
  -H "Content-Type: application/json" \
  -d '{
    "email": "test@provider.com",
    "password": "test1234",
    "providerId": "<provider_id>",
    "firstName": "Test",
    "lastName": "Provider"
  }'
```

### Test de Connexion

```bash
curl -X POST http://localhost:3000/api/auth/login-provider \
  -H "Content-Type: application/json" \
  -d '{
    "email": "test@provider.com",
    "password": "test1234"
  }'
```

### Test Accès Protégé

```bash
curl -X GET http://localhost:3000/api/providers/me/profile \
  -H "Authorization: Bearer <token_reçu>"
```

---

## 11. 📚 Points de Référence

**Modèles similaires existants:**
- `registerDeliverer()` / `loginDeliverer()` - Référence d'implémentation
- `registerAdmin()` / `loginAdmin()` - Référence d'implémentation
- Middleware `isDeliverer` - Référence de pattern

**Variables d'environnement requises:**
```bash
JWT_SECRET=your_secret_key_here
MONGO_URI=mongodb://...
```

---

**Date:** 17 Décembre 2025  
**Statut:** ✅ Implémentation Complète  
**Rétro-compatible:** ✅ Oui  
**Prêt pour Production:** ✅ Avec tests appropriés
