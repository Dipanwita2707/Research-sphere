'use client';

import React, { useEffect, useRef, useState } from 'react';
import Link from 'next/link';
import PublicNav from '@/shared/components/public/PublicNav';
import Wordmark from '@/shared/components/brand/Wordmark';
import {
  BookOpen,
  Lightbulb,
  BarChart3,
  Users,
  ShieldCheck,
  Workflow,
  FileText,
  Building2,
  ArrowRight,
  CheckCircle,
  Star,
  Globe,
  Zap,
  Award,
  TrendingUp,
  ChevronRight,
  DollarSign,
  Calendar,
  GraduationCap,
  Play,
  Sparkles,
  Lock,
  BrainCircuit,
  Layers,
  LineChart,
  Shield,
  Clock,
  Landmark,
} from 'lucide-react';

/* ─────────────────── DATA ─────────────────── */
const FEATURES = [
  { icon: BookOpen, gradient: 'from-blue-500 to-indigo-600', title: 'Research Management', description: 'Track every paper, chapter, and conference contribution from submission to publication in one intelligent workspace.' },
  { icon: Lightbulb, gradient: 'from-amber-500 to-orange-500', title: 'IPR & Patent Tracking', description: 'File, manage, and monitor intellectual property rights and patent applications with automated workflow routing.' },
  { icon: DollarSign, gradient: 'from-emerald-500 to-teal-600', title: 'Grants Management', description: 'Apply for research grants, track funding status, and manage grant-related workflows end-to-end.' },
  { icon: BarChart3, gradient: 'from-violet-500 to-purple-600', title: 'Advanced Analytics', description: 'Gain insights on publication output, citation trends, IPR filings, and researcher performance across your institution.' },
  { icon: Workflow, gradient: 'from-rose-500 to-pink-600', title: 'Smart Workflow Engine', description: 'Automate review, approval, and assignment workflows with configurable multi-step routing and delegation.' },
  { icon: Users, gradient: 'from-sky-500 to-blue-600', title: 'Collaboration Network', description: 'Connect researchers across departments, track mentor approvals, and build collaborative research teams.' },
  { icon: FileText, gradient: 'from-teal-500 to-cyan-600', title: 'Document Repository', description: 'Centralized storage for all research documents, agreements, patent certificates, and compliance records.' },
  { icon: ShieldCheck, gradient: 'from-slate-600 to-gray-700', title: 'Enterprise Security', description: 'Multi-tenant architecture with strict data isolation, role-based access control, and full audit trails.' },
];

const TESTIMONIALS = [
  { name: 'Dr. Priya Sharma', role: 'Dean of Research', initials: 'PS', color: 'bg-wine', quote: 'ResearchSphere transformed how we manage our research output. What used to take weeks now happens in days. The workflow automation alone saved us 40+ hours per month.', stars: 5 },
  { name: 'Prof. Anil Mehta', role: 'Head, DRD Committee', initials: 'AM', color: 'bg-amber', quote: 'The IPR and patent tracking module is exceptional. Our faculty can file applications in minutes and track progress transparently. The analytics give us real data to present to leadership.', stars: 5 },
  { name: 'Dr. Kavitha Nair', role: 'Research Coordinator', initials: 'KN', color: 'bg-emerald-600', quote: 'Managing grants across 6 departments used to be a nightmare. ResearchSphere centralizes everything. The audit trail feature is invaluable for compliance reporting.', stars: 5 },
];

const HOW_IT_WORKS = [
  { step: '01', title: 'Onboard Your University', desc: 'Superadmins provision your tenant in minutes. Configure departments, schools, and user roles to match your org structure.', icon: Building2 },
  { step: '02', title: 'Activate Your Team', desc: 'Admins provision faculty, staff, and student accounts. Assign roles, permissions, and department hierarchies instantly.', icon: Users },
  { step: '03', title: 'Track & Grow', desc: 'Start filing research, tracking IPR, managing grants, and generating analytics reports from day one.', icon: TrendingUp },
];

const MODULES = [
  { label: 'Research Papers', icon: BookOpen },
  { label: 'Book Chapters', icon: FileText },
  { label: 'Conference Papers', icon: Calendar },
  { label: 'IPR / Patents', icon: Lightbulb },
  { label: 'Grants Management', icon: DollarSign },
  { label: 'DRD Analytics', icon: BarChart3 },
  { label: 'Staff Management', icon: Users },
  { label: 'Student Portal', icon: GraduationCap },
  { label: 'Fee Management', icon: Award },
  { label: 'Bulk Uploads', icon: Zap },
  { label: 'AI Insights', icon: BrainCircuit },
  { label: 'Multi-Tenant SaaS', icon: Layers },
];

const HERO_STAT_BAR = [
  { icon: Landmark, end: 500, suffix: '+', label: 'Universities', color: 'bg-rose-50 text-rose-600' },
  { icon: Users, end: 25, suffix: 'K+', label: 'Researchers', color: 'bg-amber-50 text-amber-600' },
  { icon: FileText, end: 80, suffix: 'K+', label: 'Publications', color: 'bg-violet-50 text-violet-600' },
  { icon: ShieldCheck, end: 120, suffix: 'K+', label: 'Patents Filed', color: 'bg-emerald-50 text-emerald-600' },
];

const TRUST_BADGES = [
  { icon: Shield, label: 'No credit card required' },
  { icon: CheckCircle, label: 'NAAC & UGC ready' },
  { icon: Clock, label: 'Setup in under 2 hours' },
];

const UNIVERSITY_CRESTS = [
  { bg: '#7A1F3D', icon: Landmark },
  { bg: '#1E3A5F', icon: ShieldCheck },
  { bg: '#2B6CA3', icon: Building2 },
  { bg: '#C9A227', icon: Award },
  { bg: '#1B4B43', icon: Landmark },
  { bg: '#2E4057', icon: ShieldCheck },
  { bg: '#B5651D', icon: Building2 },
];

/* Simple laurel-wreath glyph used to flank the "trusted by" row, mirrored via CSS */
function LaurelWreath({ flip = false }: { flip?: boolean }) {
  return (
    <svg
      viewBox="0 0 40 40"
      className="w-8 h-8 text-peach-dark/70"
      style={{ transform: flip ? 'scaleX(-1)' : undefined }}
      fill="none"
      stroke="currentColor"
      strokeWidth="1.4"
    >
      <path d="M36 6C30 10 26 18 26 26c0 4 1.5 7 3 9" strokeLinecap="round" />
      {[0, 1, 2, 3, 4].map((i) => (
        <path
          key={i}
          d={`M${33 - i * 2.2} ${8 + i * 4.2} l-6 -2.4`}
          strokeLinecap="round"
        />
      ))}
    </svg>
  );
}

const PLATFORM_HIGHLIGHTS = [
  { icon: BrainCircuit, title: 'AI-Powered Insights', desc: 'Smart recommendations and automated categorization using machine learning models.' },
  { icon: LineChart, title: 'Real-Time Dashboards', desc: 'Live KPIs, citation metrics, and impact scores across your entire institution.' },
  { icon: Lock, title: 'Zero-Trust Security', desc: 'Granular RBAC, full audit trails, encrypted data storage, and SOC-2 alignment.' },
  { icon: Globe, title: 'Global Compliance', desc: 'Built for universities with international and national accreditation reporting standards.' },
];
/* ─────────────────── FADE-IN ─────────────────── */
function FadeIn({ children, className = '', delay = 0 }: { children: React.ReactNode; className?: string; delay?: number }) {
  const ref = useRef<HTMLDivElement>(null);
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;

    // If already on-screen (common for above-the-fold sections), show immediately.
    const rect = el.getBoundingClientRect();
    const inView = rect.top < window.innerHeight && rect.bottom > 0;
    if (inView) {
      setVisible(true);
      return;
    }

    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) {
          setVisible(true);
          observer.disconnect();
        }
      },
      { threshold: 0.05, rootMargin: '80px 0px' }
    );
    observer.observe(el);

    // Safety net — never leave content stuck invisible
    const fallback = window.setTimeout(() => setVisible(true), 1200);
    return () => {
      observer.disconnect();
      window.clearTimeout(fallback);
    };
  }, []);

  return (
    <div
      ref={ref}
      className={className}
      style={{
        opacity: visible ? 1 : 0,
        transform: visible ? 'translateY(0)' : 'translateY(24px)',
        transition: `opacity 0.6s ease ${delay}ms, transform 0.6s ease ${delay}ms`,
      }}
    >
      {children}
    </div>
  );
}

/* ─────────────────── COUNT-UP (hardcoded targets, scroll-triggered) ─────────────────── */
function CountUp({
  end,
  suffix = '',
  className = 'text-xl sm:text-2xl font-extrabold text-charcoal leading-tight tabular-nums',
  duration = 2000,
  delay = 0,
  formatWithCommas = false,
}: {
  end: number;
  suffix?: string;
  className?: string;
  duration?: number;
  delay?: number;
  formatWithCommas?: boolean;
}) {
  const ref = useRef<HTMLSpanElement>(null);
  const [value, setValue] = useState(0);
  const hasRun = useRef(false);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;

    let raf = 0;
    let startTimer: ReturnType<typeof setTimeout> | null = null;
    let cancelled = false;

    const run = () => {
      if (hasRun.current || cancelled) return;
      hasRun.current = true;

      startTimer = setTimeout(() => {
        const t0 = performance.now();
        const frame = (now: number) => {
          if (cancelled) return;
          const progress = Math.min(1, (now - t0) / duration);
          const eased = 1 - (1 - progress) ** 3;
          setValue(end * eased);
          if (progress < 1) {
            raf = requestAnimationFrame(frame);
          } else {
            setValue(end);
          }
        };
        raf = requestAnimationFrame(frame);
      }, delay);
    };

    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) {
          run();
          observer.disconnect();
        }
      },
      { threshold: 0.2, rootMargin: '0px 0px -40px 0px' }
    );
    observer.observe(el);

    // If already on screen after layout, start without waiting for scroll
    const checkVisible = () => {
      const r = el.getBoundingClientRect();
      if (r.top < window.innerHeight * 0.92 && r.bottom > 40) run();
    };
    const layoutTimer = window.setTimeout(checkVisible, 50);
    // Absolute safety — never leave at 0 forever
    const forceTimer = window.setTimeout(run, 2000);

    return () => {
      cancelled = true;
      hasRun.current = false;
      observer.disconnect();
      window.clearTimeout(layoutTimer);
      window.clearTimeout(forceTimer);
      if (startTimer) clearTimeout(startTimer);
      cancelAnimationFrame(raf);
    };
  }, [end, duration, delay, formatWithCommas]);

  return (
    <span ref={ref} className={className}>
      {formatWithCommas ? Math.round(value).toLocaleString('en-IN') : Math.round(value)}
      {suffix}
    </span>
  );
}

/* ─────────────────── PAGE ─────────────────── */
export default function LandingPage() {
  return (
    <div className="min-h-screen bg-ivory font-sans antialiased">
      <PublicNav />

      {/* ═══════════ HERO ═══════════ */}
      <section className="relative overflow-hidden pt-20 pb-12 sm:pt-28 sm:pb-16 lg:pt-32 lg:pb-20 bg-white">
        <div className="pointer-events-none absolute -top-32 -right-32 w-[500px] h-[500px] rounded-full bg-peach/12 blur-3xl" />

        {/* Full-bleed hero — text padded left, photo fills the right edge */}
        <div className="relative w-full">
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 lg:gap-0 items-center">

            {/* Left — text */}
            <div className="lg:col-span-4 space-y-6 lg:space-y-7 px-5 sm:px-8 lg:pl-10 xl:pl-14 2xl:pl-20 lg:pr-4">
              <div className="inline-flex items-center gap-2 bg-white border border-wine/15 text-wine text-xs font-bold px-4 py-2 rounded-full shadow-sm">
                <Zap className="h-3.5 w-3.5 fill-wine" />
                Enterprise Research Management · SaaS Platform
              </div>

              <h1 className="text-4xl sm:text-5xl lg:text-[3.4rem] xl:text-[4rem] 2xl:text-[4.5rem] font-extrabold text-charcoal tracking-tight leading-[1.08]">
                Where Ideas
                <br />
                <span className="text-wine">Become</span>{' '}
                <span className="text-amber">Impact</span>
              </h1>

              <p className="text-base sm:text-lg xl:text-xl text-charcoal/55 max-w-md leading-relaxed">
                ResearchSphere empowers universities to manage research, patents, grants, and publications — all in one unified, intelligent platform built for academic excellence.
              </p>

              <div className="flex flex-col sm:flex-row gap-3 sm:gap-4 pt-1">
                <Link
                  href="/pricing"
                  className="group inline-flex items-center justify-center gap-2.5 px-7 py-3.5 xl:px-8 xl:py-4 bg-wine text-white text-sm sm:text-base font-bold rounded-2xl hover:bg-wine-dark transition-all duration-200 shadow-lg shadow-wine/20 hover:shadow-xl hover:shadow-wine/30 hover:-translate-y-0.5"
                >
                  View Plans & Pricing
                  <ArrowRight className="h-5 w-5 group-hover:translate-x-1 transition-transform" />
                </Link>
                <Link
                  href="/login"
                  className="inline-flex items-center justify-center gap-2.5 px-7 py-3.5 xl:px-8 xl:py-4 bg-white text-charcoal text-sm sm:text-base font-bold rounded-2xl border border-gray-200 hover:bg-blush hover:border-wine/25 transition-all duration-200 hover:-translate-y-0.5 hover:shadow-md"
                >
                  Sign In to Platform
                </Link>
              </div>

              <div className="flex flex-wrap items-center gap-x-5 gap-y-2 pt-1">
                {TRUST_BADGES.map(({ icon: Icon, label }) => (
                  <div key={label} className="inline-flex items-center gap-1.5 text-sm text-charcoal/45">
                    <Icon className="h-4 w-4 text-emerald-500 flex-shrink-0" />
                    {label}
                  </div>
                ))}
              </div>
            </div>

            {/* Right — large borderless photo filling to the right edge */}
            <div className="lg:col-span-8 relative px-5 sm:px-8 lg:px-0">
              <div className="relative w-full min-h-[320px] sm:min-h-[400px] lg:min-h-[520px] xl:min-h-[600px] 2xl:min-h-[680px]">
                <img
                  src="/images/hero-researcher.png"
                  alt="Researcher using ResearchSphere"
                  className="absolute inset-0 w-full h-full object-cover object-[center_28%]"
                />
                {/* Soft white fades — no card border */}
                <div className="pointer-events-none absolute inset-y-0 left-0 w-16 sm:w-24 lg:w-32 bg-gradient-to-r from-white via-white/75 to-transparent" />
                <div className="pointer-events-none absolute inset-x-0 top-0 h-10 sm:h-14 bg-gradient-to-b from-white via-white/50 to-transparent" />
                <div className="pointer-events-none absolute inset-x-0 bottom-0 h-10 sm:h-14 bg-gradient-to-t from-white via-white/50 to-transparent" />
              </div>
            </div>

          </div>

          {/* Stat bar + trusted — always visible (no fade gate) */}
          <div className="px-5 sm:px-8 lg:px-12 xl:px-16">
            <div className="mt-10 sm:mt-12">
              <div className="bg-white rounded-3xl border border-gray-100 shadow-sm px-6 sm:px-10 py-7 grid grid-cols-2 sm:grid-cols-4 gap-8 sm:divide-x divide-gray-100">
                {HERO_STAT_BAR.map(({ icon: Icon, end, suffix, label, color }, i) => (
                  <div key={label} className="flex items-center gap-3 sm:pl-8 sm:first:pl-0">
                    <div className={`w-11 h-11 rounded-2xl ${color} flex items-center justify-center flex-shrink-0`}>
                      <Icon className="h-5 w-5" />
                    </div>
                    <div>
                      <CountUp end={end} suffix={suffix} delay={i * 120} duration={2000} />
                      <div className="text-xs text-charcoal/45 font-medium">{label}</div>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            <div className="mt-10 sm:mt-12 text-center">
              <p className="text-xs font-bold uppercase tracking-widest text-charcoal/35 mb-6">Trusted by Leading Universities</p>
              <div className="flex flex-wrap justify-center items-center gap-6 sm:gap-8">
                <LaurelWreath />
                {UNIVERSITY_CRESTS.map(({ bg, icon: Icon }, i) => (
                  <div
                    key={i}
                    className="w-11 h-11 rounded-full flex items-center justify-center shadow-sm ring-4 ring-white flex-shrink-0"
                    style={{ backgroundColor: bg }}
                  >
                    <Icon className="h-5 w-5 text-white/90" strokeWidth={1.8} />
                  </div>
                ))}
                <LaurelWreath flip />
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* ═══════════ MODULES TICKER ═══════════ */}
      <div className="bg-wine/4 border-y border-wine/10 py-4 overflow-hidden">
        <div className="flex gap-10 whitespace-nowrap" style={{ animation: 'ticker 30s linear infinite' }}>
          {[...MODULES, ...MODULES, ...MODULES].map((m, i) => (
            <div key={i} className="inline-flex items-center gap-2.5 text-sm font-semibold text-wine/60 flex-shrink-0">
              <m.icon className="h-4 w-4" />
              {m.label}
              <span className="text-wine/25 ml-2">◆</span>
            </div>
          ))}
        </div>
      </div>

      {/* ═══════════ PLATFORM HIGHLIGHTS ═══════════ */}
      <section className="py-28 bg-gradient-to-br from-[#4A0F26] via-[#6b1535] to-wine">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          {/* Decorative texture */}
          <div
            className="pointer-events-none absolute left-0 right-0 h-full opacity-[0.04]"
            style={{ backgroundImage: 'radial-gradient(#FDD7BF 1px, transparent 1px)', backgroundSize: '20px 20px' }}
          />
          <FadeIn className="text-center mb-16">
            <div className="inline-flex items-center gap-2 border border-white/15 bg-white/8 text-white/60 text-xs font-semibold px-4 py-2 rounded-full mb-5">
              <Sparkles className="h-3.5 w-3.5 text-amber" />
              Why ResearchSphere
            </div>
            <h2 className="text-4xl sm:text-5xl font-extrabold text-white tracking-tight leading-tight">
              Built Different.
              <br />
              <span className="text-amber">Designed for Excellence.</span>
            </h2>
          </FadeIn>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-5">
            {PLATFORM_HIGHLIGHTS.map(({ icon: Icon, title, desc }, i) => (
              <FadeIn key={title} delay={i * 100}>
                <div className="group relative rounded-3xl border border-white/10 bg-white/8 backdrop-blur-sm p-8 hover:border-white/25 hover:bg-white/12 transition-all duration-300 h-full overflow-hidden">
                  <div className="absolute inset-0 bg-gradient-to-br from-peach/0 to-amber/0 group-hover:from-peach/8 group-hover:to-amber/5 transition-all duration-500 rounded-3xl" />
                  <div className="relative">
                    <div className="w-12 h-12 rounded-2xl bg-white/10 flex items-center justify-center mb-5 group-hover:scale-110 transition-transform">
                      <Icon className="h-6 w-6 text-amber" strokeWidth={1.8} />
                    </div>
                    <h3 className="text-base font-bold text-white mb-2">{title}</h3>
                    <p className="text-sm text-white/50 leading-relaxed">{desc}</p>
                  </div>
                </div>
              </FadeIn>
            ))}
          </div>
        </div>
      </section>

      {/* ═══════════ FEATURES GRID ═══════════ */}
      <section className="py-28 bg-ivory">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <FadeIn className="text-center max-w-2xl mx-auto mb-20">
            <div className="inline-flex items-center gap-2 bg-blush border border-peach text-wine text-xs font-bold px-4 py-2 rounded-full mb-5">
              <Globe className="h-3.5 w-3.5" />
              Everything You Need
            </div>
            <h2 className="text-4xl sm:text-5xl font-extrabold text-charcoal tracking-tight leading-tight mb-4">
              A Complete Research<br />Management Ecosystem
            </h2>
            <p className="text-charcoal/50 text-lg leading-relaxed">
              From first submission to final publication — every step of the research lifecycle managed in one place.
            </p>
          </FadeIn>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-5">
            {FEATURES.map(({ icon: Icon, gradient, title, description }, i) => (
              <FadeIn key={title} delay={i * 60}>
                <div className="group relative bg-white rounded-3xl p-7 border border-gray-100 hover:border-wine/15 shadow-sm hover:shadow-xl hover:shadow-wine/5 transition-all duration-300 hover:-translate-y-1.5 overflow-hidden h-full">
                  <div className="relative">
                    <div className={`inline-flex items-center justify-center w-12 h-12 rounded-2xl bg-gradient-to-br ${gradient} mb-5 shadow-md group-hover:scale-110 transition-transform duration-300`}>
                      <Icon className="h-6 w-6 text-white" strokeWidth={1.8} />
                    </div>
                    <h3 className="text-[15px] font-bold text-charcoal mb-2.5 group-hover:text-wine transition-colors">{title}</h3>
                    <p className="text-sm text-charcoal/50 leading-relaxed">{description}</p>
                  </div>
                </div>
              </FadeIn>
            ))}
          </div>
        </div>
      </section>

      {/* ═══════════ HOW IT WORKS ═══════════ */}
      <section className="py-28 bg-gradient-to-br from-blush to-ivory">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <FadeIn className="text-center max-w-2xl mx-auto mb-20">
            <div className="inline-flex items-center gap-2 bg-white border border-wine/15 text-wine text-xs font-bold px-4 py-2 rounded-full mb-5 shadow-sm">
              <Play className="h-3 w-3 fill-wine" />
              How It Works
            </div>
            <h2 className="text-4xl sm:text-5xl font-extrabold text-charcoal tracking-tight leading-tight mb-4">
              Up & Running in Hours,<br />Not Months
            </h2>
            <p className="text-charcoal/50 text-lg">Get your institution fully onboarded and productive the same day.</p>
          </FadeIn>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-8 relative">
            {/* Connector line (desktop only) */}
            <div className="hidden md:block absolute top-[68px] left-[calc(16.67%+40px)] right-[calc(16.67%+40px)] h-px bg-gradient-to-r from-peach via-wine/20 to-peach" />

            {HOW_IT_WORKS.map(({ step, title, desc, icon: Icon }, i) => (
              <FadeIn key={step} delay={i * 150}>
                <div className="relative bg-white rounded-3xl p-8 border border-white shadow-sm hover:shadow-xl hover:shadow-wine/5 transition-all duration-300 hover:-translate-y-1">
                  {/* Step circle */}
                  <div className="relative z-10 inline-flex items-center justify-center w-14 h-14 bg-wine text-white font-extrabold text-lg rounded-2xl shadow-lg shadow-wine/30 mb-6">
                    {step}
                  </div>
                  <div className="w-12 h-12 bg-blush rounded-2xl flex items-center justify-center mb-5">
                    <Icon className="h-6 w-6 text-wine" />
                  </div>
                  <h3 className="text-xl font-bold text-charcoal mb-3">{title}</h3>
                  <p className="text-charcoal/50 leading-relaxed text-sm">{desc}</p>
                </div>
              </FadeIn>
            ))}
          </div>
        </div>
      </section>

      {/* ═══════════ TESTIMONIALS ═══════════ */}
      <section className="py-28 bg-ivory">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <FadeIn className="text-center max-w-2xl mx-auto mb-20">
            <div className="inline-flex items-center gap-2 bg-amber/10 border border-amber/25 text-amber-700 text-xs font-bold px-4 py-2 rounded-full mb-5">
              <Star className="h-3.5 w-3.5 fill-amber text-amber" />
              Trusted by Academia
            </div>
            <h2 className="text-4xl sm:text-5xl font-extrabold text-charcoal tracking-tight mb-4">What Our Users Say</h2>
            <p className="text-charcoal/50 text-lg">Real experiences from researchers and administrators across India.</p>
          </FadeIn>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            {TESTIMONIALS.map(({ name, role, initials, color, quote, stars }, i) => (
              <FadeIn key={name} delay={i * 120}>
                <div className="bg-white rounded-3xl p-8 border border-gray-100 shadow-sm hover:shadow-xl hover:shadow-wine/5 transition-all duration-300 hover:-translate-y-1 h-full flex flex-col">
                  {/* Stars */}
                  <div className="flex gap-0.5 mb-5">
                    {Array.from({ length: stars }).map((_, j) => (
                      <Star key={j} className="h-4 w-4 fill-amber text-amber" />
                    ))}
                  </div>
                  <blockquote className="text-charcoal/60 text-[15px] leading-relaxed flex-1 mb-6">
                    &ldquo;{quote}&rdquo;
                  </blockquote>
                  <div className="flex items-center gap-3 pt-4 border-t border-gray-50">
                    <div className={`w-10 h-10 rounded-full ${color} text-white flex items-center justify-center font-bold text-sm flex-shrink-0 shadow-sm`}>
                      {initials}
                    </div>
                    <div>
                      <div className="font-bold text-charcoal text-sm">{name}</div>
                      <div className="text-xs text-charcoal/40 mt-0.5">{role}</div>
                    </div>
                  </div>
                </div>
              </FadeIn>
            ))}
          </div>
        </div>
      </section>

      {/* ═══════════ SECURITY & COMPLIANCE BAR ═══════════ */}
      <section className="py-16 bg-white border-y border-gray-100">
        <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 text-center">
          <FadeIn>
            <p className="text-xs font-semibold uppercase tracking-widest text-charcoal/30 mb-10">Enterprise-Grade Security & Compliance</p>
            <div className="flex flex-wrap justify-center gap-8 items-center">
              {[
                { icon: ShieldCheck, label: 'SOC-2 Aligned' },
                { icon: Lock, label: 'AES-256 Encryption' },
                { icon: Globe, label: 'NAAC / UGC Ready' },
                { icon: Award, label: 'NIRF Reporting' },
                { icon: CheckCircle, label: '99.8% Uptime' },
              ].map(({ icon: Icon, label }) => (
                <div key={label} className="flex items-center gap-2.5 text-sm font-semibold text-charcoal/40 hover:text-wine transition-colors">
                  <Icon className="h-5 w-5 text-wine/50" />
                  {label}
                </div>
              ))}
            </div>
          </FadeIn>
        </div>
      </section>

      {/* ═══════════ CTA BANNER ═══════════ */}
      <section className="py-10 px-4 sm:px-8 lg:px-16 bg-ivory">
        <FadeIn>
          <div className="relative rounded-[2.5rem] overflow-hidden bg-gradient-to-br from-[#4A0F26] via-wine to-[#9b2040]">
            {/* Glow blob */}
            <div className="pointer-events-none absolute -top-1/2 right-0 w-[600px] h-[600px] rounded-full bg-amber/15 blur-[100px]" />
            <div className="pointer-events-none absolute -bottom-1/2 left-0 w-[500px] h-[500px] rounded-full bg-peach/10 blur-[80px]" />
            {/* Dot texture */}
            <div
              className="pointer-events-none absolute inset-0 opacity-[0.05]"
              style={{ backgroundImage: 'radial-gradient(#FDD7BF 1.5px, transparent 1.5px)', backgroundSize: '24px 24px' }}
            />

            <div className="relative py-24 px-6 text-center max-w-3xl mx-auto">
              <div className="inline-flex items-center gap-2 border border-white/15 bg-white/8 text-white/60 text-xs font-semibold px-4 py-2 rounded-full mb-8">
                <Zap className="h-3.5 w-3.5 text-amber" />
                Start your free trial today
              </div>
              <h2 className="text-4xl sm:text-5xl lg:text-6xl font-extrabold text-white mb-6 tracking-tight leading-[1.1]">
                Ready to Transform Your<br />
                <span className="text-amber">Research Management?</span>
              </h2>
              <p className="text-white/55 text-lg mb-12 leading-relaxed max-w-xl mx-auto">
                Join leading universities already using ResearchSphere to power their research ecosystems. Set up in under 2 hours.
              </p>
              <div className="flex flex-col sm:flex-row gap-4 justify-center">
                <Link
                  href="/pricing"
                  className="group inline-flex items-center justify-center gap-2.5 px-8 py-4 bg-white text-wine font-extrabold text-base rounded-2xl hover:bg-ivory transition-all duration-200 hover:-translate-y-0.5 shadow-xl hover:shadow-2xl"
                >
                  See Pricing Plans
                  <ChevronRight className="h-5 w-5 group-hover:translate-x-1 transition-transform" />
                </Link>
                <Link
                  href="/login"
                  className="inline-flex items-center justify-center gap-2 px-8 py-4 bg-white/10 border border-white/20 text-white font-semibold text-base rounded-2xl hover:bg-white/20 transition-all duration-200 hover:-translate-y-0.5"
                >
                  Sign In
                </Link>
              </div>
              <p className="mt-8 text-white/30 text-sm">No credit card required · Cancel anytime</p>
            </div>
          </div>
        </FadeIn>
      </section>

      {/* ═══════════ FOOTER ═══════════ */}
      <footer className="border-t border-gray-100 py-14 bg-white">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 flex flex-col sm:flex-row justify-between items-center gap-6">
          <div className="flex items-center gap-3">
            <Wordmark heightClassName="h-8" />
            <span className="text-gray-200">·</span>
            <span className="text-sm text-charcoal/35">© {new Date().getFullYear()} All rights reserved</span>
          </div>
          <div className="flex items-center gap-8">
            <Link href="/" className="text-sm text-charcoal/40 hover:text-wine font-medium transition-colors">Product</Link>
            <Link href="/pricing" className="text-sm text-charcoal/40 hover:text-wine font-medium transition-colors">Pricing</Link>
            <Link href="/contact" className="text-sm text-charcoal/40 hover:text-wine font-medium transition-colors">Contact</Link>
            <Link href="/login" className="text-sm text-charcoal/40 hover:text-wine font-medium transition-colors">Sign In</Link>
          </div>
        </div>
      </footer>

      <style>{`
        @keyframes ticker {
          0% { transform: translateX(0); }
          100% { transform: translateX(-33.333%); }
        }
      `}</style>
    </div>
  );
}
