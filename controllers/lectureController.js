
const initController = require('./crud/initController');
const Lecture = require('../models/lectureModel');


const lectureController = initController(Lecture, 'Lecture', [], [], []);

module.exports = lectureController