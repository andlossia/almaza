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
  
  module.exports = createOrUpdateLinkedObjects;
  