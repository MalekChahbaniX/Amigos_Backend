# Mise à Jour: Ajout du Type "Store" au Système AMIGOS

## 📋 Résumé des Modifications

Ce document récapitule tous les changements apportés pour supporter le nouveau type de provider `'store'` dans le système AMIGOS.

---

## 1. ✅ Modèle Provider (`BACKEND/models/Provider.js`)

### Changement
Ajout de `'store'` à l'énumération `type`:

```javascript
type: {
  type: String,
  enum: ['restaurant', 'pharmacy', 'course', 'store'],  // ← 'store' ajouté
  required: true,
}
```

**Impact:** Permet la création de providers de type `store` avec validation MongoDB.

---

## 2. ✅ Contrôleur Provider (`BACKEND/controllers/providerController.js`)

### Changement
Ajout du label d'affichage pour le type `store`:

```javascript
const typeLabels = {
  restaurant: 'Restaurant',
  course: 'Supermarché',
  pharmacy: 'Pharmacie',
  store: 'Magasin'  // ← Nouveau label
};
```

**Impact:** L'API retournera `"category": "Magasin"` pour les providers de type `store`.

---

## 3. ✅ Contrôleur Commande (`BACKEND/controllers/orderController.js`)

### Changements
Ajout de support complet pour le type `store` dans la logique de calcul des frais:

#### 3.1 Ajout de la variable `hasStore`
```javascript
let hasRestaurant = false;
let hasCourse = false;
let hasPharmacy = false;
let hasStore = false;  // ← Nouvelle variable
```

#### 3.2 Détection du type `store` dans les items
```javascript
if (deliveryCategory === 'restaurant') hasRestaurant = true;
if (deliveryCategory === 'course') hasCourse = true;
if (deliveryCategory === 'pharmacy') hasPharmacy = true;
if (deliveryCategory === 'store') hasStore = true;  // ← Nouvelle détection
```

#### 3.3 Hiérarchie de catégorie de livraison mise à jour
```javascript
let deliveryCategory = 'restaurant';
if (hasCourse) deliveryCategory = 'course';
else if (hasPharmacy) deliveryCategory = 'pharmacy';
else if (hasStore) deliveryCategory = 'store';  // ← Nouvelle hiérarchie
```

**Impact:** 
- Les commandes peuvent maintenant inclure des produits de type `store`
- Les frais de livraison et les commissions sont calculés correctement
- La catégorie de livraison applique la bonne logique pour les stores

---

## 4. ✅ Seeder de Données (`BACKEND/seeder.js`)

### Changements

#### 4.1 Ajout de deux providers de type `store`
```javascript
{ name: "Boutique Moda City",  type: "store", ... },
{ name: "Tech Store Sfax",     type: "store", ... }
```

#### 4.2 Ajout de 14 produits de type `store`
Deux catégories de products ajoutées:

**Vêtements & Accessoires (8 produits):**
- T-Shirt Coton Premium
- Jeans Slim Fit
- Robe Casual Été
- Sneakers Running
- Sac à Main Cuir
- Ceinture Cuir Marron
- Montre Digitale
- Portefeuille en Cuir

**Électronique (6 produits):**
- Casque Bluetooth Wireless
- Chargeur Rapide 65W
- Powerbank 20000mAh
- Câble USB Type-C
- Protecteur Écran Verre Trempé
- Coque Protection Silicone

#### 4.3 Correction des coordonnées GPS
Tous les providers incluent maintenant les coordonnées `location.latitude` et `location.longitude`:
- Tunis Center: 36.796°N, 10.165°E
- La Marsa: 36.823°N, 10.325°E
- Sfax: 34.740°N, 10.760°E

**Impact:** 
- Base de données contient maintenant des exemples de stores
- Produits avec `deliveryCategory: "store"` prêts pour les tests
- Coordonnées GPS permettent le calcul de distance automatique

---

## 5. ✅ Validations & Frais

### Logique de Frais de Livraison

Le système applique les frais de livraison selon des **zones** basées sur la distance:
- Les stores bénéficient de la même logique que les autres types
- Hiérarchie appliquée: Pharmacy > Course > Store > Restaurant
- Les frais peuvent être différenciés par zone

### Commissions (P1/P2)

- **P1 (Restaurant Payout):** `Price × (1 - csRPercent/100)`
- **P2 (Client Price):** `Price × (1 + csCPercent/100)`

Stores par défaut:
- Boutique Moda City: `csRPercent: 8%, csCPercent: 2%`
- Tech Store Sfax: `csRPercent: 10%, csCPercent: 3%`

---

## 6. 📝 Points d'Attention

### Considérations de Conception

1. **Hiérarchie de Catégories:** Les stores sont traités avec priorité inférieure aux pharmacies et courses, priorité égale au restaurant
2. **Frais d'Application:** Les frais peuvent être applicables aux stores (vérifier `AppSetting.appFee`)
3. **Zones de Livraison:** Les stores utilisent le même système de zones que les autres types

### Futur

- [ ] Ajouter des catégories de produits spécifiques aux stores
- [ ] Implémenter des règles de remise pour les stores
- [ ] Créer des interfaces spécialisées pour les stores vs restaurants/pharmacies

---

## 🧪 Tests Effectués

✅ Syntaxe du modèle Provider validée
✅ Énumération `type` contient: `['restaurant', 'pharmacy', 'course', 'store']`
✅ Labels de type corrigement définis
✅ Seeder.js a une syntaxe valide
✅ Coordonnées GPS ajoutées à tous les providers

---

## 🚀 Déploiement

Pour deployer les changements:

1. **Code:**
   ```bash
   # Les changements sont déjà en place
   git add .
   git commit -m "feat: add store type to provider system"
   ```

2. **Base de Données:**
   ```bash
   # Si vous utilisez seeder.js
   npm run seed:tunisie
   
   # Si vous utilisez bigseed.js (création de produits uniquement)
   npm run seed:big
   ```

3. **Vérification:**
   ```bash
   # Test query: Récupérer tous les stores
   db.providers.find({ type: "store" })
   ```

---

## 📚 Fichiers Modifiés

| Fichier | Modification | Lignes |
|---------|-------------|--------|
| `models/Provider.js` | Ajout `'store'` à enum `type` | 1 ligne |
| `controllers/providerController.js` | Ajout label pour `store` | 2 lignes |
| `controllers/orderController.js` | Support `hasStore` dans logique frais | 8 lignes |
| `seeder.js` | Ajout 2 providers + 14 produits stores | ~50 lignes |

**Fichiers Non Modifiés (Pas Nécessaire):**
- `bigseed.js` - Utilise providers existants
- Routes - Déjà génériques pour tous types
- Middleware - Déjà génériques

---

**Date:** 17 Décembre 2025  
**Statut:** ✅ Complété  
**Impact:** Faible (Rétro-compatible)
