import { useState } from 'react';
import { useStore } from '../store';
import type { AutoApproveRule, ChainRule, SessionTemplate } from '../types';
import { v4 as uuid } from 'uuid';

const QUICK_DIRS = [
  { label: 'Soma Engine', cwd: 'C:\\Users\\ryang\\Downloads\\soma-engine' },
  { label: 'Home', cwd: 'C:\\Users\\ryang' },
];

const AUTO_APPROVE_PRESETS: { label: string; rules: AutoApproveRule[] }[] = [
  { label: 'None', rules: [] },
  {
    label: 'Read-only tools',
    rules: [{ id: 'reads', name: 'Read-only', type: 'reads' }],
  },
  {
    label: 'All tools',
    rules: [{ id: 'all', name: 'All tools', type: 'all' }],
  },
];

export default function CreateSessionModal({ onClose }: { onClose: () => void }) {
  const createSession = useStore(s => s.createSession);
  const templates = useStore(s => s.templates);
  const saveTemplate = useStore(s => s.saveTemplate);
  const deleteTemplate = useStore(s => s.deleteTemplate);

  const [name, setName] = useState('');
  const [cwd, setCwd] = useState('');
  const [command, setCommand] = useState('claude');
  const [initialPrompt, setInitialPrompt] = useState('');
  const [tags, setTags] = useState('');
  const [autoApproveRules, setAutoApproveRules] = useState<AutoApproveRule[]>([]);
  const [showChain, setShowChain] = useState(false);
  const [chainName, setChainName] = useState('');
  const [chainCwd, setChainCwd] = useState('');
  const [chainCommand, setChainCommand] = useState('claude');
  const [chainPrompt, setChainPrompt] = useState('');
  const [showAdvanced, setShowAdvanced] = useState(false);
  const [activeTab, setActiveTab] = useState<'new' | 'templates'>('new');

  const handleCreate = () => {
    if (!name.trim()) return;
    const chainTo: ChainRule | undefined = showChain && chainName.trim()
      ? { name: chainName.trim(), cwd: chainCwd || cwd, command: chainCommand || 'claude', prompt: chainPrompt }
      : undefined;

    createSession({
      name: name.trim(),
      cwd: cwd.trim() || undefined as any,
      command: command.trim() || undefined,
      initialPrompt: initialPrompt.trim() || undefined,
      autoApproveRules,
      tags: tags.split(',').map(t => t.trim()).filter(Boolean),
      chainTo,
    });
    onClose();
  };

  const handleSaveTemplate = () => {
    if (!name.trim()) return;
    const tmpl: SessionTemplate = {
      id: uuid().slice(0, 8),
      name: name.trim(),
      cwd: cwd.trim(),
      command: command.trim() || 'claude',
      initialPrompt: initialPrompt.trim(),
      autoApproveRules,
      tags: tags.split(',').map(t => t.trim()).filter(Boolean),
    };
    saveTemplate(tmpl);
  };

  const handleLoadTemplate = (tmpl: SessionTemplate) => {
    setName(tmpl.name);
    setCwd(tmpl.cwd);
    setCommand(tmpl.command);
    setInitialPrompt(tmpl.initialPrompt);
    setAutoApproveRules(tmpl.autoApproveRules || []);
    setTags((tmpl.tags || []).join(', '));
    setActiveTab('new');
  };

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal modal-lg" onClick={e => e.stopPropagation()}>
        <div className="modal-header">
          <div className="modal-tabs">
            <button className={`modal-tab ${activeTab === 'new' ? 'active' : ''}`} onClick={() => setActiveTab('new')}>
              New Session
            </button>
            <button className={`modal-tab ${activeTab === 'templates' ? 'active' : ''}`} onClick={() => setActiveTab('templates')}>
              Templates {templates.length > 0 && <span className="event-count">{templates.length}</span>}
            </button>
          </div>
          <button className="btn-icon modal-close" onClick={onClose}>&times;</button>
        </div>

        {activeTab === 'templates' ? (
          <div className="modal-body">
            {templates.length === 0 ? (
              <div className="template-empty">
                <p>No saved templates yet.</p>
                <p className="text-muted">Fill in session details and click "Save as Template".</p>
              </div>
            ) : (
              <div className="template-list">
                {templates.map(t => (
                  <div key={t.id} className="template-item">
                    <div className="template-info">
                      <div className="template-name">{t.name}</div>
                      <div className="template-detail">{t.cwd}</div>
                      {t.initialPrompt && <div className="template-prompt">{t.initialPrompt.slice(0, 80)}...</div>}
                    </div>
                    <div className="template-actions">
                      <button className="btn-small" onClick={() => handleLoadTemplate(t)}>Use</button>
                      <button className="btn-small danger" onClick={() => deleteTemplate(t.id)}>Delete</button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        ) : (
          <div className="modal-body">
            <div className="form-row">
              <div className="form-group flex-1">
                <label>Session Name</label>
                <input
                  type="text" value={name} onChange={e => setName(e.target.value)}
                  placeholder="e.g., Backend API" autoFocus
                  onKeyDown={e => { if (e.key === 'Enter' && name.trim()) handleCreate(); }}
                />
              </div>
              <div className="form-group flex-1">
                <label>Tags <span className="text-muted">(comma separated)</span></label>
                <input
                  type="text" value={tags} onChange={e => setTags(e.target.value)}
                  placeholder="e.g., backend, api"
                />
              </div>
            </div>

            <div className="form-group">
              <label>Working Directory</label>
              <input
                type="text" value={cwd} onChange={e => setCwd(e.target.value)}
                placeholder="e.g., C:\Users\ryang\projects\my-app"
              />
              <div className="preset-buttons">
                {QUICK_DIRS.map(p => (
                  <button key={p.label} className="preset-btn" onClick={() => { setName(name || p.label); setCwd(p.cwd); }}>
                    {p.label}
                  </button>
                ))}
              </div>
            </div>

            <div className="form-group">
              <label>Initial Prompt <span className="text-muted">(sent after Claude starts)</span></label>
              <textarea
                value={initialPrompt} onChange={e => setInitialPrompt(e.target.value)}
                placeholder="e.g., Review the codebase and suggest improvements..."
                rows={2}
              />
            </div>

            <div className="form-group">
              <label>Auto-Approve</label>
              <div className="preset-buttons">
                {AUTO_APPROVE_PRESETS.map(p => (
                  <button
                    key={p.label}
                    className={`preset-btn ${JSON.stringify(autoApproveRules) === JSON.stringify(p.rules) ? 'active' : ''}`}
                    onClick={() => setAutoApproveRules(p.rules)}
                  >
                    {p.label}
                  </button>
                ))}
              </div>
            </div>

            <button className="advanced-toggle" onClick={() => setShowAdvanced(!showAdvanced)}>
              {showAdvanced ? '\u25BC' : '\u25B6'} Advanced
            </button>

            {showAdvanced && (
              <>
                <div className="form-group">
                  <label>Command</label>
                  <input type="text" value={command} onChange={e => setCommand(e.target.value)} placeholder="claude" />
                </div>

                <div className="form-group">
                  <label>
                    <input type="checkbox" checked={showChain} onChange={e => setShowChain(e.target.checked)} />
                    {' '}Chain: Start another session when this one exits
                  </label>
                </div>

                {showChain && (
                  <div className="chain-config">
                    <div className="form-row">
                      <div className="form-group flex-1">
                        <label>Next Session Name</label>
                        <input type="text" value={chainName} onChange={e => setChainName(e.target.value)} />
                      </div>
                      <div className="form-group flex-1">
                        <label>Next Working Dir</label>
                        <input type="text" value={chainCwd} onChange={e => setChainCwd(e.target.value)} placeholder="Same as current" />
                      </div>
                    </div>
                    <div className="form-group">
                      <label>Next Initial Prompt</label>
                      <input type="text" value={chainPrompt} onChange={e => setChainPrompt(e.target.value)} />
                    </div>
                  </div>
                )}
              </>
            )}
          </div>
        )}

        <div className="modal-footer">
          {activeTab === 'new' && (
            <button className="btn-secondary" onClick={handleSaveTemplate} disabled={!name.trim()}>
              Save as Template
            </button>
          )}
          <div className="footer-spacer" />
          <button className="btn-secondary" onClick={onClose}>Cancel</button>
          <button className="btn-primary" onClick={handleCreate} disabled={!name.trim()}>
            Create Session
          </button>
        </div>
      </div>
    </div>
  );
}
