const express = require('express');
const router = express.Router();

const authController = require('../controllers/authController');


router.post('/sign-up', authController.createAccount);
router.post('/sign-in', authController.createLogin);
router.post('/forgot-password', authController.forgotPassword);
router.post('/reset-password', authController.resetPassword);
router.post('/logout', authController.logout);
router.get('/profile', authController.getCurrentUser);
router.get('/verifyToken', authController.verifyToken);
router.get('/users', authController.getAllUsers);
router.get('/user/:id', authController.getUserById);
router.put('/user/:id', authController.updateCurrentUser);
router.delete('/delete-account', authController.deleteAccount);


module.exports = router;
