# WinSMS Quick Reference

## Commandes Essentielles

### Vérifier la Configuration
```bash
# Vérifier les variables d'environnement
grep WINSMS .env

# Résultat attendu :
# WINSMS_API_KEY=votre_cle_api_winsms_ici
# WINSMS_SENDER_ID=votre_sender_id_ici
# WINSMS_API_URL=https://api.winsms.tn/v1/sms/send
```

### Tester la Connexion
```bash
# Test de connexion (sans envoi de SMS)
curl -X GET http://localhost:5000/api/auth/test-winsms \
  -H "Authorization: Bearer VOTRE_TOKEN_SUPER_ADMIN"
```

### Envoyer un SMS de Test
```bash
# Test d'envoi SMS réel
curl -X POST http://localhost:5000/api/auth/winsms/test \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer VOTRE_TOKEN_SUPER_ADMIN" \
  -d '{"phoneNumber": "+21612345678"}'
```

### Vérifier les Logs Récents
```bash
# Dans MongoDB Shell
db.winsmslogs.find().sort({createdAt: -1}).limit(10).pretty()

# Avec MongoDB Compass
# Collection: winsmslogs
# Sort: createdAt (descending)
# Limit: 10
```

### Vérifier le Statut du Service
```bash
# Statut complet du service
curl -X GET http://localhost:5000/api/auth/winsms/status \
  -H "Authorization: Bearer VOTRE_TOKEN_SUPER_ADMIN"

# Health check simple
curl -X GET http://localhost:5000/api/auth/winsms/health \
  -H "Authorization: Bearer VOTRE_TOKEN_SUPER_ADMIN"

# Métriques détaillées
curl -X GET http://localhost:5000/api/auth/winsms/metrics \
  -H "Authorization: Bearer VOTRE_TOKEN_SUPER_ADMIN"
```

### Validation de Configuration
```bash
# Script de validation automatisé
npm run validate:winsms

# Ou directement
node scripts/validateWinSMSConfig.js
```

## Checklist de Déploiement

### Pré-déploiement
- [ ] Compte WinSMS actif et vérifié
- [ ] API Key générée et valide
- [ ] Sender ID approuvé par WinSMS
- [ ] Solde suffisant (> 100 TND recommandé)

### Configuration
- [ ] Variables d'environnement configurées dans `.env`
  - [ ] `WINSMS_API_KEY=votre_cle_api_winsms_ici`
  - [ ] `WINSMS_SENDER_ID=votre_sender_id_ici`
  - [ ] `WINSMS_API_URL=https://api.winsms.tn/v1/sms/send` (optionnel)

### Tests
- [ ] Redémarrage du serveur après configuration
- [ ] Test de connexion réussi (`/test-winsms`)
- [ ] Test d'envoi SMS réussi (`/winsms/test`)
- [ ] Logs de création présents dans `winsmslogs`

### Monitoring
- [ ] Endpoint health fonctionnel (`/winsms/health`)
- [ ] Métriques accessibles (`/winsms/metrics`)
- [ ] Dashboard unifié accessible (`/sms/dashboard`)
- [ ] Alertes configurées pour échecs critiques

### Production
- [ ] Variables d'environnement configurées en production
- [ ] Rotation des API keys planifiée (90 jours)
- [ ] Monitoring des coûts et du solde
- [ ] Documentation partagée avec l'équipe

## Codes d'Erreur Courants

### Erreurs d'Authentification
| Code HTTP | Type | Description | Action |
|-----------|------|-------------|--------|
| 401 | `authentication` | API Key invalide ou expirée | Vérifier `WINSMS_API_KEY` |
| 403 | `forbidden` | Sender ID non approuvé | Contacter support WinSMS |

### Erreurs de Validation
| Code HTTP | Type | Description | Action |
|-----------|------|-------------|--------|
| 400 | `invalid_number` | Format du numéro invalide | Vérifier format `+216XXXXXXXX` |
| 400 | `invalid_sender` | Sender ID invalide | Vérifier `WINSMS_SENDER_ID` |

### Erreurs de Service
| Code HTTP | Type | Description | Action |
|-----------|------|-------------|--------|
| 429 | `rate_limit` | Trop de requêtes | Attendre et réessayer |
| 500 | `insufficient_funds` | Solde insuffisant | Recharger le compte WinSMS |
| timeout | `network` | Erreur réseau/firewall | Vérifier connectivité |

### Erreurs Système
| Code HTTP | Type | Description | Action |
|-----------|------|-------------|--------|
| 503 | `service_unavailable` | Service WinSMS indisponible | Contacter support WinSMS |
| 500 | `internal_error` | Erreur interne AMIGOS | Vérifier logs applicatifs |

## Patterns de Logs

### Logs de Succès
```bash
✓ WinSMS credentials configured
📱 WinSMS: Sending OTP to +21612345678
🔄 [WinSMS] Tentative 1/3 - +21612345678
✓ WinSMS: OTP sent successfully to +21612345678 in 1250ms
```

### Logs d'Erreur
```bash
❌ WinSMS: Failed to send OTP to +21612345678
🚨 [WinSMS] Authentication error detected
❌ WinSMS: Échec envoi OTP à +21612345678 après 3 tentatives (3000ms)
```

### Logs de Diagnostic
```bash
🔍 [WinSMS] Début envoi OTP - Téléphone: +21612345678, Environnement: production
✓ [WinSMS] Validation credentials (cache, age: 120s)
🔍 [WinSMS] Test de connexion - API URL: https://api.winsms.tn/v1/sms/send
```

## Requêtes MongoDB Utiles

### Statistiques des 24 Dernières Heures
```javascript
db.winsmslogs.aggregate([
  {
    $match: {
      createdAt: { $gte: new Date(Date.now() - 24*60*60*1000) }
    }
  },
  {
    $group: {
      _id: "$status",
      count: { $sum: 1 },
      avgResponseTime: { $avg: "$responseTime" }
    }
  }
])
```

### Top 10 des Numéros avec Échecs
```javascript
db.winsmslogs.find({status: "failed"})
  .sort({createdAt: -1})
  .limit(10)
  .forEach(function(doc) {
    print(doc.phoneNumber + " - " + doc.errorDetails);
  })
```

### Taux de Succès par Jour
```javascript
db.winsmslogs.aggregate([
  {
    $group: {
      _id: { $dateToString: { format: "%Y-%m-%d", date: "$createdAt" } },
      total: { $sum: 1 },
      success: { $sum: { $cond: ["$status", "success", 1, 0] } },
      failed: { $sum: { $cond: ["$status", "failed", 1, 0] } }
    }
  },
  {
    $project: {
      date: "$_id",
      total: 1,
      success: 1,
      failed: 1,
      successRate: { $multiply: [{ $divide: ["$success", "$total"] }, 100] }
    }
  },
  { $sort: { date: -1 } }
])
```

## Scripts d'Urgence

### Redémarrage du Service
```bash
# Redémarrer avec logs détaillés
DEBUG=winsms:* npm restart

# Vérifier le statut après redémarrage
curl -X GET http://localhost:5000/api/auth/winsms/health \
  -H "Authorization: Bearer VOTRE_TOKEN_SUPER_ADMIN"
```

### Nettoyage des Logs Anciens
```javascript
// Dans MongoDB Shell - Supprimer les logs de plus de 90 jours
db.winsmslogs.deleteMany({
  createdAt: { $lt: new Date(Date.now() - 90*24*60*60*1000) }
})
```

### Test de Charge
```bash
# Test de charge simple (10 requêtes simultanées)
for i in {1..10}; do
  curl -X POST http://localhost:5000/api/auth/winsms/test \
    -H "Content-Type: application/json" \
    -H "Authorization: Bearer VOTRE_TOKEN_SUPER_ADMIN" \
    -d '{"phoneNumber": "+2161234567'$i'"}' &
done
wait
```

## Contacts et Support

### Support WinSMS
- **Email** : support@winsms.tn
- **Téléphone** : +216 71 XXX XXX
- **Site web** : https://www.winsms.tn/
- **Documentation API** : https://docs.winsms.tn/

### Support AMIGOS
- **Documentation complète** : `docs/WINSMS_SETUP.md`
- **Endpoints monitoring** : `../Docs/WINSMS_MONITORING_ENDPOINTS.md`
- **Logs applicatifs** : Console et collection `winsmslogs`

### Alertes et Monitoring
- **Health check** : `GET /api/auth/winsms/health`
- **Métriques** : `GET /api/auth/winsms/metrics`
- **Dashboard** : `GET /api/auth/sms/dashboard`

---

**Version** : 1.0  
**Dernière mise à jour** : 3 février 2026
