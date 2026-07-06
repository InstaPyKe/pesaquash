const express = require('express');
const router = express.Router();
const financeController = require('../controllers/financeController');

// stats overview
router.get('/stats', financeController.getStats);

// activation payments manager
router.get('/activations', financeController.getActivations);
router.post('/activations/override', financeController.overrideActivation);

// withdrawals manager
router.get('/withdrawals', financeController.getWithdrawals);
router.post('/withdrawals/approve', financeController.approveWithdrawal);

module.exports = router;
