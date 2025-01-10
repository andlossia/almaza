
const singleRead = {
  readItem: (Model, modelName) => async (req, res) => {
    try {
      const item = await Model.findById(req.params._id);

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
  },

  readItemBySlug: (Model, modelName) => async (req, res) => {
    try {
      const item = await Model.findOne({ slug: req.params.slug });


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
  },

  readItemByField: (Model, modelName, allowedKeys = []) => async (req, res) => {
    const { key, value } = req.params;
    const { single, sort, limit } = req.query;
  
    if (allowedKeys.length > 0 && !allowedKeys.includes(key)) {
      return res.status(400).json({
        message: `Invalid field '${key}'. Allowed fields: ${allowedKeys.join(', ')}`,
      });
    }
  
    try {
      let items;
  
      if (sort === 'rand') {
        const pipeline = [
          { $match: { [key]: value } },
          { $sample: { size: Number(limit) || 1 } },
        ];
        items = await Model.aggregate(pipeline);
      } else {
        let query = Model.find({ [key]: value });
  
        if (sort) {
          query = query.sort(sort);
        }
  
        if (limit) {
          query = query.limit(Number(limit));
        }
  
        if (single) {
          query = query.limit(1);
        }
  
        items = await query.exec();
      }
  
      if (!items || items.length === 0) {
        return res.status(404).json({ message: `${modelName} not found` });
      }
  
      res.status(200).json(single ? items[0] : items);
    } catch (error) {
      res.status(500).json({
        message: `Error fetching ${modelName}`,
        error: error.message,
      });
    }
  },  

  readFieldById: (Model, modelName) => async (req, res) => {
    const { _id, field } = req.params;
  
    try {
      if (!Object.keys(Model.schema.paths).includes(field)) {
        return res.status(400).json({ message: `Field '${field}' not found in ${modelName}` });
      }
  
      const item = await Model.findById(_id).select(`${field} _id`);
  
      if (!item) {
        return res.status(404).json({ message: `${modelName} not found` });
      }
  
      res.status(200).json({
     
        [field]: item[field],
      });
    } catch (error) {
      res.status(500).json({
        message: `Error fetching ${modelName}`,
        error: error.message,
      });
    }
  },  
 
};

module.exports = singleRead;
