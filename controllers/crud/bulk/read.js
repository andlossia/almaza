const readItems = (Model, modelName, options = {}) => async (req, res) => {
  const {
    page = 1,
    limit = 24,
    offset = 0,
    keyword,
    sortField,
    distinctField,
    groupByField,
    sortOrder = 'asc',
    language,
    random = false,
    ...filters
  } = req.query;

  try {
    // Retrieve schema fields from the model
    const schemaFields = Object.keys(Model.schema.paths);

    // Default and customizable options
    const {
      searchableFields = schemaFields.filter(field => !['_id', '__v'].includes(field)),
      sortableFields = schemaFields.filter(field => !['_id', '__v'].includes(field)),
      excludedFields = [],
      maxKeywordLength = 100,
    } = options;

    // Filter valid searchable and sortable fields
    const validSearchableFields = searchableFields.filter(field => !excludedFields.includes(field));
    const validSortableFields = sortableFields.filter(field => !excludedFields.includes(field));

    // Build the query and sorting objects
    const query = buildFilters(filters, validSearchableFields, schemaFields, keyword, language, maxKeywordLength, Model);
    const sort = random
      ? null
      : buildSort(sortField, sortOrder, validSortableFields, Model.schema);

    // Calculate the skip value for pagination
    const skip = offset + (page - 1) * limit;

    // Handle distinct, group-by, and random sorting cases
    let itemsQuery;
    if (distinctField && schemaFields.includes(distinctField)) {
      itemsQuery = Model.distinct(distinctField, query);
    } else if (groupByField && schemaFields.includes(groupByField)) {
      itemsQuery = Model.aggregate([
        { $match: query },
        { $group: { _id: `$${groupByField}`, items: { $push: '$$ROOT' } } },
      ]);
    } else if (random) {
      itemsQuery = Model.aggregate([{ $match: query }, { $sample: { size: Number(limit) } }]);
    } else {
      itemsQuery = Model.find(query).sort(sort).skip(skip).limit(Number(limit));
    }

    // Execute the queries in parallel
    const [items, total] = await Promise.all([
      itemsQuery,
      Model.countDocuments(query),
    ]);

    // Send a successful response
    res.status(200).json({
      items,
      total: distinctField || groupByField ? items.length : total,
      page: Number(page),
      limit: Number(limit),
      offset: Number(offset),
    });
  } catch (error) {
    res.status(500).json({ message: `Error fetching ${modelName}s`, error: error.message });
  }
};

// Helper function to build the query object
const buildFilters = (filters, validSearchableFields, schemaFields, keyword, language, maxKeywordLength, Model) => {
  const query = {};

  if (keyword && keyword.length <= maxKeywordLength) {
    query.$or = validSearchableFields
      .filter(field => Model.schema.paths[field]?.instance === 'String')
      .map(field => {
        const localizedField = `${field}.${language}`;
        return schemaFields.includes(localizedField)
          ? { [localizedField]: { $regex: keyword, $options: 'i' } }
          : { [field]: { $regex: keyword, $options: 'i' } };
      });
  } else if (keyword && keyword.length > maxKeywordLength) {
    throw new Error(`Keyword too long. Maximum length is ${maxKeywordLength} characters.`);
  }

  Object.entries(filters).forEach(([key, value]) => {
    if (key.startsWith('min') || key.startsWith('max')) {
      const field = key.slice(3).charAt(0).toLowerCase() + key.slice(4);
      const operator = key.startsWith('min') ? '$gte' : '$lte';
      if (schemaFields.includes(field)) {
        const fieldType = Model.schema.paths[field]?.instance;
        query[field] = query[field] || {};

        if (['Date', 'Number', 'Decimal128', 'Int32', 'Int64', 'Timestamp', 'Double'].includes(fieldType)) {
          query[field][operator] = fieldType === 'Date' ? new Date(value) : Number(value);
        }
      }
    } else if (key.startsWith('more') || key.startsWith('less')) {
      const field = key.slice(4).charAt(0).toLowerCase() + key.slice(5);
      if (schemaFields.includes(field)) {
        const operator = key.startsWith('more') ? '$size' : '$lt';
        query[field] = { [operator]: Number(value) };
      }
    } else if (schemaFields.includes(key)) {
      const fieldType = Model.schema.paths[key]?.instance;
      if (fieldType === 'Boolean') {
        query[key] = value === 'true';
      } else if (fieldType === 'String') {
        query[key] = { $regex: value, $options: 'i' };
      } else if (['Null', 'Undefined'].includes(fieldType)) {
        query[key] = { $not: { $exists: true } };
      } else {
        query[key] = value;
      }
    } else if (key.startsWith('contains')) {
      const field = key.slice(8).charAt(0).toLowerCase() + key.slice(9);
      if (schemaFields.includes(field)) {
        const fieldType = Model.schema.paths[field]?.instance;
        if (['Code', 'RegExp', 'Binary', 'Symbol'].includes(fieldType)) {
          query[field] = { $regex: value, $options: 'i' };
        }
      }
    }
  });

  return query;
};


// Helper function to build the sort object
const buildSort = (sortField, sortOrder, validSortableFields, schema) => {
  const sort = {};
  if (sortField && validSortableFields.includes(sortField)) {
    sort[sortField] = sortOrder === 'asc' ? 1 : -1;
  }
  return sort;
};

module.exports = readItems;
