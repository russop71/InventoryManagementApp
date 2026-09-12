import { useState } from 'react';
import { Link, useLocation, useNavigate } from 'react-router';
import { Input } from '../components/ui/input';
import { Building, Eye, EyeOff, Lock, Menu, User, X } from 'lucide-react';
import { toast } from 'sonner';
import { useAuth } from '../contexts/AuthContext';
import { apiRequest } from '../utils/api';
import { ZestIQBrand } from '../components/ZestIQBrand';

export function Login() {
  const navigate = useNavigate();
  const location = useLocation();
  const searchParams = new URLSearchParams(location.search);
  const requestedReturnTo = searchParams.get('returnTo');
  const returnTo = requestedReturnTo === '/employee' ? '/employee' : '/app';
  const [name, setName]           = useState('');
  const [companyName, setCompanyName] = useState('');
  const [email, setEmail]         = useState('');
  const [password, setPassword]   = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [isSignup, setIsSignup]   = useState(searchParams.get('mode') === 'signup');
  const [privacyAccepted, setPrivacyAccepted] = useState(false);
  const [termsAccepted, setTermsAccepted] = useState(false);
  const [menuOpen, setMenuOpen] = useState(false);

  const { login, loginDemo, register } = useAuth();

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);
    await new Promise(r => setTimeout(r, 900));
    if (!email || !password) {
      toast.error('Please enter your email and password');
      setIsLoading(false);
      return;
    }

    try {
      if (isSignup) {
        if (!name.trim()) {
          toast.error('Please enter your name');
          setIsLoading(false);
          return;
        }
        if (!companyName.trim()) {
          toast.error('Please enter your company name');
          setIsLoading(false);
          return;
        }
        if (!privacyAccepted || !termsAccepted) {
          toast.error('Accept the Privacy Policy and Terms of Service to create your account.');
          setIsLoading(false);
          return;
        }
        await register(name, companyName, email, password, { privacyAccepted, termsAccepted });
        try {
          await apiRequest<{ sent: boolean }>('/api/send-welcome-email', {
            method: 'POST',
            body: JSON.stringify({ name, email }),
          });
        } catch (emailError) {
          console.error('Failed to send welcome email', emailError);
        }
        toast.success('Account created. Next, add your secure payment details.');
        navigate('/app/payment-method');
      } else {
        await login(email, password);
        toast.success('Welcome back!');
        navigate(returnTo);
      }
    } catch (error) {
      toast.error(error instanceof Error ? error.message : isSignup ? 'Unable to create account' : 'Unable to sign in');
    }
    setIsLoading(false);
  };

  const handleDemoLogin = async () => {
    setIsLoading(true);
    await new Promise(r => setTimeout(r, 700));
    try {
      await loginDemo();
      toast.success('Logged in as Demo User');
      navigate(returnTo);
    } catch (error) {
      toast.error(error instanceof Error && error.name === 'TimeoutError'
        ? 'Demo sign-in took too long. Please try again.'
        : error instanceof Error ? error.message : 'Demo login failed');
    }
    setIsLoading(false);
  };

  return (
    <div className="min-h-screen flex flex-col bg-[#303A43]">

      <div className="flex items-center justify-end px-5 pt-5">
        <button
          type="button"
          onClick={() => setMenuOpen(value => !value)}
          className="flex h-11 w-11 items-center justify-center rounded-full border border-white/15 bg-white/10 shadow-sm backdrop-blur transition-transform active:scale-95"
          aria-label="Open menu"
          aria-expanded={menuOpen}
        >
          {menuOpen ? <X className="h-5 w-5 text-white" /> : <Menu className="h-5 w-5 text-white" />}
        </button>
      </div>

      {/* ── Brand hero ────────────────────────────────── */}
      <div className="flex flex-col items-center justify-center px-6 pb-10 pt-12 sm:pt-16">
        <Link to="/" aria-label="ZestIQ home" className="flex w-full max-w-[560px] items-center justify-center rounded-[2rem] border border-white/10 bg-white/5 px-6 py-9 shadow-[0_20px_50px_rgba(0,0,0,0.18)] backdrop-blur transition hover:border-[#F5D62E]/40 focus:outline-none focus-visible:ring-2 focus-visible:ring-[#F5D62E] sm:px-10 sm:py-12">
          <ZestIQBrand markClassName="h-24 w-24 rounded-none sm:h-28 sm:w-28" wordmarkClassName="text-5xl text-white sm:text-6xl" />
        </Link>
        <p className="mt-4 text-[11px] font-bold uppercase tracking-[0.22em] text-white/45">
          Smarter Kitchens. Better Business.
        </p>
      </div>

      {menuOpen && (
        <div className="px-5 pb-4">
          <div className="rounded-3xl bg-white/95 p-4 shadow-xl ring-1 ring-black/5">
            <p className="text-[10px] font-black uppercase tracking-[0.22em] text-gray-400">Menu</p>
            <div className="mt-3 grid gap-2">
              <button
                type="button"
                onClick={() => {
                  setMenuOpen(false);
                  handleDemoLogin();
                }}
                className="h-11 rounded-2xl border border-[#F5D62E]/30 bg-[#F5D62E]/10 text-sm font-bold text-[#303A43] transition-colors active:scale-[0.99]"
              >
                Try Demo Account
              </button>
              <a
                href="mailto:sales@zestiq.ca?subject=zestIQ%20Sales%20Inquiry"
                className="flex h-11 items-center justify-center rounded-2xl border border-gray-200 bg-white text-sm font-bold text-[#303A43] transition-colors"
                onClick={() => setMenuOpen(false)}
              >
                Contact Sales
              </a>
            </div>
          </div>
        </div>
      )}

      {/* ── White card ────────────────────────────────── */}
      <div className="flex-1 rounded-t-[32px] bg-[#FCFBF7] px-6 pb-10 pt-8 shadow-2xl lg:mx-auto lg:mb-10 lg:w-[min(640px,calc(100%-3rem))] lg:flex-none lg:rounded-[32px] lg:px-10">

        <h2 className="text-2xl font-black mb-1" style={{ color: '#303A43', fontFamily: 'var(--font-sans)' }}>
          {isSignup ? 'Create your account' : 'Welcome back'}
        </h2>
        <p className="text-sm text-gray-400 font-medium mb-8">
          {isSignup ? 'Create your company workspace, then complete secure payment for CEO approval.' : 'Sign in to manage your restaurant inventory'}
        </p>

        <form onSubmit={handleLogin} className="space-y-4">
          {isSignup && (
            <>
              <div>
                <label className="block text-[11px] font-bold text-gray-500 uppercase tracking-wider mb-1.5">Full name</label>
                <div className="relative">
                  <User className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                  <Input
                    type="text"
                    placeholder="Jane Smith"
                    value={name}
                    onChange={e => setName(e.target.value)}
                    required={isSignup}
                    className="pl-10 h-12 rounded-xl bg-gray-50 border-gray-200 text-[#303A43] placeholder:text-gray-400"
                  />
                </div>
              </div>
              <div>
                <label className="block text-[11px] font-bold text-gray-500 uppercase tracking-wider mb-1.5">Company name</label>
                <div className="relative">
                  <Building className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                  <Input
                    type="text"
                    placeholder="Restaurant Group"
                    value={companyName}
                    onChange={e => setCompanyName(e.target.value)}
                    required={isSignup}
                    className="pl-10 h-12 rounded-xl bg-gray-50 border-gray-200 text-[#303A43] placeholder:text-gray-400"
                  />
                </div>
              </div>
            </>
          )}

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
                className="pl-10 h-12 rounded-xl bg-gray-50 border-gray-200 text-[#303A43] placeholder:text-gray-400"
              />
            </div>
          </div>

          <div>
            <label className="block text-[11px] font-bold text-gray-500 uppercase tracking-wider mb-1.5">Password</label>
            <div className="relative">
              <Lock className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
              <Input
                type={showPassword ? 'text' : 'password'}
                placeholder="••••••••"
                value={password}
                onChange={e => setPassword(e.target.value)}
                required
                className="h-12 rounded-xl border-gray-200 bg-gray-50 pl-10 pr-12 text-[#303A43]"
              />
              <button
                type="button"
                onClick={() => setShowPassword(current => !current)}
                aria-label={showPassword ? 'Hide password' : 'Show password'}
                aria-pressed={showPassword}
                className="absolute right-3 top-1/2 grid h-8 w-8 -translate-y-1/2 place-items-center rounded-lg text-gray-500 transition hover:bg-gray-200 hover:text-[#303A43] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#F5D62E]"
              >
                {showPassword ? <EyeOff className="h-5 w-5" /> : <Eye className="h-5 w-5" />}
              </button>
            </div>
          </div>

          {!isSignup && (
            <div className="flex justify-end">
              <button
                type="button"
                className="text-xs font-semibold"
                style={{ color: '#303A43' }}
                onClick={async () => {
                  if (!email.trim()) {
                    toast.error('Enter your email first');
                    return;
                  }
                  try {
                    await apiRequest('/api/v1/auth/recover', {
                      method: 'POST',
                      body: JSON.stringify({ email }),
                    });
                    toast.success('If that email is registered, a secure reset link has been sent.');
                  } catch (error) {
                    toast.error(error instanceof Error ? error.message : 'Unable to send reset link');
                  }
                }}
              >
                Forgot password?
              </button>
            </div>
          )}

          {isSignup && (
            <div className="space-y-3 rounded-xl border border-[#F5D62E]/60 bg-[#FFFBE5] p-4 text-sm text-[#303A43]">
              <label className="flex cursor-pointer items-start gap-3">
                <input type="checkbox" checked={privacyAccepted} onChange={event => setPrivacyAccepted(event.target.checked)} required className="mt-0.5 h-4 w-4 accent-[#303A43]" />
                <span>I have read and accept the <Link to="/privacy" target="_blank" rel="noreferrer" className="font-bold underline underline-offset-4">Privacy Policy</Link>.</span>
              </label>
              <label className="flex cursor-pointer items-start gap-3">
                <input type="checkbox" checked={termsAccepted} onChange={event => setTermsAccepted(event.target.checked)} required className="mt-0.5 h-4 w-4 accent-[#303A43]" />
                <span>I agree to the <Link to="/terms" target="_blank" rel="noreferrer" className="font-bold underline underline-offset-4">Terms of Service</Link> and confirm I can bind the business.</span>
              </label>
            </div>
          )}

          <button
            type="submit"
            disabled={isLoading || (isSignup && (!privacyAccepted || !termsAccepted))}
            className="w-full h-12 rounded-xl text-sm font-black tracking-wide transition-all active:scale-[0.98] disabled:opacity-60"
            style={{ background: '#303A43', color: '#F5D62E' }}
          >
            {isLoading ? (isSignup ? 'Creating account…' : 'Signing in…') : (isSignup ? 'Create Account' : 'Sign In')}
          </button>
          {!isSignup && <button type="button" onClick={() => setIsSignup(true)} className="mt-3 h-12 w-full rounded-xl border-2 border-[#303A43] bg-white text-sm font-black text-[#303A43] transition active:scale-[0.98]">Create your ZestIQ account</button>}
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
          style={{ borderColor: '#F5D62E', color: '#303A43', background: 'transparent' }}
        >
          Try Demo Account
        </button>

        <p className="text-center text-xs text-gray-400 mt-6">
          {isSignup ? 'Already have an account? ' : 'Need help signing in? '}
          <button
            type="button"
            onClick={() => isSignup ? setIsSignup(false) : window.location.assign('mailto:demo@zestiq.ca?subject=ZestIQ%20sign-in%20help')}
            className="font-bold"
            style={{ color: '#303A43' }}
          >
            {isSignup ? 'Sign In' : 'Contact support'}
          </button>
        </p>

        <nav aria-label="Login support links" className="mt-7 flex items-center justify-center gap-6 border-t border-slate-200 pt-5 text-sm font-semibold text-slate-400">
          <Link to="/privacy" className="transition hover:text-[#303A43]">Privacy</Link>
          <Link to="/terms" className="transition hover:text-[#303A43]">Terms</Link>
          <a href="mailto:demo@zestiq.ca?subject=ZestIQ%20support" className="transition hover:text-[#303A43]">Support</a>
        </nav>
      </div>

    </div>
  );
}
