const express = require('express');

const router = express.Router();

router.get('/', (_req, res) => {
  res.json({ providers: ['openrouter', 'ollama'], models: ['llama3', 'mistral', 'qwen'] });
});

module.exports = router;
