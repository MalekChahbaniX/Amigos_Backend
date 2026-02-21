// Advanced Fee Calculator for Zone 5 Pricing Logic
// Implements the 7-step calculation process for Zone 5 scenarios

const MarginSettings = require('../models/MarginSettings');
const AdditionalFees = require('../models/AdditionalFees');
const Zone = require('../models/Zone');
const City = require('../models/City');
const { calculateMontantCourse } = require('./remunerationService');

/**
 * ÉTAPE 1: FRAIS_1 (Ajustement selon bornes de marge)
 * Permet d'encadrer la marge entre un minimum et un maximum.
 * 
 * @param {Number} margin - La marge calculée
 * @param {Object} marginConfig - Configuration des bornes (minimum, maximum)
 * @returns {Number} FRAIS_1 calculé
 */
async function calculateFrais1(margin, marginConfig) {
  const { minimum, maximum } = marginConfig;
  
  if (minimum <= margin && margin <= maximum) {
    return 0; // FRAIS_1 = 0
  } else if (margin < minimum) {
    return minimum - margin; // FRAIS_1 = Minimum − MarGe
  } else {
    return minimum; // FRAIS_1 = Minimum
  }
}

/**
 * ÉTAPE 2: FRAIS_2 (Correction via montant course)
 * Valeur absolue de l'écart entre (Marge corrigée + tarif promo) et Montant_Course
 * 
 * @param {Number} margin - Marge originale
 * @param {Number} frais1 - FRAIS_1 calculé
 * @param {Number} tarifPromo - Tarif en promotion
 * @param {Number} montantCourse - Montant de la course
 * @returns {Number} FRAIS_2 calculé
 */
function calculateFrais2(margin, frais1, tarifPromo, montantCourse) {
  const ecart = (margin + frais1 + tarifPromo) - montantCourse;
  return Math.abs(ecart);
}

/**
 * ÉTAPE 3: FRAIS_3 (Frais application variables)
 * Récupérer un surplus si la course génère un excédent
 * 
 * @param {Number} montantCourse - Montant de la course
 * @param {Number} totalAmount - Montant total client
 * @param {Number} payout - Payout restaurant
 * @returns {Number} FRAIS_3 calculé
 */
function calculateFrais3(montantCourse, totalAmount, payout) {
  const soldeCommande = totalAmount - payout;
  const ecart = montantCourse - soldeCommande;
  return ecart > 0 ? ecart : 0;
}

/**
 * ÉTAPE 4: FRAIS_4 (Frais minimum fixe)
 * Garantir un minimum de frais même sans panier
 * 
 * @param {Number} prixClient - Prix client (P2_total)
 * @param {Number} frais00 - FRAIS_00 configuré
 * @returns {Number} FRAIS_4 calculé
 */
function calculateFrais4(prixClient, frais00) {
  return prixClient === 0 ? frais00 : 0;
}

/**
 * ÉTAPE 5: MarGe_Net_AmiGoS
 * Représente la marge réelle nette après ajustement et paiement course
 * 
 * @param {Number} margin - Marge originale
 * @param {Number} frais1 - FRAIS_1 calculé
 * @param {Number} tarifPromo - Tarif en promotion
 * @param {Number} montantCourse - Montant de la course
 * @returns {Number} MarGe_Net_AmiGoS calculé
 */
function calculateMargeNetAmigos(margin, frais1, tarifPromo, montantCourse) {
  return (margin + frais1 + tarifPromo) - montantCourse;
}

/**
 * ÉTAPE 6: FRAIS_DE_LIVRAISON (Logique finale)
 * Choisir la structure de frais la plus équilibrée selon rentabilité
 * 
 * @param {Number} margeNetAmigos - MarGe_Net_AmiGoS calculé
 * @param {Number} frais1 - FRAIS_1 calculé
 * @param {Number} frais2 - FRAIS_2 calculé
 * @param {Number} tarifPromo - Tarif en promotion
 * @returns {Number} FRAIS_DE_LIVRAISON calculé
 */
function calculateFraisLivraison(margeNetAmigos, frais1, frais2, tarifPromo) {
  if (margeNetAmigos > 0) {
    return frais1 + tarifPromo;
  } else {
    return frais2 + tarifPromo;
  }
}

/**
 * ÉTAPE 7: FRAIS_APPLICATION (Final)
 * Appliquer soit un frais dynamique (excédent), soit un minimum fixe
 * 
 * @param {Number} frais3 - FRAIS_3 calculé
 * @param {Number} frais4 - FRAIS_4 calculé
 * @returns {Number} FRAIS_APPLICATION calculé
 */
function calculateFraisApplication(frais3, frais4) {
  return frais3 > 0 ? frais3 : frais4;
}

/**
 * Fonction principale de calcul avancé des frais
 * Orchestre les 7 étapes du calcul pour Zone 5
 * 
 * @param {Object} order - Document de commande
 * @param {Object} deliverer - Document du livreur
 * @returns {Promise<Object>} Résultat complet du calcul
 */
async function calculateAdvancedFees(order, deliverer) {
  try {
    // Récupérer les informations de base
    const zone = await Zone.findById(order.zone);
    if (!zone) {
      throw new Error('Zone non trouvée pour la commande');
    }

    // Calculer la marge de base
    const clientPrice = order.clientProductsPrice || order.p2Total || 0;
    const restaurantPayout = order.restaurantPayout || order.p1Total || 0;
    const baseMargin = clientPrice - restaurantPayout;

    // Obtenir la configuration des marges selon le type de commande
    let orderTypeForMargin = 'C1';
    if (order.orderType) {
      if (['A1', 'A2'].includes(order.orderType)) orderTypeForMargin = 'C1';
      else if (order.orderType === 'A3') orderTypeForMargin = 'C2';
      else if (order.orderType === 'A4') orderTypeForMargin = 'C3';
    }

    const marginConfig = await MarginSettings.getMarginByType(orderTypeForMargin);
    
    // Obtenir les frais additionnels
    const additionalFees = await AdditionalFees.getActiveFees();
    const frais00 = additionalFees.FRAIS_4?.amount || 0;

    // Calculer le montant de la course
    const montantCourse = await calculateMontantCourse(order, deliverer, order.orderType || 'A1');

    // Obtenir le tarif en promotion
    const tarifPromo = zone.isPromoActive && zone.promoPrice ? zone.promoPrice : zone.price;

    // ÉTAPE 1: FRAIS_1
    const frais1 = await calculateFrais1(baseMargin, marginConfig);

    // ÉTAPE 2: FRAIS_2
    const frais2 = calculateFrais2(baseMargin, frais1, tarifPromo, montantCourse);

    // ÉTAPE 3: FRAIS_3
    const frais3 = calculateFrais3(montantCourse, order.totalAmount || order.finalAmount, restaurantPayout);

    // ÉTAPE 4: FRAIS_4
    const frais4 = calculateFrais4(clientPrice, frais00);

    // ÉTAPE 5: MarGe_Net_AmiGoS
    const margeNetAmigos = calculateMargeNetAmigos(baseMargin, frais1, tarifPromo, montantCourse);

    // ÉTAPE 6: FRAIS_DE_LIVRAISON
    const fraisLivraison = calculateFraisLivraison(margeNetAmigos, frais1, frais2, tarifPromo);

    // ÉTAPE 7: FRAIS_APPLICATION
    const fraisApplication = calculateFraisApplication(frais3, frais4);

    return {
      // Informations de base
      baseMargin: Number(baseMargin.toFixed(3)),
      marginConfig,
      montantCourse: Number(montantCourse.toFixed(3)),
      tarifPromo: Number(tarifPromo.toFixed(3)),
      
      // Résultats des 7 étapes
      frais1: Number(frais1.toFixed(3)),
      frais2: Number(frais2.toFixed(3)),
      frais3: Number(frais3.toFixed(3)),
      frais4: Number(frais4.toFixed(3)),
      margeNetAmigos: Number(margeNetAmigos.toFixed(3)),
      fraisLivraison: Number(fraisLivraison.toFixed(3)),
      fraisApplication: Number(fraisApplication.toFixed(3)),
      
      // Totaux finaux
      totalDeliveryFee: Number(fraisLivraison.toFixed(3)),
      totalAppFee: Number(fraisApplication.toFixed(3)),
      
      // Métadonnées
      orderType: order.orderType,
      orderTypeForMargin,
      zoneNumber: zone.number,
      isPromoActive: zone.isPromoActive,
      calculatedAt: new Date()
    };
  } catch (error) {
    console.error('Error in calculateAdvancedFees:', error);
    throw error;
  }
}

/**
 * Calculer les frais pour une commande en utilisant la logique avancée
 * et mettre à jour la commande avec les résultats
 * 
 * @param {Object} order - Document de commande
 * @param {Object} deliverer - Document du livreur
 * @returns {Promise<Object>} Commande mise à jour avec les nouveaux frais
 */
async function updateOrderWithAdvancedFees(order, deliverer) {
  try {
    // Calculer les frais avancés
    const advancedFees = await calculateAdvancedFees(order, deliverer);
    
    // Mettre à jour les champs de la commande
    order.advancedFees = advancedFees;
    order.deliveryFee = advancedFees.totalDeliveryFee;
    order.appFee = advancedFees.totalAppFee;
    
    // Recalculer les montants finaux
    const clientProductsPrice = order.clientProductsPrice || order.p2Total || 0;
    order.finalAmount = clientProductsPrice + advancedFees.totalDeliveryFee + advancedFees.totalAppFee;
    order.totalAmount = order.finalAmount;
    
    // Sauvegarder la commande
    await order.save();
    
    return order;
  } catch (error) {
    console.error('Error updating order with advanced fees:', error);
    throw error;
  }
}

module.exports = {
  calculateFrais1,
  calculateFrais2,
  calculateFrais3,
  calculateFrais4,
  calculateMargeNetAmigos,
  calculateFraisLivraison,
  calculateFraisApplication,
  calculateAdvancedFees,
  updateOrderWithAdvancedFees
};
