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

const PORT = Number(process.env.PORT) || 8080;
const WS_PORT = Number(process.env.WS_PORT) || 8081;
const WORKSPACE_DIR = path.resolve(process.env.WORKSPACE_DIR || './workspace');
const MAX_TERMINALS = Number(process.env.MAX_TERMINALS) || 5;
const TERMINAL_TIMEOUT = Number(process.env.TERMINAL_TIMEOUT) || 1800000;

app.use(cors());
app.use(express.json());

const terminals = new Map();
const terminalTimers = new Map();
const shell = os.platform() === 'win32' ? 'powershell.exe' : 'bash';

function resolveWorkspacePath(relativePath = '') {
  const resolvedPath = path.resolve(WORKSPACE_DIR, relativePath);
  const workspacePrefix = `${WORKSPACE_DIR}${path.sep}`;
  if (resolvedPath !== WORKSPACE_DIR && !resolvedPath.startsWith(workspacePrefix)) {
    throw new Error('Path escapes workspace directory');
  }
  return resolvedPath;
}

function resetTerminalTimeout(sessionId, terminal) {
  const existingTimer = terminalTimers.get(sessionId);
  if (existingTimer) clearTimeout(existingTimer);

  const timeoutId = setTimeout(() => {
    terminal.kill();
    terminals.delete(sessionId);
    terminalTimers.delete(sessionId);
  }, TERMINAL_TIMEOUT);

  terminalTimers.set(sessionId, timeoutId);
}

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
    const filePath = resolveWorkspacePath(req.query.path);
    const content = await fs.readFile(filePath, 'utf-8');
    res.json({ path: req.query.path, content });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

app.post('/api/files/write', async (req, res) => {
  try {
    const filePath = resolveWorkspacePath(req.body.path);
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
  let sessionId = null;
  let terminal = null;

  ws.on('message', (message) => {
    let data;
    try {
      data = JSON.parse(message);
    } catch (error) {
      ws.send(JSON.stringify({ type: 'error', error: 'Invalid JSON payload' }));
      return;
    }

    if (data.type === 'create') {
      if (terminals.size >= MAX_TERMINALS) {
        ws.send(JSON.stringify({ type: 'error', error: 'Maximum number of terminals reached' }));
        return;
      }

      sessionId = uuidv4();
      terminal = pty.spawn(shell, [], {
        name: 'xterm-color',
        cwd: WORKSPACE_DIR,
        env: process.env,
      });

      terminals.set(sessionId, terminal);
      resetTerminalTimeout(sessionId, terminal);

      terminal.onData((output) => {
        ws.send(JSON.stringify({ type: 'output', data: output, sessionId }));
      });

      terminal.onExit(() => {
        terminals.delete(sessionId);
        const timeoutId = terminalTimers.get(sessionId);
        if (timeoutId) clearTimeout(timeoutId);
        terminalTimers.delete(sessionId);
      });

      ws.send(JSON.stringify({ type: 'created', sessionId }));
    } else if (data.type === 'input' && terminal) {
      terminal.write(data.data);
      resetTerminalTimeout(sessionId, terminal);
    }
  });

  ws.on('close', () => {
    if (terminal) {
      terminal.kill();
    }
  });
});

async function ensureWorkspaceDir() {
  await fs.mkdir(WORKSPACE_DIR, { recursive: true });
}

ensureWorkspaceDir()
  .then(() => {
    // Start servers
    server.listen(PORT, () => {
      console.log(`✅ API Server: http://localhost:${PORT}`);
      console.log(`✅ WebSocket: ws://localhost:${WS_PORT}`);
      console.log(`📂 Workspace: ${WORKSPACE_DIR}`);
      console.log(`🖥️ Max terminals: ${MAX_TERMINALS}`);
      console.log(`⏱️ Terminal timeout: ${TERMINAL_TIMEOUT}ms`);
    });
  })
  .catch((error) => {
    console.error('Failed to initialize workspace directory:', error);
    process.exit(1);
  });
