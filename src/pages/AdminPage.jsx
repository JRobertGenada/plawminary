import { useState } from 'react';
import AdminSidebar from '../components/admin/AdminSidebar';
import OverviewTab   from '../components/admin/OverviewTab';
import PoliciesTab   from '../components/admin/PoliciesTab';
import HandbookTab   from '../components/admin/HandbookTab';
import VersionsTab   from '../components/admin/VersionsTab';
import AnalyticsTab  from '../components/admin/AnalyticsTab';
import SuggestionsTab from '../components/admin/SuggestionsTab';
import { Menu } from 'lucide-react';

export default function AdminPage() {
  const [active, setActive] = useState('overview');
  const [mobileSidebarOpen, setMobileSidebarOpen] = useState(false);

  const tabs = {
    overview:    <OverviewTab setActive={setActive} />,
    policies:    <PoliciesTab />,
    handbook:    <HandbookTab />,
    versions:    <VersionsTab />,
    analytics:   <AnalyticsTab />,
    suggestions: <SuggestionsTab />,
  };

  const tabLabels = {
    overview: 'Overview',
    policies: 'Manage Policies',
    handbook: 'Handbook Ingestion',
    versions: 'Version Control',
    analytics: 'Analytics',
    suggestions: 'Suggestions',
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: 'calc(100vh - 70px)', overflow: 'hidden', background: 'var(--gray-bg)' }}>
      
      {/* Mobile Top Navigation Bar */}
      <div className="lg:hidden flex items-center justify-between px-4 py-3 bg-[#0F4F2C] border-b border-white/10 text-white flex-shrink-0 z-30">
        <button
          onClick={() => setMobileSidebarOpen(true)}
          className="flex items-center gap-2 px-3 py-1.5 bg-white/10 rounded-lg text-xs font-bold"
        >
          <Menu size={16} />
          <span>Admin Menu</span>
        </button>
        <span className="text-xs font-bold text-gold uppercase tracking-wider">
          {tabLabels[active]}
        </span>
      </div>

      <div style={{ display: 'flex', flex: 1, overflow: 'hidden', position: 'relative' }}>
        
        {/* Desktop Sticky Sidebar */}
        <div className="hidden lg:block h-full">
          <AdminSidebar active={active} setActive={setActive} />
        </div>

        {/* Mobile Drawer Sidebar Overlay */}
        {mobileSidebarOpen && (
          <div
            onClick={() => setMobileSidebarOpen(false)}
            style={{
              position: 'fixed',
              inset: 0,
              top: 70,
              background: 'rgba(0,0,0,0.6)',
              backdropFilter: 'blur(3px)',
              zIndex: 998,
            }}
          />
        )}

        {/* Mobile Drawer */}
        <div
          className="lg:hidden"
          style={{
            position: 'fixed',
            top: 70,
            left: 0,
            bottom: 0,
            zIndex: 999,
            transform: mobileSidebarOpen ? 'translateX(0)' : 'translateX(-100%)',
            transition: 'transform .3s cubic-bezier(0.4, 0, 0.2, 1)',
            boxShadow: '4px 0 20px rgba(0,0,0,0.3)',
          }}
        >
          <AdminSidebar active={active} setActive={setActive} onCloseMobile={() => setMobileSidebarOpen(false)} />
        </div>

        {/* Main Content Area */}
        <main className="flex-1 overflow-y-auto p-4 sm:p-6 lg:p-8 min-w-0">
          <div className="max-w-7xl mx-auto">
            {tabs[active]}
          </div>
        </main>
      </div>
    </div>
  );
}
