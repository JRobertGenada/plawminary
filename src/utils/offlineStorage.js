/**
 * src/utils/offlineStorage.js
 *
 * Client-side IndexedDB offline storage for PLawminary.
 * Provides robust, zero-dependency persistence for:
 * - Full ordinance policy content (JSON, steps, summary, full text, version metadata)
 * - Approved Student Handbook PDF document (binary Blob, version label, total pages)
 * - Version synchronization and safe outdated content detection
 */

const DB_NAME = 'plawminary_offline_db';
const DB_VERSION = 1;

let dbPromise = null;

/**
 * Open or upgrade the IndexedDB database instance
 */
export function openDB() {
  if (dbPromise) return dbPromise;

  dbPromise = new Promise((resolve, reject) => {
    if (typeof window === 'undefined' || !window.indexedDB) {
      return reject(new Error('IndexedDB is not supported in this environment.'));
    }

    const request = indexedDB.open(DB_NAME, DB_VERSION);

    request.onupgradeneeded = (event) => {
      const db = event.target.result;

      // 1. Ordinances store
      if (!db.objectStoreNames.contains('ordinances')) {
        const ordStore = db.createObjectStore('ordinances', { keyPath: 'id' });
        ordStore.createIndex('catK', 'catK', { unique: false });
        ordStore.createIndex('versionId', 'versionId', { unique: false });
        ordStore.createIndex('savedAt', 'savedAt', { unique: false });
        ordStore.createIndex('title', 'title', { unique: false });
      }

      // 2. Handbook store
      if (!db.objectStoreNames.contains('handbook')) {
        const hbStore = db.createObjectStore('handbook', { keyPath: 'id' });
        hbStore.createIndex('versionId', 'versionId', { unique: false });
        hbStore.createIndex('savedAt', 'savedAt', { unique: false });
      }

      // 3. Metadata & sync store
      if (!db.objectStoreNames.contains('sync_meta')) {
        db.createObjectStore('sync_meta', { keyPath: 'key' });
      }
    };

    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error || new Error('Failed to open IndexedDB.'));
  });

  return dbPromise;
}

/**
 * Broadcast change event across the application
 */
export function broadcastOfflineChange(detail = {}) {
  if (typeof window !== 'undefined') {
    window.dispatchEvent(new CustomEvent('plawminary_offline_updated', { detail }));
  }
}

/**
 * Subscribe to offline storage updates
 */
export function subscribeOfflineChanges(callback) {
  if (typeof window === 'undefined') return () => {};
  const handler = (e) => callback(e.detail);
  window.addEventListener('plawminary_offline_updated', handler);
  return () => window.removeEventListener('plawminary_offline_updated', handler);
}

// ─────────────────────────────────────────────────────────────────────────────
// ORDINANCES STORAGE
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Save full ordinance content offline
 */
export async function saveOrdinanceOffline(ord, activeVersion = null, studentId = null) {
  if (!ord || !ord.id) throw new Error('Invalid ordinance provided for offline saving.');
  const db = await openDB();

  const record = {
    id: String(ord.id),
    ref: ord.ref || `ORD-${ord.id}`,
    catK: ord.catK || 'conduct',
    cat: ord.cat || 'Student Conduct',
    title: ord.title || 'Untitled Policy',
    desc: ord.desc || '',
    summary: ord.summary || '',
    full: ord.full || ord.fullText || '',
    steps: Array.isArray(ord.steps) ? ord.steps : [],
    related: Array.isArray(ord.related) ? ord.related : [],
    handbookSectionId: ord.handbookSectionId || null,
    page: ord.page || null,
    versionId: ord.versionId || activeVersion?.id || 1,
    versionLabel: ord.versionLabel || activeVersion?.label || '2025 Revised',
    savedAt: new Date().toISOString(),
    isOutdated: false,
    latestVersionLabel: null,
    studentId: studentId || null,
  };

  return new Promise((resolve, reject) => {
    const tx = db.transaction('ordinances', 'readwrite');
    const store = tx.objectStore('ordinances');
    const req = store.put(record);

    req.onsuccess = () => {
      broadcastOfflineChange({ type: 'ordinance_saved', id: record.id });
      resolve(record);
    };
    req.onerror = () => reject(req.error || new Error('Failed to save ordinance to IndexedDB.'));
  });
}

/**
 * Check if a specific ordinance is saved offline
 */
export async function isOrdinanceSaved(id) {
  if (!id) return false;
  try {
    const db = await openDB();
    return new Promise((resolve) => {
      const tx = db.transaction('ordinances', 'readonly');
      const store = tx.objectStore('ordinances');
      const req = store.get(String(id));
      req.onsuccess = () => resolve(!!req.result);
      req.onerror = () => resolve(false);
    });
  } catch {
    return false;
  }
}

/**
 * Get a single saved ordinance by ID
 */
export async function getSavedOrdinance(id) {
  if (!id) return null;
  const db = await openDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction('ordinances', 'readonly');
    const store = tx.objectStore('ordinances');
    const req = store.get(String(id));
    req.onsuccess = () => resolve(req.result || null);
    req.onerror = () => reject(req.error || new Error('Failed to retrieve saved ordinance.'));
  });
}

/**
 * Remove an ordinance from offline storage
 */
export async function removeOrdinanceOffline(id) {
  if (!id) return false;
  const db = await openDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction('ordinances', 'readwrite');
    const store = tx.objectStore('ordinances');
    const req = store.delete(String(id));

    req.onsuccess = () => {
      broadcastOfflineChange({ type: 'ordinance_removed', id: String(id) });
      resolve(true);
    };
    req.onerror = () => reject(req.error || new Error('Failed to delete ordinance from IndexedDB.'));
  });
}

/**
 * Retrieve all saved ordinances
 */
export async function getAllSavedOrdinances() {
  try {
    const db = await openDB();
    return new Promise((resolve, reject) => {
      const tx = db.transaction('ordinances', 'readonly');
      const store = tx.objectStore('ordinances');
      const req = store.getAll();

      req.onsuccess = () => {
        const list = req.result || [];
        // Sort descending by saved date
        list.sort((a, b) => new Date(b.savedAt) - new Date(a.savedAt));
        resolve(list);
      };
      req.onerror = () => reject(req.error || new Error('Failed to load saved ordinances.'));
    });
  } catch {
    return [];
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// HANDBOOK PDF STORAGE
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Save active handbook PDF binary blob and metadata offline
 */
export async function saveHandbookOffline({
  pdfBlob,
  versionInfo = null,
  totalPages = 0,
  studentId = null
}) {
  if (!pdfBlob) throw new Error('No PDF Blob supplied for saving handbook offline.');
  const db = await openDB();

  const record = {
    id: 'active_handbook',
    pdfBlob, // Actual binary Blob
    versionId: versionInfo?.id || 1,
    versionLabel: versionInfo?.label || '2025 Revised',
    description: versionInfo?.description || 'Official PLSP Student Handbook',
    releaseDate: versionInfo?.releaseDate || new Date().toISOString().split('T')[0],
    totalPages: totalPages || 0,
    fileSize: pdfBlob.size,
    savedAt: new Date().toISOString(),
    isOutdated: false,
    latestVersionLabel: null,
    studentId: studentId || null,
  };

  return new Promise((resolve, reject) => {
    const tx = db.transaction('handbook', 'readwrite');
    const store = tx.objectStore('handbook');
    const req = store.put(record);

    req.onsuccess = () => {
      broadcastOfflineChange({ type: 'handbook_saved' });
      resolve(record);
    };
    req.onerror = () => reject(req.error || new Error('Failed to store handbook PDF in IndexedDB.'));
  });
}

/**
 * Check if the active handbook is saved offline
 */
export async function isHandbookSaved() {
  try {
    const db = await openDB();
    return new Promise((resolve) => {
      const tx = db.transaction('handbook', 'readonly');
      const store = tx.objectStore('handbook');
      const req = store.get('active_handbook');
      req.onsuccess = () => resolve(!!req.result && !!req.result.pdfBlob);
      req.onerror = () => resolve(false);
    });
  } catch {
    return false;
  }
}

/**
 * Get the saved handbook record (including PDF blob)
 */
export async function getSavedHandbook() {
  try {
    const db = await openDB();
    return new Promise((resolve, reject) => {
      const tx = db.transaction('handbook', 'readonly');
      const store = tx.objectStore('handbook');
      const req = store.get('active_handbook');
      req.onsuccess = () => resolve(req.result || null);
      req.onerror = () => reject(req.error || new Error('Failed to retrieve offline handbook.'));
    });
  } catch {
    return null;
  }
}

/**
 * Remove saved handbook PDF from offline storage
 */
export async function removeHandbookOffline() {
  const db = await openDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction('handbook', 'readwrite');
    const store = tx.objectStore('handbook');
    const req = store.delete('active_handbook');

    req.onsuccess = () => {
      broadcastOfflineChange({ type: 'handbook_removed' });
      resolve(true);
    };
    req.onerror = () => reject(req.error || new Error('Failed to remove handbook from IndexedDB.'));
  });
}

// ─────────────────────────────────────────────────────────────────────────────
// VERSION SYNCHRONIZATION & OUTDATED CONTENT DETECTION
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Compare saved content against latest server active version.
 * Marks outdated items safely without deleting any offline records.
 */
export async function syncVersionOutdatedStatus(activeVersion) {
  if (!activeVersion || !activeVersion.id) return { outdatedCount: 0 };
  const db = await openDB();

  let outdatedCount = 0;

  // 1. Check Handbook
  try {
    const hb = await getSavedHandbook();
    if (hb && hb.versionId && Number(hb.versionId) !== Number(activeVersion.id)) {
      hb.isOutdated = true;
      hb.latestVersionLabel = activeVersion.label;
      outdatedCount++;

      await new Promise((res, rej) => {
        const tx = db.transaction('handbook', 'readwrite');
        const req = tx.objectStore('handbook').put(hb);
        req.onsuccess = () => res();
        req.onerror = rej;
      });
    } else if (hb && hb.isOutdated && Number(hb.versionId) === Number(activeVersion.id)) {
      hb.isOutdated = false;
      hb.latestVersionLabel = null;
      await new Promise((res, rej) => {
        const tx = db.transaction('handbook', 'readwrite');
        const req = tx.objectStore('handbook').put(hb);
        req.onsuccess = () => res();
        req.onerror = rej;
      });
    }
  } catch (err) {
    console.warn('[syncVersionOutdatedStatus] Handbook check skipped:', err);
  }

  // 2. Check Ordinances
  try {
    const ordinances = await getAllSavedOrdinances();
    for (const ord of ordinances) {
      if (ord.versionId && Number(ord.versionId) !== Number(activeVersion.id)) {
        ord.isOutdated = true;
        ord.latestVersionLabel = activeVersion.label;
        outdatedCount++;

        await new Promise((res, rej) => {
          const tx = db.transaction('ordinances', 'readwrite');
          const req = tx.objectStore('ordinances').put(ord);
          req.onsuccess = () => res();
          req.onerror = rej;
        });
      } else if (ord.isOutdated && Number(ord.versionId) === Number(activeVersion.id)) {
        ord.isOutdated = false;
        ord.latestVersionLabel = null;
        await new Promise((res, rej) => {
          const tx = db.transaction('ordinances', 'readwrite');
          const req = tx.objectStore('ordinances').put(ord);
          req.onsuccess = () => res();
          req.onerror = rej;
        });
      }
    }
  } catch (err) {
    console.warn('[syncVersionOutdatedStatus] Ordinances check skipped:', err);
  }

  // Save sync meta
  try {
    const tx = db.transaction('sync_meta', 'readwrite');
    tx.objectStore('sync_meta').put({
      key: 'last_active_version',
      versionId: activeVersion.id,
      versionLabel: activeVersion.label,
      checkedAt: new Date().toISOString(),
    });
  } catch (_) {}

  broadcastOfflineChange({ type: 'sync_completed', outdatedCount });
  return { outdatedCount };
}

/**
 * Retrieve total count of saved items
 */
export async function getOfflineSummary() {
  try {
    const ordinances = await getAllSavedOrdinances();
    const handbook = await getSavedHandbook();
    return {
      ordinancesCount: ordinances.length,
      hasHandbook: !!handbook,
      handbook,
      totalItems: ordinances.length + (handbook ? 1 : 0),
    };
  } catch {
    return { ordinancesCount: 0, hasHandbook: false, handbook: null, totalItems: 0 };
  }
}
