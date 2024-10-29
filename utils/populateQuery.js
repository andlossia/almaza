
const populateQuery = (query, populateFields = [], nestedPopulateFields = []) => {
  if (populateFields.length > 0) {
    populateFields.forEach((field, index) => {
      const populateOptions = {
        path: field,
        select: '-__v', // Exclude unneeded fields
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

module.exports = populateQuery;
