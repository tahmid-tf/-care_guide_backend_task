const jwt = require('jsonwebtoken');
const User = require('../models/User');

// Helper to generate JWT token
const generateToken = (userId, role) => {
  return jwt.sign(
    { id: userId, role },
    process.env.JWT_SECRET || 'super_secret_interview_jwt_key_2026_note_app',
    { expiresIn: process.env.JWT_EXPIRES_IN || '7d' }
  );
};

/**
 * @route   POST /api/auth/register
 * @desc    Register a new user (role defaults to 'user', can specify 'admin' or interests)
 * @access  Public
 */
const register = async (req, res, next) => {
  try {
    const { username, email, password, role, interests } = req.body;

    if (!username || !email || !password) {
      return res.status(400).json({
        success: false,
        message: 'Username, email, and password are required.'
      });
    }

    // Supported by index: { email: 1 } (unique)
    const existingUser = await User.findOne({ email });
    if (existingUser) {
      return res.status(409).json({
        success: false,
        message: 'A user with this email already exists.'
      });
    }

    // Parse interests if provided (e.g. array or comma-separated string)
    let parsedInterests = [];
    if (Array.isArray(interests)) {
      parsedInterests = interests.map(i => String(i).trim().toLowerCase()).filter(Boolean);
    } else if (typeof interests === 'string') {
      parsedInterests = interests.split(',').map(i => i.trim().toLowerCase()).filter(Boolean);
    }

    const user = await User.create({
      username,
      email,
      password,
      role: role === 'admin' ? 'admin' : 'user',
      interests: parsedInterests
    });

    const token = generateToken(user._id, user.role);

    res.status(201).json({
      success: true,
      message: 'User registered successfully.',
      data: {
        token,
        user: {
          _id: user._id,
          username: user.username,
          email: user.email,
          role: user.role,
          interests: user.interests
        }
      }
    });
  } catch (error) {
    next(error);
  }
};

/**
 * @route   POST /api/auth/login
 * @desc    Authenticate user & get JWT token
 * @access  Public
 */
const login = async (req, res, next) => {
  try {
    const { email, password } = req.body;

    if (!email || !password) {
      return res.status(400).json({
        success: false,
        message: 'Please provide both email and password.'
      });
    }

    // Supported by index: { email: 1 }
    const user = await User.findOne({ email: email.toLowerCase() }).select('+password');
    if (!user) {
      return res.status(401).json({
        success: false,
        message: 'Invalid email or password.'
      });
    }

    const isMatch = await user.comparePassword(password);
    if (!isMatch) {
      return res.status(401).json({
        success: false,
        message: 'Invalid email or password.'
      });
    }

    const token = generateToken(user._id, user.role);

    res.status(200).json({
      success: true,
      message: 'Login successful.',
      data: {
        token,
        user: {
          _id: user._id,
          username: user.username,
          email: user.email,
          role: user.role,
          interests: user.interests
        }
      }
    });
  } catch (error) {
    next(error);
  }
};

/**
 * @route   GET /api/auth/me
 * @desc    Get currently authenticated user's profile
 * @access  Private
 */
const getProfile = async (req, res, next) => {
  try {
    // req.user is set by authenticateToken middleware (supported by primary index _id)
    res.status(200).json({
      success: true,
      data: req.user
    });
  } catch (error) {
    next(error);
  }
};

module.exports = {
  register,
  login,
  getProfile
};
