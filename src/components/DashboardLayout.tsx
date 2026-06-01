import React, { useState } from 'react';
import { Outlet } from 'react-router-dom';
import AppSidebar from '@/components/AppSidebar';
import ISTClock from '@/components/ISTClock';
import { Bell, Menu } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '@/contexts/AuthContext';
import { useSLA } from '@/hooks/useSLA';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';

const DashboardLayout: React.FC = () => {
  const navigate = useNavigate();
  const { user } = useAuth();
  const [sidebarOpen, setSidebarOpen] = useState(false);

  // Run SLA checks on every session (de-duped internally)
  useSLA();

  // Unread notification count for bell badge
  const { data: unreadCount } = useQuery({
    queryKey: ['unread-count', user?.id],
    queryFn: async () => {
      const { count } = await supabase
        .from('notifications')
        .select('*', { count: 'exact', head: true })
        .eq('user_id', user!.id)
        .eq('read', false);
      return count || 0;
    },
    enabled: !!user,
    refetchInterval: 30000, // refresh every 30s
  });

  return (
    <div className="flex min-h-screen bg-background">
      <AppSidebar isOpen={sidebarOpen} onClose={() => setSidebarOpen(false)} />
      <div className="flex-1 flex flex-col min-w-0 overflow-hidden">
        <header className="h-14 border-b border-border flex items-center justify-between px-4 sm:px-6 bg-card/50 backdrop-blur-sm sticky top-0 z-30">
          <div className="flex items-center gap-3 min-w-0">
            <button
              onClick={() => setSidebarOpen(true)}
              className="p-2 -ml-2 rounded-lg hover:bg-accent transition-colors md:hidden shrink-0"
              aria-label="Open menu"
            >
              <Menu className="h-5 w-5 text-muted-foreground" />
            </button>
            <h1 className="font-display font-semibold text-foreground truncate text-sm sm:text-base">
              NetBounce Placement CRM
            </h1>
          </div>
          <div className="flex items-center gap-2 sm:gap-4 shrink-0">
            <ISTClock />
            <button
              onClick={() => navigate('/notifications')}
              className="relative p-2 rounded-lg hover:bg-accent transition-colors"
            >
              <Bell
                className={`h-4 w-4 text-muted-foreground ${(unreadCount ?? 0) > 0 ? 'animate-bell-shake' : ''}`}
              />
              {(unreadCount ?? 0) > 0 && (
                <span className="absolute -top-0.5 -right-0.5 h-4 w-4 rounded-full bg-destructive text-[10px] font-bold text-white flex items-center justify-center leading-none">
                  {unreadCount! > 9 ? '9+' : unreadCount}
                </span>
              )}
            </button>
          </div>
        </header>
        <main className="flex-1 p-4 sm:p-6 overflow-x-hidden overflow-y-auto">
          <Outlet />
        </main>
      </div>
    </div>
  );
};

export default DashboardLayout;
