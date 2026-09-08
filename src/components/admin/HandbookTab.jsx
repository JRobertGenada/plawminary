import { useState, useRef, useMemo } from 'react';
import { api } from '../../hooks/useApi';
import {
  Upload, FileText, CheckCircle2, AlertCircle, AlertTriangle,
  RefreshCw, Trash2, Edit3, Plus, ArrowRight, Eye, ShieldCheck,
  Search, Check, X, FileUp, Sparkles, BookOpen, Layers
} from 'lucide-react';
import { BADGE_MAP } from '../../data/ordinances';

const STEP_LABELS = [
  'Upload',
  'Extract',
  'Identify',
  'Structure',
  'Metadata',
  'Validate',
  'Review',
  'Ready'
];

export default function HandbookTab() {
  // ── Overall Flow State ───────────────────────────────────────────────────
  // status: 'empty' | 'selected' | 'processing' | 'review' | 'success' | 'error'
  const [status, setStatus] = useState('empty');
  const [activeStepIndex, setActiveStepIndex] = useState(0);

  // File state
  const [selectedFile, setSelectedFile] = useState(null);
  const [dragOver, setDragOver] = useState(false);
  const [fileError, setFileError] = useState(null);
  const fileInputRef = useRef(null);

  // Processing state
  const [processingStatusText, setProcessingStatusText] = useState('');
  const [tempFileId, setTempFileId] = useState(null);
  const [totalPages, setTotalPages] = useState(0);

  // Extracted policies state for Review
  const [policies, setPolicies] = useState([]);
  const [searchQ, setSearchQ] = useState('');
  const [categoryFilter, setCategoryFilter] = useState('all');

  // Modal edit state
  const [editItem, setEditItem] = useState(null);
  const [isAddingNew, setIsAddingNew] = useState(false);

  // Version import form
  const [versionForm, setVersionForm] = useState({
    label: 'Version 2.1 (2026 Edition)',
    description: 'Updated institutional regulations, disciplinary procedures, and student welfare policies.',
    releaseDate: new Date().toISOString().split('T')[0],
  });

  // Import action state
  const [importing, setImporting] = useState(false);
  const [importResult, setImportResult] = useState(null);
  const [toast, setToast] = useState(null);

  function showToast(msg, isError = false) {
    setToast({ msg, isError });
    setTimeout(() => setToast(null), 4000);
  }

  // ── Drag & Drop / File Select Handlers ─────────────────────────────────────
  function handleFileSelect(file) {
    setFileError(null);
    if (!file) return;

    if (file.type !== 'application/pdf' && !file.name.toLowerCase().endsWith('.pdf')) {
      setFileError('Invalid file type. Please upload a standard PDF (.pdf) file.');
      return;
    }

    const maxBytes = 25 * 1024 * 1024; // 25 MB
    if (file.size > maxBytes) {
      setFileError(`File size exceeds 25MB limit (Current: ${(file.size / (1024 * 1024)).toFixed(1)}MB).`);
      return;
    }

    setSelectedFile(file);
    setStatus('selected');
    setActiveStepIndex(0);
  }

  function handleDrop(e) {
    e.preventDefault();
    setDragOver(false);
    if (e.dataTransfer.files && e.dataTransfer.files[0]) {
      handleFileSelect(e.dataTransfer.files[0]);
    }
  }

  function handleRemoveFile() {
    setSelectedFile(null);
    setFileError(null);
    setStatus('empty');
    setActiveStepIndex(0);
    if (fileInputRef.current) fileInputRef.current.value = '';
  }

  // ── Process Handbook Action ────────────────────────────────────────────────
  async function handleStartProcessing() {
    if (!selectedFile) return;

    setStatus('processing');
    setFileError(null);
    setActiveStepIndex(1); // Extract
    setProcessingStatusText('Reading document bytes & extracting pages…');

    // Simulate visible stepper progress smoothly while upload processes
    const stepTimer1 = setTimeout(() => {
      setActiveStepIndex(2); // Identify
      setProcessingStatusText('Identifying policy boundaries, articles, and rules…');
    }, 1800);

    const stepTimer2 = setTimeout(() => {
      setActiveStepIndex(3); // Structure
      setProcessingStatusText('Structuring clauses and procedural sections…');
    }, 3800);

    const stepTimer3 = setTimeout(() => {
      setActiveStepIndex(4); // Metadata
      setProcessingStatusText('Generating AI summaries, keywords, and student scenarios…');
    }, 6000);

    try {
      const formData = new FormData();
      formData.append('pdf', selectedFile);

      const res = await fetch('/api/admin/handbook/process', {
        method: 'POST',
        body: formData,
        credentials: 'include',
      });

      clearTimeout(stepTimer1);
      clearTimeout(stepTimer2);
      clearTimeout(stepTimer3);

      const data = await res.json();
      if (!res.ok || !data.success) {
        throw new Error(data.error || 'Processing failed.');
      }

      setActiveStepIndex(5); // Validate
      setProcessingStatusText('Validating policy references and page links…');

      await new Promise(r => setTimeout(r, 600));

      setTempFileId(data.tempFileId);
      setTotalPages(data.totalPages);
      setPolicies(data.policies || []);
      setActiveStepIndex(6); // Review
      setStatus('review');
      showToast(`Extracted ${data.totalPolicies} policies across ${data.totalPages} pages.`);

    } catch (err) {
      clearTimeout(stepTimer1);
      clearTimeout(stepTimer2);
      clearTimeout(stepTimer3);
      console.error('[Handbook Processing Error]', err);
      setFileError(err.message || 'Failed to process the PDF handbook.');
      setStatus('error');
    }
  }

  // ── Review Table Actions (Edit / Delete / Add) ─────────────────────────────
  function handleOpenEdit(item) {
    setEditItem({ ...item });
    setIsAddingNew(false);
  }

  function handleOpenAdd() {
    setEditItem({
      id: `manual-${Date.now()}`,
      ref: `PLSP-POL-${String(policies.length + 1).padStart(3, '0')}`,
      title: '',
      catKey: 'conduct',
      cat: 'Student Conduct',
      summary: '',
      desc: '',
      full: '',
      steps: [],
      scenarios: [],
      keywords: [],
      relatedTerms: [],
      handbookSectionId: `sec-manual-${policies.length + 1}`,
      page: 1,
      status: 'ready',
      warnings: [],
    });
    setIsAddingNew(true);
  }

  function handleSaveEdit() {
    if (!editItem.ref.trim() || !editItem.title.trim()) {
      showToast('Reference Code and Title are required.', true);
      return;
    }

    const catNameMap = {
      academic: 'Academic Policies',
      conduct: 'Student Conduct',
      discipline: 'Campus Discipline',
      rights: 'Rights & Responsibilities',
      general: 'University Policies',
    };
    const updated = {
      ...editItem,
      cat: catNameMap[editItem.catKey] || 'University Policies',
      status: 'ready',
      warnings: [],
    };

    if (isAddingNew) {
      setPolicies(prev => [updated, ...prev]);
      showToast(`Added policy "${updated.title}".`);
    } else {
      setPolicies(prev => prev.map(p => p.id === updated.id ? updated : p));
      showToast(`Updated policy "${updated.title}".`);
    }

    setEditItem(null);
    setIsAddingNew(false);
  }

  function handleDeletePolicy(id) {
    setPolicies(prev => prev.filter(p => p.id !== id));
    showToast('Policy removed from preview.');
  }

  // ── Filtered Policies for Review ──────────────────────────────────────────
  const filteredPolicies = useMemo(() => {
    return policies.filter(p => {
      const matchCat = categoryFilter === 'all' || p.catKey === categoryFilter;
      const q = searchQ.trim().toLowerCase();
      const matchQ = !q ||
        (p.title && p.title.toLowerCase().includes(q)) ||
        (p.ref && p.ref.toLowerCase().includes(q)) ||
        (p.summary && p.summary.toLowerCase().includes(q));
      return matchCat && matchQ;
    });
  }, [policies, categoryFilter, searchQ]);

  // ── Final Approve & Import ─────────────────────────────────────────────────
  async function handleApproveAndImport() {
    if (!versionForm.label.trim()) {
      showToast('Please specify a version label.', true);
      return;
    }
    if (policies.length === 0) {
      showToast('No policies to import.', true);
      return;
    }

    setImporting(true);
    try {
      const payload = {
        versionLabel: versionForm.label.trim(),
        description: versionForm.description.trim(),
        releaseDate: versionForm.releaseDate,
        policies,
        tempFileId,
      };

      const res = await api.post('/admin/handbook/import', payload);
      setImportResult(res);
      setActiveStepIndex(7); // Ready
      setStatus('success');
      showToast(`Handbook "${versionForm.label}" successfully activated!`);
    } catch (err) {
      console.error('[Approve & Import Error]', err);
      showToast(err.message || 'Import failed.', true);
    } finally {
      setImporting(false);
    }
  }

  return (
    <div style={{ paddingBottom: 60 }}>
      {/* Toast Notification */}
      {toast && (
        <div style={{
          position: 'fixed', bottom: 24, right: 24,
          background: toast.isError ? '#991B1B' : 'var(--g-dark)',
          color: '#fff', padding: '12px 20px', borderRadius: 12,
          fontSize: '.875rem', fontWeight: 600, zIndex: 9999,
          boxShadow: '0 8px 30px rgba(0,0,0,0.25)',
          display: 'flex', alignItems: 'center', gap: 10,
          border: '1px solid rgba(255,255,255,0.1)'
        }}>
          {toast.isError ? <AlertCircle size={18} /> : <CheckCircle2 size={18} color="var(--gold)" />}
          {toast.msg}
        </div>
      )}

      {/* Page Header */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: 16, marginBottom: 24 }}>
        <div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 6 }}>
            <span style={{ display: 'inline-flex', alignItems: 'center', gap: 5, padding: '3px 10px', borderRadius: 999, fontSize: '.72rem', fontWeight: 800, background: 'rgba(244,197,66,0.15)', color: 'var(--gold-d)', textTransform: 'uppercase', letterSpacing: '.06em' }}>
              <Sparkles size={12} /> Institutional Ingestion
            </span>
            <span style={{ fontSize: '.8rem', color: 'var(--gray-t)' }}>Version Safety Enabled</span>
          </div>
          <h1 style={{ fontFamily: '"DM Serif Display",serif', fontSize: '1.85rem', color: 'var(--g-dark)', margin: 0 }}>
            PDF Handbook Uploader & Ingestion Pipeline
          </h1>
          <p style={{ fontSize: '.9rem', color: 'var(--gray-t)', marginTop: 4, maxWidth: 740 }}>
            Upload the official student handbook PDF to extract structured policies, generate AI scenario metadata, review records, and safely activate a live handbook version.
          </p>
        </div>
      </div>

      {/* ── 8-STEP PROGRESS STEPPER ─────────────────────────────────────────── */}
      <div style={{
        background: '#fff', border: '1px solid var(--gray-mid)', borderRadius: 16,
        padding: '16px 20px', marginBottom: 24, boxShadow: '0 2px 10px rgba(0,0,0,0.02)'
      }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', overflowX: 'auto', gap: 8, paddingBottom: 4 }}>
          {STEP_LABELS.map((label, i) => {
            const isDone = i < activeStepIndex;
            const isCurrent = i === activeStepIndex;
            return (
              <div key={label} style={{ display: 'flex', alignItems: 'center', gap: 8, flexShrink: 0 }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                  <div style={{
                    width: 28, height: 28, borderRadius: '50%',
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                    fontSize: '.75rem', fontWeight: 800,
                    background: isDone ? 'var(--g-primary)' : isCurrent ? 'var(--gold)' : 'var(--gray-bg)',
                    color: isDone ? '#fff' : isCurrent ? 'var(--g-dark)' : 'var(--gray-t)',
                    boxShadow: isCurrent ? '0 0 0 4px rgba(244,197,66,0.25)' : 'none',
                    transition: 'all .25s ease'
                  }}>
                    {isDone ? <Check size={14} /> : i + 1}
                  </div>
                  <span style={{
                    fontSize: '.78rem', fontWeight: isCurrent ? 800 : isDone ? 700 : 500,
                    color: isCurrent ? 'var(--g-dark)' : isDone ? 'var(--g-primary)' : 'var(--gray-t)'
                  }}>
                    {label}
                  </span>
                </div>
                {i < STEP_LABELS.length - 1 && (
                  <div style={{
                    width: 18, height: 2,
                    background: isDone ? 'var(--g-primary)' : 'var(--gray-mid)',
                    borderRadius: 1, margin: '0 4px'
                  }} />
                )}
              </div>
            );
          })}
        </div>
      </div>

      {/* ── STATE: EMPTY / SELECTED / PROCESSING ──────────────────────────── */}
      {(status === 'empty' || status === 'selected' || status === 'processing' || status === 'error') && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>

          {/* Upload Card */}
          <div
            onDragOver={e => { e.preventDefault(); setDragOver(true); }}
            onDragLeave={() => setDragOver(false)}
            onDrop={handleDrop}
            style={{
              background: dragOver ? 'rgba(15,79,44,0.03)' : '#fff',
              border: `2px dashed ${dragOver ? 'var(--g-primary)' : selectedFile ? 'var(--g-primary)' : 'var(--gray-mid)'}`,
              borderRadius: 20, padding: '40px 24px', textAlign: 'center',
              transition: 'all .2s ease', position: 'relative'
            }}
          >
            <input
              type="file"
              ref={fileInputRef}
              accept=".pdf,application/pdf"
              style={{ display: 'none' }}
              onChange={e => e.target.files && handleFileSelect(e.target.files[0])}
            />

            {!selectedFile ? (
              <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 14 }}>
                <div style={{
                  width: 68, height: 68, borderRadius: '50%', background: 'var(--g-pale)',
                  display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--g-primary)'
                }}>
                  <Upload size={32} />
                </div>
                <div>
                  <h3 style={{ fontFamily: '"DM Serif Display",serif', fontSize: '1.35rem', color: 'var(--g-dark)', marginBottom: 6 }}>
                    Drag and drop Student Handbook PDF
                  </h3>
                  <p style={{ fontSize: '.875rem', color: 'var(--gray-t)', maxWidth: 460, margin: '0 auto' }}>
                    Upload the institutional handbook document. Enforces server-side PDF validation, heading parsing, and zero-hallucination policy segmentation.
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() => fileInputRef.current?.click()}
                  style={{
                    display: 'inline-flex', alignItems: 'center', gap: 8,
                    padding: '11px 24px', borderRadius: 12,
                    background: 'var(--g-primary)', color: '#fff',
                    border: 'none', fontWeight: 700, fontSize: '.9rem',
                    cursor: 'pointer', fontFamily: '"Plus Jakarta Sans",sans-serif',
                    boxShadow: '0 4px 14px rgba(15,79,44,0.2)'
                  }}
                >
                  <FileUp size={16} /> Choose PDF File
                </button>
                <span style={{ fontSize: '.75rem', color: 'var(--gray-t)' }}>
                  Accepts PDF files up to 25 MB
                </span>
              </div>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 16 }}>
                <div style={{
                  width: 64, height: 64, borderRadius: 16, background: 'var(--g-pale)',
                  display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--g-primary)'
                }}>
                  <FileText size={32} />
                </div>
                <div>
                  <div style={{ fontSize: '1.1rem', fontWeight: 800, color: 'var(--g-dark)', marginBottom: 4 }}>
                    {selectedFile.name}
                  </div>
                  <div style={{ fontSize: '.84rem', color: 'var(--gray-t)' }}>
                    File Size: {(selectedFile.size / (1024 * 1024)).toFixed(2)} MB &bull; Ready for Extraction
                  </div>
                </div>

                {status !== 'processing' && (
                  <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap', justifyContent: 'center' }}>
                    <button
                      type="button"
                      onClick={handleRemoveFile}
                      style={{
                        padding: '10px 18px', borderRadius: 10,
                        border: '1.5px solid var(--gray-mid)', background: '#fff',
                        color: 'var(--gray-dk)', fontWeight: 600, fontSize: '.85rem',
                        cursor: 'pointer', fontFamily: '"Plus Jakarta Sans",sans-serif'
                      }}
                    >
                      Remove
                    </button>
                    <button
                      type="button"
                      onClick={handleStartProcessing}
                      style={{
                        display: 'inline-flex', alignItems: 'center', gap: 8,
                        padding: '10px 24px', borderRadius: 10,
                        background: 'var(--g-primary)', color: '#fff',
                        border: 'none', fontWeight: 800, fontSize: '.9rem',
                        cursor: 'pointer', fontFamily: '"Plus Jakarta Sans",sans-serif',
                        boxShadow: '0 4px 14px rgba(15,79,44,0.25)'
                      }}
                    >
                      <Sparkles size={16} color="var(--gold)" /> Process Handbook &rarr;
                    </button>
                  </div>
                )}
              </div>
            )}
          </div>

          {/* Processing Indicator */}
          {status === 'processing' && (
            <div style={{
              background: '#fff', border: '1px solid var(--gray-mid)', borderRadius: 16,
              padding: '28px 24px', textAlign: 'center', boxShadow: '0 4px 20px rgba(0,0,0,0.04)'
            }}>
              <RefreshCw size={28} color="var(--g-primary)" style={{ animation: 'spin 1.2s linear infinite', marginBottom: 14 }} />
              <div style={{ fontFamily: '"DM Serif Display",serif', fontSize: '1.25rem', color: 'var(--g-dark)', marginBottom: 6 }}>
                Ingesting Handbook Document…
              </div>
              <div style={{ fontSize: '.875rem', color: 'var(--gray-t)', maxWidth: 500, margin: '0 auto' }}>
                {processingStatusText}
              </div>
            </div>
          )}

          {/* Error Message */}
          {fileError && (
            <div style={{
              background: '#FEF2F2', border: '1.5px solid #FECACA', borderRadius: 12,
              padding: '14px 18px', display: 'flex', alignItems: 'center', gap: 12
            }}>
              <AlertCircle size={20} color="#DC2626" style={{ flexShrink: 0 }} />
              <span style={{ fontSize: '.875rem', color: '#991B1B', fontWeight: 500 }}>{fileError}</span>
              <button
                onClick={handleRemoveFile}
                style={{ marginLeft: 'auto', background: 'none', border: 'none', color: '#DC2626', fontWeight: 700, cursor: 'pointer', fontSize: '.8rem' }}
              >
                Try Again
              </button>
            </div>
          )}
        </div>
      )}

      {/* ── STATE: REVIEW PREVIEW TABLE & APPROVAL ─────────────────────────── */}
      {status === 'review' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>

          {/* Summary KPI Banner */}
          <div style={{
            background: 'linear-gradient(135deg, var(--g-dark) 0%, var(--g-primary) 100%)',
            borderRadius: 18, padding: '22px 24px', color: '#fff',
            display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 16
          }}>
            <div>
              <div style={{ fontSize: '.75rem', fontWeight: 800, textTransform: 'uppercase', letterSpacing: '.1em', color: 'var(--gold)', marginBottom: 4 }}>
                Extraction Completed &bull; Admin Review
              </div>
              <h2 style={{ fontFamily: '"DM Serif Display",serif', fontSize: '1.45rem', margin: 0, color: '#fff' }}>
                {policies.length} Policies Extracted across {totalPages} Pages
              </h2>
              <div style={{ fontSize: '.84rem', color: 'rgba(255,255,255,0.7)', marginTop: 4 }}>
                Review each provision before committing. Database remains unchanged until you approve.
              </div>
            </div>
            <div style={{ display: 'flex', gap: 10 }}>
              <button
                onClick={handleOpenAdd}
                style={{
                  display: 'inline-flex', alignItems: 'center', gap: 6,
                  padding: '9px 16px', borderRadius: 10, background: 'rgba(255,255,255,0.15)',
                  border: '1px solid rgba(255,255,255,0.2)', color: '#fff',
                  fontSize: '.85rem', fontWeight: 700, cursor: 'pointer', fontFamily: '"Plus Jakarta Sans",sans-serif'
                }}
              >
                <Plus size={16} /> Add Custom Policy
              </button>
              <button
                onClick={handleRemoveFile}
                style={{
                  padding: '9px 16px', borderRadius: 10, background: 'transparent',
                  border: '1px solid rgba(255,255,255,0.2)', color: 'rgba(255,255,255,0.8)',
                  fontSize: '.85rem', fontWeight: 600, cursor: 'pointer', fontFamily: '"Plus Jakarta Sans",sans-serif'
                }}
              >
                Discard & Re-upload
              </button>
            </div>
          </div>

          {/* Filter & Search Bar */}
          <div style={{
            background: '#fff', border: '1px solid var(--gray-mid)', borderRadius: 16,
            padding: '14px 18px', display: 'flex', justifyContent: 'space-between',
            alignItems: 'center', flexWrap: 'wrap', gap: 12
          }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
              {[
                { k: 'all', label: `All (${policies.length})` },
                { k: 'academic', label: 'Academic' },
                { k: 'conduct', label: 'Conduct' },
                { k: 'discipline', label: 'Discipline' },
                { k: 'rights', label: 'Rights' },
              ].map(tab => (
                <button
                  key={tab.k}
                  onClick={() => setCategoryFilter(tab.k)}
                  style={{
                    padding: '6px 14px', borderRadius: 999, border: 'none',
                    fontSize: '.8rem', fontWeight: categoryFilter === tab.k ? 800 : 500,
                    background: categoryFilter === tab.k ? 'var(--g-primary)' : 'var(--gray-bg)',
                    color: categoryFilter === tab.k ? '#fff' : 'var(--gray-dk)',
                    cursor: 'pointer', fontFamily: '"Plus Jakarta Sans",sans-serif',
                    transition: 'all .15s'
                  }}
                >
                  {tab.label}
                </button>
              ))}
            </div>

            <div style={{ position: 'relative', minWidth: 260 }}>
              <Search size={16} color="var(--gray-t)" style={{ position: 'absolute', left: 12, top: '50%', transform: 'translateY(-50%)' }} />
              <input
                type="text"
                placeholder="Search extracted preview…"
                value={searchQ}
                onChange={e => setSearchQ(e.target.value)}
                style={{
                  width: '100%', padding: '7px 12px 7px 36px',
                  borderRadius: 10, border: '1.5px solid var(--gray-mid)',
                  fontSize: '.85rem', fontFamily: '"Plus Jakarta Sans",sans-serif',
                  outline: 'none', boxSizing: 'border-box'
                }}
              />
            </div>
          </div>

          {/* Table Preview */}
          <div style={{
            background: '#fff', border: '1px solid var(--gray-mid)', borderRadius: 16,
            overflow: 'hidden', boxShadow: '0 2px 10px rgba(0,0,0,0.02)'
          }}>
            <div style={{ overflowX: 'auto' }}>
              <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left', fontSize: '.85rem' }}>
                <thead>
                  <tr style={{ background: 'var(--gray-bg)', borderBottom: '1px solid var(--gray-mid)', color: 'var(--gray-t)' }}>
                    <th style={{ padding: '12px 16px', fontWeight: 800, width: 120 }}>Code</th>
                    <th style={{ padding: '12px 16px', fontWeight: 800 }}>Policy Title</th>
                    <th style={{ padding: '12px 16px', fontWeight: 800, width: 130 }}>Category</th>
                    <th style={{ padding: '12px 16px', fontWeight: 800, width: 70, textAlign: 'center' }}>Page</th>
                    <th style={{ padding: '12px 16px', fontWeight: 800 }}>Summary & Scenarios</th>
                    <th style={{ padding: '12px 16px', fontWeight: 800, width: 110, textAlign: 'center' }}>Status</th>
                    <th style={{ padding: '12px 16px', fontWeight: 800, width: 90, textAlign: 'right' }}>Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredPolicies.map((p, idx) => {
                    const badge = BADGE_MAP[p.catKey] || { bg: '#F3F4F6', color: '#374151' };
                    return (
                      <tr
                        key={p.id || idx}
                        style={{ borderBottom: '1px solid var(--gray-mid)', transition: 'background .15s' }}
                        onMouseEnter={e => e.currentTarget.style.background = 'rgba(15,79,44,0.02)'}
                        onMouseLeave={e => e.currentTarget.style.background = 'transparent'}
                      >
                        <td style={{ padding: '14px 16px', fontWeight: 700, color: 'var(--g-dark)', whiteSpace: 'nowrap' }}>
                          {p.ref}
                        </td>
                        <td style={{ padding: '14px 16px', fontWeight: 600, color: 'var(--gray-dk)', minWidth: 200 }}>
                          <div>{p.title}</div>
                          {p.steps?.length > 0 && (
                            <div style={{ fontSize: '.72rem', color: 'var(--gray-t)', marginTop: 4 }}>
                              📋 {p.steps.length} procedural steps
                            </div>
                          )}
                        </td>
                        <td style={{ padding: '14px 16px' }}>
                          <span style={{
                            display: 'inline-block', padding: '3px 10px', borderRadius: 999,
                            fontSize: '.72rem', fontWeight: 700, background: badge.bg, color: badge.color,
                            whiteSpace: 'nowrap'
                          }}>
                            {p.cat}
                          </span>
                        </td>
                        <td style={{ padding: '14px 16px', textAlign: 'center', fontWeight: 700, color: 'var(--g-dark)' }}>
                          p.{p.page}
                        </td>
                        <td style={{ padding: '14px 16px', color: 'var(--gray-dk)', maxWidth: 360 }}>
                          <div style={{ lineHeight: 1.45, marginBottom: 6 }}>{p.summary}</div>
                          {p.scenarios?.length > 0 && (
                            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 4 }}>
                              {p.scenarios.slice(0, 2).map((sc, sidx) => (
                                <span key={sidx} style={{
                                  fontSize: '.68rem', padding: '2px 8px', borderRadius: 6,
                                  background: '#F1F5F9', color: '#475569'
                                }}>
                                  💡 {typeof sc === 'string' ? sc : sc.scenario}
                                </span>
                              ))}
                            </div>
                          )}
                        </td>
                        <td style={{ padding: '14px 16px', textAlign: 'center' }}>
                          {p.status === 'ready' ? (
                            <span style={{
                              display: 'inline-flex', alignItems: 'center', gap: 4,
                              padding: '2px 8px', borderRadius: 999, fontSize: '.7rem',
                              fontWeight: 700, background: '#D1FAE5', color: '#065F46'
                            }}>
                              <CheckCircle2 size={12} /> Ready
                            </span>
                          ) : (
                            <span style={{
                              display: 'inline-flex', alignItems: 'center', gap: 4,
                              padding: '2px 8px', borderRadius: 999, fontSize: '.7rem',
                              fontWeight: 700, background: '#FEF3C7', color: '#92400E'
                            }}>
                              <AlertTriangle size={12} /> Review
                            </span>
                          )}
                        </td>
                        <td style={{ padding: '14px 16px', textAlign: 'right', whiteSpace: 'nowrap' }}>
                          <div style={{ display: 'flex', gap: 6, justifyContent: 'flex-end' }}>
                            <button
                              onClick={() => handleOpenEdit(p)}
                              title="Edit Record"
                              style={{
                                background: 'none', border: '1px solid var(--gray-mid)',
                                borderRadius: 8, padding: '6px', color: 'var(--gray-dk)',
                                cursor: 'pointer'
                              }}
                            >
                              <Edit3 size={14} />
                            </button>
                            <button
                              onClick={() => handleDeletePolicy(p.id)}
                              title="Remove Policy"
                              style={{
                                background: 'none', border: '1px solid var(--gray-mid)',
                                borderRadius: 8, padding: '6px', color: '#DC2626',
                                cursor: 'pointer'
                              }}
                            >
                              <Trash2 size={14} />
                            </button>
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>

          {/* Version Info & Approve & Import Card */}
          <div style={{
            background: '#fff', border: '1.5px solid var(--g-primary)', borderRadius: 18,
            padding: '24px 28px', boxShadow: '0 8px 30px rgba(15,79,44,0.06)'
          }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 16 }}>
              <ShieldCheck size={24} color="var(--g-primary)" />
              <h3 style={{ fontFamily: '"DM Serif Display",serif', fontSize: '1.3rem', color: 'var(--g-dark)', margin: 0 }}>
                Approve & Activate Handbook Version
              </h3>
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: 16, marginBottom: 18 }}>
              <div>
                <label style={{ fontSize: '.78rem', fontWeight: 800, textTransform: 'uppercase', color: 'var(--gray-t)', display: 'block', marginBottom: 6 }}>
                  Version Label
                </label>
                <input
                  type="text"
                  value={versionForm.label}
                  onChange={e => setVersionForm(f => ({ ...f, label: e.target.value }))}
                  style={{
                    width: '100%', padding: '9px 12px', borderRadius: 8,
                    border: '1.5px solid var(--gray-mid)', fontSize: '.875rem',
                    fontFamily: '"Plus Jakarta Sans",sans-serif', boxSizing: 'border-box'
                  }}
                />
              </div>

              <div>
                <label style={{ fontSize: '.78rem', fontWeight: 800, textTransform: 'uppercase', color: 'var(--gray-t)', display: 'block', marginBottom: 6 }}>
                  Release Date
                </label>
                <input
                  type="date"
                  value={versionForm.releaseDate}
                  onChange={e => setVersionForm(f => ({ ...f, releaseDate: e.target.value }))}
                  style={{
                    width: '100%', padding: '9px 12px', borderRadius: 8,
                    border: '1.5px solid var(--gray-mid)', fontSize: '.875rem',
                    fontFamily: '"Plus Jakarta Sans",sans-serif', boxSizing: 'border-box'
                  }}
                />
              </div>
            </div>

            <div style={{ marginBottom: 18 }}>
              <label style={{ fontSize: '.78rem', fontWeight: 800, textTransform: 'uppercase', color: 'var(--gray-t)', display: 'block', marginBottom: 6 }}>
                Changelog / Release Summary
              </label>
              <textarea
                rows={2}
                value={versionForm.description}
                onChange={e => setVersionForm(f => ({ ...f, description: e.target.value }))}
                placeholder="Describe amendments in this edition…"
                style={{
                  width: '100%', padding: '9px 12px', borderRadius: 8,
                  border: '1.5px solid var(--gray-mid)', fontSize: '.875rem',
                  fontFamily: '"Plus Jakarta Sans",sans-serif', boxSizing: 'border-box',
                  resize: 'vertical'
                }}
              />
            </div>

            {/* Version safety warning note */}
            <div style={{
              background: '#FEF9E7', border: '1.5px solid #FDE68A', borderRadius: 10,
              padding: '12px 16px', fontSize: '.82rem', color: '#92400E', lineHeight: 1.5,
              marginBottom: 20
            }}>
              <strong>Version Safety Guarantee:</strong> Committing will execute a transaction to insert <strong>{policies.length} policies</strong> into MySQL, archive the previous active handbook, promote this version to <code>ACTIVE</code>, and immediately refresh student searches.
            </div>

            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 12 }}>
              <button
                type="button"
                onClick={handleRemoveFile}
                disabled={importing}
                style={{
                  padding: '11px 22px', borderRadius: 10,
                  border: '1.5px solid var(--gray-mid)', background: '#fff',
                  color: 'var(--gray-dk)', fontWeight: 600, fontSize: '.9rem',
                  cursor: 'pointer', fontFamily: '"Plus Jakarta Sans",sans-serif'
                }}
              >
                Cancel
              </button>

              <button
                type="button"
                onClick={handleApproveAndImport}
                disabled={importing}
                style={{
                  display: 'inline-flex', alignItems: 'center', gap: 8,
                  padding: '11px 28px', borderRadius: 10,
                  background: 'var(--g-primary)', color: '#fff',
                  border: 'none', fontWeight: 800, fontSize: '.92rem',
                  cursor: importing ? 'not-allowed' : 'pointer',
                  fontFamily: '"Plus Jakarta Sans",sans-serif',
                  boxShadow: '0 4px 16px rgba(15,79,44,0.3)',
                  opacity: importing ? 0.7 : 1
                }}
              >
                {importing ? (
                  <>
                    <RefreshCw size={16} style={{ animation: 'spin 1s linear infinite' }} />
                    Importing to MySQL…
                  </>
                ) : (
                  <>
                    <CheckCircle2 size={16} color="var(--gold)" />
                    Approve & Import ({policies.length} Policies)
                  </>
                )}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── STATE: SUCCESS ─────────────────────────────────────────────────── */}
      {status === 'success' && (
        <div style={{
          background: '#fff', border: '2px solid var(--g-primary)', borderRadius: 20,
          padding: '40px 24px', textAlign: 'center', boxShadow: '0 8px 30px rgba(15,79,44,0.08)'
        }}>
          <div style={{
            width: 72, height: 72, borderRadius: '50%', background: 'var(--g-pale)',
            display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--g-primary)',
            margin: '0 auto 20px'
          }}>
            <CheckCircle2 size={40} />
          </div>

          <h2 style={{ fontFamily: '"DM Serif Display",serif', fontSize: '1.75rem', color: 'var(--g-dark)', marginBottom: 8 }}>
            Handbook Activated Successfully!
          </h2>
          <p style={{ fontSize: '.95rem', color: 'var(--gray-t)', maxWidth: 520, margin: '0 auto 24px', lineHeight: 1.6 }}>
            <strong>{versionForm.label}</strong> is now the live student-facing handbook. <strong>{policies.length} official policies</strong> and scenario phrases have been indexed and are immediately searchable.
          </p>

          <div style={{ display: 'flex', justifyContent: 'center', gap: 14, flexWrap: 'wrap' }}>
            <a
              href="/ordinances"
              style={{
                display: 'inline-flex', alignItems: 'center', gap: 8,
                padding: '11px 24px', borderRadius: 10,
                background: 'var(--g-primary)', color: '#fff',
                textDecoration: 'none', fontWeight: 800, fontSize: '.9rem',
                boxShadow: '0 4px 14px rgba(15,79,44,0.25)'
              }}
            >
              <Search size={16} color="var(--gold)" /> Test Search in Ordinances
            </a>

            <a
              href="/handbook"
              style={{
                display: 'inline-flex', alignItems: 'center', gap: 8,
                padding: '11px 24px', borderRadius: 10,
                border: '1.5px solid var(--gray-mid)', background: '#fff',
                color: 'var(--g-dark)', textDecoration: 'none',
                fontWeight: 700, fontSize: '.9rem'
              }}
            >
              <BookOpen size={16} /> Open Handbook Viewer
            </a>

            <button
              onClick={() => {
                setStatus('empty');
                setSelectedFile(null);
                setPolicies([]);
                setActiveStepIndex(0);
              }}
              style={{
                padding: '11px 20px', borderRadius: 10,
                background: 'transparent', border: '1.5px solid var(--gray-mid)',
                color: 'var(--gray-t)', fontWeight: 600, fontSize: '.9rem',
                cursor: 'pointer'
              }}
            >
              Upload Another
            </button>
          </div>
        </div>
      )}

      {/* ── EDIT / ADD POLICY MODAL ────────────────────────────────────────── */}
      {editItem && (
        <div style={{
          position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.5)', backdropFilter: 'blur(3px)',
          zIndex: 9998, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 20
        }}>
          <div style={{
            background: '#fff', borderRadius: 20, maxWidth: 650, width: '100%',
            maxHeight: '90vh', overflowY: 'auto', padding: '28px', position: 'relative',
            boxShadow: '0 20px 50px rgba(0,0,0,0.2)'
          }}>
            <button
              onClick={() => { setEditItem(null); setIsAddingNew(false); }}
              style={{ position: 'absolute', right: 20, top: 20, background: 'none', border: 'none', cursor: 'pointer', color: 'var(--gray-t)' }}
            >
              <X size={20} />
            </button>

            <h3 style={{ fontFamily: '"DM Serif Display",serif', fontSize: '1.35rem', color: 'var(--g-dark)', marginBottom: 20 }}>
              {isAddingNew ? 'Add Policy Provision' : 'Edit Extracted Policy'}
            </h3>

            <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
                <div>
                  <label style={{ fontSize: '.75rem', fontWeight: 800, textTransform: 'uppercase', color: 'var(--gray-t)', display: 'block', marginBottom: 5 }}>
                    Reference Code
                  </label>
                  <input
                    type="text"
                    value={editItem.ref}
                    onChange={e => setEditItem({ ...editItem, ref: e.target.value })}
                    style={{ width: '100%', padding: '8px 12px', border: '1.5px solid var(--gray-mid)', borderRadius: 8, fontSize: '.85rem', boxSizing: 'border-box' }}
                  />
                </div>

                <div>
                  <label style={{ fontSize: '.75rem', fontWeight: 800, textTransform: 'uppercase', color: 'var(--gray-t)', display: 'block', marginBottom: 5 }}>
                    PDF Page Number
                  </label>
                  <input
                    type="number"
                    value={editItem.page}
                    onChange={e => setEditItem({ ...editItem, page: parseInt(e.target.value, 10) || 1 })}
                    style={{ width: '100%', padding: '8px 12px', border: '1.5px solid var(--gray-mid)', borderRadius: 8, fontSize: '.85rem', boxSizing: 'border-box' }}
                  />
                </div>
              </div>

              <div>
                <label style={{ fontSize: '.75rem', fontWeight: 800, textTransform: 'uppercase', color: 'var(--gray-t)', display: 'block', marginBottom: 5 }}>
                  Policy Title
                </label>
                <input
                  type="text"
                  value={editItem.title}
                  onChange={e => setEditItem({ ...editItem, title: e.target.value })}
                  style={{ width: '100%', padding: '8px 12px', border: '1.5px solid var(--gray-mid)', borderRadius: 8, fontSize: '.85rem', boxSizing: 'border-box' }}
                />
              </div>

              <div>
                <label style={{ fontSize: '.75rem', fontWeight: 800, textTransform: 'uppercase', color: 'var(--gray-t)', display: 'block', marginBottom: 5 }}>
                  Category
                </label>
                <select
                  value={editItem.catKey}
                  onChange={e => setEditItem({ ...editItem, catKey: e.target.value })}
                  style={{ width: '100%', padding: '8px 12px', border: '1.5px solid var(--gray-mid)', borderRadius: 8, fontSize: '.85rem', boxSizing: 'border-box' }}
                >
                  <option value="academic">Academic Policies</option>
                  <option value="conduct">Student Conduct</option>
                  <option value="discipline">Campus Discipline</option>
                  <option value="rights">Rights & Responsibilities</option>
                  <option value="general">University Policies</option>
                </select>
              </div>

              <div>
                <label style={{ fontSize: '.75rem', fontWeight: 800, textTransform: 'uppercase', color: 'var(--gray-t)', display: 'block', marginBottom: 5 }}>
                  Executive Summary
                </label>
                <textarea
                  rows={3}
                  value={editItem.summary}
                  onChange={e => setEditItem({ ...editItem, summary: e.target.value })}
                  style={{ width: '100%', padding: '8px 12px', border: '1.5px solid var(--gray-mid)', borderRadius: 8, fontSize: '.85rem', boxSizing: 'border-box', resize: 'vertical' }}
                />
              </div>

              <div>
                <label style={{ fontSize: '.75rem', fontWeight: 800, textTransform: 'uppercase', color: 'var(--gray-t)', display: 'block', marginBottom: 5 }}>
                  Full Legal Text / Content
                </label>
                <textarea
                  rows={4}
                  value={editItem.full}
                  onChange={e => setEditItem({ ...editItem, full: e.target.value })}
                  style={{ width: '100%', padding: '8px 12px', border: '1.5px solid var(--gray-mid)', borderRadius: 8, fontSize: '.85rem', boxSizing: 'border-box', resize: 'vertical' }}
                />
              </div>
            </div>

            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 10, marginTop: 22 }}>
              <button
                type="button"
                onClick={() => { setEditItem(null); setIsAddingNew(false); }}
                style={{ padding: '8px 18px', borderRadius: 8, border: '1.5px solid var(--gray-mid)', background: '#fff', color: 'var(--gray-dk)', cursor: 'pointer', fontWeight: 600 }}
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleSaveEdit}
                style={{ padding: '8px 22px', borderRadius: 8, border: 'none', background: 'var(--g-primary)', color: '#fff', cursor: 'pointer', fontWeight: 700 }}
              >
                Save Record
              </button>
            </div>
          </div>
        </div>
      )}

      <style>{`
        @keyframes spin { to { transform: rotate(360deg); } }
      `}</style>
    </div>
  );
}
