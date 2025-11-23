const axios = require('axios');

const KONNECT_BASE_URL = process.env.KONNECT_API_URL; // sandbox ou prod
const KONNECT_API_KEY = process.env.KONNECT_API_KEY;

exports.createPayment = async ({ amount, currency, orderId, returnUrl }) => {
  const response = await axios.post(
    `${KONNECT_BASE_URL}/v1/payments/init`,
    {
      amount,
      currency,
      orderId,
      returnUrl,
    },
    {
      headers: {
        Authorization: `Bearer ${KONNECT_API_KEY}`,
        'Content-Type': 'application/json',
      },
    }
  );
  return response.data;
};
