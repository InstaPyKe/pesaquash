const express = require('express');
const router = express.Router();
const userController = require('../controllers/userController');

// Route: GET /api/users/dashboard-stats
router.get('/dashboard-stats', userController.getDashboardStats);

router.get('/tasks', userController.getTasks);
router.post('/complete-task', userController.completeTask);
router.post('/spin', userController.spinWheel);
router.get('/referrals', userController.getReferrals);
router.post('/withdraw', userController.withdraw);

module.exports = router;
