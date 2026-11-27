import React, { memo, useCallback, useTransition, useRef, useEffect } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { useNavigate, useLocation } from 'react-router-dom';
import { motion } from 'framer-motion';
import {
  LayoutDashboard, Users, Plus, BarChart3, Bell, LogOut, UserCog, Phone,
  DollarSign, AlertCircle, UsersRound, Shield, Activity, PieChart, Sparkles
} from 'lucide-react';
import logoDark from '@/assets/logo-dark.png';

type AppRole = 'ADMIN' | 'PROCESS_ANALYST' | 'LEAD_TL' | 'LEAD_GEN' | 'SALES_TL' | 'SALES_TM' | 'ACCOUNTANT';

interface NavItem {
  label: string;
  icon: React.ElementType;
  path: string;
  roles: AppRole[];
}

// Static nav items defined outside the component — never recreated on re-render
const navItems: NavItem[] = [
  { label: 'Dashboard', icon: LayoutDashboard, path: '/dashboard', roles: ['ADMIN', 'PROCESS_ANALYST', 'LEAD_TL', 'LEAD_GEN', 'SALES_TL', 'SALES_TM', 'ACCOUNTANT'] },
  { label: 'Leads View', icon: Users, path: '/leads-view', roles: ['ACCOUNTANT'] },
  { label: 'Add Lead', icon: Plus, path: '/leads/new', roles: ['ADMIN', 'LEAD_GEN', 'LEAD_TL', 'SALES_TM', 'SALES_TL'] },
  { label: 'Leads', icon: Users, path: '/leads', roles: ['ADMIN', 'PROCESS_ANALYST', 'LEAD_TL', 'LEAD_GEN', 'SALES_TL', 'SALES_TM'] },
  { label: 'Assign Leads', icon: UserCog, path: '/assign', roles: ['ADMIN', 'LEAD_TL', 'SALES_TL'] },
  { label: 'Assignment Analysis', icon: PieChart, path: '/assignment-analysis', roles: ['LEAD_TL'] },
  { label: 'Call Tracker', icon: Phone, path: '/calls', roles: ['SALES_TM', 'SALES_TL', 'ADMIN', 'PROCESS_ANALYST'] },
  { label: 'Sales Performance', icon: UsersRound, path: '/sales-performance', roles: ['SALES_TM', 'SALES_TL', 'ADMIN'] },
  { label: 'BD Performance', icon: UsersRound, path: '/bd-performance', roles: ['LEAD_TL', 'ADMIN'] },
  { label: 'Revenue', icon: DollarSign, path: '/revenue', roles: ['ADMIN', 'SALES_TL', 'ACCOUNTANT'] },
  { label: 'DNR Follow-ups', icon: AlertCircle, path: '/dnr-followups', roles: ['ADMIN', 'LEAD_GEN', 'LEAD_TL', 'SALES_TL', 'SALES_TM'] },
  { label: 'Analytics', icon: BarChart3, path: '/analytics', roles: ['ADMIN', 'PROCESS_ANALYST', 'LEAD_TL', 'SALES_TL'] },
  { label: 'Notifications', icon: Bell, path: '/notifications', roles: ['ADMIN', 'PROCESS_ANALYST', 'LEAD_TL', 'LEAD_GEN', 'SALES_TL', 'SALES_TM', 'ACCOUNTANT'] },
  { label: 'User Management', icon: Shield, path: '/users', roles: ['ADMIN'] },
  { label: 'Login Activity', icon: Activity, path: '/login-activity', roles: ['ADMIN'] },
];

/* ─── 1. Sidebar Falling Snow Canvas ──────────────────────────────────────── */
const SidebarSnowCanvas: React.FC = () => {
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    let animId: number;

    const resize = () => {
      canvas.width = canvas.parentElement?.clientWidth || 256;
      canvas.height = canvas.parentElement?.clientHeight || window.innerHeight;
    };
    resize();
    window.addEventListener('resize', resize);

    interface Flake {
      x: number;
      y: number;
      radius: number;
      speed: number;
      swing: number;
      swingSpeed: number;
      alpha: number;
    }

    const count = 35;
    const flakes: Flake[] = [];
    for (let i = 0; i < count; i++) {
      flakes.push({
        x: Math.random() * canvas.width,
        y: Math.random() * canvas.height,
        radius: Math.random() * 2 + 0.8,
        speed: Math.random() * 0.8 + 0.4,
        swing: Math.random() * Math.PI * 2,
        swingSpeed: Math.random() * 0.02 + 0.01,
        alpha: Math.random() * 0.55 + 0.25,
      });
    }

    const draw = () => {
      ctx.clearRect(0, 0, canvas.width, canvas.height);

      for (let i = 0; i < flakes.length; i++) {
        const f = flakes[i];
        f.swing += f.swingSpeed;
        f.x += Math.sin(f.swing) * 0.45;
        f.y += f.speed;

        if (f.y > canvas.height + 6) {
          f.y = -6;
          f.x = Math.random() * canvas.width;
        }
        if (f.x > canvas.width) f.x = 0;
        if (f.x < 0) f.x = canvas.width;

        ctx.beginPath();
        ctx.arc(f.x, f.y, f.radius, 0, Math.PI * 2);
        ctx.fillStyle = `rgba(255, 255, 255, ${f.alpha})`;
        ctx.shadowColor = 'rgba(255, 255, 255, 0.4)';
        ctx.shadowBlur = 3;
        ctx.fill();
        ctx.shadowBlur = 0;
      }

      animId = requestAnimationFrame(draw);
    };

    draw();

    return () => {
      cancelAnimationFrame(animId);
      window.removeEventListener('resize', resize);
    };
  }, []);

  return (
    <canvas
      ref={canvasRef}
      className="absolute inset-0 w-full h-full pointer-events-none"
      style={{ zIndex: 1 }}
    />
  );
};

/* ─── 2. Realistic Snow Cap on Top of the Sidebar ─────────────────────────── */
const SidebarSnowCap: React.FC = () => {
  return (
    <div className="absolute top-0 left-0 right-0 z-30 pointer-events-none select-none">
      <svg
        viewBox="0 0 256 22"
        preserveAspectRatio="none"
        className="w-full h-[18px] drop-shadow-[0_2px_4px_rgba(0,0,0,0.3)]"
      >
        <defs>
          <linearGradient id="sidebarSnowGrad" x1="0%" y1="0%" x2="0%" y2="100%">
            <stop offset="0%" stopColor="#ffffff" />
            <stop offset="70%" stopColor="#f1f5f9" />
            <stop offset="100%" stopColor="#cbd5e1" />
          </linearGradient>
        </defs>
        {/* Soft undulating snow mound on top edge */}
        <path
          d="M0,0 
             L256,0 
             L256,12 
             Q230,19 200,10 
             Q170,3 140,12 
             Q110,18 80,9 
             Q50,4 20,13 
             Q10,16 0,11 
             Z"
          fill="url(#sidebarSnowGrad)"
        />
        {/* Glistening highlight curve */}
        <path
          d="M0,11 Q10,16 20,13 Q50,4 80,9 Q110,18 140,12 Q170,3 200,10 Q230,19 256,12"
          stroke="#ffffff"
          strokeWidth="1.2"
          fill="none"
          opacity="0.9"
        />
      </svg>
    </div>
  );
};

/* ─── 3. NavButton with Worm/Caterpillar Animated Transparent Cylindrical Box ─ */
const NavButton = memo(({
  item,
  isActive,
  onClick,
}: {
  item: NavItem;
  isActive: boolean;
  onClick: (path: string) => void;
}) => (
  <button
    onClick={() => onClick(item.path)}
    className={`relative w-full flex items-center gap-3 px-3.5 py-2.5 rounded-xl text-sm font-medium transition-colors select-none ${
      isActive ? 'text-white font-semibold' : 'text-rose-100/75 hover:text-white'
    }`}
  >
    {/* ── Transparent Cylindrical Box with Worm Stretch Motion ── */}
    {isActive && (
      <motion.div
        layoutId="activeSidebarNavWorm"
        className="absolute inset-0 rounded-xl"
        style={{
          /* Frosted transparent cylindrical capsule */
          background: 'rgba(255, 255, 255, 0.18)',
          backdropFilter: 'blur(12px)',
          WebkitBackdropFilter: 'blur(12px)',
          border: '1px solid rgba(255, 255, 255, 0.32)',
          boxShadow: '0 4px 18px rgba(0, 0, 0, 0.25), inset 0 1px 1px rgba(255, 255, 255, 0.4)',
        }}
        /* Worm / Caterpillar motion: stretch front edge first, then pull back forward */
        transition={{
          type: 'spring',
          stiffness: 300,
          damping: 24,
          mass: 0.8,
        }}
      />
    )}

    {/* Button content sitting above the animated indicator */}
    <span className="relative z-10 flex items-center gap-3 w-full">
      <item.icon
        className={`h-4 w-4 shrink-0 transition-transform duration-200 ${
          isActive
            ? 'text-amber-300 drop-shadow-[0_0_8px_rgba(251,191,36,0.7)] scale-110'
            : 'text-rose-200/80 group-hover:scale-105'
        }`}
      />
      <span className="truncate">{item.label}</span>
      {isActive && (
        <span className="ml-auto w-1.5 h-1.5 rounded-full bg-amber-300 shadow-[0_0_6px_rgba(251,191,36,0.9)]" />
      )}
    </span>
  </button>
));
NavButton.displayName = 'NavButton';

interface AppSidebarProps {
  isOpen?: boolean;
  onClose?: () => void;
}

/* ─── 4. Main AppSidebar Component ─────────────────────────────────────────── */
const AppSidebar: React.FC<AppSidebarProps> = memo(({ isOpen = false, onClose }) => {
  const { role, signOut, profile } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();

  const filteredItems = navItems.filter(item => role && item.roles.includes(role as AppRole));

  const [, startTransition] = useTransition();

  const handleNavigate = useCallback((path: string) => {
    if (onClose) onClose();
    startTransition(() => {
      navigate(path);
    });
  }, [navigate, onClose]);

  const handleSignOut = useCallback(() => {
    signOut();
    if (onClose) onClose();
  }, [signOut, onClose]);

  return (
    <>
      {/* Mobile Sidebar Backdrop */}
      {isOpen && (
        <div
          className="fixed inset-0 z-40 bg-black/50 backdrop-blur-xs md:hidden"
          onClick={onClose}
        />
      )}

      <aside
        className={`fixed inset-y-0 left-0 z-50 w-64 h-screen flex flex-col transition-transform duration-300 md:sticky md:translate-x-0 overflow-hidden ${
          isOpen ? 'translate-x-0' : '-translate-x-full'
        }`}
        style={{
          /* Rich NetBounce Christmas Velvet Red Sidebar */
          background: 'linear-gradient(180deg, #5c010a 0%, #7d0716 35%, #69040f 70%, #460107 100%)',
          boxShadow: '4px 0 30px rgba(0, 0, 0, 0.35)',
          borderRight: '1px solid rgba(255, 255, 255, 0.12)',
        }}
      >
        {/* ── Top Snow Cap Collecting on Sidebar ── */}
        <SidebarSnowCap />

        {/* ── Internal Falling Snow Effect ── */}
        <SidebarSnowCanvas />

        {/* ── Top Header with Logo & Santa Touch ── */}
        <div className="relative z-10 px-4 pt-5 pb-4 flex items-center justify-between border-b border-white/10">
          <div className="relative inline-block">
            <img
              src={logoDark}
              alt="NetBounce Placement"
              className="h-11 w-auto object-contain max-w-[195px] drop-shadow-[0_2px_10px_rgba(0,0,0,0.5)]"
            />
            {/* Cute Santa hat perched on the logo */}
            <span
              className="absolute -top-3.5 -left-1 text-lg pointer-events-none transform -rotate-12 select-none drop-shadow"
              title="Happy Holidays!"
            >
              🎅
            </span>
          </div>
          <span className="text-[9px] font-bold tracking-widest uppercase px-2 py-0.5 rounded-full bg-white/10 text-amber-300 border border-amber-300/30 backdrop-blur-sm shadow-sm flex items-center gap-0.5">
            <Sparkles className="w-2.5 h-2.5 text-amber-300" /> Xmas
          </span>
        </div>

        {/* ── Navigation Items List with Worm Motion ── */}
        <nav className="relative z-10 flex-1 p-3 space-y-1.5 overflow-y-auto" style={{ scrollbarWidth: 'thin' }}>
          {filteredItems.map(item => (
            <NavButton
              key={item.path}
              item={item}
              isActive={location.pathname === item.path}
              onClick={handleNavigate}
            />
          ))}
        </nav>

        {/* ── Bottom User Info & Actions ── */}
        <div className="relative z-10 p-3 border-t border-white/10 space-y-2 bg-black/15 backdrop-blur-sm">
          <div className="px-3 py-1.5 rounded-lg bg-white/5 border border-white/10">
            <p className="text-xs font-semibold text-rose-100 truncate">{profile?.full_name}</p>
            <p className="text-[11px] text-rose-200/60 truncate font-mono uppercase tracking-wider">{role?.replace('_', ' ')}</p>
          </div>

          <button
            onClick={handleSignOut}
            className="w-full flex items-center gap-3 px-3 py-2 rounded-xl text-sm text-rose-300 hover:text-white hover:bg-red-600/30 transition-all cursor-pointer"
          >
            <LogOut className="h-4 w-4 text-rose-400" />
            <span>Sign Out</span>
          </button>
        </div>
      </aside>
    </>
  );
});

AppSidebar.displayName = 'AppSidebar';

export default AppSidebar;
