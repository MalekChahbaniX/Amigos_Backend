const WinSMSService = require('./winSmsService');
const OTPService = require('./otpService');

let winSmsService = null;

// Lazy initialization of WinSMS service
function getWinSmsService() {
  if (!winSmsService) {
    winSmsService = new WinSMSService();
  }
  return winSmsService;
}

class SMSRouterService {
  constructor() {
    console.log('📱 SMS Router Service initialized');
  }

  /**
   * Detect country code from phone number
   * Extracts the country code from the beginning of the phone number
   * @param {string} phoneNumber - Phone number in international format (e.g., +216XXXXXXXX)
   * @returns {string} Country code (e.g., '+216', '+33', '+1')
   */
  detectCountryCode(phoneNumber) {
    if (!phoneNumber || typeof phoneNumber !== 'string') {
      console.warn('⚠️ SMS Router: Invalid phone number format');
      return null;
    }

    // Remove any whitespace
    const cleanNumber = phoneNumber.trim();

    // Match country code pattern: + followed by 1-3 digits
    const countryCodeMatch = cleanNumber.match(/^\+(\d{1,3})/);

    if (!countryCodeMatch) {
      console.warn(`⚠️ SMS Router: Could not detect country code from ${this._maskPhoneNumber(cleanNumber)}`);
      return null;
    }

    return `+${countryCodeMatch[1]}`;
  }

  /**
   * Mask phone number for secure logging
   * Shows only first and last 4 digits, masks the middle
   * @param {string} phoneNumber - Full phone number
   * @returns {string} Masked phone number
   */
  _maskPhoneNumber(phoneNumber) {
    if (!phoneNumber || phoneNumber.length < 8) {
      return '****';
    }
    const first = phoneNumber.substring(0, 4);
    const last = phoneNumber.substring(phoneNumber.length - 4);
    return `${first}****${last}`;
  }

  /**
   * Route SMS to appropriate service based on country code
   * @param {string} phoneNumber - Phone number in international format
   * @param {string} otp - OTP code to send
   * @returns {Promise<Object>} Unified response object
   */
  async sendOTP(phoneNumber, otp) {
    const startTime = Date.now();

    try {
      // Log phone number (masked)
      const maskedNumber = this._maskPhoneNumber(phoneNumber);
      console.log(`📱 SMS Router: Envoi OTP vers ${maskedNumber}`);

      // Detect country code
      const countryCode = this.detectCountryCode(phoneNumber);
      console.log(`🌍 SMS Router: Code pays détecté: ${countryCode}`);

      // Route based on country code
      if (countryCode === '+216') {
        console.log(`📤 SMS Router: Service sélectionné: WinSMS`);
        return await this._routeToWinSMS(phoneNumber, otp, startTime);
      } else {
        console.log(`📤 SMS Router: Service sélectionné: Twilio (OTPService)`);
        return await this._routeToTwilio(phoneNumber, otp, startTime);
      }
    } catch (error) {
      console.error(`❌ SMS Router: Erreur lors du routage SMS:`, error.message);
      throw error;
    }
  }

  /**
   * Route to WinSMS service for Tunisian numbers
   * @private
   */
  async _routeToWinSMS(phoneNumber, otp, startTime) {
    try {
      const service = getWinSmsService();
      const result = await service.sendOTP(phoneNumber, otp);
      const responseTime = Date.now() - startTime;

      // Normalize response format
      const unifiedResponse = {
        success: result.success,
        channels: [result.channel || 'sms'],
        channel: result.channel || 'sms',
        provider: 'winsms',
        message: result.message || 'OTP envoyé avec succès via WinSMS',
        messageId: result.messageId,
        responseTime
      };

      console.log(`✓ SMS Router: SMS envoyé avec succès via WinSMS en ${responseTime}ms`);

      return unifiedResponse;
    } catch (error) {
      console.error(
        `❌ SMS Router: Erreur WinSMS pour ${this._maskPhoneNumber(phoneNumber)}:`,
        error.message
      );
      // Preserve original error and attach provider field
      error.provider = 'winsms';
      throw error;
    }
  }

  /**
   * Route to Twilio OTPService for other countries
   * @private
   */
  async _routeToTwilio(phoneNumber, otp, startTime) {
    try {
      const result = await OTPService.sendOTP(phoneNumber, otp);
      const responseTime = Date.now() - startTime;

      // Normalize response format
      const unifiedResponse = {
        success: result.success,
        channels: result.channels || (result.channel ? [result.channel] : ['sms', 'whatsapp']),
        channel: result.channel,
        provider: 'twilio',
        message: result.message || 'OTP envoyé avec succès via Twilio',
        responses: result.responses,
        messageId: result.messageId,
        responseTime
      };

      console.log(`✓ SMS Router: SMS envoyé avec succès via Twilio en ${responseTime}ms`);

      return unifiedResponse;
    } catch (error) {
      console.error(
        `❌ SMS Router: Erreur Twilio pour ${this._maskPhoneNumber(phoneNumber)}:`,
        error.message
      );
      // Preserve original error and attach provider field
      error.provider = 'twilio';
      throw error;
    }
  }

  /**
   * Test connection to both WinSMS and Twilio services
   * @returns {Promise<Object>} Status of both services
   */
  async testConnection() {
    console.log('🧪 SMS Router: Test de connexion des deux services...');

    const results = {
      winsms: null,
      twilio: null,
      timestamp: new Date().toISOString()
    };

    // Test WinSMS
    try {
      const service = getWinSmsService();
      const winSmsTest = await service.testConnection();
      results.winsms = {
        status: winSmsTest.success ? 'connected' : 'failed',
        error: winSmsTest.error,
        balance: winSmsTest.balance
      };
      console.log(`✓ WinSMS: ${winSmsTest.success ? 'Connecté' : 'Déconnecté'}`);
    } catch (error) {
      results.winsms = {
        status: 'error',
        error: error.message
      };
      console.error(`❌ WinSMS: Erreur lors du test -`, error.message);
    }

    // Test Twilio
    try {
      const twilioTest = await OTPService.testConnection();
      results.twilio = {
        status: twilioTest.success ? 'connected' : 'failed',
        error: twilioTest.error
      };
      console.log(`✓ Twilio: ${twilioTest.success ? 'Connecté' : 'Déconnecté'}`);
    } catch (error) {
      results.twilio = {
        status: 'error',
        error: error.message
      };
      console.error(`❌ Twilio: Erreur lors du test -`, error.message);
    }

    return results;
  }

  /**
   * Get service status information
   * @returns {Promise<Object>} Status information for both services
   */
  async getServiceStatus() {
    return await this.testConnection();
  }
}

module.exports = new SMSRouterService();
