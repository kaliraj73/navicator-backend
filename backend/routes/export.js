const express = require('express');

const router = express.Router();

router.get('/json', (_req, res) => {
  res.json({ exportedAt: new Date().toISOString(), format: 'json' });
});

router.get('/zip', (_req, res) => {
  res.json({ exportedAt: new Date().toISOString(), format: 'zip' });
});

router.post('/import', (req, res) => {
  res.json({ imported: true, payloadSize: JSON.stringify(req.body || {}).length });
});

module.exports = router;
