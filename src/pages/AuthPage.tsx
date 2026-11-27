import React, { useState, useEffect, useRef } from 'react';
import { useAuth, FORCED_LOGOUT_KEY } from '@/contexts/AuthContext';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { motion } from 'framer-motion';
import { toast } from 'sonner';
import logoDarkIcon from '@/assets/logo-dark.png';
import { Eye, EyeOff, ShieldAlert, Sparkles } from 'lucide-react';

/* ─── 1. Multi-Layer Interactive 3D Snowfall Canvas ───────────────────────── */
const ChristmasSnowCanvas: React.FC = () => {
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

    interface Flake {
      x: number;
      y: number;
      radius: number;
      speed: number;
      wind: number;
      swing: number;
      swingSpeed: number;
      alpha: number;
      isSparkle: boolean;
      sparklePhase: number;
    }

    const count = 120;
    const flakes: Flake[] = [];

    for (let i = 0; i < count; i++) {
      const radius = Math.random() * 2.8 + 0.8;
      flakes.push({
        x: Math.random() * window.innerWidth,
        y: Math.random() * window.innerHeight,
        radius: radius,
        speed: (Math.random() * 1.2 + 0.6) * (radius * 0.45 + 0.5),
        wind: (Math.random() - 0.5) * 0.4,
        swing: Math.random() * Math.PI * 2,
        swingSpeed: Math.random() * 0.02 + 0.01,
        alpha: Math.random() * 0.65 + 0.35,
        isSparkle: Math.random() < 0.2,
        sparklePhase: Math.random() * Math.PI * 2,
      });
    }

    const draw = () => {
      ctx.clearRect(0, 0, canvas.width, canvas.height);
      const mouse = mouseRef.current;

      for (let i = 0; i < flakes.length; i++) {
        const f = flakes[i];

        f.swing += f.swingSpeed;
        f.x += f.wind + Math.sin(f.swing) * 0.6;
        f.y += f.speed;

        // Subtle mouse wind swirl interaction
        if (mouse.active) {
          const dx = mouse.x - f.x;
          const dy = mouse.y - f.y;
          const dist = Math.sqrt(dx * dx + dy * dy);
          if (dist < 120) {
            const force = (120 - dist) / 120;
            f.x -= (dx / dist) * force * 1.8;
            f.y += (dy / dist) * force * 1.2;
          }
        }

        // Wrap around boundaries
        if (f.y > canvas.height + 10) {
          f.y = -10;
          f.x = Math.random() * canvas.width;
        }
        if (f.x > canvas.width + 10) f.x = -10;
        if (f.x < -10) f.x = canvas.width + 10;

        ctx.beginPath();
        ctx.arc(f.x, f.y, f.radius, 0, Math.PI * 2);

        if (f.isSparkle) {
          f.sparklePhase += 0.05;
          const sparkleAlpha = (Math.sin(f.sparklePhase) * 0.35 + 0.65) * f.alpha;
          ctx.fillStyle = `rgba(255, 245, 210, ${sparkleAlpha})`;
          ctx.shadowColor = 'rgba(255, 220, 150, 0.8)';
          ctx.shadowBlur = 6;
        } else {
          ctx.fillStyle = `rgba(255, 255, 255, ${f.alpha})`;
          ctx.shadowColor = 'rgba(255, 255, 255, 0.4)';
          ctx.shadowBlur = 2;
        }
        ctx.fill();
        ctx.shadowBlur = 0; // reset
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

  return <canvas ref={canvasRef} className="absolute inset-0 w-full h-full pointer-events-none" style={{ zIndex: 3 }} />;
};

/* ─── 2. Realistic 3D Snowy Winter Cabin (Hut with Chimney Smoke) ─────────── */
const WinterCabinScene: React.FC = () => {
  return (
    <div className="absolute right-3 md:right-12 bottom-6 md:bottom-12 z-[2] pointer-events-none select-none opacity-85 hover:opacity-100 transition-opacity">
      {/* ── Chimney Smoke Animation ── */}
      <div className="relative">
        <div className="absolute -top-16 left-6 flex flex-col items-center">
          <span className="smoke-puff smoke-1" />
          <span className="smoke-puff smoke-2" />
          <span className="smoke-puff smoke-3" />
        </div>

        {/* ── Stylized 3D Cabin SVG ── */}
        <svg width="220" height="180" viewBox="0 0 220 180" fill="none" xmlns="http://www.w3.org/2000/svg" className="drop-shadow-[0_15px_30px_rgba(0,0,0,0.6)]">
          <defs>
            {/* Cabin wall wood gradient */}
            <linearGradient id="cabinWall" x1="0%" y1="0%" x2="100%" y2="100%">
              <stop offset="0%" stopColor="#4a1c12" />
              <stop offset="50%" stopColor="#36140d" />
              <stop offset="100%" stopColor="#220b07" />
            </linearGradient>

            {/* Snow on roof gradient */}
            <linearGradient id="roofSnow" x1="0%" y1="0%" x2="0%" y2="100%">
              <stop offset="0%" stopColor="#ffffff" />
              <stop offset="70%" stopColor="#e8effc" />
              <stop offset="100%" stopColor="#cbd5e1" />
            </linearGradient>

            {/* Warm window glow */}
            <linearGradient id="windowGlow" x1="0%" y1="0%" x2="100%" y2="100%">
              <stop offset="0%" stopColor="#fef08a" />
              <stop offset="100%" stopColor="#f59e0b" />
            </linearGradient>

            {/* Chimney brick */}
            <linearGradient id="chimneyGrad" x1="0%" y1="0%" x2="100%" y2="0%">
              <stop offset="0%" stopColor="#572216" />
              <stop offset="50%" stopColor="#6e2b1c" />
              <stop offset="100%" stopColor="#3d160e" />
            </linearGradient>
          </defs>

          {/* Stone Chimney */}
          <rect x="52" y="32" width="22" height="42" rx="2" fill="url(#chimneyGrad)" />
          {/* Snow cap on chimney */}
          <path d="M48 32 C50 27, 76 27, 78 32 C78 35, 48 35, 48 32 Z" fill="#ffffff" filter="drop-shadow(0 2px 3px rgba(0,0,0,0.2))" />

          {/* Main Cabin Body */}
          <path d="M30 85 L180 85 L175 160 L35 160 Z" fill="url(#cabinWall)" />

          {/* Horizontal Wood Planks Styling */}
          <line x1="32" y1="102" x2="178" y2="102" stroke="#220b07" strokeWidth="1.5" opacity="0.6" />
          <line x1="33" y1="120" x2="177" y2="120" stroke="#220b07" strokeWidth="1.5" opacity="0.6" />
          <line x1="34" y1="138" x2="176" y2="138" stroke="#220b07" strokeWidth="1.5" opacity="0.6" />

          {/* Cabin Door */}
          <rect x="50" y="108" width="28" height="50" rx="3" fill="#2d1009" stroke="#1c0905" strokeWidth="1" />
          <circle cx="72" cy="132" r="2" fill="#fbbf24" />
          {/* Christmas Wreath on Door */}
          <circle cx="64" cy="122" r="7" stroke="#15803d" strokeWidth="3" fill="none" />
          <circle cx="64" cy="115" r="2" fill="#dc2626" />

          {/* Warm Glowing Windows with Cross Bars */}
          {/* Window 1 */}
          <rect x="98" y="104" width="32" height="32" rx="4" fill="url(#windowGlow)" filter="drop-shadow(0 0 14px rgba(251,191,36,0.85))" />
          <line x1="114" y1="104" x2="114" y2="136" stroke="#4a1c12" strokeWidth="2" />
          <line x1="98" y1="120" x2="130" y2="120" stroke="#4a1c12" strokeWidth="2" />

          {/* Window 2 */}
          <rect x="140" y="104" width="26" height="32" rx="4" fill="url(#windowGlow)" filter="drop-shadow(0 0 14px rgba(251,191,36,0.85))" />
          <line x1="153" y1="104" x2="153" y2="136" stroke="#4a1c12" strokeWidth="2" />
          <line x1="140" y1="120" x2="166" y2="120" stroke="#4a1c12" strokeWidth="2" />

          {/* 3D Snow-covered Sloped Roof */}
          <path
            d="M10 88 
               Q105 20 205 88 
               Q190 98 175 92 
               Q150 96 135 90 
               Q105 97 85 91 
               Q55 98 35 90 
               Z"
            fill="url(#roofSnow)"
            filter="drop-shadow(0 6px 10px rgba(0,0,0,0.35))"
          />

          {/* Dripping Icicles under roof */}
          <path d="M42 91 L44 98 L46 91" fill="#e2e8f0" />
          <path d="M78 91 L80 102 L82 91" fill="#e2e8f0" />
          <path d="M125 91 L127 101 L129 91" fill="#e2e8f0" />
          <path d="M162 92 L164 97 L166 92" fill="#e2e8f0" />

          {/* Snowdrift at base of cabin */}
          <path d="M20 168 Q60 152 110 162 Q160 150 205 168 Z" fill="#ffffff" opacity="0.95" />
        </svg>
      </div>

      <style>{`
        .smoke-puff {
          position: absolute;
          width: 22px;
          height: 22px;
          border-radius: 50%;
          background: radial-gradient(circle, rgba(255,255,255,0.7) 0%, rgba(220,230,245,0.3) 60%, transparent 100%);
          filter: blur(4px);
          animation: chimneySmoke 4.2s cubic-bezier(0.2, 0.6, 0.4, 1) infinite;
        }
        .smoke-1 { animation-delay: 0s; }
        .smoke-2 { animation-delay: 1.4s; }
        .smoke-3 { animation-delay: 2.8s; }

        @keyframes chimneySmoke {
          0% {
            transform: translate(0, 0) scale(0.6);
            opacity: 0;
          }
          20% {
            opacity: 0.75;
          }
          60% {
            transform: translate(-14px, -45px) scale(1.6);
            opacity: 0.45;
          }
          100% {
            transform: translate(-30px, -90px) scale(2.6);
            opacity: 0;
          }
        }
      `}</style>
    </div>
  );
};

/* ─── 3. Snow-Dusted Christmas Pine Trees (with Soft Ambient Glow) ────────── */
const ChristmasPineTrees: React.FC = () => {
  return (
    <div className="absolute inset-0 pointer-events-none select-none overflow-hidden z-[1]">
      {/* Left Far Trees (Subtle pink-green glow) */}
      <div className="absolute -left-6 bottom-4 md:bottom-8 opacity-75">
        <svg width="240" height="260" viewBox="0 0 240 260" fill="none">
          {/* Tree 1 (Large Pine) */}
          <g filter="drop-shadow(0 10px 20px rgba(0,0,0,0.5))">
            {/* Trunk */}
            <rect x="72" y="190" width="16" height="40" fill="#2d150b" />
            {/* Bottom tier */}
            <polygon points="80,110 20,195 140,195" fill="#0d4a22" />
            <path d="M20 195 Q80 180 140 195 Q110 185 80 185 Q50 185 20 195 Z" fill="#ffffff" />
            {/* Middle tier */}
            <polygon points="80,70 35,140 125,140" fill="#145a2d" />
            <path d="M35 140 Q80 128 125 140 Q105 130 80 130 Q55 130 35 140 Z" fill="#ffffff" />
            {/* Top tier */}
            <polygon points="80,30 50,85 110,85" fill="#1b6e38" />
            <path d="M50 85 Q80 75 110 85 Q95 78 80 78 Q65 78 50 85 Z" fill="#ffffff" />
            {/* Golden Star topper */}
            <circle cx="80" cy="28" r="5" fill="#fbbf24" filter="drop-shadow(0 0 8px rgba(251,191,36,0.9))" />
            {/* Colorful fairy lights */}
            <circle cx="65" cy="110" r="3" fill="#f43f5e" className="animate-pulse" />
            <circle cx="95" cy="125" r="3" fill="#38bdf8" className="animate-pulse" style={{ animationDelay: '0.6s' }} />
            <circle cx="70" cy="160" r="3" fill="#fbbf24" className="animate-pulse" style={{ animationDelay: '1.2s' }} />
            <circle cx="105" cy="175" r="3" fill="#ec4899" className="animate-pulse" style={{ animationDelay: '1.8s' }} />
          </g>

          {/* Tree 2 (Smaller accent pine in background) */}
          <g opacity="0.65" transform="translate(100, 45) scale(0.75)">
            <rect x="72" y="190" width="16" height="40" fill="#2d150b" />
            <polygon points="80,110 20,195 140,195" fill="#063817" />
            <path d="M20 195 Q80 180 140 195 Z" fill="#ffffff" />
            <polygon points="80,70 35,140 125,140" fill="#0d4a22" />
            <path d="M35 140 Q80 128 125 140 Z" fill="#ffffff" />
            <polygon points="80,30 50,85 110,85" fill="#145a2d" />
            <path d="M50 85 Q80 75 110 85 Z" fill="#ffffff" />
            <circle cx="80" cy="28" r="4" fill="#fbbf24" filter="drop-shadow(0 0 6px rgba(251,191,36,0.8))" />
          </g>
        </svg>
      </div>

      {/* Right Background Pine Tree next to Cabin */}
      <div className="absolute right-48 md:right-64 bottom-6 md:bottom-10 opacity-70 hidden sm:block">
        <svg width="150" height="190" viewBox="0 0 150 190" fill="none">
          <g filter="drop-shadow(0 8px 16px rgba(0,0,0,0.4))">
            <rect x="68" y="145" width="14" height="35" fill="#2d150b" />
            <polygon points="75,85 25,150 125,150" fill="#0d4a22" />
            <path d="M25 150 Q75 138 125 150 Z" fill="#ffffff" />
            <polygon points="75,50 38,105 112,105" fill="#145a2d" />
            <path d="M38 105 Q75 95 112 105 Z" fill="#ffffff" />
            <polygon points="75,18 50,65 100,65" fill="#1b6e38" />
            <path d="M50 65 Q75 56 100 65 Z" fill="#ffffff" />
            <circle cx="75" cy="16" r="4" fill="#fbbf24" filter="drop-shadow(0 0 6px rgba(251,191,36,0.8))" />
          </g>
        </svg>
      </div>
    </div>
  );
};

/* ─── 4. Hanging Christmas Baubles / Ornaments on Top Corners ──────────────── */
const HangingChristmasOrnaments: React.FC = () => {
  return (
    <div className="absolute top-0 left-0 right-0 pointer-events-none select-none z-[4] flex justify-between px-6 md:px-16 overflow-hidden">
      {/* Left Ornaments Group */}
      <div className="flex gap-4 origin-top animate-gentle-swing">
        {/* Bauble 1 - Gold */}
        <div className="flex flex-col items-center">
          <div className="w-[1.5px] h-12 md:h-20 bg-gradient-to-b from-amber-200/20 to-amber-400" />
          <div className="w-8 h-8 rounded-full bg-gradient-to-br from-amber-200 via-amber-400 to-amber-600 shadow-[0_0_15px_rgba(251,191,36,0.6)] flex items-center justify-center">
            <Sparkles className="w-3.5 h-3.5 text-white/90" />
          </div>
        </div>
        {/* Bauble 2 - Emerald */}
        <div className="flex flex-col items-center -mt-3">
          <div className="w-[1.5px] h-8 md:h-14 bg-gradient-to-b from-emerald-200/20 to-emerald-400" />
          <div className="w-6 h-6 rounded-full bg-gradient-to-br from-emerald-300 via-emerald-500 to-emerald-700 shadow-[0_0_12px_rgba(16,185,129,0.5)]" />
        </div>
      </div>

      {/* Right Ornaments Group */}
      <div className="flex gap-4 origin-top animate-gentle-swing" style={{ animationDelay: '1.5s' }}>
        {/* Bauble 3 - Crimson / Silver */}
        <div className="flex flex-col items-center -mt-2">
          <div className="w-[1.5px] h-10 md:h-16 bg-gradient-to-b from-rose-200/20 to-rose-400" />
          <div className="w-7 h-7 rounded-full bg-gradient-to-br from-rose-300 via-rose-500 to-rose-700 shadow-[0_0_12px_rgba(244,63,94,0.5)]" />
        </div>
        {/* Bauble 4 - Champagne Gold */}
        <div className="flex flex-col items-center">
          <div className="w-[1.5px] h-14 md:h-24 bg-gradient-to-b from-amber-200/20 to-amber-400" />
          <div className="w-9 h-9 rounded-full bg-gradient-to-br from-yellow-200 via-amber-400 to-yellow-600 shadow-[0_0_18px_rgba(251,191,36,0.7)] flex items-center justify-center">
            <div className="w-2 h-2 rounded-full bg-white/70" />
          </div>
        </div>
      </div>

      <style>{`
        @keyframes gentleSwing {
          0%, 100% { transform: rotate(-2.5deg); }
          50% { transform: rotate(2.5deg); }
        }
        .animate-gentle-swing {
          animation: gentleSwing 6s ease-in-out infinite;
        }
      `}</style>
    </div>
  );
};

/* ─── 5. Realistic Frosted Snow Cap on Top of the Login Container ─────────── */
const LoginBoxSnowCap: React.FC = () => {
  return (
    <div className="absolute -top-[14px] left-0 right-0 z-20 pointer-events-none select-none">
      <svg
        viewBox="0 0 960 28"
        preserveAspectRatio="none"
        className="w-full h-[24px] drop-shadow-[0_4px_6px_rgba(0,0,0,0.25)]"
      >
        <defs>
          <linearGradient id="snowCapGrad" x1="0%" y1="0%" x2="0%" y2="100%">
            <stop offset="0%" stopColor="#ffffff" />
            <stop offset="65%" stopColor="#f1f5f9" />
            <stop offset="100%" stopColor="#cbd5e1" />
          </linearGradient>
        </defs>
        {/* Organic curved snowdrifts resting on the card edge */}
        <path
          d="M0,20 
             Q40,4 90,14 
             Q140,2 190,12 
             Q250,5 310,16 
             Q370,3 430,13 
             Q490,4 550,15 
             Q610,2 670,12 
             Q730,6 790,15 
             Q850,2 910,13 
             Q940,5 960,18
             L960,28 L0,28 Z"
          fill="url(#snowCapGrad)"
        />
        {/* Glistening highlight crest */}
        <path
          d="M0,19 Q40,3 90,13 Q140,1 190,11 Q250,4 310,15 Q370,2 430,12 Q490,3 550,14 Q610,1 670,11 Q730,5 790,14 Q850,1 910,12 Q940,4 960,17"
          stroke="#ffffff"
          strokeWidth="1.5"
          fill="none"
          opacity="0.9"
        />
      </svg>
    </div>
  );
};

/* ─── 6. Bottom Ground Snowbanks Layer ─────────────────────────────────────── */
const GroundSnowBanks: React.FC = () => {
  return (
    <div className="absolute bottom-0 left-0 right-0 pointer-events-none select-none z-[2]">
      <svg
        viewBox="0 0 1440 120"
        preserveAspectRatio="none"
        className="w-full h-16 md:h-24 opacity-95 drop-shadow-[0_-5px_15px_rgba(0,0,0,0.3)]"
      >
        <defs>
          <linearGradient id="groundSnowGrad" x1="0%" y1="0%" x2="0%" y2="100%">
            <stop offset="0%" stopColor="#ffffff" />
            <stop offset="40%" stopColor="#f8fafc" />
            <stop offset="100%" stopColor="#e2e8f0" />
          </linearGradient>
        </defs>
        {/* Rolling soft snow hills */}
        <path
          d="M0,60 
             Q280,15 620,55 
             Q960,10 1200,45 
             Q1350,25 1440,50 
             L1440,120 L0,120 Z"
          fill="url(#groundSnowGrad)"
        />
        {/* Secondary foreground hill for depth */}
        <path
          d="M0,85 
             Q400,45 820,80 
             Q1180,50 1440,75 
             L1440,120 L0,120 Z"
          fill="#f1f5f9"
          opacity="0.8"
        />
      </svg>
    </div>
  );
};

/* ─── 6.5. PS5-Style Animated Floating Orbs in Christmas Red (CSS-only) ─────── */
const RedFloatingOrbs: React.FC = () => (
  <div className="absolute inset-0 overflow-hidden pointer-events-none">
    {/* Primary large orb */}
    <div
      style={{
        position: 'absolute',
        width: '280px',
        height: '280px',
        borderRadius: '50%',
        background: 'radial-gradient(circle at 40% 40%, rgba(225, 29, 72, 0.45), rgba(159, 18, 57, 0.15) 60%, transparent 80%)',
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
        background: 'radial-gradient(circle at 50% 50%, rgba(244, 63, 94, 0.35), rgba(190, 18, 60, 0.1) 60%, transparent 80%)',
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
        background: 'radial-gradient(circle at 30% 30%, rgba(251, 113, 133, 0.4), rgba(225, 29, 72, 0.1) 60%, transparent 80%)',
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
        background: 'radial-gradient(circle at 50% 50%, rgba(244, 63, 94, 0.3), transparent 70%)',
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

/* ─── 7. Main AuthPage Component with Modern 3D Christmas Theme ───────────── */
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

  /* ─── Shared 3D Glassmorphic Input Styling ─── */
  const inputClassName = "h-11 bg-white/10 hover:bg-white/[0.14] border border-white/20 rounded-xl text-white placeholder:text-white/40 focus:border-amber-300 focus:ring-2 focus:ring-amber-300/30 backdrop-blur-md transition-all duration-200 shadow-inner";
  const labelClassName = "text-sm font-semibold text-rose-100/90 mb-1.5 block tracking-wide";

  return (
    <div
      className="min-h-screen flex items-center justify-center relative overflow-hidden font-sans"
      style={{
        /* NetBounce Rich Christmas Velvet Red Background (matching netbounceplacement.com) */
        background: 'radial-gradient(ellipse at 50% 30%, #a81124 0%, #7f000e 55%, #490008 100%)',
      }}
    >
      {/* ── Ambient Holiday Lighting Highlights ── */}
      <div className="absolute top-1/4 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[700px] h-[500px] bg-red-500/20 rounded-full blur-[120px] pointer-events-none" />
      <div className="absolute bottom-10 left-10 w-[350px] h-[350px] bg-emerald-500/10 rounded-full blur-[100px] pointer-events-none" />
      <div className="absolute bottom-12 right-16 w-[350px] h-[350px] bg-amber-400/15 rounded-full blur-[90px] pointer-events-none" />

      {/* ── Hanging Christmas Ornaments ── */}
      <HangingChristmasOrnaments />

      {/* ── Continuous 3D Snowfall System ── */}
      <ChristmasSnowCanvas />

      {/* ── Snow-Dusted Pine Trees ── */}
      <ChristmasPineTrees />

      {/* ── Right-Side Cozy Winter Hut with Chimney Smoke ── */}
      <WinterCabinScene />

      {/* ── Bottom Ground Snowbanks ── */}
      <GroundSnowBanks />

      {/* ── Center 3D Frosted Glass Login Container ── */}
      <motion.div
        layout
        initial={{ opacity: 0, y: 35, scale: 0.97 }}
        animate={{ opacity: 1, y: 0, scale: 1 }}
        transition={{ type: 'spring', stiffness: 90, damping: 18 }}
        className="flex w-full max-w-[960px] min-h-[560px] mx-4 rounded-3xl overflow-visible relative z-10 shadow-[0_30px_90px_rgba(0,0,0,0.65)]"
        style={{
          /* 3D Frosted Crystal Glass Layer */
          background: 'rgba(25, 4, 8, 0.65)',
          backdropFilter: 'blur(28px)',
          WebkitBackdropFilter: 'blur(28px)',
          border: '1px solid rgba(255, 255, 255, 0.22)',
          boxShadow: '0 25px 80px rgba(0, 0, 0, 0.6), 0 0 45px rgba(244, 63, 94, 0.15), inset 0 1px 1px rgba(255, 255, 255, 0.25)',
        }}
      >
        {/* ── Realistic Snow Collecting on Top of Login Box ── */}
        <LoginBoxSnowCap />

        {/* ── Inner layout wrapper with rounded corners ── */}
        <div className="flex flex-col md:flex-row w-full rounded-3xl overflow-hidden">
          {/* ── LEFT PANEL: Festive Brand Showcase with Santa Accents ─────── */}
          <motion.div
            layout
            className="relative hidden md:flex flex-col justify-between w-[420px] min-w-[380px] p-8 overflow-hidden"
            style={{
              background: 'linear-gradient(145deg, rgba(160, 15, 32, 0.8) 0%, rgba(90, 5, 15, 0.85) 60%, rgba(45, 2, 8, 0.95) 100%)',
              borderRight: '1px solid rgba(255, 255, 255, 0.12)',
            }}
          >
            {/* Ambient inner glow */}
            <div className="absolute -top-16 -left-16 w-48 h-48 bg-amber-400/20 rounded-full blur-3xl pointer-events-none" />

            {/* Top Logo */}
            <div className="flex items-center relative z-10">
              <div className="relative inline-block">
                <img
                  src={logoDarkIcon}
                  alt="NetBounce Placement"
                  className="h-12 w-auto object-contain max-w-[230px] drop-shadow-[0_2px_12px_rgba(0,0,0,0.4)]"
                />
                {/* Cute festive Santa Hat perched on the logo icon */}
                <span
                  className="absolute -top-3.5 -left-2 text-xl pointer-events-none transform -rotate-12 drop-shadow-md select-none"
                  title="Happy Holidays!"
                >
                  🎅
                </span>
              </div>
            </div>

            {/* PS5-Style Red Floating Orbs */}
            <RedFloatingOrbs />

            {/* Bottom Tagline with festive styling */}
            <div className="relative z-10">
              <div className="flex items-center gap-2 text-amber-300/90 text-[11px] font-bold tracking-[0.25em] uppercase mb-2">
                <span className="w-2 h-2 rounded-full bg-amber-400 animate-ping inline-block" />
                INTERNAL PLATFORM
              </div>
              <h2 className="text-white text-[27px] font-bold leading-tight drop-shadow-md">
                Managing Every<br />
                <span className="text-transparent bg-clip-text bg-gradient-to-r from-amber-200 via-white to-rose-200">
                  Candidate, End to End.
                </span>
              </h2>
              <p className="text-xs text-rose-200/70 mt-2 font-medium">
                Season's greetings & high closing velocity.
              </p>
            </div>
          </motion.div>

          {/* ── RIGHT PANEL: Sleek 3D Glassmorphic Auth Form ─────────────── */}
          <motion.div
            layout
            className="flex-1 flex flex-col justify-center px-8 md:px-12 py-10 max-h-[90vh] overflow-y-auto"
            style={{ scrollbarWidth: 'thin' }}
          >
            {/* Header */}
            <div className="flex flex-col items-center mb-7">
              {/* NetBounce Logo */}
              <div className="flex items-center mb-5">
                <img
                  src={logoDarkIcon}
                  alt="NetBounce Placement"
                  className="h-12 w-auto object-contain max-w-[250px] drop-shadow-[0_2px_14px_rgba(0,0,0,0.5)]"
                />
              </div>

              <h1 className="text-[24px] font-extrabold text-white text-center tracking-tight drop-shadow-sm">
                Sign in to your account
              </h1>
              <p className="text-rose-200/75 text-sm mt-1 text-center font-normal">
                Track candidates, closures, and team pipeline.
              </p>
            </div>

            {/* Security Alert if Admin Force Logged Out */}
            {securityMessage && (
              <motion.div
                initial={{ opacity: 0, y: -10 }}
                animate={{ opacity: 1, y: 0 }}
                className="mb-5 rounded-xl p-4 flex gap-3 backdrop-blur-md"
                style={{
                  background: 'rgba(239, 68, 68, 0.2)',
                  border: '1px solid rgba(248, 113, 113, 0.45)',
                  boxShadow: '0 4px 15px rgba(220, 38, 38, 0.25)',
                }}
              >
                <ShieldAlert className="h-5 w-5 mt-0.5 shrink-0 text-red-300" />
                <p className="text-sm leading-relaxed text-red-100 font-medium">
                  {securityMessage}
                </p>
              </motion.div>
            )}

            {/* Form */}
            <form onSubmit={handleSubmit} className="space-y-4">
              {/* Email */}
              <div>
                <Label htmlFor="email" className={labelClassName}>
                  Work Email
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
                <Label htmlFor="password" className={labelClassName}>
                  Password
                </Label>
                <div className="relative">
                  <Input
                    id="password"
                    type={showPassword ? 'text' : 'password'}
                    value={form.password}
                    onChange={e => setForm(f => ({ ...f, password: e.target.value }))}
                    required
                    placeholder="••••••••"
                    minLength={6}
                    className={`${inputClassName} pr-11`}
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword(p => !p)}
                    className="absolute right-3.5 top-1/2 -translate-y-1/2 text-white/50 hover:text-white transition-colors p-1"
                    tabIndex={-1}
                  >
                    {showPassword ? <EyeOff size={18} /> : <Eye size={18} />}
                  </button>
                </div>
              </div>

              {/* Submit Button with 3D Festive Gradient */}
              <div className="pt-2">
                <Button
                  type="submit"
                  className="w-full h-12 text-[15px] font-bold rounded-xl transition-all duration-300 shadow-xl relative overflow-hidden group cursor-pointer text-white"
                  disabled={loading}
                  style={{
                    background: 'linear-gradient(135deg, #e11d48 0%, #be123c 50%, #9f1239 100%)',
                    boxShadow: '0 8px 25px rgba(225, 29, 72, 0.45), inset 0 1px 1px rgba(255, 255, 255, 0.35)',
                    border: '1px solid rgba(255, 255, 255, 0.25)',
                  }}
                >
                  <span className="relative z-10 flex items-center justify-center gap-2">
                    {loading ? (
                      'Authenticating...'
                    ) : (
                      <>
                        Sign In <Sparkles className="w-4 h-4 text-amber-200" />
                      </>
                    )}
                  </span>
                  {/* Button hover shimmer */}
                  <div className="absolute inset-0 -translate-x-full group-hover:translate-x-full transition-transform duration-700 bg-gradient-to-r from-transparent via-white/20 to-transparent pointer-events-none" />
                </Button>
              </div>
            </form>

            {/* Footer notice */}
            <div className="mt-7 text-center space-y-1.5">
              <p className="text-xs font-semibold text-rose-200/80">
                🔒 Authorized Team Members Only
              </p>
              <p className="text-[11px] text-rose-200/50">
                Account access is managed by CRM Administrator. Public registration is disabled.
              </p>
            </div>
          </motion.div>
        </div>
      </motion.div>
    </div>
  );
};

export default AuthPage;
