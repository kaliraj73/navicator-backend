const express = require('express');

const router = express.Router();

router.post('/init', (_req, res) => res.json({ ok: true, message: 'git initialized (stub)' }));
router.get('/status', (_req, res) => res.json({ clean: true, files: [] }));
router.post('/commit', (req, res) => res.json({ ok: true, message: req.body?.message || 'commit created (stub)' }));
router.get('/log', (_req, res) => res.json({ commits: [] }));

module.exports = router;
