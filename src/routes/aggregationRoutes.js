const express = require('express');
const router = express.Router();
const {
  groupByInterests,
  getUserPostsViaLookup
} = require('../controllers/userController');
const { authenticateToken } = require('../middleware/auth');

/**
 * Scenario 1: Group by Interests
 * Constraint: Exactly one collection.aggregate() call.
 * Supported by index: userSchema.index({ interests: 1 })
 */
router.get('/group-by-interests', groupByInterests);

/**
 * Scenario 2: User Posts ($lookup)
 * Constraint: Single aggregation pipeline with a $lookup stage.
 * Supported by index: postSchema.index({ author: 1, createdAt: -1 })
 */
router.get('/user-posts/:userId', getUserPostsViaLookup);

module.exports = router;
