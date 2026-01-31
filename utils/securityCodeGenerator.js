const User = require('../models/User');
const crypto = require('crypto');

/**
 * Generate a unique 6-digit security code with collision detection
 * @param {string} role - The role to check for uniqueness (default: 'deliverer')
 * @param {number} maxRetries - Maximum retry attempts (default: 5)
 * @returns {Promise<string>} A unique 6-digit security code
 * @throws {Error} If unable to generate unique code after max retries
 */
const generateUniqueSecurityCode = async (role = 'deliverer', maxRetries = 5) => {
  let attempts = 0;
  let codeExists = true;
  let securityCode;

  while (codeExists && attempts < maxRetries) {
    securityCode = (Math.floor(Math.random() * 900000) + 100000).toString();
    const existingCode = await User.findOne({
      securityCode: securityCode,
      role: role
    });
    codeExists = !!existingCode;
    attempts++;
  }

  if (codeExists) {
    throw new Error(
      `Impossible de générer un code de sécurité unique après ${maxRetries} tentatives. Veuillez réessayer.`
    );
  }

  return securityCode;
};

/**
 * Generate a simple 6-digit security code (without collision check)
 * @returns {string} A 6-digit security code
 */
const generateSecurityCode = () => {
  return (Math.floor(Math.random() * 900000) + 100000).toString();
};

/**
 * Validate security code with timing-safe comparison
 * @param {string} providedCode - The code provided by user
 * @param {string} storedCode - The code stored in database
 * @returns {boolean} True if codes match, false otherwise
 */
const validateSecurityCode = (providedCode, storedCode) => {
  if (!providedCode || !storedCode) {
    return false;
  }

  const provided = String(providedCode).trim();
  const stored = String(storedCode).trim();

  // Use timing-safe comparison to prevent timing attacks
  try {
    return crypto.timingSafeEqual(
      Buffer.from(provided),
      Buffer.from(stored)
    );
  } catch (error) {
    // timingSafeEqual throws if buffers are different lengths
    return false;
  }
};

module.exports = {
  generateUniqueSecurityCode,
  generateSecurityCode,
  validateSecurityCode
};
