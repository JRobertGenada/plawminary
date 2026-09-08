import { useState, useEffect, useMemo, useRef } from 'react';
import { api } from '../../hooks/useApi';
import {
  History, FilePlus, Check, RefreshCw, AlertCircle, AlertTriangle,
  X, Save, Eye, GitCompare, BookOpen, ShieldCheck, Download,
  FileText, Upload, Clock, Archive, Sparkles, Search, ChevronDown,
  ChevronUp, CheckCircle2, ArrowRight, Trash2
} from 'lucide-react';
import { BADGE_MAP } from '../../data/ordinances';

const EMPTY_FORM = {
  label: '',
  description: '',
  changeNotes: '',
  releaseDate: new Date().toISOString().split('T')[0],
  status: 'draft',
};

export default function VersionsTab() {
  const [versions, setVersions] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [toast, setToast] = useState(null);

  // ── Modals State ──────────────────────────────────────────────────────────
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [createForm, setCreateForm] = useState(EMPTY_FORM);
  const [savingCreate, setSavingCreate] = useState(false);

  // View Details Modal
  const [detailsVersion, setDetailsVersion] = useState(null);
  const [versionPolicies, setVersionPolicies] = useState([]);
  const [loadingPolicies, setLoadingPolicies] = useState(false);
  const [policySearchQ, setPolicySearchQ] = useState('');
  const [expandedPolicyId, setExpandedPolicyId] = useState(null);

  // Compare Modal
  const [showCompareModal, setShowCompareModal] = useState(false);
  const [compareFromId, setCompareFromId] = useState('');
  const [compareToId, setCompareToId] = useState('');
  const [comparing, setComparing] = useState(false);
  const [compareResult, setCompareResult] = useState(null);
  const [compareFilter, setCompareFilter] = useState('all'); // 'all' | 'added' | 'modified' | 'removed' | 'unchanged'

  // Re-import Modal
  const [reimportVersion, setReimportVersion] = useState(null);
  const [reimportFile, setReimportFile] = useState(null);
  const [reimportProcessing, setReimportProcessing] = useState(false);
  const [reimportStatusText, setReimportStatusText] = useState('');
  const [reimportExtracted, setReimportExtracted] = useState(null);
  const [reimportChangeNotes, setReimportChangeNotes] = useState('');
  const [reimporting, setReimporting] = useState(false);
  const reimportFileInputRef = useRef(null);

  // Confirmation Dialog
  const [confirmDialog, setConfirmDialog] = useState(null); // { type: 'activate'|'archive'|'delete', version: {...} }
  const [deleting, setDeleting] = useState(false);

  function showToast(msg, isError = false) {
    setToast({ msg, isError });
    setTimeout(() => setToast(null), 4500);
  }

  // ── Data Fetching ─────────────────────────────────────────────────────────
  async function fetchVersions() {
    setLoading(true);
    setError(null);
    try {
      const data = await api.get('/admin/versions');
      setVersions(data);
      return data;
    } catch (err) {
      setError(err.message || 'Failed to load versions.');
      return [];
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    fetchVersions();
  }, []);

  const activeVersion = useMemo(() => versions.find(v => v.status === 'active'), [versions]);

  const nextSuggestedLabel = useMemo(() => {
    if (!activeVersion) return 'Version 1.0';
    const m = activeVersion.label.match(/(\d+)\.(\d+)/);
    if (m) {
      const major = Number(m[1]);
      const minor = Number(m[2]) + 1;
      return `Version ${major}.${minor}`;
    }
    return 'Version 2.0';
  }, [activeVersion]);

  // ── Open Details ──────────────────────────────────────────────────────────
  async function handleOpenDetails(v) {
    setDetailsVersion(v);
    setVersionPolicies([]);
    setPolicySearchQ('');
    setExpandedPolicyId(null);
    setLoadingPolicies(true);
    try {
      const policies = await api.get(`/admin/versions/${v.id}/policies`);
      setVersionPolicies(policies);
    } catch (err) {
      showToast(err.message || 'Failed to load policies for this version.', true);
    } finally {
      setLoadingPolicies(false);
    }
  }

  // ── Create Version ────────────────────────────────────────────────────────
  async function handleCreateVersion() {
    if (!createForm.label.trim() || !createForm.releaseDate) {
      showToast('Version label and release date are required.', true);
      return;
    }

    setSavingCreate(true);
    try {
      const created = await api.post('/admin/versions', {
        label: createForm.label.trim(),
        description: createForm.description.trim(),
        changeNotes: createForm.changeNotes.trim(),
        releaseDate: createForm.releaseDate,
        status: createForm.status,
      });

      await fetchVersions();
      setShowCreateModal(false);
      setCreateForm(EMPTY_FORM);
      showToast(`${created.label} created successfully as ${created.status.toUpperCase()}!`);
    } catch (err) {
      showToast(err.message || 'Failed to create version.', true);
    } finally {
      setSavingCreate(false);
    }
  }

  // ── Activate Version ──────────────────────────────────────────────────────
  async function executeActivate(v) {
    try {
      const res = await api.post(`/admin/versions/${v.id}/activate`);
      await fetchVersions();
      if (detailsVersion?.id === v.id) {
        setDetailsVersion(res.version);
      }
      setConfirmDialog(null);
      showToast(res.message || `${v.label} is now active and student-facing!`);
    } catch (err) {
      showToast(err.message || 'Failed to activate version.', true);
    }
  }

  // ── Archive Version ───────────────────────────────────────────────────────
  async function executeArchive(v) {
    if (v.status === 'active') {
      showToast('Cannot archive the only active version. Activate another version first.', true);
      setConfirmDialog(null);
      return;
    }

    try {
      const res = await api.post(`/admin/versions/${v.id}/archive`);
      await fetchVersions();
      if (detailsVersion?.id === v.id) {
        setDetailsVersion(res.version);
      }
      setConfirmDialog(null);
      showToast(res.message || `${v.label} has been archived.`);
    } catch (err) {
      showToast(err.message || 'Failed to archive version.', true);
    }
  }

  // ── Delete Version (Development) ──────────────────────────────────────────
  async function executeDelete(v) {
    setDeleting(true);
    try {
      const res = await api.delete(`/admin/versions/${v.id}`);
      await fetchVersions();
      if (detailsVersion?.id === v.id) {
        setDetailsVersion(null);
      }
      setConfirmDialog(null);
      showToast(res.message || `${v.label} deleted successfully.`);
    } catch (err) {
      showToast(err.message || 'Failed to delete version.', true);
    } finally {
      setDeleting(false);
    }
  }

  // ── Compare Handler ───────────────────────────────────────────────────────
  function handleOpenCompare(presetFromId = null, presetToId = null) {
    const list = [...versions];
    let from = presetFromId || compareFromId;
    let to = presetToId || compareToId;

    if (!from || !to) {
      if (list.length >= 2) {
        // Default: compare previous version with latest/active
        const act = list.find(v => v.status === 'active') || list[0];
        const other = list.find(v => v.id !== act.id) || list[1];
        to = act.id;
        from = other.id;
      } else if (list.length === 1) {
        from = list[0].id;
        to = list[0].id;
      }
    }

    setCompareFromId(from);
    setCompareToId(to);
    setShowCompareModal(true);
    setCompareResult(null);

    if (from && to && from !== to) {
      runCompare(from, to);
    }
  }

  async function runCompare(fromId, toId) {
    if (!fromId || !toId) return;
    if (fromId === toId) {
      showToast('Please choose two different versions to compare.', true);
      return;
    }

    setComparing(true);
    try {
      const data = await api.get(`/admin/versions/compare?from=${fromId}&to=${toId}`);
      setCompareResult(data);
      setCompareFilter('all');
    } catch (err) {
      showToast(err.message || 'Failed to compare versions.', true);
      setCompareResult(null);
    } finally {
      setComparing(false);
    }
  }

  // ── Re-import Flow ────────────────────────────────────────────────────────
  function handleOpenReimport(v) {
    setReimportVersion(v);
    setReimportFile(null);
    setReimportExtracted(null);
    setReimportProcessing(false);
    setReimportChangeNotes(v.change_notes || '');
    if (reimportFileInputRef.current) reimportFileInputRef.current.value = '';
  }

  async function handleProcessReimportPdf(file) {
    if (!file) return;
    setReimportFile(file);
    setReimportProcessing(true);
    setReimportStatusText('Uploading PDF and extracting policies...');

    try {
      const formData = new FormData();
      formData.append('pdf', file);

      const res = await fetch('/api/admin/handbook/process', {
        method: 'POST',
        body: formData,
        credentials: 'include',
      });

      const data = await res.json();
      if (!res.ok || !data.success) {
        throw new Error(data.error || 'PDF processing failed');
      }

      setReimportExtracted(data);
      setReimportStatusText('');
      showToast(`Extracted ${data.totalPolicies} policies from ${data.totalPages} pages. Ready to re-import.`);
    } catch (err) {
      showToast(err.message || 'Failed to process PDF.', true);
      setReimportFile(null);
    } finally {
      setReimportProcessing(false);
    }
  }

  async function handleConfirmReimport() {
    if (!reimportVersion || !reimportExtracted?.policies) {
      showToast('No extracted policies to re-import.', true);
      return;
    }

    setReimporting(true);
    try {
      const payload = {
        policies: reimportExtracted.policies,
        tempFileId: reimportExtracted.tempFileId,
        changeNotes: reimportChangeNotes,
      };

      const res = await api.post(`/admin/versions/${reimportVersion.id}/re-import`, payload);
      await fetchVersions();
      setReimportVersion(null);
      setReimportExtracted(null);
      setReimportFile(null);
      showToast(res.message || 'Re-import completed successfully!');
    } catch (err) {
      showToast(err.message || 'Failed to complete re-import.', true);
    } finally {
      setReimporting(false);
    }
  }

  // Filter policies in details modal
  const filteredModalPolicies = useMemo(() => {
    if (!policySearchQ.trim()) return versionPolicies;
    const q = policySearchQ.toLowerCase().trim();
    return versionPolicies.filter(p =>
      (p.title && p.title.toLowerCase().includes(q)) ||
      (p.ref && p.ref.toLowerCase().includes(q)) ||
      (p.cat && p.cat.toLowerCase().includes(q)) ||
      (p.summary && p.summary.toLowerCase().includes(q))
    );
  }, [versionPolicies, policySearchQ]);

  return (
    <div style={{ paddingBottom: 60 }}>
      {/* Toast */}
      {toast && (
        <div style={{
          position: 'fixed', bottom: 24, right: 24,
          background: toast.isError ? '#991B1B' : 'var(--g-dark)',
          color: '#fff', padding: '12px 20px', borderRadius: 12,
          fontSize: '.875rem', fontWeight: 600, zIndex: 99999,
          boxShadow: '0 8px 30px rgba(0,0,0,.3)',
          display: 'flex', alignItems: 'center', gap: 10,
          border: '1px solid rgba(255,255,255,0.1)'
        }}>
          {toast.isError ? <AlertCircle size={18} color="#FCA5A5" /> : <CheckCircle2 size={18} color="var(--gold)" />}
          {toast.msg}
        </div>
      )}

      {/* Page Header */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 24, flexWrap: 'wrap', gap: 16 }}>
        <div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 4 }}>
            <span style={{
              display: 'inline-flex', alignItems: 'center', gap: 5, padding: '3px 10px',
              borderRadius: 999, fontSize: '.72rem', fontWeight: 800,
              background: 'rgba(244,197,66,0.15)', color: 'var(--gold-d)',
              textTransform: 'uppercase', letterSpacing: '.06em'
            }}>
              <ShieldCheck size={12} /> Institutional Integrity
            </span>
            <span style={{ fontSize: '.8rem', color: 'var(--gray-t)' }}>DRAFT → ACTIVE → ARCHIVED</span>
          </div>
          <h1 style={{ fontFamily: '"DM Serif Display",serif', fontSize: '1.85rem', color: 'var(--g-dark)', margin: 0 }}>
            Handbook Version Control
          </h1>
          <p style={{ fontSize: '.875rem', color: 'var(--gray-t)', marginTop: 4, maxWidth: 640 }}>
            Manage student handbook versions with audit safety. Only one version is active and student-facing at any time. Archived versions are permanently preserved.
          </p>
        </div>

        {/* Top Actions */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap' }}>
          <button
            onClick={fetchVersions}
            title="Refresh Versions"
            style={{
              display: 'inline-flex', alignItems: 'center', gap: 6,
              padding: '9px 14px', borderRadius: 10, border: '1.5px solid var(--gray-mid)',
              background: '#fff', color: 'var(--gray-t)', fontWeight: 600, fontSize: '.82rem',
              cursor: 'pointer', fontFamily: '"Plus Jakarta Sans",sans-serif'
            }}
          >
            <RefreshCw size={14} style={{ animation: loading ? 'spin 1s linear infinite' : 'none' }} />
            <span>Refresh</span>
          </button>

          <button
            onClick={() => handleOpenCompare()}
            style={{
              display: 'inline-flex', alignItems: 'center', gap: 8,
              padding: '9px 16px', borderRadius: 10, border: '1.5px solid var(--gray-mid)',
              background: '#fff', color: 'var(--gray-dk)', fontWeight: 700, fontSize: '.84rem',
              cursor: 'pointer', fontFamily: '"Plus Jakarta Sans",sans-serif',
              boxShadow: '0 1px 3px rgba(0,0,0,0.05)'
            }}
          >
            <GitCompare size={16} color="var(--g-primary)" />
            Compare Versions
          </button>

          <button
            onClick={() => {
              setCreateForm({ ...EMPTY_FORM, label: nextSuggestedLabel });
              setShowCreateModal(true);
            }}
            style={{
              display: 'inline-flex', alignItems: 'center', gap: 8,
              padding: '9px 18px', borderRadius: 10, border: 'none',
              background: 'var(--g-primary)', color: '#fff', fontWeight: 700, fontSize: '.84rem',
              cursor: 'pointer', fontFamily: '"Plus Jakarta Sans",sans-serif',
              boxShadow: '0 2px 8px rgba(15,79,44,0.25)'
            }}
          >
            <FilePlus size={16} />
            + Create New Version
          </button>
        </div>
      </div>

      {/* Warning / Audit Notice */}
      <div style={{
        background: '#FEF9E7', border: '1.5px solid #FDE68A', borderRadius: 14,
        padding: '14px 18px', marginBottom: 24, display: 'flex', gap: 14, alignItems: 'flex-start'
      }}>
        <AlertTriangle size={20} color="#D4A82A" style={{ marginTop: 2, flexShrink: 0 }} />
        <div style={{ fontSize: '.82rem', color: '#92400E', lineHeight: 1.6 }}>
          <strong style={{ display: 'block', fontSize: '.875rem', marginBottom: 2 }}>Permanent Ordinance Preservation</strong>
          Institutional regulations are permanent legal records. You can draft new editions or re-import existing versions to add or update missing policies. Historical policy text is permanently archived and never deleted.
        </div>
      </div>

      {error && (
        <div style={{
          background: '#FEF2F2', border: '1.5px solid #FECACA', borderRadius: 12,
          padding: '14px 18px', marginBottom: 20, display: 'flex', gap: 12, alignItems: 'center'
        }}>
          <AlertCircle size={18} color="#DC2626" />
          <span style={{ fontSize: '.875rem', color: '#991B1B' }}>{error}</span>
          <button onClick={fetchVersions} style={{ marginLeft: 'auto', fontSize: '.78rem', color: '#DC2626', background: 'none', border: 'none', cursor: 'pointer', fontWeight: 700 }}>Retry</button>
        </div>
      )}

      {/* ── Version Cards ────────────────────────────────────────────────────── */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: 16, marginBottom: 30 }}>
        {loading ? (
          [1, 2].map(i => (
            <div key={i} style={{ background: '#fff', border: '1.5px solid var(--gray-mid)', borderRadius: 16, padding: 24 }}>
              <div style={{ display: 'flex', gap: 18 }}>
                <div style={{ width: 50, height: 50, borderRadius: 12, background: 'var(--gray-bg)', animation: 'pulse 1.5s infinite', flexShrink: 0 }} />
                <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: 10 }}>
                  <div style={{ height: 20, width: '30%', background: 'var(--gray-bg)', borderRadius: 6, animation: 'pulse 1.5s infinite' }} />
                  <div style={{ height: 14, width: '60%', background: 'var(--gray-bg)', borderRadius: 4, animation: 'pulse 1.5s infinite' }} />
                  <div style={{ height: 14, width: '40%', background: 'var(--gray-bg)', borderRadius: 4, animation: 'pulse 1.5s infinite' }} />
                </div>
              </div>
            </div>
          ))
        ) : versions.length === 0 ? (
          <div style={{ background: '#fff', border: '1.5px solid var(--gray-mid)', borderRadius: 16, padding: '48px 24px', textAlign: 'center', color: 'var(--gray-t)' }}>
            <History size={40} color="var(--gray-mid)" style={{ margin: '0 auto 12px' }} />
            <h3 style={{ fontSize: '1.1rem', color: 'var(--g-dark)', marginBottom: 6 }}>No Versions Found</h3>
            <p style={{ fontSize: '.875rem', maxWidth: 400, margin: '0 auto 18px' }}>Create your first handbook edition using the button below.</p>
            <button
              onClick={() => { setCreateForm({ ...EMPTY_FORM, label: 'Version 1.0' }); setShowCreateModal(true); }}
              style={{ padding: '9px 18px', borderRadius: 8, border: 'none', background: 'var(--g-primary)', color: '#fff', fontWeight: 700, cursor: 'pointer' }}
            >
              + Create Version 1.0
            </button>
          </div>
        ) : (
          versions.map(v => {
            const isActive   = v.status === 'active';
            const isDraft    = v.status === 'draft';
            const isArchived = v.status === 'archived' || v.status === 'inactive';

            const statusTheme = isActive
              ? { bg: '#ECFDF5', border: 'var(--g-primary)', text: '#065F46', badgeText: 'Active — Student-Facing' }
              : isDraft
              ? { bg: '#FFFBEB', border: '#F59E0B', text: '#92400E', badgeText: 'Draft — Staging' }
              : { bg: '#F3F4F6', border: 'var(--gray-mid)', text: '#4B5563', badgeText: 'Archived / Historical' };

            return (
              <div
                key={v.id}
                style={{
                  background: '#fff',
                  border: `2px solid ${isActive ? 'var(--g-primary)' : isDraft ? '#FBBF24' : 'var(--gray-mid)'}`,
                  borderRadius: 16,
                  overflow: 'hidden',
                  transition: 'all .2s ease',
                  boxShadow: isActive ? '0 4px 16px rgba(15,79,44,0.08)' : '0 1px 4px rgba(0,0,0,0.02)'
                }}
              >
                {/* Card Top / Body (Clickable to View Details) */}
                <div
                  onClick={() => handleOpenDetails(v)}
                  style={{
                    padding: '22px 24px 18px',
                    cursor: 'pointer',
                    position: 'relative',
                    transition: 'background .15s'
                  }}
                  onMouseEnter={e => e.currentTarget.style.background = 'rgba(0,0,0,0.01)'}
                  onMouseLeave={e => e.currentTarget.style.background = 'transparent'}
                >
                  <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 16, flexWrap: 'wrap', marginBottom: 12 }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 14 }}>
                      <div style={{
                        width: 46, height: 46, borderRadius: 12,
                        background: isActive ? 'var(--g-pale)' : isDraft ? '#FEF3C7' : 'var(--gray-bg)',
                        display: 'flex', alignItems: 'center', justifyContent: 'center',
                        color: isActive ? 'var(--g-primary)' : isDraft ? '#B45309' : 'var(--gray-t)',
                        flexShrink: 0
                      }}>
                        {isActive ? <CheckCircle2 size={24} /> : isDraft ? <Clock size={24} /> : <Archive size={24} />}
                      </div>
                      <div>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                          <h3 style={{ fontFamily: '"DM Serif Display",serif', fontSize: '1.25rem', color: 'var(--g-dark)', margin: 0 }}>
                            {v.label}
                          </h3>
                          <span style={{
                            fontSize: '.72rem', fontWeight: 800, padding: '3px 10px',
                            borderRadius: 999, background: statusTheme.bg, color: statusTheme.text,
                            textTransform: 'uppercase', letterSpacing: '.05em', display: 'inline-flex', alignItems: 'center', gap: 5
                          }}>
                            {isActive && <Check size={12} />}
                            {statusTheme.badgeText}
                          </span>
                        </div>
                        <div style={{ fontSize: '.78rem', color: 'var(--gray-t)', marginTop: 3 }}>
                          Created: {v.created_at ? new Date(v.created_at).toLocaleDateString(undefined, { year: 'numeric', month: 'short', day: 'numeric' }) : 'N/A'}
                        </div>
                      </div>
                    </div>

                    <div style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: '.78rem', color: 'var(--gray-t)' }}>
                      <span style={{ display: 'inline-flex', alignItems: 'center', gap: 4 }}>
                        <Eye size={14} color="var(--gray-t)" /> Click card for details
                      </span>
                    </div>
                  </div>

                  <p style={{ fontSize: '.88rem', color: 'var(--gray-dk)', lineHeight: 1.6, marginBottom: 16, maxWidth: 850 }}>
                    {v.description || 'No description provided.'}
                  </p>

                  {/* Metadata Chips */}
                  <div style={{ display: 'flex', gap: 18, fontSize: '.8rem', color: 'var(--gray-t)', flexWrap: 'wrap' }}>
                    <span>📅 Released: <strong style={{ color: 'var(--gray-dk)' }}>{v.release_date || v.releaseDate}</strong></span>
                    <span>📋 Policies: <strong style={{ color: 'var(--g-primary)' }}>{v.policy_count !== undefined ? v.policy_count : v.sections}</strong></span>
                    <span>👤 Prepared by: <strong style={{ color: 'var(--gray-dk)' }}>{v.edited_by || v.editedBy || 'Admin'}</strong></span>
                    {v.file_path && (
                      <span style={{ display: 'inline-flex', alignItems: 'center', gap: 4, color: 'var(--g-primary)', fontWeight: 600 }}>
                        <FileText size={13} /> PDF Attached
                      </span>
                    )}
                  </div>
                </div>

                {/* ── Contextual Action Bar per Requirement 8 ─────────────────── */}
                <div style={{
                  padding: '12px 24px',
                  background: isActive ? 'rgba(15,79,44,0.03)' : 'var(--gray-bg)',
                  borderTop: '1px solid var(--gray-mid)',
                  display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                  flexWrap: 'wrap', gap: 10
                }}>
                  <div style={{ fontSize: '.75rem', fontWeight: 600, color: 'var(--gray-t)' }}>
                    {isActive && '🟢 Currently serving all student searches and reading sessions'}
                    {isDraft && '🟡 In staging: review or re-import policies before activating'}
                    {isArchived && '⚪ Preserved historical version: accessible for audit & comparison'}
                  </div>

                  <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                    {/* View Details button (all statuses) */}
                    <button
                      onClick={() => handleOpenDetails(v)}
                      style={{
                        padding: '7px 14px', borderRadius: 8, border: '1.5px solid var(--gray-mid)',
                        background: '#fff', color: 'var(--gray-dk)', fontWeight: 600, fontSize: '.8rem',
                        cursor: 'pointer', display: 'inline-flex', alignItems: 'center', gap: 6,
                        fontFamily: '"Plus Jakarta Sans",sans-serif'
                      }}
                    >
                      <Eye size={14} /> View Details
                    </button>

                    {/* ACTIVE contextual actions: [View Details] [Compare] */}
                    {isActive && (
                      <button
                        onClick={() => handleOpenCompare(null, v.id)}
                        style={{
                          padding: '7px 14px', borderRadius: 8, border: '1.5px solid var(--g-primary)',
                          background: 'var(--g-pale)', color: 'var(--g-primary)', fontWeight: 700, fontSize: '.8rem',
                          cursor: 'pointer', display: 'inline-flex', alignItems: 'center', gap: 6,
                          fontFamily: '"Plus Jakarta Sans",sans-serif'
                        }}
                      >
                        <GitCompare size={14} /> Compare
                      </button>
                    )}

                    {/* DRAFT contextual actions: [View Details] [Re-import] [Activate] */}
                    {isDraft && (
                      <>
                        <button
                          onClick={() => handleOpenReimport(v)}
                          style={{
                            padding: '7px 14px', borderRadius: 8, border: '1.5px solid #F59E0B',
                            background: '#FEF3C7', color: '#92400E', fontWeight: 700, fontSize: '.8rem',
                            cursor: 'pointer', display: 'inline-flex', alignItems: 'center', gap: 6,
                            fontFamily: '"Plus Jakarta Sans",sans-serif'
                          }}
                        >
                          <Upload size={14} /> Re-import
                        </button>

                        <button
                          onClick={() => setConfirmDialog({ type: 'activate', version: v })}
                          style={{
                            padding: '7px 16px', borderRadius: 8, border: 'none',
                            background: 'var(--g-primary)', color: '#fff', fontWeight: 700, fontSize: '.8rem',
                            cursor: 'pointer', display: 'inline-flex', alignItems: 'center', gap: 6,
                            fontFamily: '"Plus Jakarta Sans",sans-serif', boxShadow: '0 2px 6px rgba(15,79,44,0.2)'
                          }}
                        >
                          <Check size={14} /> Activate Version
                        </button>
                      </>
                    )}

                    {/* ARCHIVED / INACTIVE contextual actions: [View Details] [Compare] [Activate] */}
                    {isArchived && (
                      <>
                        <button
                          onClick={() => handleOpenCompare(v.id, activeVersion?.id)}
                          style={{
                            padding: '7px 14px', borderRadius: 8, border: '1.5px solid var(--gray-mid)',
                            background: '#fff', color: 'var(--gray-dk)', fontWeight: 600, fontSize: '.8rem',
                            cursor: 'pointer', display: 'inline-flex', alignItems: 'center', gap: 6,
                            fontFamily: '"Plus Jakarta Sans",sans-serif'
                          }}
                        >
                          <GitCompare size={14} /> Compare
                        </button>

                        <button
                          onClick={() => setConfirmDialog({ type: 'activate', version: v })}
                          style={{
                            padding: '7px 14px', borderRadius: 8, border: '1.5px solid var(--g-primary)',
                            background: 'var(--g-pale)', color: 'var(--g-primary)', fontWeight: 700, fontSize: '.8rem',
                            cursor: 'pointer', display: 'inline-flex', alignItems: 'center', gap: 6,
                            fontFamily: '"Plus Jakarta Sans",sans-serif'
                          }}
                        >
                          <Check size={14} /> Activate
                        </button>
                      </>
                    )}

                    {/* Development Delete Button */}
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        setConfirmDialog({ type: 'delete', version: v });
                      }}
                      title={`Delete ${v.label} (Development tool)`}
                      style={{
                        padding: '7px 12px', borderRadius: 8, border: '1.5px solid #FECACA',
                        background: '#FEF2F2', color: '#DC2626', fontWeight: 600, fontSize: '.8rem',
                        cursor: 'pointer', display: 'inline-flex', alignItems: 'center', gap: 5,
                        fontFamily: '"Plus Jakarta Sans",sans-serif', transition: 'all .15s'
                      }}
                      onMouseEnter={e => { e.currentTarget.style.background = '#DC2626'; e.currentTarget.style.color = '#fff'; e.currentTarget.style.borderColor = '#DC2626'; }}
                      onMouseLeave={e => { e.currentTarget.style.background = '#FEF2F2'; e.currentTarget.style.color = '#DC2626'; e.currentTarget.style.borderColor = '#FECACA'; }}
                    >
                      <Trash2 size={13} /> Delete
                    </button>
                  </div>
                </div>
              </div>
            );
          })
        )}
      </div>

      {/* ── CREATE NEW VERSION MODAL ────────────────────────────────────────── */}
      {showCreateModal && (
        <div style={{
          position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.5)', backdropFilter: 'blur(3px)',
          zIndex: 9999, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 20
        }}>
          <div style={{
            background: '#fff', borderRadius: 18, maxWidth: 520, width: '100%',
            boxShadow: '0 16px 40px rgba(0,0,0,0.2)', padding: 28, position: 'relative'
          }}>
            <button
              onClick={() => setShowCreateModal(false)}
              style={{ position: 'absolute', right: 20, top: 20, background: 'none', border: 'none', cursor: 'pointer', color: 'var(--gray-t)' }}
            >
              <X size={20} />
            </button>

            <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 16 }}>
              <div style={{ width: 38, height: 38, borderRadius: 10, background: 'var(--g-pale)', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--g-primary)' }}>
                <FilePlus size={20} />
              </div>
              <div>
                <h3 style={{ fontFamily: '"DM Serif Display",serif', fontSize: '1.3rem', color: 'var(--g-dark)', margin: 0 }}>
                  Create New Version
                </h3>
                <p style={{ fontSize: '.8rem', color: 'var(--gray-t)', margin: 0 }}>
                  Create a new handbook version record staged for policy ingestion.
                </p>
              </div>
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
              <div>
                <label style={{ fontSize: '.78rem', fontWeight: 700, color: 'var(--gray-t)', textTransform: 'uppercase', letterSpacing: '.06em', display: 'block', marginBottom: 5 }}>
                  Version Label / Edition
                </label>
                <input
                  type="text"
                  value={createForm.label}
                  onChange={e => setCreateForm(f => ({ ...f, label: e.target.value }))}
                  placeholder="e.g. Version 2.2 (2026 Revised)"
                  style={{ width: '100%', padding: '9px 12px', border: '1.5px solid var(--gray-mid)', borderRadius: 8, fontSize: '.88rem', outline: 'none', boxSizing: 'border-box' }}
                />
              </div>

              <div>
                <label style={{ fontSize: '.78rem', fontWeight: 700, color: 'var(--gray-t)', textTransform: 'uppercase', letterSpacing: '.06em', display: 'block', marginBottom: 5 }}>
                  Effective / Release Date
                </label>
                <input
                  type="date"
                  value={createForm.releaseDate}
                  onChange={e => setCreateForm(f => ({ ...f, releaseDate: e.target.value }))}
                  style={{ width: '100%', padding: '9px 12px', border: '1.5px solid var(--gray-mid)', borderRadius: 8, fontSize: '.88rem', outline: 'none', boxSizing: 'border-box' }}
                />
              </div>

              <div>
                <label style={{ fontSize: '.78rem', fontWeight: 700, color: 'var(--gray-t)', textTransform: 'uppercase', letterSpacing: '.06em', display: 'block', marginBottom: 5 }}>
                  Initial Status
                </label>
                <div style={{ display: 'flex', gap: 12 }}>
                  <label style={{
                    flex: 1, padding: '10px 14px', borderRadius: 8, border: `1.5px solid ${createForm.status === 'draft' ? '#F59E0B' : 'var(--gray-mid)'}`,
                    background: createForm.status === 'draft' ? '#FEF3C7' : '#fff', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 8, fontSize: '.84rem', fontWeight: 600
                  }}>
                    <input
                      type="radio"
                      name="status"
                      value="draft"
                      checked={createForm.status === 'draft'}
                      onChange={() => setCreateForm(f => ({ ...f, status: 'draft' }))}
                    />
                    <span>Draft (Recommended)</span>
                  </label>

                  <label style={{
                    flex: 1, padding: '10px 14px', borderRadius: 8, border: `1.5px solid ${createForm.status === 'active' ? 'var(--g-primary)' : 'var(--gray-mid)'}`,
                    background: createForm.status === 'active' ? 'var(--g-pale)' : '#fff', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 8, fontSize: '.84rem', fontWeight: 600
                  }}>
                    <input
                      type="radio"
                      name="status"
                      value="active"
                      checked={createForm.status === 'active'}
                      onChange={() => setCreateForm(f => ({ ...f, status: 'active' }))}
                    />
                    <span>Active Immediately</span>
                  </label>
                </div>
              </div>

              <div>
                <label style={{ fontSize: '.78rem', fontWeight: 700, color: 'var(--gray-t)', textTransform: 'uppercase', letterSpacing: '.06em', display: 'block', marginBottom: 5 }}>
                  Description / Purpose
                </label>
                <textarea
                  rows={2}
                  value={createForm.description}
                  onChange={e => setCreateForm(f => ({ ...f, description: e.target.value }))}
                  placeholder="Summary of institutional changes, Board of Regents resolutions, etc."
                  style={{ width: '100%', padding: '9px 12px', border: '1.5px solid var(--gray-mid)', borderRadius: 8, fontSize: '.85rem', outline: 'none', resize: 'vertical', boxSizing: 'border-box' }}
                />
              </div>

              <div>
                <label style={{ fontSize: '.78rem', fontWeight: 700, color: 'var(--gray-t)', textTransform: 'uppercase', letterSpacing: '.06em', display: 'block', marginBottom: 5 }}>
                  Change Notes / Changelog
                </label>
                <textarea
                  rows={2}
                  value={createForm.changeNotes}
                  onChange={e => setCreateForm(f => ({ ...f, changeNotes: e.target.value }))}
                  placeholder="Detailed breakdown of modified clauses or new student rights..."
                  style={{ width: '100%', padding: '9px 12px', border: '1.5px solid var(--gray-mid)', borderRadius: 8, fontSize: '.85rem', outline: 'none', resize: 'vertical', boxSizing: 'border-box' }}
                />
              </div>
            </div>

            {createForm.status === 'active' && (
              <div style={{ background: '#FEF9E7', border: '1px solid #FDE68A', borderRadius: 8, padding: '9px 12px', marginTop: 14, fontSize: '.78rem', color: '#92400E' }}>
                ⚠️ Setting this version to Active immediately will archive the current active version ({activeVersion?.label || 'none'}).
              </div>
            )}

            <div style={{ display: 'flex', gap: 10, justifyContent: 'flex-end', marginTop: 22 }}>
              <button
                onClick={() => setShowCreateModal(false)}
                style={{ padding: '9px 18px', borderRadius: 8, border: '1.5px solid var(--gray-mid)', background: '#fff', color: 'var(--gray-dk)', cursor: 'pointer', fontWeight: 600, fontSize: '.85rem' }}
              >
                Cancel
              </button>
              <button
                onClick={handleCreateVersion}
                disabled={savingCreate}
                style={{
                  padding: '9px 22px', borderRadius: 8, border: 'none',
                  background: 'var(--g-primary)', color: '#fff', cursor: savingCreate ? 'not-allowed' : 'pointer',
                  fontWeight: 700, fontSize: '.85rem', display: 'inline-flex', alignItems: 'center', gap: 8,
                  opacity: savingCreate ? 0.7 : 1
                }}
              >
                {savingCreate ? <RefreshCw size={14} style={{ animation: 'spin 1s linear infinite' }} /> : <Save size={14} />}
                {savingCreate ? 'Creating...' : 'Create Version'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── 4. VERSION DETAILS MODAL (REQUIREMENT 4) ────────────────────────── */}
      {detailsVersion && (
        <div style={{
          position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.55)', backdropFilter: 'blur(3px)',
          zIndex: 9999, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 20
        }}>
          <div style={{
            background: '#fff', borderRadius: 20, maxWidth: 840, width: '100%', maxHeight: '90vh',
            boxShadow: '0 20px 50px rgba(0,0,0,0.25)', display: 'flex', flexDirection: 'column',
            overflow: 'hidden', position: 'relative'
          }}>
            {/* Modal Header */}
            <div style={{
              padding: '22px 28px', borderBottom: '1.5px solid var(--gray-mid)',
              background: 'var(--gray-bg)', display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 16
            }}>
              <div>
                <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                  <h2 style={{ fontFamily: '"DM Serif Display",serif', fontSize: '1.45rem', color: 'var(--g-dark)', margin: 0 }}>
                    {detailsVersion.label}
                  </h2>
                  <span style={{
                    fontSize: '.72rem', fontWeight: 800, padding: '3px 10px', borderRadius: 999,
                    background: detailsVersion.status === 'active' ? '#ECFDF5' : detailsVersion.status === 'draft' ? '#FEF3C7' : '#F3F4F6',
                    color: detailsVersion.status === 'active' ? '#065F46' : detailsVersion.status === 'draft' ? '#92400E' : '#4B5563',
                    textTransform: 'uppercase', letterSpacing: '.05em'
                  }}>
                    {detailsVersion.status}
                  </span>
                </div>
                <div style={{ fontSize: '.8rem', color: 'var(--gray-t)', marginTop: 2 }}>
                  Handbook Version Specification & Ordinance Records
                </div>
              </div>

              <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                {detailsVersion.status !== 'active' && (
                  <button
                    onClick={() => {
                      setConfirmDialog({ type: 'activate', version: detailsVersion });
                    }}
                    style={{
                      padding: '7px 14px', borderRadius: 8, border: 'none', background: 'var(--g-primary)',
                      color: '#fff', fontWeight: 700, fontSize: '.8rem', cursor: 'pointer',
                      display: 'inline-flex', alignItems: 'center', gap: 6
                    }}
                  >
                    <Check size={14} /> Activate Version
                  </button>
                )}

                {detailsVersion.status === 'draft' && (
                  <button
                    onClick={() => {
                      const v = detailsVersion;
                      setDetailsVersion(null);
                      handleOpenReimport(v);
                    }}
                    style={{
                      padding: '7px 14px', borderRadius: 8, border: '1.5px solid #F59E0B',
                      background: '#FEF3C7', color: '#92400E', fontWeight: 700, fontSize: '.8rem',
                      cursor: 'pointer', display: 'inline-flex', alignItems: 'center', gap: 6
                    }}
                  >
                    <Upload size={14} /> Re-import PDF
                  </button>
                )}

                <button
                  onClick={() => {
                    const v = detailsVersion;
                    setConfirmDialog({ type: 'delete', version: v });
                  }}
                  title="Delete this version (Development tool)"
                  style={{
                    padding: '7px 12px', borderRadius: 8, border: '1.5px solid #FECACA',
                    background: '#FEF2F2', color: '#DC2626', fontWeight: 600, fontSize: '.8rem',
                    cursor: 'pointer', display: 'inline-flex', alignItems: 'center', gap: 5,
                    fontFamily: '"Plus Jakarta Sans",sans-serif', transition: 'all .15s'
                  }}
                  onMouseEnter={e => { e.currentTarget.style.background = '#DC2626'; e.currentTarget.style.color = '#fff'; e.currentTarget.style.borderColor = '#DC2626'; }}
                  onMouseLeave={e => { e.currentTarget.style.background = '#FEF2F2'; e.currentTarget.style.color = '#DC2626'; e.currentTarget.style.borderColor = '#FECACA'; }}
                >
                  <Trash2 size={13} /> Delete
                </button>

                <button
                  onClick={() => setDetailsVersion(null)}
                  style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--gray-t)', padding: 4 }}
                >
                  <X size={22} />
                </button>
              </div>
            </div>

            {/* Modal Body */}
            <div style={{ flex: 1, overflowY: 'auto', padding: '24px 28px' }}>
              {/* Key metadata grid */}
              <div style={{
                display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))',
                gap: 14, marginBottom: 20, background: '#F8FAFC', padding: 18, borderRadius: 14, border: '1px solid var(--gray-mid)'
              }}>
                <div>
                  <div style={{ fontSize: '.72rem', fontWeight: 700, color: 'var(--gray-t)', textTransform: 'uppercase' }}>Version Title</div>
                  <div style={{ fontSize: '.9rem', fontWeight: 700, color: 'var(--g-dark)', marginTop: 2 }}>{detailsVersion.label}</div>
                </div>

                <div>
                  <div style={{ fontSize: '.72rem', fontWeight: 700, color: 'var(--gray-t)', textTransform: 'uppercase' }}>Status</div>
                  <div style={{ fontSize: '.9rem', fontWeight: 700, color: detailsVersion.status === 'active' ? '#059669' : detailsVersion.status === 'draft' ? '#D97706' : '#6B7280', marginTop: 2 }}>
                    {detailsVersion.status.toUpperCase()}
                  </div>
                </div>

                <div>
                  <div style={{ fontSize: '.72rem', fontWeight: 700, color: 'var(--gray-t)', textTransform: 'uppercase' }}>Effective / Release Date</div>
                  <div style={{ fontSize: '.9rem', fontWeight: 600, color: 'var(--gray-dk)', marginTop: 2 }}>{detailsVersion.release_date || detailsVersion.releaseDate}</div>
                </div>

                <div>
                  <div style={{ fontSize: '.72rem', fontWeight: 700, color: 'var(--gray-t)', textTransform: 'uppercase' }}>Upload Date</div>
                  <div style={{ fontSize: '.9rem', fontWeight: 600, color: 'var(--gray-dk)', marginTop: 2 }}>
                    {detailsVersion.created_at ? new Date(detailsVersion.created_at).toLocaleDateString(undefined, { year: 'numeric', month: 'short', day: 'numeric' }) : 'N/A'}
                  </div>
                </div>

                <div>
                  <div style={{ fontSize: '.72rem', fontWeight: 700, color: 'var(--gray-t)', textTransform: 'uppercase' }}>Prepared By</div>
                  <div style={{ fontSize: '.9rem', fontWeight: 600, color: 'var(--gray-dk)', marginTop: 2 }}>{detailsVersion.edited_by || detailsVersion.editedBy || 'Admin User'}</div>
                </div>

                <div>
                  <div style={{ fontSize: '.72rem', fontWeight: 700, color: 'var(--gray-t)', textTransform: 'uppercase' }}>Policy / Section Count</div>
                  <div style={{ fontSize: '.9rem', fontWeight: 800, color: 'var(--g-primary)', marginTop: 2 }}>
                    {detailsVersion.policy_count !== undefined ? detailsVersion.policy_count : detailsVersion.sections} Policies
                  </div>
                </div>

                <div style={{ gridColumn: 'span 2' }}>
                  <div style={{ fontSize: '.72rem', fontWeight: 700, color: 'var(--gray-t)', textTransform: 'uppercase' }}>Source PDF</div>
                  <div style={{ fontSize: '.85rem', color: 'var(--gray-dk)', marginTop: 3, display: 'flex', alignItems: 'center', gap: 8 }}>
                    {detailsVersion.file_path ? (
                      <a
                        href={`/api/handbook/active-pdf`}
                        target="_blank"
                        rel="noreferrer"
                        style={{ display: 'inline-flex', alignItems: 'center', gap: 5, color: 'var(--g-primary)', fontWeight: 700, textDecoration: 'none' }}
                      >
                        <Download size={14} /> {detailsVersion.file_path} (View / Download)
                      </a>
                    ) : (
                      <span style={{ color: 'var(--gray-t)' }}>Default institutional handbook.pdf</span>
                    )}
                  </div>
                </div>
              </div>

              {/* Description & Change Notes */}
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16, marginBottom: 24 }}>
                <div style={{ background: '#fff', border: '1px solid var(--gray-mid)', borderRadius: 12, padding: 14 }}>
                  <div style={{ fontSize: '.75rem', fontWeight: 700, color: 'var(--gray-t)', textTransform: 'uppercase', marginBottom: 4 }}>
                    Description
                  </div>
                  <div style={{ fontSize: '.85rem', color: 'var(--gray-dk)', lineHeight: 1.6 }}>
                    {detailsVersion.description || 'No description provided.'}
                  </div>
                </div>

                <div style={{ background: '#fff', border: '1px solid var(--gray-mid)', borderRadius: 12, padding: 14 }}>
                  <div style={{ fontSize: '.75rem', fontWeight: 700, color: 'var(--gray-t)', textTransform: 'uppercase', marginBottom: 4 }}>
                    Change Notes / Changelog
                  </div>
                  <div style={{ fontSize: '.85rem', color: 'var(--gray-dk)', lineHeight: 1.6 }}>
                    {detailsVersion.change_notes || detailsVersion.changeNotes || 'No specific change notes recorded.'}
                  </div>
                </div>
              </div>

              {/* Policies Belonging to this Version */}
              <div style={{ marginTop: 10 }}>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12, flexWrap: 'wrap', gap: 10 }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                    <BookOpen size={18} color="var(--g-primary)" />
                    <h4 style={{ fontFamily: '"DM Serif Display",serif', fontSize: '1.15rem', color: 'var(--g-dark)', margin: 0 }}>
                      Policies Belonging to {detailsVersion.label} ({versionPolicies.length})
                    </h4>
                  </div>

                  <div style={{ position: 'relative', width: 240 }}>
                    <Search size={14} style={{ position: 'absolute', left: 10, top: '50%', transform: 'translateY(-50%)', color: 'var(--gray-t)' }} />
                    <input
                      type="text"
                      value={policySearchQ}
                      onChange={e => setPolicySearchQ(e.target.value)}
                      placeholder="Search policies in version..."
                      style={{
                        width: '100%', padding: '7px 10px 7px 30px', border: '1.5px solid var(--gray-mid)',
                        borderRadius: 8, fontSize: '.8rem', outline: 'none', boxSizing: 'border-box'
                      }}
                    />
                  </div>
                </div>

                {loadingPolicies ? (
                  <div style={{ padding: '30px', textAlign: 'center', color: 'var(--gray-t)', fontSize: '.85rem' }}>
                    <RefreshCw size={20} style={{ animation: 'spin 1s linear infinite', margin: '0 auto 8px' }} />
                    Loading policies belonging to this version...
                  </div>
                ) : filteredModalPolicies.length === 0 ? (
                  <div style={{ padding: '30px', textAlign: 'center', color: 'var(--gray-t)', background: '#F9FAFB', borderRadius: 12, border: '1px dashed var(--gray-mid)', fontSize: '.85rem' }}>
                    {versionPolicies.length === 0
                      ? 'No policies attached to this version yet. Click "Re-import PDF" or use Handbook Ingestion to populate.'
                      : 'No policies match your search.'}
                  </div>
                ) : (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                    {filteredModalPolicies.map(p => {
                      const isExpanded = expandedPolicyId === p.id;
                      const badge = BADGE_MAP[p.catKey] || { bg: '#F3F4F6', color: '#374151' };

                      return (
                        <div
                          key={p.id}
                          style={{
                            border: '1px solid var(--gray-mid)', borderRadius: 10,
                            background: isExpanded ? '#F8FAFC' : '#fff', overflow: 'hidden'
                          }}
                        >
                          <div
                            onClick={() => setExpandedPolicyId(isExpanded ? null : p.id)}
                            style={{
                              padding: '12px 16px', display: 'flex', alignItems: 'center',
                              justifyContent: 'space-between', cursor: 'pointer', gap: 12
                            }}
                          >
                            <div style={{ display: 'flex', alignItems: 'center', gap: 12, flex: 1, minWidth: 0 }}>
                              <span style={{
                                fontFamily: 'monospace', fontSize: '.78rem', fontWeight: 800,
                                background: '#E2E8F0', color: '#1E293B', padding: '3px 8px', borderRadius: 6
                              }}>
                                {p.ref}
                              </span>
                              <div style={{ fontWeight: 600, fontSize: '.88rem', color: 'var(--g-dark)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                                {p.title}
                              </div>
                            </div>

                            <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexShrink: 0 }}>
                              <span style={{ fontSize: '.72rem', fontWeight: 700, padding: '2px 8px', borderRadius: 999, background: badge.bg, color: badge.color }}>
                                {p.cat}
                              </span>
                              {p.page && (
                                <span style={{ fontSize: '.75rem', color: 'var(--gray-t)' }}>
                                  Page {p.page}
                                </span>
                              )}
                              {isExpanded ? <ChevronUp size={16} color="var(--gray-t)" /> : <ChevronDown size={16} color="var(--gray-t)" />}
                            </div>
                          </div>

                          {isExpanded && (
                            <div style={{ padding: '0 16px 14px', borderTop: '1px solid #E2E8F0', fontSize: '.82rem', color: 'var(--gray-dk)', lineHeight: 1.6 }}>
                              <p style={{ margin: '10px 0 6px', fontWeight: 600, color: 'var(--g-dark)' }}>Summary:</p>
                              <div style={{ background: '#fff', padding: '8px 12px', borderRadius: 6, border: '1px solid #E2E8F0', marginBottom: 10 }}>
                                {p.summary || p.desc || 'No summary available.'}
                              </div>

                              {p.steps && p.steps.length > 0 && (
                                <div>
                                  <span style={{ fontWeight: 600, color: 'var(--g-dark)' }}>Procedural Steps:</span>
                                  <ol style={{ margin: '6px 0 0', paddingLeft: 20 }}>
                                    {p.steps.map((st, sIdx) => (
                                      <li key={sIdx}>{st}</li>
                                    ))}
                                  </ol>
                                </div>
                              )}
                            </div>
                          )}
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
            </div>

            {/* Modal Footer */}
            <div style={{
              padding: '14px 28px', borderTop: '1px solid var(--gray-mid)',
              background: '#fff', display: 'flex', justifyContent: 'flex-end', gap: 10
            }}>
              <button
                onClick={() => setDetailsVersion(null)}
                style={{ padding: '8px 20px', borderRadius: 8, border: '1.5px solid var(--gray-mid)', background: '#fff', color: 'var(--gray-dk)', fontWeight: 600, cursor: 'pointer' }}
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── 5. VERSION COMPARISON MODAL (REQUIREMENT 5) ──────────────────────── */}
      {showCompareModal && (
        <div style={{
          position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.55)', backdropFilter: 'blur(3px)',
          zIndex: 9999, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 20
        }}>
          <div style={{
            background: '#fff', borderRadius: 20, maxWidth: 900, width: '100%', maxHeight: '90vh',
            boxShadow: '0 20px 50px rgba(0,0,0,0.25)', display: 'flex', flexDirection: 'column',
            overflow: 'hidden', position: 'relative'
          }}>
            {/* Compare Header */}
            <div style={{
              padding: '20px 28px', borderBottom: '1.5px solid var(--gray-mid)',
              background: 'var(--gray-bg)', display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 16
            }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                <div style={{ width: 36, height: 36, borderRadius: 10, background: 'var(--g-pale)', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--g-primary)' }}>
                  <GitCompare size={20} />
                </div>
                <div>
                  <h3 style={{ fontFamily: '"DM Serif Display",serif', fontSize: '1.35rem', color: 'var(--g-dark)', margin: 0 }}>
                    Deterministic Version Comparison
                  </h3>
                  <p style={{ fontSize: '.8rem', color: 'var(--gray-t)', margin: 0 }}>
                    Deterministic policy-by-policy audit diff across editions (Added, Modified, Removed, Unchanged).
                  </p>
                </div>
              </div>

              <button
                onClick={() => setShowCompareModal(false)}
                style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--gray-t)' }}
              >
                <X size={22} />
              </button>
            </div>

            {/* Version Selectors */}
            <div style={{ padding: '16px 28px', background: '#F8FAFC', borderBottom: '1px solid var(--gray-mid)', display: 'flex', alignItems: 'center', gap: 16, flexWrap: 'wrap' }}>
              <div style={{ flex: 1, minWidth: 200 }}>
                <label style={{ fontSize: '.72rem', fontWeight: 700, color: 'var(--gray-t)', textTransform: 'uppercase', display: 'block', marginBottom: 4 }}>
                  Base Version (From)
                </label>
                <select
                  value={compareFromId}
                  onChange={e => {
                    setCompareFromId(e.target.value);
                    if (e.target.value && compareToId) runCompare(e.target.value, compareToId);
                  }}
                  style={{ width: '100%', padding: '8px 10px', borderRadius: 8, border: '1.5px solid var(--gray-mid)', fontSize: '.85rem', outline: 'none' }}
                >
                  <option value="">Select base version...</option>
                  {versions.map(v => (
                    <option key={v.id} value={v.id}>
                      {v.label} ({v.status})
                    </option>
                  ))}
                </select>
              </div>

              <div style={{ display: 'flex', alignItems: 'center', paddingTop: 18 }}>
                <ArrowRight size={20} color="var(--gray-t)" />
              </div>

              <div style={{ flex: 1, minWidth: 200 }}>
                <label style={{ fontSize: '.72rem', fontWeight: 700, color: 'var(--gray-t)', textTransform: 'uppercase', display: 'block', marginBottom: 4 }}>
                  Target Version (To)
                </label>
                <select
                  value={compareToId}
                  onChange={e => {
                    setCompareToId(e.target.value);
                    if (compareFromId && e.target.value) runCompare(compareFromId, e.target.value);
                  }}
                  style={{ width: '100%', padding: '8px 10px', borderRadius: 8, border: '1.5px solid var(--gray-mid)', fontSize: '.85rem', outline: 'none' }}
                >
                  <option value="">Select target version...</option>
                  {versions.map(v => (
                    <option key={v.id} value={v.id}>
                      {v.label} ({v.status})
                    </option>
                  ))}
                </select>
              </div>

              <div style={{ paddingTop: 18 }}>
                <button
                  onClick={() => runCompare(compareFromId, compareToId)}
                  disabled={comparing || !compareFromId || !compareToId}
                  style={{
                    padding: '8px 16px', borderRadius: 8, border: 'none', background: 'var(--g-primary)',
                    color: '#fff', fontWeight: 700, fontSize: '.82rem', cursor: 'pointer',
                    display: 'inline-flex', alignItems: 'center', gap: 6, opacity: comparing ? 0.7 : 1
                  }}
                >
                  {comparing ? <RefreshCw size={14} style={{ animation: 'spin 1s linear infinite' }} /> : <GitCompare size={14} />}
                  {comparing ? 'Comparing...' : 'Run Diff'}
                </button>
              </div>
            </div>

            {/* Compare Content */}
            <div style={{ flex: 1, overflowY: 'auto', padding: '20px 28px' }}>
              {comparing ? (
                <div style={{ padding: 40, textAlign: 'center', color: 'var(--gray-t)' }}>
                  <RefreshCw size={24} style={{ animation: 'spin 1s linear infinite', margin: '0 auto 10px' }} />
                  Analyzing differences between versions...
                </div>
              ) : !compareResult ? (
                <div style={{ padding: 40, textAlign: 'center', color: 'var(--gray-t)', fontSize: '.88rem' }}>
                  Please select two different versions above and click "Run Diff" to evaluate changes.
                </div>
              ) : (
                <div>
                  {/* Summary Metric Pills */}
                  <div style={{ display: 'flex', gap: 12, marginBottom: 20, flexWrap: 'wrap' }}>
                    <button
                      onClick={() => setCompareFilter('all')}
                      style={{
                        padding: '8px 14px', borderRadius: 10, border: `1.5px solid ${compareFilter === 'all' ? 'var(--g-primary)' : 'var(--gray-mid)'}`,
                        background: compareFilter === 'all' ? 'var(--g-pale)' : '#fff', color: compareFilter === 'all' ? 'var(--g-primary)' : 'var(--gray-dk)',
                        fontWeight: 700, fontSize: '.82rem', cursor: 'pointer'
                      }}
                    >
                      All Differences ({compareResult.summary.added + compareResult.summary.modified + compareResult.summary.removed})
                    </button>

                    <button
                      onClick={() => setCompareFilter('added')}
                      style={{
                        padding: '8px 14px', borderRadius: 10, border: `1.5px solid ${compareFilter === 'added' ? '#10B981' : 'var(--gray-mid)'}`,
                        background: compareFilter === 'added' ? '#ECFDF5' : '#fff', color: '#065F46',
                        fontWeight: 700, fontSize: '.82rem', cursor: 'pointer', display: 'inline-flex', alignItems: 'center', gap: 6
                      }}
                    >
                      <span style={{ width: 8, height: 8, borderRadius: '50%', background: '#10B981' }} />
                      +{compareResult.summary.added} Added
                    </button>

                    <button
                      onClick={() => setCompareFilter('modified')}
                      style={{
                        padding: '8px 14px', borderRadius: 10, border: `1.5px solid ${compareFilter === 'modified' ? '#F59E0B' : 'var(--gray-mid)'}`,
                        background: compareFilter === 'modified' ? '#FFFBEB' : '#fff', color: '#92400E',
                        fontWeight: 700, fontSize: '.82rem', cursor: 'pointer', display: 'inline-flex', alignItems: 'center', gap: 6
                      }}
                    >
                      <span style={{ width: 8, height: 8, borderRadius: '50%', background: '#F59E0B' }} />
                      ~{compareResult.summary.modified} Modified
                    </button>

                    <button
                      onClick={() => setCompareFilter('removed')}
                      style={{
                        padding: '8px 14px', borderRadius: 10, border: `1.5px solid ${compareFilter === 'removed' ? '#EF4444' : 'var(--gray-mid)'}`,
                        background: compareFilter === 'removed' ? '#FEF2F2' : '#fff', color: '#991B1B',
                        fontWeight: 700, fontSize: '.82rem', cursor: 'pointer', display: 'inline-flex', alignItems: 'center', gap: 6
                      }}
                    >
                      <span style={{ width: 8, height: 8, borderRadius: '50%', background: '#EF4444' }} />
                      -{compareResult.summary.removed} Removed
                    </button>

                    <button
                      onClick={() => setCompareFilter('unchanged')}
                      style={{
                        padding: '8px 14px', borderRadius: 10, border: `1.5px solid ${compareFilter === 'unchanged' ? '#6B7280' : 'var(--gray-mid)'}`,
                        background: compareFilter === 'unchanged' ? '#F3F4F6' : '#fff', color: '#374151',
                        fontWeight: 700, fontSize: '.82rem', cursor: 'pointer'
                      }}
                    >
                      ={compareResult.summary.unchanged} Unchanged
                    </button>
                  </div>

                  {/* Diff list */}
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
                    {/* ADDED */}
                    {(compareFilter === 'all' || compareFilter === 'added') && compareResult.diff.added.map(item => (
                      <div key={item.ref} style={{ border: '1.5px solid #A7F3D0', background: '#F0FDF4', borderRadius: 12, padding: 16 }}>
                        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 10, marginBottom: 6 }}>
                          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                            <span style={{ background: '#10B981', color: '#fff', fontSize: '.7rem', fontWeight: 800, padding: '2px 8px', borderRadius: 6, textTransform: 'uppercase' }}>
                              + Added in {compareResult.toVersion.label}
                            </span>
                            <span style={{ fontFamily: 'monospace', fontWeight: 700, fontSize: '.85rem', color: '#065F46' }}>
                              {item.ref}
                            </span>
                            <span style={{ fontWeight: 700, fontSize: '.9rem', color: 'var(--g-dark)' }}>
                              {item.title}
                            </span>
                          </div>
                          {item.page && <span style={{ fontSize: '.75rem', color: '#065F46' }}>Page {item.page}</span>}
                        </div>
                        <p style={{ fontSize: '.82rem', color: '#064E3B', margin: 0, lineHeight: 1.5 }}>
                          {item.summary || 'New policy provision added in this edition.'}
                        </p>
                      </div>
                    ))}

                    {/* MODIFIED */}
                    {(compareFilter === 'all' || compareFilter === 'modified') && compareResult.diff.modified.map(item => (
                      <div key={item.ref} style={{ border: '1.5px solid #FDE68A', background: '#FFFDF5', borderRadius: 12, padding: 16 }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 10 }}>
                          <span style={{ background: '#F59E0B', color: '#fff', fontSize: '.7rem', fontWeight: 800, padding: '2px 8px', borderRadius: 6, textTransform: 'uppercase' }}>
                            ~ Modified
                          </span>
                          <span style={{ fontFamily: 'monospace', fontWeight: 700, fontSize: '.85rem', color: '#92400E' }}>
                            {item.ref}
                          </span>
                          <span style={{ fontWeight: 700, fontSize: '.9rem', color: 'var(--g-dark)' }}>
                            {item.toTitle}
                          </span>
                        </div>

                        {/* Breakdown of field changes */}
                        <div style={{ display: 'flex', flexDirection: 'column', gap: 8, background: '#fff', padding: 12, borderRadius: 8, border: '1px solid #FDE68A' }}>
                          {Object.entries(item.changes).map(([field, delta]) => (
                            <div key={field} style={{ fontSize: '.8rem', lineHeight: 1.5 }}>
                              <span style={{ fontWeight: 700, color: '#92400E', textTransform: 'capitalize' }}>{field}: </span>
                              <div style={{ display: 'flex', gap: 10, marginTop: 4 }}>
                                <div style={{ flex: 1, background: '#FEF2F2', padding: '6px 10px', borderRadius: 6, color: '#991B1B', border: '1px solid #FECACA' }}>
                                  <span style={{ fontSize: '.7rem', fontWeight: 700, display: 'block' }}>From ({compareResult.fromVersion.label}):</span>
                                  {typeof delta.from === 'object' ? JSON.stringify(delta.from) : (delta.from || '—')}
                                </div>
                                <div style={{ flex: 1, background: '#ECFDF5', padding: '6px 10px', borderRadius: 6, color: '#065F46', border: '1px solid #A7F3D0' }}>
                                  <span style={{ fontSize: '.7rem', fontWeight: 700, display: 'block' }}>To ({compareResult.toVersion.label}):</span>
                                  {typeof delta.to === 'object' ? JSON.stringify(delta.to) : (delta.to || '—')}
                                </div>
                              </div>
                            </div>
                          ))}
                        </div>
                      </div>
                    ))}

                    {/* REMOVED */}
                    {(compareFilter === 'all' || compareFilter === 'removed') && compareResult.diff.removed.map(item => (
                      <div key={item.ref} style={{ border: '1.5px solid #FECACA', background: '#FEF2F2', borderRadius: 12, padding: 16 }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 6 }}>
                          <span style={{ background: '#EF4444', color: '#fff', fontSize: '.7rem', fontWeight: 800, padding: '2px 8px', borderRadius: 6, textTransform: 'uppercase' }}>
                            - Removed in {compareResult.toVersion.label}
                          </span>
                          <span style={{ fontFamily: 'monospace', fontWeight: 700, fontSize: '.85rem', color: '#991B1B' }}>
                            {item.ref}
                          </span>
                          <span style={{ fontWeight: 700, fontSize: '.9rem', color: 'var(--g-dark)' }}>
                            {item.title}
                          </span>
                        </div>
                        <p style={{ fontSize: '.82rem', color: '#991B1B', margin: 0 }}>
                          Present in {compareResult.fromVersion.label} but omitted or superseded in {compareResult.toVersion.label}.
                        </p>
                      </div>
                    ))}

                    {/* UNCHANGED */}
                    {compareFilter === 'unchanged' && compareResult.diff.unchanged.map(item => (
                      <div key={item.ref} style={{ border: '1px solid var(--gray-mid)', background: '#fff', borderRadius: 10, padding: '10px 16px', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                          <Check size={14} color="#10B981" />
                          <span style={{ fontFamily: 'monospace', fontWeight: 700, fontSize: '.82rem', color: 'var(--gray-dk)' }}>{item.ref}</span>
                          <span style={{ fontSize: '.85rem', color: 'var(--gray-dk)' }}>{item.title}</span>
                        </div>
                        <span style={{ fontSize: '.75rem', color: 'var(--gray-t)' }}>{item.cat}</span>
                      </div>
                    ))}

                    {compareResult.diff.added.length === 0 && compareResult.diff.modified.length === 0 && compareResult.diff.removed.length === 0 && (
                      <div style={{ padding: 30, textAlign: 'center', color: '#065F46', background: '#ECFDF5', borderRadius: 12, border: '1px solid #A7F3D0' }}>
                        🎉 Both versions are identical across all policy provisions!
                      </div>
                    )}
                  </div>
                </div>
              )}
            </div>

            {/* Compare Footer */}
            <div style={{ padding: '14px 28px', borderTop: '1px solid var(--gray-mid)', background: '#fff', display: 'flex', justifyContent: 'flex-end' }}>
              <button
                onClick={() => setShowCompareModal(false)}
                style={{ padding: '8px 20px', borderRadius: 8, border: '1.5px solid var(--gray-mid)', background: '#fff', color: 'var(--gray-dk)', fontWeight: 600, cursor: 'pointer' }}
              >
                Done
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── 3. RE-IMPORT MODAL (REQUIREMENT 3) ───────────────────────────────── */}
      {reimportVersion && (
        <div style={{
          position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.55)', backdropFilter: 'blur(3px)',
          zIndex: 9999, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 20
        }}>
          <div style={{
            background: '#fff', borderRadius: 20, maxWidth: 580, width: '100%',
            boxShadow: '0 20px 50px rgba(0,0,0,0.25)', padding: 28, position: 'relative'
          }}>
            <button
              onClick={() => setReimportVersion(null)}
              style={{ position: 'absolute', right: 20, top: 20, background: 'none', border: 'none', cursor: 'pointer', color: 'var(--gray-t)' }}
            >
              <X size={20} />
            </button>

            <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 16 }}>
              <div style={{ width: 40, height: 40, borderRadius: 10, background: '#FEF3C7', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#B45309' }}>
                <Upload size={20} />
              </div>
              <div>
                <h3 style={{ fontFamily: '"DM Serif Display",serif', fontSize: '1.3rem', color: 'var(--g-dark)', margin: 0 }}>
                  Re-import Handbook into {reimportVersion.label}
                </h3>
                <p style={{ fontSize: '.8rem', color: 'var(--gray-t)', margin: 0 }}>
                  Version number & ID will remain unchanged. Missing policies will be updated or appended.
                </p>
              </div>
            </div>

            <div style={{ background: '#FEF9E7', border: '1px solid #FDE68A', borderRadius: 10, padding: '10px 14px', marginBottom: 18, fontSize: '.8rem', color: '#92400E', lineHeight: 1.5 }}>
              💡 <strong>Re-import Safety Rule:</strong> Re-importing updates policy content and prevents duplicate reference codes under <strong>{reimportVersion.label}</strong>. It does NOT create a new version number.
            </div>

            {/* File Upload Zone */}
            <input
              type="file"
              ref={reimportFileInputRef}
              accept="application/pdf,.pdf"
              style={{ display: 'none' }}
              onChange={e => {
                if (e.target.files && e.target.files[0]) {
                  handleProcessReimportPdf(e.target.files[0]);
                }
              }}
            />

            {!reimportFile ? (
              <div
                onClick={() => reimportFileInputRef.current?.click()}
                style={{
                  border: '2px dashed var(--gray-mid)', borderRadius: 12, padding: '32px 20px',
                  textAlign: 'center', cursor: 'pointer', background: '#F8FAFC', transition: 'border .2s'
                }}
                onMouseEnter={e => e.currentTarget.style.borderColor = 'var(--g-primary)'}
                onMouseLeave={e => e.currentTarget.style.borderColor = 'var(--gray-mid)'}
              >
                <Upload size={36} color="var(--gray-t)" style={{ margin: '0 auto 10px' }} />
                <div style={{ fontWeight: 700, fontSize: '.88rem', color: 'var(--g-dark)' }}>
                  Click to select new handbook PDF
                </div>
                <div style={{ fontSize: '.78rem', color: 'var(--gray-t)', marginTop: 4 }}>
                  Maximum file size: 25MB (.pdf only)
                </div>
              </div>
            ) : (
              <div style={{ border: '1px solid #C2E0CE', background: 'var(--g-pale)', borderRadius: 12, padding: 16 }}>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                    <FileText size={20} color="var(--g-primary)" />
                    <div>
                      <div style={{ fontWeight: 700, fontSize: '.88rem', color: 'var(--g-dark)' }}>{reimportFile.name}</div>
                      <div style={{ fontSize: '.75rem', color: 'var(--gray-t)' }}>{(reimportFile.size / (1024 * 1024)).toFixed(2)} MB</div>
                    </div>
                  </div>

                  <button
                    onClick={() => {
                      setReimportFile(null);
                      setReimportExtracted(null);
                      if (reimportFileInputRef.current) reimportFileInputRef.current.value = '';
                    }}
                    style={{ background: 'none', border: 'none', color: '#DC2626', cursor: 'pointer', fontSize: '.78rem', fontWeight: 700 }}
                  >
                    Change
                  </button>
                </div>

                {reimportProcessing && (
                  <div style={{ marginTop: 12, fontSize: '.8rem', color: 'var(--g-primary)', display: 'flex', alignItems: 'center', gap: 8 }}>
                    <RefreshCw size={14} style={{ animation: 'spin 1s linear infinite' }} />
                    {reimportStatusText}
                  </div>
                )}

                {reimportExtracted && (
                  <div style={{ marginTop: 12, borderTop: '1px solid #A7F3D0', paddingTop: 10, display: 'flex', gap: 14, fontSize: '.8rem', color: '#065F46' }}>
                    <span>✓ Pages: <strong>{reimportExtracted.totalPages}</strong></span>
                    <span>✓ Extracted Policies: <strong>{reimportExtracted.totalPolicies}</strong></span>
                  </div>
                )}
              </div>
            )}

            {/* Change Notes Input */}
            <div style={{ marginTop: 16 }}>
              <label style={{ fontSize: '.78rem', fontWeight: 700, color: 'var(--gray-t)', textTransform: 'uppercase', display: 'block', marginBottom: 5 }}>
                Changelog / Reason for Re-import
              </label>
              <textarea
                rows={2}
                value={reimportChangeNotes}
                onChange={e => setReimportChangeNotes(e.target.value)}
                placeholder="Updated procedural guidelines, typo corrections..."
                style={{ width: '100%', padding: '9px 12px', border: '1.5px solid var(--gray-mid)', borderRadius: 8, fontSize: '.85rem', outline: 'none', boxSizing: 'border-box' }}
              />
            </div>

            <div style={{ display: 'flex', gap: 10, justifyContent: 'flex-end', marginTop: 22 }}>
              <button
                onClick={() => setReimportVersion(null)}
                style={{ padding: '9px 18px', borderRadius: 8, border: '1.5px solid var(--gray-mid)', background: '#fff', color: 'var(--gray-dk)', fontWeight: 600, cursor: 'pointer' }}
              >
                Cancel
              </button>

              <button
                onClick={handleConfirmReimport}
                disabled={reimporting || !reimportExtracted}
                style={{
                  padding: '9px 22px', borderRadius: 8, border: 'none',
                  background: 'var(--g-primary)', color: '#fff', fontWeight: 700, fontSize: '.85rem',
                  cursor: (reimporting || !reimportExtracted) ? 'not-allowed' : 'pointer',
                  opacity: (reimporting || !reimportExtracted) ? 0.6 : 1, display: 'inline-flex', alignItems: 'center', gap: 8
                }}
              >
                {reimporting ? <RefreshCw size={14} style={{ animation: 'spin 1s linear infinite' }} /> : <Upload size={14} />}
                {reimporting ? 'Re-importing...' : `Confirm Re-import into ${reimportVersion.label}`}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── CONFIRMATION DIALOG (ACTIVATE / ARCHIVE) ────────────────────────── */}
      {confirmDialog && (
        <div style={{
          position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.6)', backdropFilter: 'blur(3px)',
          zIndex: 99999, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 20
        }}>
          <div style={{
            background: '#fff', borderRadius: 18, maxWidth: 460, width: '100%',
            boxShadow: '0 20px 50px rgba(0,0,0,0.3)', padding: 26, textAlign: 'center'
          }}>
            {confirmDialog.type === 'activate' ? (
              <>
                <div style={{ width: 50, height: 50, borderRadius: '50%', background: 'var(--g-pale)', color: 'var(--g-primary)', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 14px' }}>
                  <CheckCircle2 size={28} />
                </div>
                <h3 style={{ fontFamily: '"DM Serif Display",serif', fontSize: '1.3rem', color: 'var(--g-dark)', marginBottom: 8 }}>
                  Activate {confirmDialog.version.label}?
                </h3>
                <p style={{ fontSize: '.85rem', color: 'var(--gray-t)', lineHeight: 1.6, marginBottom: 20 }}>
                  Activating this edition will make it live and student-facing. The currently active version (<strong>{activeVersion?.label || 'none'}</strong>) will automatically be archived.
                </p>
                <div style={{ display: 'flex', gap: 10, justifyContent: 'center' }}>
                  <button
                    onClick={() => setConfirmDialog(null)}
                    style={{ padding: '9px 18px', borderRadius: 8, border: '1.5px solid var(--gray-mid)', background: '#fff', color: 'var(--gray-dk)', fontWeight: 600, cursor: 'pointer' }}
                  >
                    Cancel
                  </button>
                  <button
                    onClick={() => executeActivate(confirmDialog.version)}
                    style={{ padding: '9px 20px', borderRadius: 8, border: 'none', background: 'var(--g-primary)', color: '#fff', fontWeight: 700, cursor: 'pointer' }}
                  >
                    Yes, Activate Now
                  </button>
                </div>
              </>
            ) : confirmDialog.type === 'delete' ? (
              <>
                <div style={{
                  width: 52, height: 52, borderRadius: '50%', background: '#FEE2E2',
                  color: '#DC2626', display: 'flex', alignItems: 'center', justifyContent: 'center',
                  margin: '0 auto 12px', border: '2px solid #FECACA'
                }}>
                  <Trash2 size={26} />
                </div>
                <div style={{
                  display: 'inline-flex', alignItems: 'center', gap: 5, background: '#FEF3C7',
                  color: '#B45309', padding: '3px 10px', borderRadius: 999, fontSize: '.72rem',
                  fontWeight: 800, textTransform: 'uppercase', marginBottom: 10
                }}>
                  Development Utility
                </div>
                <h3 style={{ fontFamily: '"DM Serif Display",serif', fontSize: '1.35rem', color: 'var(--g-dark)', marginBottom: 8 }}>
                  Delete {confirmDialog.version.label}?
                </h3>
                <p style={{ fontSize: '.85rem', color: 'var(--gray-dk)', lineHeight: 1.6, marginBottom: 14 }}>
                  This will permanently delete <strong>{confirmDialog.version.label}</strong> and all {confirmDialog.version.policy_count !== undefined ? confirmDialog.version.policy_count : (confirmDialog.version.sections || 0)} associated policy records from the database.
                </p>

                {confirmDialog.version.status === 'active' && (
                  <div style={{ background: '#FEF2F2', border: '1px solid #FECACA', borderRadius: 8, padding: '10px 12px', marginBottom: 16, fontSize: '.8rem', color: '#991B1B', textAlign: 'left' }}>
                    ⚠️ <strong>Active Version Notice:</strong> Deleting the currently active version will automatically designate the next available edition as active.
                  </div>
                )}

                <div style={{ display: 'flex', gap: 10, justifyContent: 'center' }}>
                  <button
                    onClick={() => setConfirmDialog(null)}
                    disabled={deleting}
                    style={{ padding: '9px 18px', borderRadius: 8, border: '1.5px solid var(--gray-mid)', background: '#fff', color: 'var(--gray-dk)', fontWeight: 600, cursor: 'pointer' }}
                  >
                    Cancel
                  </button>
                  <button
                    onClick={() => executeDelete(confirmDialog.version)}
                    disabled={deleting}
                    style={{
                      padding: '9px 20px', borderRadius: 8, border: 'none',
                      background: '#DC2626', color: '#fff', fontWeight: 700,
                      cursor: deleting ? 'not-allowed' : 'pointer',
                      display: 'inline-flex', alignItems: 'center', gap: 6,
                      opacity: deleting ? 0.7 : 1
                    }}
                  >
                    {deleting ? <RefreshCw size={14} style={{ animation: 'spin 1s linear infinite' }} /> : <Trash2 size={14} />}
                    {deleting ? 'Deleting...' : 'Yes, Delete Version'}
                  </button>
                </div>
              </>
            ) : (
              <>
                <div style={{ width: 50, height: 50, borderRadius: '50%', background: '#FEF2F2', color: '#DC2626', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 14px' }}>
                  <Archive size={26} />
                </div>
                <h3 style={{ fontFamily: '"DM Serif Display",serif', fontSize: '1.3rem', color: 'var(--g-dark)', marginBottom: 8 }}>
                  Archive {confirmDialog.version.label}?
                </h3>
                <p style={{ fontSize: '.85rem', color: 'var(--gray-t)', lineHeight: 1.6, marginBottom: 20 }}>
                  Archiving moves this edition into historical records. Historical policy provisions will be preserved for administrator review.
                </p>
                <div style={{ display: 'flex', gap: 10, justifyContent: 'center' }}>
                  <button
                    onClick={() => setConfirmDialog(null)}
                    style={{ padding: '9px 18px', borderRadius: 8, border: '1.5px solid var(--gray-mid)', background: '#fff', color: 'var(--gray-dk)', fontWeight: 600, cursor: 'pointer' }}
                  >
                    Cancel
                  </button>
                  <button
                    onClick={() => executeArchive(confirmDialog.version)}
                    style={{ padding: '9px 20px', borderRadius: 8, border: 'none', background: '#DC2626', color: '#fff', fontWeight: 700, cursor: 'pointer' }}
                  >
                    Yes, Archive Version
                  </button>
                </div>
              </>
            )}
          </div>
        </div>
      )}

      <style>{`
        @keyframes spin { to { transform: rotate(360deg); } }
        @keyframes pulse { 0%, 100% { opacity: 1; } 50% { opacity: .5; } }
      `}</style>
    </div>
  );
}
