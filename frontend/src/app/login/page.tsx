'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useAuthStore } from '@/shared/auth/authStore';
import { Eye, EyeOff, AlertCircle } from 'lucide-react';

const SGT_LOGO_URL = '/sgt-logo.png';
const NAAC_BADGE_URL = 'https://sgtuniversity.ac.in/assets/images/NAAC-ICON.png';

const slideImages = [
  'https://sgtuniversity.ac.in/assets/images/life-at-sgt/news-and-events/job-seekers2.webp',
  'https://sgtuniversity.ac.in/assets/images/homepage/campus/convocation4.webp',
  'https://sgtuniversity.ac.in/assets/images/homepage/campus/event_9.webp',
  'https://sgtuniversity.ac.in/assets/images/homepage/campus/event_10.webp',
  'https://sgtuniversity.ac.in/assets/images/life-at-sgt/news-and-events/spec-convo1.webp',
  'https://sgtuniversity.ac.in/assets/images/homepage/campus/home-event11.webp',
];

export default function LoginPage() {
  const router = useRouter();
  const { login } = useAuthStore();
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [currentSlide, setCurrentSlide] = useState(0);

  useEffect(() => {
    const interval = setInterval(() => {
      setCurrentSlide((prev) => (prev + 1) % slideImages.length);
    }, 4000);
    return () => clearInterval(interval);
  }, []);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setIsLoading(true);
    try {
      await login(username, password);
      await new Promise(resolve => setTimeout(resolve, 100));
      router.push('/dashboard');
    } catch (err: any) {
      setError(err.response?.data?.message || 'Login failed. Please try again.');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div style={{ minHeight: '100vh', width: '100vw', display: 'flex', overflow: 'hidden' }}>
      <style dangerouslySetInnerHTML={{ __html: `
        .lp-left {
          flex: 2.2;
          position: relative;
          overflow: hidden;
          display: none;
        }
        @media (min-width: 768px) { .lp-left { display: block; } }

        .lp-slide {
          position: absolute;
          inset: 0;
          background-size: cover;
          background-position: center;
          transition: opacity 1.2s ease-in-out;
        }
        .lp-slide::after {
          content: '';
          position: absolute;
          inset: 0;
          background: linear-gradient(
            to bottom,
            rgba(10,20,80,0.40) 0%,
            rgba(10,20,80,0.20) 50%,
            rgba(10,20,80,0.58) 100%
          );
        }

        .lp-overlay {
          position: absolute;
          bottom: 90px;
          left: 0; right: 0;
          z-index: 2;
          text-align: center;
          padding: 0 2.5rem;
          pointer-events: none;
        }
        .lp-title {
          color: #fff;
          font-size: clamp(1.8rem, 3.2vw, 2.8rem);
          font-weight: 800;
          text-shadow: 2px 4px 16px rgba(0,0,0,0.85), 0 1px 4px rgba(0,0,0,0.6);
          -webkit-text-stroke: 0.5px rgba(0,0,0,0.2);
          margin-bottom: 14px;
          line-height: 1.2;
        }
        .lp-subtitle {
          display: inline-block;
          color: #fff;
          font-size: clamp(0.82rem, 1.1vw, 1rem);
          font-weight: 400;
          text-shadow: 1px 2px 8px rgba(0,0,0,0.8);
          background: rgba(0,0,0,0.30);
          backdrop-filter: blur(5px);
          padding: 7px 22px;
          border-radius: 50px;
          line-height: 1.5;
        }

        .lp-dots {
          position: absolute;
          bottom: 32px;
          left: 50%;
          transform: translateX(-50%);
          display: flex;
          gap: 8px;
          z-index: 2;
        }
        .lp-dot {
          width: 10px; height: 10px;
          border-radius: 50%;
          border: none;
          cursor: pointer;
          transition: background-color 0.3s, transform 0.2s;
          padding: 0;
        }
        .lp-dot:hover { transform: scale(1.3); }

        .lp-right {
          flex: 1;
          min-width: 380px;
          display: flex;
          align-items: center;
          justify-content: center;
          background: #eef2f7;
          padding: 1.5rem;
        }
        @media (max-width: 767px) { .lp-right { min-width: 100%; background: #f0f4f8; } }

        .lp-card {
          width: 100%;
          max-width: 372px;
          background: #fff;
          border-radius: 18px;
          padding: 2rem 2.1rem 1.75rem;
          box-shadow:
            0 2px 4px rgba(0,0,0,0.04),
            0 8px 32px rgba(0,0,0,0.09),
            0 1px 6px rgba(0,0,0,0.05);
        }

        .lp-field { margin-bottom: 0.95rem; }
        .lp-label {
          display: block;
          font-size: 0.77rem;
          font-weight: 600;
          color: #3848a8;
          margin-bottom: 5px;
          letter-spacing: 0.01em;
        }
        .lp-input {
          width: 100%;
          padding: 9px 12px;
          border: 1.5px solid #cdd5ed;
          border-radius: 8px;
          font-size: 0.875rem;
          color: #1a237e;
          background: #f7f9ff;
          outline: none;
          transition: border-color 0.18s, box-shadow 0.18s, background 0.18s;
          box-sizing: border-box;
        }
        .lp-input:focus {
          border-color: #3848a8;
          box-shadow: 0 0 0 3px rgba(56,72,168,0.13);
          background: #fff;
        }
        .lp-input::placeholder { color: #aab4d8; }

        .lp-btn {
          width: 100%;
          padding: 11px;
          background: #1e3a8a;
          color: #fff;
          font-size: 0.93rem;
          font-weight: 700;
          border: none;
          border-radius: 10px;
          cursor: pointer;
          margin-top: 6px;
          letter-spacing: 0.03em;
          transition: background 0.2s, transform 0.15s, box-shadow 0.2s;
          box-shadow: 0 4px 14px rgba(30,58,138,0.28);
        }
        .lp-btn:hover:not(:disabled) {
          background: #173075;
          box-shadow: 0 6px 20px rgba(30,58,138,0.36);
          transform: translateY(-1px);
        }
        .lp-btn:active:not(:disabled) { transform: translateY(0); }
        .lp-btn:disabled { background: #93a3c8; cursor: not-allowed; box-shadow: none; }

        @keyframes lp-spin { to { transform: rotate(360deg); } }
      `}} />

      {/* ── LEFT: SGT campus slideshow ── */}
      <div className="lp-left">
        {slideImages.map((src, i) => (
          <div
            key={i}
            className="lp-slide"
            style={{ backgroundImage: `url(${src})`, opacity: currentSlide === i ? 1 : 0 }}
          />
        ))}

        <div className="lp-overlay">
          <p className="lp-title">Welcome to SGT University</p>
          <span className="lp-subtitle">
            Excellence in Education&nbsp;&bull;&nbsp;Innovation in Learning&nbsp;&bull;&nbsp;Future in Making
          </span>
        </div>

        <div className="lp-dots">
          {slideImages.map((_, i) => (
            <button
              key={i}
              className="lp-dot"
              onClick={() => setCurrentSlide(i)}
              style={{ backgroundColor: currentSlide === i ? '#fff' : 'rgba(255,255,255,0.40)' }}
              aria-label={`Slide ${i + 1}`}
            />
          ))}
        </div>
      </div>

      {/* ── RIGHT: Login form ── */}
      <div className="lp-right">
        <div className="lp-card">

          {/* Logo + NAAC badge */}
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 10, marginBottom: 14 }}>
            <img
              src={SGT_LOGO_URL}
              alt="SGT University"
              style={{ height: 66, width: 'auto', objectFit: 'contain' }}
              onError={e => { (e.currentTarget as HTMLImageElement).style.display = 'none'; }}
            />
            <img
              src={NAAC_BADGE_URL}
              alt="NAAC A+"
              style={{ height: 50, width: 'auto', objectFit: 'contain' }}
              onError={e => { (e.currentTarget as HTMLImageElement).style.display = 'none'; }}
            />
          </div>

          {/* Title */}
          <h1 style={{ textAlign: 'center', fontWeight: 800, fontSize: '1.22rem', color: '#1a237e', lineHeight: 1.25, margin: '0 0 5px' }}>
            University Management System
          </h1>
          <p style={{ textAlign: 'center', fontSize: '0.78rem', color: '#5c6bc0', margin: '0 0 18px', lineHeight: 1.5 }}>
            Enter your credentials to access your dashboards
          </p>

          {/* Error */}
          {error && (
            <div style={{ display: 'flex', gap: 8, alignItems: 'flex-start', background: '#fef2f2', border: '1px solid #fca5a5', borderRadius: 8, padding: '9px 12px', marginBottom: 14 }}>
              <AlertCircle style={{ width: 14, height: 14, color: '#dc2626', flexShrink: 0, marginTop: 1 }} />
              <p style={{ margin: 0, fontSize: '0.77rem', color: '#b91c1c' }}>{error}</p>
            </div>
          )}

          {/* Form */}
          <form onSubmit={handleSubmit}>
            <div className="lp-field">
              <label className="lp-label">Email Address or UID *</label>
              <input
                className="lp-input"
                type="text"
                value={username}
                onChange={e => setUsername(e.target.value)}
                placeholder="Enter your email or user ID"
                required
                autoFocus
                disabled={isLoading}
                autoComplete="username"
              />
            </div>

            <div className="lp-field">
              <label className="lp-label">Password *</label>
              <div style={{ position: 'relative' }}>
                <input
                  className="lp-input"
                  type={showPassword ? 'text' : 'password'}
                  value={password}
                  onChange={e => setPassword(e.target.value)}
                  placeholder="Enter your password"
                  required
                  disabled={isLoading}
                  autoComplete="current-password"
                  style={{ paddingRight: 40 }}
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  disabled={isLoading}
                  style={{ position: 'absolute', right: 10, top: '50%', transform: 'translateY(-50%)', background: 'none', border: 'none', cursor: 'pointer', color: '#7986cb', padding: 2, display: 'flex', alignItems: 'center' }}
                  aria-label="Toggle password visibility"
                >
                  {showPassword ? <EyeOff style={{ width: 15, height: 15 }} /> : <Eye style={{ width: 15, height: 15 }} />}
                </button>
              </div>
            </div>

            <button className="lp-btn" type="submit" disabled={isLoading}>
              {isLoading ? (
                <span style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8 }}>
                  <span style={{ width: 15, height: 15, border: '2px solid rgba(255,255,255,0.35)', borderTopColor: '#fff', borderRadius: '50%', display: 'inline-block', animation: 'lp-spin 0.7s linear infinite' }} />
                  Signing in...
                </span>
              ) : 'Sign In'}
            </button>

            <div style={{ textAlign: 'center', marginTop: 14 }}>
              <a
                href="/forgot-password"
                style={{ color: '#1a237e', fontWeight: 700, fontSize: '0.78rem', textDecoration: 'none' }}
                onMouseOver={e => (e.currentTarget.style.textDecoration = 'underline')}
                onMouseOut={e => (e.currentTarget.style.textDecoration = 'none')}
              >
                Forgot password?
              </a>
            </div>
          </form>
        </div>
      </div>
    </div>
  );
}