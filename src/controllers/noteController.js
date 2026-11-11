const Note = require('../models/Note');

/**
 * @route   POST /api/notes
 * @desc    Create a new note (User or Admin)
 * @access  Private
 */
const createNote = async (req, res, next) => {
  try {
    const { title, content } = req.body;

    if (!title || !content) {
      return res.status(400).json({
        success: false,
        message: 'Title and content are required.'
      });
    }

    const note = await Note.create({
      title,
      content,
      owner: req.user._id
    });

    res.status(201).json({
      success: true,
      message: 'Note created successfully.',
      data: note
    });
  } catch (error) {
    next(error);
  }
};

/**
 * @route   GET /api/notes
 * @desc    List notes with pagination.
 *          - Regular User: retrieves their own notes.
 *          - Admin: retrieves all notes across all users (or filters by owner if requested).
 * @access  Private
 */
const listNotes = async (req, res, next) => {
  try {
    const page = Math.max(1, parseInt(req.query.page, 10) || 1);
    const limit = Math.min(50, Math.max(1, parseInt(req.query.limit, 10) || 10));
    const skip = (page - 1) * limit;

    let filter = {};

    if (req.user.role === 'admin') {
      // Admin can view everyone's notes by default, or filter by specific owner if query param is passed
      if (req.query.owner) {
        filter.owner = req.query.owner;
      } else if (req.query.scope === 'mine') {
        filter.owner = req.user._id;
      }
      // If no filter, filter is {}, query is supported by index: { createdAt: -1 }
    } else {
      // Regular user can ONLY view their own notes
      // Query is supported by compound index: { owner: 1, createdAt: -1 }
      filter.owner = req.user._id;
    }

    // Execute paginated query with sort supported by indexes
    const [notes, total] = await Promise.all([
      Note.find(filter)
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(limit)
        .populate('owner', 'username email role'),
      Note.countDocuments(filter)
    ]);

    res.status(200).json({
      success: true,
      data: notes,
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
 * @route   GET /api/notes/:id
 * @desc    Get a single note by ID (supported by default unique _id index)
 *          - Regular user: can only view if they are the owner.
 *          - Admin: can view any note.
 * @access  Private
 */
const getNoteById = async (req, res, next) => {
  try {
    // Read operation supported by primary index: _id
    const note = await Note.findById(req.params.id).populate('owner', 'username email role');

    if (!note) {
      return res.status(404).json({
        success: false,
        message: 'Note not found.'
      });
    }

    // Role check: non-admin can only access their own note
    if (req.user.role !== 'admin' && !note.owner._id.equals(req.user._id)) {
      return res.status(403).json({
        success: false,
        message: 'Forbidden: You do not have permission to view this note.'
      });
    }

    res.status(200).json({
      success: true,
      data: note
    });
  } catch (error) {
    next(error);
  }
};

/**
 * @route   PUT /api/notes/:id
 * @desc    Update a note
 *          - Regular user: can only update their own note.
 *          - Admin: can update any note.
 * @access  Private
 */
const updateNote = async (req, res, next) => {
  try {
    const { title, content } = req.body;

    const note = await Note.findById(req.params.id);
    if (!note) {
      return res.status(404).json({
        success: false,
        message: 'Note not found.'
      });
    }

    if (req.user.role !== 'admin' && !note.owner.equals(req.user._id)) {
      return res.status(403).json({
        success: false,
        message: 'Forbidden: You do not have permission to edit this note.'
      });
    }

    if (title !== undefined) note.title = title;
    if (content !== undefined) note.content = content;

    const updatedNote = await note.save();

    res.status(200).json({
      success: true,
      message: 'Note updated successfully.',
      data: updatedNote
    });
  } catch (error) {
    next(error);
  }
};

/**
 * @route   DELETE /api/notes/:id
 * @desc    Delete a note
 *          - Regular user: can only delete their own note.
 *          - Admin: can delete any note.
 * @access  Private
 */
const deleteNote = async (req, res, next) => {
  try {
    const note = await Note.findById(req.params.id);
    if (!note) {
      return res.status(404).json({
        success: false,
        message: 'Note not found.'
      });
    }

    if (req.user.role !== 'admin' && !note.owner.equals(req.user._id)) {
      return res.status(403).json({
        success: false,
        message: 'Forbidden: You do not have permission to delete this note.'
      });
    }

    await note.deleteOne();

    res.status(200).json({
      success: true,
      message: 'Note deleted successfully.'
    });
  } catch (error) {
    next(error);
  }
};

module.exports = {
  createNote,
  listNotes,
  getNoteById,
  updateNote,
  deleteNote
};
