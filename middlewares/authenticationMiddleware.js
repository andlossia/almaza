const jwt = require('jsonwebtoken');

// Middleware to authenticate the user using JWT
const authenticate = (req, res, next) => {
  try {
    // Extract token from Authorization header or query parameters
    const token = req.header('Authorization')?.replace('Bearer ', '') || req.query.token;

    if (!token) {
      console.warn('Authentication token not provided');
      return res.status(401).json({ message: 'Authentication token is required.' });
    }

    // Verify the token and set user information in request object
    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    req.user = decoded;
    next();
  } catch (err) {
    console.error('Token verification failed:', err.message);
    return res.status(401).json({ message: 'Unauthorized: Invalid token.' });
  }
};

// Middleware to check user roles
const checkRole = (roles) => (req, res, next) => {
  const userRoles = req.user?.roles || [];
  const hasRequiredRole = roles.some(role => userRoles.includes(role));

  if (hasRequiredRole) {
    return next();
  }

  console.warn(`User does not have the required roles: ${roles}`);
  return res.status(403).json({ message: 'Forbidden: Insufficient privileges.' });
};

// Middleware to authorize owner or specific roles for a resource
const authorizeOwnerOrRole = (Model, roles = []) => {
  return async (req, res, next) => {
    try {
      // Fetch item by ID from the database
      const item = await Model.findById(req.params.id);

      if (!item) {
        console.warn(`Item not found: ${req.params.id}`);
        return res.status(404).json({ message: 'Item not found' });
      }

      // Check ownership and roles
      const itemOwnerId = item.owner?.toString() || null;
      const userId = req.user?.id?.toString() || null;

      if (!itemOwnerId || !userId) {
        console.error('Authorization data is missing');
        return res.status(500).json({ message: 'Authorization data is missing' });
      }

      const isOwner = itemOwnerId === userId;
      const userRoles = Array.isArray(req.user.roles) ? req.user.roles : [];
      const validRoles = Array.isArray(roles) ? roles : [];
      const hasRole = validRoles.some(role => userRoles.includes(role));

      if (!isOwner && !hasRole) {
        console.warn(`User is not authorized: User ID: ${userId}, Item Owner ID: ${itemOwnerId}`);
        return res.status(403).json({ message: 'Forbidden' });
      }

      req.actionMadeBy = isOwner ? 'owner' : hasRole ? 'role' : 'unknown';
      next();
    } catch (error) {
      console.error('Authorization Error:', error.message);
      return res.status(500).json({ message: 'Internal error during authorization.', error: error.message });
    }
  };
};

// Exporting middleware functions
module.exports = { authenticate, checkRole, authorizeOwnerOrRole };
