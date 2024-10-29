const express = require('express');

const createCrudRoutes = (controller) => {
  const router = express.Router();

  router.get('/', controller.getItems);
  router.get('/:_id', controller.getItem);
  router.get('/slug/:slug', controller.getItemBySlug);
  router.post('/',  controller.createItem);
  router.post('/bulk', controller.createManyItems);
  router.put('/:id', controller.updateItem);
  router.put('/bulk', controller.updateManyItems);
  router.patch('/:_id', controller.updateItem);
  router.patch('/bulk', controller.updateManyItems);
  router.delete('/:_id', controller.deleteItem);
  router.delete('/bulk', controller.deleteManyItems);

  return router;
};

module.exports = createCrudRoutes;