const express = require('express');
const jwt = require('jsonwebtoken');

const router = express.Router();

function signToken(payload) {
  return jwt.sign(payload, process.env.JWT_SECRET || 'dev-secret', { expiresIn: '7d' });
}

router.post('/register', (req, res) => {
  const { username = 'user' } = req.body || {};
  return res.json({ token: signToken({ sub: username, type: 'registered' }) });
});

router.post('/login', (req, res) => {
  const { username = 'user' } = req.body || {};
  return res.json({ token: signToken({ sub: username, type: 'login' }) });
});

router.post('/guest', (_req, res) => res.json({ token: signToken({ sub: 'guest', type: 'guest' }) }));

module.exports = router;
