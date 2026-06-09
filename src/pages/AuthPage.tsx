import React, { useState, useEffect, useRef } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { motion, AnimatePresence } from 'framer-motion';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import logoIcon from '@/assets/logo.png';
import { Eye, EyeOff } from 'lucide-react';

type AppRole = 'ADMIN' | 'PROCESS_ANALYST' | 'LEAD_TL' | 'LEAD_GEN' | 'SALES_TL' | 'SALES_TM' | 'ACCOUNTANT';

const roleLabels: Record<AppRole, string> = {
  ADMIN: 'Admin',
  PROCESS_ANALYST: 'Process Analyst',
  LEAD_TL: 'BD Team Lead',
  LEAD_GEN: 'BD Team (Lead Gen)',
  SALES_TL: 'Sales Team Lead',
  SALES_TM: 'Sales Team Member',
  ACCOUNTANT: 'Accountant',
};

/* ─── Interactive Mouse-tracking Particles Background ─────────────────────── */
const InteractiveParticles: React.FC = () => {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const mouseRef = useRef({ x: -1000, y: -1000, active: false });

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    let animId: number;

    const resize = () => {
      canvas.width = window.innerWidth;
      canvas.height = window.innerHeight;
    };
    resize();
    window.addEventListener('resize', resize);

    const handleMouseMove = (e: MouseEvent) => {
      mouseRef.current.x = e.clientX;
      mouseRef.current.y = e.clientY;
      mouseRef.current.active = true;
    };

    const handleMouseLeave = () => {
      mouseRef.current.active = false;
    };

    window.addEventListener('mousemove', handleMouseMove);
    document.addEventListener('mouseleave', handleMouseLeave);

    interface Particle {
      x: number;
      y: number;
      vx: number;
      vy: number;
      radius: number;
      baseRadius: number;
      alpha: number;
      color: string;
    }

    const count = 75;
    const particles: Particle[] = [];
    for (let i = 0; i < count; i++) {
      const radius = Math.random() * 2 + 1;
      particles.push({
        x: Math.random() * canvas.width,
        y: Math.random() * canvas.height,
        vx: (Math.random() - 0.5) * 0.4,
        vy: (Math.random() - 0.5) * 0.4,
        radius: radius,
        baseRadius: radius,
        alpha: Math.random() * 0.45 + 0.15,
        color: `hsla(${215 + Math.random() * 15}, 85%, 65%, 1)`
      });
    }

    const draw = () => {
      ctx.clearRect(0, 0, canvas.width, canvas.height);
      const mouse = mouseRef.current;

      // Draw connections
      for (let i = 0; i < particles.length; i++) {
        const p1 = particles[i];
        
        // Update positions
        p1.x += p1.vx;
        p1.y += p1.vy;

        // Bounce off bounds
        if (p1.x < 0 || p1.x > canvas.width) p1.vx *= -1;
        if (p1.y < 0 || p1.y > canvas.height) p1.vy *= -1;

        // Interactive mouse gravity / movement response
        if (mouse.active) {
          const dx = mouse.x - p1.x;
          const dy = mouse.y - p1.y;
          const dist = Math.sqrt(dx * dx + dy * dy);
          
          if (dist < 180) {
            // Smooth gravity force pull towards cursor
            const force = (180 - dist) / 180;
            p1.x += dx * force * 0.025;
            p1.y += dy * force * 0.025;
            p1.radius = p1.baseRadius * (1 + force * 0.9);
          } else {
            if (p1.radius > p1.baseRadius) {
              p1.radius -= 0.04;
            }
          }
        } else {
          if (p1.radius > p1.baseRadius) {
            p1.radius -= 0.04;
          }
        }

        // Draw particle node
        ctx.beginPath();
        ctx.arc(p1.x, p1.y, p1.radius, 0, Math.PI * 2);
        ctx.fillStyle = p1.color.replace('1)', `${p1.alpha})`);
        ctx.fill();

        // Lines to other nearby nodes
        for (let j = i + 1; j < particles.length; j++) {
          const p2 = particles[j];
          const dx = p1.x - p2.x;
          const dy = p1.y - p2.y;
          const dist = Math.sqrt(dx * dx + dy * dy);

          if (dist < 110) {
            const lineAlpha = (1 - dist / 110) * 0.12;
            ctx.beginPath();
            ctx.moveTo(p1.x, p1.y);
            ctx.lineTo(p2.x, p2.y);
            ctx.strokeStyle = `rgba(80, 130, 240, ${lineAlpha})`;
            ctx.lineWidth = 0.55;
            ctx.stroke();
          }
        }

        // Light trails connecting directly to cursor
        if (mouse.active) {
          const dx = mouse.x - p1.x;
          const dy = mouse.y - p1.y;
          const dist = Math.sqrt(dx * dx + dy * dy);
          if (dist < 160) {
            const lineAlpha = (1 - dist / 160) * 0.15;
            ctx.beginPath();
            ctx.moveTo(p1.x, p1.y);
            ctx.lineTo(mouse.x, mouse.y);
            ctx.strokeStyle = `rgba(90, 140, 255, ${lineAlpha})`;
            ctx.lineWidth = 0.75;
            ctx.stroke();
          }
        }
      }

      animId = requestAnimationFrame(draw);
    };

    draw();

    return () => {
      cancelAnimationFrame(animId);
      window.removeEventListener('resize', resize);
      window.removeEventListener('mousemove', handleMouseMove);
      document.removeEventListener('mouseleave', handleMouseLeave);
    };
  }, []);

  return <canvas ref={canvasRef} className="absolute inset-0 w-full h-full pointer-events-none" style={{ zIndex: 0 }} />;
};

/* ─── PS5-style animated orbs (CSS-only, no canvas needed) ─────────────────── */
const FloatingOrbs: React.FC = () => (
  <div className="absolute inset-0 overflow-hidden pointer-events-none">
    {/* Primary large orb */}
    <div
      style={{
        position: 'absolute',
        width: '280px',
        height: '280px',
        borderRadius: '50%',
        background: 'radial-gradient(circle at 40% 40%, rgba(80, 100, 220, 0.4), rgba(40, 60, 180, 0.12) 60%, transparent 80%)',
        top: '10%',
        right: '-5%',
        animation: 'ps5Float1 12s ease-in-out infinite',
        filter: 'blur(2px)',
      }}
    />
    {/* Secondary medium orb */}
    <div
      style={{
        position: 'absolute',
        width: '180px',
        height: '180px',
        borderRadius: '50%',
        background: 'radial-gradient(circle at 50% 50%, rgba(70, 90, 220, 0.3), rgba(50, 70, 190, 0.08) 60%, transparent 80%)',
        top: '50%',
        left: '10%',
        animation: 'ps5Float2 15s ease-in-out infinite',
        filter: 'blur(3px)',
      }}
    />
    {/* Tertiary small accent orb */}
    <div
      style={{
        position: 'absolute',
        width: '120px',
        height: '120px',
        borderRadius: '50%',
        background: 'radial-gradient(circle at 30% 30%, rgba(90, 110, 220, 0.35), rgba(60, 80, 200, 0.08) 60%, transparent 80%)',
        bottom: '25%',
        right: '15%',
        animation: 'ps5Float3 10s ease-in-out infinite',
        filter: 'blur(1px)',
      }}
    />
    {/* Fourth tiny orb for depth */}
    <div
      style={{
        position: 'absolute',
        width: '80px',
        height: '80px',
        borderRadius: '50%',
        background: 'radial-gradient(circle at 50% 50%, rgba(100, 120, 220, 0.25), transparent 70%)',
        top: '35%',
        left: '40%',
        animation: 'ps5Float4 18s ease-in-out infinite',
        filter: 'blur(4px)',
      }}
    />

    <style>{`
      @keyframes ps5Float1 {
        0%, 100% { transform: translate(0, 0) scale(1); opacity: 0.7; }
        25% { transform: translate(-30px, 40px) scale(1.08); opacity: 0.9; }
        50% { transform: translate(20px, -20px) scale(0.95); opacity: 0.6; }
        75% { transform: translate(-15px, -35px) scale(1.05); opacity: 0.85; }
      }
      @keyframes ps5Float2 {
        0%, 100% { transform: translate(0, 0) scale(1); opacity: 0.5; }
        33% { transform: translate(40px, -30px) scale(1.1); opacity: 0.75; }
        66% { transform: translate(-25px, 25px) scale(0.9); opacity: 0.55; }
      }
      @keyframes ps5Float3 {
        0%, 100% { transform: translate(0, 0) scale(1); opacity: 0.6; }
        20% { transform: translate(25px, 20px) scale(1.12); opacity: 0.8; }
        40% { transform: translate(-10px, -30px) scale(0.92); opacity: 0.5; }
        60% { transform: translate(30px, -10px) scale(1.06); opacity: 0.7; }
        80% { transform: translate(-20px, 15px) scale(0.98); opacity: 0.65; }
      }
      @keyframes ps5Float4 {
        0%, 100% { transform: translate(0, 0) scale(1); opacity: 0.4; }
        50% { transform: translate(-35px, -40px) scale(1.15); opacity: 0.65; }
      }
    `}</style>
  </div>
);

const AuthPage: React.FC = () => {
  const { signIn, signUp } = useAuth();
  const [isSignUp, setIsSignUp] = useState(false);
  const [loading, setLoading] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [form, setForm] = useState({
    email: '',
    password: '',
    fullName: '',
    role: '' as AppRole | '',
    department: '',
    reportsTo: '',
  });

  const { data: teamLeads } = useQuery({
    queryKey: ['available-team-leads', form.role],
    queryFn: async () => {
      if (!form.role || !['SALES_TM', 'LEAD_GEN'].includes(form.role)) return [];
      
      const targetRole = form.role === 'SALES_TM' ? 'SALES_TL' : 'LEAD_TL';
      const { data: roles } = await supabase.from('user_roles').select('user_id').eq('role', targetRole);
      if (!roles) return [];
      
      const { data: profiles } = await supabase.from('profiles').select('user_id, full_name').in('user_id', roles.map(r => r.user_id));
      return profiles || [];
    },
    enabled: isSignUp && (form.role === 'SALES_TM' || form.role === 'LEAD_GEN'),
  });

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);

    try {
      if (isSignUp) {
        if (!form.role) {
          toast.error('Please select a role');
          setLoading(false);
          return;
        }
        if (['SALES_TM', 'LEAD_GEN'].includes(form.role) && !form.reportsTo) {
          toast.error('Please select your Team Lead');
          setLoading(false);
          return;
        }
        const { error } = await signUp(form.email, form.password, form.fullName, form.role as AppRole, form.department, form.reportsTo);
        if (error) throw error;
        toast.success('Account created! Check your email to verify.');
      } else {
        const { error } = await signIn(form.email, form.password);
        if (error) throw error;
        toast.success('Welcome back!');
      }
    } catch (err: any) {
      toast.error(err.message || 'Authentication failed');
    } finally {
      setLoading(false);
    }
  };

  /* ─── Shared input style ──────────────────────────────────────────────────── */
  const inputClassName = "h-11 bg-[#0d1525] border border-[#1e2a42] rounded-lg text-white placeholder:text-[#4a5568] focus:border-[#4361ee] focus:ring-1 focus:ring-[#4361ee]/30 transition-all";
  const labelClassName = "text-sm font-medium text-[#c4cad4] mb-1.5 block";

  return (
    <div className="min-h-screen flex items-center justify-center relative overflow-hidden" style={{ background: '#060b18' }}>
      <svg className="absolute w-0 h-0 pointer-events-none" aria-hidden="true">
        <filter id="lighten-black-keep-blue">
          <feColorMatrix type="matrix" values="0 0 -1.116 0 1 0 0 -0.953 0 1 0 0 -0.163 0 1 0 0 0 1 0" />
        </filter>
      </svg>
      {/* Interactive mouse tracking particle canvas */}
      <InteractiveParticles />

      <motion.div
        layout
        initial={{ opacity: 0, y: 30 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ type: 'spring', stiffness: 100, damping: 17 }}
        className="flex w-full max-w-[960px] min-h-[580px] mx-4 rounded-2xl overflow-hidden relative z-10"
        style={{
          background: '#0a1128',
          boxShadow: '0 25px 80px rgba(0,0,0,0.6), 0 0 40px rgba(67,97,238,0.08)',
          border: '1px solid rgba(30,42,66,0.5)',
        }}
      >
        {/* ── LEFT PANEL: Blue gradient with floating orbs ───────────────────── */}
        <motion.div
          layout
          className="relative hidden md:flex flex-col justify-between w-[420px] min-w-[380px] p-8 overflow-hidden"
          style={{
            background: 'linear-gradient(135deg, #0c1445 0%, #111b52 30%, #0e1640 60%, #0a1238 100%)',
            borderRadius: '16px',
            margin: '12px',
          }}
        >
          {/* Top logo */}
          <div className="flex items-center relative z-10">
            <img 
              src={logoIcon} 
              alt="NetBounce Placement" 
              className="h-12 w-auto object-contain max-w-[240px]" 
              style={{ filter: 'url(#lighten-black-keep-blue)' }} 
            />
          </div>

          {/* PS5-style floating orbs */}
          <FloatingOrbs />

          {/* Bottom tagline */}
          <div className="relative z-10">
            <div className="text-white/50 text-[11px] tracking-[0.2em] uppercase mb-2">Internal Platform</div>
            <h2 className="text-white text-[28px] font-bold leading-tight">
              Managing Every<br />Candidate, End to End.
            </h2>
          </div>
        </motion.div>

        {/* ── RIGHT PANEL: Auth form ────────────────────────────────────────── */}
        <motion.div
          layout
          className="flex-1 flex flex-col justify-center px-8 md:px-12 py-10 max-h-[90vh] overflow-y-auto"
          style={{ scrollbarWidth: 'thin' }}
        >
          {/* Logo + Header */}
          <div className="flex flex-col items-center mb-7">
            {/* Horizontal white logo matching reference */}
            <div className="flex items-center mb-5">
              <img 
                src={logoIcon} 
                alt="NetBounce Placement" 
                className="h-13 w-auto object-contain max-w-[260px]" 
                style={{ filter: 'url(#lighten-black-keep-blue) drop-shadow(0 0 12px rgba(67,97,238,0.25))' }} 
              />
            </div>
            <h1 className="text-[22px] font-bold text-white">
              {isSignUp ? 'Create Account' : 'Sign in to your account'}
            </h1>
            <p className="text-[#6b7a90] text-sm mt-1">
              {isSignUp ? 'Join NetBounce CRM' : 'Track candidates, closures, and your team pipeline.'}
            </p>
          </div>

          {/* Form with clean sliding/opacity animations */}
          <form onSubmit={handleSubmit} className="space-y-4">
            <AnimatePresence mode="wait">
              {isSignUp ? (
                <motion.div
                  key="signup-fields"
                  initial={{ opacity: 0, y: 15 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -15 }}
                  transition={{ duration: 0.25 }}
                  className="space-y-4"
                >
                  {/* Full Name */}
                  <div>
                    <Label htmlFor="fullName" className={labelClassName}>Full Name</Label>
                    <Input
                      id="fullName"
                      value={form.fullName}
                      onChange={e => setForm(f => ({ ...f, fullName: e.target.value }))}
                      required
                      placeholder="John Doe"
                      className={inputClassName}
                    />
                  </div>

                  {/* Role */}
                  <div>
                    <Label htmlFor="role" className={labelClassName}>Role</Label>
                    <Select value={form.role} onValueChange={v => {
                      const newRole = v as AppRole;
                      setForm(f => ({ 
                        ...f, 
                        role: newRole,
                        department: (newRole === 'ACCOUNTANT') ? 'ACCOUNTS MANAGEMENT' : f.department
                      }));
                    }}>
                      <SelectTrigger className={inputClassName}>
                        <SelectValue placeholder="Select your role" />
                      </SelectTrigger>
                      <SelectContent>
                        {(Object.keys(roleLabels) as AppRole[]).map(r => (
                          <SelectItem key={r} value={r}>{roleLabels[r]}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>

                  {/* Reports To (conditional) */}
                  {['SALES_TM', 'LEAD_GEN'].includes(form.role) && (
                    <motion.div
                      initial={{ opacity: 0, height: 0 }}
                      animate={{ opacity: 1, height: 'auto' }}
                      className="overflow-hidden"
                    >
                      <Label htmlFor="reportsTo" className={labelClassName}>
                        Select {form.role === 'SALES_TM' ? 'Sales' : 'BD'} Team Lead *
                      </Label>
                      <Select value={form.reportsTo} onValueChange={v => setForm(f => ({ ...f, reportsTo: v }))}>
                        <SelectTrigger className={inputClassName}>
                          <SelectValue placeholder={`Select your ${form.role === 'SALES_TM' ? 'Sales' : 'BD'} TL`} />
                        </SelectTrigger>
                        <SelectContent>
                          {teamLeads?.map(tl => (
                            <SelectItem key={tl.user_id} value={tl.user_id}>{tl.full_name}</SelectItem>
                          ))}
                          {(!teamLeads || teamLeads.length === 0) && (
                            <div className="p-2 text-xs text-muted-foreground text-center">No Team Leads found in database</div>
                          )}
                        </SelectContent>
                      </Select>
                    </motion.div>
                  )}

                  {/* Department */}
                  <div>
                    <Label htmlFor="department" className={labelClassName}>Department</Label>
                    <Input
                      id="department"
                      value={form.department}
                      onChange={e => setForm(f => ({ ...f, department: e.target.value }))}
                      placeholder="Sales / BD"
                      className={inputClassName}
                    />
                  </div>
                </motion.div>
              ) : null}
            </AnimatePresence>

            {/* Email (Always visible) */}
            <div>
              <Label htmlFor="email" className={labelClassName}>
                {isSignUp ? 'Email' : 'Your email'}
              </Label>
              <Input
                id="email"
                type="email"
                value={form.email}
                onChange={e => setForm(f => ({ ...f, email: e.target.value }))}
                required
                placeholder={isSignUp ? 'you@netbounceplacement.com' : 'shashank.m@netbounceplacement.com'}
                className={inputClassName}
              />
            </div>

            {/* Password (Always visible) */}
            <div>
              <Label htmlFor="password" className={labelClassName}>Password</Label>
              <div className="relative">
                <Input
                  id="password"
                  type={showPassword ? 'text' : 'password'}
                  value={form.password}
                  onChange={e => setForm(f => ({ ...f, password: e.target.value }))}
                  required
                  placeholder="••••••••"
                  minLength={6}
                  className={`${inputClassName} pr-10`}
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(p => !p)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-[#4a5568] hover:text-[#8b95a5] transition-colors"
                  tabIndex={-1}
                >
                  {showPassword ? <EyeOff size={18} /> : <Eye size={18} />}
                </button>
              </div>
            </div>

            {/* Submit */}
            <Button
              type="submit"
              className="w-full h-11 text-[15px] font-semibold rounded-lg transition-all duration-200 shadow-lg"
              disabled={loading}
              style={{
                background: 'linear-gradient(135deg, #3b5bdb 0%, #4361ee 50%, #5a7af7 100%)',
                boxShadow: '0 4px 20px rgba(67,97,238,0.35)',
              }}
            >
              {loading ? 'Please wait...' : isSignUp ? 'Create Account' : 'Sign In'}
            </Button>
          </form>

          {/* Footer links */}
          <div className="mt-6 text-center space-y-3">
            <button
              type="button"
              onClick={() => setIsSignUp(!isSignUp)}
              className="text-sm text-[#6b7a90] hover:text-[#4361ee] transition-colors"
            >
              {isSignUp ? 'Already have an account? Sign in' : "Don't have an account? Sign up"}
            </button>
            {!isSignUp && (
              <p className="text-[11px] text-[#3d4a5c]">
                Access restricted to NetBounce Placement LLC team members
              </p>
            )}
          </div>
        </motion.div>
      </motion.div>
    </div>
  );
};

export default AuthPage;
