import { useState, useEffect } from 'react';
import { useAdminApi } from './adminApi';

interface OutreachLead {
  id: string;
  company: string;
  name: string;
  role: string;
  email: string;
  angle: string;
  emailSubject: string;
  emailBody: string;
  status: 'draft' | 'ready' | 'sent' | 'replied' | 'bounced';
  sentAt: string | null;
  repliedAt: string | null;
  notes: string;
  createdAt: string;
  updatedAt: string;
}

const STATUS_COLORS: Record<string, { bg: string; text: string }> = {
  draft: { bg: '#e8e0d0', text: '#5a5040' },
  ready: { bg: '#d4e8d4', text: '#1a5a1a' },
  sent: { bg: '#d0e0f0', text: '#1a3a6a' },
  replied: { bg: '#1a7a28', text: '#ffffff' },
  bounced: { bg: '#f0d0d0', text: '#8a2020' },
};

export default function Outreach() {
  const api = useAdminApi();
  const [leads, setLeads] = useState<OutreachLead[]>([]);
  const [loading, setLoading] = useState(true);
  const [smtpOk, setSmtpOk] = useState(false);
  const [smtpUser, setSmtpUser] = useState('');
  const [smtpMsg, setSmtpMsg] = useState('');
  const [editingId, setEditingId] = useState<string | null>(null);
  const [sending, setSending] = useState<string | null>(null);
  const [generating, setGenerating] = useState<string | null>(null);
  const [bulkSending, setBulkSending] = useState(false);
  const [bulkGenerating, setBulkGenerating] = useState(false);
  const [filter, setFilter] = useState<string>('all');
  const [showAdd, setShowAdd] = useState(false);
  const [showImport, setShowImport] = useState(false);
  const [importJson, setImportJson] = useState('');
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');

  useEffect(() => {
    load();
    checkSmtp();
  }, []);

  async function load() {
    try {
      const data = await api.fetchOutreachLeads();
      setLeads(data.leads || []);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Failed to load');
    } finally {
      setLoading(false);
    }
  }

  async function checkSmtp() {
    try {
      const data = await api.checkSmtpStatus();
      setSmtpOk(data.configured);
      setSmtpUser(data.user || '');
      setSmtpMsg(data.message || '');
    } catch {
      setSmtpOk(false);
    }
  }

  async function addLead(lead: Partial<OutreachLead>) {
    try {
      await api.addOutreachLead(lead);
      setShowAdd(false);
      setSuccess('Lead added');
      load();
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Failed to add');
    }
  }

  async function updateLead(id: string, data: Partial<OutreachLead>) {
    try {
      await api.updateOutreachLead(id, data);
      load();
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Failed to update');
    }
  }

  async function deleteLead(id: string) {
    if (!confirm('Delete this lead?')) return;
    try {
      await api.deleteOutreachLead(id);
      setEditingId(null);
      load();
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Failed to delete');
    }
  }

  async function sendEmail(id: string) {
    setSending(id);
    setError('');
    try {
      await api.sendOutreachEmail(id);
      setSuccess('Email sent!');
      load();
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Send failed');
    } finally {
      setSending(null);
    }
  }

  async function sendBulk() {
    if (!confirm('Send emails to all READY leads?')) return;
    setBulkSending(true);
    setError('');
    try {
      const result = await api.sendOutreachBulk();
      setSuccess(`Sent: ${result.sent}, Failed: ${result.failed}`);
      load();
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Bulk send failed');
    } finally {
      setBulkSending(false);
    }
  }

  async function generateEmail(id: string) {
    setGenerating(id);
    setError('');
    try {
      await api.generateOutreachEmail(id);
      setSuccess('Email generated!');
      load();
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Generation failed');
    } finally {
      setGenerating(null);
    }
  }

  async function generateBulk() {
    if (!confirm('Generate emails for all draft leads? This may take a few minutes.')) return;
    setBulkGenerating(true);
    setError('');
    try {
      const result = await api.generateOutreachBulk();
      setSuccess(`Generated: ${result.generated}, Failed: ${result.failed}`);
      load();
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Bulk generation failed');
    } finally {
      setBulkGenerating(false);
    }
  }

  async function handleImport() {
    try {
      const parsed = JSON.parse(importJson);
      const arr = Array.isArray(parsed) ? parsed : [parsed];
      const result = await api.importOutreachLeads(arr);
      setSuccess(`Imported ${result.added} leads`);
      setShowImport(false);
      setImportJson('');
      load();
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Invalid JSON');
    }
  }

  const filtered = filter === 'all' ? leads : leads.filter(l => l.status === filter);
  const draftCount = leads.filter(l => l.status === 'draft').length;
  const readyCount = leads.filter(l => l.status === 'ready').length;
  const sentCount = leads.filter(l => l.status === 'sent').length;
  const repliedCount = leads.filter(l => l.status === 'replied').length;

  if (loading) return <div style={{ padding: 40, color: '#5a5040' }}>Loading...</div>;

  return (
    <div style={{ maxWidth: 1100 }}>
      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 24 }}>
        <div>
          <h1 style={{ fontSize: 22, fontWeight: 700, color: '#1a3a1a', margin: 0 }}>Outreach</h1>
          <p style={{ fontSize: 13, color: '#5a5040', marginTop: 4 }}>
            {leads.length} leads | {readyCount} ready | {sentCount} sent | {repliedCount} replied
          </p>
        </div>
        <div style={{ display: 'flex', gap: 8 }}>
          <button onClick={() => setShowImport(true)} style={btnStyle('#f5f2eb', '#1a3a1a', '#c4b59a')}>
            Import JSON
          </button>
          <button onClick={() => setShowAdd(true)} style={btnStyle('#f5f2eb', '#1a3a1a', '#c4b59a')}>
            + Add Lead
          </button>
          {draftCount > 0 && (
            <button
              onClick={generateBulk}
              disabled={bulkGenerating}
              style={btnStyle(bulkGenerating ? '#c4b59a' : '#4a7c59', '#fff', 'transparent')}
            >
              {bulkGenerating ? 'Generating...' : `Generate All Drafts (${draftCount})`}
            </button>
          )}
          {readyCount > 0 && smtpOk && (
            <button
              onClick={sendBulk}
              disabled={bulkSending}
              style={btnStyle(bulkSending ? '#c4b59a' : '#e07850', '#fff', 'transparent')}
            >
              {bulkSending ? 'Sending...' : `Send All Ready (${readyCount})`}
            </button>
          )}
        </div>
      </div>

      {/* SMTP Status */}
      <div style={{
        padding: '10px 14px',
        marginBottom: 16,
        borderRadius: 8,
        fontSize: 13,
        backgroundColor: smtpOk ? '#d4e8d4' : '#f0d0d0',
        color: smtpOk ? '#1a5a1a' : '#8a2020',
        border: `1px solid ${smtpOk ? '#a0c8a0' : '#d0a0a0'}`,
      }}>
        {smtpOk
          ? `SMTP connected: ${smtpUser}`
          : `SMTP not configured. ${smtpMsg || 'Add SMTP_USER and SMTP_PASS to .env'}`
        }
      </div>

      {/* Alerts */}
      {error && (
        <div style={{ padding: '10px 14px', marginBottom: 12, borderRadius: 8, fontSize: 13, backgroundColor: '#f0d0d0', color: '#8a2020' }}>
          {error} <button onClick={() => setError('')} style={{ float: 'right', background: 'none', border: 'none', cursor: 'pointer', fontWeight: 700 }}>x</button>
        </div>
      )}
      {success && (
        <div style={{ padding: '10px 14px', marginBottom: 12, borderRadius: 8, fontSize: 13, backgroundColor: '#d4e8d4', color: '#1a5a1a' }}>
          {success} <button onClick={() => setSuccess('')} style={{ float: 'right', background: 'none', border: 'none', cursor: 'pointer', fontWeight: 700 }}>x</button>
        </div>
      )}

      {/* Filter tabs */}
      <div style={{ display: 'flex', gap: 6, marginBottom: 16 }}>
        {['all', 'draft', 'ready', 'sent', 'replied', 'bounced'].map(f => (
          <button
            key={f}
            onClick={() => setFilter(f)}
            style={{
              padding: '6px 14px',
              borderRadius: 6,
              fontSize: 12,
              fontWeight: 600,
              textTransform: 'uppercase',
              letterSpacing: '0.04em',
              border: '1px solid #c4b59a',
              backgroundColor: filter === f ? '#1a3a1a' : '#f5f2eb',
              color: filter === f ? '#fff' : '#5a5040',
              cursor: 'pointer',
            }}
          >
            {f} {f !== 'all' ? `(${leads.filter(l => l.status === f).length})` : `(${leads.length})`}
          </button>
        ))}
      </div>

      {/* Leads list */}
      {filtered.length === 0 ? (
        <div style={{ padding: 40, textAlign: 'center', color: '#8a7a6a', fontSize: 14 }}>
          No leads yet. Add one or import from JSON.
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
          {filtered.map(lead => (
            <LeadCard
              key={lead.id}
              lead={lead}
              expanded={editingId === lead.id}
              onToggle={() => setEditingId(editingId === lead.id ? null : lead.id)}
              onUpdate={(data) => updateLead(lead.id, data)}
              onDelete={() => deleteLead(lead.id)}
              onSend={() => sendEmail(lead.id)}
              onGenerate={() => generateEmail(lead.id)}
              sending={sending === lead.id}
              generating={generating === lead.id}
              smtpOk={smtpOk}
            />
          ))}
        </div>
      )}

      {/* Add Lead Modal */}
      {showAdd && <AddLeadModal onAdd={addLead} onClose={() => setShowAdd(false)} />}

      {/* Import Modal */}
      {showImport && (
        <Modal onClose={() => setShowImport(false)} title="Import Leads (JSON)">
          <p style={{ fontSize: 12, color: '#5a5040', marginBottom: 10 }}>
            Paste a JSON array of leads. Each object needs: company, name, role, email. Optional: emailSubject, emailBody, angle, notes.
          </p>
          <textarea
            value={importJson}
            onChange={e => setImportJson(e.target.value)}
            placeholder={'[\n  { "company": "Acme", "name": "John", "role": "CEO", "email": "john@acme.com" }\n]'}
            style={{ width: '100%', minHeight: 200, padding: 12, fontFamily: 'monospace', fontSize: 12, border: '1px solid #c4b59a', borderRadius: 8, resize: 'vertical' }}
          />
          <div style={{ display: 'flex', gap: 8, marginTop: 12, justifyContent: 'flex-end' }}>
            <button onClick={() => setShowImport(false)} style={btnStyle('#f5f2eb', '#1a3a1a', '#c4b59a')}>Cancel</button>
            <button onClick={handleImport} style={btnStyle('#e07850', '#fff', 'transparent')}>Import</button>
          </div>
        </Modal>
      )}
    </div>
  );
}

function LeadCard({
  lead, expanded, onToggle, onUpdate, onDelete, onSend, onGenerate, sending, generating, smtpOk,
}: {
  lead: OutreachLead;
  expanded: boolean;
  onToggle: () => void;
  onUpdate: (data: Partial<OutreachLead>) => void;
  onDelete: () => void;
  onSend: () => void;
  onGenerate: () => void;
  sending: boolean;
  generating: boolean;
  smtpOk: boolean;
}) {
  const [subject, setSubject] = useState(lead.emailSubject);
  const [body, setBody] = useState(lead.emailBody);
  const [notes, setNotes] = useState(lead.notes);
  const statusColor = STATUS_COLORS[lead.status] || STATUS_COLORS.draft;
  const canSend = smtpOk && lead.email && lead.emailSubject && lead.emailBody && lead.status !== 'sent';

  function saveEmail() {
    const status = (subject && body) ? 'ready' : 'draft';
    onUpdate({ emailSubject: subject, emailBody: body, notes, status });
  }

  return (
    <div style={{
      border: '1px solid #c4b59a',
      borderRadius: 8,
      backgroundColor: '#fff',
      overflow: 'hidden',
    }}>
      {/* Summary row */}
      <div
        onClick={onToggle}
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: 12,
          padding: '12px 16px',
          cursor: 'pointer',
          backgroundColor: expanded ? '#faf8f4' : '#fff',
        }}
      >
        <span style={{
          padding: '3px 10px',
          borderRadius: 4,
          fontSize: 11,
          fontWeight: 700,
          textTransform: 'uppercase',
          letterSpacing: '0.06em',
          backgroundColor: statusColor.bg,
          color: statusColor.text,
        }}>
          {lead.status}
        </span>
        <span style={{ fontSize: 14, fontWeight: 600, color: '#1a3a1a', flex: 1 }}>
          {lead.name || 'Unnamed'} <span style={{ fontWeight: 400, color: '#5a5040' }}>at {lead.company || '...'}</span>
        </span>
        <span style={{ fontSize: 12, color: '#8a7a6a' }}>{lead.email}</span>
        {lead.sentAt && (
          <span style={{ fontSize: 11, color: '#5a5040' }}>
            Sent {new Date(lead.sentAt).toLocaleDateString()}
          </span>
        )}
        <span style={{ fontSize: 16, color: '#8a7a6a' }}>{expanded ? '\u25B2' : '\u25BC'}</span>
      </div>

      {/* Expanded editor */}
      {expanded && (
        <div style={{ padding: '16px', borderTop: '1px solid #e8e0d0' }}>
          {/* Lead info row */}
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr 1fr', gap: 10, marginBottom: 14 }}>
            <FieldInput label="Name" value={lead.name} onChange={v => onUpdate({ name: v })} />
            <FieldInput label="Company" value={lead.company} onChange={v => onUpdate({ company: v })} />
            <FieldInput label="Role" value={lead.role} onChange={v => onUpdate({ role: v })} />
            <FieldInput label="Email" value={lead.email} onChange={v => onUpdate({ email: v })} />
          </div>

          {/* Angle */}
          <div style={{ marginBottom: 14 }}>
            <label style={labelStyle}>Pitch Angle</label>
            <input
              value={lead.angle}
              onChange={e => onUpdate({ angle: e.target.value })}
              style={inputStyle}
              placeholder="Why SafeStreets fits this company..."
            />
          </div>

          {/* Email subject */}
          <div style={{ marginBottom: 10 }}>
            <label style={labelStyle}>Subject</label>
            <input
              value={subject}
              onChange={e => setSubject(e.target.value)}
              onBlur={saveEmail}
              style={{ ...inputStyle, fontWeight: 600 }}
              placeholder="Email subject line..."
            />
          </div>

          {/* Email body */}
          <div style={{ marginBottom: 10 }}>
            <label style={labelStyle}>Email Body</label>
            <textarea
              value={body}
              onChange={e => setBody(e.target.value)}
              onBlur={saveEmail}
              style={{ ...inputStyle, minHeight: 280, fontFamily: "'DM Sans', sans-serif", lineHeight: 1.6, resize: 'vertical' }}
              placeholder="Write or paste your email here..."
            />
          </div>

          {/* Notes */}
          <div style={{ marginBottom: 14 }}>
            <label style={labelStyle}>Notes (internal)</label>
            <textarea
              value={notes}
              onChange={e => setNotes(e.target.value)}
              onBlur={() => onUpdate({ notes })}
              style={{ ...inputStyle, minHeight: 60, resize: 'vertical' }}
              placeholder="Research notes, follow-up reminders..."
            />
          </div>

          {/* Actions */}
          <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
            {(lead.status === 'draft' || !lead.emailBody) && (
              <button
                onClick={onGenerate}
                disabled={generating}
                style={btnStyle(generating ? '#c4b59a' : '#4a7c59', '#fff', 'transparent')}
              >
                {generating ? 'Researching & Writing...' : 'Generate Email'}
              </button>
            )}
            {canSend && (
              <button
                onClick={onSend}
                disabled={sending}
                style={btnStyle(sending ? '#c4b59a' : '#e07850', '#fff', 'transparent')}
              >
                {sending ? 'Sending...' : 'Send Email'}
              </button>
            )}
            {lead.status === 'sent' && (
              <button
                onClick={() => onUpdate({ status: 'replied' })}
                style={btnStyle('#1a7a28', '#fff', 'transparent')}
              >
                Mark Replied
              </button>
            )}
            {lead.status === 'sent' && (
              <button
                onClick={() => onUpdate({ status: 'bounced' })}
                style={btnStyle('#f5f2eb', '#8a2020', '#d0a0a0')}
              >
                Mark Bounced
              </button>
            )}
            <div style={{ flex: 1 }} />
            <button onClick={onDelete} style={{ ...btnStyle('#f5f2eb', '#8a2020', '#d0a0a0'), fontSize: 12 }}>
              Delete
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

function FieldInput({ label, value, onChange }: { label: string; value: string; onChange: (v: string) => void }) {
  return (
    <div>
      <label style={labelStyle}>{label}</label>
      <input value={value} onChange={e => onChange(e.target.value)} style={inputStyle} />
    </div>
  );
}

function AddLeadModal({ onAdd, onClose }: { onAdd: (lead: Partial<OutreachLead>) => void; onClose: () => void }) {
  const [company, setCompany] = useState('');
  const [name, setName] = useState('');
  const [role, setRole] = useState('');
  const [email, setEmail] = useState('');
  const [angle, setAngle] = useState('');

  return (
    <Modal onClose={onClose} title="Add Lead">
      <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
        <div>
          <label style={labelStyle}>Company</label>
          <input value={company} onChange={e => setCompany(e.target.value)} style={inputStyle} />
        </div>
        <div>
          <label style={labelStyle}>Name</label>
          <input value={name} onChange={e => setName(e.target.value)} style={inputStyle} />
        </div>
        <div>
          <label style={labelStyle}>Role</label>
          <input value={role} onChange={e => setRole(e.target.value)} style={inputStyle} />
        </div>
        <div>
          <label style={labelStyle}>Email</label>
          <input value={email} onChange={e => setEmail(e.target.value)} style={inputStyle} type="email" />
        </div>
        <div>
          <label style={labelStyle}>Pitch Angle</label>
          <input value={angle} onChange={e => setAngle(e.target.value)} style={inputStyle} placeholder="Why SafeStreets fits them..." />
        </div>
        <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end', marginTop: 8 }}>
          <button onClick={onClose} style={btnStyle('#f5f2eb', '#1a3a1a', '#c4b59a')}>Cancel</button>
          <button
            onClick={() => onAdd({ company, name, role, email, angle })}
            disabled={!company || !name || !email}
            style={btnStyle(!company || !name || !email ? '#c4b59a' : '#e07850', '#fff', 'transparent')}
          >
            Add
          </button>
        </div>
      </div>
    </Modal>
  );
}

function Modal({ children, onClose, title }: { children: React.ReactNode; onClose: () => void; title: string }) {
  return (
    <div style={{
      position: 'fixed', inset: 0, zIndex: 50,
      display: 'flex', alignItems: 'center', justifyContent: 'center',
      backgroundColor: 'rgba(0,0,0,0.4)',
    }} onClick={onClose}>
      <div
        onClick={e => e.stopPropagation()}
        style={{
          width: '100%', maxWidth: 520, backgroundColor: '#fff',
          borderRadius: 12, border: '1px solid #c4b59a', padding: 24,
        }}
      >
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
          <h2 style={{ fontSize: 16, fontWeight: 700, color: '#1a3a1a', margin: 0 }}>{title}</h2>
          <button onClick={onClose} style={{ background: 'none', border: 'none', fontSize: 18, cursor: 'pointer', color: '#8a7a6a' }}>x</button>
        </div>
        {children}
      </div>
    </div>
  );
}

const labelStyle: React.CSSProperties = {
  display: 'block', fontSize: 11, fontWeight: 600, textTransform: 'uppercase',
  letterSpacing: '0.06em', color: '#5a5040', marginBottom: 4,
};

const inputStyle: React.CSSProperties = {
  width: '100%', padding: '8px 10px', fontSize: 13, border: '1px solid #c4b59a',
  borderRadius: 6, backgroundColor: '#faf8f4', color: '#1a3a1a',
};

function btnStyle(bg: string, color: string, border: string): React.CSSProperties {
  return {
    padding: '8px 16px', fontSize: 13, fontWeight: 600, borderRadius: 6,
    backgroundColor: bg, color, border: border ? `1px solid ${border}` : 'none',
    cursor: 'pointer',
  };
}
