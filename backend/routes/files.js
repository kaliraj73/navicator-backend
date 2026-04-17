const express = require('express');

const router = express.Router();

router.post('/detect-language', (req, res) => {
  const { filename = '' } = req.body || {};
  const ext = filename.split('.').pop();
  const map = { js: 'javascript', ts: 'typescript', py: 'python', md: 'markdown' };
  res.json({ language: map[ext] || 'plaintext' });
});

router.get('/', (_req, res) => res.json({ files: [] }));
router.post('/', (req, res) => res.status(201).json({ saved: true, ...req.body }));

module.exports = router;
