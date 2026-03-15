import { useState, useEffect, useRef } from 'react';
import { useAdminApi } from './adminApi';

const STAGES = ['New', 'In Discussion', 'Proposal Sent', 'Won', 'Lost'] as const;
type Stage = typeof STAGES[number];

const LEAD_TYPES = ['Municipality', 'Community Group', 'Corporate CSR', 'Other'] as const;
const SERVICE_TYPES = [
  'Street Audit',
  'Research & Report',
  'Custom Dashboard & Tools',
  'Enterprise Platform',
  'CSR Pilot',
  'Advisory',
] as const;
const SOURCES = ['Inbound', 'Outbound', 'Referral', 'Conference', 'Social', 'Other'] as const;

interface Lead {
  id: string;
  name: string;
  org: string;
  email: string;
  phone: string;
  type: string;
  service: string;
  stage: Stage;
  value: number | null;
  source: string;
  notes: string;
  nextAction: string;
  lastContacted: string; // ISO date
  createdAt: string;
}

const STAGE_COLORS: Record<Stage, { bg: string; text: string; dot: string }> = {
  New:            { bg: '#eff6ff', text: '#1d4ed8', dot: '#3b82f6' },
  'In Discussion':{ bg: '#fefce8', text: '#854d0e', dot: '#eab308' },
  'Proposal Sent':{ bg: '#fff7ed', text: '#9a3412', dot: '#f97316' },
  Won:            { bg: '#f0fdf4', text: '#166534', dot: '#22c55e' },
  Lost:           { bg: '#fef2f2', text: '#991b1b', dot: '#ef4444' },
};

function fmtValue(v: number | null) {
  if (!v) return ' - ';
  return `£${v.toLocaleString()}`;
}

function fmtDate(d: string) {
  if (!d) return ' - ';
  return new Date(d).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: '2-digit' });
}

const emptyLead = (): Omit<Lead, 'id' | 'createdAt'> => ({
  name: '',
  org: '',
  email: '',
  phone: '',
  type: 'Municipality',
  service: 'Street Audit',
  stage: 'New',
  value: null,
  source: 'Inbound',
  notes: '',
  nextAction: '',
  lastContacted: '',
});

// ── Drawer ────────────────────────────────────────────────────────────────────

function LeadDrawer({
  lead,
  onClose,
  onSave,
  onDelete,
}: {
  lead: Lead | null;
  onClose: () => void;
  onSave: (l: Partial<Lead>) => Promise<void>;
  onDelete: (id: string) => Promise<void>;
}) {
  const isNew = !lead?.id;
  const [form, setForm] = useState<Omit<Lead, 'id' | 'createdAt'>>(
    lead ? { ...lead } : emptyLead()
  );
  const [saving, setSaving] = useState(false);
  const [deleting, setDeleting] = useState(false);

  useEffect(() => {
    setForm(lead ? { ...lead } : emptyLead());
  }, [lead]);

  function set<K extends keyof typeof form>(k: K, v: (typeof form)[K]) {
    setForm(prev => ({ ...prev, [k]: v }));
  }

  async function handleSave() {
    setSaving(true);
    try {
      await onSave(isNew ? form : { id: lead!.id, ...form });
    } finally {
      setSaving(false);
    }
  }

  async function handleDelete() {
    if (!lead?.id || !confirm('Delete this lead?')) return;
    setDeleting(true);
    try {
      await onDelete(lead.id);
    } finally {
      setDeleting(false);
    }
  }

  const field = (label: string, node: React.ReactNode) => (
    <div>
      <label className="block text-xs font-semibold text-gray-500 uppercase tracking-wide mb-1">{label}</label>
      {node}
    </div>
  );

  const input = (k: keyof typeof form, type = 'text', ph = '') => (
    <input
      type={type}
      placeholder={ph}
      value={(form[k] as string) ?? ''}
      onChange={e => set(k, e.target.value as any)}
      className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-gray-400"
    />
  );

  const select = (k: keyof typeof form, opts: readonly string[]) => (
    <select
      value={(form[k] as string) ?? ''}
      onChange={e => set(k, e.target.value as any)}
      className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-gray-400 bg-white"
    >
      {opts.map(o => <option key={o}>{o}</option>)}
    </select>
  );

  return (
    <div className="fixed inset-0 z-50 flex" onClick={onClose}>
      <div className="flex-1 bg-black/30" />
      <div
        className="w-full max-w-lg bg-white h-full overflow-y-auto flex flex-col shadow-2xl"
        onClick={e => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-gray-100 sticky top-0 bg-white z-10">
          <h2 className="font-bold text-gray-900">{isNew ? 'New Lead' : form.name || 'Lead'}</h2>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-700 text-xl leading-none">&times;</button>
        </div>

        {/* Form */}
        <div className="flex-1 p-6 space-y-4">
          <div className="grid grid-cols-2 gap-4">
            {field('Contact Name', input('name', 'text', 'Jane Smith'))}
            {field('Organisation', input('org', 'text', 'City Council'))}
          </div>
          <div className="grid grid-cols-2 gap-4">
            {field('Email', input('email', 'email', 'jane@org.com'))}
            {field('Phone', input('phone', 'tel', '+44 7700 000000'))}
          </div>
          <div className="grid grid-cols-2 gap-4">
            {field('Lead Type', select('type', LEAD_TYPES))}
            {field('Service', select('service', SERVICE_TYPES))}
          </div>
          <div className="grid grid-cols-2 gap-4">
            {field('Stage', select('stage', STAGES))}
            {field('Est. Value (£)',
              <input
                type="number"
                placeholder="0"
                value={form.value ?? ''}
                onChange={e => set('value', e.target.value ? Number(e.target.value) : null)}
                className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-gray-400"
              />
            )}
          </div>
          <div className="grid grid-cols-2 gap-4">
            {field('Source', select('source', SOURCES))}
            {field('Last Contacted',
              <input
                type="date"
                value={form.lastContacted?.slice(0, 10) ?? ''}
                onChange={e => set('lastContacted', e.target.value)}
                className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-gray-400"
              />
            )}
          </div>
          {field('Next Action',
            <input
              type="text"
              placeholder="e.g. Send proposal by Friday"
              value={form.nextAction ?? ''}
              onChange={e => set('nextAction', e.target.value)}
              className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-gray-400"
            />
          )}
          {field('Notes',
            <textarea
              rows={4}
              placeholder="Context, history, requirements…"
              value={form.notes ?? ''}
              onChange={e => set('notes', e.target.value)}
              className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-gray-400 resize-none"
            />
          )}
        </div>

        {/* Footer */}
        <div className="px-6 py-4 border-t border-gray-100 flex items-center justify-between gap-3 bg-white sticky bottom-0">
          {!isNew && (
            <button
              onClick={handleDelete}
              disabled={deleting}
              className="text-sm text-red-500 hover:text-red-700 font-medium"
            >
              {deleting ? 'Deleting…' : 'Delete lead'}
            </button>
          )}
          <div className="flex gap-2 ml-auto">
            <button onClick={onClose} className="px-4 py-2 text-sm text-gray-600 hover:text-gray-900">
              Cancel
            </button>
            <button
              onClick={handleSave}
              disabled={saving || !form.name.trim()}
              className="px-5 py-2 text-sm font-semibold text-white rounded-lg disabled:opacity-50"
              style={{ background: '#1a2a1a' }}
            >
              {saving ? 'Saving…' : isNew ? 'Add Lead' : 'Save Changes'}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

// ── Kanban Card ───────────────────────────────────────────────────────────────

function KanbanCard({ lead, onClick }: { lead: Lead; onClick: () => void }) {
  const s = STAGE_COLORS[lead.stage];
  return (
    <button
      onClick={onClick}
      className="w-full text-left bg-white border border-gray-100 rounded-xl p-3.5 shadow-sm hover:shadow-md transition-shadow group"
    >
      <div className="font-semibold text-gray-900 text-sm mb-0.5 group-hover:text-green-800 transition-colors">
        {lead.name}
      </div>
      <div className="text-xs text-gray-400 mb-2">{lead.org}</div>
      <div className="flex items-center justify-between">
        <span className="text-xs px-2 py-0.5 rounded-full font-medium" style={{ background: s.bg, color: s.text }}>
          {lead.service}
        </span>
        {lead.value ? (
          <span className="text-xs font-semibold text-gray-600">{fmtValue(lead.value)}</span>
        ) : null}
      </div>
      {lead.nextAction && (
        <div className="mt-2 text-xs text-amber-700 bg-amber-50 rounded px-2 py-1 truncate">
          → {lead.nextAction}
        </div>
      )}
    </button>
  );
}

// ── Kanban Column ─────────────────────────────────────────────────────────────

function KanbanColumn({
  stage,
  leads,
  onAdd,
  onOpen,
}: {
  stage: Stage;
  leads: Lead[];
  onAdd: () => void;
  onOpen: (l: Lead) => void;
}) {
  const s = STAGE_COLORS[stage];
  const total = leads.reduce((acc, l) => acc + (l.value || 0), 0);

  return (
    <div className="flex-1 min-w-[220px] max-w-[300px] flex flex-col">
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-2">
          <span className="w-2 h-2 rounded-full flex-shrink-0" style={{ background: s.dot }} />
          <span className="text-xs font-bold text-gray-700 uppercase tracking-wide">{stage}</span>
          <span className="text-xs font-semibold text-gray-400 bg-gray-100 rounded-full px-1.5 py-0.5">{leads.length}</span>
        </div>
        {total > 0 && <span className="text-xs text-gray-400">{fmtValue(total)}</span>}
      </div>
      <div className="flex-1 space-y-2.5 min-h-[80px]">
        {leads.map(l => <KanbanCard key={l.id} lead={l} onClick={() => onOpen(l)} />)}
      </div>
      <button
        onClick={onAdd}
        className="mt-3 w-full text-xs text-gray-400 hover:text-gray-700 py-2 border border-dashed border-gray-200 rounded-lg hover:border-gray-400 transition-colors"
      >
        + Add
      </button>
    </div>
  );
}

// ── Table View ────────────────────────────────────────────────────────────────

function TableView({ leads, onOpen }: { leads: Lead[]; onOpen: (l: Lead) => void }) {
  return (
    <div className="overflow-x-auto rounded-xl border border-gray-200">
      <table className="w-full text-sm">
        <thead>
          <tr className="bg-gray-50 border-b border-gray-200">
            {['Name', 'Organisation', 'Type', 'Service', 'Stage', 'Value', 'Last Contacted', 'Next Action'].map(h => (
              <th key={h} className="text-left px-4 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wide whitespace-nowrap">{h}</th>
            ))}
          </tr>
        </thead>
        <tbody>
          {leads.length === 0 && (
            <tr><td colSpan={8} className="px-4 py-8 text-center text-gray-400 text-sm">No leads yet  -  add one to get started.</td></tr>
          )}
          {leads.map(l => {
            const s = STAGE_COLORS[l.stage];
            return (
              <tr
                key={l.id}
                onClick={() => onOpen(l)}
                className="border-b border-gray-100 hover:bg-gray-50 cursor-pointer"
              >
                <td className="px-4 py-3 font-medium text-gray-900">{l.name}</td>
                <td className="px-4 py-3 text-gray-500">{l.org}</td>
                <td className="px-4 py-3 text-gray-500">{l.type}</td>
                <td className="px-4 py-3 text-gray-500">{l.service}</td>
                <td className="px-4 py-3">
                  <span className="px-2 py-0.5 rounded-full text-xs font-semibold whitespace-nowrap" style={{ background: s.bg, color: s.text }}>
                    {l.stage}
                  </span>
                </td>
                <td className="px-4 py-3 text-gray-500 whitespace-nowrap">{fmtValue(l.value)}</td>
                <td className="px-4 py-3 text-gray-400 whitespace-nowrap">{fmtDate(l.lastContacted)}</td>
                <td className="px-4 py-3 text-gray-500 max-w-[200px] truncate">{l.nextAction || ' - '}</td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}

// ── Main CRM ─────────────────────────────────────────────────────────────────

export default function CRM() {
  const { adminFetch } = useAdminApi();
  const [leads, setLeads] = useState<Lead[]>([]);
  const [loading, setLoading] = useState(true);
  const [view, setView] = useState<'kanban' | 'table'>('kanban');
  const [drawerLead, setDrawerLead] = useState<Lead | null | 'new'>(null);
  const [defaultStage, setDefaultStage] = useState<Stage>('New');
  const [search, setSearch] = useState('');
  const [filterStage, setFilterStage] = useState<Stage | 'All'>('All');

  useEffect(() => { load(); }, []);

  async function load() {
    setLoading(true);
    try {
      const data = await adminFetch('/api/admin/crm/leads');
      setLeads(data.leads || []);
    } catch {
      // silent
    } finally {
      setLoading(false);
    }
  }

  async function handleSave(partial: Partial<Lead>) {
    if (partial.id) {
      await adminFetch(`/api/admin/crm/leads/${partial.id}`, { method: 'PUT', body: JSON.stringify(partial) });
    } else {
      await adminFetch('/api/admin/crm/leads', { method: 'POST', body: JSON.stringify(partial) });
    }
    setDrawerLead(null);
    await load();
  }

  async function handleDelete(id: string) {
    await adminFetch(`/api/admin/crm/leads/${id}`, { method: 'DELETE' });
    setDrawerLead(null);
    await load();
  }

  function openNew(stage: Stage = 'New') {
    setDefaultStage(stage);
    setDrawerLead('new');
  }

  const filtered = leads.filter(l => {
    const q = search.toLowerCase();
    const matchQ = !q || l.name.toLowerCase().includes(q) || l.org.toLowerCase().includes(q) || l.email.toLowerCase().includes(q);
    const matchS = filterStage === 'All' || l.stage === filterStage;
    return matchQ && matchS;
  });

  // Summary stats
  const totalValue = leads.filter(l => l.stage !== 'Lost').reduce((a, l) => a + (l.value || 0), 0);
  const won = leads.filter(l => l.stage === 'Won');
  const active = leads.filter(l => !['Won', 'Lost'].includes(l.stage));

  const drawerLeadObj: Lead | null = drawerLead === 'new'
    ? ({ ...emptyLead(), id: '', stage: defaultStage, createdAt: '' } as Lead)
    : drawerLead;

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-start justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Sales CRM</h1>
          <p className="text-sm text-gray-500 mt-0.5">Track leads, proposals, and partnerships</p>
        </div>
        <button
          onClick={() => openNew()}
          className="px-4 py-2 text-sm font-semibold text-white rounded-lg"
          style={{ background: '#1a2a1a' }}
        >
          + New Lead
        </button>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
        {[
          { label: 'Total Leads', value: leads.length },
          { label: 'Active Pipeline', value: active.length },
          { label: 'Won', value: won.length },
          { label: 'Pipeline Value', value: fmtValue(totalValue) },
        ].map(s => (
          <div key={s.label} className="bg-white rounded-xl border border-gray-100 px-4 py-3">
            <div className="text-2xl font-bold text-gray-900">{s.value}</div>
            <div className="text-xs text-gray-400 mt-0.5 font-medium uppercase tracking-wide">{s.label}</div>
          </div>
        ))}
      </div>

      {/* Controls */}
      <div className="flex items-center gap-3 flex-wrap">
        <input
          type="text"
          placeholder="Search leads…"
          value={search}
          onChange={e => setSearch(e.target.value)}
          className="border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-gray-400 w-48"
        />
        <select
          value={filterStage}
          onChange={e => setFilterStage(e.target.value as any)}
          className="border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-gray-400 bg-white"
        >
          <option value="All">All stages</option>
          {STAGES.map(s => <option key={s}>{s}</option>)}
        </select>

        <div className="ml-auto flex rounded-lg border border-gray-200 overflow-hidden">
          {(['kanban', 'table'] as const).map(v => (
            <button
              key={v}
              onClick={() => setView(v)}
              className={`px-4 py-2 text-sm font-medium transition-colors capitalize ${
                view === v ? 'bg-gray-900 text-white' : 'bg-white text-gray-600 hover:bg-gray-50'
              }`}
            >
              {v}
            </button>
          ))}
        </div>
      </div>

      {/* Content */}
      {loading ? (
        <div className="text-sm text-gray-400 py-12 text-center">Loading…</div>
      ) : view === 'kanban' ? (
        <div className="flex gap-4 overflow-x-auto pb-4">
          {STAGES.map(stage => (
            <KanbanColumn
              key={stage}
              stage={stage}
              leads={filtered.filter(l => l.stage === stage)}
              onAdd={() => openNew(stage)}
              onOpen={l => setDrawerLead(l)}
            />
          ))}
        </div>
      ) : (
        <TableView leads={filtered} onOpen={l => setDrawerLead(l)} />
      )}

      {/* Drawer */}
      {drawerLead !== null && (
        <LeadDrawer
          lead={drawerLeadObj}
          onClose={() => setDrawerLead(null)}
          onSave={handleSave}
          onDelete={handleDelete}
        />
      )}
    </div>
  );
}
