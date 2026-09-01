import { useState, useEffect } from 'react';
import { api } from '../../hooks/useApi';
import { useAuth } from '../../context/AuthContext';
import { CheckCircle2, AlertTriangle, Search, Plus, Edit2, Power, X, RefreshCw, AlertCircle, Save } from 'lucide-react';

const STATUS_STYLE = {
  published: { bg: '#D1FAE5', color: '#065F46', label: 'Published' },
  draft:     { bg: '#FEF3C7', color: '#92400E', label: 'Draft'     },
  inactive:  { bg: '#F3F4F6', color: '#6B7280', label: 'Inactive'  },
};

const EMPTY_FORM = { ref: '', title: '', cat: '', catK: 'conduct', desc: '', summary: '', full: '', status: 'draft' };

export default function PoliciesTab() {
  const { user } = useAuth();
  const [policies, setPolicies] = useState([]);
  const [loading, setLoading]   = useState(true);
  const [error, setError]       = useState(null);

  const [filter, setFilter]     = useState('all');
  const [search, setSearch]     = useState('');
  const [showModal, setShowModal] = useState(false);
  const [editTarget, setEditTarget] = useState(null); // null = create, object = edit
  const [form, setForm]         = useState(EMPTY_FORM);
  const [saving, setSaving]     = useState(false);
  const [confirmId, setConfirmId] = useState(null);
  const [toast, setToast]       = useState(null);

  function showToast(msg, isError = false) {
    setToast({ msg, isError });
    setTimeout(() => setToast(null), 3500);
  }

  // ── Fetch ordinances ─────────────────────────────────────────────────────
  async function fetchPolicies() {
    setLoading(true);
    setError(null);
    try {
      const data = await api.get('/ordinances');
      setPolicies(data);
    } catch (err) {
      setError(err.message || 'Failed to load policies.');
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => { fetchPolicies(); }, []);

  // ── Open modal helpers ────────────────────────────────────────────────────
  function openCreate() {
    setEditTarget(null);
    setForm(EMPTY_FORM);
    setShowModal(true);
  }

  function openEdit(p) {
    setEditTarget(p);
    setForm({ ref: p.ref, title: p.title, cat: p.cat, catK: p.catK, desc: p.desc || '', summary: p.summary || '', full: p.full || '', status: p.status || 'published' });
    setShowModal(true);
  }

  // ── Save (create or update) ───────────────────────────────────────────────
  async function handleSave() {
    if (!form.ref.trim() || !form.title.trim()) {
      showToast('Reference and Title are required.', true);
      return;
    }
    setSaving(true);
    try {
      if (editTarget) {
        const updated = await api.put(`/ordinances/${editTarget.id}`, { ...form, updatedBy: user?.name || 'Admin' });
        setPolicies(prev => prev.map(p => p.id === editTarget.id ? updated : p));
        showToast(`"${updated.title}" updated successfully.`);
      } else {
        const created = await api.post('/ordinances', { ...form, updatedBy: user?.name || 'Admin' });
        setPolicies(prev => [...prev, created]);
        showToast(`"${created.title}" saved as ${form.status}.`);
      }
      setShowModal(false);
    } catch (err) {
      showToast(err.message || 'Save failed.', true);
    } finally {
      setSaving(false);
    }
  }

  // ── Toggle status ─────────────────────────────────────────────────────────
  async function toggleStatus(id) {
    const p = policies.find(x => x.id === id);
    if (!p) return;
    const next = p.status === 'published' ? 'inactive' : 'published';
    try {
      const updated = await api.put(`/ordinances/${id}`, { status: next, updatedBy: user?.name || 'Admin' });
      setPolicies(prev => prev.map(x => x.id === id ? updated : x));
      showToast(next === 'inactive' ? `"${p.title}" deactivated.` : `"${p.title}" is now published.`);
    } catch (err) {
      showToast(err.message || 'Status update failed.', true);
    }
    setConfirmId(null);
  }

  // ── Derived lists ─────────────────────────────────────────────────────────
  const visible = policies.filter(p => {
    if (filter !== 'all' && p.status !== filter) return false;
    if (search && !p.title.toLowerCase().includes(search.toLowerCase()) && !p.ref.toLowerCase().includes(search.toLowerCase())) return false;
    return true;
  });

  const counts = {
    all:       policies.length,
    published: policies.filter(p => p.status === 'published').length,
    draft:     policies.filter(p => p.status === 'draft').length,
    inactive:  policies.filter(p => p.status === 'inactive').length,
  };

  // ── Render ────────────────────────────────────────────────────────────────
  return (
    <div>
      {/* Toast */}
      {toast && (
        <div style={{ position: 'fixed', bottom: 24, right: 24, background: toast.isError ? '#991B1B' : 'var(--g-dark)', color: '#fff', padding: '12px 20px', borderRadius: 10, fontSize: '.875rem', fontWeight: 500, zIndex: 9999, boxShadow: '0 4px 20px rgba(0,0,0,.2)', display: 'flex', alignItems: 'center', gap: 10 }}>
          {toast.isError ? <AlertCircle size={18} /> : <CheckCircle2 size={18} color="var(--g-primary)" />} {toast.msg}
        </div>
      )}

      {/* Confirm deactivate modal */}
      {confirmId && (() => {
        const p = policies.find(x => x.id === confirmId);
        return (
          <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,.45)', zIndex: 9998, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <div style={{ background: '#fff', borderRadius: 16, padding: 28, maxWidth: 420, width: '90%', boxShadow: '0 12px 40px rgba(0,0,0,.2)' }}>
              <div style={{ color: '#DC2626', marginBottom: 16 }}><AlertTriangle size={40} /></div>
              <h3 style={{ fontFamily: '"DM Serif Display",serif', fontSize: '1.25rem', color: 'var(--g-dark)', marginBottom: 8 }}>Deactivate Policy?</h3>
              <p style={{ fontSize: '.875rem', color: 'var(--gray-t)', lineHeight: 1.65, marginBottom: 20 }}>
                You are about to deactivate <strong>"{p.title}"</strong>. It will no longer be visible to students.
              </p>
              <p style={{ fontSize: '.78rem', color: '#9D174D', background: '#FCE7F3', padding: '10px 14px', borderRadius: 10, marginBottom: 20, display: 'flex', gap: 8, alignItems: 'flex-start' }}>
                <AlertTriangle size={14} style={{ marginTop: 2, flexShrink: 0 }} /> Ordinances cannot be deleted — only deactivated to preserve institutional records.
              </p>
              <div style={{ display: 'flex', gap: 10, justifyContent: 'flex-end' }}>
                <button onClick={() => setConfirmId(null)} style={{ padding: '9px 20px', borderRadius: 8, border: '1.5px solid var(--gray-mid)', background: '#fff', color: 'var(--gray-dk)', cursor: 'pointer', fontFamily: '"Plus Jakarta Sans",sans-serif', fontWeight: 600 }}>Cancel</button>
                <button onClick={() => toggleStatus(confirmId)} style={{ padding: '9px 20px', borderRadius: 8, border: 'none', background: '#DC2626', color: '#fff', cursor: 'pointer', fontFamily: '"Plus Jakarta Sans",sans-serif', fontWeight: 600 }}>Deactivate</button>
              </div>
            </div>
          </div>
        );
      })()}

      {/* Create/Edit modal */}
      {showModal && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,.45)', zIndex: 9998, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          <div style={{ background: '#fff', borderRadius: 16, padding: 28, maxWidth: 540, width: '90%', maxHeight: '90vh', overflowY: 'auto', boxShadow: '0 12px 40px rgba(0,0,0,.2)', position: 'relative' }}>
            <button onClick={() => setShowModal(false)} style={{ position: 'absolute', right: 20, top: 20, background: 'none', border: 'none', color: 'var(--gray-t)', cursor: 'pointer' }}><X size={20} /></button>
            <h3 style={{ fontFamily: '"DM Serif Display",serif', fontSize: '1.25rem', color: 'var(--g-dark)', marginBottom: 20, display: 'flex', alignItems: 'center', gap: 10 }}>
              {editTarget ? <Edit2 size={20} color="var(--g-primary)" /> : <Plus size={20} color="var(--g-primary)" />}
              {editTarget ? 'Edit Policy' : 'Upload New Policy'}
            </h3>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
              {[
                ['Policy Reference', 'ref', 'PLSP-XX-000'],
                ['Policy Title',     'title', 'Enter full policy title…'],
                ['Category',         'cat', 'e.g. Academic Policies'],
              ].map(([label, key, ph]) => (
                <div key={key}>
                  <label style={{ fontSize: '.78rem', fontWeight: 700, color: 'var(--gray-t)', textTransform: 'uppercase', letterSpacing: '.07em', display: 'block', marginBottom: 5 }}>{label}</label>
                  <input value={form[key]} onChange={e => setForm(f => ({ ...f, [key]: e.target.value }))} placeholder={ph} style={{ width: '100%', padding: '9px 12px', border: '1.5px solid var(--gray-mid)', borderRadius: 8, fontSize: '.875rem', fontFamily: '"Plus Jakarta Sans",sans-serif', outline: 'none', color: 'var(--gray-dk)', boxSizing: 'border-box' }} />
                </div>
              ))}
              <div>
                <label style={{ fontSize: '.78rem', fontWeight: 700, color: 'var(--gray-t)', textTransform: 'uppercase', letterSpacing: '.07em', display: 'block', marginBottom: 5 }}>Summary</label>
                <textarea rows={2} value={form.summary} onChange={e => setForm(f => ({ ...f, summary: e.target.value }))} placeholder="Brief summary visible on the card…" style={{ width: '100%', padding: '9px 12px', border: '1.5px solid var(--gray-mid)', borderRadius: 8, fontSize: '.875rem', fontFamily: '"Plus Jakarta Sans",sans-serif', outline: 'none', color: 'var(--gray-dk)', resize: 'vertical', boxSizing: 'border-box' }} />
              </div>
              <div>
                <label style={{ fontSize: '.78rem', fontWeight: 700, color: 'var(--gray-t)', textTransform: 'uppercase', letterSpacing: '.07em', display: 'block', marginBottom: 5 }}>Full Policy Text</label>
                <textarea rows={5} value={form.full} onChange={e => setForm(f => ({ ...f, full: e.target.value }))} placeholder="Paste or type the full ordinance text here…" style={{ width: '100%', padding: '9px 12px', border: '1.5px solid var(--gray-mid)', borderRadius: 8, fontSize: '.875rem', fontFamily: '"Plus Jakarta Sans",sans-serif', outline: 'none', color: 'var(--gray-dk)', resize: 'vertical', boxSizing: 'border-box' }} />
              </div>
              <div>
                <label style={{ fontSize: '.78rem', fontWeight: 700, color: 'var(--gray-t)', textTransform: 'uppercase', letterSpacing: '.07em', display: 'block', marginBottom: 5 }}>Save as</label>
                <select value={form.status} onChange={e => setForm(f => ({ ...f, status: e.target.value }))} style={{ width: '100%', padding: '9px 12px', border: '1.5px solid var(--gray-mid)', borderRadius: 8, fontSize: '.875rem', fontFamily: '"Plus Jakarta Sans",sans-serif', outline: 'none', color: 'var(--gray-dk)', background: '#fff', boxSizing: 'border-box' }}>
                  <option value="draft">Draft (not visible to students)</option>
                  <option value="published">Published (visible immediately)</option>
                </select>
              </div>
            </div>
            <div style={{ display: 'flex', gap: 10, justifyContent: 'flex-end', marginTop: 22 }}>
              <button onClick={() => setShowModal(false)} style={{ padding: '9px 20px', borderRadius: 8, border: '1.5px solid var(--gray-mid)', background: '#fff', color: 'var(--gray-dk)', cursor: 'pointer', fontFamily: '"Plus Jakarta Sans",sans-serif', fontWeight: 600 }}>Cancel</button>
              <button onClick={handleSave} disabled={saving} style={{ padding: '9px 20px', borderRadius: 8, border: 'none', background: 'var(--g-primary)', color: '#fff', cursor: saving ? 'not-allowed' : 'pointer', fontFamily: '"Plus Jakarta Sans",sans-serif', fontWeight: 700, display: 'flex', alignItems: 'center', gap: 8, opacity: saving ? 0.7 : 1 }}>
                {saving ? <RefreshCw size={14} style={{ animation: 'spin 1s linear infinite' }} /> : <Save size={14} />}
                {saving ? 'Saving…' : 'Save Policy'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 20, flexWrap: 'wrap', gap: 12 }}>
        <div>
          <h2 style={{ fontFamily: '"DM Serif Display",serif', fontSize: '1.6rem', color: 'var(--g-dark)' }}>Manage Policies</h2>
          <p style={{ fontSize: '.875rem', color: 'var(--gray-t)', marginTop: 4 }}>Upload, edit, and control the status of all handbook ordinances.</p>
        </div>
        <div style={{ display: 'flex', gap: 8 }}>
          <button onClick={fetchPolicies} title="Refresh" style={{ display: 'inline-flex', alignItems: 'center', gap: 6, padding: '10px 14px', borderRadius: 8, border: '1.5px solid var(--gray-mid)', background: '#fff', color: 'var(--gray-t)', fontWeight: 600, fontSize: '.82rem', cursor: 'pointer', fontFamily: '"Plus Jakarta Sans",sans-serif' }}>
            <RefreshCw size={13} style={{ animation: loading ? 'spin 1s linear infinite' : 'none' }} />
          </button>
          <button onClick={openCreate} style={{ display: 'inline-flex', alignItems: 'center', gap: 8, padding: '10px 20px', borderRadius: 8, background: 'var(--g-primary)', color: '#fff', fontWeight: 700, fontSize: '.875rem', border: 'none', cursor: 'pointer', fontFamily: '"Plus Jakarta Sans",sans-serif', transition: 'all .2s ease' }}
            onMouseEnter={e => e.currentTarget.style.transform = 'translateY(-2px)'}
            onMouseLeave={e => e.currentTarget.style.transform = 'none'}
          >
            <Plus size={18} /> Upload New Policy
          </button>
        </div>
      </div>

      {error && (
        <div style={{ background: '#FEF2F2', border: '1.5px solid #FECACA', borderRadius: 12, padding: '14px 18px', marginBottom: 18, display: 'flex', gap: 12, alignItems: 'center' }}>
          <AlertCircle size={18} color="#DC2626" />
          <span style={{ fontSize: '.875rem', color: '#991B1B' }}>{error}</span>
          <button onClick={fetchPolicies} style={{ marginLeft: 'auto', fontSize: '.78rem', color: '#DC2626', background: 'none', border: 'none', cursor: 'pointer', fontWeight: 700 }}>Retry</button>
        </div>
      )}

      {/* Filters + search */}
      <div style={{ background: '#fff', border: '1.5px solid var(--gray-mid)', borderRadius: 14, padding: '16px 20px', marginBottom: 18, display: 'flex', alignItems: 'center', gap: 12, flexWrap: 'wrap' }}>
        <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
          {['all', 'published', 'draft', 'inactive'].map(f => (
            <button key={f} onClick={() => setFilter(f)} style={{ padding: '6px 14px', borderRadius: 999, fontSize: '.8rem', fontWeight: 600, border: `1.5px solid ${filter === f ? 'var(--g-primary)' : 'var(--gray-mid)'}`, background: filter === f ? 'var(--g-primary)' : '#fff', color: filter === f ? '#fff' : 'var(--gray-t)', cursor: 'pointer', fontFamily: '"Plus Jakarta Sans",sans-serif' }}>
              {f.charAt(0).toUpperCase() + f.slice(1)} ({counts[f]})
            </button>
          ))}
        </div>
        <div style={{ flex: 1, position: 'relative', minWidth: 200 }}>
          <span style={{ position: 'absolute', left: 12, top: '50%', transform: 'translateY(-50%)', color: 'var(--gray-t)' }}><Search size={16} /></span>
          <input value={search} onChange={e => setSearch(e.target.value)} placeholder="Search policies…" style={{ width: '100%', padding: '7px 12px 7px 32px', border: '1.5px solid var(--gray-mid)', borderRadius: 8, fontSize: '.85rem', fontFamily: '"Plus Jakarta Sans",sans-serif', outline: 'none', color: 'var(--gray-dk)', boxSizing: 'border-box' }} />
        </div>
      </div>

      {/* Table */}
      <div style={{ background: '#fff', border: '1.5px solid var(--gray-mid)', borderRadius: 14, overflowX: 'auto', WebkitOverflowScrolling: 'touch' }}>
        <table style={{ width: '100%', minWidth: 650, borderCollapse: 'collapse' }}>
          <thead>
            <tr style={{ background: 'var(--gray-bg)', borderBottom: '1.5px solid var(--gray-mid)' }}>
              {['Reference', 'Title', 'Category', 'Status', 'Last Updated', 'Actions'].map(h => (
                <th key={h} style={{ padding: '11px 16px', textAlign: 'left', fontSize: '.72rem', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '.07em', color: 'var(--gray-t)', whiteSpace: 'nowrap' }}>{h}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {loading ? (
              [1,2,3,4,5].map(i => (
                <tr key={i} style={{ borderBottom: '1px solid var(--gray-mid)' }}>
                  {[1,2,3,4,5,6].map(j => (
                    <td key={j} style={{ padding: '14px 16px' }}>
                      <div style={{ height: 16, background: 'var(--gray-bg)', borderRadius: 4, animation: 'pulse 1.5s infinite' }} />
                    </td>
                  ))}
                </tr>
              ))
            ) : visible.length === 0 ? (
              <tr><td colSpan={6} style={{ padding: '40px', textAlign: 'center', color: 'var(--gray-t)', fontSize: '.875rem' }}>No policies match your filters.</td></tr>
            ) : visible.map((p, i) => {
              const s = STATUS_STYLE[p.status] || STATUS_STYLE.inactive;
              return (
                <tr key={p.id} style={{ borderBottom: i < visible.length - 1 ? '1px solid var(--gray-mid)' : 'none', transition: 'background .15s' }}
                  onMouseEnter={e => e.currentTarget.style.background = '#FAFAFA'}
                  onMouseLeave={e => e.currentTarget.style.background = '#fff'}
                >
                  <td style={{ padding: '12px 16px', fontSize: '.78rem', color: 'var(--gray-t)', fontWeight: 600, whiteSpace: 'nowrap' }}>{p.ref}</td>
                  <td style={{ padding: '12px 16px', fontSize: '.875rem', fontWeight: 600, color: 'var(--g-dark)', maxWidth: 240 }}>{p.title}</td>
                  <td style={{ padding: '12px 16px', fontSize: '.8rem', color: 'var(--gray-t)' }}>{p.cat}</td>
                  <td style={{ padding: '12px 16px' }}>
                    <span style={{ padding: '3px 10px', borderRadius: 999, fontSize: '.72rem', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '.04em', background: s.bg, color: s.color }}>{s.label}</span>
                  </td>
                  <td style={{ padding: '12px 16px', fontSize: '.78rem', color: 'var(--gray-t)', whiteSpace: 'nowrap' }}>
                    {p.updatedAt ? new Date(p.updatedAt).toLocaleDateString('en-PH', { year: 'numeric', month: 'short', day: 'numeric' }) : '—'}
                    {p.updatedBy && <div style={{ fontSize: '.7rem', marginTop: 2 }}>{p.updatedBy}</div>}
                  </td>
                  <td style={{ padding: '12px 16px' }}>
                    <div style={{ display: 'flex', gap: 6 }}>
                      <button onClick={() => openEdit(p)} style={{ display: 'flex', alignItems: 'center', gap: 4, padding: '5px 12px', borderRadius: 6, fontSize: '.75rem', fontWeight: 600, border: '1.5px solid #C2E0CE', background: 'var(--g-pale)', color: 'var(--g-primary)', cursor: 'pointer', fontFamily: '"Plus Jakarta Sans",sans-serif' }}>
                        <Edit2 size={12} /> Edit
                      </button>
                      {p.status !== 'draft' && (
                        <button onClick={() => p.status === 'published' ? setConfirmId(p.id) : toggleStatus(p.id)}
                          style={{ display: 'flex', alignItems: 'center', gap: 4, padding: '5px 12px', borderRadius: 6, fontSize: '.75rem', fontWeight: 600, border: `1.5px solid ${p.status === 'published' ? '#FECACA' : '#C2E0CE'}`, background: p.status === 'published' ? '#FEF2F2' : 'var(--g-pale)', color: p.status === 'published' ? '#DC2626' : 'var(--g-primary)', cursor: 'pointer', fontFamily: '"Plus Jakarta Sans",sans-serif' }}>
                          <Power size={12} /> {p.status === 'published' ? 'Deactivate' : 'Activate'}
                        </button>
                      )}
                    </div>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
      <style>{`@keyframes pulse{0%,100%{opacity:1}50%{opacity:.5}} @keyframes spin{to{transform:rotate(360deg)}}`}</style>
    </div>
  );
}
