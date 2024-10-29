const initController = require('./crud/initController');
const sendAppointment = require('./crud/custom/sendMethods');
const Appointment = require('../models/appointmentModel');

const appointmentController = initController(Appointment, 'Appointment', { sendAppointment: sendAppointment(Appointment) }, [], []);

module.exports = {
  ...appointmentController,
  sendAppointment: sendAppointment(Appointment)[0], 
};
