const initController = require('./initController');

const registerController = (Model, modelName, customMethods = []) => {
  return initController(Model, modelName, customMethods);
};

module.exports = registerController;
