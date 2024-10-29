const checkUniqueFields = (uniqueFields, Model, modelName, isUpdate = false) => async (req, res, next) => {
    try {
      for (const field of uniqueFields) {
        if (req.body[field]) {
          const query = { [field]: req.body[field] };
          
          if (isUpdate && req.params._id) {
            query._id = { $ne: req.params._id };
          }
  
          const existingItem = await Model.findOne(query);
          if (existingItem) {
            return res.status(400).json({
              message: `${modelName} with this ${field} already exists`,
            });
          }
        }
      }
      next();
    } catch (error) {
      res.status(500).json({
        message: `Failed to check unique fields for ${modelName}`,
        error: error.message,
      });
    }
  };
  
  module.exports = checkUniqueFields;
  