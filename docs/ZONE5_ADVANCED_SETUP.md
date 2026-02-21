# Zone 5 Advanced Pricing Setup Guide

## Overview

Ce guide explique comment configurer et utiliser la logique de tarification avancée Zone 5 dans AMIGOS.

## Prérequis

- MongoDB connecté
- Services existants (Zone, City, MarginSettings, AdditionalFees)
- Middleware d'authentification configuré

## 1. Configuration des Zones

### Créer la Zone 5

```bash
POST /api/zones
{
  "number": 5,
  "minDistance": 10.0,
  "maxDistance": 20.0,
  "price": 12.5,
  "promoPrice": 7.5,
  "promoPercentage": -40,
  "isPromoActive": true,
  "minGarantieA1": 9,
  "minGarantieA2": 11,
  "minGarantieA3": 9
}
```

### Mettre à jour la ville avec le multiplicateur

```bash
PUT /api/cities/:cityId
{
  "multiplicateur": 0.85
}
```

## 2. Configuration des Marges

### Configurer les marges par scénario

```bash
PUT /api/margin-settings
{
  "C1": {
    "marge": 2.0,
    "minimum": 2.0,
    "maximum": 4.0,
    "description": "1 point livraison"
  },
  "C2": {
    "marge": 3.0,
    "minimum": 2.0,
    "maximum": 4.0,
    "description": "2 points livraison"
  },
  "C3": {
    "marge": 3.75,
    "minimum": 4.5,
    "maximum": 7.5,
    "description": "3 points livraison"
  }
}
```

## 3. Configuration des Frais Additionnels

### Configurer FRAIS_00 (minimum fixe)

```bash
PUT /api/additional-fees
{
  "FRAIS_4": {
    "amount": 2.0,
    "description": "Frais minimum fixe Zone 5",
    "appliesTo": ["ALL"]
  }
}
```

## 4. Utilisation des Frais Avancés

### Activer la logique Zone 5 lors de la création de commande

```bash
POST /api/orders
{
  "client": "clientId",
  "provider": "providerId",
  "items": [...],
  "deliveryAddress": {...},
  "zoneType": "Zone5",
  "useAdvancedCalculation": true
}
```

### Calculer les frais avancés pour une commande existante

```bash
POST /api/advanced-fees/calculate
{
  "orderId": "orderId",
  "delivererId": "delivererId"
}
```

### Mettre à jour une commande avec les frais avancés

```bash
PUT /api/advanced-fees/update-order/orderId
{
  "delivererId": "delivererId"
}
```

### Mise à jour par lot

```bash
POST /api/advanced-fees/batch-update
{
  "orderIds": ["orderId1", "orderId2", "orderId3"],
  "delivererId": "delivererId"
}
```

## 5. Analyse et Comparaison

### Obtenir le détail des frais avancés

```bash
GET /api/advanced-fees/breakdown/orderId
```

### Comparer calcul standard vs avancé

```bash
GET /api/advanced-fees/compare/orderId
```

## 6. Logique de Calcul

### Étape 1: FRAIS_1 (Ajustement selon bornes de marge)
```
Si Minimum ≤ MarGe ≤ Maximum → FRAIS_1 = 0
Si MarGe < Minimum → FRAIS_1 = Minimum − MarGe
Si MarGe > Maximum → FRAIS_1 = Minimum
```

### Étape 2: FRAIS_2 (Correction via montant course)
```
FRAIS_2 = | (MarGe + FRAIS_1 + Tarif_En_Promo) − Montant_Course |
```

### Étape 3: FRAIS_3 (Frais application variables)
```
Si (Montant_Course − (Total − Payout)) > 0 → FRAIS_3 = Montant_Course − (Total − Payout)
Sinon → FRAIS_3 = 0
```

### Étape 4: FRAIS_4 (Frais minimum fixe)
```
Si Prix_Client = 0 → FRAIS_4 = FRAIS_00
Sinon → FRAIS_4 = 0
```

### Étape 5: MarGe_Net_AmiGoS
```
MarGe_Net_AmiGoS = (MarGe + FRAIS_1 + Tarif_En_Promo) − Montant_Course
```

### Étape 6: FRAIS_DE_LIVRAISON
```
Si MarGe_Net_AmiGoS > 0 → FRAIS_DE_LIVRAISON = FRAIS_1 + Tarif_En_Promo
Sinon → FRAIS_DE_LIVRAISON = FRAIS_2 + Tarif_En_Promo
```

### Étape 7: FRAIS_APPLICATION
```
Si FRAIS_3 > 0 → FRAIS_APPLICATION = FRAIS_3
Sinon → FRAIS_APPLICATION = FRAIS_4
```

## 7. Scénarios Testés

### Scénario C1 (Petit panier)
- Prix client: 15 TND
- Frais livraison: 7.5 TND (promo)
- Frais application: 0.35 TND
- Total facturé: 22.85 TND
- Payout livreur: 9.35 TND
- Marge plateforme: 5.65 TND

### Scénario C2 (Panier moyen)
- Prix client: 20 TND
- Payout livreur: 6 TND
- Marge plateforme: 14 TND
- Frais_1 calculé: 2 TND

### Scénario C3 (Grand panier)
- Prix client: 50 TND
- Payout livreur: 48 TND
- Marge plateforme: 2 TND
- Frais_1 calculé: 3.75 TND

## 8. Monitoring et Debug

### Logs disponibles

Les calculs avancés génèrent des logs détaillés :

```javascript
console.log('💰 Platform solde calculated with Zone 5 logic: X TND');
console.log('📊 Advanced Breakdown:', breakdown);
```

### Champs ajoutés aux commandes

- `advancedFees`: Résultat complet du calcul avancé
- `calculationBreakdown`: Détail du calcul pour debugging
- `deliveryFee`: Mis à jour avec FRAIS_DE_LIVRAISON
- `appFee`: Mis à jour avec FRAIS_APPLICATION

## 9. Sécurité et Permissions

- Toutes les routes avancées nécessitent le rôle 'admin'
- Validation des entrées avec messages d'erreur clairs
- Fallback automatique vers le calcul standard en cas d'erreur

## 10. Performance

- Les calculs sont optimisés avec mise en cache des configurations
- Traitement par lot disponible pour multiples commandes
- Indexation appropriée des collections concernées

## 11. Dépannage

### Erreurs communes

1. **Zone non trouvée**: Vérifier que la zone 5 existe et est active
2. **Multiplicateur manquant**: Configurer le multiplicateur dans la ville
3. **Marges non configurées**: Utiliser les routes margin-settings
4. **Livreur non trouvé**: Fournir un delivererId valide

### Solutions

1. Vérifier les logs serveur pour les erreurs détaillées
2. Utiliser la route de comparaison pour identifier les différences
3. Tester avec une commande simple avant le déploiement en production

## 12. Migration

### Pour migrer les commandes existantes

```bash
POST /api/advanced-fees/batch-update
{
  "orderIds": ["all_order_ids_to_migrate"],
  "delivererId": "default_deliverer_id"
}
```

### Validation post-migration

```bash
GET /api/advanced-fees/compare/orderId
```

---

## Support

Pour toute question ou problème, contacter l'équipe de développement AMIGOS.
