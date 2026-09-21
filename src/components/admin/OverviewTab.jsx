import { useAdminStats } from '../../hooks/useAdminStats';
import { ClipboardList, Eye, GraduationCap, BookOpen, ArrowRight, RefreshCw, AlertCircle } from 'lucide-react';

function StatCard({ icon, label, value, sub, accent, loading }) {
  return (
    <div style={{ background: '#fff', border: '1.5px solid var(--gray-mid)', borderRadius: 14, padding: '18px 20px', display: 'flex', alignItems: 'flex-start', gap: 14 }}>
      <div style={{ width: 44, height: 44, borderRadius: 12, background: accent + '18', display: 'flex', alignItems: 'center', justifyContent: 'center', color: accent, flexShrink: 0 }}>{icon}</div>
      <div>
        <div style={{ fontSize: '.78rem', color: 'var(--gray-t)', fontWeight: 500, marginBottom: 4 }}>{label}</div>
        {loading ? (
          <div style={{ width: 80, height: 28, background: 'var(--gray-bg)', borderRadius: 6, animation: 'pulse 1.5s infinite' }} />
        ) : (
          <div style={{ fontFamily: '"DM Serif Display",serif', fontSize: '1.65rem', color: 'var(--g-dark)', lineHeight: 1 }}>{value}</div>
        )}
        {sub && <div style={{ fontSize: '.72rem', color: 'var(--gray-t)', marginTop: 5 }}>{sub}</div>}
      </div>
    </div>
  );
}

export default function OverviewTab({ setActive }) {
  const { stats, loading, error, refetch } = useAdminStats();

  const { ordinanceCount, userCount, progressCount, weeklyViews, deptStats, topSections } = stats;
  const maxBar = weeklyViews.length > 0 ? Math.max(...weeklyViews.map(w => w.views), 1) : 1;
  const maxTopView = topSections.length > 0 ? topSections[0].views : 1;

  if (error) {
    return (
      <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', padding: '80px 24px', textAlign: 'center', gap: 16 }}>
        <AlertCircle size={48} color="#DC2626" />
        <h3 style={{ fontFamily: '"DM Serif Display",serif', fontSize: '1.4rem', color: 'var(--g-dark)' }}>Could not load dashboard</h3>
        <p style={{ fontSize: '.875rem', color: 'var(--gray-t)', maxWidth: 380 }}>{error}</p>
        <button onClick={refetch} style={{ display: 'inline-flex', alignItems: 'center', gap: 8, padding: '10px 20px', borderRadius: 8, background: 'var(--g-primary)', color: '#fff', border: 'none', fontWeight: 700, cursor: 'pointer', fontFamily: '"Plus Jakarta Sans",sans-serif' }}>
          <RefreshCw size={15} /> Retry
        </button>
      </div>
    );
  }

  return (
    <div>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 20, flexWrap: 'wrap', gap: 10 }}>
        <div>
          <h2 style={{ fontFamily: '"DM Serif Display",serif', fontSize: '1.5rem', color: 'var(--g-dark)' }}>Dashboard Overview</h2>
          <p style={{ fontSize: '.85rem', color: 'var(--gray-t)', marginTop: 2 }}>Live data from the Plawminary database.</p>
        </div>
        <button onClick={refetch} title="Refresh stats" style={{ display: 'inline-flex', alignItems: 'center', gap: 6, padding: '7px 14px', borderRadius: 8, border: '1.5px solid var(--gray-mid)', background: '#fff', color: 'var(--gray-t)', fontWeight: 600, fontSize: '.78rem', cursor: 'pointer', fontFamily: '"Plus Jakarta Sans",sans-serif' }}>
          <RefreshCw size={13} style={{ animation: loading ? 'spin 1s linear infinite' : 'none' }} /> Refresh
        </button>
      </div>

      {/* Stat cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-4 mb-6">
        <StatCard loading={loading} icon={<ClipboardList size={22} />} label="Published Policies"  value={ordinanceCount}                    sub="Active in database"    accent="#1F6F3D" />
        <StatCard loading={loading} icon={<GraduationCap size={22} />} label="Enrolled Students"   value={userCount.toLocaleString()}         sub="Verified student accounts" accent="#D4A82A" />
        <StatCard loading={loading} icon={<BookOpen size={22} />}      label="Readings Completed" value={progressCount}                       sub="Progress records tracked"  accent="#9D174D" />
        <StatCard loading={loading} icon={<Eye size={22} />}           label="Total Views"          value={weeklyViews.reduce((a, w) => a + (w.views || 0), 0).toLocaleString()} sub="Last 5 weeks" accent="#1D4ED8" />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-5 mb-5">

        {/* Weekly views chart */}
        <div style={{ background: '#fff', border: '1.5px solid var(--gray-mid)', borderRadius: 14, padding: 20 }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 20 }}>
            <h3 style={{ fontSize: '.95rem', fontWeight: 700, color: 'var(--g-dark)' }}>Weekly Page Views</h3>
            <span style={{ fontSize: '.72rem', background: 'var(--g-pale)', color: 'var(--g-primary)', padding: '3px 10px', borderRadius: 999, fontWeight: 600 }}>Last 5 weeks</span>
          </div>
          {loading ? (
            <div style={{ height: 130, background: 'var(--gray-bg)', borderRadius: 8, animation: 'pulse 1.5s infinite' }} />
          ) : weeklyViews.length === 0 ? (
            <div style={{ height: 130, display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--gray-t)', fontSize: '.85rem' }}>No view data yet — share an ordinance link to start tracking!</div>
          ) : (
            <div style={{ display: 'flex', alignItems: 'flex-end', gap: 10, height: 130 }}>
              {weeklyViews.map(({ week, views }) => (
                <div key={week} style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 6 }}>
                  <div style={{ fontSize: '.65rem', color: 'var(--gray-t)', fontWeight: 600 }}>{Number(views).toLocaleString()}</div>
                  <div style={{ width: '100%', background: 'var(--g-primary)', borderRadius: '4px 4px 0 0', height: `${Math.round((views / maxBar) * 100)}px`, transition: 'height .4s ease', minHeight: 4 }} />
                  <div style={{ fontSize: '.65rem', color: 'var(--gray-t)', whiteSpace: 'nowrap' }}>{week}</div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Department completion */}
        <div style={{ background: '#fff', border: '1.5px solid var(--gray-mid)', borderRadius: 14, padding: 20 }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 16 }}>
            <h3 style={{ fontSize: '.95rem', fontWeight: 700, color: 'var(--g-dark)' }}>Completion by Department</h3>
            <button onClick={() => setActive('analytics')} style={{ fontSize: '.72rem', color: 'var(--g-primary)', background: 'none', border: 'none', cursor: 'pointer', fontWeight: 700, fontFamily: '"Plus Jakarta Sans",sans-serif', display: 'flex', alignItems: 'center', gap: 4 }}>
              See all <ArrowRight size={14} />
            </button>
          </div>
          {loading ? (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
              {[1,2,3,4,5].map(i => <div key={i} style={{ height: 28, background: 'var(--gray-bg)', borderRadius: 6, animation: 'pulse 1.5s infinite' }} />)}
            </div>
          ) : deptStats.length === 0 ? (
            <div style={{ color: 'var(--gray-t)', fontSize: '.85rem', padding: '20px 0' }}>No progress data yet.</div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
              {deptStats.slice(0, 5).map(({ dept, pct, completed, students }) => (
                <div key={dept}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 4, flexWrap: 'wrap', gap: 4 }}>
                    <span style={{ fontSize: '.8rem', fontWeight: 600, color: 'var(--gray-dk)' }}>{dept}</span>
                    <span style={{ fontSize: '.75rem', color: 'var(--gray-t)' }}>{completed}/{students} · <strong style={{ color: pct >= 70 ? 'var(--g-primary)' : pct >= 50 ? '#D4A82A' : '#9D174D' }}>{pct}%</strong></span>
                  </div>
                  <div style={{ height: 6, background: 'var(--gray-bg)', borderRadius: 999, overflow: 'hidden' }}>
                    <div style={{ height: '100%', width: `${pct}%`, background: pct >= 70 ? 'var(--g-primary)' : pct >= 50 ? '#D4A82A' : '#DC2626', borderRadius: 999, transition: 'width .5s ease' }} />
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Top sections */}
      <div style={{ background: '#fff', border: '1.5px solid var(--gray-mid)', borderRadius: 14, padding: 20 }}>
        <h3 style={{ fontSize: '.95rem', fontWeight: 700, color: 'var(--g-dark)', marginBottom: 16 }}>Most-Viewed Ordinances</h3>
        {loading ? (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
            {[1,2,3,4,5].map(i => <div key={i} style={{ height: 26, background: 'var(--gray-bg)', borderRadius: 6, animation: 'pulse 1.5s infinite' }} />)}
          </div>
        ) : topSections.length === 0 ? (
          <div style={{ color: 'var(--gray-t)', fontSize: '.85rem' }}>No view data yet — ordinance clicks will appear here.</div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
            {topSections.map(({ sectionKey, views, pct }, i) => (
              <div key={sectionKey} style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                <span style={{ width: 22, height: 22, borderRadius: '50%', background: i === 0 ? 'var(--gold)' : 'var(--gray-bg)', color: i === 0 ? 'var(--g-dark)' : 'var(--gray-t)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '.7rem', fontWeight: 700, flexShrink: 0 }}>{i + 1}</span>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontSize: '.84rem', fontWeight: 600, color: 'var(--gray-dk)', marginBottom: 4, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>Ordinance #{sectionKey}</div>
                  <div style={{ height: 6, background: 'var(--gray-bg)', borderRadius: 999, overflow: 'hidden' }}>
                    <div style={{ height: '100%', width: `${pct}%`, background: 'var(--g-primary)', borderRadius: 999 }} />
                  </div>
                </div>
                <span style={{ fontSize: '.78rem', fontWeight: 600, color: 'var(--gray-t)', minWidth: 44, textAlign: 'right' }}>{Number(views).toLocaleString()}</span>
              </div>
            ))}
          </div>
        )}
      </div>
      <style>{`@keyframes pulse{0%,100%{opacity:1}50%{opacity:.5}} @keyframes spin{to{transform:rotate(360deg)}}`}</style>
    </div>
  );
}
