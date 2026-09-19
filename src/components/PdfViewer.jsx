import { useState, useEffect, useRef } from 'react';
import { Document, Page, pdfjs } from 'react-pdf';
import 'react-pdf/dist/Page/AnnotationLayer.css';
import 'react-pdf/dist/Page/TextLayer.css';

// Configure PDF.js worker using local public worker first (for 100% offline support), with CDN fallback
pdfjs.GlobalWorkerOptions.workerSrc = typeof window !== 'undefined'
  ? '/pdf.worker.min.mjs'
  : `https://unpkg.com/pdfjs-dist@${pdfjs.version}/build/pdf.worker.min.mjs`;

export default function PdfViewer({ pdfUrl, targetPage, onScrollDone, onPageChange, totalPages, setTotalPages, isMobile, activeSection }) {
  const [currentPage, setCurrentPage] = useState(1);
  const [containerWidth, setContainerWidth] = useState(600);
  const [scale, setScale]             = useState(1);
  const [loading, setLoading]   = useState(true);
  const [isRendered, setIsRendered] = useState(false);
  const [error, setError]       = useState(null);
  const containerRef = useRef(null);
  const scrollRef    = useRef(null);
  const pageRefs     = useRef({});
  
  // Measure container width for responsive PDF
  useEffect(() => {
    if (!containerRef.current) return;
    const ro = new ResizeObserver(([entry]) => {
      setContainerWidth(Math.floor(entry.contentRect.width));
    });
    ro.observe(containerRef.current);
    return () => ro.disconnect();
  }, []);

  // Jump to target page when sidebar section is clicked (retries until ref is mounted)
  useEffect(() => {
    if (!targetPage) return;

    let cancelled = false;
    let attempts = 0;
    const maxAttempts = 30; // retry for up to ~3 seconds

    function tryScroll() {
      if (cancelled) return; // stop if effect was cleaned up
      const el = pageRefs.current[targetPage];
      const scrollEl = scrollRef.current;
      if (el && scrollEl) {
        const elTop = el.offsetTop;
        scrollEl.scrollTo({ top: elTop, behavior: 'smooth' });
        setCurrentPage(targetPage);
        onPageChange?.(targetPage);
        // Signal HandbookPage to clear targetPage so user can scroll freely
        onScrollDone?.();
      } else if (attempts < maxAttempts) {
        attempts++;
        setTimeout(tryScroll, 100);
      }
    }

    tryScroll();

    // Cleanup: cancel any pending retries when targetPage changes or component unmounts
    return () => { cancelled = true; };
  }, [targetPage]);  // intentionally omit callbacks — they don't affect scroll logic

  // Intersection observer — track which page is most visible
  useEffect(() => {
    if (!totalPages) return;
    const observers = [];
    Object.entries(pageRefs.current).forEach(([page, el]) => {
      if (!el) return;
      const ob = new IntersectionObserver(([entry]) => {
        if (entry.isIntersecting && entry.intersectionRatio > 0.4) {
          const p = parseInt(page, 10);
          setCurrentPage(p);
          onPageChange?.(p);
        }
      }, { threshold: 0.4 });
      ob.observe(el);
      observers.push(ob);
    });
    return () => observers.forEach(o => o.disconnect());
  }, [totalPages, onPageChange]);

  function onDocumentLoadSuccess({ numPages }) {
    setTotalPages?.(numPages);
    setLoading(false);
    // Give it a tiny bit of time to start rendering the first page
    setTimeout(() => setIsRendered(true), 200);
  }

  const pdfWidth = Math.max(containerWidth - (isMobile ? 24 : 48), 100) * scale;

  if (!pdfUrl) {
    return (
      <div style={{ flex:1, display:'flex', flexDirection:'column', alignItems:'center', justifyContent:'center', background:'#F8F9FA', gap:16, padding: 24 }}>
        <div style={{ fontSize:'3rem' }}>📄</div>
        <div style={{ fontFamily:'"DM Serif Display",serif', fontSize:'1.2rem', color:'var(--g-dark)' }}>No PDF Loaded</div>
        <div style={{ fontSize:'.875rem', color:'var(--gray-t)', textAlign:'center', maxWidth:280, lineHeight:1.65 }}>
          Upload the PLSP Student Handbook PDF to <code style={{ background:'#eee', padding:'1px 6px', borderRadius:4 }}>src/assets/handbook.pdf</code> to enable the viewer.
        </div>
      </div>
    );
  }

  return (
    <div ref={containerRef} style={{ 
      flex: 1, 
      display: 'flex', 
      flexDirection: 'column', 
      background: 'var(--gray-bg)', 
      overflow: 'hidden', 
      padding: isMobile ? '8px' : '24px 16px' 
    }}>
      {/* Centered Document Card */}
      <div style={{ 
        maxWidth: 850, 
        width: '100%', 
        margin: '0 auto', 
        height: isMobile ? '100%' : '85vh', 
        background: '#fff', 
        borderRadius: 16, 
        boxShadow: '0 8px 32px rgba(0,0,0,.08)', 
        border: '1.5px solid var(--gray-mid)',
        display: 'flex', 
        flexDirection: 'column', 
        overflow: 'hidden',
        position: 'relative'
      }}>
        
        {/* Document Header / Controls */}
        <div className="flex flex-wrap items-center justify-between gap-3 p-3 sm:px-5 sm:py-3 bg-[#FDFDFD] border-b border-gray-200 z-10">
          <div style={{ display:'flex', alignItems:'center', gap:8, flex: 1, minWidth: 160, overflow: 'hidden' }}>
            <span style={{ fontSize: '1.1rem' }}>📄</span>
            <div style={{ overflow: 'hidden' }}>
              <div style={{ fontSize: '.84rem', fontWeight: 700, color: 'var(--g-dark)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                {activeSection?.title || 'Student Handbook.pdf'}
              </div>
              <div style={{ fontSize: '.68rem', color: 'var(--gray-t)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                {activeSection?.chapterTitle || 'Official PLSP Guidelines'}
              </div>
            </div>
          </div>
          
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 6, background: 'var(--gray-bg)', padding: '3px 10px', borderRadius: 8 }}>
              <button onClick={() => setScale(s => Math.max(0.5, s - 0.1))} style={{ background:'none', border:'none', color:'var(--gray-t)', cursor:'pointer', fontSize: '1rem', fontWeight: 700 }}>−</button>
              <span style={{ fontSize:'.75rem', fontWeight: 700, minWidth: 36, textAlign:'center' }}>{Math.round(scale * 100)}%</span>
              <button onClick={() => setScale(s => Math.min(2, s + 0.1))} style={{ background:'none', border:'none', color:'var(--gray-t)', cursor:'pointer', fontSize: '1rem', fontWeight: 700 }}>+</button>
            </div>
            <div style={{ fontSize: '.75rem', color: 'var(--gray-t)', fontWeight: 600, whiteSpace: 'nowrap' }}>
              Page {currentPage} of {totalPages || '...'}
            </div>
          </div>
        </div>

        {/* Scrollable PDF Area */}
        <div ref={scrollRef} style={{ flex: 1, overflowY: 'auto', background: '#F0F2F5', padding: '16px 0' }}>
          {loading && (
            <div style={{ display:'flex', flexDirection:'column', alignItems:'center', justifyContent:'center', height:'100%', gap:16, background: '#F0F2F5' }}>
              <div style={{ position: 'relative', width: 48, height: 48 }}>
                <div style={{ position: 'absolute', inset: 0, border: '4px solid var(--g-pale)', borderRadius: '50%' }} />
                <div style={{ position: 'absolute', inset: 0, border: '4px solid transparent', borderTopColor: 'var(--g-primary)', borderRadius: '50%', animation: 'spin 1s cubic-bezier(0.5, 0, 0.5, 1) infinite' }} />
              </div>
              <div style={{ textAlign: 'center' }}>
                <div style={{ fontSize: '.9rem', fontWeight: 700, color: 'var(--g-dark)', marginBottom: 4 }}>Loading Document</div>
                <div style={{ color: 'var(--gray-t)', fontSize: '.75rem' }}>Optimizing PDF for web view…</div>
              </div>
            </div>
          )}

          {error && (
            <div style={{ margin:24, padding:16, background:'#FEF2F2', border:'1px solid #FECACA', borderRadius:12, textAlign:'center', color:'#DC2626' }}>
              <div style={{ fontSize:'1.5rem', marginBottom:8 }}>⚠️</div>
              <div style={{ fontWeight:700, marginBottom:4 }}>Could not load PDF</div>
              <div style={{ fontSize:'.82rem' }}>Make sure the file is at <code>src/assets/handbook.pdf</code></div>
            </div>
          )}

          <Document
            file={pdfUrl}
            onLoadSuccess={onDocumentLoadSuccess}
            onLoadError={e => { setError(e); setLoading(false); }}
            loading={null}
          >
            <div style={{ opacity: isRendered ? 1 : 0, transition: 'opacity .5s ease' }}>
              {totalPages && Array.from({ length: totalPages }, (_, i) => i + 1).map(pageNum => (
                <div
                  key={pageNum}
                  ref={el => { pageRefs.current[pageNum] = el; }}
                  style={{ display:'flex', justifyContent:'center', marginBottom:16 }}
                >
                  <div style={{ 
                    boxShadow: '0 4px 12px rgba(0,0,0,.1)', 
                    borderRadius: 4, 
                    overflow: 'hidden',
                    background: '#fff',
                    maxWidth: '100%'
                  }}>
                    <Page
                      pageNumber={pageNum}
                      width={pdfWidth > 750 ? 750 * scale : pdfWidth}
                      renderTextLayer={true}
                      renderAnnotationLayer={true}
                      loading={<div style={{ height: 400, width: pdfWidth > 750 ? 750 * scale : pdfWidth, background: '#fff' }} />}
                    />
                  </div>
                </div>
              ))}
            </div>
          </Document>
        </div>
      </div>

      <style>{`
        @keyframes spin { to { transform: rotate(360deg); } }
        .react-pdf__Page { transition: transform .3s ease; }
      `}</style>
    </div>
  );
}
