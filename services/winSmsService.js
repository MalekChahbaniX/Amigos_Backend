const axios = require('axios');
const WinSMSLog = require('../models/WinSMSLog');

class WinSMSService {
  constructor() {
    this.apiKey = process.env.WINSMS_API_KEY;
    this.senderId = process.env.WINSMS_SENDER_ID;
    this.apiUrl = process.env.WINSMS_API_URL || 'https://api.winsms.tn/v1/sms/send';

    // Validate credentials
    this._validateInitialCredentials();

    // Retry configuration
    this.maxAttempts = 3;
    this.baseDelay = 1000; // 1 second
    this.maxDelay = 8000; // 8 seconds

    // Validation cache
    this.validationCache = {
      result: null,
      timestamp: null,
      ttl: 300000 // 5 minutes
    };

    // Alert state
    this.alertState = {
      criticalFailures: false,
      lowSuccessRate: false
    };

    console.log('📱 WinSMSService initialized successfully');
  }

  _validateInitialCredentials() {
    if (!this.apiKey) {
      console.error('❌ WinSMS Error: WINSMS_API_KEY not configured');
    }
    if (!this.senderId) {
      console.error('❌ WinSMS Error: WINSMS_SENDER_ID not configured');
    }
    if (this.apiKey && this.senderId) {
      console.log('✓ WinSMS credentials configured (API Key: WINSMS_***', this.senderId + ')');
    }
  }

  _calculateBackoffDelay(attemptNumber) {
    const delay = Math.min(
      this.baseDelay * Math.pow(2, attemptNumber - 1),
      this.maxDelay
    );
    return delay;
  }

  _sleep(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
  }

  _logRetryAttempt(attemptNumber, phoneNumber, error, nextDelay) {
    const isLastAttempt = attemptNumber === this.maxAttempts;
    if (isLastAttempt) {
      console.error(
        `❌ WinSMS Attempt ${attemptNumber}/${this.maxAttempts} FAILED (Final): ${phoneNumber}`,
        `Error: ${error.message}`
      );
    } else {
      console.warn(
        `🔄 WinSMS Attempt ${attemptNumber}/${this.maxAttempts} failed: ${phoneNumber}`,
        `Error: ${error.message}. Retrying in ${nextDelay}ms...`
      );
    }
  }

  _categorizeError(error) {
    const message = error.message || '';
    const statusCode = error.response?.status;
    const responseData = error.response?.data || '';

    if (statusCode === 401 || statusCode === 403 || message.toLowerCase().includes('unauthorized') ||
        message.toLowerCase().includes('invalid api key') || message.toLowerCase().includes('authentication')) {
      return 'authentication';
    }

    if (statusCode === 400 && (message.toLowerCase().includes('invalid number') ||
        message.toLowerCase().includes('invalid phone') || message.toLowerCase().includes('invalid recipient'))) {
      return 'invalid_number';
    }

    if (statusCode === 429 || message.toLowerCase().includes('rate limit') ||
        message.toLowerCase().includes('too many requests')) {
      return 'rate_limit';
    }

    if (message.toLowerCase().includes('insufficient balance') || message.toLowerCase().includes('no credit') ||
        message.toLowerCase().includes('insufficient funds')) {
      return 'insufficient_funds';
    }

    if (message.toLowerCase().includes('timeout') || message.toLowerCase().includes('econnrefused') ||
        message.toLowerCase().includes('enotfound') || message.toLowerCase().includes('network')) {
      return 'network';
    }

    return 'unknown';
  }

  async _logWinSMSAttempt(logData) {
    try {
      await WinSMSLog.create(logData);
    } catch (error) {
      console.error('⚠️ WinSMS: Failed to log attempt to database:', error.message);
    }
  }

  async _checkAndLogAlerts() {
    try {
      const fifteenMinutesAgo = new Date(Date.now() - 15 * 60 * 1000);
      const oneHourAgo = new Date(Date.now() - 60 * 60 * 1000);

      // Check for critical failures
      const recentFailures = await WinSMSLog.countDocuments({
        status: 'failed',
        createdAt: { $gte: fifteenMinutesAgo }
      });

      if (recentFailures >= 5 && !this.alertState.criticalFailures) {
        console.error(`🚨 WinSMS CRITICAL ALERT: ${recentFailures} failed attempts in the last 15 minutes`);
        this.alertState.criticalFailures = true;
      } else if (recentFailures < 5 && this.alertState.criticalFailures) {
        console.log('✓ WinSMS: Critical failure alert cleared');
        this.alertState.criticalFailures = false;
      }

      // Check success rate
      const hourlyAttempts = await WinSMSLog.countDocuments({
        createdAt: { $gte: oneHourAgo }
      });

      if (hourlyAttempts > 0) {
        const hourlySuccesses = await WinSMSLog.countDocuments({
          status: 'success',
          createdAt: { $gte: oneHourAgo }
        });

        const successRate = (hourlySuccesses / hourlyAttempts) * 100;

        if (successRate < 80 && !this.alertState.lowSuccessRate) {
          console.warn(`⚠️ WinSMS WARNING: Low success rate (${successRate.toFixed(2)}%) in the last hour`);
          this.alertState.lowSuccessRate = true;
        } else if (successRate >= 80 && this.alertState.lowSuccessRate) {
          console.log('✓ WinSMS: Low success rate alert cleared');
          this.alertState.lowSuccessRate = false;
        }
      }
    } catch (error) {
      console.error('⚠️ WinSMS: Failed to check alerts:', error.message);
    }
  }

  async validateCredentials(forceRefresh = false) {
    // Check cache
    if (!forceRefresh && this.validationCache.result && this.validationCache.timestamp) {
      const cacheAge = Date.now() - this.validationCache.timestamp;
      if (cacheAge < this.validationCache.ttl) {
        console.log(`✓ [WinSMS] Validation credentials (cache, age: ${Math.round(cacheAge/1000)}s)`);
        return this.validationCache.result;
      }
    }
    console.log(`🔍 [WinSMS] Validation credentials (fresh check)`);

    // Validate fresh
    const result = await this.testConnection();

    // Cache only successful validations
    if (result.success) {
      this.validationCache.result = result;
      this.validationCache.timestamp = Date.now();
    }

    return result;
  }

  async testConnection() {
    console.log(`🔍 [WinSMS] Test de connexion - API URL: ${this.apiUrl}`);
    console.log(`🔍 [WinSMS] API Key configurée: ${this.apiKey ? 'Oui (***' + this.apiKey.slice(-4) + ')' : 'Non'}`);
    console.log(`🔍 [WinSMS] Sender ID: ${this.senderId || 'Non configuré'}`);
    
    if (!this.apiKey || !this.senderId) {
      const error = 'WinSMS credentials not configured (WINSMS_API_KEY or WINSMS_SENDER_ID missing)';
      console.error('❌ WinSMS Connection Test Failed:', error);
      return {
        success: false,
        error,
        balance: null
      };
    }

    try {
      // Use balance endpoint to test connection
      const testUrl = `${this.apiUrl}?action=balance&api_key=${this.apiKey}`;
      
      const response = await axios.get(
        testUrl,
        {
          timeout: 15000,
          httpsAgent: new (require('https').Agent)({
            rejectUnauthorized: false // Désactiver la validation SSL temporairement
          })
        }
      );

      console.log('✓ WinSMS Connection Test Successful');
      return {
        success: true,
        error: null,
        balance: response.data?.balance || null
      };
    } catch (error) {
      const errorMessage = error.response?.data?.message || error.message;
      console.error('❌ WinSMS Connection Test Failed:', errorMessage);
      return {
        success: false,
        error: errorMessage,
        balance: null
      };
    }
  }

  async _sendMessageWithRetry(phoneNumber, message) {
    let lastError;

    for (let attempt = 1; attempt <= this.maxAttempts; attempt++) {
      console.log(`🔄 [WinSMS] Tentative ${attempt}/${this.maxAttempts} - ${phoneNumber}`);
      
      try {
        const startTime = Date.now();

        // Format phone number (remove + prefix for WinSMS API)
        const formattedPhone = phoneNumber.replace('+', '');
        
        // Build URL with parameters for WinSMS API
        const smsUrl = `${this.apiUrl}?action=send-sms&api_key=${this.apiKey}&to=${formattedPhone}&from=${this.senderId}&sms=${encodeURIComponent(message)}`;

        const response = await axios.get(
          smsUrl,
          {
            timeout: 20000,
            httpsAgent: new (require('https').Agent)({
              rejectUnauthorized: false // Désactiver la validation SSL temporairement
            })
          }
        );

        const responseTime = Date.now() - startTime;

        return {
          success: true,
          messageId: response.data?.message_id || response.data?.id || 'sent',
          status: response.data?.status || 'sent',
          attempts: attempt,
          responseTime
        };
      } catch (error) {
        lastError = error;
        const statusCode = error.response?.status;
        const errorMessage = error.response?.data?.message || error.message;

        // Check for permanent errors
        if (statusCode === 401 || statusCode === 403) {
          throw new Error(`Authentication error: ${errorMessage}`);
        }

        if (statusCode === 400 && (errorMessage.toLowerCase().includes('invalid number') ||
            errorMessage.toLowerCase().includes('invalid phone'))) {
          throw new Error(`Invalid phone number: ${phoneNumber}`);
        }

        // If last attempt, throw error
        if (attempt === this.maxAttempts) {
          throw error;
        }

        // Calculate backoff and retry
        const nextDelay = this._calculateBackoffDelay(attempt);
        this._logRetryAttempt(attempt, phoneNumber, error, nextDelay);
        await this._sleep(nextDelay);
      }
    }

    throw lastError;
  }

  async sendOTP(phoneNumber, otp, additionalMetadata = {}) {
    const startTime = Date.now();
    
    console.log(`🔍 [WinSMS] Début envoi OTP - Téléphone: ${phoneNumber}, Environnement: ${process.env.NODE_ENV || 'development'}`);

    const logData = {
      phoneNumber,
      otp,
      status: 'failed',
      channel: 'sms',
      attempts: 0,
      responseTime: 0,
      winSmsResponse: null,
      credentialsValid: false,
      metadata: {
        environment: process.env.NODE_ENV || 'development',
        apiUrl: this.apiUrl,
        ...additionalMetadata
      }
    };

    try {
      // Validate credentials but don't block OTP dispatch if validation fails
      // (credential check is cached and validation errors are logged separately)
      const credentialsCheck = await this.validateCredentials();
      logData.credentialsValid = credentialsCheck.success;

      if (!credentialsCheck.success) {
        console.warn(`⚠️ WinSMS: Credential validation warning (will attempt OTP send): ${credentialsCheck.error}`);
        // Do NOT throw here - allow OTP send to proceed; actual API call will fail if creds are invalid
        // This prevents test connection failures from blocking legitimate OTP sends
      }

      // Prepare message
      const message = `🔐 Votre code de vérification AMIGOS est : ${otp}`;

      // Send with retry
      console.log(`📱 WinSMS: Sending OTP to ${phoneNumber}`);
      const result = await this._sendMessageWithRetry(phoneNumber, message);

      // Success
      const responseTime = Date.now() - startTime;
      logData.status = 'success';
      logData.attempts = result.attempts;
      logData.responseTime = responseTime;
      logData.winSmsResponse = {
        statusCode: 200,
        messageId: result.messageId,
        data: { status: result.status }
      };

      await this._logWinSMSAttempt(logData);

      console.log(`✓ WinSMS: OTP envoyé avec succès à ${phoneNumber} en ${responseTime}ms (Tentative ${result.attempts}/${this.maxAttempts}, MessageID: ${result.messageId})`);

      return {
        success: true,
        channel: 'sms',
        messageId: result.messageId,
        message: 'OTP envoyé par SMS via WinSMS'
      };
    } catch (error) {
      const responseTime = Date.now() - startTime;
      const errorType = this._categorizeError(error);

      logData.status = 'failed';
      logData.responseTime = responseTime;
      logData.errorDetails = {
        type: errorType,
        message: error.message,
        code: error.response?.status?.toString() || 'UNKNOWN'
      };

      await this._logWinSMSAttempt(logData);
      await this._checkAndLogAlerts();

      console.error(`❌ WinSMS: Échec envoi OTP à ${phoneNumber} après ${this.maxAttempts} tentatives (${responseTime}ms) - Type: ${errorType}, Message: ${error.message}`);

      throw error;
    }
  }
}

module.exports = WinSMSService;
