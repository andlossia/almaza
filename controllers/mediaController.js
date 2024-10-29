const initController = require('./crud/initController');
const Media = require('../models/mediaModel');

const mediaController = initController(Media, 'Media', [], [], ['']);

module.exports = mediaController;
