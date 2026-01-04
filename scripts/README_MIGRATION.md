# Migration des Horaires de Prestataires

Ce dossier contient les scripts de migration pour ajouter les horaires de travail par défaut à tous les anciens prestataires qui n'en ont pas encore.

## 📋 Description

Le script ajoute automatiquement les horaires par défaut suivants à tous les prestataires sans horaires configurés:
- **Lundi à Jeudi**: 09:00 - 22:00
- **Vendredi**: Fermé
- **Samedi à Dimanche**: 09:00 - 22:00

## 🚀 Utilisation

### Méthode 1: Script Node.js (Recommandée)

```bash
# Aller au dossier du projet
cd BACKEND

# Exécuter le script
node scripts/migrateProviderWorkingHours.js
```

**Avantages:**
- ✅ Validation complète
- ✅ Gestion d'erreurs robuste
- ✅ Logs détaillés
- ✅ Facile à reverter si besoin

### Méthode 2: MongoDB Direct (MongoDB Compass / mongosh)

1. Ouvrir MongoDB Compass ou mongosh
2. Se connecter à la base de données
3. Aller dans l'onglet "Console" ou utiliser mongosh
4. Copier-coller le contenu de `migrateProviderWorkingHours.mongodb`
5. Exécuter la commande

**Avantages:**
- ✅ Rapide
- ✅ Pas de dépendances Node.js

**Désavantages:**
- ⚠️ Moins de validation
- ⚠️ Pas de logs détaillés

## ⚠️ Avant de Démarrer

1. **Sauvegarder la base de données** (backup complet)
2. **Tester sur une copie** de la base de données en développement
3. **Vérifier la connectivité** MongoDB

## 📊 Résultats Attendus

```
🔄 Connexion à la base de données...
✅ Connecté à la base de données

📋 Recherche des prestataires sans horaires...
📍 Trouvé 15 prestataire(s) sans horaires

⏳ Ajout des horaires par défaut...
  ✅ Restaurant ABC (507f1f77bcf86cd799439011)
  ✅ Pharmacie XYZ (507f1f77bcf86cd799439012)
  ...

📊 Migration terminée:
  ✅ Réussi: 15
  ❌ Erreur: 0

🎉 Les horaires par défaut ont été ajoutés avec succès!
```

## 🔍 Vérification

Après la migration, vérifier que tous les prestataires ont des horaires:

```mongodb
// MongoDB Console
db.providers.find({ workingHours: { $exists: false } }).count()
// Résultat attendu: 0
```

Ou vérifier dans l'interface:
1. Aller à la page "Prestataires"
2. Éditer un ancien prestataire
3. Les horaires doivent maintenant s'afficher avec les horaires par défaut

## 🔄 Revert (Si besoin)

Si vous devez annuler la migration:

```mongodb
db.providers.updateMany(
  { /* critère de sélection */ },
  { $unset: { workingHours: "" } }
);
```

## 📝 Notes

- Le script vérifie les prestataires avec `workingHours` vide, null ou non défini
- Les horaires existants ne seront **pas modifiés**
- Le vendredi est configuré comme fermé par défaut (vous pouvez modifier le script)
- La migration est idempotente (exécuter 2 fois = même résultat que 1 fois)
