const express = require('express');
const router = express.Router();
const authController = require('../controllers/authController');

// Route: POST /api/auth/register
router.post('/register', authController.register);

// Route: POST /api/auth/login
router.post('/login', authController.login);

// Route: POST /api/auth/admin-login
router.post('/admin-login', authController.adminLogin);

// Route: POST /api/auth/activate
router.post('/activate', authController.activate);

// Route: POST /api/auth/finance-login
router.post('/finance-login', authController.financeLogin);

module.exports = router;
