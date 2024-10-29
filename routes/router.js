const express = require('express');
const createCrudRoutes = require('./crudRoutes');
const router = express.Router();

const authRoutes = require('./authRoute');
const mediaController = require('../controllers/mediaController');
const userController = require('../controllers/userController');
const appointmentController = require('../controllers/appointmentController');
const lectureController = require('../controllers/lectureController');

router.use('/', authRoutes);
router.use('/media', createCrudRoutes(mediaController));
router.use('/users', createCrudRoutes(userController));
router.use('/appointments', createCrudRoutes(appointmentController));
router.use('/lectures', createCrudRoutes(lectureController));
router.post('/send-appointment', appointmentController.sendAppointment);

module.exports = router;
