// ── Session ──────────────────────────────────────────────────────

export type SessionStatus = 'active' | 'waiting' | 'idle' | 'exited' | 'error';

export interface Session {
  id: string;
  name: string;
  cwd: string;
  command: string;
  status: SessionStatus;
  createdAt: number;
  notes: string;
  tags: string[];
  costInfo: CostInfo;
  gitInfo: GitInfo | null;
  statusHistory: StatusEntry[];
}

export interface StatusEntry {
  status: SessionStatus;
  timestamp: number;
}

export interface CostInfo {
  inputTokens: number;
  outputTokens: number;
  estimatedCost: number;
}

export interface GitInfo {
  branch: string;
  changes: number;
  lastCommit: string;
}

// ── Chat ─────────────────────────────────────────────────────────

export interface ChatMessage {
  id: string;
  sessionId: string;
  role: 'user' | 'assistant' | 'system';
  content: string;
  timestamp: number;
}

export interface ChatEvent {
  id: string;
  sessionId: string;
  type: 'status' | 'approval' | 'complete' | 'error' | 'info' | 'auto_approved';
  content: string;
  timestamp: number;
}

// ── Approvals ────────────────────────────────────────────────────

export interface ApprovalRequest {
  id: string;
  sessionId: string;
  sessionName: string;
  tool: string;
  detail: string;
  timestamp: number;
}

export interface AutoApproveRule {
  id: string;
  name: string;
  type: 'all' | 'reads' | 'writes' | 'tool' | 'pattern';
  tool?: string;
  pattern?: string;
  sessionId?: string; // null = global
}

// ── Templates & Chaining ─────────────────────────────────────────

export interface SessionTemplate {
  id: string;
  name: string;
  cwd: string;
  command: string;
  initialPrompt: string;
  autoApproveRules: AutoApproveRule[];
  tags: string[];
}

export interface ChainRule {
  name: string;
  cwd: string;
  command: string;
  prompt: string;
}

// ── View ─────────────────────────────────────────────────────────

export type ViewMode = 'tabs' | 'grid' | 'split';

// ── Notifications ────────────────────────────────────────────────

export interface Toast {
  id: string;
  type: 'info' | 'success' | 'warning' | 'error';
  title: string;
  body?: string;
  sessionId?: string;
  timestamp: number;
}

// ── WebSocket Messages ───────────────────────────────────────────

export type WSMessage =
  | { type: 'sessions'; sessions: Session[] }
  | { type: 'created'; session: Session }
  | { type: 'output'; id: string; data: string }
  | { type: 'status'; id: string; status: SessionStatus }
  | { type: 'exited'; id: string; exitCode: number }
  | { type: 'removed'; id: string }
  | { type: 'error'; message: string }
  | { type: 'git_info'; id: string; git: GitInfo }
  | { type: 'cost_update'; id: string; cost: CostInfo }
  | { type: 'approval_detected'; id: string; approval: { tool: string; detail: string } }
  | { type: 'auto_approved'; id: string; rule: string }
  | { type: 'templates'; templates: SessionTemplate[] }
  | { type: 'transcript'; id: string; transcript: string };

export type WSCommand =
  | { type: 'create'; name: string; cwd: string; command?: string; initialPrompt?: string; autoApproveRules?: AutoApproveRule[]; tags?: string[]; chainTo?: ChainRule }
  | { type: 'input'; id: string; data: string }
  | { type: 'chat'; id: string; message: string }
  | { type: 'resize'; id: string; cols: number; rows: number }
  | { type: 'kill'; id: string }
  | { type: 'remove'; id: string }
  | { type: 'replay'; id: string }
  | { type: 'approve'; id: string }
  | { type: 'deny'; id: string }
  | { type: 'approve_all' }
  | { type: 'set_notes'; id: string; notes: string; tags: string[] }
  | { type: 'set_chain'; id: string; chain: ChainRule | null }
  | { type: 'set_auto_approve'; id: string; rules: AutoApproveRule[] }
  | { type: 'save_template'; template: SessionTemplate }
  | { type: 'delete_template'; id: string }
  | { type: 'get_git_info'; id: string }
  | { type: 'get_transcript'; id: string };
