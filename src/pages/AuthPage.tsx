import React, { useState, useEffect, useRef } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { FORCED_LOGOUT_KEY } from '@/contexts/AuthContext';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { motion } from 'framer-motion';
import { toast } from 'sonner';
import logoDarkIcon from '@/assets/logo-dark.png';
import { Eye, EyeOff, ShieldAlert, Snowflake, Sparkles } from 'lucide-react';

/* ─── 1. Continuous Falling Snow Canvas ───────────────────────────────────── */
const ChristmasSnowfall: React.FC = () => {
  const canvasRef = useRef<HTMLCanvasElement>(null);

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

    interface Flake {
      x: number;
      y: number;
      radius: number;
      speed: number;
      drift: number;
      swaySpeed: number;
      swayOffset: number;
      opacity: number;
    }

    const flakeCount = Math.min(130, Math.floor(window.innerWidth / 11));
    const flakes: Flake[] = [];

    for (let i = 0; i < flakeCount; i++) {
      flakes.push({
        x: Math.random() * canvas.width,
        y: Math.random() * canvas.height,
        radius: Math.random() * 2.8 + 1,
        speed: Math.random() * 1.2 + 0.6,
        drift: Math.random() * 0.8 - 0.4,
        swaySpeed: Math.random() * 0.02 + 0.01,
        swayOffset: Math.random() * Math.PI * 2,
        opacity: Math.random() * 0.55 + 0.35,
      });
    }

    let frame = 0;
    const render = () => {
      ctx.clearRect(0, 0, canvas.width, canvas.height);
      frame++;

      for (let i = 0; i < flakes.length; i++) {
        const f = flakes[i];
        f.y += f.speed;
        f.x += Math.sin(frame * f.swaySpeed + f.swayOffset) * 0.6 + f.drift;

        // Reset if past screen bounds
        if (f.y > canvas.height + 5) {
          f.y = -8;
          f.x = Math.random() * canvas.width;
        }
        if (f.x > canvas.width + 10) f.x = -10;
        if (f.x < -10) f.x = canvas.width + 10;

        ctx.beginPath();
        ctx.arc(f.x, f.y, f.radius, 0, Math.PI * 2);
        ctx.fillStyle = `rgba(255, 255, 255, ${f.opacity})`;
        ctx.shadowColor = 'rgba(255, 255, 255, 0.8)';
        ctx.shadowBlur = f.radius > 2 ? 6 : 2;
        ctx.fill();
        ctx.shadowBlur = 0;
      }

      animId = requestAnimationFrame(render);
    };

    render();

    return () => {
      cancelAnimationFrame(animId);
      window.removeEventListener('resize', resize);
    };
  }, []);

  return <canvas ref={canvasRef} className="absolute inset-0 w-full h-full pointer-events-none z-20" />;
};

/* ─── 2. Stylized Pine Tree (Green & Frosted Pink) ────────────────────────── */
interface PineTreeProps {
  x: string | number;
  bottom: string | number;
  height: number;
  colorType: 'green' | 'pink' | 'emerald';
  zIndex?: number;
  twinkleDelay?: number;
}

const PineTree: React.FC<PineTreeProps> = ({ x, bottom, height, colorType, zIndex = 2, twinkleDelay = 0 }) => {
  const isPink = colorType === 'pink';
  const width = height * 0.65;

  const needleBase = isPink ? '#9d174d' : '#064e3b';
  const needleMid = isPink ? '#db2777' : '#047857';
  const needleTop = isPink ? '#f472b6' : '#10b981';
  const trunkColor = '#451a03';

  return (
    <div
      style={{
        position: 'absolute',
        left: x,
        bottom: bottom,
        width: `${width}px`,
        height: `${height}px`,
        zIndex,
        pointerEvents: 'none',
      }}
    >
      <svg viewBox="0 0 100 150" className="w-full h-full overflow-visible drop-shadow-[0_8px_16px_rgba(0,0,0,0.5)]">
        <defs>
          <linearGradient id={`treeGrad-${colorType}-${height}`} x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor={needleTop} />
            <stop offset="50%" stopColor={needleMid} />
            <stop offset="100%" stopColor={needleBase} />
          </linearGradient>
          <linearGradient id={`snowCap-${colorType}-${height}`} x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="#ffffff" />
            <stop offset="100%" stopColor={isPink ? '#fce7f3' : '#e2e8f0'} />
          </linearGradient>
        </defs>

        {/* Tree Trunk */}
        <rect x="44" y="125" width="12" height="25" rx="3" fill={trunkColor} />

        {/* Bottom Tier */}
        <polygon points="50,45 10,130 90,130" fill={`url(#treeGrad-${colorType}-${height})`} />
        {/* Bottom Tier Snow Cap */}
        <path d="M 12 128 Q 30 118 50 120 Q 70 118 88 128 Q 70 122 50 123 Q 30 122 12 128 Z" fill={`url(#snowCap-${colorType}-${height})`} />

        {/* Middle Tier */}
        <polygon points="50,25 22,85 78,85" fill={`url(#treeGrad-${colorType}-${height})`} />
        {/* Middle Tier Snow Cap */}
        <path d="M 23 83 Q 36 76 50 78 Q 64 76 77 83 Q 64 79 50 80 Q 36 79 23 83 Z" fill={`url(#snowCap-${colorType}-${height})`} />

        {/* Top Tier */}
        <polygon points="50,5 32,50 68,50" fill={`url(#treeGrad-${colorType}-${height})`} />
        {/* Top Tier Snow Cap */}
        <path d="M 33 48 Q 41 43 50 45 Q 59 43 67 48 Q 59 45 50 46 Q 41 45 33 48 Z" fill={`url(#snowCap-${colorType}-${height})`} />

        {/* Star / Sparkle on top */}
        <polygon points="50,0 52,4 56,5 53,8 54,12 50,9 46,12 47,8 44,5 48,4" fill={isPink ? '#fef08a' : '#fde047'} className="animate-pulse" />

        {/* Twinkling fairy ornaments */}
        <circle cx="35" cy="110" r="2.5" fill={isPink ? '#fef08a' : '#f43f5e'} style={{ animation: `twinkle 2s infinite ease-in-out ${twinkleDelay}s` }} />
        <circle cx="65" cy="115" r="2.5" fill={isPink ? '#67e8f9' : '#fbbf24'} style={{ animation: `twinkle 2.4s infinite ease-in-out ${twinkleDelay + 0.4}s` }} />
        <circle cx="42" cy="70" r="2" fill={isPink ? '#fde047' : '#ec4899'} style={{ animation: `twinkle 1.8s infinite ease-in-out ${twinkleDelay + 0.8}s` }} />
        <circle cx="58" cy="72" r="2" fill={isPink ? '#ffffff' : '#38bdf8'} style={{ animation: `twinkle 2.2s infinite ease-in-out ${twinkleDelay + 1.2}s` }} />
      </svg>
    </div>
  );
};

/* ─── 3. Cozy Winter Cabin with Chimney Smoke & Glowing Windows ───────────── */
const CozyHutWithSmoke: React.FC = () => {
  return (
    <div
      className="absolute hidden lg:block pointer-events-none"
      style={{
        right: '4%',
        bottom: '8%',
        width: '260px',
        height: '210px',
        zIndex: 4,
      }}
    >
      {/* ── Animated Chimney Smoke Puffs ── */}
      <div className="absolute" style={{ top: '-42px', left: '172px' }}>
        <span className="smoke-puff smoke-1" />
        <span className="smoke-puff smoke-2" />
        <span className="smoke-puff smoke-3" />
        <span className="smoke-puff smoke-4" />
      </div>

      <svg viewBox="0 0 240 180" className="w-full h-full overflow-visible drop-shadow-[0_15px_30px_rgba(0,0,0,0.6)]">
        <defs>
          {/* Wood Planks Gradient */}
          <linearGradient id="cabinWood" x1="0" y1="0" x2="1" y2="0">
            <stop offset="0%" stopColor="#451a03" />
            <stop offset="25%" stopColor="#78350f" />
            <stop offset="50%" stopColor="#92400e" />
            <stop offset="75%" stopColor="#78350f" />
            <stop offset="100%" stopColor="#451a03" />
          </linearGradient>

          {/* Roof Snow Gradient */}
          <linearGradient id="roofSnow" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="#ffffff" />
            <stop offset="60%" stopColor="#f1f5f9" />
            <stop offset="100%" stopColor="#cbd5e1" />
          </linearGradient>

          {/* Window Glow Filter */}
          <radialGradient id="windowLight" cx="50%" cy="50%" r="50%">
            <stop offset="0%" stopColor="#fef08a" stopOpacity="1" />
            <stop offset="60%" stopColor="#eab308" stopOpacity="0.85" />
            <stop offset="100%" stopColor="#ca8a04" stopOpacity="0.6" />
          </radialGradient>

          <filter id="cozyGlow" x="-30%" y="-30%" width="160%" height="160%">
            <feGaussianBlur stdDeviation="8" result="blur" />
            <feComposite in="SourceGraphic" in2="blur" operator="over" />
          </filter>
        </defs>

        {/* Ambient Window Glow Light Casting on Ground */}
        <ellipse cx="120" cy="155" rx="55" ry="18" fill="#fef08a" opacity="0.18" filter="url(#cozyGlow)" />

        {/* Stone / Brick Chimney */}
        <rect x="170" y="25" width="22" height="48" rx="2" fill="#334155" stroke="#1e293b" strokeWidth="1.5" />
        {/* Snow Cap on Chimney */}
        <path d="M 167 25 Q 181 19 195 25 Q 181 22 167 25 Z" fill="#ffffff" />

        {/* Main Cabin Walls */}
        <rect x="50" y="80" width="140" height="75" rx="3" fill="url(#cabinWood)" />
        {/* Log Lines */}
        <line x1="50" y1="95" x2="190" y2="95" stroke="#291203" strokeWidth="2" opacity="0.6" />
        <line x1="50" y1="110" x2="190" y2="110" stroke="#291203" strokeWidth="2" opacity="0.6" />
        <line x1="50" y1="125" x2="190" y2="125" stroke="#291203" strokeWidth="2" opacity="0.6" />
        <line x1="50" y1="140" x2="190" y2="140" stroke="#291203" strokeWidth="2" opacity="0.6" />

        {/* Cabin Door */}
        <rect x="135" y="105" width="32" height="50" rx="3" fill="#291203" stroke="#1c0c02" strokeWidth="2" />
        <circle cx="160" cy="130" r="2.5" fill="#fde047" />

        {/* Christmas Wreath on Door */}
        <circle cx="151" cy="120" r="7.5" fill="none" stroke="#15803d" strokeWidth="3.5" strokeDasharray="3,1" />
        <circle cx="151" cy="120" r="7.5" fill="none" stroke="#166534" strokeWidth="2.5" />
        <circle cx="151" cy="114" r="2" fill="#ef4444" />

        {/* Cozy Glowing Window */}
        <rect x="72" y="98" width="38" height="34" rx="3" fill="url(#windowLight)" filter="url(#cozyGlow)" />
        <rect x="72" y="98" width="38" height="34" rx="3" fill="url(#windowLight)" stroke="#451a03" strokeWidth="3" />
        {/* Window Pane Grid */}
        <line x1="91" y1="98" x2="91" y2="132" stroke="#451a03" strokeWidth="2" />
        <line x1="72" y1="115" x2="110" y2="115" stroke="#451a03" strokeWidth="2" />

        {/* Roof Structure */}
        <polygon points="120,38 35,84 205,84" fill="#1c0c02" />

        {/* Heavy Snow Covering on Roof */}
        <path
          d="M 120 30 
             Q 160 52 210 82 
             Q 195 90 185 86 
             Q 175 92 165 87 
             Q 150 93 140 86 
             Q 120 90 100 86 
             Q 85 92 75 86 
             Q 60 93 50 86 
             Q 40 91 30 82 
             Q 80 52 120 30 Z"
          fill="url(#roofSnow)"
          stroke="#e2e8f0"
          strokeWidth="1"
        />

        {/* Hanging Icicles along Roof Edge */}
        <polygon points="42,88 44,97 46,88" fill="#ffffff" opacity="0.9" />
        <polygon points="68,88 70,100 73,88" fill="#ffffff" opacity="0.9" />
        <polygon points="98,87 100,99 103,87" fill="#ffffff" opacity="0.9" />
        <polygon points="135,88 137,102 140,88" fill="#ffffff" opacity="0.9" />
        <polygon points="175,88 177,98 180,88" fill="#ffffff" opacity="0.9" />
        <polygon points="198,85 200,94 202,85" fill="#ffffff" opacity="0.9" />
      </svg>
    </div>
  );
};

/* ─── 4. Snow Cap on Top of Login Box ─────────────────────────────────────── */
const SnowCappedRoof: React.FC = () => {
  return (
    <div
      className="absolute pointer-events-none select-none z-30"
      style={{
        top: '-18px',
        left: '-12px',
        right: '-12px',
        height: '42px',
      }}
    >
      <svg
        viewBox="0 0 1000 65"
        preserveAspectRatio="none"
        className="w-full h-full drop-shadow-[0_8px_12px_rgba(0,0,0,0.45)]"
      >
        <defs>
          <linearGradient id="snowBoxGrad" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="#ffffff" />
            <stop offset="55%" stopColor="#f8fafc" />
            <stop offset="85%" stopColor="#e2e8f0" />
            <stop offset="100%" stopColor="#cbd5e1" />
          </linearGradient>
        </defs>

        {/* Organic wavy snow cover sitting right on top of card */}
        <path
          d="M 0 35 
             C 30 18, 70 14, 110 24 
             C 150 34, 190 12, 240 18 
             C 290 24, 330 38, 380 22 
             C 430 8, 480 32, 530 20 
             C 580 10, 620 28, 670 16 
             C 720 6, 770 30, 820 18 
             C 870 8, 920 26, 960 16 
             C 980 12, 995 24, 1000 35 
             L 1000 44
             C 980 42, 965 52, 955 45
             C 940 40, 930 48, 915 44
             C 890 38, 875 50, 855 42
             C 830 36, 815 48, 790 41
             C 750 36, 735 52, 705 44
             C 670 37, 650 49, 620 42
             C 580 35, 560 50, 525 43
             C 490 37, 475 49, 440 42
             C 400 36, 385 53, 350 44
             C 310 37, 290 50, 260 43
             C 220 36, 200 48, 170 41
             C 130 36, 115 52, 85 44
             C 50 38, 30 48, 0 42
             Z"
          fill="url(#snowBoxGrad)"
        />

        {/* Small hanging frosty icicles on corners */}
        <polygon points="60,42 63,56 66,42" fill="#ffffff" opacity="0.95" />
        <polygon points="195,43 198,54 201,43" fill="#ffffff" opacity="0.95" />
        <polygon points="410,42 413,57 416,42" fill="#ffffff" opacity="0.95" />
        <polygon points="635,42 638,58 641,42" fill="#ffffff" opacity="0.95" />
        <polygon points="840,42 843,55 846,42" fill="#ffffff" opacity="0.95" />
        <polygon points="945,43 948,53 951,43" fill="#ffffff" opacity="0.95" />
      </svg>
    </div>
  );
};

/* ─── 5. Realistic Cute Santa Hat on NetBounce Logo ───────────────────────── */
const SantaHat: React.FC<{ style?: React.CSSProperties }> = ({ style }) => (
  <div style={{ position: 'absolute', width: '36px', height: '32px', zIndex: 15, pointerEvents: 'none', ...style }}>
    <svg viewBox="0 0 40 36" className="w-full h-full overflow-visible drop-shadow-[0_2px_4px_rgba(0,0,0,0.4)]">
      {/* Red Cone Body */}
      <path
        d="M 8 26 
           C 12 12, 22 2, 34 8 
           C 30 14, 25 22, 26 26 Z"
        fill="#dc2626"
      />
      {/* Darker red crease shading */}
      <path
        d="M 12 24 C 16 16, 22 8, 28 10 C 24 16, 20 22, 21 24 Z"
        fill="#b91c1c"
        opacity="0.45"
      />
      {/* White Fluffy Pom-Pom on tip */}
      <circle cx="35" cy="8" r="4.5" fill="#ffffff" stroke="#f1f5f9" strokeWidth="0.5" />
      <circle cx="35" cy="8" r="3.5" fill="#f8fafc" />

      {/* White Fluffy Brim */}
      <rect x="4" y="24" width="26" height="7.5" rx="3.8" fill="#ffffff" stroke="#e2e8f0" strokeWidth="0.5" />
    </svg>
  </div>
);

/* ─── 6. Main AuthPage Component ─────────────────────────────────────────── */
const AuthPage: React.FC = () => {
  const { signIn } = useAuth();
  const [loading, setLoading] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [securityMessage, setSecurityMessage] = useState<string | null>(null);
  const [form, setForm] = useState({
    email: '',
    password: '',
  });

  useEffect(() => {
    const msg = sessionStorage.getItem(FORCED_LOGOUT_KEY);
    if (msg) {
      setSecurityMessage(msg);
      sessionStorage.removeItem(FORCED_LOGOUT_KEY);
    }
  }, []);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);

    const cleanedEmail = form.email.replace(/['"]/g, '').trim();

    try {
      const { error } = await signIn(cleanedEmail, form.password);
      if (error) {
        if (error.message.includes('Weekend Access Locked')) {
          setSecurityMessage(error.message);
        }
        throw error;
      }
      toast.success('Welcome back!');
    } catch (err: any) {
      toast.error(err.message || 'Authentication failed');
    } finally {
      setLoading(false);
    }
  };

  const inputClassName =
    'h-11 bg-[#091224]/85 border border-[#1e2f4d] rounded-lg text-white placeholder:text-[#52637f] focus:border-[#4361ee] focus:ring-1 focus:ring-[#4361ee]/40 transition-all backdrop-blur-sm';
  const labelClassName = 'text-sm font-medium text-[#cbd5e1] mb-1.5 block';

  return (
    <div
      className="min-h-screen flex items-center justify-center relative overflow-hidden select-none"
      style={{
        background: 'radial-gradient(ellipse at 50% 25%, #0f1f42 0%, #081126 45%, #030712 100%)',
      }}
    >
      {/* ── Falling Snow Canvas ── */}
      <ChristmasSnowfall />

      {/* ── Background Deep Winter Sky Ambient Starry Dust ── */}
      <div className="absolute inset-0 pointer-events-none opacity-40 z-0 bg-[radial-gradient(#ffffff_1px,transparent_1px)] [background-size:32px_32px]" />

      {/* ── Pine Trees (Left Forest: Green & Frosted Pink) ── */}
      <PineTree x="1.5%" bottom="4%" height={260} colorType="green" zIndex={2} twinkleDelay={0} />
      <PineTree x="6.5%" bottom="6%" height={210} colorType="pink" zIndex={3} twinkleDelay={0.5} />
      <PineTree x="12%" bottom="3%" height={170} colorType="green" zIndex={2} twinkleDelay={1.1} />
      <PineTree x="16%" bottom="5%" height={130} colorType="pink" zIndex={1} twinkleDelay={1.6} />

      {/* ── Pine Trees (Right Forest behind/around Cabin) ── */}
      <PineTree x="74%" bottom="7%" height={190} colorType="pink" zIndex={2} twinkleDelay={0.3} />
      <PineTree x="80%" bottom="9%" height={240} colorType="green" zIndex={1} twinkleDelay={0.9} />
      <PineTree x="91%" bottom="4%" height={270} colorType="pink" zIndex={3} twinkleDelay={1.4} />

      {/* ── Right Side Cozy Hut with Chimney Smoke & Warm Light ── */}
      <CozyHutWithSmoke />

      {/* ── Layered Ground Snowdrifts / Rolling Hills ── */}
      <div className="absolute bottom-0 left-0 right-0 h-[110px] pointer-events-none z-10 overflow-hidden">
        <svg viewBox="0 0 1440 120" preserveAspectRatio="none" className="w-full h-full">
          <defs>
            {/* Distant Snow Hill */}
            <linearGradient id="snowBack" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor="#94a3b8" stopOpacity="0.4" />
              <stop offset="100%" stopColor="#0f172a" stopOpacity="0.8" />
            </linearGradient>
            {/* Mid Snow Hill */}
            <linearGradient id="snowMid" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor="#cbd5e1" stopOpacity="0.65" />
              <stop offset="100%" stopColor="#1e293b" stopOpacity="0.9" />
            </linearGradient>
            {/* Foreground Crisp Snow Blanket */}
            <linearGradient id="snowFore" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor="#ffffff" />
              <stop offset="40%" stopColor="#f1f5f9" />
              <stop offset="100%" stopColor="#cbd5e1" />
            </linearGradient>
          </defs>

          {/* Far Layer */}
          <path d="M 0 65 Q 360 25 720 50 T 1440 40 L 1440 120 L 0 120 Z" fill="url(#snowBack)" />
          {/* Mid Layer */}
          <path d="M 0 75 Q 420 40 840 70 T 1440 60 L 1440 120 L 0 120 Z" fill="url(#snowMid)" />
          {/* Foreground Blanket with Frost Shadow */}
          <path d="M 0 90 Q 280 65 620 85 T 1440 80 L 1440 120 L 0 120 Z" fill="url(#snowFore)" />
        </svg>
      </div>

      {/* ── Main Central Login Card with Snow-Capped Top ── */}
      <div className="relative z-30 w-full max-w-[960px] mx-4 my-8">
        {/* Snow Drift Collected on Top of Login Box */}
        <SnowCappedRoof />

        <motion.div
          layout
          initial={{ opacity: 0, y: 30 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ type: 'spring', stiffness: 100, damping: 17 }}
          className="flex w-full min-h-[580px] rounded-2xl overflow-hidden relative"
          style={{
            background: 'rgba(9, 16, 36, 0.88)',
            backdropFilter: 'blur(20px)',
            boxShadow: '0 30px 90px rgba(0,0,0,0.7), 0 0 50px rgba(56, 189, 248, 0.12), 0 0 30px rgba(244, 114, 182, 0.08)',
            border: '1px solid rgba(226, 232, 240, 0.22)',
          }}
        >
          {/* ── LEFT PANEL: Festive Theme with Santa Hat Logo & Winter Copy ── */}
          <motion.div
            layout
            className="relative hidden md:flex flex-col justify-between w-[420px] min-w-[380px] p-8 overflow-hidden"
            style={{
              background: 'linear-gradient(135deg, #0b153b 0%, #101c4d 40%, #0d1740 75%, #08102e 100%)',
              borderRadius: '16px',
              margin: '12px',
              border: '1px solid rgba(255, 255, 255, 0.08)',
            }}
          >
            {/* Top Logo with Cute Santa Hat */}
            <div className="flex items-center relative z-10 pt-1">
              <div className="relative inline-block">
                <SantaHat style={{ top: '-14px', left: '-6px', transform: 'rotate(-10deg)' }} />
                <img
                  src={logoDarkIcon}
                  alt="NetBounce Placement"
                  className="h-12 w-auto object-contain max-w-[240px]"
                />
              </div>
            </div>

            {/* Ambient Festive Floating Orbs inside Left Panel */}
            <div className="absolute inset-0 pointer-events-none overflow-hidden">
              <div
                style={{
                  position: 'absolute',
                  width: '260px',
                  height: '260px',
                  borderRadius: '50%',
                  background: 'radial-gradient(circle at 40% 40%, rgba(14, 165, 233, 0.3), rgba(2, 132, 199, 0.08) 60%, transparent 80%)',
                  top: '12%',
                  right: '-10%',
                  filter: 'blur(4px)',
                }}
              />
              <div
                style={{
                  position: 'absolute',
                  width: '200px',
                  height: '200px',
                  borderRadius: '50%',
                  background: 'radial-gradient(circle at 50% 50%, rgba(244, 114, 182, 0.22), rgba(219, 39, 119, 0.05) 60%, transparent 80%)',
                  bottom: '22%',
                  left: '5%',
                  filter: 'blur(5px)',
                }}
              />
            </div>

            {/* Bottom Tagline with Holiday Sparkle */}
            <div className="relative z-10">
              <div className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[10px] tracking-wider uppercase font-semibold text-sky-200 bg-sky-500/15 border border-sky-400/30 mb-3 shadow-[0_0_12px_rgba(56,189,248,0.2)]">
                <Snowflake className="h-3 w-3 text-sky-300 animate-spin" style={{ animationDuration: '10s' }} />
                <span>Internal Platform • Holiday 2026</span>
              </div>
              <h2 className="text-white text-[28px] font-bold leading-tight">
                Managing Every<br />Candidate, End to End.
              </h2>
              <p className="text-slate-400 text-xs mt-2 flex items-center gap-1.5">
                <Sparkles className="h-3.5 w-3.5 text-amber-300" /> Season of High Performance & Milestones
              </p>
            </div>
          </motion.div>

          {/* ── RIGHT PANEL: Clean, High-Contrast Auth Form ── */}
          <motion.div
            layout
            className="flex-1 flex flex-col justify-center px-8 md:px-12 py-10 max-h-[90vh] overflow-y-auto"
            style={{ scrollbarWidth: 'thin' }}
          >
            {/* Logo + Header */}
            <div className="flex flex-col items-center mb-7">
              <div className="flex items-center mb-4 relative">
                <SantaHat style={{ top: '-13px', left: '-5px', transform: 'rotate(-10deg)' }} />
                <img
                  src={logoDarkIcon}
                  alt="NetBounce Placement"
                  className="h-12 w-auto object-contain max-w-[250px]"
                  style={{ filter: 'drop-shadow(0 0 14px rgba(56,189,248,0.3))' }}
                />
              </div>
              <h1 className="text-[22px] font-bold text-white flex items-center gap-2">
                Sign in to your account
              </h1>
              <p className="text-[#8e9fb5] text-sm mt-1">
                Track candidates, closures, and your team pipeline.
              </p>
            </div>

            {/* Security banner (if force-logout or alert active) */}
            {securityMessage && (
              <motion.div
                initial={{ opacity: 0, y: -10 }}
                animate={{ opacity: 1, y: 0 }}
                className="mb-5 rounded-lg p-4 flex gap-3"
                style={{
                  background: 'rgba(220, 38, 38, 0.15)',
                  border: '1px solid rgba(220, 38, 38, 0.4)',
                }}
              >
                <ShieldAlert className="h-5 w-5 mt-0.5 shrink-0" style={{ color: '#f87171' }} />
                <p className="text-sm leading-relaxed" style={{ color: '#fca5a5' }}>
                  {securityMessage}
                </p>
              </motion.div>
            )}

            <form onSubmit={handleSubmit} className="space-y-4">
              {/* Email */}
              <div>
                <Label htmlFor="email" className={labelClassName}>
                  Your email
                </Label>
                <Input
                  id="email"
                  type="email"
                  value={form.email}
                  onChange={e => setForm(f => ({ ...f, email: e.target.value }))}
                  onBlur={e => setForm(f => ({ ...f, email: e.target.value.replace(/['"]/g, '').trim() }))}
                  required
                  placeholder="shashank.m@netbounceplacement.com"
                  className={inputClassName}
                />
              </div>

              {/* Password */}
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
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-[#52637f] hover:text-[#94a3b8] transition-colors"
                    tabIndex={-1}
                  >
                    {showPassword ? <EyeOff size={18} /> : <Eye size={18} />}
                  </button>
                </div>
              </div>

              {/* Submit Button */}
              <Button
                type="submit"
                className="w-full h-11 text-[15px] font-semibold rounded-lg transition-all duration-200 shadow-lg text-white hover:brightness-110 active:scale-[0.99]"
                disabled={loading}
                style={{
                  background: 'linear-gradient(135deg, #1d4ed8 0%, #2563eb 50%, #0284c7 100%)',
                  boxShadow: '0 4px 20px rgba(37,99,235,0.4)',
                }}
              >
                {loading ? 'Please wait...' : 'Sign In'}
              </Button>
            </form>

            {/* Footer notice */}
            <div className="mt-6 text-center space-y-2">
              <p className="text-xs text-[#718299]">
                Authorized Team Members Only
              </p>
              <p className="text-[11px] text-[#475569]">
                Account access is provisioned by CRM Administrator. Public registration is disabled.
              </p>
            </div>
          </motion.div>
        </motion.div>
      </div>

      {/* ── CSS Keyframe Animations for Smoke & Twinkles ── */}
      <style>{`
        .smoke-puff {
          position: absolute;
          width: 14px;
          height: 14px;
          background: rgba(226, 232, 240, 0.7);
          border-radius: 50%;
          filter: blur(4px);
          animation: chimneySmoke 4.2s infinite ease-out;
        }
        .smoke-1 { animation-delay: 0s; }
        .smoke-2 { animation-delay: 1.05s; }
        .smoke-3 { animation-delay: 2.1s; }
        .smoke-4 { animation-delay: 3.15s; }

        @keyframes chimneySmoke {
          0% {
            transform: translate(0, 0) scale(0.6);
            opacity: 0;
          }
          15% {
            opacity: 0.75;
          }
          65% {
            opacity: 0.35;
          }
          100% {
            transform: translate(-36px, -110px) scale(2.8);
            opacity: 0;
            filter: blur(8px);
          }
        }

        @keyframes twinkle {
          0%, 100% { opacity: 0.25; transform: scale(0.8); }
          50% { opacity: 1; transform: scale(1.3); filter: drop-shadow(0 0 6px rgba(255,255,255,0.8)); }
        }
      `}</style>
    </div>
  );
};

export default AuthPage;
