const express = require('express');
const db = require('../services/db');

const router = express.Router();

router.get('/', (_req, res) => res.json(db.get('snippets', [])));
router.post('/', (req, res) => {
  const snippet = { id: Date.now().toString(), ...req.body };
  db.push('snippets', snippet);
  res.status(201).json(snippet);
});

module.exports = router;
