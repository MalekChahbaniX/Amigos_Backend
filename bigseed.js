// seeders/productSeeder.js
const mongoose = require('mongoose');
const Product = require('./models/Product');
const Provider = require('./models/Provider');
const OptionGroup = require('./models/OptionGroup');
const ProductOption = require('./models/ProductOption');
const dotenv = require('dotenv');
dotenv.config();
// Restaurant categories
const restaurantCategories = [
  'Plats Principaux',
  'Entrées',
  'Desserts',
  'Boissons',
  'Salades',
  'Sandwichs',
  'Pizzas',
  'Burgers',
  'Sushis',
  'Pâtes'
];

// Pharmacy categories
const pharmacyCategories = [
  'Médicaments',
  'Soins du Visage',
  'Soins du Corps',
  'Hygiène Bucco-Dentaire',
  'Premiers Secours',
  'Vitamines',
  'Soins Bébé',
  'Produits Naturels'
];

// Supermarket categories
const supermarketCategories = [
  'Fruits et Légumes',
  'Produits Laitiers',
  'Viandes et Poissons',
  'Épicerie Sucrée',
  'Épicerie Salée',
  'Boissons',
  'Surgelés',
  'Hygiène et Beauté'
];

// Restaurant products
const restaurantProducts = [
  // Plats Principaux
  { name: 'Poulet Rôti aux Herbes', price: 18.50, category: 'Plats Principaux' },
  { name: 'Saumon Grillé Citronné', price: 22.00, category: 'Plats Principaux' },
  { name: 'Bœuf Bourguignon', price: 24.50, category: 'Plats Principaux' },
  { name: 'Risotto aux Champignons', price: 16.00, category: 'Plats Principaux' },
  { name: 'Lasagnes Bolognaise', price: 17.50, category: 'Plats Principaux' },
  
  // Entrées
  { name: 'Soupe à l\'Oignon', price: 8.00, category: 'Entrées' },
  { name: 'Salade César', price: 12.00, category: 'Entrées' },
  { name: 'Bruschetta Tomate-Mozzarella', price: 9.50, category: 'Entrées' },
  { name: 'Tartare de Saumon', price: 14.00, category: 'Entrées' },
  
  // Desserts
  { name: 'Tiramisu Classique', price: 7.50, category: 'Desserts' },
  { name: 'Fondant au Chocolat', price: 8.00, category: 'Desserts' },
  { name: 'Crème Brûlée', price: 7.00, category: 'Desserts' },
  { name: 'Tarte aux Pommes', price: 6.50, category: 'Desserts' },
  
  // Boissons
  { name: 'Jus d\'Orange Pressé', price: 4.50, category: 'Boissons' },
  { name: 'Coca-Cola', price: 3.50, category: 'Boissons' },
  { name: 'Eau Minérale', price: 2.50, category: 'Boissons' },
  { name: 'Vin Rouge Maison', price: 5.00, category: 'Boissons' },
  
  // Salades
  { name: 'Salade Niçoise', price: 13.50, category: 'Salades' },
  { name: 'Salade de Chèvre Chaud', price: 12.50, category: 'Salades' },
  
  // Sandwichs
  { name: 'Club Sandwich Poulet', price: 9.50, category: 'Sandwichs' },
  { name: 'Panini Jambon-Fromage', price: 8.00, category: 'Sandwichs' },
  
  // Pizzas
  { name: 'Pizza Margherita', price: 12.00, category: 'Pizzas' },
  { name: 'Pizza 4 Fromages', price: 14.50, category: 'Pizzas' },
  { name: 'Pizza Royale', price: 16.00, category: 'Pizzas' },
  
  // Burgers
  { name: 'Burger Classique', price: 13.50, category: 'Burgers' },
  { name: 'Burger Végétarien', price: 12.00, category: 'Burgers' },
  { name: 'Burger Bacon Cheese', price: 15.50, category: 'Burgers' },
  
  // Sushis
  { name: 'Assortiment Sushis', price: 18.00, category: 'Sushis' },
  { name: 'California Roll', price: 9.50, category: 'Sushis' },
  { name: 'Sashimi Saumon', price: 12.00, category: 'Sushis' },
  
  // Pâtes
  { name: 'Spaghetti Carbonara', price: 14.00, category: 'Pâtes' },
  { name: 'Penne Arrabbiata', price: 12.50, category: 'Pâtes' },
  
  // Additional products to reach 50
  { name: 'Plateau de Fromages', price: 16.00, category: 'Plats Principaux' },
  { name: 'Côte de Bœuf', price: 28.00, category: 'Plats Principaux' },
  { name: 'Magret de Canard', price: 21.50, category: 'Plats Principaux' },
  { name: 'Soupe du Jour', price: 6.50, category: 'Entrées' },
  { name: 'Assiette de Charcuterie', price: 11.00, category: 'Entrées' },
  { name: 'Mousse au Chocolat', price: 6.00, category: 'Desserts' },
  { name: 'Café Gourmand', price: 8.50, category: 'Desserts' },
  { name: 'Thé Vert', price: 3.00, category: 'Boissons' },
  { name: 'Jus de Pomme', price: 4.00, category: 'Boissons' },
  { name: 'Salade Grecque', price: 11.50, category: 'Salades' },
  { name: 'Sandwich Thon-Crudités', price: 7.50, category: 'Sandwichs' },
  { name: 'Pizza Végétarienne', price: 13.50, category: 'Pizzas' },
  { name: 'Burger Poulet', price: 14.00, category: 'Burgers' },
  { name: 'Maki Avocat', price: 8.50, category: 'Sushis' },
  { name: 'Tagliatelles Saumon', price: 15.50, category: 'Pâtes' }
];

// Pharmacy products
const pharmacyProducts = [
  { name: 'Paracétamol 500mg', price: 3.50, category: 'Médicaments' },
  { name: 'Ibuprofène 400mg', price: 4.20, category: 'Médicaments' },
  { name: 'Vitamine C 1000mg', price: 8.50, category: 'Vitamines' },
  { name: 'Multivitamines', price: 12.00, category: 'Vitamines' },
  { name: 'Crème Hydratante Visage', price: 15.00, category: 'Soins du Visage' },
  { name: 'Gel Douche Hydratant', price: 6.50, category: 'Soins du Corps' },
  { name: 'Dentifrice Blanchissant', price: 4.80, category: 'Hygiène Bucco-Dentaire' },
  { name: 'Brosse à Dents Électrique', price: 35.00, category: 'Hygiène Bucco-Dentaire' },
  { name: 'Pansements Adhésifs', price: 3.20, category: 'Premiers Secours' },
  { name: 'Désinfectant Cutané', price: 5.50, category: 'Premiers Secours' },
  { name: 'Lait Corporel Bébé', price: 8.00, category: 'Soins Bébé' },
  { name: 'Couches Taille 3', price: 12.50, category: 'Soins Bébé' },
  { name: 'Huile d\'Argan Bio', price: 18.00, category: 'Produits Naturels' },
  { name: 'Gel Aloe Vera', price: 9.50, category: 'Produits Naturels' },
  { name: 'Serum Anti-âge', price: 25.00, category: 'Soins du Visage' },
  { name: 'Baume à Lèvres', price: 3.50, category: 'Soins du Visage' },
  { name: 'Shampooing Antipelliculaire', price: 7.80, category: 'Soins du Corps' },
  { name: 'After-shave Apaisant', price: 12.50, category: 'Soins du Corps' },
  { name: 'Bain de Bouche', price: 6.00, category: 'Hygiène Bucco-Dentaire' },
  { name: 'Fil Dentaire', price: 2.50, category: 'Hygiène Bucco-Dentaire' },
  { name: 'Thermomètre Digital', price: 15.00, category: 'Premiers Secours' },
  { name: 'Compresses Stériles', price: 4.00, category: 'Premiers Secours' },
  { name: 'Lingettes Bébé', price: 5.50, category: 'Soins Bébé' },
  { name: 'Biberon 250ml', price: 8.50, category: 'Soins Bébé' },
  { name: 'Spray Nasal Salin', price: 6.80, category: 'Médicaments' },
  { name: 'Sirop Toux Sèche', price: 7.50, category: 'Médicaments' },
  { name: 'Oméga 3', price: 14.00, category: 'Vitamines' },
  { name: 'Vitamine D3', price: 9.00, category: 'Vitamines' },
  { name: 'Gelée Royale', price: 22.00, category: 'Produits Naturels' },
  { name: 'Infusion Détox', price: 5.50, category: 'Produits Naturels' }
];

// Supermarket products
const supermarketProducts = [
  { name: 'Pommes Golden', price: 3.50, category: 'Fruits et Légumes' },
  { name: 'Bananes', price: 2.80, category: 'Fruits et Légumes' },
  { name: 'Carottes', price: 2.20, category: 'Fruits et Légumes' },
  { name: 'Lait Entier', price: 1.20, category: 'Produits Laitiers' },
  { name: 'Yaourt Nature', price: 0.80, category: 'Produits Laitiers' },
  { name: 'Fromage Emmental', price: 8.50, category: 'Produits Laitiers' },
  { name: 'Steak Haché 15%', price: 6.50, category: 'Viandes et Poissons' },
  { name: 'Filet de Poulet', price: 9.00, category: 'Viandes et Poissons' },
  { name: 'Saumon Fumé', price: 12.00, category: 'Viandes et Poissons' },
  { name: 'Pâtes Spaghetti', price: 1.50, category: 'Épicerie Salée' },
  { name: 'Riz Basmati', price: 3.00, category: 'Épicerie Salée' },
  { name: 'Sauce Tomate', price: 2.20, category: 'Épicerie Salée' },
  { name: 'Céréales Chocolat', price: 4.00, category: 'Épicerie Sucrée' },
  { name: 'Confiture Fraise', price: 3.20, category: 'Épicerie Sucrée' },
  { name: 'Biscuits Chocolat', price: 2.80, category: 'Épicerie Sucrée' },
  { name: 'Eau Pétillante', price: 0.90, category: 'Boissons' },
  { name: 'Jus d\'Orange', price: 2.50, category: 'Boissons' },
  { name: 'Café Moulu', price: 5.50, category: 'Boissons' },
  { name: 'Pizza Surgelée', price: 4.50, category: 'Surgelés' },
  { name: 'Légumes Surgelés', price: 3.20, category: 'Surgelés' },
  { name: 'Glace Vanille', price: 5.00, category: 'Surgelés' },
  { name: 'Shampooing', price: 4.80, category: 'Hygiène et Beauté' },
  { name: 'Savon Liquide', price: 3.50, category: 'Hygiène et Beauté' },
  { name: 'Dentifrice', price: 2.80, category: 'Hygiène et Beauté' },
  { name: 'Tomates', price: 3.00, category: 'Fruits et Légumes' },
  { name: 'Beurre Demi-sel', price: 2.50, category: 'Produits Laitiers' },
  { name: 'Côtelettes d\'Agneau', price: 11.00, category: 'Viandes et Poissons' },
  { name: 'Huile d\'Olive', price: 6.50, category: 'Épicerie Salée' },
  { name: 'Miel', price: 7.00, category: 'Épicerie Sucrée' },
  { name: 'Thé Vert', price: 4.20, category: 'Boissons' }
];

// Option groups for restaurant
const optionGroupsData = [
  { name: 'Choix de Cuisson', description: 'Comment souhaitez-vous votre viande ?', min: 1, max: 1 },
  { name: 'Accompagnements', description: 'Choisissez vos accompagnements', min: 1, max: 3 },
  { name: 'Sauces', description: 'Sélectionnez vos sauces', min: 0, max: 2 },
  { name: 'Suppléments', description: 'Ajoutez des suppléments', min: 0, max: 5 },
  { name: 'Boissons Incluses', description: 'Boissons comprises avec le menu', min: 1, max: 1 },
  { name: 'Type de Pâte', description: 'Choix du type de pâtes', min: 1, max: 1 },
  { name: 'Garnitures Pizza', description: 'Personnalisez votre pizza', min: 0, max: 5 },
  { name: 'Cuisson Pizza', description: 'Comment souhaitez-vous votre pizza ?', min: 1, max: 1 },
  { name: 'Type de Riz', description: 'Choix du type de riz pour les sushis', min: 1, max: 1 },
  { name: 'Sauces Sushi', description: 'Sauces accompagnant les sushis', min: 0, max: 3 },
  { name: 'Garnitures Burger', description: 'Personnalisez votre burger', min: 0, max: 4 },
  { name: 'Type de Pain', description: 'Choix du pain pour sandwich/burger', min: 1, max: 1 },
  { name: 'Desserts du Jour', description: 'Sélectionnez votre dessert', min: 0, max: 1 },
  { name: 'Café et Thés', description: 'Choix de boissons chaudes', min: 0, max: 1 },
  { name: 'Options Végétariennes', description: 'Alternatives végétariennes', min: 0, max: 2 }
];

// Options for restaurant
const productOptionsData = [
  // Cuisson options
  { name: 'Bleu', price: 0 },
  { name: 'Saignant', price: 0 },
  { name: 'À Point', price: 0 },
  { name: 'Bien Cuit', price: 0 },
  
  // Accompagnements
  { name: 'Frites Maison', price: 3.50 },
  { name: 'Purée de Pommes de Terre', price: 3.00 },
  { name: 'Légumes Grillés', price: 4.00 },
  { name: 'Riz Basmati', price: 2.50 },
  { name: 'Salade Verte', price: 2.00 },
  { name: 'Pommes de Terre Rôties', price: 3.50 },
  
  // Sauces
  { name: 'Sauce Béarnaise', price: 1.50 },
  { name: 'Sauce au Poivre', price: 1.50 },
  { name: 'Sauce Bourguignonne', price: 1.50 },
  { name: 'Sauce Hollandaise', price: 2.00 },
  { name: 'Ketchup', price: 0.50 },
  { name: 'Mayonnaise', price: 0.50 },
  
  // Suppléments
  { name: 'Fromage Râpé', price: 1.00 },
  { name: 'Bacon', price: 2.50 },
  { name: 'Avocat', price: 2.00 },
  { name: 'Œuf', price: 1.50 },
  { name: 'Champignons', price: 1.50 },
  { name: 'Oignons Frits', price: 1.00 },
  
  // Boissons
  { name: 'Eau Plate', price: 0 },
  { name: 'Eau Gazeuse', price: 0 },
  { name: 'Soda 33cl', price: 0 },
  { name: 'Jus de Fruit', price: 0 },
  { name: 'Vin Rouge', price: 3.00 },
  { name: 'Vin Blanc', price: 3.00 },
  
  // Types de pâtes
  { name: 'Spaghetti', price: 0 },
  { name: 'Penne', price: 0 },
  { name: 'Fusilli', price: 0 },
  { name: 'Tagliatelle', price: 0 },
  { name: 'Ravioli', price: 2.00 },
  
  // Garnitures pizza
  { name: 'Mozzarella Supplémentaire', price: 1.50 },
  { name: 'Champignons', price: 1.50 },
  { name: 'Jambon', price: 2.00 },
  { name: 'Pepperoni', price: 2.50 },
  { name: 'Olives', price: 1.00 },
  { name: 'Poivrons', price: 1.00 },
  
  // Cuisson pizza
  { name: 'Fine et Croustillante', price: 0 },
  { name: 'Épaisse et Moelleuse', price: 0 },
  { name: 'Bien Cuite', price: 0 },
  
  // Types de riz
  { name: 'Riz Blanc', price: 0 },
  { name: 'Riz Complet', price: 1.00 },
  { name: 'Riz Vinaigré', price: 0 },
  
  // Sauces sushi
  { name: 'Sauce Soja', price: 0 },
  { name: 'Sauce Soja Sucrée', price: 0 },
  { name: 'Sauce Piquante', price: 0 },
  { name: 'Sauce Teriyaki', price: 0.50 },
  
  // Garnitures burger
  { name: 'Fromage Cheddar', price: 1.50 },
  { name: 'Bacon', price: 2.50 },
  { name: 'Oignons Caramélisés', price: 1.00 },
  { name: 'Cornichons', price: 0.50 },
  { name: 'Sauce Burger', price: 0.50 },
  
  // Types de pain
  { name: 'Pain Classique', price: 0 },
  { name: 'Pain aux Céréales', price: 0.50 },
  { name: 'Pain Brioché', price: 1.00 },
  { name: 'Pain Sans Gluten', price: 2.00 },
  
  // Desserts
  { name: 'Mousse au Chocolat', price: 0 },
  { name: 'Tarte aux Pommes', price: 0 },
  { name: 'Crème Brûlée', price: 0 },
  { name: 'Salade de Fruits', price: 0 },
  
  // Cafés et thés
  { name: 'Expresso', price: 0 },
  { name: 'Café Allongé', price: 0 },
  { name: 'Thé Vert', price: 0 },
  { name: 'Infusion', price: 0 },
  
  // Options végétariennes
  { name: 'Steak Végétal', price: 3.00 },
  { name: 'Tofu Grillé', price: 2.50 },
  { name: 'Légumes du Marché', price: 2.00 }
];

const seedDatabase = async () => {
  try {
    console.log('🌱 Starting database seeding...');

    // Get providers
    const restaurantProvider = await Provider.findOne({ type: 'restaurant' });
    const pharmacyProvider = await Provider.findOne({ type: 'pharmacy' });
    const supermarketProvider = await Provider.findOne({ type: 'course' });

    if (!restaurantProvider || !pharmacyProvider || !supermarketProvider) {
      console.error('❌ Please ensure providers are created first');
      return;
    }

    // Create option groups and options for restaurant
    console.log('📦 Creating option groups and options...');
    
    const createdOptionGroups = [];
    const createdProductOptions = [];

    // Create product options first
    for (const optionData of productOptionsData) {
      const option = await ProductOption.create({
        ...optionData,
        storeId: restaurantProvider._id
      });
      createdProductOptions.push(option);
    }

    // Create option groups and assign options
    let optionIndex = 0;
    for (const groupData of optionGroupsData) {
      const group = await OptionGroup.create({
        ...groupData,
        storeId: restaurantProvider._id
      });

      // Assign 3-5 options to each group
      const optionsForGroup = createdProductOptions.slice(optionIndex, optionIndex + 4);
      optionIndex += 4;

      for (const option of optionsForGroup) {
        group.options.push({
          option: option._id,
          name: option.name,
          price: option.price
        });
      }

      await group.save();
      createdOptionGroups.push(group);
    }

    // Create products
    console.log('🍕 Creating restaurant products...');
    for (const productData of restaurantProducts) {
      await Product.create({
        ...productData,
        provider: restaurantProvider._id,
        description: `Délicieux ${productData.name.toLowerCase()} préparé avec soin par nos chefs.`,
        stock: Math.floor(Math.random() * 50) + 10,
        status: 'available',
        optionGroups: [createdOptionGroups[Math.floor(Math.random() * createdOptionGroups.length)]._id]
      });
    }

    console.log('💊 Creating pharmacy products...');
    for (const productData of pharmacyProducts) {
      await Product.create({
        ...productData,
        provider: pharmacyProvider._id,
        description: `Produit de qualité ${productData.category.toLowerCase()}.`,
        stock: Math.floor(Math.random() * 100) + 20,
        status: 'available'
      });
    }

    console.log('🛒 Creating supermarket products...');
    for (const productData of supermarketProducts) {
      await Product.create({
        ...productData,
        provider: supermarketProvider._id,
        description: `Produit frais ${productData.category.toLowerCase()}.`,
        stock: Math.floor(Math.random() * 200) + 50,
        status: 'available'
      });
    }

    console.log('✅ Database seeding completed successfully!');
    console.log(`📊 Created: ${restaurantProducts.length} restaurant products`);
    console.log(`📊 Created: ${pharmacyProducts.length} pharmacy products`);
    console.log(`📊 Created: ${supermarketProducts.length} supermarket products`);
    console.log(`📊 Created: ${createdOptionGroups.length} option groups`);
    console.log(`📊 Created: ${createdProductOptions.length} product options`);

  } catch (error) {
    console.error('❌ Error seeding database:', error);
  }
};

const clearDatabase = async () => {
  try {
    console.log('🧹 Clearing existing data...');
    
    await Product.deleteMany({});
    await OptionGroup.deleteMany({});
    await ProductOption.deleteMany({});
    
    console.log('✅ Database cleared successfully!');
  } catch (error) {
    console.error('❌ Error clearing database:', error);
  }
};

// Run seeder
if (require.main === module) {
  mongoose.connect(process.env.MONGO_URI)
    .then(() => {
      console.log('📡 Connected to MongoDB');
      // Clear and seed
      clearDatabase().then(() => seedDatabase());
    })
    .catch(err => {
      console.error('❌ MongoDB connection error:', err);
      process.exit(1);
    });
}

module.exports = { seedDatabase, clearDatabase };