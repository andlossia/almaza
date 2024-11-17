const readItems = (Model, modelName) => async (req, res) => {
  const { page = 1, limit = 24, keyword, ...filters } = req.query;

  try {
    const query = {};

    if (keyword) {
      query.$or = [
        { title: { $regex: keyword, $options: 'i' } },
        { content: { $regex: keyword, $options: 'i' } },
        { name: { $regex: keyword, $options: 'i' } },
        { fileName: { $regex: keyword, $options: 'i' } },
      ];
    }

    Object.entries(filters).forEach(([key, value]) => {
      if (key.startsWith('min') || key.startsWith('max')) {
        const field = key.slice(3).charAt(0).toLowerCase() + key.slice(4);
        const operator = key.startsWith('min') ? '$gte' : '$lte';

        if (!query[field]) query[field] = {};
        query[field][operator] = Number(value);
      } else {
        query[key] = value.includes(',')
          ? { $in: value.split(',').map(val => val.trim()) }
          : isNaN(value)
          ? { $regex: value, $options: 'i' }
          : Number(value);
      }
    });

    const itemsQuery = Model.find(query)
      .skip((page - 1) * limit)
      .limit(limit);


    const items = await itemsQuery;
    const total = await Model.countDocuments(query);

    res.status(200).json({ items, total, page, limit });
  } catch (error) {
    res.status(500).json({
      message: `Error fetching ${modelName}s`,
      error: error.message,
    });
  }
};

module.exports = readItems;
