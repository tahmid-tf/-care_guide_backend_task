const jwt = require('jsonwebtoken');
const User = require('../models/User');

/**
 * Authentication Middleware:
 * Verifies JWT token from 'Authorization: Bearer <token>' header.
 * Attaches the authenticated user document to req.user.
 */
const authenticateToken = async (req, res, next) => {
  try {
    const authHeader = req.headers.authorization;
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return res.status(401).json({
        success: false,
        message: 'Access denied. No authentication token provided.'
      });
    }

    const token = authHeader.split(' ')[1];
    const decoded = jwt.verify(token, process.env.JWT_SECRET || 'super_secret_interview_jwt_key_2026_note_app');

    // Retrieve user by ID (indexed by default _id)
    const user = await User.findById(decoded.id).select('-password');
    if (!user) {
      return res.status(401).json({
        success: false,
        message: 'Invalid token: User no longer exists.'
      });
    }

    req.user = user;
    next();
  } catch (error) {
    if (error.name === 'JsonWebTokenError') {
      return res.status(401).json({
        success: false,
        message: 'Invalid authentication token.'
      });
    }
    if (error.name === 'TokenExpiredError') {
      return res.status(401).json({
        success: false,
        message: 'Authentication token has expired. Please log in again.'
      });
    }
    return res.status(500).json({
      success: false,
      message: 'Authentication failed due to internal server error.'
    });
  }
};

module.exports = { authenticateToken };
