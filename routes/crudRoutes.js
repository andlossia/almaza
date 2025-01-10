const express = require('express');
const mongoose = require('mongoose');

const createCrudRoutes = (controller) => {
  const router = express.Router();

  router.get('/', controller.getItems);
  router.get('/:_id', controller.getItem);
  router.get('/:key/:value', async (req, res, next) => {
    const { key } = req.params;

    if (mongoose.Types.ObjectId.isValid(key)) {
      req.params._id = key;
      req.params.field = req.params.value;
      return controller.getFieldById(req, res, next);
    } else if (mongoose.Types.ObjectId.isValid(req.params.slug)) {
      req.params._id = req.params.slug;
      return controller.getItem(req, res, next);
      
    }

    return controller.getItemByField(req, res, next);
  });
  router.post('/',  controller.createItem);
  router.post('/bulk', controller.createManyItems);
  router.put('/:id', controller.updateItem);
  router.put('/bulk', controller.updateManyItems);
  router.patch('/:_id', controller.updateItem);
  router.patch('/bulk', controller.updateManyItems);
  router.delete('/:id', controller.deleteItem);
  router.delete('/bulk', controller.deleteManyItems);

  return router;
};

module.exports = createCrudRoutes;