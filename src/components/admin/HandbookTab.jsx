import { useState, useRef, useMemo } from 'react';
import { api } from '../../hooks/useApi';
import {
  Upload, FileText, CheckCircle2, AlertCircle, AlertTriangle,
  RefreshCw, Trash2, Edit3, Plus, ArrowRight, Eye, ShieldCheck,
  Search, Check, X, FileUp, Sparkles, BookOpen, Layers, Database
} from 'lucide-react';
import { BADGE_MAP } from '../../data/ordinances';
import ConfirmationModal from '../ConfirmationModal';

const STEP_LABELS = [
  'Upload',
  'Extract',
  'Identify',
  'Structure',
  'Metadata',
  'Validate',
  'Review',//dajshdkjahskdhakjhdadsa
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

  // Bulk selection state
  const [selectedPolicyIds, setSelectedPolicyIds] = useState([]);

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

  // Reusable Center-Screen Confirmation Modal State
  const [confirmModal, setConfirmModal] = useState(null);

  function closeConfirmModal() {
    if (confirmModal?.loading) return; // prevent closing while action in flight
    setConfirmModal(null);
  }

  function showResultModal(title, message, isError = false, policyCount = null, confirmText = 'Dismiss', onDismiss = null) {
    setConfirmModal({
      isOpen: true,
      type: isError ? 'error' : 'success',
      title,
      message,
      policyCount,
      isResult: true,
      confirmText,
      onConfirm: () => {
        setConfirmModal(null);
        onDismiss?.();
      },
      onCancel: () => {
        setConfirmModal(null);
        onDismiss?.();
      },
    });
  }

  function showErrorModal(title, message) {
    showResultModal(title, message, true);
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
    setSelectedPolicyIds([]);
    if (fileInputRef.current) fileInputRef.current.value = '';
  }

  // ── 1. PDF Upload / Ingestion Confirmation ─────────────────────────────────
  function handleRequestStartProcessing() {
    if (!selectedFile) return;

    setConfirmModal({
      isOpen: true,
      type: 'upload',
      title: 'Confirm PDF Handbook Ingestion',
      message: `Start the automated extraction and AI processing pipeline for "${selectedFile.name}" (${(selectedFile.size / (1024 * 1024)).toFixed(2)} MB)? The server will segment policy provisions, parse articles, and generate AI student scenarios across all pages.`,
      explicitWarning: 'Extraction runs safely in isolated staging. Existing live handbook versions and database records will remain unchanged until you review and explicitly approve them.',
      confirmText: 'Begin Ingestion Pipeline',
      cancelText: 'Cancel',
      onConfirm: async () => {
        setConfirmModal(null);
        await executeStartProcessing();
      },
    });
  }

  async function executeStartProcessing() {
    if (!selectedFile) return;

    setStatus('processing');
    setFileError(null);
    setActiveStepIndex(1); // Extract
    setProcessingStatusText('Reading document bytes & extracting pages…');

    // Stepper progress simulation
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
      setSelectedPolicyIds([]);

      // Center-screen success confirmation modal
      showResultModal(
        'Handbook Extracted Successfully',
        `Successfully extracted ${data.totalPolicies} policy provisions across ${data.totalPages} pages from "${selectedFile.name}". Review each item, make necessary adjustments, or approve provisions for database import.`,
        false,
        data.totalPolicies,
        'Proceed to Review'
      );

    } catch (err) {
      clearTimeout(stepTimer1);
      clearTimeout(stepTimer2);
      clearTimeout(stepTimer3);
      console.error('[Handbook Processing Error]', err);
      setFileError(err.message || 'Failed to process the PDF handbook.');
      setStatus('error');
      showErrorModal('Ingestion Processing Failed', err.message || 'Failed to process the uploaded PDF handbook document.');
    }
  }

  // ── 2. Save / Edit Policy Confirmation ────────────────────────────────────
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
      status: 'approved',
      warnings: [],
    });
    setIsAddingNew(true);
  }

  function handleRequestSaveEdit() {
    if (!editItem.ref.trim() || !editItem.title.trim()) {
      showErrorModal('Validation Error', 'Reference Code and Policy Title are required before saving.');
      return;
    }

    setConfirmModal({
      isOpen: true,
      type: 'confirm',
      title: isAddingNew ? 'Add Policy Provision?' : 'Confirm Policy Updates?',
      policyCount: 1,
      policyPreview: [{ ref: editItem.ref, title: editItem.title }],
      message: `Are you sure you want to save changes to policy "${editItem.title}" (${editItem.ref})? This will update the policy details in the current review draft.`,
      confirmText: isAddingNew ? 'Confirm & Add Policy' : 'Confirm & Save Changes',
      cancelText: 'Cancel',
      onConfirm: () => {
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
          status: 'approved',
          warnings: [],
        };

        if (isAddingNew) {
          setPolicies(prev => [updated, ...prev]);
        } else {
          setPolicies(prev => prev.map(p => p.id === updated.id ? updated : p));
        }

        const wasAdding = isAddingNew;
        setEditItem(null);
        setIsAddingNew(false);
        showResultModal(
          wasAdding ? 'Policy Added Successfully' : 'Policy Updated Successfully',
          `Policy "${updated.title}" (${updated.ref}) has been successfully saved to the active draft.`,
          false,
          1
        );
      },
      onCancel: closeConfirmModal,
    });
  }

  // ── 3. Delete Generated Policy (Explicit Confirmation) ─────────────────────
  function handleRequestDeletePolicy(policy) {
    setConfirmModal({
      isOpen: true,
      type: 'danger',
      title: 'Delete Generated Policy?',
      policyCount: 1,
      policyPreview: [{ ref: policy.ref, title: policy.title }],
      message: `Are you sure you want to delete "${policy.title}" (${policy.ref}) from the extracted policy set?`,
      explicitWarning: 'EXPLICIT CONFIRMATION REQUIRED: This provision will be permanently removed from this ingestion session and will NOT be imported into the database.',
      confirmText: 'Yes, Delete Policy',
      cancelText: 'Keep Policy',
      onConfirm: () => {
        setPolicies(prev => prev.filter(p => p.id !== policy.id));
        setSelectedPolicyIds(prev => prev.filter(id => id !== policy.id));
        showResultModal(
          'Policy Removed',
          `Policy "${policy.title}" (${policy.ref}) was removed from the preview set.`,
          false,
          1
        );
      },
      onCancel: closeConfirmModal,
    });
  }

  // ── 4. Approve Individual Policy Confirmation ─────────────────────────────
  function handleRequestApprovePolicy(policy) {
    setConfirmModal({
      isOpen: true,
      type: 'approve',
      title: 'Approve Policy Provision',
      policyCount: 1,
      policyPreview: [{ ref: policy.ref, title: policy.title }],
      message: `Approve "${policy.title}" (${policy.ref}) for official publication? Approving confirms that the clauses, categorization, and AI metadata have been audited and verified.`,
      confirmText: 'Approve Policy',
      cancelText: 'Cancel',
      onConfirm: () => {
        setPolicies(prev => prev.map(p => p.id === policy.id ? { ...p, status: 'approved', warnings: [] } : p));
        showResultModal(
          'Policy Approved',
          `Policy "${policy.title}" (${policy.ref}) has been marked as approved for database import.`,
          false,
          1
        );
      },
      onCancel: closeConfirmModal,
    });
  }

  // ── 5. Bulk Approve Confirmation ──────────────────────────────────────────
  function handleRequestBulkApprove() {
    const targetIds = selectedPolicyIds.length > 0
      ? selectedPolicyIds
      : policies.filter(p => p.status !== 'approved').map(p => p.id);

    if (targetIds.length === 0) {
      showResultModal('No Policies Pending Approval', 'All policies are already approved or no policies were selected.', false, 0);
      return;
    }

    const affectedPolicies = policies.filter(p => targetIds.includes(p.id));

    setConfirmModal({
      isOpen: true,
      type: 'approve',
      title: 'Bulk Approve Policies',
      policyCount: affectedPolicies.length,
      policyPreview: affectedPolicies.map(p => ({ ref: p.ref, title: p.title })),
      message: `You are about to mark ${affectedPolicies.length} policies as approved. This confirms their legal text, categorization, and AI-generated metadata have been verified for database activation.`,
      confirmText: `Approve ${affectedPolicies.length} Policies`,
      cancelText: 'Cancel',
      onConfirm: () => {
        const idSet = new Set(targetIds);
        setPolicies(prev => prev.map(p => idSet.has(p.id) ? { ...p, status: 'approved', warnings: [] } : p));
        setSelectedPolicyIds([]);
        showResultModal(
          'Policies Bulk Approved',
          `Successfully approved ${affectedPolicies.length} policies. They are now flagged as ready for database import.`,
          false,
          affectedPolicies.length
        );
      },
      onCancel: closeConfirmModal,
    });
  }

  // ── 6. Import Policies to Database (Explicit Confirmation) ────────────────
  function handleRequestImportToDatabase() {
    if (!versionForm.label.trim()) {
      showErrorModal('Validation Error', 'Please specify a version label before importing.');
      return;
    }
    if (policies.length === 0) {
      showErrorModal('Validation Error', 'No policies available to import.');
      return;
    }

    setConfirmModal({
      isOpen: true,
      type: 'import',
      title: 'Confirm Database Import & Version Activation',
      policyCount: policies.length,
      policyPreview: policies.map(p => ({ ref: p.ref, title: p.title })),
      message: `You are about to commit ${policies.length} policies to the MySQL database under version "${versionForm.label}".`,
      explicitWarning: `PRODUCTION DATABASE TRANSACTION: This action will execute an atomic database transaction to insert ${policies.length} policy records into the ordinances table, archive previously active versions, promote "${versionForm.label}" to ACTIVE, and immediately refresh student searches.`,
      confirmText: 'Yes, Confirm & Import to Database',
      cancelText: 'Cancel & Review',
      loading: false,
      onConfirm: async () => {
        await executeImport(policies);
      },
      onCancel: closeConfirmModal,
    });
  }

  // ── 7. Bulk Import Selected Policies (Explicit Confirmation) ──────────────
  function handleRequestBulkImportSelected() {
    if (selectedPolicyIds.length === 0) {
      showErrorModal('Selection Required', 'Please select at least one policy using the checkboxes to bulk import.');
      return;
    }
    const selectedPolicies = policies.filter(p => selectedPolicyIds.includes(p.id));

    setConfirmModal({
      isOpen: true,
      type: 'import',
      title: 'Bulk Import Selected Policies',
      policyCount: selectedPolicies.length,
      policyPreview: selectedPolicies.map(p => ({ ref: p.ref, title: p.title })),
      message: `You are about to import ${selectedPolicies.length} selected policies into the database under "${versionForm.label}".`,
      explicitWarning: `EXPLICIT CONFIRMATION: This will execute a database transaction importing ${selectedPolicies.length} selected policy records into MySQL. Live student search indices will reflect these updates immediately.`,
      confirmText: `Import ${selectedPolicies.length} Policies to Database`,
      cancelText: 'Cancel',
      loading: false,
      onConfirm: async () => {
        await executeImport(selectedPolicies);
      },
      onCancel: closeConfirmModal,
    });
  }

  // ── 8. Finalize Ingestion Confirmation ────────────────────────────────────
  function handleRequestFinalizeIngestion() {
    if (!versionForm.label.trim()) {
      showErrorModal('Validation Error', 'Please specify a version label before finalizing.');
      return;
    }
    if (policies.length === 0) {
      showErrorModal('Validation Error', 'No policies available to finalize.');
      return;
    }

    setConfirmModal({
      isOpen: true,
      type: 'import',
      title: 'Finalize Handbook Ingestion Pipeline',
      policyCount: policies.length,
      policyPreview: policies.map(p => ({ ref: p.ref, title: p.title })),
      message: `Finalizing ingestion will officially publish "${versionForm.label}", archive all prior editions, and make ${policies.length} verified policies active across the student search portal and handbook reader.`,
      explicitWarning: 'FINALIZATION LOCK: Once committed, student search results and handbook navigation will immediately reference this handbook version.',
      confirmText: 'Finalize & Publish Ingestion',
      cancelText: 'Back to Review',
      loading: false,
      onConfirm: async () => {
        await executeImport(policies);
      },
      onCancel: closeConfirmModal,
    });
  }

  // ── Core Import Executor (with loading state & double-click prevention) ───
  async function executeImport(policiesToImport) {
    setImporting(true);
    // Update modal to loading state to disable confirm button and show spinner
    setConfirmModal(prev => prev ? { ...prev, loading: true } : null);

    try {
      const payload = {
        versionLabel: versionForm.label.trim(),
        description: versionForm.description.trim(),
        releaseDate: versionForm.releaseDate,
        policies: policiesToImport,
        tempFileId,
      };

      const res = await api.post('/admin/handbook/import', payload);
      setImportResult(res);
      setActiveStepIndex(7); // Ready
      setStatus('success');
      setSelectedPolicyIds([]);

      // Center-screen success confirmation modal
      showResultModal(
        'Handbook Successfully Activated!',
        `Handbook "${versionForm.label}" is now live in the database with ${policiesToImport.length} official policies. All student searches and handbook viewers are now updated.`,
        false,
        policiesToImport.length,
        'View Live Handbook'
      );

    } catch (err) {
      console.error('[Approve & Import Error]', err);
      const msg = err.status === 413
        ? `Import payload too large (${policiesToImport.length} policies). Please restart the server to apply the updated 25 MB limit, then try again.`
        : err.message || 'Import failed.';

      showResultModal(
        'Database Import Failed',
        msg,
        true,
        policiesToImport.length,
        'Dismiss'
      );
    } finally {
      setImporting(false);
    }
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

  // Bulk selection helpers
  const allFilteredSelected = filteredPolicies.length > 0 && filteredPolicies.every(p => selectedPolicyIds.includes(p.id));

  function handleToggleSelectAll() {
    if (allFilteredSelected) {
      setSelectedPolicyIds(prev => prev.filter(id => !filteredPolicies.some(p => p.id === id)));
    } else {
      const newIds = new Set([...selectedPolicyIds, ...filteredPolicies.map(p => p.id)]);
      setSelectedPolicyIds(Array.from(newIds));
    }
  }

  function handleToggleSelect(id) {
    setSelectedPolicyIds(prev =>
      prev.includes(id) ? prev.filter(x => x !== id) : [...prev, id]
    );
  }

  const unapprovedCount = useMemo(() => {
    return policies.filter(p => p.status !== 'approved' && p.status !== 'ready').length;
  }, [policies]);

  return (
    <div style={{ paddingBottom: 60 }}>
      {/* Center-Screen Reusable Confirmation & Result Modal */}
      {confirmModal && (
        <ConfirmationModal
          {...confirmModal}
          onCancel={confirmModal.onCancel || closeConfirmModal}
        />
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
                      onClick={handleRequestStartProcessing}
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
                Review, audit, or approve each provision. Database remains unchanged until you finalize import.
              </div>
            </div>
            <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}>
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
                onClick={handleRequestBulkApprove}
                style={{
                  display: 'inline-flex', alignItems: 'center', gap: 6,
                  padding: '9px 16px', borderRadius: 10, background: '#059669',
                  border: 'none', color: '#fff',
                  fontSize: '.85rem', fontWeight: 700, cursor: 'pointer', fontFamily: '"Plus Jakarta Sans",sans-serif',
                  boxShadow: '0 2px 10px rgba(0,0,0,0.2)'
                }}
              >
                <CheckCircle2 size={16} /> Bulk Approve All ({policies.length})
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

          {/* ── Contextual Bulk Action Bar ─────────────────────────────────── */}
          {selectedPolicyIds.length > 0 && (
            <div style={{
              background: 'var(--g-dark)', color: '#fff', borderRadius: 14,
              padding: '12px 20px', display: 'flex', alignItems: 'center',
              justifyContent: 'space-between', flexWrap: 'wrap', gap: 12,
              boxShadow: '0 4px 20px rgba(8,47,26,0.25)',
              border: '1px solid rgba(244,197,66,0.3)'
            }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                <span style={{
                  padding: '3px 10px', borderRadius: 999, background: 'var(--gold)',
                  color: 'var(--g-dark)', fontWeight: 800, fontSize: '.78rem'
                }}>
                  {selectedPolicyIds.length} Selected
                </span>
                <span style={{ fontSize: '.86rem', color: 'rgba(255,255,255,0.85)' }}>
                  Multi-policy actions ready
                </span>
                <button
                  type="button"
                  onClick={() => setSelectedPolicyIds([])}
                  style={{
                    background: 'none', border: 'none', color: 'rgba(255,255,255,0.6)',
                    fontSize: '.8rem', cursor: 'pointer', textDecoration: 'underline'
                  }}
                >
                  Deselect All
                </button>
              </div>

              <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}>
                <button
                  type="button"
                  onClick={handleRequestBulkApprove}
                  style={{
                    display: 'inline-flex', alignItems: 'center', gap: 6,
                    padding: '8px 16px', borderRadius: 9, background: '#059669',
                    color: '#fff', border: 'none', fontWeight: 800, fontSize: '.84rem',
                    cursor: 'pointer', fontFamily: '"Plus Jakarta Sans",sans-serif'
                  }}
                >
                  <CheckCircle2 size={15} /> Bulk Approve ({selectedPolicyIds.length})
                </button>
                <button
                  type="button"
                  onClick={handleRequestBulkImportSelected}
                  style={{
                    display: 'inline-flex', alignItems: 'center', gap: 6,
                    padding: '8px 16px', borderRadius: 9, background: 'var(--gold)',
                    color: 'var(--g-dark)', border: 'none', fontWeight: 800, fontSize: '.84rem',
                    cursor: 'pointer', fontFamily: '"Plus Jakarta Sans",sans-serif'
                  }}
                >
                  <Database size={15} /> Bulk Import Selected ({selectedPolicyIds.length})
                </button>
              </div>
            </div>
          )}

          {/* Table Preview */}
          <div style={{
            background: '#fff', border: '1px solid var(--gray-mid)', borderRadius: 16,
            overflow: 'hidden', boxShadow: '0 2px 10px rgba(0,0,0,0.02)'
          }}>
            <div style={{ overflowX: 'auto' }}>
              <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left', fontSize: '.85rem' }}>
                <thead>
                  <tr style={{ background: 'var(--gray-bg)', borderBottom: '1px solid var(--gray-mid)', color: 'var(--gray-t)' }}>
                    <th style={{ padding: '12px 14px', width: 40, textAlign: 'center' }}>
                      <input
                        type="checkbox"
                        checked={allFilteredSelected}
                        onChange={handleToggleSelectAll}
                        style={{ cursor: 'pointer', width: 16, height: 16, accentColor: 'var(--g-primary)' }}
                        title="Select All Filtered"
                      />
                    </th>
                    <th style={{ padding: '12px 16px', fontWeight: 800, width: 120 }}>Code</th>
                    <th style={{ padding: '12px 16px', fontWeight: 800 }}>Policy Title</th>
                    <th style={{ padding: '12px 16px', fontWeight: 800, width: 130 }}>Category</th>
                    <th style={{ padding: '12px 16px', fontWeight: 800, width: 70, textAlign: 'center' }}>Page</th>
                    <th style={{ padding: '12px 16px', fontWeight: 800 }}>Summary & Scenarios</th>
                    <th style={{ padding: '12px 16px', fontWeight: 800, width: 110, textAlign: 'center' }}>Status</th>
                    <th style={{ padding: '12px 16px', fontWeight: 800, width: 140, textAlign: 'right' }}>Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredPolicies.map((p, idx) => {
                    const badge = BADGE_MAP[p.catKey] || { bg: '#F3F4F6', color: '#374151' };
                    const isSelected = selectedPolicyIds.includes(p.id);
                    const isApproved = p.status === 'approved' || p.status === 'ready';

                    return (
                      <tr
                        key={p.id || idx}
                        style={{
                          borderBottom: '1px solid var(--gray-mid)',
                          background: isSelected ? 'rgba(15,79,44,0.04)' : 'transparent',
                          transition: 'background .15s'
                        }}
                        onMouseEnter={e => {
                          if (!isSelected) e.currentTarget.style.background = 'rgba(15,79,44,0.02)';
                        }}
                        onMouseLeave={e => {
                          if (!isSelected) e.currentTarget.style.background = 'transparent';
                        }}
                      >
                        <td style={{ padding: '14px 14px', textAlign: 'center' }}>
                          <input
                            type="checkbox"
                            checked={isSelected}
                            onChange={() => handleToggleSelect(p.id)}
                            style={{ cursor: 'pointer', width: 16, height: 16, accentColor: 'var(--g-primary)' }}
                          />
                        </td>
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
                          {isApproved ? (
                            <span style={{
                              display: 'inline-flex', alignItems: 'center', gap: 4,
                              padding: '3px 10px', borderRadius: 999, fontSize: '.72rem',
                              fontWeight: 700, background: '#D1FAE5', color: '#065F46'
                            }}>
                              <CheckCircle2 size={12} /> Approved
                            </span>
                          ) : (
                            <span style={{
                              display: 'inline-flex', alignItems: 'center', gap: 4,
                              padding: '3px 10px', borderRadius: 999, fontSize: '.72rem',
                              fontWeight: 700, background: '#FEF3C7', color: '#92400E'
                            }}>
                              <AlertTriangle size={12} /> Review
                            </span>
                          )}
                        </td>
                        <td style={{ padding: '14px 16px', textAlign: 'right', whiteSpace: 'nowrap' }}>
                          <div style={{ display: 'flex', gap: 6, justifyContent: 'flex-end', alignItems: 'center' }}>
                            {/* Approve Action */}
                            <button
                              type="button"
                              onClick={() => handleRequestApprovePolicy(p)}
                              title={isApproved ? 'Re-confirm Approval' : 'Approve Policy'}
                              style={{
                                background: isApproved ? 'rgba(5, 150, 105, 0.1)' : 'none',
                                border: `1px solid ${isApproved ? '#059669' : 'var(--gray-mid)'}`,
                                borderRadius: 8, padding: '6px',
                                color: isApproved ? '#059669' : 'var(--gray-dk)',
                                cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center'
                              }}
                            >
                              <ShieldCheck size={14} />
                            </button>

                            {/* Edit Action */}
                            <button
                              type="button"
                              onClick={() => handleOpenEdit(p)}
                              title="Edit Policy"
                              style={{
                                background: 'none', border: '1px solid var(--gray-mid)',
                                borderRadius: 8, padding: '6px', color: 'var(--gray-dk)',
                                cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center'
                              }}
                            >
                              <Edit3 size={14} />
                            </button>

                            {/* Delete Action (Explicit Confirmation Required) */}
                            <button
                              type="button"
                              onClick={() => handleRequestDeletePolicy(p)}
                              title="Delete Generated Policy"
                              style={{
                                background: 'none', border: '1px solid var(--gray-mid)',
                                borderRadius: 8, padding: '6px', color: '#DC2626',
                                cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center'
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
              <strong>Version Safety Guarantee:</strong> Committing will execute an atomic database transaction to insert <strong>{policies.length} policies</strong> into MySQL, archive the previous active handbook, promote this version to <code>ACTIVE</code>, and immediately refresh student searches.
            </div>

            <div style={{ display: 'flex', justifyContent: 'flex-end', alignItems: 'center', gap: 12, flexWrap: 'wrap' }}>
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
                onClick={handleRequestFinalizeIngestion}
                disabled={importing}
                style={{
                  display: 'inline-flex', alignItems: 'center', gap: 8,
                  padding: '11px 22px', borderRadius: 10,
                  border: '1.5px solid var(--g-primary)', background: 'var(--g-pale)',
                  color: 'var(--g-primary)', fontWeight: 800, fontSize: '.9rem',
                  cursor: importing ? 'not-allowed' : 'pointer',
                  fontFamily: '"Plus Jakarta Sans",sans-serif',
                }}
              >
                <Sparkles size={16} /> Finalize Ingestion
              </button>

              <button
                type="button"
                onClick={handleRequestImportToDatabase}
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
                    <Database size={16} color="var(--gold)" />
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
                setSelectedPolicyIds([]);
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
                onClick={handleRequestSaveEdit}
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
