const mongoose = require('mongoose');
const initController = require('./initController');


const registerControllers = async () => {
  try {
    const collections = await mongoose.connection.db.listCollections().toArray();
    const controllers = {};
    collections.forEach(({ name }) => {
      controllers[name] = initController(name);
    });
    return controllers;
  } catch (error) {
    throw new Error('Failed to register controllers');
  }
};


module.exports = registerControllers;
