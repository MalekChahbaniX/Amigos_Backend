// routes/paymentRoutes.js
import express from 'express';
import {
  initiatePayment,
  paymentCallback,
  checkPaymentStatus,
} from '../controllers/paymentController.js';

const router = express.Router();

router.post('/initiate', initiatePayment);
router.post('/callback', paymentCallback);
router.get('/status/:id', checkPaymentStatus);

export default router;
