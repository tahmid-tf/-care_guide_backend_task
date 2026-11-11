const Post = require('../models/Post');

/**
 * @route   POST /api/posts
 * @desc    Create a new post (visible to everyone)
 * @access  Private
 */
const createPost = async (req, res, next) => {
  try {
    const { title, content } = req.body;

    if (!title || !content) {
      return res.status(400).json({
        success: false,
        message: 'Title and content are required.'
      });
    }

    const post = await Post.create({
      title,
      content,
      author: req.user._id
    });

    const populatedPost = await Post.findById(post._id).populate('author', 'username email');

    res.status(201).json({
      success: true,
      message: 'Post created successfully.',
      data: populatedPost
    });
  } catch (error) {
    next(error);
  }
};

/**
 * @route   GET /api/posts
 * @desc    List all public posts with pagination.
 *          Supported by index: { createdAt: -1 }
 * @access  Public
 */
const listPosts = async (req, res, next) => {
  try {
    const page = Math.max(1, parseInt(req.query.page, 10) || 1);
    const limit = Math.min(50, Math.max(1, parseInt(req.query.limit, 10) || 10));
    const skip = (page - 1) * limit;

    const [posts, total] = await Promise.all([
      Post.find()
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(limit)
        .populate('author', 'username email role'),
      Post.countDocuments()
    ]);

    res.status(200).json({
      success: true,
      data: posts,
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

module.exports = {
  createPost,
  listPosts
};
