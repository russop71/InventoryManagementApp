import { useState } from 'react';
import { useNavigate } from 'react-router';
import { Input } from '../components/ui/input';
import { Lock, User } from 'lucide-react';
import { toast } from 'sonner';

// Lemon/speech-bubble logo — circle outline + 3 ascending bars + green leaf.
// Dark variant (charcoal) used on yellow background so it stays visible.
function ZestIQLogo({ size = 64 }: { size?: number }) {
  const h = Math.round(size * 1.2);
  return (
    <svg width={size} height={h} viewBox="0 0 100 120" fill="none">
      {/* Lemon circle with speech-bubble tail bottom-left */}
      <path
        d="M 50 16 C 73 16, 91 32, 91 52 C 91 72, 73 88, 50 88 L 28 102 L 18 88 C 9 81, 9 66, 9 52 C 9 32, 27 16, 50 16 Z"
        stroke="#0F172A" strokeWidth="7" fill="none"
        strokeLinejoin="round" strokeLinecap="round"
      />
      {/* 3 ascending bars — short / medium / tall, same baseline */}
      <rect x="23" y="58" width="13" height="20" rx="3" fill="#0F172A" />
      <rect x="40" y="45" width="13" height="33" rx="3" fill="#0F172A" />
      <rect x="57" y="33" width="13" height="45" rx="3" fill="#0F172A" />
      {/* Green leaf top-right */}
      <path d="M 56 20 C 62 4, 88 2, 90 18 C 78 26, 60 24, 56 20 Z" fill="#4CAF50" />
      <path d="M 56 20 C 68 14, 82 10, 90 18" stroke="#3D8B40" strokeWidth="1.5" strokeLinecap="round" fill="none" />
    </svg>
  );
}

export function Login() {
  const navigate = useNavigate();
  const [email, setEmail]         = useState('');
  const [password, setPassword]   = useState('');
  const [isLoading, setIsLoading] = useState(false);

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);
    await new Promise(r => setTimeout(r, 900));
    if (email && password) {
      localStorage.setItem('isAuthenticated', 'true');
      localStorage.setItem('userEmail', email);
      toast.success('Welcome back!');
      navigate('/');
    } else {
      toast.error('Please enter your email and password');
    }
    setIsLoading(false);
  };

  const handleDemoLogin = async () => {
    setIsLoading(true);
    await new Promise(r => setTimeout(r, 700));
    localStorage.setItem('isAuthenticated', 'true');
    localStorage.setItem('userEmail', 'demo@zestiq.com');
    toast.success('Logged in as Demo User');
    navigate('/');
    setIsLoading(false);
  };

  return (
    <div className="min-h-screen flex flex-col" style={{ background: '#F5C10E' }}>

      {/* ── Yellow hero ───────────────────────────────── */}
      <div className="flex flex-col items-center justify-center pt-16 pb-10 px-6">
        <ZestIQLogo size={72} />
        <div className="flex items-baseline mt-5">
          <span className="font-black text-[40px] leading-none tracking-tight" style={{ color: '#0F172A', fontFamily: 'var(--font-sans)' }}>zest</span>
          <span className="font-black text-[40px] leading-none tracking-tight" style={{ color: '#0F172A', fontFamily: 'var(--font-sans)', opacity: 0.45 }}>IQ</span>
        </div>
        <p className="mt-2.5 text-[11px] font-bold uppercase tracking-[0.22em]" style={{ color: 'rgba(15,23,42,0.45)' }}>
          Smarter Kitchens. Better Business.
        </p>
      </div>

      {/* ── White card ────────────────────────────────── */}
      <div className="flex-1 bg-white rounded-t-[32px] px-6 pt-8 pb-10 shadow-2xl">

        <h2 className="text-2xl font-black mb-1" style={{ color: '#0F172A', fontFamily: 'var(--font-sans)' }}>
          Welcome back
        </h2>
        <p className="text-sm text-gray-400 font-medium mb-8">
          Sign in to manage your restaurant inventory
        </p>

        <form onSubmit={handleLogin} className="space-y-4">
          <div>
            <label className="block text-[11px] font-bold text-gray-500 uppercase tracking-wider mb-1.5">Email</label>
            <div className="relative">
              <User className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
              <Input
                type="email"
                placeholder="your@email.com"
                value={email}
                onChange={e => setEmail(e.target.value)}
                required
                className="pl-10 h-12 rounded-xl bg-gray-50 border-gray-200 text-[#0F172A] placeholder:text-gray-400"
              />
            </div>
          </div>

          <div>
            <label className="block text-[11px] font-bold text-gray-500 uppercase tracking-wider mb-1.5">Password</label>
            <div className="relative">
              <Lock className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
              <Input
                type="password"
                placeholder="••••••••"
                value={password}
                onChange={e => setPassword(e.target.value)}
                required
                className="pl-10 h-12 rounded-xl bg-gray-50 border-gray-200 text-[#0F172A]"
              />
            </div>
          </div>

          <div className="flex justify-end">
            <a href="#" className="text-xs font-semibold" style={{ color: '#0F172A' }}>Forgot password?</a>
          </div>

          <button
            type="submit"
            disabled={isLoading}
            className="w-full h-12 rounded-xl text-sm font-black tracking-wide transition-all active:scale-[0.98] disabled:opacity-60"
            style={{ background: '#0F172A', color: '#F5C10E' }}
          >
            {isLoading ? 'Signing in…' : 'Sign In'}
          </button>
        </form>

        <div className="relative my-6">
          <div className="absolute inset-0 flex items-center">
            <div className="w-full border-t border-gray-100" />
          </div>
          <div className="relative flex justify-center">
            <span className="px-4 bg-white text-xs text-gray-400 font-medium">or</span>
          </div>
        </div>

        <button
          type="button"
          onClick={handleDemoLogin}
          disabled={isLoading}
          className="w-full h-12 rounded-xl text-sm font-bold border-2 transition-all active:scale-[0.98] disabled:opacity-60"
          style={{ borderColor: '#F5C10E', color: '#0F172A', background: 'transparent' }}
        >
          Try Demo Account
        </button>

        <p className="text-center text-xs text-gray-400 mt-6">
          {"Don't have an account? "}
          <a href="#" className="font-bold" style={{ color: '#0F172A' }}>Contact Sales</a>
        </p>
      </div>

    </div>
  );
}
