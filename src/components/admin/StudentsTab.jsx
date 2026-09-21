import { useState, useEffect, useRef, useCallback } from 'react';
import { api } from '../../hooks/useApi';
import ConfirmationModal from '../ConfirmationModal';
import {
  Upload,
  FileSpreadsheet,
  CheckCircle2,
  AlertCircle,
  AlertTriangle,
  RefreshCw,
  Search,
  Trash2,
  FileDown,
  GraduationCap,
  Users,
  Clock,
  Database,
  Check,
  X,
  ChevronLeft,
  ChevronRight,
  RotateCcw,
  ShieldAlert,
} from 'lucide-react';

export default function StudentsTab() {
  const [subTab, setSubTab] = useState('upload'); // 'upload' | 'roster' | 'batches'

  // Data state
  const [loading, setLoading] = useState(false);
  const [records, setRecords] = useState([]);
  const [totalRecords, setTotalRecords] = useState(0);
  const [kpis, setKpis] = useState({
    totalRecords: 0,
    registeredCount: 0,
    pendingCount: 0,
    batchCount: 0,
  });
  const [batches, setBatches] = useState([]);
  const [departments, setDepartments] = useState([]);

  // Search & Filter state for Roster
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('all'); // 'all' | 'registered' | 'unregistered'
  const [deptFilter, setDeptFilter] = useState('');
  const [page, setPage] = useState(1);
  const limit = 25;

  // File Upload & Preview state
  const [selectedFile, setSelectedFile] = useState(null);
  const [dragOver, setDragOver] = useState(false);
  const [previewLoading, setPreviewLoading] = useState(false);
  const [previewData, setPreviewData] = useState(null);
  const [previewFilter, setPreviewFilter] = useState('all'); // 'all' | 'valid' | 'invalid'
  const [uploadError, setUploadError] = useState('');
  const fileInputRef = useRef(null);

  // Modal State
  const [confirmModal, setConfirmModal] = useState(null);
  const [actionLoading, setActionLoading] = useState(false);

  // Student Account Reset Modal State
  const [resetModalOpen, setResetModalOpen] = useState(false);
  const [resetPreview, setResetPreview] = useState(null);
  const [resetLoading, setResetLoading] = useState(false);
  const [resetConfirmInput, setResetConfirmInput] = useState('');
  const [resetError, setResetError] = useState('');
  const [resetResult, setResetResult] = useState(null);

  // ── Fetch Master Records ──────────────────────────────────────────────────
  const fetchRoster = useCallback(async () => {
    setLoading(true);
    try {
      const q = new URLSearchParams({
        search,
        status: statusFilter,
        department: deptFilter,
        page: String(page),
        limit: String(limit),
      });
      const data = await api.get(`/admin/students?${q.toString()}`);
      setRecords(data.records || []);
      setTotalRecords(data.total || 0);
      if (data.kpis) setKpis(data.kpis);
      if (data.departments) setDepartments(data.departments);
    } catch (err) {
      console.error('Failed to load roster:', err);
    } finally {
      setLoading(false);
    }
  }, [search, statusFilter, deptFilter, page]);

  // ── Fetch Batch History ───────────────────────────────────────────────────
  async function fetchBatches() {
    try {
      const data = await api.get('/admin/students/batches');
      setBatches(data || []);
    } catch (err) {
      console.error('Failed to load batches:', err);
    }
  }

  useEffect(() => {
    fetchRoster();
    fetchBatches();
  }, [fetchRoster]);

  // Debounced search
  useEffect(() => {
    const timer = setTimeout(() => {
      fetchRoster();
    }, 350);
    return () => clearTimeout(timer);
  }, [fetchRoster]);

  // ── Handle File Selection & Preview ───────────────────────────────────────
  async function handleFileSelect(file) {
    if (!file) return;
    setUploadError('');
    setSelectedFile(file);

    const ext = file.name.toLowerCase();
    if (!ext.endsWith('.csv') && !ext.endsWith('.xlsx') && !ext.endsWith('.xls')) {
      setUploadError('Invalid file format. Please upload a CSV or Excel (.xlsx) file.');
      return;
    }

    if (file.size > 10 * 1024 * 1024) {
      setUploadError('File size exceeds the 10 MB limit.');
      return;
    }

    setPreviewLoading(true);
    try {
      const formData = new FormData();
      formData.append('file', file);
      const res = await api.upload('/admin/students/preview', formData);
      setPreviewData(res);
      setPreviewFilter(res.invalidCount > 0 && res.validCount === 0 ? 'invalid' : 'all');
    } catch (err) {
      setUploadError(err.message || 'Failed to parse file. Please verify columns and try again.');
      setPreviewData(null);
    } finally {
      setPreviewLoading(false);
    }
  }

  // ── Commit Validated Records ──────────────────────────────────────────────
  async function handleCommitImport() {
    if (!previewData || !previewData.validRows || previewData.validRows.length === 0) return;

    setActionLoading(true);
    try {
      const res = await api.post('/admin/students/import', {
        records: previewData.validRows,
        filename: previewData.filename,
      });

      setConfirmModal({
        isOpen: true,
        type: 'success',
        title: 'Import Successful',
        message: res.message || `Successfully imported ${res.count} student record(s).`,
        isResult: true,
        confirmText: 'Done',
        onConfirm: () => {
          setConfirmModal(null);
          setSelectedFile(null);
          setPreviewData(null);
          setSubTab('roster');
          fetchRoster();
          fetchBatches();
        },
      });
    } catch (err) {
      setConfirmModal({
        isOpen: true,
        type: 'error',
        title: 'Import Failed',
        message: err.message || 'Database import failed. Any partial changes were rolled back.',
        isResult: true,
        confirmText: 'Close',
        onConfirm: () => setConfirmModal(null),
      });
    } finally {
      setActionLoading(false);
    }
  }

  // ── Delete Record ─────────────────────────────────────────────────────────
  async function handleDeleteRecord(rec) {
    if (rec.is_registered) {
      alert('Cannot delete this record because the student has already registered an account.');
      return;
    }

    setConfirmModal({
      isOpen: true,
      type: 'danger',
      title: 'Remove Student Record?',
      message: `Are you sure you want to remove student "${rec.student_no}" (${rec.email}) from the authorized master list? This student will no longer be able to register.`,
      confirmText: 'Delete Record',
      onConfirm: async () => {
        try {
          await api.delete(`/admin/students/${rec.id}`);
          setConfirmModal(null);
          fetchRoster();
        } catch (err) {
          alert(err.message || 'Failed to delete record');
        }
      },
      onCancel: () => setConfirmModal(null),
    });
  }

  // Download sample template
  function handleDownloadTemplate() {
    window.location.href = '/api/admin/students/template';
  }

  // ── Reset Student Accounts Flow ──────────────────────────────────────────
  async function handleOpenResetModal() {
    setResetModalOpen(true);
    setResetPreview(null);
    setResetConfirmInput('');
    setResetError('');
    setResetResult(null);
    setResetLoading(true);
    try {
      const data = await api.get('/admin/users/reset-preview');
      setResetPreview(data);
    } catch (err) {
      setResetError(err.message || 'Failed to fetch preflight summary');
    } finally {
      setResetLoading(false);
    }
  }

  async function handleExecuteReset() {
    if (resetConfirmInput !== 'RESET') return;
    setResetLoading(true);
    setResetError('');
    try {
      const data = await api.post('/admin/users/reset-students');
      setResetResult(data);
      fetchRoster();
      fetchBatches();
    } catch (err) {
      setResetError(err.message || 'Failed to reset student accounts');
    } finally {
      setResetLoading(false);
    }
  }

  function handleCloseResetModal() {
    if (resetLoading) return;
    setResetModalOpen(false);
    setResetPreview(null);
    setResetConfirmInput('');
    setResetError('');
    setResetResult(null);
  }

  return (
    <div className="space-y-6">
      {/* ── Confirmation Modal ── */}
      {confirmModal && (
        <ConfirmationModal
          {...confirmModal}
          loading={actionLoading}
        />
      )}

      {/* ── Student Account Reset Modal ── */}
      {resetModalOpen && (
        <div
          role="dialog"
          aria-modal="true"
          className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm z-[99999] flex items-center justify-center p-4 overflow-y-auto"
          onClick={(e) => {
            if (e.target === e.currentTarget && !resetLoading) handleCloseResetModal();
          }}
        >
          <div className="bg-white rounded-2xl max-w-lg w-full shadow-2xl p-6 sm:p-7 relative border border-red-200">
            {!resetLoading && (
              <button
                onClick={handleCloseResetModal}
                className="absolute top-4 right-4 p-1 text-gray-400 hover:text-gray-600 rounded-lg transition"
                aria-label="Close modal"
              >
                <X size={18} />
              </button>
            )}

            {/* If reset was completed, show success result */}
            {resetResult ? (
              <div className="space-y-4">
                <div className="flex items-center gap-3">
                  <div className="w-12 h-12 rounded-xl bg-emerald-50 text-emerald-600 flex items-center justify-center flex-shrink-0">
                    <CheckCircle2 size={26} />
                  </div>
                  <div>
                    <h3 className="font-serif text-xl font-bold text-gray-900">
                      Reset Completed Successfully
                    </h3>
                    <p className="text-xs text-gray-500 mt-0.5">
                      Student accounts have been removed from the database.
                    </p>
                  </div>
                </div>

                <div className="bg-gray-50 border border-gray-200 rounded-xl p-4 grid grid-cols-2 gap-3 text-xs">
                  <div className="bg-white p-3 rounded-lg border border-gray-100">
                    <div className="text-gray-500 font-semibold">Deleted Accounts</div>
                    <div className="text-xl font-bold text-red-600 mt-0.5">{resetResult.deletedCount}</div>
                    <div className="text-[11px] text-gray-400">Student users removed</div>
                  </div>
                  <div className="bg-white p-3 rounded-lg border border-gray-100">
                    <div className="text-gray-500 font-semibold">Admins Preserved</div>
                    <div className="text-xl font-bold text-emerald-600 mt-0.5">{resetResult.preservedAdminCount}</div>
                    <div className="text-[11px] text-gray-400">Credentials untouched</div>
                  </div>
                  <div className="bg-white p-3 rounded-lg border border-gray-100">
                    <div className="text-gray-500 font-semibold">Master Records Reset</div>
                    <div className="text-xl font-bold text-blue-600 mt-0.5">{resetResult.resetRecordsCount}</div>
                    <div className="text-[11px] text-gray-400">Marked as unregistered</div>
                  </div>
                  <div className="bg-white p-3 rounded-lg border border-gray-100">
                    <div className="text-gray-500 font-semibold">Progress Cascaded</div>
                    <div className="text-xl font-bold text-amber-600 mt-0.5">{resetResult.cascadedProgressCount}</div>
                    <div className="text-[11px] text-gray-400">Reading records cleared</div>
                  </div>
                </div>

                <div className="bg-emerald-50 border border-emerald-200 rounded-xl p-3 text-xs text-emerald-800 leading-relaxed">
                  ✓ Students may now register new accounts matching the official authorized master list.
                </div>

                <div className="flex justify-end pt-2">
                  <button
                    onClick={handleCloseResetModal}
                    className="px-5 py-2.5 bg-[#0F4F2C] hover:bg-[#082F1A] text-white text-xs font-bold rounded-xl transition shadow"
                  >
                    Done
                  </button>
                </div>
              </div>
            ) : (
              /* Preflight Warning and Confirmation */
              <div className="space-y-4">
                <div className="flex items-center gap-3">
                  <div className="w-12 h-12 rounded-xl bg-red-50 text-red-600 flex items-center justify-center flex-shrink-0">
                    <ShieldAlert size={26} />
                  </div>
                  <div>
                    <h3 className="font-serif text-xl font-bold text-red-900">
                      Reset Student Accounts
                    </h3>
                    <p className="text-xs text-gray-500 mt-0.5">
                      Safe administrative purge of old registered student accounts
                    </p>
                  </div>
                </div>

                {/* Error Banner if any */}
                {resetError && (
                  <div className="bg-red-50 border border-red-200 text-red-700 text-xs p-3 rounded-xl flex items-center gap-2">
                    <AlertCircle size={16} className="flex-shrink-0" />
                    <span>{resetError}</span>
                  </div>
                )}

                {/* Warning Callout */}
                <div className="bg-red-50 border-l-4 border-red-500 p-3.5 rounded-r-xl space-y-1.5 text-xs text-red-900">
                  <div className="font-bold flex items-center gap-1.5 text-red-800">
                    <AlertTriangle size={15} />
                    <span>Warning: Irreversible Account Deletion</span>
                  </div>
                  <p className="leading-relaxed text-red-700">
                    This action deletes all existing student user accounts and their associated reading progress.
                    Administrator accounts are <strong>strictly preserved</strong>. Master-list records will <strong>not</strong> be deleted, but their registration status will be reset to allow fresh student registrations.
                  </p>
                </div>

                {/* Preflight Counts */}
                <div className="bg-gray-50 border border-gray-200 rounded-xl p-3.5 grid grid-cols-2 gap-2 text-xs">
                  <div className="p-2.5 bg-white rounded-lg border border-gray-100">
                    <div className="text-gray-500 font-medium">Students to Delete:</div>
                    <div className="text-lg font-bold text-red-600">
                      {resetLoading && !resetPreview ? (
                        <span className="text-gray-400 text-sm">Loading…</span>
                      ) : (
                        `${resetPreview?.studentAccountsCount ?? 0} account(s)`
                      )}
                    </div>
                  </div>
                  <div className="p-2.5 bg-white rounded-lg border border-gray-100">
                    <div className="text-gray-500 font-medium">Admins Preserved:</div>
                    <div className="text-lg font-bold text-emerald-600">
                      {resetLoading && !resetPreview ? (
                        <span className="text-gray-400 text-sm">Loading…</span>
                      ) : (
                        `${resetPreview?.adminAccountsCount ?? 1} account(s)`
                      )}
                    </div>
                  </div>
                  <div className="p-2.5 bg-white rounded-lg border border-gray-100">
                    <div className="text-gray-500 font-medium">Progress Cascaded:</div>
                    <div className="text-sm font-semibold text-gray-700">
                      {resetLoading && !resetPreview ? '—' : `${resetPreview?.cascadedProgressCount ?? 0} record(s)`}
                    </div>
                  </div>
                  <div className="p-2.5 bg-white rounded-lg border border-gray-100">
                    <div className="text-gray-500 font-medium">Master List Records:</div>
                    <div className="text-sm font-semibold text-blue-700">
                      Preserved (Reset status)
                    </div>
                  </div>
                </div>

                {/* Confirmation Input Field */}
                <div className="space-y-1.5 pt-1">
                  <label className="block text-xs font-semibold text-gray-700">
                    To confirm, please type <span className="font-mono text-red-700 font-bold">RESET</span> below:
                  </label>
                  <input
                    type="text"
                    value={resetConfirmInput}
                    onChange={(e) => setResetConfirmInput(e.target.value)}
                    placeholder="Type RESET to confirm"
                    disabled={resetLoading}
                    className="w-full px-3.5 py-2 border border-gray-300 rounded-xl text-xs font-mono outline-none focus:border-red-500 focus:ring-2 focus:ring-red-100"
                  />
                </div>

                {/* Footer Buttons */}
                <div className="flex items-center justify-end gap-2 pt-3 border-t border-gray-100">
                  <button
                    type="button"
                    onClick={handleCloseResetModal}
                    disabled={resetLoading}
                    className="px-4 py-2 border border-gray-300 rounded-xl text-xs font-semibold text-gray-700 hover:bg-gray-50 transition"
                  >
                    Cancel
                  </button>
                  <button
                    type="button"
                    onClick={handleExecuteReset}
                    disabled={resetConfirmInput !== 'RESET' || resetLoading}
                    className={`flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-bold text-white transition shadow-sm ${resetConfirmInput === 'RESET' && !resetLoading
                        ? 'bg-red-600 hover:bg-red-700'
                        : 'bg-gray-300 cursor-not-allowed'
                      }`}
                  >
                    {resetLoading ? (
                      <>
                        <RefreshCw size={14} className="animate-spin" />
                        <span>Resetting Accounts…</span>
                      </>
                    ) : (
                      <>
                        <RotateCcw size={14} />
                        <span>Confirm Account Reset</span>
                      </>
                    )}
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>
      )}

      {/* ── Header ── */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h2 style={{ fontFamily: '"DM Serif Display",serif', fontSize: '1.6rem', color: 'var(--g-dark)' }}>
            Student Master List & Authentication
          </h2>
          <p style={{ fontSize: '.85rem', color: 'var(--gray-t)', marginTop: 2 }}>
            Manage authorized student rosters to secure self-registration via Student Number and University Email.
          </p>
        </div>
        <div className="flex items-center gap-2 flex-wrap">
          <button
            onClick={handleDownloadTemplate}
            className="flex items-center gap-1.5 px-3 py-2 bg-white border border-gray-300 hover:bg-gray-50 rounded-lg text-xs font-semibold text-gray-700 transition shadow-sm"
            title="Download CSV Template"
          >
            <FileDown size={15} color="var(--g-primary)" />
            <span>Sample Template</span>
          </button>
          <button
            onClick={handleOpenResetModal}
            className="flex items-center gap-1.5 px-3 py-2 bg-red-50 border border-red-200 hover:bg-red-100 rounded-lg text-xs font-semibold text-red-700 transition shadow-sm"
            title="Reset old student accounts to allow new registrations"
          >
            <RotateCcw size={14} className="text-red-600" />
            <span>Reset Student Accounts</span>
          </button>
          <button
            onClick={() => { fetchRoster(); fetchBatches(); }}
            className="flex items-center gap-1.5 px-3 py-2 bg-white border border-gray-300 hover:bg-gray-50 rounded-lg text-xs font-semibold text-gray-700 transition shadow-sm"
            title="Refresh records"
          >
            <RefreshCw size={14} className={loading ? 'animate-spin' : ''} />
            <span>Refresh</span>
          </button>
        </div>
      </div>

      {/* ── KPI Cards ── */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="bg-white p-4 rounded-xl border border-gray-200 flex items-center gap-3.5 shadow-sm">
          <div className="w-11 h-11 rounded-lg bg-emerald-50 text-emerald-700 flex items-center justify-center flex-shrink-0">
            <GraduationCap size={22} />
          </div>
          <div>
            <div className="text-xs font-semibold text-gray-500 uppercase tracking-wider">Authorized Roster</div>
            <div className="text-2xl font-bold text-gray-900 leading-tight">
              {kpis.totalRecords.toLocaleString()}
            </div>
            <div className="text-xs text-gray-400 mt-0.5">Total records in master list</div>
          </div>
        </div>

        <div className="bg-white p-4 rounded-xl border border-gray-200 flex items-center gap-3.5 shadow-sm">
          <div className="w-11 h-11 rounded-lg bg-blue-50 text-blue-700 flex items-center justify-center flex-shrink-0">
            <CheckCircle2 size={22} />
          </div>
          <div>
            <div className="text-xs font-semibold text-gray-500 uppercase tracking-wider">Registered Accounts</div>
            <div className="text-2xl font-bold text-gray-900 leading-tight">
              {kpis.registeredCount.toLocaleString()}
            </div>
            <div className="text-xs text-emerald-600 font-semibold mt-0.5">
              {kpis.totalRecords > 0 ? `${Math.round((kpis.registeredCount / kpis.totalRecords) * 100)}% registered` : '0%'}
            </div>
          </div>
        </div>

        <div className="bg-white p-4 rounded-xl border border-gray-200 flex items-center gap-3.5 shadow-sm">
          <div className="w-11 h-11 rounded-lg bg-amber-50 text-amber-700 flex items-center justify-center flex-shrink-0">
            <Clock size={22} />
          </div>
          <div>
            <div className="text-xs font-semibold text-gray-500 uppercase tracking-wider">Pending Accounts</div>
            <div className="text-2xl font-bold text-gray-900 leading-tight">
              {kpis.pendingCount.toLocaleString()}
            </div>
            <div className="text-xs text-amber-600 font-semibold mt-0.5">Awaiting self-registration</div>
          </div>
        </div>

        <div className="bg-white p-4 rounded-xl border border-gray-200 flex items-center gap-3.5 shadow-sm">
          <div className="w-11 h-11 rounded-lg bg-purple-50 text-purple-700 flex items-center justify-center flex-shrink-0">
            <Database size={22} />
          </div>
          <div>
            <div className="text-xs font-semibold text-gray-500 uppercase tracking-wider">Import Batches</div>
            <div className="text-2xl font-bold text-gray-900 leading-tight">
              {kpis.batchCount.toLocaleString()}
            </div>
            <div className="text-xs text-gray-400 mt-0.5">Completed batch uploads</div>
          </div>
        </div>
      </div>

      {/* ── Sub Navigation Tabs ── */}
      <div className="flex border-b border-gray-200 bg-white px-3 rounded-t-xl">
        <button
          onClick={() => setSubTab('upload')}
          className={`flex items-center gap-2 py-3 px-4 font-semibold text-xs sm:text-sm border-b-2 transition ${subTab === 'upload'
              ? 'border-[#0F4F2C] text-[#0F4F2C]'
              : 'border-transparent text-gray-500 hover:text-gray-800'
            }`}
        >
          <Upload size={16} />
          <span>Upload Roster (CSV / XLSX)</span>
        </button>

        <button
          onClick={() => setSubTab('roster')}
          className={`flex items-center gap-2 py-3 px-4 font-semibold text-xs sm:text-sm border-b-2 transition ${subTab === 'roster'
              ? 'border-[#0F4F2C] text-[#0F4F2C]'
              : 'border-transparent text-gray-500 hover:text-gray-800'
            }`}
        >
          <Users size={16} />
          <span>Master Records ({totalRecords})</span>
        </button>

        <button
          onClick={() => setSubTab('batches')}
          className={`flex items-center gap-2 py-3 px-4 font-semibold text-xs sm:text-sm border-b-2 transition ${subTab === 'batches'
              ? 'border-[#0F4F2C] text-[#0F4F2C]'
              : 'border-transparent text-gray-500 hover:text-gray-800'
            }`}
        >
          <Database size={16} />
          <span>Import History ({batches.length})</span>
        </button>
      </div>

      {/* ── Tab Content: Upload Roster ── */}
      {subTab === 'upload' && (
        <div className="bg-white rounded-b-xl border border-t-0 border-gray-200 p-6 space-y-6">

          {/* Upload Dropzone */}
          {!previewData && (
            <div
              onDragOver={(e) => { e.preventDefault(); setDragOver(true); }}
              onDragLeave={() => setDragOver(false)}
              onDrop={(e) => {
                e.preventDefault();
                setDragOver(false);
                if (e.dataTransfer.files?.[0]) handleFileSelect(e.dataTransfer.files[0]);
              }}
              onClick={() => fileInputRef.current?.click()}
              className={`border-2 border-dashed rounded-2xl p-10 text-center cursor-pointer transition ${dragOver
                  ? 'border-[#0F4F2C] bg-[#0F4F2C]/5 scale-[0.99]'
                  : 'border-gray-300 hover:border-[#0F4F2C] hover:bg-gray-50'
                }`}
            >
              <input
                ref={fileInputRef}
                type="file"
                accept=".csv, .xlsx, .xls"
                className="hidden"
                onChange={(e) => {
                  if (e.target.files?.[0]) handleFileSelect(e.target.files[0]);
                }}
              />
              <div className="w-16 h-16 rounded-2xl bg-emerald-50 text-[#0F4F2C] flex items-center justify-center mx-auto mb-4">
                {previewLoading ? (
                  <RefreshCw size={28} className="animate-spin text-[#0F4F2C]" />
                ) : (
                  <FileSpreadsheet size={32} />
                )}
              </div>
              <div className="text-base font-bold text-gray-800 mb-1">
                {previewLoading ? 'Parsing and validating spreadsheet…' : 'Drop your student roster here, or click to browse'}
              </div>
              <p className="text-xs text-gray-500 max-w-md mx-auto mb-4">
                Accepts .CSV and .XLSX spreadsheets up to 10 MB. In-memory validation prevents duplicate entries and database conflicts.
              </p>
              <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full bg-gray-100 text-xs text-gray-600 font-medium">
                <span>Columns: student_no, email, department, program</span>
              </div>
            </div>
          )}

          {/* Upload Error Alert */}
          {uploadError && (
            <div className="bg-red-50 border border-red-200 rounded-xl p-4 flex items-start gap-3">
              <AlertCircle size={20} className="text-red-600 flex-shrink-0 mt-0.5" />
              <div className="text-xs text-red-700">
                <div className="font-bold text-red-900 text-sm mb-0.5">Validation Error</div>
                <div>{uploadError}</div>
              </div>
            </div>
          )}

          {/* ── Preview Table & Review ── */}
          {previewData && (
            <div className="space-y-4 border border-gray-200 rounded-xl p-5 bg-gray-50/50">
              {/* Preview Bar */}
              <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4 pb-4 border-b border-gray-200">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-lg bg-emerald-100 text-emerald-800 flex items-center justify-center flex-shrink-0">
                    <FileSpreadsheet size={20} />
                  </div>
                  <div>
                    <div className="text-sm font-bold text-gray-900">{selectedFile?.name || previewData.filename}</div>
                    <div className="text-xs text-gray-500">
                      Total scanned: <strong>{previewData.totalRows}</strong> rows
                    </div>
                  </div>
                </div>

                {/* Badges & Filters */}
                <div className="flex flex-wrap items-center gap-2">
                  <button
                    onClick={() => setPreviewFilter('all')}
                    className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition ${previewFilter === 'all'
                        ? 'bg-gray-800 text-white'
                        : 'bg-white text-gray-600 border border-gray-200 hover:bg-gray-50'
                      }`}
                  >
                    All ({previewData.totalRows})
                  </button>
                  <button
                    onClick={() => setPreviewFilter('valid')}
                    className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold transition ${previewFilter === 'valid'
                        ? 'bg-emerald-700 text-white'
                        : 'bg-emerald-50 text-emerald-700 border border-emerald-200 hover:bg-emerald-100'
                      }`}
                  >
                    <Check size={14} />
                    Valid to Import ({previewData.validCount})
                  </button>
                  {previewData.invalidCount > 0 && (
                    <button
                      onClick={() => setPreviewFilter('invalid')}
                      className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold transition ${previewFilter === 'invalid'
                          ? 'bg-red-600 text-white'
                          : 'bg-red-50 text-red-700 border border-red-200 hover:bg-red-100'
                        }`}
                    >
                      <AlertTriangle size={14} />
                      Errors / Duplicates ({previewData.invalidCount})
                    </button>
                  )}
                </div>
              </div>

              {/* Notice for invalid rows */}
              {previewData.invalidCount > 0 && (
                <div className="bg-amber-50 border border-amber-200 rounded-lg p-3 text-xs text-amber-800 flex items-center gap-2.5">
                  <AlertTriangle size={16} className="flex-shrink-0 text-amber-600" />
                  <span>
                    <strong>{previewData.invalidCount} invalid or duplicate rows</strong> were detected and will be skipped. Only valid rows will be committed upon confirmation.
                  </span>
                </div>
              )}

              {/* Scrollable Preview Table */}
              <div className="bg-white border border-gray-200 rounded-lg overflow-hidden shadow-sm max-h-96 overflow-y-auto">
                <table className="w-full text-left text-xs">
                  <thead className="bg-gray-100/80 text-gray-600 font-bold uppercase tracking-wider text-[11px] sticky top-0 z-10 border-b border-gray-200">
                    <tr>
                      <th className="py-2.5 px-3">Row</th>
                      <th className="py-2.5 px-3">Status</th>
                      <th className="py-2.5 px-3">Student Number</th>
                      <th className="py-2.5 px-3">Email Address</th>
                      <th className="py-2.5 px-3">Department</th>
                      <th className="py-2.5 px-3">Program</th>
                      <th className="py-2.5 px-3">Full Name</th>
                      <th className="py-2.5 px-3">Details</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-100 text-gray-700 font-medium">
                    {/* Invalid Rows */}
                    {(previewFilter === 'all' || previewFilter === 'invalid') &&
                      previewData.invalidRows.map((row, idx) => (
                        <tr key={`inv-${idx}`} className="bg-red-50/40 hover:bg-red-50/70">
                          <td className="py-2 px-3 text-gray-400 font-mono">#{row.rowNumber}</td>
                          <td className="py-2 px-3">
                            <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold bg-red-100 text-red-800">
                              <X size={12} /> Error
                            </span>
                          </td>
                          <td className="py-2 px-3 font-mono font-semibold text-gray-900">{row.data.student_no || '—'}</td>
                          <td className="py-2 px-3 text-gray-800">{row.data.email || '—'}</td>
                          <td className="py-2 px-3 text-gray-600">{row.data.department || '—'}</td>
                          <td className="py-2 px-3 text-gray-600">{row.data.program || '—'}</td>
                          <td className="py-2 px-3 text-gray-500">{row.data.full_name || '—'}</td>
                          <td className="py-2 px-3">
                            <div className="space-y-0.5">
                              {row.errors.map((e, eIdx) => (
                                <div key={eIdx} className="text-red-700 text-[11px] flex items-center gap-1">
                                  <span>•</span> {e}
                                </div>
                              ))}
                            </div>
                          </td>
                        </tr>
                      ))}

                    {/* Valid Rows */}
                    {(previewFilter === 'all' || previewFilter === 'valid') &&
                      previewData.validRows.map((row, idx) => (
                        <tr key={`val-${idx}`} className="hover:bg-gray-50">
                          <td className="py-2 px-3 text-gray-400 font-mono">#{row.rowNumber}</td>
                          <td className="py-2 px-3">
                            <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold bg-emerald-100 text-emerald-800">
                              <Check size={12} /> Ready
                            </span>
                          </td>
                          <td className="py-2 px-3 font-mono font-semibold text-gray-900">{row.student_no}</td>
                          <td className="py-2 px-3 text-gray-800">{row.email}</td>
                          <td className="py-2 px-3 text-gray-600">{row.department}</td>
                          <td className="py-2 px-3 text-gray-600">{row.program}</td>
                          <td className="py-2 px-3 text-gray-600">{row.full_name || '—'}</td>
                          <td className="py-2 px-3 text-emerald-700 text-[11px]">Valid format</td>
                        </tr>
                      ))}
                  </tbody>
                </table>
              </div>

              {/* Actions */}
              <div className="flex flex-col sm:flex-row items-center justify-between gap-3 pt-2">
                <button
                  onClick={() => {
                    setSelectedFile(null);
                    setPreviewData(null);
                    setUploadError('');
                  }}
                  className="px-4 py-2 text-xs font-semibold text-gray-600 hover:text-gray-900 transition"
                >
                  ← Choose Different File
                </button>

                <button
                  disabled={previewData.validCount === 0 || actionLoading}
                  onClick={() => {
                    setConfirmModal({
                      isOpen: true,
                      type: 'import',
                      title: 'Confirm Master List Import',
                      message: `You are about to import ${previewData.validCount} authorized student record(s) from "${previewData.filename}". Students will be permitted to register user accounts matching these student numbers and emails.`,
                      explicitWarning: 'All valid records will be imported inside an atomic database transaction. Existing accounts will not be overwritten.',
                      confirmText: `Confirm & Import (${previewData.validCount})`,
                      onConfirm: handleCommitImport,
                      onCancel: () => setConfirmModal(null),
                    });
                  }}
                  className={`flex items-center gap-2 px-5 py-2.5 rounded-xl font-bold text-xs text-white transition ${previewData.validCount > 0
                      ? 'bg-[#0F4F2C] hover:bg-[#082F1A] shadow-md'
                      : 'bg-gray-300 cursor-not-allowed'
                    }`}
                >
                  <Check size={16} />
                  <span>Confirm & Import {previewData.validCount} Valid Records</span>
                </button>
              </div>
            </div>
          )}
        </div>
      )}

      {/* ── Tab Content: Master Records Browser ── */}
      {subTab === 'roster' && (
        <div className="bg-white rounded-b-xl border border-t-0 border-gray-200 p-6 space-y-4">
          {/* Filter & Search Bar */}
          <div className="flex flex-col md:flex-row items-stretch md:items-center justify-between gap-3">
            {/* Search */}
            <div className="relative flex-1">
              <Search size={16} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-gray-400" />
              <input
                type="text"
                value={search}
                onChange={(e) => { setSearch(e.target.value); setPage(1); }}
                placeholder="Search by student number, email, name, or program…"
                className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg text-xs outline-none focus:border-[#0F4F2C]"
              />
            </div>

            {/* Department Filter */}
            <select
              value={deptFilter}
              onChange={(e) => { setDeptFilter(e.target.value); setPage(1); }}
              className="py-2 px-3 border border-gray-300 rounded-lg text-xs outline-none bg-white text-gray-700"
            >
              <option value="">All Departments</option>
              {departments.map((d) => (
                <option key={d} value={d}>{d}</option>
              ))}
            </select>

            {/* Status Filter */}
            <div className="flex items-center rounded-lg border border-gray-300 overflow-hidden bg-white text-xs">
              <button
                onClick={() => { setStatusFilter('all'); setPage(1); }}
                className={`px-3 py-2 font-semibold transition ${statusFilter === 'all' ? 'bg-[#0F4F2C] text-white' : 'text-gray-600 hover:bg-gray-50'
                  }`}
              >
                All
              </button>
              <button
                onClick={() => { setStatusFilter('registered'); setPage(1); }}
                className={`px-3 py-2 font-semibold transition ${statusFilter === 'registered' ? 'bg-[#0F4F2C] text-white' : 'text-gray-600 hover:bg-gray-50'
                  }`}
              >
                Registered
              </button>
              <button
                onClick={() => { setStatusFilter('unregistered'); setPage(1); }}
                className={`px-3 py-2 font-semibold transition ${statusFilter === 'unregistered' ? 'bg-[#0F4F2C] text-white' : 'text-gray-600 hover:bg-gray-50'
                  }`}
              >
                Pending
              </button>
            </div>
          </div>

          {/* Roster Table */}
          <div className="border border-gray-200 rounded-xl overflow-hidden shadow-sm">
            <table className="w-full text-left text-xs">
              <thead className="bg-gray-50 text-gray-600 font-bold uppercase tracking-wider text-[11px] border-b border-gray-200">
                <tr>
                  <th className="py-3 px-4">Student Number</th>
                  <th className="py-3 px-4">University Email</th>
                  <th className="py-3 px-4">Full Name</th>
                  <th className="py-3 px-4">College / Dept</th>
                  <th className="py-3 px-4">Program</th>
                  <th className="py-3 px-4">Status</th>
                  <th className="py-3 px-4">Import Batch</th>
                  <th className="py-3 px-4 text-right">Action</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100 text-gray-700">
                {loading ? (
                  <tr>
                    <td colSpan={8} className="py-12 text-center text-gray-400">
                      <RefreshCw size={24} className="animate-spin mx-auto mb-2 text-[#0F4F2C]" />
                      Loading authorized master records…
                    </td>
                  </tr>
                ) : records.length === 0 ? (
                  <tr>
                    <td colSpan={8} className="py-12 text-center text-gray-400">
                      No student records found matching your filters.
                    </td>
                  </tr>
                ) : (
                  records.map((rec) => (
                    <tr key={rec.id} className="hover:bg-gray-50/70 transition">
                      <td className="py-3 px-4 font-mono font-bold text-gray-900">{rec.student_no}</td>
                      <td className="py-3 px-4 text-gray-700">{rec.email}</td>
                      <td className="py-3 px-4 font-medium text-gray-800">{rec.full_name || '—'}</td>
                      <td className="py-3 px-4 text-gray-600 max-w-[200px] truncate" title={rec.department}>
                        {rec.department}
                      </td>
                      <td className="py-3 px-4 text-gray-600 max-w-[180px] truncate" title={rec.program}>
                        {rec.program}
                      </td>
                      <td className="py-3 px-4">
                        {rec.is_registered ? (
                          <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[11px] font-bold bg-emerald-50 text-emerald-700 border border-emerald-200">
                            <CheckCircle2 size={12} /> Registered
                          </span>
                        ) : (
                          <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[11px] font-bold bg-amber-50 text-amber-700 border border-amber-200">
                            <Clock size={12} /> Pending
                          </span>
                        )}
                      </td>
                      <td className="py-3 px-4 text-gray-500 font-mono text-[11px]">
                        {rec.batch_filename || rec.import_batch_id?.substring(0, 12) || '—'}
                      </td>
                      <td className="py-3 px-4 text-right">
                        {!rec.is_registered ? (
                          <button
                            onClick={() => handleDeleteRecord(rec)}
                            className="text-red-500 hover:text-red-700 p-1 rounded hover:bg-red-50 transition"
                            title="Delete unauthorized or mistaken record"
                          >
                            <Trash2 size={15} />
                          </button>
                        ) : (
                          <span className="text-gray-300 text-[11px] cursor-not-allowed" title="Account already registered">
                            Active
                          </span>
                        )}
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>

          {/* Pagination */}
          {totalRecords > limit && (
            <div className="flex items-center justify-between pt-3 text-xs text-gray-500">
              <div>
                Showing {(page - 1) * limit + 1} to {Math.min(page * limit, totalRecords)} of {totalRecords} records
              </div>
              <div className="flex items-center gap-1">
                <button
                  disabled={page === 1}
                  onClick={() => setPage(p => Math.max(1, p - 1))}
                  className="p-1.5 rounded border border-gray-300 disabled:opacity-40 hover:bg-gray-50"
                >
                  <ChevronLeft size={16} />
                </button>
                <span className="px-3 py-1 font-semibold text-gray-700">Page {page}</span>
                <button
                  disabled={page * limit >= totalRecords}
                  onClick={() => setPage(p => p + 1)}
                  className="p-1.5 rounded border border-gray-300 disabled:opacity-40 hover:bg-gray-50"
                >
                  <ChevronRight size={16} />
                </button>
              </div>
            </div>
          )}
        </div>
      )}

      {/* ── Tab Content: Import Batch History ── */}
      {subTab === 'batches' && (
        <div className="bg-white rounded-b-xl border border-t-0 border-gray-200 p-6 space-y-4">
          <div className="border border-gray-200 rounded-xl overflow-hidden shadow-sm">
            <table className="w-full text-left text-xs">
              <thead className="bg-gray-50 text-gray-600 font-bold uppercase tracking-wider text-[11px] border-b border-gray-200">
                <tr>
                  <th className="py-3 px-4">Batch ID</th>
                  <th className="py-3 px-4">Filename</th>
                  <th className="py-3 px-4">Imported Records</th>
                  <th className="py-3 px-4">Registered Accounts</th>
                  <th className="py-3 px-4">Imported By</th>
                  <th className="py-3 px-4">Date & Time</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100 text-gray-700">
                {batches.length === 0 ? (
                  <tr>
                    <td colSpan={6} className="py-10 text-center text-gray-400">
                      No import batches recorded yet.
                    </td>
                  </tr>
                ) : (
                  batches.map((b) => (
                    <tr key={b.id} className="hover:bg-gray-50/70 transition">
                      <td className="py-3 px-4 font-mono font-semibold text-gray-900">{b.id}</td>
                      <td className="py-3 px-4 font-medium text-gray-800">{b.filename}</td>
                      <td className="py-3 px-4 font-bold text-gray-900">{b.total_records}</td>
                      <td className="py-3 px-4">
                        <span className="font-semibold text-emerald-700">
                          {b.registered_count || 0} registered
                        </span>
                      </td>
                      <td className="py-3 px-4 text-gray-600">{b.imported_by}</td>
                      <td className="py-3 px-4 text-gray-500">
                        {new Date(b.created_at).toLocaleString()}
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}
