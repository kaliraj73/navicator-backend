const express = require('express');

const router = express.Router();

router.post('/terminal', (req, res) => {
  res.json({ output: `received command: ${req.body?.command || ''}` });
});

router.post('/code', (req, res) => {
  res.json({ output: 'code runner scaffold', language: req.body?.language || 'unknown' });
});

module.exports = router;
