// routes/projects.routes.js
'use strict';

const express    = require('express');
const router     = express.Router();
const controller = require('../controllers/projectController');
const { requireAuth } = require('../middleware/auth');
const { verifyCsrf }  = require('../middleware/csrf');
const { validate }    = require('../middleware/validate');

// All routes here are under /api/admin/projects — protected
router.use(requireAuth, verifyCsrf);

router.get('/',                              controller.listAll);
router.get('/:id',                           controller.getById);
router.post('/',         validate('project'), controller.create);
router.put('/:id',       validate('project'), controller.update);
router.delete('/:id',                        controller.delete);
router.post('/:id/publish',                  controller.publish);
router.post('/:id/unpublish',                controller.unpublish);
router.delete('/:projectId/images/:imageId', controller.deleteImage);

module.exports = router;
