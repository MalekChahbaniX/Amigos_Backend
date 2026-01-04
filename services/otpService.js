// services/otpService.js
// Service d'envoi OTP via Twilio SMS et WhatsApp avec fallback automatique
const twilio = require('twilio');
const crypto = require('crypto');
const OTPLog = require('../models/OTPLog');

class OTPService {
    constructor() {
        this.accountSid = process.env.TWILIO_ACCOUNT_SID;
        this.authToken = process.env.TWILIO_AUTH_TOKEN;
        this.smsFrom = process.env.TWILIO_PHONE_NUMBER;
        this.whatsappFrom = process.env.TWILIO_WHATSAPP_NUMBER;

        if (!this.accountSid || !this.authToken || !this.smsFrom) {
            console.error('❌ Twilio non configuré correctement:');
            console.error('   - TWILIO_ACCOUNT_SID:', this.accountSid ? '✓' : '✗ manquant');
            console.error('   - TWILIO_AUTH_TOKEN:', this.authToken ? '✓' : '✗ manquant');
            console.error('   - TWILIO_PHONE_NUMBER:', this.smsFrom ? '✓' : '✗ manquant');
            console.error('   - TWILIO_WHATSAPP_NUMBER:', this.whatsappFrom ? '✓' : '✗ manquant');
            this.client = null;
        } else {
            this.client = twilio(this.accountSid, this.authToken);
            console.log('✓ Twilio SMS & WhatsApp initialisé avec succès');
        }
        
        // Propriétés de gestion d'état pour lazy initialization
        this.lastInitAttempt = null;
        this.initRetryDelay = 60000; // 1 minute entre les tentatives
        this.credentialsHash = null;
        
        // Cache de validation pour éviter les appels excessifs
        this.validationCache = {
            result: null,
            timestamp: null,
            ttl: 300000 // 5 minutes en millisecondes
        };

        // Configuration du retry avec backoff exponentiel
        this.retryConfig = {
            maxAttempts: 3,
            baseDelay: 1000, // 1 seconde
            maxDelay: 8000   // 8 secondes maximum
        };

        // État des alertes pour éviter les doublons
        this.alertState = {
            criticalFailures: null,
            lowSuccessRate: null,
            credentialsInvalid: null,
            highRetryRate: null
        };
    }

    // Calcule un hash unique basé sur les credentials actuels
    _getCredentialsHash() {
        const credString = `${this.accountSid}:${this.authToken}:${this.smsFrom}:${this.whatsappFrom}`;
        return crypto.createHash('md5').update(credString).digest('hex');
    }

    // Calcule le délai d'attente avec backoff exponentiel
    _calculateBackoffDelay(attemptNumber) {
        const delay = Math.min(
            this.retryConfig.baseDelay * Math.pow(2, attemptNumber - 1),
            this.retryConfig.maxDelay
        );
        return delay;
    }

    // Attend pendant un délai spécifié
    async _sleep(ms) {
        return new Promise(resolve => setTimeout(resolve, ms));
    }

    // Log détaillé des tentatives de retry
    _logRetryAttempt(attemptNumber, phoneNumber, error, nextDelay) {
        console.log(`🔄 Tentative ${attemptNumber}/${this.retryConfig.maxAttempts} échouée pour ${phoneNumber}`);
        console.log(`   Erreur: ${error.message}`);
        console.log(`   Code erreur: ${error.code || 'N/A'}`);
        if (attemptNumber < this.retryConfig.maxAttempts) {
            console.log(`   ⏳ Nouvelle tentative dans ${nextDelay}ms...`);
        } else {
            console.log(`   ❌ Échec définitif après ${this.retryConfig.maxAttempts} tentatives`);
        }
    }

    // Détecte et enregistre les alertes système
    async _checkAndLogAlerts() {
        try {
            const fifteenMinutesAgo = new Date(Date.now() - 15 * 60 * 1000);
            const oneHourAgo = new Date(Date.now() - 60 * 60 * 1000);

            // Vérifier les échecs consécutifs
            const recentFailures = await OTPLog.countDocuments({
                status: 'failed',
                createdAt: { $gte: fifteenMinutesAgo }
            });

            if (recentFailures >= 5 && !this.alertState.criticalFailures) {
                console.error('🚨 ALERTE CRITIQUE: 5+ échecs OTP en 15 minutes');
                console.error('   Action requise: Vérifier les credentials Twilio et le solde du compte');
                this.alertState.criticalFailures = Date.now();
            } else if (recentFailures < 5 && this.alertState.criticalFailures) {
                console.log('✓ Alerte critique résolue: Taux d\'échec normalisé');
                this.alertState.criticalFailures = null;
            }

            // Vérifier le taux de succès sur la dernière heure
            const hourlyAttempts = await OTPLog.countDocuments({
                createdAt: { $gte: oneHourAgo }
            });

            if (hourlyAttempts > 0) {
                const hourlySuccesses = await OTPLog.countDocuments({
                    status: 'success',
                    createdAt: { $gte: oneHourAgo }
                });

                const successRate = (hourlySuccesses / hourlyAttempts) * 100;

                if (successRate < 80 && !this.alertState.lowSuccessRate) {
                    console.warn(`⚠️ ALERTE: Taux de succès faible (${successRate.toFixed(1)}%) sur la dernière heure`);
                    console.warn('   Suggestion: Vérifier la configuration réseau ou l\'API Twilio');
                    this.alertState.lowSuccessRate = Date.now();
                } else if (successRate >= 85 && this.alertState.lowSuccessRate) {
                    console.log('✓ Alerte taux de succès résolue');
                    this.alertState.lowSuccessRate = null;
                }
            }
        } catch (error) {
            console.error('Erreur lors de la vérification des alertes:', error.message);
        }
    }

    // Catégorise les erreurs Twilio
    _categorizeError(error) {
        const message = error.message || '';
        const code = error.code || null;

        const errorCategoryMap = {
            authentication: {
                codes: [20003],
                patterns: ['Authenticate', 'Authentication', 'Unauthorized']
            },
            invalid_number: {
                codes: [21211, 21614],
                patterns: ['Invalid', 'not a valid', 'phone number']
            },
            rate_limit: {
                codes: [20429],
                patterns: ['rate limit', 'throttled', 'too many']
            },
            insufficient_funds: {
                codes: [30003, 30007],
                patterns: ['insufficient', 'account', 'balance']
            },
            network: {
                codes: [],
                patterns: ['timeout', 'ECONNREFUSED', 'ENOTFOUND', 'network']
            }
        };

        for (const [type, config] of Object.entries(errorCategoryMap)) {
            if (config.codes.includes(code)) {
                return type;
            }
            if (config.patterns.some(pattern => message.includes(pattern))) {
                return type;
            }
        }

        return 'unknown';
    }

    // Enregistre un OTP dans la base de données
    async _logOTPAttempt(logData) {
        try {
            const otpLog = new OTPLog(logData);
            await otpLog.save();
        } catch (error) {
            // Ne pas laisser l'erreur de logging interrompre le flux OTP
            console.error('Erreur lors de l\'enregistrement du log OTP:', error.message);
        }
    }

    // Réinitialise le client Twilio avec les credentials actuels
    async reinitializeClient() {
        console.log('🔄 Réinitialisation du client Twilio...');
        
        // Recharger les variables d'environnement
        this.accountSid = process.env.TWILIO_ACCOUNT_SID;
        this.authToken = process.env.TWILIO_AUTH_TOKEN;
        this.smsFrom = process.env.TWILIO_PHONE_NUMBER;
        this.whatsappFrom = process.env.TWILIO_WHATSAPP_NUMBER;
        
        // Vérifier que les credentials sont présents
        if (!this.accountSid || !this.authToken || !this.smsFrom) {
            console.error('❌ Credentials Twilio manquants après rechargement');
            this.client = null;
            return false;
        }
        
        // Créer un nouveau client
        try {
            this.client = twilio(this.accountSid, this.authToken);
            this.credentialsHash = this._getCredentialsHash();
            this.lastInitAttempt = Date.now();
            
            // Invalider le cache de validation lors de la réinitialisation
            this.validationCache.result = null;
            this.validationCache.timestamp = null;
            
            // Tester la connexion
            const testResult = await this.testConnection();
            if (testResult.success) {
                console.log('✓ Client Twilio réinitialisé avec succès');
                return true;
            } else {
                console.error('❌ Échec du test de connexion après réinitialisation');
                this.client = null;
                return false;
            }
        } catch (error) {
            console.error('❌ Erreur lors de la réinitialisation:', error.message);
            this.client = null;
            return false;
        }
    }

    // Lazy initialization: vérifie et réinitialise le client si nécessaire
    async ensureClient() {
        // Si le client existe déjà, vérifier si les credentials ont changé
        if (this.client) {
            const currentHash = this._getCredentialsHash();
            if (currentHash === this.credentialsHash) {
                return true; // Client valide et credentials inchangés
            }
            console.log('🔄 Changement de credentials détecté');
        }
        
        // Si pas de client ou credentials changés, tenter la réinitialisation
        // Mais respecter le délai entre les tentatives
        const now = Date.now();
        if (this.lastInitAttempt && (now - this.lastInitAttempt) < this.initRetryDelay) {
            console.log('⏳ Délai de réinitialisation non écoulé');
            return this.client !== null;
        }
        
        return await this.reinitializeClient();
    }

    // Valide les credentials Twilio avec cache
    async validateCredentials(forceRefresh = false) {
        console.log('🔍 Validation des credentials Twilio...');
        
        // Vérifier le cache si pas de refresh forcé
        if (!forceRefresh && this.validationCache.result && this.validationCache.timestamp) {
            const age = Date.now() - this.validationCache.timestamp;
            if (age < this.validationCache.ttl) {
                console.log(`✓ Utilisation du cache de validation (âge: ${Math.round(age/1000)}s)`);
                return this.validationCache.result;
            }
            console.log('⚠️ Cache de validation expiré, nouvelle validation...');
        }
        
        const clientReady = await this.ensureClient();
        if (!clientReady) {
            const result = {
                valid: false,
                error: 'Impossible d\'initialiser le client Twilio',
                details: {
                    accountSid: !!this.accountSid,
                    authToken: !!this.authToken,
                    smsFrom: !!this.smsFrom,
                    whatsappFrom: !!this.whatsappFrom
                }
            };
            // Ne pas cacher les échecs
            return result;
        }
        
        const testResult = await this.testConnection();
        const result = {
            valid: testResult.success,
            error: testResult.error || null,
            accountInfo: testResult.success ? {
                sid: testResult.accountSid,
                name: testResult.friendlyName
            } : null
        };
        
        // Mettre en cache seulement les validations réussies
        if (result.valid) {
            this.validationCache.result = result;
            this.validationCache.timestamp = Date.now();
            console.log('✓ Résultat de validation mis en cache');
        }
        
        return result;
    }

    // Vérifie si un numéro a WhatsApp
    async checkWhatsApp(phoneNumber) {
        try {
            const clientReady = await this.ensureClient();
            if (!clientReady) {
                return false;
            }

            // Test WhatsApp via Lookup API
            const lookup = await this.client.lookups.v2.phoneNumbers(phoneNumber)
                .fetch({ type: ['carrier'] });

            // Si le lookup réussit, on considère que WhatsApp est disponible
            return true;
        } catch (error) {
            console.log(`📱 WhatsApp non disponible pour ${phoneNumber}, fallback SMS`);
            return false;
        }
    }

    // Envoie un message avec retry et backoff exponentiel
    async _sendMessageWithRetry(messageParams, channel, phoneNumber) {
        let lastError = null;
        
        for (let attempt = 1; attempt <= this.retryConfig.maxAttempts; attempt++) {
            try {
                console.log(`   📤 Tentative ${attempt}/${this.retryConfig.maxAttempts} - Envoi ${channel}...`);
                
                const response = await this.client.messages.create(messageParams);
                
                console.log(`   ✓ ${channel} envoyé avec succès - SID: ${response.sid}`);
                return {
                    success: true,
                    channel,
                    sid: response.sid,
                    status: response.status,
                    attempts: attempt
                };
                
            } catch (error) {
                lastError = error;
                
                // Vérifier si c'est une erreur d'authentification (ne pas retry)
                if (error.message.includes('Authenticate') || error.message.includes('Authentication')) {
                    console.error(`   ❌ Erreur d'authentification - Pas de retry`);
                    throw error;
                }
                
                // Vérifier si c'est une erreur permanente (ne pas retry)
                const permanentErrorCodes = [21211, 21408, 21610, 21614]; // Numéro invalide, non autorisé, etc.
                if (permanentErrorCodes.includes(error.code)) {
                    console.error(`   ❌ Erreur permanente (code ${error.code}) - Pas de retry`);
                    throw error;
                }
                
                // Si c'est la dernière tentative, propager l'erreur
                if (attempt === this.retryConfig.maxAttempts) {
                    this._logRetryAttempt(attempt, phoneNumber, error, 0);
                    throw error;
                }
                
                // Calculer le délai avant la prochaine tentative
                const delay = this._calculateBackoffDelay(attempt);
                this._logRetryAttempt(attempt, phoneNumber, error, delay);
                
                // Attendre avant la prochaine tentative
                await this._sleep(delay);
            }
        }
        
        // Ne devrait jamais arriver ici, mais par sécurité
        throw lastError;
    }

    // Envoie un OTP par SMS et/ou WhatsApp
    async sendOTP(phoneNumber, otp) {
        const startTime = Date.now();
        let logData = {
            phoneNumber,
            otp,
            startTime,
            status: 'failed',
            twilioResponses: [],
            credentialsValid: false,
            clientReinitialized: false,
            metadata: {
                environment: process.env.NODE_ENV || 'development'
            }
        };

        try {
            // Assurer que le client est initialisé et valide
            const clientReady = await this.ensureClient();
            if (!clientReady) {
                throw new Error('Twilio non disponible. Vérifiez les credentials dans les variables d\'environnement.');
            }

            // Validation du numéro de téléphone
            if (!phoneNumber || typeof phoneNumber !== 'string') {
                throw new Error('Numéro de téléphone invalide');
            }

            // Vérifier que les credentials sont valides avant d'essayer d'envoyer
            console.log('🔐 Validation des credentials Twilio avant envoi...');
            const credentialsValidation = await this.validateCredentials();
            logData.credentialsValid = credentialsValidation.valid;
            if (!credentialsValidation.valid) {
                throw new Error(`Credentials Twilio invalides: ${credentialsValidation.error}`);
            }
            console.log('✓ Credentials Twilio validés');

            const messageText = `🔐 Votre code de vérification AMIGOS est : ${otp}`;
            const whatsappText = `🔐 *Votre code de vérification AMIGOS est : ${otp}*\n\nNe partagez ce code avec personne. Valable 5 minutes.`;

            console.log(`📱 Envoi OTP vers ${phoneNumber}...`);

            // En mode développement, simuler l'envoi et retourner le code
            // if (process.env.NODE_ENV === 'development' || !process.env.NODE_ENV) {
            //     console.log('🔧 Mode développement: OTP simulé (code accessible via API)');
            //     return {
            //         success: true,
            //         channels: ['sms'],
            //         responses: [{
            //             channel: 'sms',
            //             sid: `dev_${Date.now()}`,
            //             status: 'queued',
            //             debugMode: true,
            //             message: 'OTP simulé en mode développement'
            //         }],
            //         debugOtp: otp
            //     };
            // }

            // Mode production: déterminer les canaux à utiliser
            const results = [];
            let hasWhatsApp = false;
            let hasSMS = false;
            let totalAttempts = 0;

            // Vérifier si WhatsApp est disponible
            let whatsappAvailable = false;
            try {
                whatsappAvailable = await this.checkWhatsApp(phoneNumber);
                console.log(`   WhatsApp disponible: ${whatsappAvailable ? 'Oui' : 'Non'}`);
            } catch (error) {
                console.log('   Erreur vérification WhatsApp, envoi SMS uniquement');
            }

            // Envoyer par WhatsApp si disponible
            if (whatsappAvailable && this.whatsappFrom) {
                try {
                    console.log(`   Envoi WhatsApp depuis ${this.whatsappFrom}`);
                    const whatsappResult = await this._sendMessageWithRetry({
                        from: this.whatsappFrom,
                        to: phoneNumber,
                        body: whatsappText
                    }, 'whatsapp', phoneNumber);
                    
                    results.push({
                        channel: 'whatsapp',
                        sid: whatsappResult.sid,
                        status: whatsappResult.status,
                        attempts: whatsappResult.attempts
                    });

                    logData.twilioResponses.push({
                        channel: 'whatsapp',
                        sid: whatsappResult.sid,
                        status: whatsappResult.status
                    });
                    
                    console.log(`✓ WhatsApp envoyé après ${whatsappResult.attempts} tentative(s)`);
                    hasWhatsApp = true;
                    totalAttempts += whatsappResult.attempts;
                } catch (error) {
                    console.log(`❌ WhatsApp échoué après ${this.retryConfig.maxAttempts} tentatives: ${error.message}`);
                    hasWhatsApp = false;
                    totalAttempts += this.retryConfig.maxAttempts;
                }
            }

            // Envoyer par SMS (toujours, comme fallback)
            try {
                console.log(`   Envoi SMS depuis ${this.smsFrom}`);
                const smsResult = await this._sendMessageWithRetry({
                    from: this.smsFrom,
                    to: phoneNumber,
                    body: messageText
                }, 'sms', phoneNumber);
                
                results.push({
                    channel: 'sms',
                    sid: smsResult.sid,
                    status: smsResult.status,
                    attempts: smsResult.attempts
                });

                logData.twilioResponses.push({
                    channel: 'sms',
                    sid: smsResult.sid,
                    status: smsResult.status
                });
                
                console.log(`✓ SMS envoyé après ${smsResult.attempts} tentative(s)`);
                hasSMS = true;
                totalAttempts += smsResult.attempts;
            } catch (error) {
                console.error(`❌ SMS échoué après ${this.retryConfig.maxAttempts} tentatives: ${error.message}`);
                totalAttempts += this.retryConfig.maxAttempts;
                
                // Si WhatsApp a déjà été envoyé avec succès, on peut continuer
                if (hasWhatsApp) {
                    console.log('⚠️ SMS échoué mais WhatsApp a déjà été envoyé avec succès');
                } else {
                    // Si l'erreur est d'authentification, déclencher une réinitialisation
                    if (error.message.includes('Authenticate') || error.message.includes('Authentication')) {
                        console.error('   Problème d\'authentification Twilio détecté');
                        console.error('   Vérifiez vos credentials Twilio:');
                        console.error(`   Account SID: ${this.accountSid ? '✓' : '✗'}`);
                        console.error(`   Auth Token: ${this.authToken ? '✓' : '✗'}`);
                        console.error(`   Phone Number: ${this.smsFrom ? '✓' : '✗'}`);
                        
                        // Nettoyer l'état et réinitialiser
                        logData.clientReinitialized = true;
                        this.credentialsHash = null;
                        this.validationCache.result = null; // Invalider le cache
                        await this.reinitializeClient();
                    }

                    // Catégoriser l'erreur
                    logData.errorDetails = {
                        type: this._categorizeError(error),
                        message: error.message,
                        code: error.code
                    };
                    
                    // Propager l'erreur seulement si WhatsApp n'a pas réussi
                    throw error;
                }
            }

            // Vérifier qu'au moins un canal a réussi
            if (!hasSMS && !hasWhatsApp) {
                logData.status = 'failed';
                logData.attempts = totalAttempts;
                logData.responseTime = Date.now() - startTime;
                logData.channel = 'sms'; // Défaut
                await this._logOTPAttempt(logData);
                throw new Error('Échec de l\'envoi OTP sur tous les canaux disponibles');
            }

            // Déterminer le statut et le canal
            logData.status = (hasSMS && hasWhatsApp) ? 'success' : (hasSMS || hasWhatsApp) ? 'success' : 'failed';
            if (hasSMS && hasWhatsApp) {
                logData.channel = 'both';
            } else if (hasWhatsApp) {
                logData.channel = 'whatsapp';
            } else {
                logData.channel = 'sms';
            }
            logData.attempts = totalAttempts;
            logData.responseTime = Date.now() - startTime;

            // Logger les statistiques d'envoi
            console.log(`📊 Statistiques d'envoi:`);
            console.log(`   Canaux réussis: ${results.map(r => r.channel).join(', ')}`);
            console.log(`   Tentatives totales: ${totalAttempts}`);
            console.log(`   Temps de réponse: ${logData.responseTime}ms`);
            console.log(`   Taux de succès: ${results.length > 0 ? '100%' : '0%'}`);

            // Enregistrer le succès
            await this._logOTPAttempt(logData);

            return {
                success: hasSMS || hasWhatsApp,
                channels: results.map(r => r.channel),
                responses: results,
                message: hasWhatsApp && hasSMS
                    ? 'OTP envoyé par WhatsApp et SMS'
                    : hasWhatsApp
                        ? 'OTP envoyé par WhatsApp'
                        : 'OTP envoyé par SMS'
            };

        } catch (error) {
            console.error('❌ Erreur lors de l\'envoi de l\'OTP:');
            console.error(`   Message: ${error.message}`);
            if (error.code) {
                console.error(`   Code d'erreur: ${error.code}`);
            }
            
            // Log the failure with detailed error information
            logData.status = 'failed';
            logData.responseTime = Date.now() - logData.startTime;
            logData.errorDetails = {
                type: this._categorizeError(error),
                message: error.message,
                code: error.code || 'UNKNOWN'
            };
            
            // Log the attempt even on failure
            await this._logOTPAttempt(logData);
            
            // Check for alerts based on recent failures
            await this._checkAndLogAlerts();
            
            // Si l'erreur est d'authentification, déclencher la réinitialisation
            if (error.message.includes('Authenticate') || error.message.includes('Authentication')) {
                console.error('   Problème d\'authentification Twilio détecté');
                console.error('   Vérifiez vos credentials Twilio:');
                console.error(`   Account SID: ${this.accountSid ? '✓' : '✗'}`);
                console.error(`   Auth Token: ${this.authToken ? '✓' : '✗'}`);
                console.error(`   Phone Number: ${this.smsFrom ? '✓' : '✗'}`);
                
                this.credentialsHash = null;
                await this.reinitializeClient();
            }
            
            // Propager l'erreur réelle
            throw error;
        }
    }

    // Test de connexion à Twilio
    async testConnection() {
        try {
            const clientReady = await this.ensureClient();
            if (!clientReady) {
                return {
                    success: false,
                    error: 'Impossible d\'initialiser le client Twilio. Vérifiez les credentials.'
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