const express = require('express');
const router = express.Router();
const { createPost, listPosts } = require('../controllers/postController');
const { authenticateToken } = require('../middleware/auth');

// Public feed: view all posts with pagination (supported by index: { createdAt: -1 })
router.get('/', listPosts);

// Authenticated users can create posts
router.post('/', authenticateToken, createPost);

module.exports = router;
