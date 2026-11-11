const mongoose = require('mongoose');

const noteSchema = new mongoose.Schema(
  {
    title: {
      type: String,
      required: [true, 'Note title is required'],
      trim: true,
      maxlength: [150, 'Title cannot exceed 150 characters']
    },
    content: {
      type: String,
      required: [true, 'Note content is required'],
      trim: true
    },
    owner: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: [true, 'Note must have an owner']
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

// 1. Compound Index (owner + createdAt):
// Essential for regular user list operation: Note.find({ owner: userId }).sort({ createdAt: -1 })
// Applies the ESR rule (Equality on owner, Sort on createdAt) to eliminate in-memory sorting.
noteSchema.index({ owner: 1, createdAt: -1 });

// 2. CreatedAt Index:
// Essential for Admin list operation: Note.find().sort({ createdAt: -1 })
// Allows admin to paginate through all users' notes efficiently in chronological order.
noteSchema.index({ createdAt: -1 });

// Note: Finding a single note by ID (Note.findById or Note.findOne({ _id, owner }))
// is automatically supported by MongoDB's default unique primary index on _id.
// No redundant index is created.

const Note = mongoose.model('Note', noteSchema);

module.exports = Note;
