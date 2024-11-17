
const readItem = (Model, modelName) => async (req, res) => {
    try {
      let itemQuery = Model.findById(req.params._id);
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
  };

  const readItemBySlug = (Model, modelName) => async (req, res) => {
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
  };
  
  const readItemByField = (Model, modelName) => async (req, res) => {
    const { key, value } = req.params; // Extracting key and value from params
    try {
      const item = await Model.findOne({ [key]: value });
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
  };
  
  module.exports = {
    readItem,
    readItemBySlug,
    readItemByField,
  };
  