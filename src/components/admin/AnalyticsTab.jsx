import { useAdminStats } from '../../hooks/useAdminStats';
import { Download, LayoutDashboard, Trophy, Megaphone, TrendingUp, Flame, GraduationCap, RefreshCw, AlertCircle } from 'lucide-react';

function pctColor(p) {
  if (p >= 70) return 'var(--g-primary)';
  if (p >= 50) return '#D4A82A';
  return '#DC2626';
}

function SkeletonRow() {
  return (
    <tr style={{ borderTop: '1px solid var(--gray-mid)' }}>
      {[1,2,3,4,5].map(i => (
        <td key={i} style={{ padding: '12px 16px' }}>
          <div style={{ height: 16, background: 'var(--gray-bg)', borderRadius: 4, animation: 'pulse 1.5s infinite' }} />
        </td>
      ))}
    </tr>
  );
}

export default function AnalyticsTab() {
  const { stats, loading, error, refetch } = useAdminStats();
  const { weeklyViews, deptStats, topSections } = stats;

  const totalStudents  = deptStats.reduce((a, d) => a + Number(d.students  || 0), 0);
  const totalCompleted = deptStats.reduce((a, d) => a + Number(d.completed || 0), 0);
  const overallPct     = totalStudents > 0 ? Math.round((totalCompleted / totalStudents) * 100) : 0;
  const maxViews       = weeklyViews.length > 0 ? Math.max(...weeklyViews.map(w => w.views), 1) : 1;

  const mostActive  = deptStats[0]  || null;
  const leastActive = deptStats[deptStats.length - 1] || null;

  function exportCsv() {
    const rows = [
      ['Department', 'Enrolled', 'Completed', 'Completion %'],
      ...deptStats.map(d => [d.dept, d.students, d.completed, d.pct]),
    ];
    const csv = rows.map(r => r.join(',')).join('\n');
    const blob = new Blob([csv], { type: 'text/csv' });
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = 'plawminary_analytics.csv';
    a.click();
  }

  if (error) {
    return (
      <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', padding: '80px 24px', gap: 16, textAlign: 'center' }}>
        <AlertCircle size={48} color="#DC2626" />
        <h3 style={{ fontFamily: '"DM Serif Display",serif', fontSize: '1.4rem', color: 'var(--g-dark)' }}>Could not load analytics</h3>
        <p style={{ fontSize: '.875rem', color: 'var(--gray-t)' }}>{error}</p>
        <button onClick={refetch} style={{ display: 'inline-flex', alignItems: 'center', gap: 8, padding: '10px 20px', borderRadius: 8, background: 'var(--g-primary)', color: '#fff', border: 'none', fontWeight: 700, cursor: 'pointer', fontFamily: '"Plus Jakarta Sans",sans-serif' }}>
          <RefreshCw size={15} /> Retry
        </button>
      </div>
    );
  }

  return (
    <div>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 20, flexWrap: 'wrap', gap: 12 }}>
        <div>
          <h2 style={{ fontFamily: '"DM Serif Display",serif', fontSize: '1.5rem', color: 'var(--g-dark)' }}>Analytics</h2>
          <p style={{ fontSize: '.85rem', color: 'var(--gray-t)', marginTop: 2 }}>Live data for accreditation and institutional monitoring.</p>
        </div>
        <div style={{ display: 'flex', gap: 8 }}>
          <button onClick={refetch} title="Refresh" style={{ display: 'inline-flex', alignItems: 'center', gap: 6, padding: '9px 16px', borderRadius: 8, border: '1.5px solid var(--gray-mid)', background: '#fff', color: 'var(--gray-t)', fontWeight: 600, fontSize: '.82rem', cursor: 'pointer', fontFamily: '"Plus Jakarta Sans",sans-serif' }}>
            <RefreshCw size={13} style={{ animation: loading ? 'spin 1s linear infinite' : 'none' }} />
          </button>
          <button onClick={exportCsv} disabled={loading || deptStats.length === 0} style={{ display: 'inline-flex', alignItems: 'center', gap: 8, padding: '9px 18px', borderRadius: 8, border: '1.5px solid var(--g-primary)', background: 'var(--g-pale)', color: 'var(--g-primary)', fontWeight: 700, fontSize: '.82rem', cursor: 'pointer', fontFamily: '"Plus Jakarta Sans",sans-serif', opacity: (loading || deptStats.length === 0) ? 0.5 : 1 }}
            onMouseEnter={e => { e.currentTarget.style.background = 'var(--g-primary)'; e.currentTarget.style.color = '#fff'; }}
            onMouseLeave={e => { e.currentTarget.style.background = 'var(--g-pale)'; e.currentTarget.style.color = 'var(--g-primary)'; }}
          >
            <Download size={16} /> Export CSV
          </button>
        </div>
      </div>

      {/* Summary cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 mb-6">
        {[
          {
            label: 'Overall Completion',
            value: loading ? '—' : `${overallPct}%`,
            sub: loading ? 'Loading…' : `${totalCompleted.toLocaleString()} of ${totalStudents.toLocaleString()} students`,
            icon: <LayoutDashboard size={20} />, color: 'var(--g-primary)',
          },
          {
            label: 'Most Active Dept.',
            value: loading ? '—' : (mostActive?.dept?.split(' ').slice(-2).join(' ') || 'N/A'),
            sub: loading ? 'Loading…' : (mostActive ? `${mostActive.pct}% completion` : 'No data yet'),
            icon: <Trophy size={20} />, color: 'var(--gold-d)',
          },
          {
            label: 'Least Active Dept.',
            value: loading ? '—' : (leastActive?.dept?.split(' ').slice(-2).join(' ') || 'N/A'),
            sub: loading ? 'Loading…' : (leastActive ? `${leastActive.pct}% — needs attention` : 'No data yet'),
            icon: <Megaphone size={20} />, color: '#9D174D',
          },
        ].map(({ label, value, sub, icon, color }) => (
          <div key={label} style={{ background: '#fff', border: '1.5px solid var(--gray-mid)', borderRadius: 14, padding: 18 }}>
            <div style={{ color, marginBottom: 10 }}>{icon}</div>
            <div style={{ fontSize: '.78rem', color: 'var(--gray-t)', fontWeight: 500, marginBottom: 4 }}>{label}</div>
            {loading
              ? <div style={{ width: 100, height: 28, background: 'var(--gray-bg)', borderRadius: 6, animation: 'pulse 1.5s infinite', marginBottom: 4 }} />
              : <div style={{ fontFamily: '"DM Serif Display",serif', fontSize: '1.4rem', color: 'var(--g-dark)', lineHeight: 1, marginBottom: 4 }}>{value}</div>
            }
            <div style={{ fontSize: '.72rem', color: 'var(--gray-t)' }}>{sub}</div>
          </div>
        ))}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-5 mb-5">

        {/* Weekly chart */}
        <div style={{ background: '#fff', border: '1.5px solid var(--gray-mid)', borderRadius: 14, padding: 20 }}>
          <h3 style={{ fontSize: '.95rem', fontWeight: 700, color: 'var(--g-dark)', marginBottom: 18, display: 'flex', alignItems: 'center', gap: 8 }}>
            <TrendingUp size={18} color="var(--g-primary)" /> Weekly Views Trend
          </h3>
          {loading ? (
            <div style={{ height: 130, background: 'var(--gray-bg)', borderRadius: 8, animation: 'pulse 1.5s infinite' }} />
          ) : weeklyViews.length === 0 ? (
            <div style={{ height: 130, display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--gray-t)', fontSize: '.85rem' }}>No view data yet.</div>
          ) : (
            <>
              <div style={{ display: 'flex', alignItems: 'flex-end', gap: 8, height: 130, marginBottom: 8 }}>
                {weeklyViews.map(({ week, views }) => (
                  <div key={week} style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 5 }}>
                    <span style={{ fontSize: '.65rem', color: 'var(--gray-t)', fontWeight: 600 }}>{Number(views).toLocaleString()}</span>
                    <div style={{ width: '100%', background: 'var(--g-primary)', borderRadius: '4px 4px 0 0', height: `${Math.round((views / maxViews) * 110)}px`, minHeight: 4 }} />
                    <span style={{ fontSize: '.65rem', color: 'var(--gray-t)', whiteSpace: 'nowrap' }}>{week}</span>
                  </div>
                ))}
              </div>
              <div style={{ height: 1, background: 'var(--gray-mid)' }} />
              <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: 12, fontSize: '.78rem', color: 'var(--gray-t)', flexWrap: 'wrap', gap: 6 }}>
                <span>Total: <strong style={{ color: 'var(--g-dark)' }}>{weeklyViews.reduce((a, w) => a + Number(w.views || 0), 0).toLocaleString()}</strong> views</span>
              </div>
            </>
          )}
        </div>

        {/* Top sections */}
        <div style={{ background: '#fff', border: '1.5px solid var(--gray-mid)', borderRadius: 14, padding: 20 }}>
          <h3 style={{ fontSize: '.95rem', fontWeight: 700, color: 'var(--g-dark)', marginBottom: 16, display: 'flex', alignItems: 'center', gap: 8 }}>
            <Flame size={18} color="#DC2626" /> Most-Viewed Ordinances
          </h3>
          {loading ? (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
              {[1,2,3,4,5].map(i => <div key={i} style={{ height: 26, background: 'var(--gray-bg)', borderRadius: 6, animation: 'pulse 1.5s infinite' }} />)}
            </div>
          ) : topSections.length === 0 ? (
            <div style={{ color: 'var(--gray-t)', fontSize: '.85rem', padding: '20px 0' }}>No view data yet. Views will appear as students browse ordinances.</div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
              {topSections.map(({ sectionKey, views, pct }, i) => (
                <div key={sectionKey}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 4 }}>
                    <span style={{ fontSize: '.82rem', fontWeight: 600, color: 'var(--gray-dk)', display: 'flex', alignItems: 'center', gap: 6, minWidth: 0 }}>
                      <span style={{ width: 18, height: 18, borderRadius: '50%', background: i === 0 ? 'var(--gold)' : 'var(--gray-bg)', color: i === 0 ? 'var(--g-dark)' : 'var(--gray-t)', display: 'inline-flex', alignItems: 'center', justifyContent: 'center', fontSize: '.65rem', fontWeight: 700, flexShrink: 0 }}>{i + 1}</span>
                      <span style={{ maxWidth: 200, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>Ordinance #{sectionKey}</span>
                    </span>
                    <span style={{ fontSize: '.78rem', fontWeight: 700, color: 'var(--gray-t)', flexShrink: 0 }}>{Number(views).toLocaleString()}</span>
                  </div>
                  <div style={{ height: 6, background: 'var(--gray-bg)', borderRadius: 999, overflow: 'hidden' }}>
                    <div style={{ height: '100%', width: `${pct}%`, background: 'var(--g-primary)', borderRadius: 999 }} />
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Full department table */}
      <div style={{ background: '#fff', border: '1.5px solid var(--gray-mid)', borderRadius: 14, overflowX: 'auto', WebkitOverflowScrolling: 'touch' }}>
        <div style={{ padding: '16px 20px', borderBottom: '1px solid var(--gray-mid)' }}>
          <h3 style={{ fontSize: '.95rem', fontWeight: 700, color: 'var(--g-dark)', display: 'flex', alignItems: 'center', gap: 8 }}>
            <GraduationCap size={18} color="var(--gold-d)" /> Completion by Department
          </h3>
          <p style={{ fontSize: '.75rem', color: 'var(--gray-t)', marginTop: 2 }}>Used for accreditation reporting. Generated from live progress data.</p>
        </div>
        <table style={{ width: '100%', minWidth: 600, borderCollapse: 'collapse' }}>
          <thead>
            <tr style={{ background: 'var(--gray-bg)' }}>
              {['Department', 'Enrolled', 'Completed', 'Completion Rate', 'Status'].map(h => (
                <th key={h} style={{ padding: '10px 16px', textAlign: 'left', fontSize: '.72rem', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '.07em', color: 'var(--gray-t)', whiteSpace: 'nowrap' }}>{h}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {loading
              ? [1,2,3,4,5].map(i => <SkeletonRow key={i} />)
              : deptStats.length === 0
              ? <tr><td colSpan={5} style={{ padding: 32, textAlign: 'center', color: 'var(--gray-t)', fontSize: '.875rem' }}>No department data yet.</td></tr>
              : deptStats.map((d) => (
                <tr key={d.dept} style={{ borderTop: '1px solid var(--gray-mid)' }}>
                  <td style={{ padding: '12px 16px', fontWeight: 700, fontSize: '.84rem', color: 'var(--g-dark)', whiteSpace: 'nowrap' }}>{d.dept}</td>
                  <td style={{ padding: '12px 16px', fontSize: '.84rem', color: 'var(--gray-t)' }}>{Number(d.students).toLocaleString()}</td>
                  <td style={{ padding: '12px 16px', fontSize: '.84rem', color: 'var(--gray-t)' }}>{Number(d.completed).toLocaleString()}</td>
                  <td style={{ padding: '12px 16px' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                      <div style={{ flex: 1, minWidth: 60, height: 7, background: 'var(--gray-bg)', borderRadius: 999, overflow: 'hidden' }}>
                        <div style={{ height: '100%', width: `${d.pct}%`, background: pctColor(d.pct), borderRadius: 999 }} />
                      </div>
                      <span style={{ fontSize: '.8rem', fontWeight: 700, color: pctColor(d.pct), minWidth: 32 }}>{d.pct}%</span>
                    </div>
                  </td>
                  <td style={{ padding: '12px 16px', whiteSpace: 'nowrap' }}>
                    <span style={{ padding: '3px 10px', borderRadius: 999, fontSize: '.72rem', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '.04em', background: d.pct >= 70 ? '#D1FAE5' : d.pct >= 50 ? '#FEF3C7' : '#FCE7F3', color: d.pct >= 70 ? '#065F46' : d.pct >= 50 ? '#92400E' : '#9D174D' }}>
                      {d.pct >= 70 ? 'On Track' : d.pct >= 50 ? 'In Progress' : 'Needs Attention'}
                    </span>
                  </td>
                </tr>
              ))
            }
          </tbody>
          {!loading && deptStats.length > 0 && (
            <tfoot>
              <tr style={{ borderTop: '2px solid var(--gray-mid)', background: 'var(--g-pale)' }}>
                <td style={{ padding: '12px 16px', fontWeight: 700, fontSize: '.84rem', color: 'var(--g-dark)' }}>TOTAL</td>
                <td style={{ padding: '12px 16px', fontWeight: 700, fontSize: '.84rem', color: 'var(--g-dark)' }}>{totalStudents.toLocaleString()}</td>
                <td style={{ padding: '12px 16px', fontWeight: 700, fontSize: '.84rem', color: 'var(--g-dark)' }}>{totalCompleted.toLocaleString()}</td>
                <td style={{ padding: '12px 16px' }}><span style={{ fontWeight: 700, fontSize: '.84rem', color: 'var(--g-primary)' }}>{overallPct}% overall</span></td>
                <td />
              </tr>
            </tfoot>
          )}
        </table>
      </div>
      <style>{`@keyframes pulse{0%,100%{opacity:1}50%{opacity:.5}} @keyframes spin{to{transform:rotate(360deg)}}`}</style>
    </div>
  );
}
