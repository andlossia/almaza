const User = require('../models/userModel');
const bcrypt = require('bcrypt');
const jwt = require('jsonwebtoken');
const crypto = require('crypto');
const sendEmail = require('../services/smtp/email/emailSender'); 

exports.createAccount = async (req, res) => {
  const {userName, email, password } = req.body;

  try {
    const userEmail = await User.findOne({ email });
    const userUsername = await User.findOne({ userName });

    if (userEmail) {
      return res.status(400).json({ message: 'Email already exists' });
    } else if (userUsername) {
      return res.status(400).json({ message: 'Username already exists' });
    }

    const hashedPassword = await bcrypt.hash(password, 10);
    const result = await User.create({
      ...req.body,
      password: hashedPassword
    });

    const token = jwt.sign({ email: result.email, id: result._id }, process.env.JWT_SECRET, { expiresIn: '100h' });

    return res.status(200).json({
      message: 'User created successfully',
      result,
      token
    });
  } catch (error) {
    return res.status(500).json({ message: 'Something went wrong' });
  }
};

exports.createLogin = async (req, res) => {
  const { email, password } = req.body;

  try {
    const user = await User.findOne({ email });
    if (!user) {
      return res.status(404).json({ message: 'User not found' });
    }

    const isPasswordCorrect = await bcrypt.compare(password, user.password);
    if (!isPasswordCorrect) {
      return res.status(400).json({ message: 'Invalid credentials' });
    }

    const token = jwt.sign({ email: user.email, id: user._id }, process.env.JWT_SECRET, { expiresIn: '240h' });

    return res.status(200 || 201).json({
      message: 'Login successful',
      result: user,
      token
    });
  } catch (error) {
    return res.status(500).json({ message: 'Something went wrong' });
  }
};

exports.getAllUsers = async (req, res) => {
  
  try {
    const users = await User.find();
    return res.status(200).json({ users });
  } catch (error) {
    return res.status(500).json({ message: 'Something went wrong' });
  }
};

exports.getUserById = async (req, res) => {
  const { id } = req.params;
  try {
    const user = await User.findById(id);
    if (!user) {
      return res.status(404).json({ message: 'User not found' });
    }

    return res.status(200).json({ user });
  } catch (error) {
    return res.status(500).json({ message: 'Something went wrong' });
  }
};

exports.getCurrentUser = async (req, res) => {
  const authHeader = req.headers.authorization;

  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return res.status(401).json({ message: 'Authentication token missing or malformed' });
  }

  const token = authHeader.split(' ')[1];

  try {
    const decodedToken = jwt.verify(token, process.env.JWT_SECRET);

    if (!decodedToken || !decodedToken.id) {
      return res.status(401).json({ message: 'Invalid token' });
    }

    const userId = decodedToken.id;
    const user = await User.findById(userId).select('-password');

    if (!user) {
      return res.status(404).json({ message: 'User not found' });
    }

    return res.status(200 || 201).json({ user });
  } catch (error) {
    if (error.name === 'JsonWebTokenError' || error.name === 'TokenExpiredError') {
      return res.status(401).json({ message: 'Invalid or expired token' });
    }

    return res.status(500).json({ message: 'Something went wrong' });
  }
};

exports.verifyToken = async (req, res) => {
  try {
    const authHeader = req.headers.authorization;
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return res.status(401).json({ message: 'Unauthorized' });
    }
    
    const token = authHeader.split(' ')[1];
    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    
    const user = await User.findOne({ email: decoded.email });
    if (!user) {
      return res.status(404).json({ message: 'User not found' });
    }
    
    return res.status(200).json({ user });
  } catch (error) {
    console.error('Token verification error:', error); // Log detailed error
    if (error.name === 'TokenExpiredError') {
      return res.status(401).json({ message: 'Token expired' });
    }
    if (error.name === 'JsonWebTokenError') {
      return res.status(401).json({ message: 'Invalid token' });
    }
    return res.status(500).json({ message: 'Something went wrong' });
  }
};


exports.updateCurrentUser = async (req, res) => {
  const authHeader = req.headers.authorization;
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return res.status(401).json({ message: 'Authentication token missing or malformed' });
  }

  const token = authHeader.split(' ')[1];

  try {
    const decodedToken = jwt.verify(token, process.env.JWT_SECRET);
    if (!decodedToken || !decodedToken.id) {
      return res.status(401).json({ message: 'Invalid token' });
    }

    const userId = decodedToken.id;
    const user = await User.findById(userId);
    if (!user) {
      return res.status(404).json({ message: 'User not found' });
    } else {
      user.firstName = req.body.firstName || user.firstName;
      user.lastName = req.body.lastName || user.lastName;
      user.userName = req.body.userName || user.userName;
      user.email = req.body.email || user.email;
      if (req.body.password) {
        user.password = await bcrypt.hash(req.body.password, 10);
      }

      await user.save();
      return res.status(200).json({ message: 'User updated successfully', user });
    }
  } catch (error) {
    if (error.name === 'JsonWebTokenError' || error.name === 'TokenExpiredError') {
      return res.status(401).json({ message: 'Invalid or expired token' });
    }

    return res.status(500).json({ message: 'Something went wrong' });
  }
};

exports.forgotPassword = async (req, res) => {
  const { email } = req.body;

  try {
    const user = await User.findOne({ email });
    if (!user) {
      return res.status(404).json({ message: 'User not found' });
    }

    const resetToken = crypto.randomBytes(32).toString('hex');
    const hashedResetToken = await bcrypt.hash(resetToken, 10);
    const resetTokenExpiry = Date.now() + 3600000;

    user.resetToken = hashedResetToken;
    user.resetTokenExpiry = resetTokenExpiry;
    await user.save();

    const resetUrl = `http://localhost:3000/reset?resetToken=${resetToken}`;
    const message = `
      <h1>Password Reset</h1>
      <p>Click the link below to reset your password</p>
      <a href="${resetUrl}">Reset Password</a>
    `;
    await sendEmail({
      to: user.email,
      subject: 'Password Reset',
      text: message
    });

    res.status(200).json({ message: 'Password reset email sent' });
  } catch (error) {
    return res.status(500).json({ message: error.message });
  }
};

exports.resetPassword = async (req, res) => {
  const { resetToken, newPassword, confirmNewPassword } = req.body;

  if (newPassword !== confirmNewPassword) {
    return res.status(400).json({ message: 'Passwords do not match' });
  }

  try {
    const user = await User.findOne({
      resetToken,
      resetTokenExpiry: { $gt: Date.now() }
    });

    if (!user) {
      return res.status(400).json({ message: 'Invalid or expired password reset token' });
    }

    const hashedPassword = await bcrypt.hash(newPassword, 10);
    user.password = hashedPassword;
    user.resetToken = undefined;
    user.resetTokenExpiry = undefined;
    await user.save();

    res.status(200).json({ message: 'Password reset successfully' });
  } catch (error) {
    return res.status(500).json({ message: 'Something went wrong' });
  }
};


exports.deleteAccount = async (req, res) => {
  const token = req.headers.authorization.split(' ')[1];

  try {
    const decodedToken = jwt.verify(token, process.env.JWT_SECRET);
    const userId = decodedToken.id;

    const user = await User.findByIdAndDelete(userId);
    if (!user) {
      return res.status(404).json({ message: 'User not found' });
    }

    return res.status(200).json({ message: 'User deleted successfully' });
  } catch (error) {
    return res.status(500).json({ message: 'Something went wrong' });
  }
};


exports.logout = async (req, res) => {
  try {
    res.status(200).json({ message: 'Logout successful' });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};
