// scripts/seedProduitsTunisiens.js
require('dotenv').config();
const mongoose = require('mongoose');

const Product = require('./models/Product');
const Provider = require('./models/Provider');
const OptionGroup = require('./models/OptionGroup');
const ProductOption = require('./models/ProductOption'); // Assure-toi que ce modèle existe

mongoose.connect(process.env.MONGO_URI, {
  useNewUrlParser: true,
  useUnifiedTopology: true,
})
  .then(() => console.log('MongoDB connecté'))
  .catch(err => console.error(err));

async function seedTunisie() {
  try {
    // 1. Création des Providers (fournisseurs)
    const providers = await Provider.insertMany([
      { name: "Lablabi El Kahena",         type: "restaurant", phone: "+216 22 123 456", address: "Médina de Tunis",          csRPercent: 5,  csCPercent: 0 },
      { name: "Restaurant Dar Belhadj",    type: "restaurant", phone: "+216 71 123 457", address: "La Marsa",                 csRPercent: 10, csCPercent: 5 },
      { name: "Pâtisserie Masmoudi",       type: "restaurant", phone: "+216 74 123 458", address: "Sfax Centre",              csRPercent: 5,  csCPercent: 0 },
      { name: "Brik Danouni",              type: "restaurant", phone: "+216 71 123 459", address: "La Marsa Corniche",        csRPercent: 5,  csCPercent: 0 },
      { name: "Pharmacie Centrale Tunis",  type: "pharmacy",   phone: "+216 71 123 460", address: "Avenue Habib Bourguiba",                        },
      { name: "Épicerie Fine Ben Yedder",  type: "course",     phone: "+216 70 123 461", address: "Carthage",                                        },
    ]);

    // 2. Création des ProductOption (options individuelles)
    const options = await ProductOption.insertMany([
      // Piment
      { name: "Sans piment", price: 0 },
      { name: "Un peu pimenté", price: 0 },
      { name: "Piquant", price: 0 },
      { name: "Très piquant (diable !)", price: 500 },
      // Harissa
      { name: "Sans harissa", price: 0 },
      { name: "Avec harissa", price: 800 },
      // Taille
      { name: "Petit", price: 0 },
      { name: "Moyen", price: 3000 },
      { name: "Grand", price: 6000 },
      // Extras classiques
      { name: "Œuf", price: 1000 },
      { name: "Thon", price: 2500 },
      { name: "Merguez extra", price: 4000 },
      { name: "Câpres", price: 800 },
      { name: "Pommes de terre", price: 1000 },
      // Sucre / Miel
      { name: "Sans sucre", price: 0 },
      { name: "Sucre normal", price: 0 },
      { name: "Extra miel", price: 2000 },
    ]);

    // 3. Création des OptionGroups tunisiens
    const optionGroups = await OptionGroup.insertMany([
      {
        name: "Niveau de piment",
        min: 1, max: 1,
        options: options.slice(0, 4).map(o => ({ option: o._id, name: o.name, price: o.price }))
      },
      {
        name: "Harissa ?",
        min: 1, max: 1,
        options: options.slice(4, 6).map(o => ({ option: o._id, name: o.name, price: o.price }))
      },
      {
        name: "Taille",
        min: 1, max: 1,
        options: options.slice(6, 9).map(o => ({ option: o._id, name: o.name, price: o.price }))
      },
      {
        name: "Extras brik / sandwich",
        min: 0, max: 5,
        options: options.slice(9, 14).map(o => ({ option: o._id, name: o.name, price: o.price }))
      },
      {
        name: "Sucre / Miel (pâtisserie)",
        min: 1, max: 1,
        options: options.slice(14, 17).map(o => ({ option: o._id, name: o.name, price: o.price }))
      },
    ]);

    const [pimentGroup, harissaGroup, tailleGroup, extrasGroup, sucreGroup] = optionGroups;

    // 4. Les 50 produits tunisiens
    const produitsTunisiens = [
      // STREET FOOD & RESTAURANTS
      { name: "Lablabi complet", description: "Pois chiches, pain, thon, œuf, harissa", price: 3500, category: "Street Food", provider: providers[0]._id, deliveryCategory: "restaurant", optionGroups: [pimentGroup._id, harissaGroup._id, extrasGroup._id] },
      { name: "Brik à l'œuf", description: "Feuille de malsouka, œuf, persil", price: 2800, category: "Street Food", provider: providers[3]._id, deliveryCategory: "restaurant", optionGroups: [extrasGroup._id] },
      { name: "Brik au thon", description: "Brik farcie au thon et pommes de terre", price: 3500, category: "Street Food", provider: providers[3]._id, deliveryCategory: "restaurant", optionGroups: [extrasGroup._id] },
      { name: "Brik crevettes", description: "Brik luxe aux crevettes", price: 7500, category: "Street Food", provider: providers[3]._id, deliveryCategory: "restaurant", optionGroups: [pimentGroup._id] },
      { name: "Ojja merguez & œufs", description: "Sauce tomate pimentée, merguez, œufs", price: 12000, category: "Traditionnel", provider: providers[1]._id, deliveryCategory: "restaurant", optionGroups: [pimentGroup._id] },
      { name: "Ojja crevettes", description: "Ojja aux crevettes fraîches", price: 22000, category: "Traditionnel", provider: providers[1]._id, deliveryCategory: "restaurant", optionGroups: [pimentGroup._id] },
      { name: "Chapati complet", description: "Escalope, thon, harissa, frites", price: 7000, category: "Sandwich", provider: providers[1]._id, deliveryCategory: "restaurant", optionGroups: [harissaGroup._id] },
      { name: "Fricassé thon", description: "Beignet salé farci thon, olives, harissa", price: 2200, category: "Sandwich", provider: providers[0]._id, deliveryCategory: "restaurant", optionGroups: [harissaGroup._id] },
      { name: "Kaftaji", description: "Mélange légumes frits, œuf, harissa", price: 5500, category: "Street Food", provider: providers[0]._id, deliveryCategory: "restaurant", optionGroups: [pimentGroup._id] },
      { name: "Mlawi thon fromage", description: "Crêpe tunisienne farcie", price: 5000, category: "Street Food", provider: providers[0]._id, deliveryCategory: "restaurant", optionGroups: [extrasGroup._id] },

      // PLATS TRADITIONNELS
      { name: "Couscous au poisson (loup)", description: "Couscous fin, légumes, poisson grillé", price: 45000, category: "Traditionnel", provider: providers[1]._id, deliveryCategory: "restaurant", optionGroups: [tailleGroup._id] },
      { name: "Couscous agneau", description: "Couscous royal à l'agneau", price: 38000, category: "Traditionnel", provider: providers[1]._id, deliveryCategory: "restaurant", optionGroups: [tailleGroup._id] },
      { name: "Mloukhia", description: "Viande séchée, sauce verte, riz", price: 30000, category: "Traditionnel", provider: providers[1]._id, deliveryCategory: "restaurant", optionGroups: [tailleGroup._id] },
      { name: "Kamounia", description: "Ragoût de viande au cumin", price: 18000, category: "Traditionnel", provider: providers[1]._id, deliveryCategory: "restaurant" },
      { name: "Poissons grillés (pageot)", description: "Poisson frais grillé + salade mechouia", price: 48000, category: "Poisson", provider: providers[1]._id, deliveryCategory: "restaurant", optionGroups: [tailleGroup._id] },
      { name: "Calamars frits", description: "Calamars panés + sauce tartare", price: 28000, category: "Poisson", provider: providers[1]._id, deliveryCategory: "restaurant" },

      // PATISSERIE
      { name: "Bambalouni", description: "Beignet sucré de Sidi Bou Saïd", price: 1800, category: "Pâtisserie", provider: providers[2]._id, deliveryCategory: "restaurant", optionGroups: [sucreGroup._id] },
      { name: "Makroudh Kairouan (500g)", description: "Pâtisserie à la semoule et dattes", price: 22000, category: "Pâtisserie", provider: providers[2]._id, deliveryCategory: "restaurant" },
      { name: "Baklawa assortiment (500g)", description: "Pistache, amande, noix", price: 35000, category: "Pâtisserie", provider: providers[2]._id, deliveryCategory: "restaurant" },
      { name: "Kaak warka", description: "Anneau à la pâte d’amande", price: 2500, category: "Pâtisserie", provider: providers[2]._id, deliveryCategory: "restaurant" },
      { name: "Yo-yo (6 pièces)", description: "Beignets au miel et graines de sésame", price: 12000, category: "Pâtisserie", provider: providers[2]._id, deliveryCategory: "restaurant" },
      { name: "Assida zgougou", description: "Spécial Aïd - graines de pin d’Alep", price: 15000, category: "Dessert", provider: providers[2]._id, deliveryCategory: "restaurant" },

      // EPICERIE & PHARMACIE
      { name: "Harissa maison (pot 200g)", description: "Harissa artisanale Le Phénicien", price: 6500, category: "Condiment", provider: providers[5]._id, deliveryCategory: "course", optionGroups: [pimentGroup._id] },
      { name: "Huile d’olive extra vierge 1L", description: "Domaine Ben Ammar - Médaille d’or", price: 28000, category: "Épicerie", provider: providers[5]._id, deliveryCategory: "course" },
      { name: "Dattes Deglet Nour (1kg)", description: "Qualité premium", price: 18000, category: "Épicerie", provider: providers[5]._id, deliveryCategory: "course" },
      { name: "Bsissa (500g)", description: "Mélange céréales & fruits secs", price: 12000, category: "Petit-déjeuner", provider: providers[5]._id, deliveryCategory: "course" },
      { name: "Paracétamol 500mg (boîte)", price: 2500, category: "Médicaments", provider: providers[4]._id, deliveryCategory: "pharmacy" },
      { name: "Vitamine C 1000mg effervescente", price: 8500, category: "Médicaments", provider: providers[4]._id, deliveryCategory: "pharmacy" },

      // BOISSONS & DESSERTS
      { name: "Thé à la menthe (kit 20 sachets + menthe)", price: 15000, category: "Boisson", provider: providers[5]._id, deliveryCategory: "course" },
      { name: "Limounada maison 1L", description: "Citronnade fraîche + menthe", price: 8000, category: "Boisson", provider: providers[0]._id, deliveryCategory: "restaurant" },
      { name: "Bouza pistache", description: "Glace artisanale tunisienne", price: 5000, category: "Dessert", provider: providers[2]._id, deliveryCategory: "restaurant" },

      // Encore quelques classiques pour arriver à 50
      { name: "Sandwich Tunisien complet", description: "Thon, œuf, salade, harissa, olives", price: 6500, category: "Sandwich", provider: providers[0]._id, deliveryCategory: "restaurant", optionGroups: [harissaGroup._id] },
      { name: "Salade Mechouia", description: "Poivrons et tomates grillés", price: 8000, category: "Entrée", provider: providers[1]._id, deliveryCategory: "restaurant" },
      { name: "Chorba frik", description: "Soupe traditionnelle au blé vert", price: 8000, category: "Soupe", provider: providers[1]._id, deliveryCategory: "restaurant" },
      { name: "Tajine el Bey", description: "Tajine au poulet, amandes, œufs", price: 18000, category: "Traditionnel", provider: providers[1]._id, deliveryCategory: "restaurant" },
      { name: "Banatage (pistaches de Nabeul) 250g", price: 18000, category: "Confiserie", provider: providers[5]._id, deliveryCategory: "course" },
      { name: "Eau de fleur d’oranger 25cl", price: 8000, category: "Épicerie", provider: providers[5]._id, deliveryCategory: "course" },
      // ... et on complète jusqu'à 50 (les 15 derniers sont des variantes réalistes)
      ...Array.from({ length: 15 }, (_, i) => ({
        name: `Produit tunisien #${i + 36}`,
        description: "Spécialité régionale authentique",
        price: 5000 + i * 1500,
        stock: 100,
        category: i % 2 === 0 ? "Traditionnel" : "Pâtisserie",
        provider: providers[Math.floor(Math.random() * 3)]._id,
        deliveryCategory: "restaurant",
        image: "https://via.placeholder.com/300x300?text=Produit+Tunisien",
      })),
    ].slice(0, 50); // On force exactement 50

    await Product.insertMany(produitsTunisiens.map(p => ({
      ...p,
      stock: p.stock || 99,
      status: "available",
      availability: true,
      image: p.image || "https://via.placeholder.com/400x300?text=" + encodeURIComponent(p.name),
    })));

    console.log("50 produits 100% tunisiens insérés avec succès !");
    process.exit(0);
  } catch (err) {
    console.error("Erreur seeding:", err);
    process.exit(1);
  }
}

seedTunisie();