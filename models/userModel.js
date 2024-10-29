const mongoose = require('mongoose');
const Schema = mongoose.Schema;
const bcrypt = require('bcrypt');
const Paragraph = require('./paragraphModel');

const applyToJSON = require('../middlewares/applyToJson');


const userSchema = new Schema({
  userName: { type: String, required: true },
  email: { type: String, required: true, unique: true, match: /.+\@.+\..+/ },
  roles: [{ type: String, enum: ['guest', 'user', 'admin'], default: 'user' }],
  password: { type: String, required: true },
  isAdmin: { type: Boolean, default: false },
  profilePicture: { type: Schema.Types.ObjectId, ref: 'Media' },
  bio: {
    by: { type: Schema.Types.ObjectId, ref: 'User' },
    section: {
      about: { type: String },
      description: { type: String },
      vision: { type: String },
    },
  },

  degrees: [{
    _id: { type: Schema.Types.ObjectId, auto: true }, 
    title: { type: String },
    institute: { type: String },
    year: { type: Number }
  }],
  awards: [{
   _id: { type: Schema.Types.ObjectId, auto: true }, 
    title: { type: String },
    description: { type: String },
    imageUrl: { type: String },
    link: { type: String }
  }],
  contactDetails: {
    phoneNumber: { type: String },
    socialMedia: {
      facebook: { type: String },
      twitter: { type: String },
      instagram: { type: String },
      linkedIn: { type: String },
      whatsapp: { type: String }
    },
  },


}, { timestamps: true });

const isDevelopment = process.env.NODE_ENV === 'development';

userSchema.pre('save', async function (next) {
  if (this.isAdmin && !isDevelopment) {
    return next(new Error('Creating admin users is not allowed in production mode'));
  }

  if (this.isModified('password')) {
    try {
      const salt = await bcrypt.genSalt(10);
      this.password = await bcrypt.hash(this.password, salt);
    } catch (error) {
      return next(error);
    }
  }

  next();
});

// Method for comparing passwords
userSchema.methods.comparePassword = async function (candidatePassword) {
  try {
    return await bcrypt.compare(candidatePassword, this.password);
  } catch (error) {
    throw new Error('Error comparing passwords');
  }
};

applyToJSON(userSchema);



module.exports = mongoose.model('User', userSchema);
