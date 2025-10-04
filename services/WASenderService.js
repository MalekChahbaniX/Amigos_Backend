// services/WASenderService.js
const axios = require('axios');

class WASenderService {
    constructor() {
        this.apiKey = process.env.WASENDER_API_KEY;
        this.baseUrl = 'https://wasenderapi.com/api';
        
        // Validation de la clé API
        if (!this.apiKey) {
            console.error('WASender API Key manquante dans les variables d\'environnement');
        }
    }

    async sendOTP(phoneNumber, otp) {
        try {
            // Vérifier que la clé API est présente
            if (!this.apiKey) {
                throw new Error('WASender API Key non configurée');
            }

            const messageText = `🔐 Votre code de vérification AMIGOS est : ${otp}`;
            
            console.log('Envoi OTP via WASender pour:', phoneNumber);
            console.log('Message:', messageText);

            const payload = {
                to: phoneNumber,
                text: messageText,  // Changé de 'message' à 'text'
                type: 'text'
            };

            console.log('Payload envoyé:', JSON.stringify(payload, null, 2));

            const response = await axios.post(`${this.baseUrl}/send-message`, payload, {
                headers: {
                    'Authorization': `Bearer ${this.apiKey}`,
                    'Content-Type': 'application/json'
                },
                timeout: 10000 // Timeout de 10 secondes
            });

            console.log('Réponse WASender:', response.data);
            return response.data;

        } catch (error) {
            console.error('=== ERREUR WASENDER ===');
            
            if (error.response) {
                // Erreur de réponse du serveur
                console.error('Status:', error.response.status);
                console.error('Data:', JSON.stringify(error.response.data, null, 2));
                console.error('Headers:', error.response.headers);
            } else if (error.request) {
                // Erreur de requête (pas de réponse)
                console.error('Pas de réponse du serveur WASender');
                console.error('Request config:', error.config);
            } else {
                // Autre erreur
                console.error('Erreur:', error.message);
            }

            // Lancer une erreur avec plus de détails
            const errorMessage = error.response?.data?.message || error.message;
            throw new Error(`Échec envoi OTP via WASender: ${errorMessage}`);
        }
    }

    // Méthode pour tester la connexion à l'API
    async testConnection() {
        try {
            if (!this.apiKey) {
                return { success: false, error: 'API Key manquante' };
            }

            // Test avec un endpoint de base si disponible
            const response = await axios.get(`${this.baseUrl}/status`, {
                headers: {
                    'Authorization': `Bearer ${this.apiKey}`,
                    'Content-Type': 'application/json'
                },
                timeout: 5000
            });

            return { success: true, data: response.data };
        } catch (error) {
            console.error('Test connexion WASender échoué:', error.message);
            return { success: false, error: error.message };
        }
    }
}

module.exports = new WASenderService();