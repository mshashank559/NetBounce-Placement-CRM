import React from 'react';
import { Outlet } from 'react-router-dom';
import AppSidebar from '@/components/AppSidebar';
import ISTClock from '@/components/ISTClock';
import { Bell } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '@/contexts/AuthContext';

const DashboardLayout: React.FC = () => {
  const navigate = useNavigate();
  const { profile } = useAuth();

  return (
    <div className="flex min-h-screen bg-background">
      <AppSidebar />
      <div className="flex-1 flex flex-col">
        <header className="h-14 border-b border-border flex items-center justify-between px-6 bg-card/50 backdrop-blur-sm sticky top-0 z-10">
          <h1 className="font-display font-semibold text-foreground">
            NetBounce Placement CRM
          </h1>
          <div className="flex items-center gap-4">
            <ISTClock />
            <button
              onClick={() => navigate('/notifications')}
              className="relative p-2 rounded-lg hover:bg-accent transition-colors"
            >
              <Bell className="h-4 w-4 text-muted-foreground" />
            </button>
          </div>
        </header>
        <main className="flex-1 p-6 overflow-auto">
          <Outlet />
        </main>
      </div>
    </div>
  );
};

export default DashboardLayout;
