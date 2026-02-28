import { useState, useEffect, useMemo } from 'react';
import { fetchLeads, updateLead, addLead, searchAgents, validateEmail, generateReport } from './adminApi';

// ── Types ───────────────────────────────────────────────────────────────────

type OutreachStatus = 'not_started' | 'email_sent' | 'followed_up' | 'responded' | 'converted' | 'lost';

interface QualifiedLead {
  rank: number;
  agentName: string;
  brokerage: string;
  city: string;
  state: string;
  neighborhood: string;
  email: string;
  phone: string;
  website: string;
  sampleListing: string;
  listingPrice: string;
  qualificationNotes: string;
  outreachStatus: OutreachStatus;
  outreachDate?: string;
  responseDate?: string;
  notes?: string;
  emailValid?: 'valid' | 'invalid' | 'placeholder' | 'unchecked';
  activeListings?: string;
}

// ── Constants ───────────────────────────────────────────────────────────────

const STATUS_CONFIG: Record<OutreachStatus, { label: string; bg: string; text: string }> = {
  not_started: { label: 'Not Started', bg: '#f3f4f6', text: '#6b7280' },
  email_sent: { label: 'Email Sent', bg: '#dbeafe', text: '#1d4ed8' },
  followed_up: { label: 'Followed Up', bg: '#fef3c7', text: '#92400e' },
  responded: { label: 'Responded', bg: '#d1fae5', text: '#065f46' },
  converted: { label: 'Converted', bg: '#a7f3d0', text: '#047857' },
  lost: { label: 'Lost', bg: '#fee2e2', text: '#991b1b' },
};

const ALL_STATUSES: OutreachStatus[] = ['not_started', 'email_sent', 'followed_up', 'responded', 'converted', 'lost'];

// ── Email Template ──────────────────────────────────────────────────────────

function generateEmail(lead: QualifiedLead): string {
  const firstName = lead.agentName.split(' ')[0];
  return `Subject: I ran a walkability report for your ${lead.neighborhood} listing

Hi ${firstName},

I came across your listing${lead.sampleListing && !lead.sampleListing.startsWith('Check') ? ` at ${lead.sampleListing}` : ` in ${lead.neighborhood}`} and ran it through our walkability analysis tool. Here's a sample of what your branded report would look like:

https://safestreets.streetsandcommons.com

The report covers 8 walkability metrics (sidewalks, crossings, shade, safety, transit access), 15-minute city scores, crash data, and social indicators — all from NASA satellite imagery and OpenStreetMap. Your name, logo, and contact info on every page. Buyers get data. Sellers see a serious agent.

That's the ready-made product — $99 one-time, unlimited reports, 30 seconds to generate.

But here's why I'm actually reaching out:

We also do custom neighborhood intelligence work. Same satellite and infrastructure data, packaged differently for your workflow — neighborhood comparison sheets for buyer consultations, bulk scoring for your listing pipeline, area intelligence reports for a zip code, or buyer-facing briefs that highlight what matters most (school access, shade, night safety).

If you have a specific way you use neighborhood data to win clients, we can probably build a tool around it.

Would it be worth a 15-minute call to see if there's a fit? Either way, 3 free trial reports are yours to test the standard product:

https://safestreets.streetsandcommons.com/enterprise/real-estate

Best,
Sarath
Streets & Commons — safestreets.streetsandcommons.com`;
}


// ── Agent Search Links ──────────────────────────────────────────────────────

function getAgentSearchLinks(lead: QualifiedLead) {
  const name = encodeURIComponent(lead.agentName);
  const citySlug = lead.city.toLowerCase().replace(/\s+/g, '-');
  const stateSlug = lead.state.toLowerCase();
  return {
    zillow: `https://www.zillow.com/${citySlug}-${stateSlug}/real-estate-agent-reviews/?name=${name}`,
    realtor: `https://www.realtor.com/realestateagents/${citySlug}_${stateSlug}/${lead.agentName.toLowerCase().replace(/\s+/g, '-')}`,
    redfin: `https://www.redfin.com/real-estate-agents/${citySlug}-${stateSlug}?q=${name}`,
  };
}

// ── Component ───────────────────────────────────────────────────────────────

export default function SalesPipeline() {
  const [leads, setLeads] = useState<QualifiedLead[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState<number | null>(null);

  // Filters
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState<OutreachStatus | 'all'>('all');
  const [cityFilter, setCityFilter] = useState('all');

  // Expanded row
  const [expandedRank, setExpandedRank] = useState<number | null>(null);

  // Modals
  const [showAddModal, setShowAddModal] = useState(false);
  const [showFindModal, setShowFindModal] = useState(false);
  const [emailModalLead, setEmailModalLead] = useState<QualifiedLead | null>(null);
  const [copySuccess, setCopySuccess] = useState(false);
  const [validating, setValidating] = useState<Set<number>>(new Set());
  const [validatingAll, setValidatingAll] = useState(false);
  const [generatingReport, setGeneratingReport] = useState<number | null>(null);

  // Load leads
  useEffect(() => {
    const load = async () => {
      try {
        const data = await fetchLeads();
        setLeads(data.leads || []);
        setError(null);
      } catch (err) {
        setError((err as Error).message);
      } finally {
        setLoading(false);
      }
    };
    load();
  }, []);

  // Derived data
  const cities = useMemo(() => {
    const set = new Set(leads.map(l => l.city));
    return Array.from(set).sort();
  }, [leads]);

  const filtered = useMemo(() => {
    return leads.filter(l => {
      if (statusFilter !== 'all' && l.outreachStatus !== statusFilter) return false;
      if (cityFilter !== 'all' && l.city !== cityFilter) return false;
      if (search) {
        const q = search.toLowerCase();
        return (
          l.agentName.toLowerCase().includes(q) ||
          l.city.toLowerCase().includes(q) ||
          l.brokerage.toLowerCase().includes(q) ||
          l.neighborhood.toLowerCase().includes(q)
        );
      }
      return true;
    });
  }, [leads, statusFilter, cityFilter, search]);

  const stats = useMemo(() => ({
    total: leads.length,
    not_started: leads.filter(l => l.outreachStatus === 'not_started').length,
    email_sent: leads.filter(l => l.outreachStatus === 'email_sent').length,
    responded: leads.filter(l => l.outreachStatus === 'responded' || l.outreachStatus === 'followed_up').length,
    converted: leads.filter(l => l.outreachStatus === 'converted').length,
    validEmails: leads.filter(l => l.email && l.email.includes('@')).length,
  }), [leads]);

  // Handlers
  const handleStatusChange = async (rank: number, status: OutreachStatus) => {
    setSaving(rank);
    try {
      const updates: Record<string, unknown> = { outreachStatus: status };
      if (status === 'email_sent' && !leads.find(l => l.rank === rank)?.outreachDate) {
        updates.outreachDate = new Date().toISOString().slice(0, 10);
      }
      if (status === 'responded' && !leads.find(l => l.rank === rank)?.responseDate) {
        updates.responseDate = new Date().toISOString().slice(0, 10);
      }
      const updated = await updateLead(rank, updates);
      setLeads(prev => prev.map(l => l.rank === rank ? { ...l, ...updated } : l));
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setSaving(null);
    }
  };

  const handleNotesChange = async (rank: number, notes: string) => {
    try {
      await updateLead(rank, { notes });
      setLeads(prev => prev.map(l => l.rank === rank ? { ...l, notes } : l));
    } catch (err) {
      setError((err as Error).message);
    }
  };

  const handleAddLead = async (formData: Record<string, string>) => {
    try {
      const newLead = await addLead(formData);
      setLeads(prev => [...prev, newLead]);
      setShowAddModal(false);
    } catch (err) {
      setError((err as Error).message);
    }
  };

  const handleCopyEmail = (text: string) => {
    navigator.clipboard.writeText(text);
    setCopySuccess(true);
    setTimeout(() => setCopySuccess(false), 2000);
  };

  const handleExportCSV = () => {
    const header = 'Rank,Agent,Brokerage,City,State,Neighborhood,Email,Phone,Website,Listing,Price,Status,Notes';
    const rows = leads.map(l =>
      `${l.rank},"${l.agentName}","${l.brokerage}","${l.city}","${l.state}","${l.neighborhood}","${l.email}","${l.phone}","${l.website}","${l.sampleListing}","${l.listingPrice}","${l.outreachStatus}","${(l.notes || '').replace(/"/g, '""')}"`
    );
    const csv = [header, ...rows].join('\n');
    const blob = new Blob([csv], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `safestreets-leads-${new Date().toISOString().slice(0, 10)}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const handleValidateEmail = async (lead: QualifiedLead) => {
    setValidating(prev => new Set(prev).add(lead.rank));
    try {
      const result = await validateEmail(lead.email);
      const emailValid = result.status as QualifiedLead['emailValid'];
      await updateLead(lead.rank, { emailValid });
      setLeads(prev => prev.map(l => l.rank === lead.rank ? { ...l, emailValid } : l));
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setValidating(prev => { const next = new Set(prev); next.delete(lead.rank); return next; });
    }
  };

  const handleValidateAll = async () => {
    setValidatingAll(true);
    for (const lead of leads) {
      if (lead.emailValid && lead.emailValid !== 'unchecked') continue;
      await handleValidateEmail(lead);
    }
    setValidatingAll(false);
  };

  const handleActiveListingsChange = async (rank: number, activeListings: string) => {
    try {
      await updateLead(rank, { activeListings });
      setLeads(prev => prev.map(l => l.rank === rank ? { ...l, activeListings } : l));
    } catch (err) {
      setError((err as Error).message);
    }
  };

  const handleGenerateReport = async (lead: QualifiedLead) => {
    setGeneratingReport(lead.rank);
    try {
      const reportData = await generateReport({
        neighborhood: lead.neighborhood,
        city: lead.city,
        state: lead.state,
        agentProfile: {
          name: lead.agentName,
          company: lead.brokerage || undefined,
          email: lead.email.startsWith('Check') ? undefined : lead.email,
          phone: lead.phone.startsWith('Check') ? undefined : lead.phone,
        },
      });
      // Store in sessionStorage and open the report view
      sessionStorage.setItem('agentReportData', JSON.stringify(reportData));
      window.open('/report/agent', '_blank');
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setGeneratingReport(null);
    }
  };

  // ── Render ──────────────────────────────────────────────────────────────

  if (loading) return <div className="text-gray-500">Loading pipeline...</div>;

  return (
    <div>
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold" style={{ color: '#2a3a2a' }}>Sales Pipeline</h1>
          <p className="text-sm text-gray-500 mt-1">Real estate agent outreach for Pro tier</p>
        </div>
        <div className="flex items-center gap-3">
          <button
            onClick={handleValidateAll}
            disabled={validatingAll}
            className="px-4 py-2 rounded-lg text-sm font-medium border border-gray-200 bg-white hover:bg-gray-50 transition disabled:opacity-50"
            style={{ color: '#2a3a2a' }}
          >
            {validatingAll ? 'Validating...' : 'Validate Emails'}
          </button>
          <button
            onClick={handleExportCSV}
            className="px-4 py-2 rounded-lg text-sm font-medium border border-gray-200 bg-white hover:bg-gray-50 transition"
            style={{ color: '#2a3a2a' }}
          >
            Export CSV
          </button>
          <button
            onClick={() => setShowFindModal(true)}
            className="px-4 py-2 rounded-lg text-sm font-semibold text-white transition hover:opacity-90"
            style={{ backgroundColor: '#1e3a5f' }}
          >
            Find Agents
          </button>
          <button
            onClick={() => setShowAddModal(true)}
            className="px-4 py-2 rounded-lg text-sm font-semibold text-white transition hover:opacity-90"
            style={{ backgroundColor: '#e07850' }}
          >
            + Add Lead
          </button>
        </div>
      </div>

      {error && (
        <div className="mb-4 p-3 rounded-lg bg-red-50 border border-red-200 text-red-700 text-sm">
          {error}
          <button onClick={() => setError(null)} className="ml-2 font-bold">×</button>
        </div>
      )}

      {/* Stats Cards */}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-4 mb-6">
        {[
          { label: 'Total Leads', value: stats.total, color: '#2a3a2a' },
          { label: 'Valid Emails', value: stats.validEmails, color: '#059669' },
          { label: 'Not Started', value: stats.not_started, color: '#6b7280' },
          { label: 'Email Sent', value: stats.email_sent, color: '#1d4ed8' },
          { label: 'Responded', value: stats.responded, color: '#065f46' },
          { label: 'Converted', value: stats.converted, color: '#047857' },
        ].map(s => (
          <div key={s.label} className="bg-white rounded-xl p-4 shadow-sm border border-gray-100">
            <div className="text-2xl font-bold" style={{ color: s.color }}>{s.value}</div>
            <div className="text-xs text-gray-500 mt-1">{s.label}</div>
          </div>
        ))}
      </div>

      {/* Filters */}
      <div className="flex flex-wrap items-center gap-3 mb-4">
        <input
          type="text"
          placeholder="Search agents, cities, brokerages..."
          value={search}
          onChange={e => setSearch(e.target.value)}
          className="px-3 py-2 border border-gray-200 rounded-lg text-sm flex-1 min-w-[200px] focus:ring-2 focus:ring-orange-300 focus:outline-none"
        />
        <select
          value={statusFilter}
          onChange={e => setStatusFilter(e.target.value as OutreachStatus | 'all')}
          className="px-3 py-2 border border-gray-200 rounded-lg text-sm bg-white"
        >
          <option value="all">All Statuses</option>
          {ALL_STATUSES.map(s => (
            <option key={s} value={s}>{STATUS_CONFIG[s].label}</option>
          ))}
        </select>
        <select
          value={cityFilter}
          onChange={e => setCityFilter(e.target.value)}
          className="px-3 py-2 border border-gray-200 rounded-lg text-sm bg-white"
        >
          <option value="all">All Cities</option>
          {cities.map(c => (
            <option key={c} value={c}>{c}</option>
          ))}
        </select>
        <span className="text-xs text-gray-400">{filtered.length} of {leads.length} leads</span>
      </div>

      {/* Leads Table */}
      <div className="bg-white rounded-xl shadow-sm overflow-hidden border border-gray-100">
        <table className="w-full">
          <thead>
            <tr className="border-b border-gray-200 text-left">
              <th className="px-4 py-3 text-xs font-semibold text-gray-500 uppercase w-10">#</th>
              <th className="px-4 py-3 text-xs font-semibold text-gray-500 uppercase">Agent</th>
              <th className="px-4 py-3 text-xs font-semibold text-gray-500 uppercase hidden md:table-cell">Location</th>
              <th className="px-4 py-3 text-xs font-semibold text-gray-500 uppercase hidden lg:table-cell">Brokerage</th>
              <th className="px-4 py-3 text-xs font-semibold text-gray-500 uppercase hidden xl:table-cell">Listing</th>
              <th className="px-4 py-3 text-xs font-semibold text-gray-500 uppercase">Status</th>
              <th className="px-4 py-3 text-xs font-semibold text-gray-500 uppercase w-32">Actions</th>
            </tr>
          </thead>
          <tbody>
            {filtered.map(lead => (
              <LeadRow
                key={lead.rank}
                lead={lead}
                expanded={expandedRank === lead.rank}
                saving={saving === lead.rank}
                isValidating={validating.has(lead.rank)}
                onToggle={() => setExpandedRank(expandedRank === lead.rank ? null : lead.rank)}
                onStatusChange={handleStatusChange}
                onNotesChange={handleNotesChange}
                onGenerateEmail={() => setEmailModalLead(lead)}
                onValidateEmail={() => handleValidateEmail(lead)}
                onActiveListingsChange={handleActiveListingsChange}
                onGenerateReport={() => handleGenerateReport(lead)}
                isGeneratingReport={generatingReport === lead.rank}
              />
            ))}
          </tbody>
        </table>
        {filtered.length === 0 && (
          <div className="text-center py-12 text-gray-400">
            {leads.length === 0 ? 'No leads yet. Click "Add Lead" to get started.' : 'No leads match your filters.'}
          </div>
        )}
      </div>

      {/* Find Agents Modal */}
      {showFindModal && (
        <FindAgentsModal
          onClose={() => setShowFindModal(false)}
          onAddAgent={async (agent) => {
            try {
              const newLead = await addLead(agent);
              setLeads(prev => [...prev, newLead]);
            } catch (err) {
              setError((err as Error).message);
            }
          }}
        />
      )}

      {/* Add Lead Modal */}
      {showAddModal && (
        <AddLeadModal
          onClose={() => setShowAddModal(false)}
          onAdd={handleAddLead}
        />
      )}

      {/* Email Modal */}
      {emailModalLead && (
        <div className="fixed inset-0 bg-black/40 z-50 flex items-center justify-center p-4 overflow-y-auto">
          <div className="bg-white rounded-2xl max-w-2xl w-full p-6 relative my-8">
            <button
              onClick={() => { setEmailModalLead(null); setCopySuccess(false); }}
              className="absolute top-4 right-4 text-gray-400 hover:text-gray-600 text-xl"
            >×</button>
            <h2 className="text-lg font-bold mb-1" style={{ color: '#2a3a2a' }}>
              Email for {emailModalLead.agentName}
            </h2>
            <p className="text-xs text-gray-500 mb-4">
              {emailModalLead.email.startsWith('Check') ? (
                <span className="text-amber-600">⚠ Email not verified — check their website first</span>
              ) : (
                <>To: {emailModalLead.email}</>
              )}
            </p>
            <pre className="bg-gray-50 rounded-xl p-4 text-sm whitespace-pre-wrap font-sans leading-relaxed border border-gray-200 max-h-[60vh] overflow-y-auto">
              {generateEmail(emailModalLead)}
            </pre>
            <div className="flex items-center gap-3 mt-4">
              <button
                onClick={() => handleCopyEmail(generateEmail(emailModalLead))}
                className="px-4 py-2 rounded-lg text-sm font-semibold text-white transition hover:opacity-90"
                style={{ backgroundColor: '#e07850' }}
              >
                {copySuccess ? '✓ Copied!' : 'Copy to Clipboard'}
              </button>
              {!emailModalLead.email.startsWith('Check') && (
                <a
                  href={`mailto:${emailModalLead.email}?subject=${encodeURIComponent(`Walkability data for your ${emailModalLead.neighborhood} listing`)}&body=${encodeURIComponent(generateEmail(emailModalLead).split('\n').slice(2).join('\n'))}`}
                  className="px-4 py-2 rounded-lg text-sm font-medium border border-gray-200 bg-white hover:bg-gray-50 transition"
                  style={{ color: '#2a3a2a' }}
                >
                  Open in Mail
                </a>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

// ── Lead Row Component ──────────────────────────────────────────────────────

function LeadRow({
  lead,
  expanded,
  saving,
  isValidating,
  onToggle,
  onStatusChange,
  onNotesChange,
  onGenerateEmail,
  onValidateEmail,
  onActiveListingsChange,
  onGenerateReport,
  isGeneratingReport,
}: {
  lead: QualifiedLead;
  expanded: boolean;
  saving: boolean;
  isValidating: boolean;
  onToggle: () => void;
  onStatusChange: (rank: number, status: OutreachStatus) => void;
  onNotesChange: (rank: number, notes: string) => void;
  onGenerateEmail: () => void;
  onValidateEmail: () => void;
  onActiveListingsChange: (rank: number, activeListings: string) => void;
  onGenerateReport: () => void;
  isGeneratingReport: boolean;
}) {
  const [editingNotes, setEditingNotes] = useState(false);
  const [notesValue, setNotesValue] = useState(lead.notes || '');
  const [editingListings, setEditingListings] = useState(false);
  const [listingsValue, setListingsValue] = useState(lead.activeListings || '');
  const [showStatusDropdown, setShowStatusDropdown] = useState(false);

  const statusCfg = STATUS_CONFIG[lead.outreachStatus];

  return (
    <>
      <tr
        className="border-b border-gray-100 hover:bg-gray-50 cursor-pointer transition"
        onClick={onToggle}
      >
        <td className="px-4 py-3 text-sm text-gray-400 font-mono">{lead.rank}</td>
        <td className="px-4 py-3">
          <div className="flex items-center gap-1.5">
            <span className="text-sm font-semibold" style={{ color: '#2a3a2a' }}>{lead.agentName}</span>
            {lead.emailValid === 'valid' && <span className="w-2 h-2 rounded-full bg-green-500 inline-block flex-shrink-0" title="Email valid" />}
            {lead.emailValid === 'invalid' && <span className="w-2 h-2 rounded-full bg-red-500 inline-block flex-shrink-0" title="Email invalid" />}
            {lead.emailValid === 'placeholder' && <span className="w-2 h-2 rounded-full bg-amber-400 inline-block flex-shrink-0" title="Placeholder email" />}
            {isValidating && <span className="w-2 h-2 rounded-full bg-blue-400 animate-pulse inline-block flex-shrink-0" title="Validating..." />}
          </div>
          <div className="text-xs text-gray-500 md:hidden">{lead.city}, {lead.state} · {lead.neighborhood}</div>
        </td>
        <td className="px-4 py-3 hidden md:table-cell">
          <div className="text-sm" style={{ color: '#2a3a2a' }}>{lead.city}, {lead.state}</div>
          <div className="text-xs text-gray-400">{lead.neighborhood}</div>
        </td>
        <td className="px-4 py-3 text-sm text-gray-600 hidden lg:table-cell">{lead.brokerage}</td>
        <td className="px-4 py-3 hidden xl:table-cell">
          <div className="text-sm text-gray-700 truncate max-w-[200px]">{lead.sampleListing || '—'}</div>
          <div className="text-xs text-gray-400">{lead.listingPrice || ''}</div>
        </td>
        <td className="px-4 py-3 relative">
          <button
            onClick={e => { e.stopPropagation(); setShowStatusDropdown(!showStatusDropdown); }}
            className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-medium transition"
            style={{ backgroundColor: statusCfg.bg, color: statusCfg.text, opacity: saving ? 0.5 : 1 }}
          >
            {statusCfg.label}
            <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
            </svg>
          </button>
          {showStatusDropdown && (
            <div className="absolute z-20 mt-1 bg-white rounded-lg shadow-lg border border-gray-200 py-1 min-w-[140px]">
              {ALL_STATUSES.map(s => (
                <button
                  key={s}
                  onClick={e => {
                    e.stopPropagation();
                    onStatusChange(lead.rank, s);
                    setShowStatusDropdown(false);
                  }}
                  className="block w-full text-left px-3 py-1.5 text-xs hover:bg-gray-50 transition"
                  style={{ color: STATUS_CONFIG[s].text }}
                >
                  {STATUS_CONFIG[s].label}
                </button>
              ))}
            </div>
          )}
        </td>
        <td className="px-4 py-3">
          <div className="flex items-center gap-1.5">
            <button
              onClick={e => { e.stopPropagation(); onGenerateEmail(); }}
              className="text-xs font-medium px-2.5 py-1 rounded-lg border border-gray-200 hover:bg-gray-50 transition"
              style={{ color: '#e07850' }}
            >
              Email
            </button>
            <button
              onClick={e => { e.stopPropagation(); onGenerateReport(); }}
              disabled={isGeneratingReport}
              className="text-xs font-medium px-2.5 py-1 rounded-lg border border-gray-200 hover:bg-gray-50 transition disabled:opacity-50"
              style={{ color: '#1e3a5f' }}
            >
              {isGeneratingReport ? 'Generating...' : 'Report'}
            </button>
          </div>
        </td>
      </tr>
      {expanded && (
        <tr className="bg-gray-50/50">
          <td colSpan={7} className="px-4 py-4">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {/* Contact Info */}
              <div className="space-y-2">
                <h4 className="text-xs font-semibold text-gray-500 uppercase">Contact</h4>
                <div className="text-sm">
                  <div className="flex items-center gap-2 mb-1">
                    <span className="text-gray-400">📧</span>
                    {lead.emailValid === 'valid' && <span className="text-green-600 text-xs" title="MX records found">✓</span>}
                    {lead.emailValid === 'invalid' && <span className="text-red-600 text-xs" title="No MX records">✗</span>}
                    {lead.emailValid === 'placeholder' && <span className="text-amber-500 text-xs" title="Placeholder">⚠</span>}
                    {lead.email.startsWith('Check') ? (
                      <span className="text-amber-600 text-xs">{lead.email}</span>
                    ) : (
                      <a href={`mailto:${lead.email}`} className="text-blue-600 hover:underline">{lead.email}</a>
                    )}
                    {(!lead.emailValid || lead.emailValid === 'unchecked') && !lead.email.startsWith('Check') && (
                      <button
                        onClick={e => { e.stopPropagation(); onValidateEmail(); }}
                        disabled={isValidating}
                        className="text-xs text-blue-600 hover:underline ml-1 disabled:opacity-50"
                      >
                        {isValidating ? 'Checking...' : 'Validate'}
                      </button>
                    )}
                  </div>
                  <div className="flex items-center gap-2 mb-1">
                    <span className="text-gray-400">📞</span>
                    {lead.phone.startsWith('Check') ? (
                      <span className="text-amber-600 text-xs">{lead.phone}</span>
                    ) : (
                      <a href={`tel:${lead.phone}`} className="text-blue-600 hover:underline">{lead.phone}</a>
                    )}
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="text-gray-400">🌐</span>
                    <a href={lead.website} target="_blank" rel="noreferrer" className="text-blue-600 hover:underline text-xs truncate max-w-[250px]">
                      {lead.website}
                    </a>
                  </div>
                </div>
              </div>

              {/* Listings & Search */}
              <div className="space-y-2">
                <h4 className="text-xs font-semibold text-gray-500 uppercase">Listings</h4>
                <div className="text-sm text-gray-700">
                  <div>{lead.sampleListing || '—'}</div>
                  {lead.listingPrice && <div className="text-xs text-gray-400">{lead.listingPrice}</div>}
                </div>
                <div className="flex flex-wrap gap-1.5 pt-1">
                  <a href={getAgentSearchLinks(lead).zillow} target="_blank" rel="noreferrer"
                    className="inline-flex items-center px-2 py-1 rounded text-xs font-medium bg-blue-50 text-blue-700 hover:bg-blue-100 transition">
                    Zillow
                  </a>
                  <a href={getAgentSearchLinks(lead).realtor} target="_blank" rel="noreferrer"
                    className="inline-flex items-center px-2 py-1 rounded text-xs font-medium bg-red-50 text-red-700 hover:bg-red-100 transition">
                    Realtor.com
                  </a>
                  <a href={getAgentSearchLinks(lead).redfin} target="_blank" rel="noreferrer"
                    className="inline-flex items-center px-2 py-1 rounded text-xs font-medium bg-orange-50 text-orange-700 hover:bg-orange-100 transition">
                    Redfin
                  </a>
                  {lead.website && (
                    <a href={lead.website} target="_blank" rel="noreferrer"
                      className="inline-flex items-center px-2 py-1 rounded text-xs font-medium bg-gray-100 text-gray-700 hover:bg-gray-200 transition">
                      Agent Site
                    </a>
                  )}
                </div>
                {lead.activeListings && !editingListings && (
                  <div className="mt-1 p-2 bg-green-50 rounded-lg border border-green-200">
                    <div className="text-xs font-semibold text-green-800 mb-1">Active Listings</div>
                    <div className="text-xs text-green-700 whitespace-pre-wrap">{lead.activeListings}</div>
                  </div>
                )}
                {editingListings ? (
                  <div className="mt-1">
                    <textarea
                      value={listingsValue}
                      onChange={e => setListingsValue(e.target.value)}
                      className="w-full px-3 py-2 border border-gray-200 rounded-lg text-xs focus:ring-2 focus:ring-orange-300 focus:outline-none"
                      rows={3}
                      placeholder="Paste listing URLs or notes about active listings..."
                    />
                    <div className="flex gap-2 mt-1">
                      <button
                        onClick={() => { onActiveListingsChange(lead.rank, listingsValue); setEditingListings(false); }}
                        className="px-3 py-1.5 rounded-lg text-xs font-semibold text-white"
                        style={{ backgroundColor: '#e07850' }}
                      >Save</button>
                      <button onClick={() => setEditingListings(false)}
                        className="px-3 py-1.5 rounded-lg text-xs text-gray-500 hover:bg-gray-100">Cancel</button>
                    </div>
                  </div>
                ) : (
                  <button
                    onClick={() => { setEditingListings(true); setListingsValue(lead.activeListings || ''); }}
                    className="text-xs text-blue-600 hover:underline mt-1"
                  >
                    {lead.activeListings ? 'Edit listings' : '+ Add listings'}
                  </button>
                )}
              </div>

              {/* Qualification */}
              <div className="space-y-2">
                <h4 className="text-xs font-semibold text-gray-500 uppercase">Why Qualified</h4>
                <div className="text-sm text-gray-700">{lead.qualificationNotes}</div>
                {lead.outreachDate && (
                  <div className="text-xs text-gray-400">Outreach: {lead.outreachDate}</div>
                )}
                {lead.responseDate && (
                  <div className="text-xs text-gray-400">Response: {lead.responseDate}</div>
                )}
              </div>

              {/* Notes */}
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <h4 className="text-xs font-semibold text-gray-500 uppercase">Notes</h4>
                  {!editingNotes && (
                    <button
                      onClick={() => { setEditingNotes(true); setNotesValue(lead.notes || ''); }}
                      className="text-xs text-blue-600 hover:underline"
                    >
                      Edit
                    </button>
                  )}
                </div>
                {editingNotes ? (
                  <div>
                    <textarea
                      value={notesValue}
                      onChange={e => setNotesValue(e.target.value)}
                      className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:ring-2 focus:ring-orange-300 focus:outline-none"
                      rows={3}
                      placeholder="Add notes about this lead..."
                    />
                    <div className="flex gap-2 mt-2">
                      <button
                        onClick={() => { onNotesChange(lead.rank, notesValue); setEditingNotes(false); }}
                        className="px-3 py-1.5 rounded-lg text-xs font-semibold text-white"
                        style={{ backgroundColor: '#e07850' }}
                      >
                        Save
                      </button>
                      <button
                        onClick={() => setEditingNotes(false)}
                        className="px-3 py-1.5 rounded-lg text-xs text-gray-500 hover:bg-gray-100"
                      >
                        Cancel
                      </button>
                    </div>
                  </div>
                ) : (
                  <div className="text-sm text-gray-600">{lead.notes || <span className="text-gray-400 italic">No notes yet</span>}</div>
                )}
              </div>
            </div>
          </td>
        </tr>
      )}
    </>
  );
}

// ── Add Lead Modal ──────────────────────────────────────────────────────────

function AddLeadModal({ onClose, onAdd }: { onClose: () => void; onAdd: (data: Record<string, string>) => void }) {
  const [form, setForm] = useState({
    agentName: '', brokerage: '', city: '', state: '', neighborhood: '',
    email: '', phone: '', website: '', sampleListing: '', listingPrice: '',
    qualificationNotes: '',
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.agentName.trim() || !form.city.trim() || !form.state.trim()) return;
    onAdd(form);
  };

  const set = (key: string) => (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) =>
    setForm(prev => ({ ...prev, [key]: e.target.value }));

  return (
    <div className="fixed inset-0 bg-black/40 z-50 flex items-center justify-center p-4 overflow-y-auto">
      <div className="bg-white rounded-2xl max-w-lg w-full p-6 relative my-8">
        <button onClick={onClose} className="absolute top-4 right-4 text-gray-400 hover:text-gray-600 text-xl">×</button>
        <h2 className="text-lg font-bold mb-4" style={{ color: '#2a3a2a' }}>Add New Lead</h2>
        <form onSubmit={handleSubmit} className="space-y-3">
          <div className="grid grid-cols-2 gap-3">
            <Field label="Agent Name *" value={form.agentName} onChange={set('agentName')} required />
            <Field label="Brokerage" value={form.brokerage} onChange={set('brokerage')} />
          </div>
          <div className="grid grid-cols-3 gap-3">
            <Field label="City *" value={form.city} onChange={set('city')} required />
            <Field label="State *" value={form.state} onChange={set('state')} required />
            <Field label="Neighborhood" value={form.neighborhood} onChange={set('neighborhood')} />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <Field label="Email" value={form.email} onChange={set('email')} />
            <Field label="Phone" value={form.phone} onChange={set('phone')} />
          </div>
          <Field label="Website" value={form.website} onChange={set('website')} />
          <div className="grid grid-cols-2 gap-3">
            <Field label="Sample Listing" value={form.sampleListing} onChange={set('sampleListing')} />
            <Field label="Listing Price" value={form.listingPrice} onChange={set('listingPrice')} />
          </div>
          <div>
            <label className="block text-xs font-semibold text-gray-500 mb-1">Why Qualified</label>
            <textarea
              value={form.qualificationNotes}
              onChange={set('qualificationNotes')}
              className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:ring-2 focus:ring-orange-300 focus:outline-none"
              rows={2}
            />
          </div>
          <div className="flex justify-end gap-3 pt-2">
            <button type="button" onClick={onClose} className="px-4 py-2 rounded-lg text-sm text-gray-500 hover:bg-gray-100">
              Cancel
            </button>
            <button
              type="submit"
              className="px-4 py-2 rounded-lg text-sm font-semibold text-white transition hover:opacity-90"
              style={{ backgroundColor: '#e07850' }}
            >
              Add Lead
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

function Field({ label, value, onChange, required }: {
  label: string;
  value: string;
  onChange: (e: React.ChangeEvent<HTMLInputElement>) => void;
  required?: boolean;
}) {
  return (
    <div>
      <label className="block text-xs font-semibold text-gray-500 mb-1">{label}</label>
      <input
        type="text"
        value={value}
        onChange={onChange}
        required={required}
        className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:ring-2 focus:ring-orange-300 focus:outline-none"
      />
    </div>
  );
}

// ── Find Agents Modal (AI-Powered) ─────────────────────────────────────────

interface FoundAgent {
  agentName: string;
  brokerage: string;
  city: string;
  state: string;
  neighborhood: string;
  email: string;
  phone: string;
  website: string;
  sampleListing: string;
  listingPrice: string;
  qualificationNotes: string;
}

function FindAgentsModal({ onClose, onAddAgent }: {
  onClose: () => void;
  onAddAgent: (agent: Record<string, string>) => Promise<void>;
}) {
  const [city, setCity] = useState('');
  const [state, setState] = useState('');
  const [neighborhoods, setNeighborhoods] = useState('');
  const [count, setCount] = useState('5');
  const [searching, setSearching] = useState(false);
  const [results, setResults] = useState<FoundAgent[]>([]);
  const [added, setAdded] = useState<Set<string>>(new Set());
  const [error, setError] = useState<string | null>(null);

  const handleSearch = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!city.trim()) return;
    setSearching(true);
    setError(null);
    setResults([]);
    setAdded(new Set());
    try {
      const data = await searchAgents({
        city: city.trim(),
        state: state.trim() || undefined,
        neighborhoods: neighborhoods.trim() || undefined,
        count: parseInt(count, 10) || 5,
      });
      setResults(data.agents || []);
      if ((data.agents || []).length === 0) {
        setError('No new agents found. Try different neighborhoods or a different city.');
      }
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setSearching(false);
    }
  };

  const handleAdd = async (agent: FoundAgent) => {
    await onAddAgent(agent as unknown as Record<string, string>);
    setAdded(prev => new Set(prev).add(agent.agentName));
  };

  const handleAddAll = async () => {
    for (const agent of results) {
      if (!added.has(agent.agentName)) {
        await handleAdd(agent);
      }
    }
  };

  return (
    <div className="fixed inset-0 bg-black/40 z-50 flex items-center justify-center p-4 overflow-y-auto">
      <div className="bg-white rounded-2xl max-w-3xl w-full p-6 relative my-8">
        <button onClick={onClose} className="absolute top-4 right-4 text-gray-400 hover:text-gray-600 text-xl">×</button>

        <div className="flex items-center gap-3 mb-1">
          <div className="w-8 h-8 rounded-lg flex items-center justify-center" style={{ backgroundColor: '#1e3a5f' }}>
            <svg className="w-4 h-4 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
            </svg>
          </div>
          <h2 className="text-lg font-bold" style={{ color: '#2a3a2a' }}>Find Agents</h2>
        </div>
        <p className="text-xs text-gray-500 mb-4">AI searches for qualified real estate agents in walkable neighborhoods. Duplicates are automatically filtered out.</p>

        {/* Search Form */}
        <form onSubmit={handleSearch} className="mb-5">
          <div className="grid grid-cols-4 gap-3 mb-3">
            <div className="col-span-2">
              <label className="block text-xs font-semibold text-gray-500 mb-1">City *</label>
              <input
                type="text"
                value={city}
                onChange={e => setCity(e.target.value)}
                placeholder="Portland, Chicago, London..."
                required
                className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:ring-2 focus:ring-blue-300 focus:outline-none"
              />
            </div>
            <div>
              <label className="block text-xs font-semibold text-gray-500 mb-1">State / Country</label>
              <input
                type="text"
                value={state}
                onChange={e => setState(e.target.value)}
                placeholder="OR, IL, UK..."
                className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:ring-2 focus:ring-blue-300 focus:outline-none"
              />
            </div>
            <div>
              <label className="block text-xs font-semibold text-gray-500 mb-1">How many</label>
              <select
                value={count}
                onChange={e => setCount(e.target.value)}
                className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm bg-white"
              >
                {[3, 5, 7, 10].map(n => (
                  <option key={n} value={n}>{n} agents</option>
                ))}
              </select>
            </div>
          </div>
          <div className="mb-3">
            <label className="block text-xs font-semibold text-gray-500 mb-1">Target Neighborhoods (optional)</label>
            <input
              type="text"
              value={neighborhoods}
              onChange={e => setNeighborhoods(e.target.value)}
              placeholder="e.g. Pearl District, Hawthorne, Alberta"
              className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:ring-2 focus:ring-blue-300 focus:outline-none"
            />
          </div>
          <button
            type="submit"
            disabled={searching || !city.trim()}
            className="px-5 py-2.5 rounded-lg text-sm font-semibold text-white transition hover:opacity-90 disabled:opacity-50"
            style={{ backgroundColor: '#1e3a5f' }}
          >
            {searching ? (
              <span className="flex items-center gap-2">
                <svg className="w-4 h-4 animate-spin" viewBox="0 0 24 24" fill="none">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                </svg>
                Searching with AI...
              </span>
            ) : 'Search'}
          </button>
        </form>

        {error && (
          <div className="mb-4 p-3 rounded-lg bg-red-50 border border-red-200 text-red-700 text-sm">{error}</div>
        )}

        {/* Results */}
        {results.length > 0 && (
          <>
            <div className="flex items-center justify-between mb-3">
              <h3 className="text-sm font-semibold" style={{ color: '#2a3a2a' }}>
                Found {results.length} agent{results.length !== 1 ? 's' : ''} in {city}
              </h3>
              <button
                onClick={handleAddAll}
                disabled={added.size === results.length}
                className="text-xs font-medium px-3 py-1.5 rounded-lg transition hover:opacity-90 disabled:opacity-50 text-white"
                style={{ backgroundColor: '#e07850' }}
              >
                {added.size === results.length ? 'All Added' : `Add All ${results.length} to Pipeline`}
              </button>
            </div>
            <div className="space-y-3 max-h-[50vh] overflow-y-auto">
              {results.map((agent) => (
                <div
                  key={agent.agentName}
                  className="border rounded-xl p-4 transition"
                  style={{
                    borderColor: added.has(agent.agentName) ? '#a7f3d0' : '#e5e7eb',
                    backgroundColor: added.has(agent.agentName) ? '#f0fdf4' : 'white',
                  }}
                >
                  <div className="flex items-start justify-between gap-3">
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 mb-1">
                        <span className="text-sm font-semibold" style={{ color: '#2a3a2a' }}>{agent.agentName}</span>
                        <span className="text-xs text-gray-400">·</span>
                        <span className="text-xs text-gray-500">{agent.brokerage}</span>
                      </div>
                      <div className="text-xs text-gray-500 mb-2">
                        {agent.neighborhood} · {agent.city}, {agent.state} · {agent.listingPrice}
                      </div>
                      <div className="text-xs text-gray-600 mb-2">{agent.qualificationNotes}</div>
                      <div className="flex flex-wrap gap-3 text-xs text-gray-400">
                        {agent.email && <span>📧 {agent.email}</span>}
                        {agent.phone && <span>📞 {agent.phone}</span>}
                        {agent.website && (
                          <a href={agent.website} target="_blank" rel="noreferrer" className="text-blue-500 hover:underline truncate max-w-[200px]">
                            🌐 {agent.website}
                          </a>
                        )}
                      </div>
                    </div>
                    <button
                      onClick={() => handleAdd(agent)}
                      disabled={added.has(agent.agentName)}
                      className="flex-shrink-0 px-3 py-1.5 rounded-lg text-xs font-semibold transition hover:opacity-90 disabled:opacity-50"
                      style={{
                        backgroundColor: added.has(agent.agentName) ? '#d1fae5' : '#e07850',
                        color: added.has(agent.agentName) ? '#065f46' : 'white',
                      }}
                    >
                      {added.has(agent.agentName) ? '✓ Added' : '+ Add'}
                    </button>
                  </div>
                </div>
              ))}
            </div>
          </>
        )}
      </div>
    </div>
  );
}
