/**
 * Role-Based Access Control (RBAC) Middleware:
 * Ensures the authenticated user has one of the allowed roles.
 */
const requireRole = (...roles) => {
  return (req, res, next) => {
    if (!req.user) {
      return res.status(401).json({
        success: false,
        message: 'Authentication required.'
      });
    }

    if (!roles.includes(req.user.role)) {
      return res.status(403).json({
        success: false,
        message: `Forbidden: Access restricted to roles [${roles.join(', ')}]. Your current role is '${req.user.role}'.`
      });
    }

    next();
  };
};

module.exports = { requireRole };
