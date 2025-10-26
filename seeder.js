import dotenv from "dotenv";
import mongoose from "mongoose";
import Product from './models/Product.js';
import Provider from './models/Provider.js';

dotenv.config();
const connectDB = async () => {
  try {
    await mongoose.connect(process.env.MONGO_URI);
    console.log('MongoDB connected successfully!');
  } catch (err) {
    console.error(`Error connecting to MongoDB: ${err.message}`);
    process.exit(1);
  }
};

await connectDB();


async function seed() {
  try {
    await Product.deleteMany();
    await Provider.deleteMany();

    console.log('🧹 Anciennes données supprimées');

    // 🧩 Création des providers (3 types)
    const providers = await Provider.insertMany([
      {
        name: 'Pizza House',
        type: 'restaurant',
        phone: '+21611111111',
        address: 'Tunis Centre',
        email: 'pizza@house.com',
        description: 'Restaurant italien spécialisé en pizzas artisanales',
        image: 'https://images.unsplash.com/photo-1601924582975-7d749ec78d2b',
      },
      {
        name: 'Pharma Santé',
        type: 'pharmacy',
        phone: '+21622222222',
        address: 'Ariana',
        email: 'contact@pharmasante.com',
        description: 'Pharmacie ouverte 24h/24 avec livraison rapide',
        image: 'https://images.unsplash.com/photo-1580281657529-47a3cbb81f5a',
      },
      {
        name: 'GoFast Delivery',
        type: 'course',
        phone: '+21633333333',
        address: 'La Marsa',
        email: 'support@gofast.com',
        description: 'Service de livraison rapide et fiable',
        image: 'https://images.unsplash.com/photo-1604147706283-8c67b0ec7dfd',
      }
    ]);

    console.log('🚚 Providers ajoutés:', providers.map(p => p.name));

    // 🍕 Produits de restaurant
    const restaurantProducts = [
      { name: 'Pizza Margherita', price: 18, category: 'Pizzas', image: 'https://images.unsplash.com/photo-1601924582975-7d749ec78d2b' },
      { name: 'Pizza 4 Fromages', price: 22, category: 'Pizzas', image: 'https://images.unsplash.com/photo-1601924928383-5c7d5a7d58a6' },
      { name: 'Burger Maison', price: 20, category: 'Burgers', image: 'https://images.unsplash.com/photo-1550547660-d9450f859349' },
      { name: 'Pâtes Carbonara', price: 19, category: 'Pâtes', image: 'https://images.unsplash.com/photo-1589308078051-dc9a8aabf7d9' },
      { name: 'Salade César', price: 15, category: 'Salades', image: 'https://images.unsplash.com/photo-1604909053191-3bbbea4c5932' },
      { name: 'Pizza Orientale', price: 21, category: 'Pizzas', image: 'https://images.unsplash.com/photo-1594007654729-407eedc4be63' },
      { name: 'Tiramisu', price: 10, category: 'Desserts', image: 'https://images.unsplash.com/photo-1617196034796-73e5b40b1e9f' },
      { name: 'Lasagnes Bolognaise', price: 23, category: 'Pâtes', image: 'https://images.unsplash.com/photo-1612874742237-652f09e22a5c' },
      { name: 'Pizza Végétarienne', price: 18, category: 'Pizzas', image: 'https://images.unsplash.com/photo-1548365328-8b7e8e61f6e3' },
      { name: 'Panini Thon', price: 12, category: 'Snacks', image: 'https://images.unsplash.com/photo-1605470207062-76cf15c2272d' },
      { name: 'Coca-Cola', price: 3, category: 'Boissons', image: 'https://images.unsplash.com/photo-1606813902773-1b77c8b266d8' },
      { name: 'Eau minérale', price: 2, category: 'Boissons', image: 'https://images.unsplash.com/photo-1629131726746-97e7675e5f4f' },
      { name: 'Pizza Royale', price: 20, category: 'Pizzas', image: 'https://images.unsplash.com/photo-1585238341986-1d66b1b6b5cb' },
      { name: 'Crêpe Nutella', price: 8, category: 'Desserts', image: 'https://images.unsplash.com/photo-1551024506-0bccd828d307' }
    ].map(p => ({ ...p, provider: providers[0]._id, status: 'available', description: `${p.name} délicieux et préparé avec soin.` }));

    // 💊 Produits de pharmacie
    const pharmacyProducts = [
      { name: 'Doliprane 500mg', price: 4.5, category: 'Médicaments', image: 'https://images.unsplash.com/photo-1582719478250-c89cae4dc85b' },
      { name: 'Vitamine C 1000mg', price: 8, category: 'Compléments', image: 'https://images.unsplash.com/photo-1582719478175-2a7b74f68b44' },
      { name: 'Gel désinfectant', price: 5, category: 'Hygiène', image: 'https://images.unsplash.com/photo-1583947582886-f36f63634c85' },
      { name: 'Parfum bébé', price: 15, category: 'Bébés', image: 'https://images.unsplash.com/photo-1620912189868-3a37b94e34e2' },
      { name: 'Crème hydratante', price: 12, category: 'Beauté', image: 'https://images.unsplash.com/photo-1620912189868-3a37b94e34e2' },
      { name: 'Masque chirurgical (x10)', price: 6, category: 'Hygiène', image: 'https://images.unsplash.com/photo-1603398938378-c6c3c8f4d5d4' },
      { name: 'Thermomètre digital', price: 18, category: 'Santé', image: 'https://images.unsplash.com/photo-1582719478293-0b4bda1b55c3' },
      { name: 'Brosse à dents électrique', price: 35, category: 'Hygiène', image: 'https://images.unsplash.com/photo-1603808033192-0817e9b86f21' },
      { name: 'Sirop pour la toux', price: 9, category: 'Médicaments', image: 'https://images.unsplash.com/photo-1576073491935-6a8f8e65c1df' },
      { name: 'Savon dermatologique', price: 7, category: 'Beauté', image: 'https://images.unsplash.com/photo-1600093463592-3ff53ed9f99d' },
      { name: 'Shampooing antipelliculaire', price: 11, category: 'Beauté', image: 'https://images.unsplash.com/photo-1620912189868-3a37b94e34e2' },
      { name: 'Dentifrice blanchissant', price: 6, category: 'Hygiène', image: 'https://images.unsplash.com/photo-1596464716121-681e6f9e36c4' },
      { name: 'Coton démaquillant', price: 3, category: 'Beauté', image: 'https://images.unsplash.com/photo-1614289494051-70e07d5bb6c7' }
    ].map(p => ({ ...p, provider: providers[1]._id, status: 'available', description: `${p.name} - produit de qualité certifié.` }));

    // 🚚 Produits / services de livraison
    const courseProducts = [
      { name: 'Livraison rapide (5 km)', price: 7, category: 'Livraison locale', image: 'https://images.unsplash.com/photo-1604147706283-8c67b0ec7dfd' },
      { name: 'Livraison standard (10 km)', price: 10, category: 'Livraison locale', image: 'https://images.unsplash.com/photo-1581092334473-f79a9f8e7a06' },
      { name: 'Transport meuble', price: 30, category: 'Transport', image: 'https://images.unsplash.com/photo-1581092334473-f79a9f8e7a06' },
      { name: 'Livraison documents', price: 5, category: 'Express', image: 'https://images.unsplash.com/photo-1613545327564-1b4b27a229e0' },
      { name: 'Livraison colis lourd (50kg)', price: 25, category: 'Transport', image: 'https://images.unsplash.com/photo-1615397349754-b5c5292f6f68' },
      { name: 'Livraison inter-ville', price: 40, category: 'Longue distance', image: 'https://images.unsplash.com/photo-1502164980785-f8aa41d53611' },
      { name: 'Service chauffeur', price: 60, category: 'Transport', image: 'https://images.unsplash.com/photo-1503376780353-7e6692767b70' },
      { name: 'Livraison nourriture', price: 8, category: 'Livraison locale', image: 'https://images.unsplash.com/photo-1556740749-887f6717d7e4' },
      { name: 'Livraison nocturne', price: 15, category: 'Express', image: 'https://images.unsplash.com/photo-1533560904424-6b8b74895b46' },
      { name: 'Service entreprises', price: 50, category: 'Professionnel', image: 'https://images.unsplash.com/photo-1581092580495-4c4d9cdb3193' },
      { name: 'Livraison fragile', price: 20, category: 'Transport', image: 'https://images.unsplash.com/photo-1566576912321-cdf3e45a87df' },
      { name: 'Livraison éco', price: 6, category: 'Livraison locale', image: 'https://images.unsplash.com/photo-1605379399642-870262d3d051' },
      { name: 'Transport urgent', price: 25, category: 'Express', image: 'https://images.unsplash.com/photo-1613545327564-1b4b27a229e0' }
    ].map(p => ({ ...p, provider: providers[2]._id, status: 'available', description: `${p.name} - service fiable et rapide.` }));

    const allProducts = [...restaurantProducts, ...pharmacyProducts, ...courseProducts];

    await Product.insertMany(allProducts);

    console.log(`✅ ${allProducts.length} produits insérés avec succès !`);
    process.exit();
  } catch (error) {
    console.error('❌ Erreur lors du seeding:', error);
    process.exit(1);
  }
}

seed();
