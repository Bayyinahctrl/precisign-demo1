import React from 'react';
import { AppProvider, useApp } from './context/AppContext';
import { AppSidebar } from './components/layout/AppSidebar';
import { AppHeader } from './components/layout/AppHeader';
import { DashboardView } from './components/dashboard/DashboardView';
import { CreateRequestView } from './components/create/CreateRequestView';
import { ReviewSignView } from './components/review/ReviewSignView';
import { WorkflowSettingsView } from './components/settings/WorkflowSettingsView';
import { UserProfileView } from './components/profile/UserProfileView';
import { FormsLibraryView } from './components/library/FormsLibraryView';
import { ArchiveRegisterView } from './components/archive/ArchiveRegisterView';

const MainLayout: React.FC = () => {
  const { activeView } = useApp();

  return (
    <div className="min-h-screen bg-[#F5F6F8] flex text-[#192B3C]">
      {/* Dark Navy Sidebar (#192B3C) */}
      <AppSidebar />

      {/* Main Content Area */}
      <div className="flex-1 flex flex-col min-w-0">
        {/* Top Header */}
        <AppHeader />

        {/* Dynamic View Router */}
        <main className="flex-1 pb-16 overflow-y-auto">
          {(activeView === 'dashboard' || activeView === 'requests') && <DashboardView />}
          {activeView === 'create-request' && <CreateRequestView />}
          {activeView === 'review-sign' && <ReviewSignView />}
          {activeView === 'forms-library' && <FormsLibraryView />}
          {activeView === 'archive' && <ArchiveRegisterView />}
          {activeView === 'workflow-settings' && <WorkflowSettingsView />}
          {activeView === 'user-profile' && <UserProfileView />}
        </main>
      </div>
    </div>
  );
};

export default function App() {
  return (
    <AppProvider>
      <MainLayout />
    </AppProvider>
  );
}
