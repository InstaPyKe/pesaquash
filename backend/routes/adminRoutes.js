const express = require('express');
const router = express.Router();
const adminController = require('../controllers/adminController');

// System Configurations
router.get('/settings', adminController.getSettings);
router.post('/settings', adminController.updateSettings);

// Stats Overview
router.get('/stats', adminController.getStats);

// Members Management
router.get('/users', adminController.getUsers);
router.post('/users/toggle', adminController.toggleUserStatus);

// Earning Tasks Management
router.get('/tasks', adminController.getTasks);
router.post('/tasks', adminController.createTask);
router.delete('/tasks/:id', adminController.deleteTask);

module.exports = router;
