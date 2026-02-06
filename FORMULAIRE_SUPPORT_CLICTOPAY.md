# 📋 Formulaire de Test ClickToPay - Support Technique

## 🎯 Instructions du Support

Basé sur le document officiel du support, voici les scénarios de test à valider :

---

## ✅ **TESTS COMPATIBLES - Transactions Autorisées**

### Test N° 0001 - Transaction autorisée
- **Description** : Transaction autorisée
- **Numéro de carte** : 4509211111111119
- **Validité** : 1226
- **CVV2** : 748
- **Résultat attendu** : ✅ **Autorisée**
- **🔑 Numéro d'autorisation généré** : `a5e78610-2f73-4ff2-a3cd-6beab0dfa02f`
- **🔗 URL** : [Payer](https://test.clictopay.com/epg/merchants/CLICTOPAY/payment.html?mdOrder=a5e78610-2f73-4ff2-a3cd-6beab0dfa02f&language=fr)

### Test N° 0002 - Transaction autorisée
- **Description** : Transaction autorisée
- **Numéro de carte** : 5440212711111110
- **Validité** : 1226
- **CVV2** : 665
- **Résultat attendu** : ✅ **Autorisée**
- **🔑 Numéro d'autorisation généré** : `2e3ff879-661a-41b9-9b78-b5c458393298`
- **🔗 URL** : [Payer](https://test.clictopay.com/epg/merchants/CLICTOPAY/payment.html?mdOrder=2e3ff879-661a-41b9-9b78-b5c458393298&language=fr)

---

## ❌ **TESTS DE REFUS - Transactions Non Autorisées**

### Test N° 0004 - Plafond atteint
- **Description** : Plafond atteint
- **Numéro de carte** : 4568941111111119
- **Validité** : 1226
- **CVV2** : 257
- **Résultat attendu** : ❌ **Non Autorisée**
- **🔑 Numéro d'autorisation généré** : `8ba293aa-e984-41e1-a5b2-0da98f5d7e87`
- **🔗 URL** : [Payer](https://test.clictopay.com/epg/merchants/CLICTOPAY/payment.html?mdOrder=8ba293aa-e984-41e1-a5b2-0da98f5d7e87&language=fr)

### Test N° 0005 - Solde insuffisant
- **Description** : Solde insuffisant
- **Numéro de carte** : 5104051111111115
- **Validité** : 1226
- **CVV2** : 186
- **Résultat attendu** : ❌ **Non Autorisée**
- **🔑 Numéro d'autorisation généré** : `5e589bad-4842-4e88-a6dd-508bd0c88c58`
- **🔗 URL** : [Payer](https://test.clictopay.com/epg/merchants/CLICTOPAY/payment.html?mdOrder=5e589bad-4842-4e88-a6dd-508bd0c88c58&language=fr)

### Test N° 0007 - Carte non valide
- **Description** : Carte non valide
- **Numéro de carte** : 4557691111111119
- **Validité** : 1226
- **CVV2** : 748
- **Résultat attendu** : ❌ **Non Autorisée**
- **🔑 Numéro d'autorisation généré** : `94dd0a53-6d05-4851-97ac-d3026803f18d`
- **🔗 URL** : [Payer](https://test.clictopay.com/epg/merchants/CLICTOPAY/payment.html?mdOrder=94dd0a53-6d05-4851-97ac-d3026803f18d&language=fr)

### Test N° 0008 - Validité incorrecte
- **Description** : Validité incorrecte
- **Numéro de carte** : 4509211111111119
- **Validité** : 1228
- **CVV2** : 748
- **Résultat attendu** : ❌ **Non Autorisée**
- **🔑 Numéro d'autorisation généré** : `07b68c83-9f6f-4c67-82ac-a3cf1775cc14`
- **🔗 URL** : [Payer](https://test.clictopay.com/epg/merchants/CLICTOPAY/payment.html?mdOrder=07b68c83-9f6f-4c67-82ac-a3cf1775cc14&language=fr)

### Test N° 0009 - CVV2 incorrecte
- **Description** : CVV2 incorrecte
- **Numéro de carte** : 4509211111111119
- **Validité** : 1226
- **CVV2** : 123
- **Résultat attendu** : ❌ **Non Autorisée**
- **🔑 Numéro d'autorisation généré** : `f3d8b51b-983b-4dcc-8ad1-67fe02c0a62b`
- **🔗 URL** : [Payer](https://test.clictopay.com/epg/merchants/CLICTOPAY/payment.html?mdOrder=f3d8b51b-983b-4dcc-8ad1-67fe02c0a62b&language=fr)

---

## 📊 **Tableau de Validation**

| Test N° | Description | Carte | Attendu | Numéro Autorisation | Statut Actuel | ✅ Validé |
|---------|-------------|-------|---------|---------------------|---------------|-----------|
| 0001 | Transaction autorisée | 4509211111111119 | ✅ Autorisée | `a5e78610-2f73-4ff2-a3cd-6beab0dfa02f` | ⏳ À tester | ⬜ |
| 0002 | Transaction autorisée | 5440212711111110 | ✅ Autorisée | `2e3ff879-661a-41b9-9b78-b5c458393298` | ⏳ À tester | ⬜ |
| 0004 | Plafond atteint | 4568941111111119 | ❌ Non Autorisée | `8ba293aa-e984-41e1-a5b2-0da98f5d7e87` | ⏳ À tester | ⬜ |
| 0005 | Solde insuffisant | 5104051111111115 | ❌ Non Autorisée | `5e589bad-4842-4e88-a6dd-508bd0c88c58` | ⏳ À tester | ⬜ |
| 0007 | Carte non valide | 4557691111111119 | ❌ Non Autorisée | `94dd0a53-6d05-4851-97ac-d3026803f18d` | ⏳ À tester | ⬜ |
| 0008 | Validité incorrecte | 4509211111111119 | ❌ Non Autorisée | `07b68c83-9f6f-4c67-82ac-a3cf1775cc14` | ⏳ À tester | ⬜ |
| 0009 | CVV2 incorrecte | 4509211111111119 | ❌ Non Autorisée | `f3d8b51b-983b-4dcc-8ad1-67fe02c0a62b` | ⏳ À tester | ⬜ |

---

## 🔍 **Commandes de Vérification**

```bash
# Vérifier tous les tests en une seule commande
for test in \
  "0001:a5e78610-2f73-4ff2-a3cd-6beab0dfa02f" \
  "0002:2e3ff879-661a-41b9-9b78-b5c458393298" \
  "0004:8ba293aa-e984-41e1-a5b2-0da98f5d7e87" \
  "0005:5e589bad-4842-4e88-a6dd-508bd0c88c58" \
  "0007:94dd0a53-6d05-4851-97ac-d3026803f18d" \
  "0008:07b68c83-9f6f-4c67-82ac-a3cf1775cc14" \
  "0009:f3d8b51b-983b-4dcc-8ad1-67fe02c0a62b"; do
  test_num=$(echo $test | cut -d: -f1)
  order_id=$(echo $test | cut -d: -f2)
  echo "🔍 Test $test_num:"
  result=$(curl -s "http://192.168.1.32:5000/api/payments/verify-clictopay/$order_id")
  status=$(echo $result | jq -r '.data.orderStatus')
  status_name=$(echo $result | jq -r '.data.orderStatusName')
  echo "   Status: $status - $status_name"
  echo "---"
done
```

---

## 📝 **Instructions pour le Support**

1. **Cliquez sur chaque URL de paiement** dans l'ordre des tests
2. **Saisissez les données de carte** exactes comme spécifiées
3. **Notez le résultat** (Autorisé/Refusé)
4. **Vérifiez le statut** avec les commandes ci-dessus
5. **Cochez la case ✅ Validé** quand le résultat correspond à l'attendu

### 🎯 **Critères de Validation Finale**
- ✅ Tests 0001-0002 : `orderStatus = 2` (Autorisé)
- ❌ Tests 0004-0009 : `orderStatus = 6` (Refusé)

---

*Formulaire prêt pour validation du support ClickToPay*
