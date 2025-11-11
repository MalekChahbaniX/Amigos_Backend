// services/otpService.js
// Service d'envoi OTP via Twilio SMS
const twilio = require('twilio');

class OTPService {
    constructor() {
        this.accountSid = process.env.TWILIO_ACCOUNT_SID;
        this.authToken = process.env.TWILIO_AUTH_TOKEN;
        this.smsFrom = process.env.TWILIO_PHONE_NUMBER;

        if (!this.accountSid || !this.authToken || !this.smsFrom) {
            console.error('❌ Twilio non configuré correctement:');
            console.error('   - TWILIO_ACCOUNT_SID:', this.accountSid ? '✓' : '✗ manquant');
            console.error('   - TWILIO_AUTH_TOKEN:', this.authToken ? '✓' : '✗ manquant');
            console.error('   - TWILIO_PHONE_NUMBER:', this.smsFrom ? '✓' : '✗ manquant');
            this.client = null;
        } else {
            this.client = twilio(this.accountSid, this.authToken);
            console.log('✓ Twilio SMS initialisé avec succès');
        }
    }

    // Envoie un OTP par SMS
    async sendOTP(phoneNumber, otp) {
        try {
            if (!this.client) {
                throw new Error('Twilio non configuré. Vérifiez les variables d\'environnement: TWILIO_ACCOUNT_SID, TWILIO_AUTH_TOKEN, TWILIO_PHONE_NUMBER');
            }

            // Validation du numéro de téléphone
            if (!phoneNumber || typeof phoneNumber !== 'string') {
                throw new Error('Numéro de téléphone invalide');
            }

            const messageText = `🔐 Votre code de vérification AMIGOS est : ${otp}`;

            console.log(`📱 Envoi OTP SMS vers ${phoneNumber}...`);
            console.log(`   De: ${this.smsFrom}`);
            console.log(`   Code: ${otp}`);

            // En mode développement, simuler l'envoi et retourner le code
            if (process.env.NODE_ENV === 'development' || !process.env.NODE_ENV) {
                console.log('🔧 Mode développement: SMS simulé (code accessible via API)');
                return {
                    success: true,
                    channel: 'sms',
                    sid: `dev_${Date.now()}`,
                    status: 'queued',
                    debugMode: true,
                    message: 'SMS simulé en mode développement'
                };
            }

            // Mode production: envoyer réellement via Twilio
            const smsResponse = await this.client.messages.create({
                from: this.smsFrom,
                to: phoneNumber,
                body: messageText
            });

            console.log(`✓ SMS envoyé avec succès - SID: ${smsResponse.sid}`);
            console.log(`   Status: ${smsResponse.status}`);

            return {
                success: true,
                channel: 'sms',
                sid: smsResponse.sid,
                status: smsResponse.status
            };

        } catch (error) {
            console.error('❌ Erreur lors de l\'envoi du SMS:');
            console.error(`   Message: ${error.message}`);
            if (error.code) {
                console.error(`   Code d'erreur: ${error.code}`);
            }

            // En mode développement, retourner quand même un succès simulé
            if (process.env.NODE_ENV === 'development' || !process.env.NODE_ENV) {
                console.log('⚠️  Erreur Twilio, mais mode développement activé');
                console.log('🔧 Retour d\'un SMS simulé malgré l\'erreur');
                return {
                    success: true,
                    channel: 'sms',
                    sid: `dev_error_${Date.now()}`,
                    status: 'queued',
                    debugMode: true,
                    errorMessage: error.message,
                    message: 'SMS simulé (erreur Twilio en mode dev)'
                };
            }

            // En production, lever l'exception
            throw new Error(`Échec envoi OTP: ${error.message}`);
        }
    }

    // Test de connexion à Twilio
    async testConnection() {
        try {
            if (!this.client) {
                return {
                    success: false,
                    error: 'Twilio non configuré - variables d\'environnement manquantes'
                };
            }

            const account = await this.client.api.accounts(this.accountSid).fetch();

            console.log('✓ Connexion Twilio réussie');
            console.log(`   Account SID: ${account.sid}`);
            console.log(`   Friendly Name: ${account.friendly_name}`);

            return {
                success: true,
                accountSid: account.sid,
                friendlyName: account.friendly_name
            };

        } catch (error) {
            console.error('❌ Erreur de connexion Twilio:');
            console.error(`   Message: ${error.message}`);
            return {
                success: false,
                error: error.message
            };
        }
    }
}

module.exports = new OTPService();