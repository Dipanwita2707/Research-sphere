'use client';

import { useQuery } from '@tanstack/react-query';
import { useAuthStore } from '@/shared/auth/authStore';
import { useState, useEffect } from 'react';
import api from '@/shared/api/api';
import { useStaffDashboardSummary } from '@/shared/hooks/useUserContextQueries';
import { useRouter } from 'next/navigation';
import { researchService } from '@/features/research-management/services/research.service';
import { iprService } from '@/features/ipr-management/services/ipr.service';

interface AdminOverview {
  university: { name?: string; schools: { total: number; active: number }; departments: { total: number; active: number }; programmes: { total: number }; };
  users: { employees: { total: number; active: number }; students: { total: number; active: number }; };
  ipr: { total: number; approved: number; pending: number };
  research: { total: number; approved: number };
  grants: { total: number; approved: number; totalFunding: number };
  collaborations: { total: number };
}

export default function ModernStaffDashboard() {
  const { user } = useAuthStore();
  const router = useRouter();
  const isAdmin = user?.userType === 'admin' || user?.role?.name === 'admin';
  useStaffDashboardSummary({ enabled: !!user });
  const { data: adminOverview } = useQuery({
    queryKey: ['analytics', 'overview', user?.id ?? 'anonymous'],
    queryFn: async () => {
      const r = await api.get('/analytics/overview');
      return r.data.success ? (r.data.data as AdminOverview) : null;
    },
    enabled: !!user && isAdmin,
    staleTime: 2 * 60 * 1000,
  });

  const [citationsTotal, setCitationsTotal] = useState(0);
  const [publicationsDynamics, setPublicationsDynamics] = useState(0);
  const [approvedGrantsTotal, setApprovedGrantsTotal] = useState('Rs 0');
  const [researchFundingStr, setResearchFundingStr] = useState('Rs 0');
  const [activeProjects, setActiveProjects] = useState(0);
  const [patentsCount, setPatentsCount] = useState(0);
  const [collaborationsCount, setCollaborationsCount] = useState(0);
  const [testimonialIndex, setTestimonialIndex] = useState(0);
  const [featuredProjects, setFeaturedProjects] = useState<any[]>([]);
  const [actualHighlights, setActualHighlights] = useState<any[]>([]);

  const getUserName = () => {
    if (user?.firstName && user?.lastName) return user.firstName + ' ' + user.lastName;
    if (user?.firstName) return user.firstName;
    return user?.username || 'User';
  };

  useEffect(() => {
    async function load() {
      try {
        const [cr, ir] = await Promise.all([
          researchService.getMyContributions({ limit: 100 }).catch(() => null),
          iprService.getMyApplications().catch(() => null),
        ]);
        const contribs: any[] = cr?.data?.contributions || cr?.contributions || [];
        const iprs: any[] = Array.isArray(ir) ? ir : (ir?.data || []);
        const cits = contribs.reduce((s: number, c: any) => s + Number(c.indexingDetails?.citationCount || 0), 0);
        setCitationsTotal(cits);
        const pubs = contribs.filter((c: any) => ['submitted','under_review','resubmitted','approved'].includes(c.status)).length || contribs.length;
        setPublicationsDynamics(pubs);
        const active = contribs.filter((c: any) => ['under_review','submitted','resubmitted','revision_requested'].includes(c.status)).length;
        setActiveProjects(active);
        const cr2 = contribs.filter((c: any) => ['approved','completed'].includes(c.status));
        const ci2 = iprs.filter((a: any) => ['drd_approved','dean_approved','published','completed'].includes(a.status));
        const tot = cr2.reduce((s: number, c: any) => s + (Number(c.incentiveAmount) || 0), 0) + ci2.reduce((s: number, a: any) => s + (Number(a.incentiveAmount) || 0), 0);
        setApprovedGrantsTotal('Rs ' + tot.toLocaleString('en-IN'));
        if (tot > 10000000) setResearchFundingStr('Rs ' + (tot / 10000000).toFixed(2) + ' Cr');
        else if (tot > 100000) setResearchFundingStr('Rs ' + (tot / 100000).toFixed(2) + ' L');
        else setResearchFundingStr('Rs ' + tot.toLocaleString('en-IN'));
        setPatentsCount(iprs.length);
        const aset = new Set<string>();
        const uname = getUserName().toLowerCase();
        contribs.forEach((c: any) => (c.authors || []).forEach((a: any) => { if (a.name && a.name.toLowerCase() !== uname) aset.add(a.name); }));
        setCollaborationsCount(aset.size);

        // Compute actual details
        const getTimestamp = (item: any) => {
          if (item.createdAt) return new Date(item.createdAt).getTime();
          if (item.submittedAt) return new Date(item.submittedAt).getTime();
          return 0;
        };

        const allItems = [
          ...contribs.map((c: any) => ({ ...c, isContribution: true })),
          ...iprs.map((i: any) => ({ ...i, isIPR: true }))
        ].sort((a: any, b: any) => getTimestamp(b) - getTimestamp(a));

        const featured = allItems.slice(0, 2).map((item: any) => {
          let title = item.title || 'Untitled Research';
          let typeLabel = '';
          let statusLabel = item.status || 'Ongoing';
          let meta = '';
          let image = '';

          if (item.isContribution) {
            typeLabel = item.publicationType === 'research_paper' ? 'Research Paper' :
                        item.publicationType === 'book' ? 'Book Publication' :
                        item.publicationType === 'book_chapter' ? 'Book Chapter' :
                        item.publicationType === 'conference_paper' ? 'Conference Paper' :
                        item.publicationType === 'grant_proposal' ? 'Grant Proposal' : 'Research Contribution';
            meta = item.journalName || item.publisherName || item.conferenceName || 'ResearchSphere';
            image = item.publicationType === 'research_paper' ? 'https://images.unsplash.com/photo-1507668077129-56e32842fceb?w=200&h=160&fit=crop' :
                    item.publicationType === 'book' || item.publicationType === 'book_chapter' ? 'https://images.unsplash.com/photo-1497633762265-9d179a990aa6?w=200&h=160&fit=crop' :
                    'https://images.unsplash.com/photo-1516321318423-f06f85e504b3?w=200&h=160&fit=crop';
          } else {
            typeLabel = item.iprType === 'patent' ? 'Patent Filing' :
                        item.iprType === 'copyright' ? 'Copyright Registration' :
                        item.iprType === 'design' ? 'Design Registration' : 'Trademark Filing';
            meta = item.applicationNumber || 'Intellectual Property';
            image = 'https://images.unsplash.com/photo-1457369804613-52c61a468e7d?w=200&h=160&fit=crop';
          }

          statusLabel = statusLabel.replace(/_/g, ' ').replace(/\b\w/g, (char: string) => char.toUpperCase());

          return { title, typeLabel, statusLabel, meta, image };
        });

        setFeaturedProjects(featured);

        const loadedHighlights = allItems.slice(0, 4).map((item: any) => {
          let title = '';
          let dateStr = '';
          let icon = '📄';

          const date = item.createdAt ? new Date(item.createdAt) : new Date();
          const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
          dateStr = `${months[date.getMonth()]} ${date.getFullYear()}`;

          if (item.isContribution) {
            icon = item.publicationType === 'research_paper' ? '📄' :
                   item.publicationType === 'book' || item.publicationType === 'book_chapter' ? '📚' :
                   item.publicationType === 'conference_paper' ? '🎯' : '💰';
            
            const action = item.publicationType === 'research_paper' ? 'Research published' :
                           item.publicationType === 'book' ? 'Book published' :
                           item.publicationType === 'book_chapter' ? 'Book chapter published' :
                           item.publicationType === 'conference_paper' ? 'Conference paper submitted' : 'Grant proposal submitted';
            
            const limit = 40;
            const cleanTitle = item.title.length > limit ? item.title.substring(0, limit) + '...' : item.title;
            title = `${action}: "${cleanTitle}"`;
          } else {
            icon = '💡';
            const action = item.iprType === 'patent' ? 'Patent filed' :
                           item.iprType === 'copyright' ? 'Copyright registered' :
                           item.iprType === 'design' ? 'Design rights filed' : 'Trademark filed';
            
            const limit = 40;
            const cleanTitle = item.title.length > limit ? item.title.substring(0, limit) + '...' : item.title;
            title = `${action}: "${cleanTitle}"`;
          }

          return { icon, title, date: dateStr };
        });

        setActualHighlights(loadedHighlights);

      } catch (e) { console.error(e); }
    }
    load();
  }, [user, adminOverview]);
  const testimonials = [
    { text: 'The R&D portal has simplified our research journey from proposal to publication.', name: 'Dr. Neha Sharma', role: 'Professor, CSE', initials: 'NS' },
    { text: 'Securing research grants and managing projects has never been this easy.', name: 'Dr. Rajat Verma', role: 'Associate Professor, ECE', initials: 'RV' },
    { text: 'The patent filing support and innovation ecosystem is truly outstanding.', name: 'Dr. Priya Menon', role: 'Professor, Biotechnology', initials: 'PM' },
  ];
  const tv = testimonials.slice(testimonialIndex, testimonialIndex + 3);
  const padded = tv.length < 3 ? [...tv, ...testimonials.slice(0, 3 - tv.length)] : tv;
  const getResearchFundingDisplay = () => {
    if (isAdmin && adminOverview?.grants) {
      const tot = adminOverview.grants.totalFunding;
      if (tot > 10000000) return 'Rs ' + (tot / 10000000).toFixed(2) + ' Cr';
      if (tot > 100000) return 'Rs ' + (tot / 100000).toFixed(2) + ' L';
      return 'Rs ' + tot.toLocaleString('en-IN');
    }
    return researchFundingStr !== 'Rs 0' ? researchFundingStr : approvedGrantsTotal;
  };



  const CSS = ":root{--maroon:#7a1730;--maroon-dark:#5e1024;--orange:#e08a3e;--cream:#faf3ea;--text-dark:#2b1d22;--text-gray:#6b6068;--border:#eee0d8;}.rs-body *{box-sizing:border-box;}.rs-body{background:#fff;color:var(--text-dark);font-family:Georgia,serif;min-height:100vh;}.rs-body a{text-decoration:none;color:inherit;}.rs-body ul{list-style:none;margin:0;padding:0;}.rs-hero{display:flex;align-items:center;justify-content:space-between;padding:60px;background:linear-gradient(180deg,#fff 0%,var(--cream) 100%);}.rs-hero-left{max-width:520px;}.rs-badge{display:inline-block;background:#fbe8d6;color:var(--orange);font-family:Arial,sans-serif;font-size:12px;font-weight:700;letter-spacing:1px;padding:6px 16px;border-radius:20px;margin-bottom:20px;}.rs-hero-left h2{font-size:46px;line-height:1.15;color:var(--text-dark);margin-bottom:20px;}.rs-hero-left h2 span{color:var(--maroon);}.rs-hero-left p{font-family:Arial,sans-serif;color:var(--text-gray);font-size:15px;line-height:1.6;margin-bottom:28px;}.rs-hero-btns{display:flex;gap:14px;margin-bottom:36px;}.rs-btn-primary{background:var(--maroon-dark);color:#fff;padding:13px 26px;border-radius:30px;font-family:Arial,sans-serif;font-weight:600;font-size:14px;display:flex;align-items:center;gap:8px;cursor:pointer;border:none;}.rs-btn-secondary{background:#fff;border:1px solid var(--border);color:var(--text-dark);padding:13px 26px;border-radius:30px;font-family:Arial,sans-serif;font-weight:600;font-size:14px;display:flex;align-items:center;gap:8px;cursor:pointer;}.rs-hero-features{display:flex;gap:36px;font-family:Arial,sans-serif;padding:0;margin:0;}.rs-hero-features li{display:flex;align-items:center;gap:10px;}.rs-feat-icon{width:36px;height:36px;border-radius:50%;background:#fbe8d6;display:flex;align-items:center;justify-content:center;font-size:16px;}.rs-hero-features strong{display:block;font-size:14px;}.rs-hero-features span{font-size:12px;color:var(--text-gray);}.rs-globe-wrap{position:relative;width:440px;height:460px;}.rs-globe-wrap svg{width:100%;height:100%;}.rs-globe-caption{position:absolute;bottom:6px;left:50%;transform:translateX(-50%);background:#fff;border:1px solid var(--border);border-radius:30px;padding:8px 18px;display:flex;align-items:center;gap:8px;font-family:Arial,sans-serif;font-size:12px;font-weight:700;color:var(--maroon-dark);box-shadow:0 8px 20px rgba(0,0,0,0.08);white-space:nowrap;}.rs-globe-caption .dot{width:8px;height:8px;border-radius:50%;background:var(--orange);display:inline-block;}.rs-stats-bar{margin:0 60px;background:#fff;border:1px solid var(--border);border-radius:16px;display:flex;justify-content:space-between;padding:26px 20px;box-shadow:0 10px 30px rgba(0,0,0,0.04);position:relative;top:-40px;font-family:Arial,sans-serif;}.rs-stat{display:flex;align-items:center;gap:10px;padding:0 10px;}.rs-stat-icon{width:44px;height:44px;border-radius:50%;background:#fbe8d6;display:flex;align-items:center;justify-content:center;font-size:18px;}.rs-stat strong{display:block;font-size:20px;color:var(--text-dark);}.rs-stat span{font-size:12px;color:var(--text-gray);}.rs-section{padding:10px 60px 50px;}.rs-section-head{display:flex;justify-content:space-between;align-items:center;margin-bottom:22px;}.rs-section-head h3{font-size:22px;position:relative;padding-bottom:8px;}.rs-section-head h3::after{content:'';position:absolute;left:0;bottom:0;width:36px;height:3px;background:var(--maroon);}.rs-section-head a{font-family:Arial,sans-serif;font-size:13px;font-weight:700;color:var(--maroon-dark);}.rs-domains-grid{display:grid;grid-template-columns:repeat(8,1fr);gap:14px;}.rs-domain-card{border:1px solid var(--border);border-radius:12px;padding:22px 10px;text-align:center;font-family:Arial,sans-serif;font-size:13px;font-weight:600;cursor:pointer;transition:box-shadow 0.2s;}.rs-domain-card:hover{box-shadow:0 4px 16px rgba(90,16,36,0.12);}.rs-domain-icon{width:44px;height:44px;border-radius:50%;background:#fbe8d6;color:var(--maroon);display:flex;align-items:center;justify-content:center;margin:0 auto 12px;font-size:18px;}.rs-three-col{display:grid;grid-template-columns:1fr 1fr 0.9fr;gap:24px;align-items:start;}.rs-project-card{display:flex;gap:14px;border-bottom:1px solid var(--border);padding-bottom:16px;margin-bottom:16px;}.rs-project-img{width:100px;height:80px;object-fit:cover;border-radius:8px;flex-shrink:0;}.rs-project-card h4{font-size:15px;margin-bottom:6px;}.rs-tag-green{color:#2f9e44;font-family:Arial,sans-serif;font-size:11px;font-weight:700;}.rs-tag-orange{color:var(--orange);font-family:Arial,sans-serif;font-size:11px;font-weight:700;}.rs-status-pill{background:#eafaf0;color:#2f9e44;font-family:Arial,sans-serif;font-size:10px;font-weight:700;padding:2px 8px;border-radius:10px;margin-left:6px;}.rs-project-meta{font-family:Arial,sans-serif;font-size:12px;color:var(--text-gray);margin-top:4px;}.rs-highlight-item{display:flex;align-items:center;gap:14px;border-bottom:1px solid var(--border);padding:14px 0;font-family:Arial,sans-serif;}.rs-highlight-icon{width:40px;height:40px;border-radius:8px;background:#fbe8d6;color:var(--maroon);display:flex;align-items:center;justify-content:center;flex-shrink:0;font-size:16px;}.rs-highlight-item h5{font-size:14px;margin-bottom:3px;}.rs-hi-date{font-size:12px;color:var(--text-gray);}.rs-highlight-arrow{margin-left:auto;color:var(--text-gray);font-size:18px;}.rs-join-card{background:linear-gradient(160deg,var(--maroon-dark),var(--maroon));color:#fff;border-radius:16px;padding:30px;font-family:Arial,sans-serif;}.rs-join-card h3{font-size:20px;margin-bottom:10px;font-family:Georgia,serif;}.rs-join-card p{font-size:13px;opacity:0.9;margin-bottom:20px;line-height:1.5;}.rs-join-card ul{margin-bottom:26px;padding:0;}.rs-join-card li{display:flex;align-items:center;gap:10px;font-size:13px;padding:8px 0;border-bottom:1px solid rgba(255,255,255,0.15);}.rs-join-btn{background:#fff;color:var(--maroon-dark);padding:12px 22px;border-radius:30px;font-weight:700;font-size:14px;display:inline-flex;align-items:center;gap:8px;cursor:pointer;border:none;}.rs-journey{padding:50px 60px;text-align:center;}.rs-journey h3{font-size:22px;margin-bottom:34px;}.rs-journey-steps{display:flex;justify-content:space-between;position:relative;font-family:Arial,sans-serif;}.rs-journey-steps::before{content:'';position:absolute;top:26px;left:6%;right:6%;height:1px;background:repeating-linear-gradient(90deg,var(--border) 0 6px,transparent 6px 12px);z-index:0;}.rs-step{display:flex;flex-direction:column;align-items:center;gap:10px;z-index:1;flex:1;}.rs-step-circle{width:52px;height:52px;border-radius:50%;border:1px solid var(--border);display:flex;align-items:center;justify-content:center;background:#fff;color:var(--maroon);font-size:18px;}.rs-step strong{font-size:13px;}.rs-step-lbl{font-size:11px;color:var(--text-gray);text-align:center;}.rs-testimonials-wrap{margin:0 60px 50px;background:var(--cream);border-radius:16px;padding:34px 30px;}.rs-testimonials-head{display:flex;align-items:center;gap:14px;margin-bottom:28px;}.rs-quote-mark{font-size:30px;color:var(--maroon);font-family:Georgia,serif;line-height:1;}.rs-testimonials-head h3{font-size:18px;}.rs-testimonials-row{display:flex;align-items:center;gap:10px;}.rs-nav-circle{width:38px;height:38px;border-radius:50%;background:var(--maroon-dark);color:#fff;display:flex;align-items:center;justify-content:center;font-size:16px;flex-shrink:0;cursor:pointer;border:none;}.rs-testimonials-grid{display:grid;grid-template-columns:repeat(3,1fr);gap:30px;flex:1;font-family:Arial,sans-serif;}.rs-testimonial-card p{font-size:13px;color:var(--text-gray);line-height:1.6;margin-bottom:16px;}.rs-testimonial-person{display:flex;align-items:center;gap:10px;}.rs-avatar{width:38px;height:38px;border-radius:50%;background:var(--maroon-dark);color:#fff;display:flex;align-items:center;justify-content:center;font-size:13px;font-weight:700;flex-shrink:0;font-family:Arial,sans-serif;}.rs-testimonial-card strong{display:block;font-size:13px;color:var(--text-dark);}.rs-t-role{font-size:12px;color:var(--text-gray);}.rs-testimonial-dots{display:flex;justify-content:center;gap:6px;margin-top:24px;}.rs-testimonial-dots span{width:6px;height:6px;border-radius:50%;background:var(--border);cursor:pointer;display:inline-block;}.rs-testimonial-dots .rs-active{background:var(--maroon);}.rs-events-grid{display:grid;grid-template-columns:repeat(4,1fr);gap:20px;}.rs-event-card{display:flex;gap:14px;border:1px solid var(--border);border-radius:12px;padding:18px;font-family:Arial,sans-serif;}.rs-event-date{background:var(--maroon-dark);color:#fff;border-radius:8px;text-align:center;padding:8px 10px;min-width:52px;height:fit-content;}.rs-event-date strong{display:block;font-size:20px;}.rs-event-date span{font-size:11px;}.rs-event-card h4{font-size:14px;margin-bottom:8px;}.rs-event-card p{font-size:12px;color:var(--text-gray);margin-bottom:4px;}.rs-footer{background:#241118;color:#d8c9cf;padding:50px 60px 0;font-family:Arial,sans-serif;}.rs-footer-grid{display:grid;grid-template-columns:1.6fr 1fr 1fr 1fr 1.3fr;gap:30px;padding-bottom:40px;border-bottom:1px solid rgba(255,255,255,0.1);}.rs-footer-grid h5{color:#fff;font-size:14px;margin-bottom:16px;}.rs-footer-grid li{font-size:13px;margin-bottom:10px;color:#c8b9c0;cursor:pointer;}.rs-footer-logo{display:flex;align-items:center;gap:10px;margin-bottom:14px;}.rs-footer-logo h1{color:#fff;font-size:20px;}.rs-footer-col p{font-size:13px;line-height:1.6;margin-bottom:16px;}.rs-socials{display:flex;gap:10px;}.rs-socials span{width:32px;height:32px;border-radius:50%;background:rgba(255,255,255,0.08);display:flex;align-items:center;justify-content:center;font-size:13px;cursor:pointer;}.rs-contact-item{display:flex;gap:10px;margin-bottom:14px;font-size:13px;}.rs-bottom-bar{display:flex;justify-content:space-between;padding:18px 0;font-size:12px;color:#b9a7af;}.rs-logo-icon-sm{width:32px;height:32px;border-radius:50%;background:radial-gradient(circle,var(--maroon) 40%,var(--orange) 100%);flex-shrink:0;}@keyframes pulseRing{0%{stroke-opacity:0.6;}100%{stroke-opacity:0;}}.rs-globe-node-ring{fill:none;stroke:#e08a3e;stroke-width:1.5;stroke-opacity:0.5;animation:pulseRing 2.4s ease-out infinite;}.rs-hero-image-wrap{position:relative;width:480px;height:420px;display:flex;align-items:center;justify-content:center;flex-shrink:0;}" +
    "@media (max-width:1024px){.rs-hero{padding:32px 24px;flex-wrap:wrap;gap:24px;}.rs-hero-left{max-width:100%;}.rs-hero-left h2{font-size:32px;}.rs-hero-image-wrap{width:340px;height:300px;}.rs-stats-bar{margin:0 24px;flex-wrap:wrap;gap:16px;padding:20px 16px;top:-20px;}.rs-stat{flex:1 1 28%;}.rs-section{padding:10px 24px 40px;}.rs-domains-grid{grid-template-columns:repeat(4,1fr);gap:10px;}.rs-three-col{grid-template-columns:1fr 1fr;gap:20px;}.rs-three-col>div:nth-child(3){grid-column:1/-1;}.rs-journey{padding:40px 24px;}.rs-journey-steps{flex-wrap:wrap;gap:24px;justify-content:center;}.rs-journey-steps::before{display:none;}.rs-step{flex:1 1 28%;}.rs-testimonials-wrap{margin:0 24px 40px;padding:24px 20px;}.rs-testimonials-grid{grid-template-columns:repeat(2,1fr);gap:20px;}.rs-events-grid{grid-template-columns:repeat(2,1fr);gap:16px;}.rs-footer{padding:40px 24px 0;}.rs-footer-grid{grid-template-columns:repeat(2,1fr);gap:24px;}.rs-footer-grid>div:first-child{grid-column:1/-1;}}" +
    "@media (max-width:640px){.rs-hero{flex-direction:column;padding:24px 16px;text-align:center;}.rs-hero-left{text-align:center;}.rs-hero-left h2{font-size:26px;}.rs-hero-left p{font-size:14px;}.rs-hero-btns{justify-content:center;flex-wrap:wrap;}.rs-hero-features{flex-wrap:wrap;justify-content:center;gap:18px;}.rs-hero-image-wrap{width:100%;max-width:280px;height:260px;}.rs-stats-bar{margin:0 12px;padding:16px 12px;top:-16px;}.rs-stat{flex:1 1 45%;}.rs-section{padding:10px 16px 32px;}.rs-section-head{flex-wrap:wrap;gap:8px;}.rs-domains-grid{grid-template-columns:repeat(2,1fr);gap:10px;}.rs-domain-card{padding:16px 8px;}.rs-three-col{grid-template-columns:1fr;gap:24px;}.rs-three-col>div:nth-child(3){grid-column:auto;}.rs-project-card{flex-direction:column;}.rs-project-img{width:100%;height:140px;}.rs-journey{padding:32px 16px;}.rs-journey-steps{flex-wrap:wrap;gap:20px;}.rs-step{flex:1 1 45%;}.rs-testimonials-wrap{margin:0 12px 32px;padding:20px 14px;}.rs-testimonials-head{flex-wrap:wrap;}.rs-testimonials-row{flex-wrap:wrap;}.rs-testimonials-grid{grid-template-columns:1fr;gap:16px;}.rs-events-grid{grid-template-columns:1fr;gap:14px;}.rs-event-card{flex-direction:column;}.rs-footer{padding:32px 16px 0;}.rs-footer-grid{grid-template-columns:1fr;gap:24px;}.rs-footer-grid>div:first-child{grid-column:auto;}.rs-bottom-bar{flex-direction:column;gap:10px;text-align:center;}}";

  const domainData = [
    ['\u{1F9E0}','Artificial','Intelligence'],
    ['\u2764\uFE0F','Healthcare','& Biomedical'],
    ['\u{1F9BE}','Robotics &','Automation'],
    ['\u{1F6E1}\uFE0F','Cyber','Security'],
    ['\u{1F4C8}','Data','Science'],
    ['\u{1F33F}','Sustainability','& Energy'],
    ['\u{1F9EC}','Biotechnology','& Life Sciences'],
    ['\u{1F532}','Smart Systems','& IoT'],
  ];

  const journeySteps = [
    ['\u{1F4A1}','1','Idea / Proposal','Submission'],
    ['\u{1F465}','2','Department','Review'],
    ['\u{1F3C5}','3','Dean','Approval'],
    ['\u{1F4B0}','4','Funding &','Support'],
    ['\u{1F9EA}','5','Research','Execution'],
    ['\u{1F4C4}','6','Publication','/ Patent'],
    ['\u{1F310}','7','Societal','Impact'],
  ];

  const events = [
    { day:'18', mo:'SEP', title:'Research Symposium 2026', date:'18 - 19 September 2026', loc:'University Auditorium' },
    { day:'25', mo:'SEP', title:'Patent Filing Workshop', date:'25 September 2026', loc:'Innovation Lab' },
    { day:'02', mo:'OCT', title:'Innovation & Startup Summit', date:'02 - 03 October 2026', loc:'University Convention Center' },
    { day:'15', mo:'OCT', title:'Faculty Research Forum', date:'15 October 2026', loc:'Seminar Hall' },
  ];

  const displayPubs = isAdmin && adminOverview?.research ? adminOverview.research.total : publicationsDynamics;
  const displayPats = isAdmin && adminOverview?.ipr ? adminOverview.ipr.total : patentsCount;
  const displayFunding = getResearchFundingDisplay();
  const displayActive = isAdmin && adminOverview?.grants ? adminOverview.grants.approved : activeProjects;
  const displayResearchers = isAdmin && adminOverview?.users?.employees?.total ? adminOverview.users.employees.total : 32;
  const displayCollabs = isAdmin && adminOverview?.collaborations ? adminOverview.collaborations.total : collaborationsCount;

  const stats = [
    { icon: '\u{1F4D6}', val: String(displayPubs), label: 'Publications' },
    { icon: '\u{1F6E1}\uFE0F', val: String(displayPats), label: 'Patents Filed' },
    { icon: '\u{1FA99}', val: displayFunding, label: 'Research Funding' },
    { icon: '\u{1F4BC}', val: String(displayActive), label: 'Active Projects' },
    { icon: '\u{1F465}', val: String(displayResearchers), label: 'Researchers' },
    { icon: '\u{1F91D}', val: String(displayCollabs), label: 'Collaborations' },
  ];

  return (
    <>
      <style>{CSS}</style>
      <div className="rs-body">
        <section className="rs-hero">
          <div className="rs-hero-left">
            <span className="rs-badge">
              RESEARCH &amp; DEVELOPMENT PORTAL
            </span>
            <h2>Where Ideas<br />Become <span>Impact</span></h2>
            <p>ResearchSphere empowers researchers, faculty and scholars to collaborate, innovate and transform ideas into meaningful solutions for a better tomorrow.</p>
            <div className="rs-hero-btns">
              <button className="rs-btn-primary" onClick={() => router.push('/research')}><span>&#128302;</span> Explore Research</button>
              <button className="rs-btn-secondary" onClick={() => router.push('/research/apply')}><span>&#128233;</span> Submit Proposal</button>
            </div>
            <ul className="rs-hero-features">
              <li><span className="rs-feat-icon">&#129309;</span><div><strong>Collaborate</strong><span>Beyond Boundaries</span></div></li>
              <li><span className="rs-feat-icon">&#128161;</span><div><strong>Innovate</strong><span>For a Better Future</span></div></li>
              <li><span className="rs-feat-icon">&#127760;</span><div><strong>Impact</strong><span>For Generations</span></div></li>
            </ul>
          </div>
          <div className="rs-hero-image-wrap">
            <img
              src="/dashboard_image.png"
              alt="ResearchSphere Analytics Globe"
              style={{ width: '100%', height: '100%', objectFit: 'contain' }}
            />
          </div>
        </section>

        <div className="rs-stats-bar">
          {stats.map((s, i) => (
            <div key={i} className="rs-stat">
              <span className="rs-stat-icon">{s.icon}</span>
              <div><strong>{s.val}</strong><span>{s.label}</span></div>
            </div>
          ))}
        </div>

        <div className="rs-section" style={{ marginTop: -20 }}>
          <div className="rs-section-head"><h3>Explore Research Domains</h3><a href="/research/search">View All Domains &#8594;</a></div>
          <div className="rs-domains-grid">
            {domainData.map(([icon, l1, l2], i) => (
              <div key={i} className="rs-domain-card" onClick={() => router.push('/research/search')}>
                <div className="rs-domain-icon">{icon}</div>{l1}<br />{l2}
              </div>
            ))}
          </div>
        </div>

        <div className="rs-section">
          <div className="rs-three-col">
            <div>
              <div className="rs-section-head"><h3>Featured Research Projects</h3><a href="/research/my-contributions">View All Projects &#8594;</a></div>
              {featuredProjects.length > 0 ? (
                featuredProjects.map((p, i) => (
                  <div key={i} className="rs-project-card">
                    <img src={p.image} alt="" className="rs-project-img" />
                    <div>
                      <h4>{p.title}</h4>
                      <span className="rs-tag-green">{p.typeLabel}</span>
                      <span className="rs-status-pill">{p.statusLabel}</span>
                      <p className="rs-project-meta">{p.meta}</p>
                    </div>
                  </div>
                ))
              ) : (
                <div className="h-[200px] flex items-center justify-center text-sm text-gray-500 border border-dashed border-[#f0e2d2] rounded-xl bg-white/50">
                  No data available
                </div>
              )}
            </div>
            <div>
              <div className="rs-section-head"><h3>Research Highlights</h3><a href="/research/my-contributions">View All &#8594;</a></div>
              {actualHighlights.length > 0 ? (
                actualHighlights.map((h, i) => (
                  <div key={i} className="rs-highlight-item">
                    <span className="rs-highlight-icon">{h.icon}</span>
                    <div><h5>{h.title}</h5><span className="rs-hi-date">{h.date}</span></div>
                    <span className="rs-highlight-arrow">&#8250;</span>
                  </div>
                ))
              ) : (
                <div className="h-[200px] flex items-center justify-center text-sm text-gray-500 border border-dashed border-[#f0e2d2] rounded-xl bg-white/50">
                  No data available
                </div>
              )}
            </div>
            <div>
              <div className="rs-section-head" style={{ visibility: 'hidden', pointerEvents: 'none' }}>
                <h3>Join The Research Community</h3>
              </div>
              <div className="rs-join-card">
                <h3>Join The Research Community</h3>
                <p>Be a part of a vibrant ecosystem of innovators and changemakers.</p>
                <ul>
                  <li>&#128279; Connect with Experts</li>
                  <li>&#128176; Access Funding Opportunities</li>
                  <li>&#128226; Publish &amp; Showcase Research</li>
                  <li>&#128640; Innovate for Real-world Impact</li>
                </ul>
                <button className="rs-join-btn" onClick={() => router.push('/research/apply')}>Create Account &#8594;</button>
              </div>
            </div>
          </div>
        </div>

        <div className="rs-journey">
          <h3>Your Research Journey</h3>
          <div className="rs-journey-steps">
            {journeySteps.map(([icon, num, l1, l2], i) => (
              <div key={i} className="rs-step">
                <div className="rs-step-circle">{icon}</div>
                <strong>{num}</strong>
                <span className="rs-step-lbl">{l1}<br />{l2}</span>
              </div>
            ))}
          </div>
        </div>

        <div className="rs-testimonials-wrap">
          <div className="rs-testimonials-head"><span className="rs-quote-mark">&#8220;</span><h3>Voices of Our Research Community</h3></div>
          <div className="rs-testimonials-row">
            <button className="rs-nav-circle" onClick={() => setTestimonialIndex(p => p === 0 ? testimonials.length - 1 : p - 1)}>&#8249;</button>
            <div className="rs-testimonials-grid">
              {padded.map((t, i) => (
                <div key={i} className="rs-testimonial-card">
                  <p>{t.text}</p>
                  <div className="rs-testimonial-person">
                    <div className="rs-avatar">{t.initials}</div>
                    <div><strong>&#8212; {t.name}</strong><div className="rs-t-role">{t.role}</div></div>
                  </div>
                </div>
              ))}
            </div>
            <button className="rs-nav-circle" onClick={() => setTestimonialIndex(p => (p + 1) % testimonials.length)}>&#8250;</button>
          </div>
          <div className="rs-testimonial-dots">
            {testimonials.map((_, i) => <span key={i} className={i === testimonialIndex ? 'rs-active' : ''} onClick={() => setTestimonialIndex(i)} />)}
          </div>
        </div>

        <div className="rs-section">
          <div className="rs-section-head"><h3 style={{ width:'100%', textAlign:'center' }}>Upcoming Events</h3><a href="#">View All Events &#8594;</a></div>
          <div className="rs-events-grid">
            {events.map((e, i) => (
              <div key={i} className="rs-event-card">
                <div className="rs-event-date"><strong>{e.day}</strong><span>{e.mo}</span></div>
                <div><h4>{e.title}</h4><p>&#128197; {e.date}</p><p>&#128205; {e.loc}</p></div>
              </div>
            ))}
              </div>
            </div>

        <footer className="rs-footer">
          <div className="rs-footer-grid">
            <div className="rs-footer-col">
              <div className="rs-footer-logo" style={{ display: 'flex', alignItems: 'center', marginBottom: '14px' }}>
                <img src="/logo.png" alt="ResearchSphere Logo" className="h-10 w-auto object-contain" />
              </div>
              <p>Empowering researchers and creators to push boundaries, drive innovation and shape a better future.</p>
              <div className="rs-socials"><span>in</span><span>X</span><span>&#9654;</span><span>&#128247;</span></div>
            </div>
            <div className="rs-footer-col"><h5>Quick Links</h5><ul>{['Home','About Us','Research Areas','Projects','Publications','Patents'].map(l => <li key={l}>{l}</li>)}</ul></div>
            <div className="rs-footer-col"><h5>Resources</h5><ul>{['Funding Opportunities','Research Guidelines','Policies','Downloads','FAQ'].map(l => <li key={l}>{l}</li>)}</ul></div>
            <div className="rs-footer-col"><h5>Support</h5><ul>{['Help Desk','Contact Us','Feedback','Portal Manual'].map(l => <li key={l}>{l}</li>)}</ul></div>
            <div className="rs-footer-col">
              <h5>Contact Us</h5>
              <div className="rs-contact-item">&#128205; <span>Research &amp; Development Cell<br />University Campus<br />City, State - 000000</span></div>
              <div className="rs-contact-item">&#9993;&#65039; <span>rdcell@university.edu.in</span></div>
              <div className="rs-contact-item">&#128222; <span>+91 12345 67890</span></div>
            </div>
          </div>
          <div className="rs-bottom-bar">
            <span>&#169; 2026 ResearchSphere. All Rights Reserved.</span>
            <span style={{ display:'flex', gap:20 }}><a href="#">Privacy Policy</a><a href="#">Terms of Use</a><a href="#">Sitemap</a></span>
          </div>
        </footer>
      </div>
    </>
  );
}
