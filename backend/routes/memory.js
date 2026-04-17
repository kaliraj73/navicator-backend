const express = require('express');
const memoryService = require('../services/memoryService');

const router = express.Router();

router.get('/:projectId', (req, res) => {
  res.json(memoryService.get(req.params.projectId));
});

router.post('/:projectId', (req, res) => {
  const updated = memoryService.update(req.params.projectId, req.body || {});
  res.json(updated);
});

module.exports = router;
