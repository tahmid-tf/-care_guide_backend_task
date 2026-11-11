const mongoose = require('mongoose');
const User = require('../models/User');
const Note = require('../models/Note');
const Post = require('../models/Post');

/**
 * @route   GET /api/users
 * @desc    Admin: List all users with pagination.
 *          Supported by index: { createdAt: -1 }
 * @access  Private (Admin only)
 */
const listUsers = async (req, res, next) => {
  try {
    const page = Math.max(1, parseInt(req.query.page, 10) || 1);
    const limit = Math.min(50, Math.max(1, parseInt(req.query.limit, 10) || 10));
    const skip = (page - 1) * limit;

    // Index { createdAt: -1 } allows MongoDB to stream sorted results directly without in-memory sort
    const [users, total] = await Promise.all([
      User.find()
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(limit),
      User.countDocuments()
    ]);

    res.status(200).json({
      success: true,
      data: users,
      pagination: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit) || 1
      }
    });
  } catch (error) {
    next(error);
  }
};

/**
 * @route   POST /api/users
 * @desc    Admin: Add a new user
 * @access  Private (Admin only)
 */
const createUser = async (req, res, next) => {
  try {
    const { username, email, password, role, interests } = req.body;

    if (!username || !email || !password) {
      return res.status(400).json({
        success: false,
        message: 'Username, email, and password are required.'
      });
    }

    // Supported by index: { email: 1 } (unique)
    const existing = await User.findOne({ email });
    if (existing) {
      return res.status(409).json({
        success: false,
        message: 'A user with this email already exists.'
      });
    }

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

    res.status(201).json({
      success: true,
      message: 'User created successfully.',
      data: user
    });
  } catch (error) {
    next(error);
  }
};

/**
 * @route   GET /api/users/:id
 * @desc    Admin: Fetch a single user profile
 *          Supported by primary index: _id
 * @access  Private (Admin only)
 */
const getUserById = async (req, res, next) => {
  try {
    const user = await User.findById(req.params.id);
    if (!user) {
      return res.status(404).json({
        success: false,
        message: 'User not found.'
      });
    }

    res.status(200).json({
      success: true,
      data: user
    });
  } catch (error) {
    next(error);
  }
};

/**
 * @route   PUT /api/users/:id
 * @desc    Admin: Update user details (username, role, interests, etc.)
 * @access  Private (Admin only)
 */
const updateUser = async (req, res, next) => {
  try {
    const { username, role, interests } = req.body;

    const user = await User.findById(req.params.id);
    if (!user) {
      return res.status(404).json({
        success: false,
        message: 'User not found.'
      });
    }

    if (username !== undefined) user.username = username;
    if (role !== undefined && ['user', 'admin'].includes(role)) user.role = role;
    if (interests !== undefined) {
      if (Array.isArray(interests)) {
        user.interests = interests.map(i => String(i).trim().toLowerCase()).filter(Boolean);
      } else if (typeof interests === 'string') {
        user.interests = interests.split(',').map(i => i.trim().toLowerCase()).filter(Boolean);
      }
    }

    const updatedUser = await user.save();

    res.status(200).json({
      success: true,
      message: 'User updated successfully.',
      data: updatedUser
    });
  } catch (error) {
    next(error);
  }
};

/**
 * @route   DELETE /api/users/:id
 * @desc    Admin: Remove a user (and clean up their notes)
 * @access  Private (Admin only)
 */
const deleteUser = async (req, res, next) => {
  try {
    // Prevent admin from deleting their own active account accidentally
    if (req.user._id.toString() === req.params.id) {
      return res.status(400).json({
        success: false,
        message: 'Cannot delete your own admin account while logged in.'
      });
    }

    const user = await User.findById(req.params.id);
    if (!user) {
      return res.status(404).json({
        success: false,
        message: 'User not found.'
      });
    }

    await Promise.all([
      user.deleteOne(),
      Note.deleteMany({ owner: req.params.id }),
      Post.deleteMany({ author: req.params.id })
    ]);

    res.status(200).json({
      success: true,
      message: 'User and associated data deleted successfully.'
    });
  } catch (error) {
    next(error);
  }
};

// ============================================================================
// AGGREGATION TASKS
// ============================================================================

/**
 * @route   GET /api/aggregations/group-by-interests
 * @desc    Scenario 1: Group by Interests
 *          - Context: User profiles contain a list of interests (e.g. ['chess', 'reading'])
 *          - Task: Specific view to see users grouped by interests.
 *          - Constraint: EXACTLY ONE collection.aggregate() call. Do not use any other methods.
 *          - Index Support: userSchema.index({ interests: 1 })
 * @access  Private (or Public / Authenticated)
 */
const groupByInterests = async (req, res, next) => {
  try {
    // EXACTLY ONE aggregate() call as mandated by the instructions
    const result = await User.aggregate([
      // Stage 1: Deconstruct the interests array so each interest creates an individual document stream
      { $unwind: '$interests' },

      // Stage 2: Group users by each distinct interest
      {
        $group: {
          _id: '$interests',
          userCount: { $sum: 1 },
          users: {
            $push: {
              _id: '$_id',
              username: '$username',
              email: '$email',
              role: '$role'
            }
          }
        }
      },

      // Stage 3: Project clean output format
      {
        $project: {
          _id: 0,
          interest: '$_id',
          userCount: 1,
          users: 1
        }
      },

      // Stage 4: Sort alphabetically by interest name
      { $sort: { interest: 1 } }
    ]);

    res.status(200).json({
      success: true,
      message: 'Users grouped by interests retrieved successfully via single aggregation pipeline.',
      count: result.length,
      data: result
    });
  } catch (error) {
    next(error);
  }
};

/**
 * @route   GET /api/aggregations/user-posts/:userId
 * @desc    Scenario 2: User Posts ($lookup)
 *          - Context: Users can write posts which are stored in a separate Posts collection.
 *                     These posts are visible to everyone.
 *          - Task: Retrieve all posts belonging to a particular user.
 *          - Constraint: Use a single aggregation pipeline with a $lookup stage.
 *          - Index Support: postSchema.index({ author: 1, createdAt: -1 }) & User _id
 * @access  Private / Public
 */
const getUserPostsViaLookup = async (req, res, next) => {
  try {
    const { userId } = req.params;

    if (!mongoose.Types.ObjectId.isValid(userId)) {
      return res.status(400).json({
        success: false,
        message: 'Invalid user ID format.'
      });
    }

    // EXACTLY ONE aggregate() pipeline utilizing $lookup as mandated by the instructions
    const result = await User.aggregate([
      // Stage 1: Match the specific user by their ID
      {
        $match: {
          _id: new mongoose.Types.ObjectId(userId)
        }
      },

      // Stage 2: $lookup stage to retrieve all posts belonging to this particular user from 'posts' collection
      // Supported by index on posts: { author: 1, createdAt: -1 }
      {
        $lookup: {
          from: 'posts',
          localField: '_id',
          foreignField: 'author',
          pipeline: [
            { $sort: { createdAt: -1 } }
          ],
          as: 'posts'
        }
      },

      // Stage 3: Clean projection excluding sensitive fields
      {
        $project: {
          password: 0
        }
      }
    ]);

    if (!result || result.length === 0) {
      return res.status(404).json({
        success: false,
        message: 'User not found.'
      });
    }

    res.status(200).json({
      success: true,
      message: 'User posts retrieved successfully via $lookup aggregation pipeline.',
      data: result[0]
    });
  } catch (error) {
    next(error);
  }
};

module.exports = {
  listUsers,
  createUser,
  getUserById,
  updateUser,
  deleteUser,
  groupByInterests,
  getUserPostsViaLookup
};
