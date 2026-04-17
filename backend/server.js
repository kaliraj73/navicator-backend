const express = require('express');
const cors = require('cors');
const dotenv = require('dotenv');
const http = require('http');
const { WebSocketServer } = require('ws');

dotenv.config({ path: '.env' });

const app = express();
const server = http.createServer(app);
const wss = new WebSocketServer({ server, path: '/ws' });

app.use(cors());
app.use(express.json({ limit: '2mb' }));

app.get('/health', (_req, res) => res.json({ ok: true }));

app.use('/auth', require('./routes/auth'));
app.use('/projects', require('./routes/projects'));
app.use('/files', require('./routes/files'));
app.use('/chat', require('./routes/chat'));
app.use('/run', require('./routes/run'));
app.use('/models', require('./routes/models'));
app.use('/memory', require('./routes/memory'));
app.use('/search', require('./routes/search'));
app.use('/snippets', require('./routes/snippets'));
app.use('/git', require('./routes/git'));
app.use('/export', require('./routes/export'));

require('./services/wsService')(wss);

const port = Number(process.env.PORT || 3000);
server.listen(port, () => {
  console.log(`Navicator backend listening on :${port}`);
});
