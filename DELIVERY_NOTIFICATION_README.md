# 📱 Système de Notifications pour Livreurs

## Vue d'ensemble

Ce système permet d'envoyer des notifications en temps réel aux livreurs lorsqu'une nouvelle commande est créée, même lorsque leur appareil est en veille. Le premier livreur à accepter la commande obtient l'assignation exclusive.

## Architecture

### Composants Principaux

1. **Notification Service** (`services/notificationService.js`)
   - Gestion des connexions WebSocket via Socket.IO
   - Notification en temps réel aux livreurs connectés
   - Suivi des livreurs actifs

2. **Push Notification Service** (`services/pushNotificationService.js`)
   - Envoi de notifications push via FCM (Firebase Cloud Messaging)
   - Solution de secours via Expo Push Notifications
   - Notifications pour appareils en veille/hors ligne

3. **Order Controller** (`controllers/orderController.js`)
   - Intégration des notifications lors de la création de commande
   - Assignation atomique des commandes (prévention des conflits)

4. **Deliverer Auth Routes** (`routes/delivererAuthRoutes.js`)
   - Enregistrement et authentification des livreurs
   - Gestion des tokens de notification push

## Fonctionnalités

### ✅ Notifications en Temps Réel
- WebSocket connection pour les livreurs connectés
- Notifications instantanées lors de la création de commande
- Mise à jour du statut des commandes en temps réel

### ✅ Notifications Push pour Appareils en Veille
- Support FCM (Firebase Cloud Messaging)
- Solution de secours Expo Push Notifications
- Notifications même lorsque l'appareil est verrouillé

### ✅ Assignation Exclusive
- Premier livreur à accepter = propriétaire de la commande
- Opération atomique pour éviter les conflits
- Notification aux autres livreurs quand une commande est prise

### ✅ Gestion des Livreurs Actifs
- Suivi des livreurs connectés via WebSocket
- Stockage des tokens push pour les notifications offline
- Déconnexion automatique en cas de perte de connexion

## Installation et Configuration

### 1. Variables d'environnement

Ajouter au fichier `.env` :

```env
# Socket.IO & Frontend
FRONTEND_URL=http://localhost:3000

# Firebase Cloud Messaging (FCM)
FCM_SERVER_KEY=your_fcm_server_key_here

# MongoDB
MONGO_URI=mongodb+srv://...

# JWT
JWT_SECRET=your_jwt_secret
```

### 2. Dépendances npm

```bash
npm install socket.io
npm install axios
```

### 3. Configuration Socket.IO côté client

```javascript
import io from 'socket.io-client';

const socket = io('http://localhost:5000', {
  transports: ['websocket'],
  auth: {
    token: userToken
  }
});

// Rejoindre la room livreur
socket.emit('join-deliverer', delivererId);

// Écouter les nouvelles commandes
socket.on('new-order', (order) => {
  console.log('Nouvelle commande:', order);
  showNotification(order);
});
```

### 4. Configuration Push Notifications

#### Firebase Cloud Messaging (Recommandé)

1. Créer un projet Firebase
2. Obtenir la Server Key FCM
3. Ajouter au `.env` comme `FCM_SERVER_KEY`

#### Expo Push Notifications (Alternative)

Fonctionne automatiquement avec le service push d'Expo.

## API Routes

### Livreurs

- `POST /api/deliverer-auth/register` - Enregistrer un nouveau livreur
- `POST /api/deliverer-auth/login` - Connecter un livreur
- `PUT /api/deliverer-auth/token` - Mettre à jour le token push
- `GET /api/deliverer-auth/profile` - Obtenir le profil livreur
- `PUT /api/deliverer-auth/profile` - Mettre à jour le profil

### Commandes (Livreurs)

- `GET /api/deliverer/orders` - Commandes assignées
- `GET /api/deliverer/orders/available` - Commandes disponibles
- `PUT /api/deliverer/orders/:id/accept` - Accepter une commande
- `PUT /api/deliverer/orders/:id/reject` - Rejeter une commande
- `PUT /api/deliverer/orders/:id/status` - Mettre à jour le statut

## Flux de Notification

### 1. Création de Commande

```
Client → API → Order Created → Notification Service → Push to Deliverers
```

1. Le client crée une commande
2. Le serveur crée la commande dans la base de données
3. Le service de notification envoie:
   - WebSocket aux livreurs connectés
   - Push notifications à tous les livreurs (y compris hors ligne)

### 2. Acceptation de Commande

```
Deliverer → Accept → Atomic Update → Notify Others → Assignment Confirmed
```

1. Le livreur accepte la commande
2. Mise à jour atomique dans la base de données (empêche les doublons)
3. Notification aux autres livreurs: "Commande prise"
4. Confirmation de l'assignation au livreur

### 3. Gestion des Conflits

- **Atomic Operation**: Utilisation de `findOneAndUpdate` avec conditions
- **Race Condition Prevention**: Seul le premier livreur peut assigner
- **Real-time Sync**: Tous les livreurs reçoivent la mise à jour instantanément

## Database Schema Updates

### User Model (Livreurs)

```javascript
pushToken: {
  type: String,
  default: ''
}
```

### Order Model

```javascript
assignedAt: {
  type: Date,
  default: null,
}
```

## Sécurité

### Authentication
- JWT tokens pour l'authentification
- Middleware `isDeliverer` pour protéger les routes
- Validation des rôles utilisateur

### Data Validation
- Validation des tokens push
- Contrôle des transitions de statut
- Protection contre les assignations multiples

## Monitoring

### Logs Importants

```javascript
// Connexion livreur
"👤 Deliverer [ID] joined room"

// Nouvelle commande
"📢 Notifying deliverers about new order: [ORDER_ID]"

// Acceptation
"✅ Deliverer [ID] attempting to accept order [ORDER_ID]"

// Assignation réussie
"✅ Order [ORDER_ID] assigned to deliverer [DELIVERER_ID]"
```

### Metrics

- Nombre de livreurs actifs
- Taux de délivrance des notifications
- Temps de réponse moyen
- Statut des commandes

## Dépannage

### Problèmes Courants

1. **Notifications non reçues**
   - Vérifier la connexion WebSocket
   - Vérifier les tokens push
   - Vérifier les permissions notifications

2. **Conflits d'assignation**
   - Vérifier l'atomicité des opérations
   - Vérifier les logs de race condition

3. **Performances**
   - Monitorer le nombre de connexions WebSocket
   - Vérifier la charge serveur

### Tests

```bash
# Tester la création de commande avec notification
curl -X POST http://localhost:5000/api/orders \
  -H "Content-Type: application/json" \
  -d '{"client":"...", "provider":"...", "items":[...]}'

# Tester l'acceptation de commande
curl -X PUT http://localhost:5000/api/deliverer/orders/ORDER_ID/accept \
  -H "Authorization: Bearer TOKEN"
```

## Améliorations Futures

- [ ] Intégration avec Google Maps pour la géolocalisation
- [ ] Système de rating pour les livreurs
- [ ] Statistiques de performance en temps réel
- [ ] Support SMS pour les notifications critiques
- [ ] Intégration avec d'autres services de push (OneSignal, etc.)