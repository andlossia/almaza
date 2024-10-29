const mongoose = require('mongoose');
const Schema = mongoose.Schema;
const Paragraph = require('./paragraphModel');

const applyToJSON = require('../middlewares/applyToJson');

const appointmentSchema = new Schema({
  name: { type: String, required: true }, 
  phone: { type: String, required: true },
  email: { type: String, required: true },
  appointmentDate: { type: Date, required: true }, 
  organization: { type: String }, 
  estimatedAttendees: { type: Number },
  message: { type: String }, 
  status: { type: String, enum: ['pending', 'accepted', 'rejected'], default: 'pending' },
}, {
  timestamps: true,
});

applyToJSON(appointmentSchema);

module.exports = mongoose.model('Appointment', appointmentSchema);
