const mongoose = require('mongoose');

const postSchema = new mongoose.Schema(
  {
    title: {
      type: String,
      required: [true, 'Post title is required'],
      trim: true,
      maxlength: [200, 'Title cannot exceed 200 characters']
    },
    content: {
      type: String,
      required: [true, 'Post content is required'],
      trim: true
    },
    author: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: [true, 'Post must have an author']
    }
  },
  {
    timestamps: true
  }
);

// ============================================================================
// DATABASE INDEXING (Explicit schema.index definitions for review)
// Critical Constraint: Only strictly required indexes are defined.
// ============================================================================

// 1. Compound Index (author + createdAt):
// Essential for Aggregation Scenario 2 ($lookup stage & author filtering):
// Fast resolution of posts belonging to a specific user, sorted chronologically.
postSchema.index({ author: 1, createdAt: -1 });

// 2. CreatedAt Index:
// Essential for the public feed list operation: Post.find().sort({ createdAt: -1 })
// Allowing all users to view public posts efficiently with pagination.
postSchema.index({ createdAt: -1 });

const Post = mongoose.model('Post', postSchema);

module.exports = Post;
