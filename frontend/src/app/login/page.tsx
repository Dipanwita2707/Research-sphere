'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import Wordmark from '@/shared/components/brand/Wordmark';
import { useAuthStore } from '@/shared/auth/authStore';
import {
  AlertCircle,
  BarChart3,
  BookOpenCheck,
  Eye,
  EyeOff,
  Loader2,
  Lock,
  LogIn,
  ShieldCheck,
  User,
  Users,
} from 'lucide-react';
import { BRAND } from '@/shared/config/brand';

const FEATURES = [
  {
    icon: Users,
    title: 'Collaboration Network',
    description: 'Discover co-authors and build your research network worldwide.',
  },
  {
    icon: BarChart3,
    title: 'Analytics & Insights',
    description: 'Track citations, impact metrics, and growth over time.',
  },
  {
    icon: BookOpenCheck,
    title: 'Publication Tracking',
    description: 'Manage papers, grants, and patents in one unified workspace.',
  },
  {
    icon: ShieldCheck,
    title: 'Secure & Compliant',
    description: 'Enterprise-grade security keeps your research data safe.',
  },
];

const STATS = [
  { value: '500+', label: 'Researchers' },
  { value: '1,200+', label: 'Publications' },
  { value: '50+', label: 'Institutions' },
];

export default function LoginPage() {
  const router = useRouter();
  const { login } = useAuthStore();
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [rememberMe, setRememberMe] = useState(true);
  const [error, setError] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [showPassword, setShowPassword] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setIsLoading(true);
    try {
      await login(username, password);
      await new Promise((resolve) => setTimeout(resolve, 100));
      const loggedUser = useAuthStore.getState().user;
      const roleName = loggedUser?.role?.name?.toLowerCase() || loggedUser?.userType?.toLowerCase();
      if (roleName === 'superadmin') {
        router.push('/superadmin/dashboard');
      } else if (roleName === 'admin') {
        router.push('/dashboard');
      } else {
        router.push('/research/my-profile');
      }
    } catch (err: unknown) {
      const message =
        err && typeof err === 'object' && 'response' in err
          ? (err as { response?: { data?: { message?: string } } }).response?.data?.message
          : undefined;
      setError(message || 'Login failed. Please check your credentials and try again.');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="relative flex min-h-screen w-full overflow-hidden bg-blush font-sans">
      <style jsx global>{`
        @keyframes login-blob-float {
          0%, 100% { transform: translate(0, 0) scale(1); }
          33% { transform: translate(24px, -18px) scale(1.06); }
          66% { transform: translate(-16px, 14px) scale(0.96); }
        }
        .login-blob {
          animation: login-blob-float 14s ease-in-out infinite;
        }
        .login-blob-delay {
          animation-delay: -6s;
        }
        .login-input:-webkit-autofill,
        .login-input:-webkit-autofill:hover,
        .login-input:-webkit-autofill:focus {
          -webkit-text-fill-color: #232323;
          -webkit-box-shadow: 0 0 0 1000px #ffffff inset;
          transition: background-color 5000s ease-in-out 0s;
        }
      `}</style>

      {/* ================= LEFT — BRAND PANEL ================= */}
      <div className="relative hidden w-[44%] max-w-[620px] flex-col justify-between overflow-hidden bg-brand-gradient p-12 text-white lg:flex xl:p-16">
        {/* Decorative blurred blobs */}
        <div className="login-blob pointer-events-none absolute -right-24 -top-24 h-96 w-96 rounded-full bg-amber/25 blur-3xl" />
        <div className="login-blob login-blob-delay pointer-events-none absolute -bottom-32 -left-16 h-80 w-80 rounded-full bg-peach/20 blur-3xl" />
        {/* Dot grid texture */}
        <div
          className="pointer-events-none absolute inset-0 opacity-[0.08]"
          style={{
            backgroundImage: 'radial-gradient(#E28B22 1px, transparent 1px)',
            backgroundSize: '18px 18px',
          }}
        />

        {/* Logo */}
        <div className="relative z-10">
          <Wordmark heightClassName="h-14 sm:h-16" className="brightness-0 invert drop-shadow-sm" />
        </div>

        {/* Headline + features */}
        <div className="relative z-10 my-10">
          <h1 className="mb-4 text-[2.5rem] font-bold leading-[1.15] tracking-tight">
            Empowering research.
            <br />
            <span className="text-amber">Amplifying impact.</span>
          </h1>
          <p className="mb-10 max-w-md text-[15px] leading-relaxed text-white/70">
            A unified platform for research management, collaboration and analytics —
            built to help academic teams create impact that matters.
          </p>

          <div className="space-y-5">
            {FEATURES.map(({ icon: Icon, title, description }) => (
              <div key={title} className="flex items-start gap-4">
                <div className="mt-0.5 flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-lg bg-white/10 ring-1 ring-white/15">
                  <Icon size={18} strokeWidth={1.8} className="text-amber" />
                </div>
                <div>
                  <div className="text-[15px] font-semibold text-white">{title}</div>
                  <div className="text-[13.5px] leading-snug text-white/60">{description}</div>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Stats footer */}
        <div className="relative z-10 flex items-center gap-8 border-t border-white/15 pt-6">
          {STATS.map((stat) => (
            <div key={stat.label}>
              <div className="text-xl font-bold text-white">{stat.value}</div>
              <div className="text-[12px] text-white/55">{stat.label}</div>
            </div>
          ))}
        </div>
      </div>

      {/* ================= RIGHT — LOGIN FORM ================= */}
      <div className="relative flex flex-1 items-center justify-center overflow-y-auto p-6 sm:p-10">
        <div
          className="pointer-events-none absolute -right-20 -top-20 h-72 w-72 rounded-full bg-peach/30 blur-3xl lg:hidden"
          aria-hidden="true"
        />

        <div className="relative w-full max-w-[420px]">
          {/* Back link */}
          <div className="mb-6 flex items-center justify-between lg:hidden">
            <Wordmark heightClassName="h-11 sm:h-12" />
            <a href="/" className="text-sm font-semibold text-charcoal/50 hover:text-wine transition-colors flex items-center gap-1">
              ← Home
            </a>
          </div>
          <div className="mb-4 hidden lg:flex justify-end">
            <a href="/" className="text-sm font-semibold text-charcoal/40 hover:text-wine transition-colors flex items-center gap-1">
              ← Back to Home
            </a>
          </div>

          <div className="rounded-3xl border border-black/5 bg-white p-8 shadow-brand-xl sm:p-10">
            <div className="mb-8 hidden justify-center lg:flex">
              <Wordmark heightClassName="h-11 sm:h-12" />
            </div>

            <div className="mb-7 text-center">
              <h2 className="font-serif text-[26px] font-bold text-charcoal">Welcome back</h2>
              <p className="mt-1.5 text-[14.5px] text-charcoal/55">
                Sign in to continue your research journey
              </p>
            </div>

            {error && (
              <div className="mb-5 flex items-start gap-2.5 rounded-xl border border-red-200 bg-red-50 px-3.5 py-3 text-[13.5px] text-red-700">
                <AlertCircle size={16} className="mt-0.5 flex-shrink-0" />
                <span>{error}</span>
              </div>
            )}

            <form onSubmit={handleSubmit} className="space-y-5">
              <div>
                <label htmlFor="login-email" className="mb-1.5 block text-sm font-semibold text-charcoal">
                  Email Address
                </label>
                <div className="relative flex items-center">
                  <User size={18} strokeWidth={1.8} className="pointer-events-none absolute left-4 text-wine" />
                  <input
                    id="login-email"
                    type="text"
                    value={username}
                    onChange={(e) => setUsername(e.target.value)}
                    placeholder="Enter your email address"
                    required
                    autoFocus
                    disabled={isLoading}
                    autoComplete="username"
                    className="login-input w-full rounded-xl border border-black/10 bg-white py-3.5 pl-11 pr-4 text-[14.5px] text-charcoal outline-none transition-colors placeholder:text-charcoal/40 focus:border-wine"
                  />
                </div>
              </div>

              <div>
                <div className="mb-1.5 flex items-center justify-between">
                  <label htmlFor="login-password" className="block text-sm font-semibold text-charcoal">
                    Password
                  </label>
                  <a href="/forgot-password" className="text-[13.5px] font-medium text-wine hover:underline">
                    Forgot Password?
                  </a>
                </div>
                <div className="relative flex items-center">
                  <Lock size={18} strokeWidth={1.8} className="pointer-events-none absolute left-4 text-wine" />
                  <input
                    id="login-password"
                    type={showPassword ? 'text' : 'password'}
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    placeholder="Enter your password"
                    required
                    disabled={isLoading}
                    autoComplete="current-password"
                    className="login-input w-full rounded-xl border border-black/10 bg-white py-3.5 pl-11 pr-11 text-[14.5px] text-charcoal outline-none transition-colors placeholder:text-charcoal/40 focus:border-wine"
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword(!showPassword)}
                    disabled={isLoading}
                    aria-label="Toggle password visibility"
                    className="absolute right-4 flex items-center text-charcoal/40 hover:text-charcoal/70"
                  >
                    {showPassword ? <EyeOff size={18} strokeWidth={1.8} /> : <Eye size={18} strokeWidth={1.8} />}
                  </button>
                </div>
              </div>

              <div className="flex items-center gap-2">
                <input
                  type="checkbox"
                  id="remember"
                  checked={rememberMe}
                  onChange={(e) => setRememberMe(e.target.checked)}
                  className="h-4 w-4 rounded accent-wine"
                />
                <label htmlFor="remember" className="text-[14px] text-charcoal/80">
                  Remember me
                </label>
              </div>

              <button
                type="submit"
                disabled={isLoading}
                className="flex w-full items-center justify-center gap-2 rounded-xl bg-wine py-3.5 text-[15px] font-semibold text-white transition-colors hover:bg-wine-dark disabled:cursor-not-allowed disabled:opacity-70"
              >
                {isLoading ? (
                  <>
                    <Loader2 size={17} className="animate-spin" />
                    Signing in...
                  </>
                ) : (
                  <>
                    <LogIn size={17} strokeWidth={2} />
                    Sign In
                  </>
                )}
              </button>
            </form>

            <div className="mt-6 text-center text-[14px] text-charcoal/55">
              Don&apos;t have an account?{' '}
              <a href="/pricing" className="font-semibold text-wine hover:underline">
                View Pricing &rarr;
              </a>
            </div>
          </div>

          <p className="mt-6 text-center text-[12.5px] text-charcoal/40">
            &copy; {new Date().getFullYear()} {BRAND.name}. All rights reserved.
          </p>
        </div>
      </div>
    </div>
  );
}
