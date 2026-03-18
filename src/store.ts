import { create } from 'zustand';
import type {
  Session, SessionStatus, ChatMessage, ChatEvent, ApprovalRequest,
  AutoApproveRule, SessionTemplate, ChainRule, ViewMode, Toast, WSMessage,
  CostInfo, GitInfo,
} from './types';

// ── Terminal Emitter (outside React for performance) ─────────────

type TerminalListener = (data: string) => void;

class TerminalEmitter {
  private listeners = new Map<string, Set<TerminalListener>>();
  private buffers = new Map<string, string[]>();

  subscribe(sessionId: string, fn: TerminalListener) {
    if (!this.listeners.has(sessionId)) this.listeners.set(sessionId, new Set());
    this.listeners.get(sessionId)!.add(fn);
    return () => { this.listeners.get(sessionId)?.delete(fn); };
  }

  emit(sessionId: string, data: string) {
    if (!this.buffers.has(sessionId)) this.buffers.set(sessionId, []);
    this.buffers.get(sessionId)!.push(data);
    this.listeners.get(sessionId)?.forEach(fn => fn(data));
  }

  getBuffer(sessionId: string): string {
    return (this.buffers.get(sessionId) || []).join('');
  }

  clear(sessionId: string) {
    this.buffers.delete(sessionId);
    this.listeners.delete(sessionId);
  }
}

export const terminalEmitter = new TerminalEmitter();

// ── Search Addon Registry ────────────────────────────────────────

export const searchAddons = new Map<string, any>();

// ── Notification Helper ──────────────────────────────────────────

function desktopNotify(title: string, body: string) {
  if (typeof Notification !== 'undefined' && Notification.permission === 'granted') {
    new Notification(title, { body });
  }
}

// ── Store ────────────────────────────────────────────────────────

let msgCounter = 0;
const nextId = () => `${++msgCounter}`;

interface AppState {
  // Connection
  socket: WebSocket | null;
  connected: boolean;

  // Sessions
  sessions: Session[];
  activeSessionId: string | null;
  openTabs: string[];
  viewMode: ViewMode;
  splitIds: [string | null, string | null];

  // Chat & Events
  messages: Record<string, ChatMessage[]>;
  events: Record<string, ChatEvent[]>;

  // Approvals
  approvals: ApprovalRequest[];
  approvalQueueOpen: boolean;

  // Templates
  templates: SessionTemplate[];

  // Notifications
  toasts: Toast[];
  notificationsEnabled: boolean;

  // Search
  searchOpen: boolean;
  searchQuery: string;

  // Actions
  connect: () => void;
  send: (msg: object) => void;

  setActiveSession: (id: string) => void;
  openTab: (id: string) => void;
  closeTab: (id: string) => void;
  setViewMode: (mode: ViewMode) => void;
  setSplitId: (slot: 0 | 1, id: string | null) => void;

  addChatMessage: (sessionId: string, role: ChatMessage['role'], content: string) => void;
  createSession: (opts: { name: string; cwd: string; command?: string; initialPrompt?: string; autoApproveRules?: AutoApproveRule[]; tags?: string[]; chainTo?: ChainRule }) => void;
  killSession: (id: string) => void;
  removeSession: (id: string) => void;

  approveSession: (id: string) => void;
  denySession: (id: string) => void;
  approveAll: () => void;
  setApprovalQueueOpen: (open: boolean) => void;

  setNotes: (id: string, notes: string, tags: string[]) => void;
  setChain: (id: string, chain: ChainRule | null) => void;
  setAutoApprove: (id: string, rules: AutoApproveRule[]) => void;

  saveTemplate: (template: SessionTemplate) => void;
  deleteTemplate: (id: string) => void;

  addToast: (type: Toast['type'], title: string, body?: string, sessionId?: string) => void;
  removeToast: (id: string) => void;

  setSearchOpen: (open: boolean) => void;
  setSearchQuery: (query: string) => void;

  enableNotifications: () => void;
  requestGitInfo: (id: string) => void;
  getTranscript: (id: string) => void;
  copySessionOutput: (id: string) => string;
}

export const useStore = create<AppState>((set, get) => ({
  socket: null,
  connected: false,
  sessions: [],
  activeSessionId: null,
  openTabs: [],
  viewMode: 'tabs',
  splitIds: [null, null],
  messages: {},
  events: {},
  approvals: [],
  approvalQueueOpen: false,
  templates: [],
  toasts: [],
  notificationsEnabled: false,
  searchOpen: false,
  searchQuery: '',

  // ── Connection ───────────────────────────────────────────────

  connect: () => {
    const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
    const host = import.meta.env.DEV ? 'localhost:3100' : window.location.host;
    const ws = new WebSocket(`${protocol}//${host}/ws`);

    ws.onopen = () => set({ socket: ws, connected: true });

    ws.onclose = () => {
      set({ socket: null, connected: false });
      setTimeout(() => get().connect(), 2000);
    };

    ws.onmessage = (evt) => {
      const msg: WSMessage = JSON.parse(evt.data);
      handleMessage(msg, get, set);
    };
  },

  send: (msg) => {
    const { socket } = get();
    if (socket?.readyState === 1) socket.send(JSON.stringify(msg));
  },

  // ── Session Navigation ───────────────────────────────────────

  setActiveSession: (id) => {
    const s = get();
    set({
      activeSessionId: id,
      openTabs: s.openTabs.includes(id) ? s.openTabs : [...s.openTabs, id],
    });
  },

  openTab: (id) => {
    const s = get();
    if (!s.openTabs.includes(id)) set({ openTabs: [...s.openTabs, id] });
    set({ activeSessionId: id });
  },

  closeTab: (id) => {
    const s = get();
    const tabs = s.openTabs.filter(t => t !== id);
    set({
      openTabs: tabs,
      activeSessionId: s.activeSessionId === id ? (tabs[tabs.length - 1] || null) : s.activeSessionId,
    });
  },

  setViewMode: (mode) => set({ viewMode: mode }),

  setSplitId: (slot, id) => {
    const split = [...get().splitIds] as [string | null, string | null];
    split[slot] = id;
    set({ splitIds: split });
  },

  // ── Chat ─────────────────────────────────────────────────────

  addChatMessage: (sessionId, role, content) => {
    const s = get();
    const prev = s.messages[sessionId] || [];
    set({
      messages: {
        ...s.messages,
        [sessionId]: [...prev, { id: `msg-${nextId()}`, sessionId, role, content, timestamp: Date.now() }],
      },
    });
  },

  // ── Session Lifecycle ────────────────────────────────────────

  createSession: (opts) => get().send({ type: 'create', ...opts }),
  killSession: (id) => get().send({ type: 'kill', id }),
  removeSession: (id) => get().send({ type: 'remove', id }),

  // ── Approvals ────────────────────────────────────────────────

  approveSession: (id) => {
    get().send({ type: 'approve', id });
    set({ approvals: get().approvals.filter(a => a.sessionId !== id) });
  },

  denySession: (id) => {
    get().send({ type: 'deny', id });
    set({ approvals: get().approvals.filter(a => a.sessionId !== id) });
  },

  approveAll: () => {
    get().send({ type: 'approve_all' });
    set({ approvals: [] });
  },

  setApprovalQueueOpen: (open) => set({ approvalQueueOpen: open }),

  // ── Notes, Chain, Auto-Approve ───────────────────────────────

  setNotes: (id, notes, tags) => get().send({ type: 'set_notes', id, notes, tags }),
  setChain: (id, chain) => get().send({ type: 'set_chain', id, chain }),
  setAutoApprove: (id, rules) => get().send({ type: 'set_auto_approve', id, rules }),

  // ── Templates ────────────────────────────────────────────────

  saveTemplate: (template) => get().send({ type: 'save_template', template }),
  deleteTemplate: (id) => get().send({ type: 'delete_template', id }),

  // ── Notifications ────────────────────────────────────────────

  addToast: (type, title, body, sessionId) => {
    const id = `toast-${nextId()}`;
    const toast: Toast = { id, type, title, body, sessionId, timestamp: Date.now() };
    set({ toasts: [...get().toasts, toast] });
    setTimeout(() => get().removeToast(id), 5000);
  },

  removeToast: (id) => set({ toasts: get().toasts.filter(t => t.id !== id) }),

  enableNotifications: () => {
    if (typeof Notification !== 'undefined') {
      Notification.requestPermission().then(p => {
        set({ notificationsEnabled: p === 'granted' });
      });
    }
  },

  // ── Search ───────────────────────────────────────────────────

  setSearchOpen: (open) => set({ searchOpen: open }),
  setSearchQuery: (query) => set({ searchQuery: query }),

  // ── Git & Transcript ─────────────────────────────────────────

  requestGitInfo: (id) => get().send({ type: 'get_git_info', id }),
  getTranscript: (id) => get().send({ type: 'get_transcript', id }),

  copySessionOutput: (id) => {
    const buffer = terminalEmitter.getBuffer(id);
    const clean = buffer.replace(/\x1b\[[0-9;]*[a-zA-Z]/g, '');
    return clean.slice(-5000); // Last 5K chars
  },
}));

// ── Message Handler ──────────────────────────────────────────────

function handleMessage(msg: WSMessage, get: () => AppState, set: (partial: Partial<AppState> | ((s: AppState) => Partial<AppState>)) => void) {
  const state = get();

  switch (msg.type) {
    case 'sessions':
      set({ sessions: msg.sessions });
      break;

    case 'created': {
      const s = msg.session;
      set({
        sessions: [...state.sessions, s],
        activeSessionId: s.id,
        openTabs: state.openTabs.includes(s.id) ? state.openTabs : [...state.openTabs, s.id],
      });
      get().addToast('success', 'Session created', s.name, s.id);
      break;
    }

    case 'output':
      terminalEmitter.emit(msg.id, msg.data);
      break;

    case 'status': {
      set({
        sessions: state.sessions.map(s =>
          s.id === msg.id ? {
            ...s, status: msg.status,
            statusHistory: [...s.statusHistory, { status: msg.status, timestamp: Date.now() }],
          } : s
        ),
      });
      const session = state.sessions.find(s => s.id === msg.id);
      const name = session?.name || msg.id;

      // Add event
      const prev = state.events[msg.id] || [];
      set({
        events: { ...state.events, [msg.id]: [...prev, {
          id: `evt-${nextId()}`, sessionId: msg.id, type: 'status',
          content: `Status: ${msg.status}`, timestamp: Date.now(),
        }] },
      });

      // Notifications
      if (msg.status === 'waiting') {
        get().addToast('warning', 'Approval needed', name, msg.id);
        desktopNotify('Claude Hub', `${name} needs approval`);
      }
      break;
    }

    case 'exited': {
      set({
        sessions: state.sessions.map(s =>
          s.id === msg.id ? { ...s, status: 'exited' as const } : s
        ),
      });
      const session = state.sessions.find(s => s.id === msg.id);
      get().addToast('info', 'Session ended', session?.name || msg.id, msg.id);
      desktopNotify('Claude Hub', `${session?.name || msg.id} ended (exit ${msg.exitCode})`);
      break;
    }

    case 'removed':
      set({
        sessions: state.sessions.filter(s => s.id !== msg.id),
        openTabs: state.openTabs.filter(t => t !== msg.id),
        activeSessionId: state.activeSessionId === msg.id
          ? state.openTabs.find(t => t !== msg.id) || null
          : state.activeSessionId,
      });
      terminalEmitter.clear(msg.id);
      searchAddons.delete(msg.id);
      break;

    case 'error':
      get().addToast('error', 'Error', msg.message);
      break;

    case 'git_info':
      set({
        sessions: state.sessions.map(s =>
          s.id === msg.id ? { ...s, gitInfo: msg.git } : s
        ),
      });
      break;

    case 'cost_update':
      set({
        sessions: state.sessions.map(s =>
          s.id === msg.id ? { ...s, costInfo: msg.cost } : s
        ),
      });
      break;

    case 'approval_detected': {
      const session = state.sessions.find(s => s.id === msg.id);
      const approval: ApprovalRequest = {
        id: `appr-${nextId()}`,
        sessionId: msg.id,
        sessionName: session?.name || msg.id,
        tool: msg.approval.tool,
        detail: msg.approval.detail,
        timestamp: Date.now(),
      };
      set({ approvals: [...state.approvals, approval] });
      break;
    }

    case 'auto_approved': {
      const prev = state.events[msg.id] || [];
      set({
        events: { ...state.events, [msg.id]: [...prev, {
          id: `evt-${nextId()}`, sessionId: msg.id, type: 'auto_approved',
          content: `Auto-approved (${msg.rule})`, timestamp: Date.now(),
        }] },
        approvals: state.approvals.filter(a => a.sessionId !== msg.id),
      });
      break;
    }

    case 'templates':
      set({ templates: msg.templates });
      break;

    case 'transcript': {
      // Download the transcript
      const blob = new Blob([msg.transcript], { type: 'text/markdown' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `session-${msg.id}-transcript.md`;
      a.click();
      URL.revokeObjectURL(url);
      break;
    }
  }
}
