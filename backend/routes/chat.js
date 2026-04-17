const express = require('express');
const aiService = require('../services/aiService');

const router = express.Router();

router.post('/', async (req, res) => {
  const reply = await aiService.complete(req.body?.message || '');
  res.json({ reply });
});

router.get('/stream', (req, res) => {
  res.setHeader('Content-Type', 'text/event-stream');
  res.write(`data: ${JSON.stringify({ chunk: 'streaming not enabled in scaffold' })}\n\n`);
  res.end();
});

module.exports = router;
