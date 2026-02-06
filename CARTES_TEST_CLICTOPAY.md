# 📋 Cartes de Test ClickToPay - Numéros d'Autorisation

## 🎯 Objectif
Obtenir les numéros d'autorisation pour chaque carte de test afin de valider le support technique avant la mise en production.

---

## 📊 Résultats des Tests

| # | Carte Bancaire | Expire | CVV | Montant | 🔑 **Numéro d'Autorisation** | 🔗 URL de Paiement | Statut |
|---|----------------|---------|-----|---------|------------------------------|-------------------|--------|
| 1 | 4509211111111119 | 12/26 | 748 | 10 DT | `a5e78610-2f73-4ff2-a3cd-6beab0dfa02f` | [Payer](https://test.clictopay.com/epg/merchants/CLICTOPAY/payment.html?mdOrder=a5e78610-2f73-4ff2-a3cd-6beab0dfa02f&language=fr) | ⏳ En attente |
| 2 | 5440212711111110 | 12/26 | 665 | 12 DT | `2e3ff879-661a-41b9-9b78-b5c458393298` | [Payer](https://test.clictopay.com/epg/merchants/CLICTOPAY/payment.html?mdOrder=2e3ff879-661a-41b9-9b78-b5c458393298&language=fr) | ⏳ En attente |
| 3 | 4568941111111119 | 12/26 | 257 | 15 DT | `8ba293aa-e984-41e1-a5b2-0da98f5d7e87` | [Payer](https://test.clictopay.com/epg/merchants/CLICTOPAY/payment.html?mdOrder=8ba293aa-e984-41e1-a5b2-0da98f5d7e87&language=fr) | ⏳ En attente |
| 4 | 5104051111111115 | 12/26 | 186 | 18 DT | `5e589bad-4842-4e88-a6dd-508bd0c88c58` | [Payer](https://test.clictopay.com/epg/merchants/CLICTOPAY/payment.html?mdOrder=5e589bad-4842-4e88-a6dd-508bd0c88c58&language=fr) | ⏳ En attente |
| 5 | 4557691111111119 | 12/26 | 748 | 20 DT | `94dd0a53-6d05-4851-97ac-d3026803f18d` | [Payer](https://test.clictopay.com/epg/merchants/CLICTOPAY/payment.html?mdOrder=94dd0a53-6d05-4851-97ac-d3026803f18d&language=fr) | ⏳ En attente |
| 6 | 4509211111111119 | 12/26 | 123 | 22 DT | `f3d8b51b-983b-4dcc-8ad1-67fe02c0a62b` | [Payer](https://test.clictopay.com/epg/merchants/CLICTOPAY/payment.html?mdOrder=f3d8b51b-983b-4dcc-8ad1-67fe02c0a62b&language=fr) | ⏳ En attente |
| 7 | 4509211111111119 | 12/28 | 748 | 25 DT | `07b68c83-9f6f-4c67-82ac-a3cf1775cc14` | [Payer](https://test.clictopay.com/epg/merchants/CLICTOPAY/payment.html?mdOrder=07b68c83-9f6f-4c67-82ac-a3cf1775cc14&language=fr) | ⏳ En attente |

---

## 🔄 Étapes Suivantes

### 1. Compléter les Paiements
Pour chaque carte, cliquez sur le lien "Payer" et saisissez :
- **Numéro de carte** : celui indiqué dans le tableau
- **Date d'expiration** : celle indiquée 
- **CVV** : celui indiqué
- **Nom** : TEST USER

### 2. Vérifier les Statuts
Après chaque paiement, vérifiez le statut avec :

```bash
curl -X GET "http://192.168.1.32:5000/api/payments/verify-clictopay/[NUMERO_AUTORISATION]"
```

**Statut attendu pour validation :** `orderStatus = 2` (autorisé ✅)

### 3. Mettre à jour ce tableau
Une fois les paiements complétés, mettez à jour le statut :
- ✅ **Autorisé** (orderStatus = 2)
- ❌ **Refusé** (orderStatus = 6)
- ⏳ **En attente** (orderStatus = 0)

---

## 📈 Validation Technique

### ✅ Critères de Validation
- [ ] Tous les `orderStatus = 2` pour les cartes valides
- [ ] Les numéros d'autorisation sont uniques
- [ ] Les URLs de paiement fonctionnent
- [ ] Les callbacks de succès/échec fonctionnent
- [ ] La base de données enregistre correctement les transactions

### 🎯 Passage en Production
Une fois tous les critères validés :
1. **Mettre à jour** les variables d'environnement vers la production
2. **Configurer** les URLs de callback de production
3. **Tester** avec l'API ClickToPay de production
4. **Déployer** en production

---

## 🔍 Commandes de Vérification Rapide

```bash
# Vérifier tous les paiements d'un coup
for order_id in \
  "a5e78610-2f73-4ff2-a3cd-6beab0dfa02f" \
  "2e3ff879-661a-41b9-9b78-b5c458393298" \
  "8ba293aa-e984-41e1-a5b2-0da98f5d7e87" \
  "5e589bad-4842-4e88-a6dd-508bd0c88c58" \
  "94dd0a53-6d05-4851-97ac-d3026803f18d" \
  "f3d8b51b-983b-4dcc-8ad1-67fe02c0a62b" \
  "07b68c83-9f6f-4c67-82ac-a3cf1775cc14"; do
  echo "🔍 Vérification: $order_id"
  curl -s "http://192.168.1.32:5000/api/payments/verify-clictopay/$order_id" | jq -r '.data | "Status: \(.orderStatus) - \(.orderStatusName)"'
  echo "---"
done
```

---

*Document généré automatiquement - Dernière mise à jour: $(date)*
