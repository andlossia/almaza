const User = require('../models/userModel'); 
const initController = require('./crud/initController');
const getCurrentUser = require('../controllers/crud/custom/userMethods');

// Initialize the user controller with necessary methods
const userController = initController(
    User, 
    'User', 
    { getUserProfile: getCurrentUser(User) },
    [],
    []

);

// Export the user controller
module.exports = userController;
