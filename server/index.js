import express from 'express';
import { WebSocketServer } from 'ws';
import { createServer } from 'http';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';
import { v4 as uuid } from 'uuid';
import { execSync } from 'child_process';
import { readFileSync, writeFileSync, existsSync } from 'fs';
import os from 'os';

const __dirname = dirname(fileURLToPath(import.meta.url));
const PORT = process.env.PORT || 3100;
const isProduction = process.env.NODE_ENV === 'production';
const PERSIST_PATH = join(__dirname, '..', '.claude-hub-state.json');

// ── node-pty ─────────────────────────────────────────────────────

let pty;
try {
  pty = await import('node-pty');
} catch (e) {
  console.error('Failed to load node-pty:', e.message);
  process.exit(1);
}

// ── State ────────────────────────────────────────────────────────

const sessions = new Map();
let templates = [];

function loadState() {
  try {
    if (existsSync(PERSIST_PATH)) {
      const data = JSON.parse(readFileSync(PERSIST_PATH, 'utf8'));
      templates = data.templates || [];
      // We don't restore sessions (processes are gone), but we keep templates
      console.log(`Loaded ${templates.length} templates from disk`);
    }
  } catch (e) {
    console.warn('Failed to load state:', e.message);
  }
}

function saveState() {
  try {
    const data = {
      templates,
      savedAt: Date.now(),
    };
    writeFileSync(PERSIST_PATH, JSON.stringify(data, null, 2));
  } catch (e) {
    console.warn('Failed to save state:', e.message);
  }
}

loadState();

// ── Helpers ──────────────────────────────────────────────────────

function stripAnsi(str) {
  return str.replace(/\x1b\[[0-9;]*[a-zA-Z]/g, '').replace(/\x1b\][^\x07]*\x07/g, '');
}

function getGitInfo(cwd) {
  try {
    const branch = execSync('git branch --show-current', { cwd, encoding: 'utf8', timeout: 5000 }).trim();
    const statusOut = execSync('git status --porcelain', { cwd, encoding: 'utf8', timeout: 5000 }).trim();
    const changes = statusOut ? statusOut.split('\n').filter(Boolean).length : 0;
    const lastCommit = execSync('git log -1 --format="%h %s"', { cwd, encoding: 'utf8', timeout: 5000 }).trim();
    return { branch, changes, lastCommit };
  } catch {
    return null;
  }
}

// ── Approval Detection ───────────────────────────────────────────

function detectApproval(data) {
  const clean = stripAnsi(data);
  // Claude CLI patterns
  const patterns = [
    /(?:Allow|allow)\s+(\w+)(?:\s*(?::|on)\s*(.+?))?\s*\?/,
    /(?:Allow|allow)\s+(\w+).*?\(Y\/n\)/s,
    /Do you want to (?:allow|proceed).*?(\w+)/i,
  ];
  for (const p of patterns) {
    const m = clean.match(p);
    if (m) return { tool: m[1] || 'unknown', detail: (m[2] || '').trim().slice(0, 100) };
  }
  if (clean.includes('(Y/n)') || clean.includes('(y/N)')) {
    return { tool: 'unknown', detail: clean.slice(0, 100).trim() };
  }
  return null;
}

function matchesAutoApproveRule(rule, approval) {
  switch (rule.type) {
    case 'all': return true;
    case 'reads': return ['Read', 'Glob', 'Grep', 'Bash'].includes(approval.tool) ||
                         ['read', 'glob', 'grep', 'bash'].includes(approval.tool.toLowerCase());
    case 'writes': return ['Edit', 'Write', 'NotebookEdit'].includes(approval.tool);
    case 'tool': return approval.tool.toLowerCase() === (rule.tool || '').toLowerCase();
    case 'pattern': {
      try { return new RegExp(rule.pattern || '', 'i').test(approval.detail); }
      catch { return false; }
    }
    default: return false;
  }
}

// ── Cost Parsing ─────────────────────────────────────────────────

function parseCost(data) {
  const clean = stripAnsi(data);
  const updates = {};

  // Token patterns (various Claude CLI output formats)
  const inputMatch = clean.match(/(\d[\d,]*)\s*(?:input|prompt)\s*tokens?/i);
  const outputMatch = clean.match(/(\d[\d,]*)\s*(?:output|completion|response)\s*tokens?/i);
  const costMatch = clean.match(/\$(\d+\.?\d*)/);

  if (inputMatch) updates.inputTokens = parseInt(inputMatch[1].replace(/,/g, ''));
  if (outputMatch) updates.outputTokens = parseInt(outputMatch[1].replace(/,/g, ''));
  if (costMatch) updates.estimatedCost = parseFloat(costMatch[1]);

  return Object.keys(updates).length > 0 ? updates : null;
}

// ── Session Manager ──────────────────────────────────────────────

function createSession(opts) {
  const { name, cwd, command = 'claude', initialPrompt, autoApproveRules = [], tags = [], chainTo } = opts;
  const id = uuid().slice(0, 8);
  const isWin = process.platform === 'win32';
  const parts = command.trim().split(/\s+/);
  const exe = parts[0];
  const args = parts.slice(1);

  let proc;
  const spawnOpts = {
    name: 'xterm-256color',
    cols: 120,
    rows: 30,
    cwd: cwd || os.homedir(),
    env: { ...process.env, TERM: 'xterm-256color', FORCE_COLOR: '1', COLORTERM: 'truecolor' },
  };

  try {
    proc = pty.spawn(isWin ? exe + '.cmd' : exe, args, spawnOpts);
  } catch {
    try {
      proc = pty.spawn(exe, args, spawnOpts);
    } catch (e2) {
      return { error: `Failed to spawn "${command}": ${e2.message}` };
    }
  }

  const session = {
    id, name, cwd: cwd || os.homedir(), command,
    status: 'active',
    createdAt: Date.now(),
    notes: '', tags: tags || [],
    costInfo: { inputTokens: 0, outputTokens: 0, estimatedCost: 0 },
    gitInfo: getGitInfo(cwd || os.homedir()),
    statusHistory: [{ status: 'active', timestamp: Date.now() }],
    autoApproveRules: autoApproveRules || [],
    chainTo: chainTo || null,
    proc,
    buffer: [],
    bufferSize: 0,
    transcript: [],
    pendingApproval: null,
  };

  const MAX_BUFFER = 100 * 1024; // 100KB

  proc.onData((data) => {
    // Buffer
    session.buffer.push(data);
    session.bufferSize += data.length;
    while (session.bufferSize > MAX_BUFFER && session.buffer.length > 1) {
      session.bufferSize -= session.buffer.shift().length;
    }

    // Transcript (clean)
    session.transcript.push(data);

    // Status detection
    detectStatus(session, data);

    // Approval detection
    const approval = detectApproval(data);
    if (approval) {
      session.pendingApproval = approval;
      session.status = 'waiting';
      broadcastStatus(session);

      // Check auto-approve rules
      const matchedRule = session.autoApproveRules.find(r => matchesAutoApproveRule(r, approval));
      if (matchedRule) {
        setTimeout(() => {
          if (session.proc) {
            session.proc.write('y\r');
            session.pendingApproval = null;
            broadcast({ type: 'auto_approved', id: session.id, rule: matchedRule.name });
          }
        }, 200);
      } else {
        broadcast({ type: 'approval_detected', id: session.id, approval });
      }
    }

    // Cost parsing
    const cost = parseCost(data);
    if (cost) {
      if (cost.inputTokens) session.costInfo.inputTokens += cost.inputTokens;
      if (cost.outputTokens) session.costInfo.outputTokens += cost.outputTokens;
      if (cost.estimatedCost) session.costInfo.estimatedCost += cost.estimatedCost;
      broadcast({ type: 'cost_update', id: session.id, cost: session.costInfo });
    }

    // Broadcast output
    broadcast({ type: 'output', id: session.id, data });
  });

  proc.onExit(({ exitCode }) => {
    session.status = 'exited';
    session.statusHistory.push({ status: 'exited', timestamp: Date.now() });
    broadcast({ type: 'exited', id: session.id, exitCode });
    broadcastStatus(session);

    // Chain: start next session
    if (session.chainTo) {
      const chain = session.chainTo;
      setTimeout(() => {
        const result = createSession({
          name: chain.name,
          cwd: chain.cwd,
          command: chain.command,
          initialPrompt: chain.prompt,
        });
        if (!result.error) {
          broadcast({ type: 'created', session: result.session });
        }
      }, 1000);
    }
  });

  sessions.set(id, session);

  // Send initial prompt after a delay (let Claude CLI initialize)
  if (initialPrompt) {
    setTimeout(() => {
      if (session.proc) {
        session.proc.write(initialPrompt + '\r');
      }
    }, 3000);
  }

  // Periodic git status refresh
  session.gitInterval = setInterval(() => {
    if (session.status !== 'exited') {
      const git = getGitInfo(session.cwd);
      if (git) {
        session.gitInfo = git;
        broadcast({ type: 'git_info', id: session.id, git });
      }
    } else {
      clearInterval(session.gitInterval);
    }
  }, 30000);

  return { session: serializeSession(session) };
}

function detectStatus(session, data) {
  const prev = session.status;
  const clean = stripAnsi(data);

  if (clean.includes('Thinking') || clean.includes('Working') || clean.includes('Analyzing')) {
    if (session.status !== 'active') {
      session.status = 'active';
      session.pendingApproval = null;
    }
  }

  // Idle detection (prompt ready)
  if (clean.match(/\n>\s*$/) || clean.match(/\n\$\s*$/)) {
    if (session.status === 'active') {
      session.status = 'idle';
    }
  }

  if (prev !== session.status) {
    session.statusHistory.push({ status: session.status, timestamp: Date.now() });
    broadcastStatus(session);
  }
}

function broadcastStatus(session) {
  broadcast({ type: 'status', id: session.id, status: session.status });
}

function serializeSession(s) {
  return {
    id: s.id, name: s.name, cwd: s.cwd, command: s.command,
    status: s.status, createdAt: s.createdAt,
    notes: s.notes, tags: s.tags,
    costInfo: s.costInfo,
    gitInfo: s.gitInfo,
    statusHistory: s.statusHistory,
  };
}

function getSessionList() {
  return Array.from(sessions.values()).map(serializeSession);
}

function buildTranscript(session) {
  const raw = session.transcript.join('');
  const clean = stripAnsi(raw);
  const lines = clean.split('\n');
  let md = `# Session: ${session.name}\n`;
  md += `- Directory: ${session.cwd}\n`;
  md += `- Command: ${session.command}\n`;
  md += `- Created: ${new Date(session.createdAt).toISOString()}\n`;
  md += `- Status: ${session.status}\n`;
  if (session.costInfo.inputTokens > 0) {
    md += `- Tokens: ${session.costInfo.inputTokens} in / ${session.costInfo.outputTokens} out\n`;
    md += `- Est. Cost: $${session.costInfo.estimatedCost.toFixed(4)}\n`;
  }
  md += `\n---\n\n\`\`\`\n${lines.join('\n')}\n\`\`\`\n`;
  return md;
}

// ── Express ──────────────────────────────────────────────────────

const app = express();
app.use(express.json());

if (isProduction) {
  app.use(express.static(join(__dirname, '..', 'dist')));
}

app.get('/api/health', (_, res) => res.json({ ok: true, sessions: sessions.size }));
app.get('/api/sessions', (_, res) => res.json(getSessionList()));
app.get('/api/templates', (_, res) => res.json(templates));

app.get('/api/sessions/:id/transcript', (req, res) => {
  const session = sessions.get(req.params.id);
  if (!session) return res.status(404).json({ error: 'Not found' });
  res.setHeader('Content-Type', 'text/markdown');
  res.setHeader('Content-Disposition', `attachment; filename="${session.name}-transcript.md"`);
  res.send(buildTranscript(session));
});

if (isProduction) {
  app.get('*', (_, res) => res.sendFile(join(__dirname, '..', 'dist', 'index.html')));
}

// ── WebSocket ────────────────────────────────────────────────────

const server = createServer(app);
const wss = new WebSocketServer({ server, path: '/ws' });
const clients = new Set();

function broadcast(msg) {
  const payload = JSON.stringify(msg);
  for (const ws of clients) {
    if (ws.readyState === 1) ws.send(payload);
  }
}

wss.on('connection', (ws) => {
  clients.add(ws);
  ws.send(JSON.stringify({ type: 'sessions', sessions: getSessionList() }));
  ws.send(JSON.stringify({ type: 'templates', templates }));

  ws.on('message', (raw) => {
    let msg;
    try { msg = JSON.parse(raw.toString()); } catch { return; }

    switch (msg.type) {
      case 'create': {
        const result = createSession(msg);
        if (result.error) {
          ws.send(JSON.stringify({ type: 'error', message: result.error }));
        } else {
          broadcast({ type: 'created', session: result.session });
        }
        break;
      }

      case 'input': {
        const s = sessions.get(msg.id);
        if (s?.proc) s.proc.write(msg.data);
        break;
      }

      case 'chat': {
        const s = sessions.get(msg.id);
        if (s?.proc) s.proc.write(msg.message + '\r');
        break;
      }

      case 'resize': {
        const s = sessions.get(msg.id);
        if (s?.proc) { try { s.proc.resize(msg.cols, msg.rows); } catch {} }
        break;
      }

      case 'kill': {
        const s = sessions.get(msg.id);
        if (s?.proc) { s.proc.kill(); s.status = 'exited'; broadcastStatus(s); }
        break;
      }

      case 'remove': {
        const s = sessions.get(msg.id);
        if (s) {
          if (s.proc) { try { s.proc.kill(); } catch {} }
          clearInterval(s.gitInterval);
          sessions.delete(msg.id);
          broadcast({ type: 'removed', id: msg.id });
        }
        break;
      }

      case 'replay': {
        const s = sessions.get(msg.id);
        if (s) {
          const full = s.buffer.join('');
          if (full) ws.send(JSON.stringify({ type: 'output', id: s.id, data: full }));
        }
        break;
      }

      case 'approve': {
        const s = sessions.get(msg.id);
        if (s?.proc) { s.proc.write('y\r'); s.pendingApproval = null; }
        break;
      }

      case 'deny': {
        const s = sessions.get(msg.id);
        if (s?.proc) { s.proc.write('n\r'); s.pendingApproval = null; }
        break;
      }

      case 'approve_all': {
        for (const s of sessions.values()) {
          if (s.pendingApproval && s.proc) {
            s.proc.write('y\r');
            s.pendingApproval = null;
            broadcast({ type: 'auto_approved', id: s.id, rule: 'batch' });
          }
        }
        break;
      }

      case 'set_notes': {
        const s = sessions.get(msg.id);
        if (s) { s.notes = msg.notes || ''; s.tags = msg.tags || []; }
        break;
      }

      case 'set_chain': {
        const s = sessions.get(msg.id);
        if (s) s.chainTo = msg.chain;
        break;
      }

      case 'set_auto_approve': {
        const s = sessions.get(msg.id);
        if (s) s.autoApproveRules = msg.rules || [];
        break;
      }

      case 'save_template': {
        const existing = templates.findIndex(t => t.id === msg.template.id);
        if (existing >= 0) templates[existing] = msg.template;
        else templates.push(msg.template);
        saveState();
        broadcast({ type: 'templates', templates });
        break;
      }

      case 'delete_template': {
        templates = templates.filter(t => t.id !== msg.id);
        saveState();
        broadcast({ type: 'templates', templates });
        break;
      }

      case 'get_git_info': {
        const s = sessions.get(msg.id);
        if (s) {
          const git = getGitInfo(s.cwd);
          if (git) { s.gitInfo = git; ws.send(JSON.stringify({ type: 'git_info', id: s.id, git })); }
        }
        break;
      }

      case 'get_transcript': {
        const s = sessions.get(msg.id);
        if (s) {
          ws.send(JSON.stringify({ type: 'transcript', id: s.id, transcript: buildTranscript(s) }));
        }
        break;
      }
    }
  });

  ws.on('close', () => clients.delete(ws));
});

server.listen(PORT, () => {
  console.log(`Claude Hub v2 running on http://localhost:${PORT}`);
  console.log(`WebSocket: ws://localhost:${PORT}/ws`);
  console.log(`${sessions.size} sessions, ${templates.length} templates`);
});
