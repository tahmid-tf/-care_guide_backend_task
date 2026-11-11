const express = require('express');
const router = express.Router();
const { register, login, getProfile } = require('../controllers/authController');
const { authenticateToken } = require('../middleware/auth');

// Public auth routes
router.post('/register', register);
router.post('/login', login);

// Private profile route (supported by index: _id)
router.get('/me', authenticateToken, getProfile);

module.exports = router;
