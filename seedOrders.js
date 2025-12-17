// seedOrders.js
const mongoose = require('mongoose');
const User = require('./models/User');       // Assurez-vous que le chemin est correct
const Provider = require('./models/Provider');
const Product = require('./models/Product');
const Order = require('./models/Order');

// --- CONFIGURATION ---
const MONGO_URI = 'mongodb+srv://malekchb0621_db_user:amigos2025**@amigos.gyjfexc.mongodb.net/?retryWrites=true&w=majority&appName=amigos'; // <--- MODIFIEZ CECI
const ORDERS_TO_CREATE = 100;

// Frais par défaut pour les tests
const DEFAULT_DELIVERY_FEE = 3; // ex: 3.000 DT
const DEFAULT_APP_FEE = 1.5;       // ex: 0.500 DT

// Fonction utilitaire pour aléatoire
const randomInt = (min, max) => Math.floor(Math.random() * (max - min + 1)) + min;
const randomElem = (arr) => arr[Math.floor(Math.random() * arr.length)];

async function seedOrders() {
    try {
        console.log('🔌 Connexion à MongoDB...');
        await mongoose.connect(MONGO_URI);
        console.log('✅ Connecté.');

        // 1. Récupération des données existantes
        const clients = await User.find({ role: 'client' });
        const providers = await Provider.find({ status: 'active' });
        
        if (clients.length === 0 || providers.length === 0) {
            throw new Error("❌ Erreur: Il faut au moins 1 client et 1 provider dans la base pour créer des commandes.");
        }

        console.log(`📊 Données trouvées : ${clients.length} clients, ${providers.length} providers.`);
        const ordersToInsert = [];

        // 2. Génération des commandes
        for (let i = 0; i < ORDERS_TO_CREATE; i++) {
            const client = randomElem(clients);
            const provider = randomElem(providers);
            
            // Récupérer les produits de ce provider spécifique
            const products = await Product.find({ provider: provider._id });
            
            if (products.length === 0) {
                console.log(`⚠️ Provider ${provider.name} n'a pas de produits, commande ignorée.`);
                continue;
            }

            // Générer 1 à 4 items par commande
            const itemCount = randomInt(1, 4);
            const items = [];
            let p1Total = 0;
            let p2Total = 0;

            for (let j = 0; j < itemCount; j++) {
                const product = randomElem(products);
                const quantity = randomInt(1, 3);
                
                // Utiliser les p1/p2 du produit s'ils existent, sinon recalculer (backup)
                // Formule basée sur votre Product.js : p1 = price * (1 - csR/100), p2 = price * (1 + csC/100)
                const csR = product.csR || 5; 
                const csC = product.csC || 0;
                
                const unitP1 = product.p1 || (product.price * (1 - csR / 100));
                const unitP2 = product.p2 || (product.price * (1 + csC / 100));

                items.push({
                    product: product._id,
                    name: product.name,
                    price: product.price,
                    quantity: quantity,
                    p1: unitP1,
                    p2: unitP2,
                    deliveryCategory: product.deliveryCategory || 'restaurant'
                });

                p1Total += unitP1 * quantity;
                p2Total += unitP2 * quantity;
            }

            // Calculs totaux (Basés sur Order.js)
            const deliveryFee = DEFAULT_DELIVERY_FEE;
            const appFee = DEFAULT_APP_FEE;
            
            // finalAmount = P2_total + deliveryFee + appFee
            const finalAmount = p2Total + deliveryFee + appFee;
            
            // platformSolde = (P2_total - P1_total) + deliveryFee + appFee
            const platformSolde = (p2Total - p1Total) + deliveryFee + appFee;

            const newOrder = {
                client: client._id,
                provider: provider._id,
                items: items,
                
                // Totaux requis par le schéma
                totalAmount: finalAmount,        // Souvent totalAmount = finalAmount dans ces systèmes
                clientProductsPrice: p2Total,
                restaurantPayout: p1Total,
                p1Total: p1Total,
                p2Total: p2Total,
                finalAmount: finalAmount,
                
                deliveryFee: deliveryFee,
                appFee: appFee,
                platformSolde: platformSolde,
                
                // Méta-données
                status: randomElem(['pending', 'accepted', 'delivered', 'cancelled']),
                paymentMethod: randomElem(['cash', 'online']),
                deliveryCategory: 'restaurant',
                orderType: 'A1',
                
                // Adresse fictive (Tunis approx)
                deliveryAddress: {
                    street: `Rue de Test ${randomInt(1, 100)}`,
                    city: 'Tunis',
                    zipCode: '1000',
                    latitude: 36.8 + (Math.random() * 0.1),
                    longitude: 10.1 + (Math.random() * 0.1)
                },
                
                createdAt: new Date(),
                updatedAt: new Date()
            };

            ordersToInsert.push(newOrder);
        }

        // 3. Insertion en masse
        if (ordersToInsert.length > 0) {
            await Order.insertMany(ordersToInsert);
            console.log(`✅ Succès ! ${ordersToInsert.length} commandes créées.`);
        } else {
            console.log("⚠️ Aucune commande générée (manque de produits ?).");
        }

    } catch (error) {
        console.error('❌ Erreur:', error);
    } finally {
        await mongoose.disconnect();
        console.log('👋 Déconnecté.');
    }
}

seedOrders();
