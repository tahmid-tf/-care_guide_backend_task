const express = require('express');
const router = express.Router();
const {
  createNote,
  listNotes,
  getNoteById,
  updateNote,
  deleteNote
} = require('../controllers/noteController');
const { authenticateToken } = require('../middleware/auth');

// All note operations require valid JWT authentication
router.use(authenticateToken);

// Create a new note
router.post('/', createNote);

// List notes with pagination
// - Regular user: their own notes (supported by index: { owner: 1, createdAt: -1 })
// - Admin: all notes across all users (supported by index: { createdAt: -1 })
router.get('/', listNotes);

// Read single note by ID (supported by default index: _id)
router.get('/:id', getNoteById);

// Update note
router.put('/:id', updateNote);

// Delete note
router.delete('/:id', deleteNote);

module.exports = router;
