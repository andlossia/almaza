
const { authenticate } = require('../../../middlewares/authenticationMiddleware');

const getCurrentUser = (Model) => [
    authenticate,  // Assuming this middleware attaches `user` to `req`
    async (req, res) => {
      try {
        // Check if user ID is present in the request
        if (!req.user || !req.user.id) {
          return res.status(401).json({ message: 'Unauthorized: No user information found' });
        }
  
        // Fetch user from database and exclude password
        const user = await Model.findById(req.user.id).select('-password');
        
        // Check if user exists
        if (!user) {
          return res.status(404).json({ message: 'User not found' });
        }
  
        // Return the user data (status 200 is standard for successful GET requests)
        res.status(200).json(user);
        
      } catch (error) {
        // Log the error and return a generic message
        console.error('Error fetching user profile:', error.message);
        res.status(500).json({ message: 'Internal server error', error: error.message });
      }
    }
  ];
  

module.exports = getCurrentUser;
