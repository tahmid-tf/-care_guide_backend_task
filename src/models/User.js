const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');

const userSchema = new mongoose.Schema(
  {
    username: {
      type: String,
      required: [true, 'Username is required'],
      trim: true,
      minlength: [3, 'Username must be at least 3 characters long']
    },
    email: {
      type: String,
      required: [true, 'Email is required'],
      lowercase: true,
      trim: true,
      match: [/\S+@\S+\.\S+/, 'Please provide a valid email address']
    },
    password: {
      type: String,
      required: [true, 'Password is required'],
      minlength: [6, 'Password must be at least 6 characters long'],
      select: false // Do not return password by default in queries
    },
    role: {
      type: String,
      enum: ['user', 'admin'],
      default: 'user'
    },
    interests: {
      type: [String],
      default: []
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

// 1. Email Index: Essential for O(1) user lookup during authentication (login/register)
// and ensures email uniqueness at the database level.
userSchema.index({ email: 1 }, { unique: true });

// 2. CreatedAt Index: Essential for Admin pagination query:
// User.find().sort({ createdAt: -1 }).skip(...).limit(...)
userSchema.index({ createdAt: -1 });

// 3. Interests Multikey Index: Essential for Aggregation Scenario 1:
// Unwinding, grouping, and filtering users by interests.
userSchema.index({ interests: 1 });

// Password hashing middleware before saving user document
userSchema.pre('save', async function (next) {
  if (!this.isModified('password')) {
    return next();
  }
  const salt = await bcrypt.genSalt(10);
  this.password = await bcrypt.hash(this.password, salt);
  next();
});

// Method to verify password match
userSchema.methods.comparePassword = async function (enteredPassword) {
  return await bcrypt.compare(enteredPassword, this.password);
};

// Remove sensitive fields when converting to JSON
userSchema.methods.toJSON = function () {
  const userObject = this.toObject();
  delete userObject.password;
  return userObject;
};

const User = mongoose.model('User', userSchema);

module.exports = User;
