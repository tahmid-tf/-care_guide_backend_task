const express = require('express');
const router = express.Router();
const {
  listUsers,
  createUser,
  getUserById,
  updateUser,
  deleteUser
} = require('../controllers/userController');
const { authenticateToken } = require('../middleware/auth');
const { requireRole } = require('../middleware/role');

// All user management routes require admin role
router.use(authenticateToken);
router.use(requireRole('admin'));

// List users with pagination (supported by index: { createdAt: -1 })
router.get('/', listUsers);

// Add a new user (Admin)
router.post('/', createUser);

// Get single user by ID (supported by index: _id)
router.get('/:id', getUserById);

// Update user details
router.put('/:id', updateUser);

// Delete user
router.delete('/:id', deleteUser);

module.exports = router;
