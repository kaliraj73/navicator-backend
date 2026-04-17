const express = require('express');
const db = require('../services/db');

const router = express.Router();

const templates = ['blank', 'node-api', 'react-app', 'python-cli'];

router.get('/templates', (_req, res) => res.json({ templates }));
router.get('/', (_req, res) => res.json(db.get('projects', [])));

router.post('/', (req, res) => {
  const project = { id: Date.now().toString(), ...req.body };
  db.push('projects', project);
  res.status(201).json(project);
});

module.exports = router;
