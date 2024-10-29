const createOrUpdateLinkedObjects = require('./linkedObjects');

const prepareItemData = async (itemData, Model, owner, req) => {
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

  return finalItemData;
};

module.exports = {
  prepareItemData,
};
