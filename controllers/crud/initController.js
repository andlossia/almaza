const { validationResult } = require('express-validator');
const { dynamicUpload } = require('../../middlewares/uploadFilesMiddleware');
const { authenticate, authorizeOwnerOrRole } = require('../../middlewares/authenticationMiddleware');

const initController = (Model, modelName, customMethods = [], uniqueFields = [], populateFields = [], nestedPopulateFields = []) => {

  const validateRequest = (validations) => {
    return async (req, res, next) => {
      await Promise.all(validations.map(validation => validation.run(req)));
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        return res.status(400).json({ errors: errors.array() });
      }
      next();
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

  const populateQuery = (query, linkedObjectFields = [], nestedPopulateFields = []) => {
    if (linkedObjectFields.length > 0) {
      linkedObjectFields.forEach((field, index) => {
        const populateOptions = {
          path: field,
          select: '-createdAt -updatedAt -password -__v -_id -owner -count',
        };
  
        if (nestedPopulateFields[index]) {
          populateOptions.populate = {
            path: nestedPopulateFields[index],
            
         
          };
        }
  
        query = query.populate(populateOptions);
      });
    }
  
    return query;
  };
  
  return {
    createItem: [
      authenticate,
      dynamicUpload,
      validateRequest([]),
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

          if (req.media) { itemData.media = req.media._id }

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
    
    getItems: [
      async (req, res) => {
        const { page = 1, limit = 10, ...filters } = req.query;
    
        try {
          const query = {};
    
          const specialFieldHandlers = {
            _id: (value) => ({ _id: value }),
            keyword: (value) => ({
              $or: [
                { title: { $regex: value, $options: 'i' } },
                { content: { $regex: value, $options: 'i' } },
                { name: { $regex: value, $options: 'i' } },
                { fileName: { $regex: value, $options: 'i' } }
              ]
            })
          };
    
          const rangeMappings = {
            minPrice: { field: 'price', operator: '$gte' },
            maxPrice: { field: 'price', operator: '$lte' },
            minSqft: { field: 'sqft', operator: '$gte' },
            maxSqft: { field: 'sqft', operator: '$lte' },
            minYearBuilt: { field: 'yearBuilt', operator: '$gte' },
            maxYearBuilt: { field: 'yearBuilt', operator: '$lte' },
            minBedrooms: { field: 'bedrooms', operator: '$gte' },
            maxBedrooms: { field: 'bedrooms', operator: '$lte' },
            minBathrooms: { field: 'bathrooms', operator: '$gte' },
            maxBathrooms: { field: 'bathrooms', operator: '$lte' },
            minGarage: { field: 'garage', operator: '$gte' },
            maxGarage: { field: 'garage', operator: '$lte' }
          };
    
          const processFilterValue = (value) => {
            if (value.includes(',')) {
              return { $in: value.split(',').map(val => val.trim()) };
            } else if (!isNaN(value)) {
              return Number(value);
            } else {
              return { $regex: value, $options: 'i' };
            }
          };
    
          await Promise.all(Object.entries(filters).map(async ([key, value]) => {
            if (specialFieldHandlers[key]) {
              const processedValue = await specialFieldHandlers[key](value);
              if (processedValue !== null) {
                query[key] = processedValue;
              }
            } else if (rangeMappings[key]) {
              const { field, operator } = rangeMappings[key];
              query[field] = { ...query[field], [operator]: Number(value) };
            } else {
              query[key] = processFilterValue(value);
            }
          }));
    
          let itemsQuery = Model.find(query)
            .skip((page - 1) * limit)
            .limit(Number(limit));
    
          itemsQuery = populateQuery(itemsQuery, populateFields, nestedPopulateFields);

          const items = await itemsQuery;
          const total = await Model.countDocuments(query);
  
          res.status(200).json({ items, total });
        } catch (error) {
          res.status(500).json({
            message: `Error fetching ${modelName}s`,
            error: error.message,
          });
        }
      }
    ],
    
    getItem: [
      async (req, res) => {
        try {
          let itemQuery = Model.findById(req.params._id);
          itemQuery = populateQuery(itemQuery, populateFields, nestedPopulateFields);
          const item = await itemQuery;
          if (!item) {
            return res.status(404).json({ message: `${modelName} not found` });
          }
          res.status(200).json(item);
        } catch (error) {
          res.status(500).json({
            message: `Error fetching ${modelName}`,
            error: error.message,
          });
        }
      }
    ],

    getItemBySlug: [
      async (req, res) => {
        try {
          let itemQuery = Model.findOne({ slug: req.params.slug });
          itemQuery = populateQuery(itemQuery, populateFields, nestedPopulateFields);
          const item = await itemQuery;
          if (!item) {
            return res.status(404).json({ message: `${modelName} not found` });
          }
          res.status(200).json(item);
        } catch (error) {
          res.status(500).json({
            message: `Error fetching ${modelName}`,
            error: error.message,
          });
        }
      }
    ],
    
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
          const item = await Model.findByIdAndDelete(req.params._id);
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