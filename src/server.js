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
const MEMORY_FILE = path.resolve(process.env.MEMORY_FILE || './workspace/.navicator-memory.json');

const AI_AGENT_MODES = Object.freeze([
  'Auto',
  'Coder',
  'Planner',
  'Debugger',
  'Reviewer',
  'Explainer',
  'Chain',
]);

const FREE_OPENROUTER_MODELS = Object.freeze([
  { id: 'qwen/qwen3-32b', family: 'Qwen3', provider: 'OpenRouter', free: true },
  { id: 'qwen/qwen3-14b', family: 'Qwen3', provider: 'OpenRouter', free: true },
  { id: 'deepseek/deepseek-r1', family: 'DeepSeek R1', provider: 'OpenRouter', free: true },
  { id: 'deepseek/deepseek-chat-v3', family: 'DeepSeek V3', provider: 'OpenRouter', free: true },
  { id: 'google/gemma-3-27b-it', family: 'Gemma 3', provider: 'OpenRouter', free: true },
  { id: 'meta-llama/llama-4-scout', family: 'Llama 4', provider: 'OpenRouter', free: true },
  { id: 'meta-llama/llama-4-maverick', family: 'Llama 4', provider: 'OpenRouter', free: true },
  { id: 'mistralai/mistral-small-3', family: 'Mistral', provider: 'OpenRouter', free: true },
  { id: 'microsoft/phi-3-medium-128k-instruct', family: 'Phi-3', provider: 'OpenRouter', free: true },
]);

app.use(cors());
app.use(express.json({ limit: '1mb' }));

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

async function loadMemory() {
  try {
    const raw = await fs.readFile(MEMORY_FILE, 'utf-8');
    return JSON.parse(raw);
  } catch (error) {
    if (error.code === 'ENOENT') {
      return { contexts: {}, updatedAt: new Date().toISOString() };
    }
    throw error;
  }
}

async function saveMemory(payload) {
  const nextData = {
    ...payload,
    updatedAt: new Date().toISOString(),
  };
  await fs.mkdir(path.dirname(MEMORY_FILE), { recursive: true });
  await fs.writeFile(MEMORY_FILE, JSON.stringify(nextData, null, 2), 'utf-8');
  return nextData;
}

// Health check
app.get('/health', (req, res) => {
  res.json({
    status: 'ok',
    timestamp: new Date().toISOString(),
    terminals: terminals.size,
  });
});

// AI features
app.get('/api/ai/features', (req, res) => {
  res.json({
    agentModes: AI_AGENT_MODES,
    chainModeFlow: ['Plan', 'Code'],
    freeOpenRouterModels: FREE_OPENROUTER_MODELS,
    capabilities: {
      applyFilesOneClick: true,
      persistentProjectMemory: true,
    },
  });
});

app.get('/api/ai/memory', async (req, res) => {
  try {
    const memory = await loadMemory();
    res.json(memory);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

app.post('/api/ai/memory', async (req, res) => {
  try {
    const { projectId, context } = req.body;
    if (!projectId || typeof projectId !== 'string') {
      return res.status(400).json({ error: 'projectId is required' });
    }
    if (!context || typeof context !== 'object') {
      return res.status(400).json({ error: 'context object is required' });
    }

    const existing = await loadMemory();
    const merged = {
      ...existing,
      contexts: {
        ...existing.contexts,
        [projectId]: {
          ...(existing.contexts[projectId] || {}),
          ...context,
          savedAt: new Date().toISOString(),
        },
      },
    };

    const saved = await saveMemory(merged);
    return res.json({ success: true, memory: saved.contexts[projectId] });
  } catch (error) {
    return res.status(500).json({ error: error.message });
  }
});

app.post('/api/ai/mode', (req, res) => {
  const { mode } = req.body;
  if (!AI_AGENT_MODES.includes(mode)) {
    return res.status(400).json({
      error: `Unsupported mode. Choose one of: ${AI_AGENT_MODES.join(', ')}`,
    });
  }

  return res.json({
    selectedMode: mode,
    chainModeFlow: mode === 'Chain' ? ['Plan', 'Code'] : null,
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

async function ensureRequiredDirectories() {
  await fs.mkdir(WORKSPACE_DIR, { recursive: true });
  await fs.mkdir(path.dirname(MEMORY_FILE), { recursive: true });
}

ensureRequiredDirectories()
  .then(() => {
    // Start servers
    server.listen(PORT, () => {
      console.log(`✅ API Server: http://localhost:${PORT}`);
      console.log(`✅ WebSocket: ws://localhost:${WS_PORT}`);
      console.log(`📂 Workspace: ${WORKSPACE_DIR}`);
      console.log(`🖥️ Max terminals: ${MAX_TERMINALS}`);
      console.log(`⏱️ Terminal timeout: ${TERMINAL_TIMEOUT}ms`);
      console.log(`🧠 Memory file: ${MEMORY_FILE}`);
    });
  })
  .catch((error) => {
    console.error('Failed to initialize backend directories:', error);
    process.exit(1);
  });
