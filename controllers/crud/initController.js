const { validationResult } = require('express-validator');
const { dynamicUpload } = require('../../middlewares/uploadFilesMiddleware');
const { authenticate, authorizeOwnerOrRole } = require('../../middlewares/authenticationMiddleware');

const singleRead = require('../crud/single/read');
const readBulk = require('../crud/bulk/read');

const initController = (Model, modelName, customMethods = [], uniqueFields = []) => {

  const validateRequest = (validations) => {
    return async (req, res, next) => {
      try {
        await Promise.all(validations.map((validation) => validation.run(req)));

        const errors = validationResult(req);
        if (!errors.isEmpty()) {
          return res.status(400).json({ errors: errors.array() });
        }
  
        if (req.body) {
          for (const [key, value] of Object.entries(req.body)) {
            if (value instanceof Map) {
              for (const [mapKey, mapValue] of value.entries()) {
                if (typeof mapKey !== 'string' || !mapKey.trim()) {
                  return res.status(400).json({
                    errors: [{ message: `Invalid key "${mapKey}" in "${key}": Must be a non-empty string.` }],
                  });
                }
                if (typeof mapValue !== 'string' || !mapValue.trim()) {
                  return res.status(400).json({
                    errors: [{ message: `Invalid value for key "${mapKey}" in "${key}": Must be a non-empty string.` }],
                  });
                }
              }
            }
          }
        }
        next();
      } catch (error) {
        res.status(500).json({ message: 'Validation error', error: error.message });
      }
    };
  };
  

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

  const createOrUpdateLinkedObjects = async (linkedObjects, Model) => {
    const result = {};

    for (const [key, value] of Object.entries(linkedObjects)) {
      if (Array.isArray(value)) {
        result[key] = await Promise.all(value.map(async (item) => {
          if (item) {
            if (item._id) {
              return item._id;
            } else {
              const existingItem = await Model.findOne({ fileName: item.fileName });
              if (existingItem) {
                return existingItem._id;
              } else {
                const newItem = new Model(item);
                await newItem.save();
                return newItem._id;
              }
            }
          }
          return '';
        }));
      } else {
        if (value) {
          if (value._id) {
            result[key] = value._id;
          } else {
            const existingItem = await Model.findOne({ fileName: value.fileName });
            if (existingItem) {
              result[key] = existingItem._id;
            } else {
              const newItem = new Model(value);
              await newItem.save();
              result[key] = newItem._id;
            }
          }
        } else {
          result[key] = '';
        }
      }
    }

    return result;
  };

  
  return {
    createItem: [
      authenticate,
      validateRequest([]),
      dynamicUpload,
      checkUniqueFields(uniqueFields, Model, modelName),
      async (req, res) => {
        try {
          const owner = req.user ? req.user.id : null;
          const linkedObjects = {};
          for (const [key, value] of Object.entries(req.body)) {
            if (key.startsWith('linkedObject_')) {
              linkedObjects[key] = value;
            }
          }

          const linkedObjectIds = await createOrUpdateLinkedObjects(linkedObjects, Model);
          const itemData = { ...req.body, ...linkedObjectIds, owner };

          if (req.media) { 
            itemData.media = req.media._id;
          }

          const item = await Model.create(itemData);

          res.status(201).json({
            message: `${modelName} created successfully`,
            data: item.toJSON(),
          });
        } catch (error) {
          res.status(500).json({
            message: `Error creating ${modelName}`,
            error: error.message,
          });
        }
      }
    ],

    createManyItems: [
      authenticate,
      dynamicUpload,
      validateRequest([]),
      checkUniqueFields(uniqueFields, Model, modelName),
      async (req, res) => {
        const owner = req.user ? req.user.id : null;
    
        try {
          const items = [];
          for (const itemData of req.body.items) {
            const linkedObjects = {};
            for (const [key, value] of Object.entries(itemData)) {
              if (key.startsWith('linkedObject_')) {
                linkedObjects[key] = value;
              }
            }
    
            const linkedObjectIds = await createOrUpdateLinkedObjects(linkedObjects, Model);
            const finalItemData = { ...itemData, ...linkedObjectIds, owner };
    
            if (req.media) {
              finalItemData.media = req.media._id;
            }
    
            const item = await Model.create(finalItemData);
            items.push(item);
          }
    
          res.status(201).json({
            message: `${modelName}s created successfully`,
            data: items.map(item => item.toJSON()),
          });
        } catch (error) {
          res.status(500).json({
            message: `Error creating ${modelName}s`,
            error: error.message,
          });
        }
      }
    ],
    
    getItems: readBulk(Model, modelName),
    getItem: singleRead.readItem(Model, modelName),
    getItemBySlug: singleRead.readItemBySlug(Model, modelName),
    getItemByField: singleRead.readItemByField(Model, modelName),
    getFieldById: singleRead.readFieldById(Model, modelName),

    

    updateItem: [
      authenticate,
      dynamicUpload,
      validateRequest([]),
      checkUniqueFields(uniqueFields, Model, modelName, true),
      async (req, res) => {
        try {
          const linkedObjects = Object.fromEntries(
            Object.entries(req.body).filter(([key]) => key.startsWith('linkedObject_'))
          );

          const linkedObjectIds = await createOrUpdateLinkedObjects(linkedObjects, Model);
          const updateData = { ...req.body, ...linkedObjectIds };

          if (req.media) {
            updateData.media = req.media._id;
          }

          const updatedItem = await Model.findByIdAndUpdate(req.params.id, updateData, { new: true });

          if (!updatedItem) {
            return res.status(404).json({ message: `${modelName} not found` });
          }

          res.status(200).json({
            message: `${modelName} updated successfully`,
            data: updatedItem.toJSON(),
          });
        } catch (error) {
          res.status(500).json({
            message: `Error updating ${modelName}`,
            error: error.message,
          });
        }
      }
    ],
    
    updateManyItems: [
      authenticate,
      authorizeOwnerOrRole(Model, modelName),
            async (req, res) => {
        try {
          const updatedCount = await Model.updateMany({ _id: { $in: req.body.ids } }, req.body.data);
          res.status(200).json({
            message: `${updatedCount} ${modelName} updated successfully`,
          });
        } catch (error) {
          res.status(500).json({
            message: `Error updating ${modelName}s`,
            error: error.message,
          });
        }
      }
    ],
    
    deleteItem: [
      authenticate,
      authorizeOwnerOrRole(Model, modelName),
      async (req, res) => {
        try {
          const item = await Model.findByIdAndDelete(req.params.id);
          if (!item) {
            return res.status(404).json({ message: `${modelName} not found` });
          }
          res.status(200).json({
            message: `${modelName} deleted successfully`,
          });
        } catch (error) {
          res.status(500).json({
            message: `Error deleting ${modelName}`,
            error: error.message,
          });
        }
      }
    ],


    deleteManyItems: [
      authenticate,
      authorizeOwnerOrRole(Model, modelName),
      async (req, res) => {
        try {
          const deletedCount = await Model.deleteMany({ _id: { $in: req.body.ids } });
          res.status(200).json({
            message: `${deletedCount} ${modelName} deleted successfully`,
          });
        } catch (error) {
          res.status(500).json({
            message: `Error deleting ${modelName}s`,
            error: error.message,
          });
        }
      }
    ],
    ...customMethods,
  };
};

module.exports = initController;