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
const authorizeOwnerOrRole = (Model, modelName, requiredRoles = []) => {
  return async (req, res, next) => {
    try {
      // Retrieve the user from the request object (after authentication)
      const userId = req.user.id;
      
      // Find the item by ID
      const item = await Model.findById(req.params.id);
      if (!item) {
        return res.status(404).json({ message: `${modelName} not found` });
      }

      // Check if the user is the owner of the item
      const isOwner = item.owner && item.owner.toString() === userId.toString();
      
      // Check if the user has an appropriate role (e.g., admin or other roles)
      const hasRolePermission = req.user.roles && requiredRoles.some(role => req.user.roles.includes(role));

      // If the user is either the owner or has the necessary role, proceed
      if (isOwner || hasRolePermission) {
        return next();
      } else {
        return res.status(403).json({ message: "Forbidden: You are not authorized to delete this item" });
      }
    } catch (error) {
      res.status(500).json({
        message: `Error authorizing action for ${modelName}`,
        error: error.message,
      });
    }
  };
};

// Exporting middleware functions
module.exports = { authenticate, checkRole, authorizeOwnerOrRole };
