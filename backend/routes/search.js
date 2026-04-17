const express = require('express');

const router = express.Router();

router.post('/', (req, res) => {
  const { query = '' } = req.body || {};
  res.json({ query, results: [] });
});

router.post('/replace', (req, res) => {
  const { find = '', replace = '' } = req.body || {};
  res.json({ find, replace, changedFiles: 0 });
});

module.exports = router;
