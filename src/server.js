require('dotenv').config();
const express = require('express');
const http = require('http');
const WebSocket = require('ws');
const cors = require('cors');
const pty = require('node-pty');
const { v4: uuidv4 } = require('uuid');
const fs = require('fs').promises;
const path = require('path');
const os = require('os');

const app = express();
const server = http.createServer(app);
const PORT = process.env.PORT || 8080;
const WS_PORT = process.env.WS_PORT || 8081;
const WORKSPACE_DIR = path.resolve(process.env.WORKSPACE_DIR || './workspace');

app.use(cors());
app.use(express.json());

const terminals = new Map();
const shell = os.platform() === 'win32' ? 'powershell.exe' : 'bash';

// Health check
app.get('/health', (req, res) => {
  res.json({
    status: 'ok',
    timestamp: new Date().toISOString(),
    terminals: terminals.size,
  });
});

// File operations
app.get('/api/files/tree', async (req, res) => {
  try {
    const tree = await getFileTree(WORKSPACE_DIR);
    res.json({ tree });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

app.get('/api/files/read', async (req, res) => {
  try {
    const filePath = path.join(WORKSPACE_DIR, req.query.path);
    const content = await fs.readFile(filePath, 'utf-8');
    res.json({ path: req.query.path, content });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

app.post('/api/files/write', async (req, res) => {
  try {
    const filePath = path.join(WORKSPACE_DIR, req.body.path);
    await fs.mkdir(path.dirname(filePath), { recursive: true });
    await fs.writeFile(filePath, req.body.content);
    res.json({ success: true });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

async function getFileTree(dir, depth = 0) {
  if (depth > 3) return null;
  const items = await fs.readdir(dir, { withFileTypes: true });
  return Promise.all(
    items.map(async (item) => {
      const fullPath = path.join(dir, item.name);
      if (item.isDirectory()) {
        return {
          name: item.name,
          type: 'directory',
          children: await getFileTree(fullPath, depth + 1),
        };
      }
      return { name: item.name, type: 'file' };
    }),
  );
}

// WebSocket Terminal
const wss = new WebSocket.Server({ port: WS_PORT });

wss.on('connection', (ws) => {
  console.log('Terminal connected');
  let terminal = null;

  ws.on('message', (message) => {
    const data = JSON.parse(message);

    if (data.type === 'create') {
      const sessionId = uuidv4();
      terminal = pty.spawn(shell, [], {
        name: 'xterm-color',
        cwd: WORKSPACE_DIR,
        env: process.env,
      });

      terminals.set(sessionId, terminal);

      terminal.onData((output) => {
        ws.send(JSON.stringify({ type: 'output', data: output, sessionId }));
      });

      ws.send(JSON.stringify({ type: 'created', sessionId }));
    } else if (data.type === 'input' && terminal) {
      terminal.write(data.data);
    }
  });

  ws.on('close', () => {
    if (terminal) terminal.kill();
  });
});

// Start servers
server.listen(PORT, () => {
  console.log(`✅ API Server: http://localhost:${PORT}`);
  console.log(`✅ WebSocket: ws://localhost:${WS_PORT}`);
  console.log(`📂 Workspace: ${WORKSPACE_DIR}`);
});
