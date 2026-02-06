# Instructions pour Tester les APIs ClickToPay avec Postman

## 📋 Vue d'ensemble

Ce document vous guide pour tester les APIs ClickToPay et obtenir les numéros d'autorisation des cartes de test nécessaires pour la validation du support.

## 🚀 Étape 1: Démarrer le Serveur Backend

Assurez-vous que votre serveur est en cours d'exécution :

```bash
cd /home/dev-04/Downloads/Amigos_Backend-main
npm start
```

Le serveur doit démarrer sur `http://localhost:5000`

## 📥 Étape 2: Importer la Collection Postman

1. Ouvrez [Postman Online](https://web.postman.co/)
2. Cliquez sur **Import** dans le coin supérieur gauche
3. Sélectionnez **File** et choisissez le fichier `ClickToPay_Postman_Collection.json`
4. La collection "ClickToPay API Tests" sera importée

## ⚙️ Étape 3: Configurer les Variables d'Environnement

Dans Postman, modifiez les variables de la collection :

1. Cliquez sur **ClickToPay API Tests** dans la sidebar
2. Allez dans l'onglet **Variables**
3. Modifiez les valeurs suivantes :

| Variable | Valeur par défaut | Description |
|----------|-------------------|-------------|
| `baseUrl` | `http://localhost:5000` | URL de votre backend |
| `userId` | `507f1f77bcf86cd799439011` | ID utilisateur MongoDB valide |
| `authToken` | `votre_token_jwt_ici` | Token JWT d'authentification |

**Important :** Remplacez `userId` par un ID utilisateur valide de votre base de données MongoDB.

## 🔧 Étape 4: Vérifier les Variables d'Environnement du Backend

Assurez-vous que votre fichier `.env` contient les variables ClickToPay :

```env
# Configuration ClickToPay
CLICTOPAY_API_URL=https://clictopay.com/gateway
CLICTOPAY_USERNAME=votre_username
CLICTOPAY_PASSWORD=votre_password

# URL de callback (important pour Postman)
BACKEND_URL=http://localhost:5000
```

## 🧪 Étape 5: Exécuter les Tests

### Test 1: Initier un Paiement
- **Requête :** `1. Initier Paiement ClickToPay`
- **Méthode :** POST
- **Endpoint :** `/api/payments/initiate-clictopay`
- **Résultat attendu :** 
  - Status 201
  - `clickToPayOrderId` (numéro d'autorisation)
  - `paymentUrl` pour rediriger vers la page de paiement

### Test 2: Vérifier le Statut
- **Requête :** `2. Vérifier Statut Paiement`
- **Méthode :** GET
- **Endpoint :** `/api/payments/verify-clictopay/{{clickToPayOrderId}}`
- **Résultat attendu :**
  - Status 200
  - `orderStatus` (2 = paiement autorisé ✅)

### Test 3: Simuler Callback Succès
- **Requête :** `3. Simuler Callback Succès`
- **Méthode :** GET
- **Endpoint :** `/api/payments/clictopay-success?orderId={{clickToPayOrderId}}`

### Test 4: Simuler Callback Échec
- **Requête :** `4. Simuler Callback Échec`
- **Méthode :** GET
- **Endpoint :** `/api/payments/clictopay-failure?orderId={{clickToPayOrderId}}`

## 📊 Codes de Statut ClickToPay

| Code | Signification | Action |
|------|---------------|--------|
| 0 | Commande enregistrée, mais pas payée | En attente |
| 1 | Montant pré-autorisation bloqué | En attente |
| 2 | **Le montant a été déposé avec succès** | ✅ **VALIDE** |
| 3 | Annulation d'autorisation | Annulé |
| 4 | Transaction remboursée | Remboursé |
| 5 | Autorisation par ACS initiée | En attente |
| 6 | Autorisation refusée | ❌ Refusé |

## 🎯 Objectif : Obtenir les Numéros d'Autorisation

Le **numéro d'autorisation** est le `clickToPayOrderId` retourné dans la réponse du Test 1. 

Pour chaque test réussi avec `orderStatus = 2`, vous aurez :
- **Numéro d'autorisation** : `clickToPayOrderId`
- **Montant** : en millimes (1000 = 1 DT)
- **Statut** : 2 (autorisé)
- **Transaction ID** : référence interne

## 📝 Journal des Tests

Utilisez la console Postman pour voir les détails :
- Les numéros d'autorisation s'affichent dans la console
- Les statuts détaillés des paiements
- Les URLs de paiement générées

## 🔍 Dépannage

### Erreur 400 - Missing Required Fields
- Vérifiez que `userId` est un ID MongoDB valide
- Assurez-vous que `amount` est en millimes

### Erreur 502 - ClickToPay API Error
- Vérifiez vos credentials ClickToPay dans `.env`
- Confirmez que `CLICTOPAY_API_URL` est accessible

### Erreur de connexion
- Assurez-vous que le serveur backend tourne sur le port 5000
- Vérifiez que `baseUrl` dans Postman est correct

## 🚀 Passage en Production

Une fois que vous avez :
- ✅ Testé avec succès plusieurs cartes
- ✅ Obtenu les numéros d'autorisation valides
- ✅ Vérifié que `orderStatus = 2` correspond aux paiements autorisés

Vous pouvez passer en production en :
1. Changeant `CLICTOPAY_API_URL` vers l'URL de production
2. Mettant à jour les URLs de callback dans votre configuration
3. Utilisant les vraies credentials ClickToPay de production

## 📞 Support

Pour toute question sur l'intégration ClickToPay :
- Consultez les logs du serveur backend
- Vérifiez la console Postman pour les détails des réponses
- Utilisez le script de test intégré : `node scripts/testClickToPay.js`
