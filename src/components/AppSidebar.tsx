import React from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { useTheme } from '@/contexts/ThemeContext';
import { useNavigate, useLocation } from 'react-router-dom';
import {
  LayoutDashboard, Users, Plus, BarChart3, Bell, LogOut, Sun, Moon, UserCog, Phone,
  DollarSign, AlertCircle, UsersRound, Shield, Activity
} from 'lucide-react';
import logo from '@/assets/logo.png';

type AppRole = 'ADMIN' | 'PROCESS_ANALYST' | 'LEAD_TL' | 'LEAD_GEN' | 'SALES_TL' | 'SALES_TM' | 'ACCOUNTANT';

interface NavItem {
  label: string;
  icon: React.ElementType;
  path: string;
  roles: AppRole[];
}

const navItems: NavItem[] = [
  { label: 'Dashboard', icon: LayoutDashboard, path: '/dashboard', roles: ['ADMIN', 'PROCESS_ANALYST', 'LEAD_TL', 'LEAD_GEN', 'SALES_TL', 'SALES_TM', 'ACCOUNTANT'] },
  { label: 'Leads View', icon: Users, path: '/leads-view', roles: ['ACCOUNTANT'] },
  { label: 'Add Lead', icon: Plus, path: '/leads/new', roles: ['ADMIN', 'LEAD_GEN', 'LEAD_TL', 'SALES_TM', 'SALES_TL'] },
  { label: 'Leads', icon: Users, path: '/leads', roles: ['ADMIN', 'PROCESS_ANALYST', 'LEAD_TL', 'LEAD_GEN', 'SALES_TL', 'SALES_TM'] },
  { label: 'Assign Leads', icon: UserCog, path: '/assign', roles: ['ADMIN', 'LEAD_TL', 'SALES_TL', 'LEAD_GEN'] },
  { label: 'Call Tracker', icon: Phone, path: '/calls', roles: ['SALES_TM', 'SALES_TL', 'ADMIN', 'PROCESS_ANALYST'] },
  { label: 'Sales Performance', icon: UsersRound, path: '/sales-performance', roles: ['SALES_TL', 'ADMIN'] },
  { label: 'BD Performance', icon: UsersRound, path: '/bd-performance', roles: ['LEAD_TL', 'ADMIN'] },
  { label: 'Revenue', icon: DollarSign, path: '/revenue', roles: ['ADMIN', 'SALES_TL'] },
  { label: 'DNR Follow-ups', icon: AlertCircle, path: '/dnr-followups', roles: ['ADMIN', 'LEAD_GEN', 'LEAD_TL', 'SALES_TL', 'SALES_TM'] },
  { label: 'Analytics', icon: BarChart3, path: '/analytics', roles: ['ADMIN', 'PROCESS_ANALYST', 'LEAD_TL', 'SALES_TL'] },
  { label: 'Notifications', icon: Bell, path: '/notifications', roles: ['ADMIN', 'PROCESS_ANALYST', 'LEAD_TL', 'LEAD_GEN', 'SALES_TL', 'SALES_TM', 'ACCOUNTANT'] },
  { label: 'User Management', icon: Shield, path: '/users', roles: ['ADMIN'] },
  { label: 'Login Activity', icon: Activity, path: '/login-activity', roles: ['ADMIN'] },
];

interface AppSidebarProps {
  isOpen?: boolean;
  onClose?: () => void;
}

const AppSidebar: React.FC<AppSidebarProps> = ({ isOpen = false, onClose }) => {
  const { role, signOut, profile } = useAuth();
  const { theme, toggleTheme } = useTheme();
  const navigate = useNavigate();
  const location = useLocation();

  const filteredItems = navItems.filter(item => role && item.roles.includes(role));

  return (
    <>
      {/* Mobile Sidebar Backdrop */}
      {isOpen && (
        <div
          className="fixed inset-0 z-40 bg-black/40 backdrop-blur-xs md:hidden"
          onClick={onClose}
        />
      )}
      <aside
        className={`fixed inset-y-0 left-0 z-50 w-64 h-screen bg-sidebar flex flex-col border-r border-sidebar-border transition-transform duration-300 md:sticky md:translate-x-0 ${
          isOpen ? 'translate-x-0' : '-translate-x-full'
        }`}
      >
      <div className="p-5 flex items-center justify-center border-b border-sidebar-border">
        <img
          src={logo}
          alt="NetBounce Placement"
          className="h-10 w-auto object-contain max-w-[200px]"
          style={{
            filter: theme === 'dark' 
              ? 'invert(1) hue-rotate(180deg) drop-shadow(0 0 10px rgba(67,97,238,0.25))' 
              : 'drop-shadow(0 0 10px rgba(67,97,238,0.15))'
          }}
        />
      </div>

      <nav className="flex-1 p-3 space-y-1 overflow-y-auto">
        {filteredItems.map(item => {
          const isActive = location.pathname === item.path;
          return (
            <button
              key={item.path}
              onClick={() => {
                navigate(item.path);
                if (onClose) onClose();
              }}
              className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm transition-all ${
                isActive
                  ? 'bg-sidebar-primary text-sidebar-primary-foreground nb-glow'
                  : 'text-sidebar-foreground/70 hover:bg-sidebar-accent hover:text-sidebar-accent-foreground'
              }`}
            >
              <item.icon className="h-4 w-4" />
              {item.label}
            </button>
          );
        })}
      </nav>

      <div className="p-3 border-t border-sidebar-border space-y-2">
        <div className="px-3 py-2">
          <p className="text-xs text-sidebar-foreground/60 truncate">{profile?.full_name}</p>
          <p className="text-xs text-sidebar-foreground/40 truncate">{role?.replace('_', ' ')}</p>
        </div>
        <button
          onClick={toggleTheme}
          className="w-full flex items-center gap-3 px-3 py-2 rounded-lg text-sm text-sidebar-foreground/70 hover:bg-sidebar-accent transition-all"
        >
          {theme === 'dark' ? <Sun className="h-4 w-4" /> : <Moon className="h-4 w-4" />}
          {theme === 'dark' ? 'Light Mode' : 'Dark Mode'}
        </button>
        <button
          onClick={() => {
            signOut();
            if (onClose) onClose();
          }}
          className="w-full flex items-center gap-3 px-3 py-2 rounded-lg text-sm text-destructive hover:bg-sidebar-accent transition-all"
        >
          <LogOut className="h-4 w-4" />
          Sign Out
        </button>
      </div>
    </aside>
    </>
  );
};

export default AppSidebar;
