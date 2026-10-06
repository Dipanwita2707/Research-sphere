/**
 * Research CV (PDF), ONE A4 page, in the usual research-CV order:
 *   contact & links · research profile · research interests · education · research experience ·
 *   selected publications · presentations · grants, honors & awards · teaching · skills ·
 *   professional memberships · references
 *
 * Data: the visibility-checked research profile (authorProfileService.getProfileForViewer — a
 * viewer who may not open the profile gets the same 403/404), the CV sections the author fills in
 * on their profile (cvDetails), approved grants and filed patents. Publications are a SELECTION
 * (most cited, then most recent) with the totals on one line — not the full list. Sections with
 * nothing to say are left out. References are printed only on the author's / an admin's copy;
 * other viewers see "available on request". Incentive amounts are never printed.
 *
 * One page is guaranteed: the content is measured first and, when it does not fit, the CV shows
 * fewer items and then slightly smaller type; it never adds a second page.
 */
const PDFDocument = require('pdfkit');
const prisma = require('../../../shared/config/database');
const authorProfileService = require('./authorProfile.service');
const { INVENTOR_ROLES } = require('../utils/iprIncentive');

const PAGE = { size: 'A4', margins: { top: 38, bottom: 34, left: 42, right: 42 } };
const COLOR = { accent: '#7D1A34', ink: '#1C1917', muted: '#57534E', rule: '#D6D3D1' };
const IPR_CV_STATUSES = ['govt_application_filed', 'published', 'under_finance_review', 'finance_approved', 'finance_rejected', 'completed'];
const GRANT_CV_STATUSES = ['approved', 'completed'];
const IPR_TYPE_LABEL = { patent: 'Patent', copyright: 'Copyright', trademark: 'Trademark', design: 'Design' };

/** Fitting steps, tried in order until the page fits. */
const FIT_STEPS = [
  { scale: 1, pubs: 6, items: 5 },
  { scale: 1, pubs: 5, items: 4 },
  { scale: 0.95, pubs: 5, items: 4 },
  { scale: 0.92, pubs: 4, items: 3 },
  { scale: 0.88, pubs: 4, items: 3 },
  { scale: 0.85, pubs: 3, items: 2 },
  { scale: 0.82, pubs: 3, items: 2 },
];

/**
 * The built-in PDF fonts cover Latin-1 (WinAnsi). Map typographic punctuation to ASCII and
 * drop the accent from anything else outside it, so names never print as garbage glyphs.
 */
function pdfText(value) {
  if (value === null || value === undefined) return '';
  return String(value)
    .replace(/[‘’‛′]/g, "'")
    .replace(/[“”‟″]/g, '"')
    .replace(/[‐-―−]/g, '-')
    .replace(/…/g, '...')
    .replace(/[  -​ ]/g, ' ')
    .replace(/[^\u0000-ÿ]/g, (ch) => ch.normalize('NFKD').replace(/[^\u0000-ÿ]/g, ''))
    .replace(/\s+/g, ' ')
    .trim();
}

/** Name comparison key without titles: "Dr. Anita Sharma" and "Anita Sharma" are the same person. */
const nameKey = (s) => pdfText(s).toLowerCase().replace(/\b(dr|prof|professor|mr|mrs|ms|miss|shri|smt)\b\.?/g, '').replace(/[^a-z]/g, '');
const yearOf = (d) => (d ? new Date(d).getFullYear() : null);
const money = (n) => (n == null ? null : `Rs. ${Number(n).toLocaleString('en-IN', { maximumFractionDigits: 0 })}`);
const clip = (s, max) => {
  const t = pdfText(s);
  return t.length > max ? `${t.slice(0, max - 1).replace(/\s+\S*$/, '')}...` : t;
};
const join = (parts, sep = ', ') => parts.map(pdfText).filter(Boolean).join(sep);

class ResearchCvService {
  /** Patents / IPR where the person is the applicant or a named inventor, once filed. */
  async _iprs(userId) {
    return prisma.iprApplication.findMany({
      where: {
        status: { in: IPR_CV_STATUSES },
        OR: [
          { applicantUserId: userId },
          { contributors: { some: { userId, role: { in: INVENTOR_ROLES } } } },
        ],
      },
      select: {
        title: true, iprType: true, status: true, applicationNumber: true, govtApplicationId: true,
        publicationId: true, publicationDate: true, grantedAt: true, patentNumber: true, createdAt: true,
      },
      orderBy: { createdAt: 'desc' },
      take: 50,
    }).catch(() => []);
  }

  /** Approved / completed grants where the person is the applicant or an investigator. */
  async _grants(userId) {
    const rows = await prisma.grantApplication.findMany({
      where: {
        status: { in: GRANT_CV_STATUSES },
        OR: [{ applicantUserId: userId }, { investigators: { some: { userId } } }],
      },
      select: {
        title: true, fundingAgencyName: true, sanctionedAmount: true, sanctionDate: true, applicantUserId: true, createdAt: true,
        investigators: { where: { userId }, select: { roleType: true } },
      },
      orderBy: { createdAt: 'desc' },
      take: 50,
    }).catch(() => []);
    return rows.map((g) => ({
      ...g,
      role: g.investigators?.[0]?.roleType === 'pi' || (!g.investigators?.length && g.applicantUserId === userId) ? 'PI' : 'Co-PI',
    }));
  }

  /**
   * Build the CV for `userId` as `viewer` may see it.
   * @returns {Promise<{ filename: string, buffer: Buffer }>}
   */
  async build(userId, viewer) {
    const view = await authorProfileService.getProfileForViewer(userId, viewer);
    const showResearch = Boolean(view.sections?.publications);
    const [iprs, grants] = showResearch ? await Promise.all([this._iprs(userId), this._grants(userId)]) : [[], []];
    const buffer = await this._render(view, { iprs, grants });
    const slug = pdfText(view.user.name).replace(/[^A-Za-z0-9]+/g, '-').replace(/^-|-$/g, '') || 'researcher';
    return { filename: `Research-CV-${slug}.pdf`, buffer };
  }

  // ─── Content ──────────────────────────────────────────────────────────────

  /** 2–3 sentence research statement: the author's bio, else one written from the record. */
  _summary(view) {
    const bio = pdfText(view.profile?.bio);
    if (bio) return clip(bio, 520);
    const u = view.user;
    const interests = (view.profile?.researchInterests || []).slice(0, 3).map(pdfText).filter(Boolean);
    const m = view.profile?.metrics || {};
    const first = `${join([u.designation])}${u.designation ? ' ' : ''}${u.university ? `at ${pdfText(u.university)}` : ''}`.trim();
    const parts = [];
    if (interests.length) parts.push(`${first ? `${first}, w` : 'W'}orking on ${interests.join(', ')}.`);
    else if (first) parts.push(`${first}.`);
    if (view.sections?.publications && view.publicationCount) {
      const metrics = view.sections?.metrics && m.totalCitations ? `, cited ${m.totalCitations} times (h-index ${m.hIndex || 0})` : '';
      parts.push(`Author of ${view.publicationCount} publications${metrics}.`);
    }
    return parts.join(' ');
  }

  /** Most cited first, then most recent. */
  _selectedPublications(view, n) {
    return [...(view.publications || [])]
      .sort((a, b) => (b.citationCount || 0) - (a.citationCount || 0) || (b.year || 0) - (a.year || 0))
      .slice(0, n);
  }

  /** A compact citation as styled runs: first three authors (owner bold), year, title, venue. */
  _citationRuns(pub, ownerKey) {
    const authors = (pub.authors || []).map((a) => pdfText(a.name)).filter(Boolean);
    const shown = authors.slice(0, 3);
    const runs = [];
    shown.forEach((name, i) => {
      runs.push({ text: name, bold: Boolean(ownerKey) && nameKey(name) === ownerKey });
      if (i < shown.length - 1) runs.push({ text: ', ' });
    });
    if (authors.length > 3) runs.push({ text: ' et al.' });
    runs.push({ text: pub.year ? ` (${pub.year}). ` : authors.length ? '. ' : '' });
    runs.push({ text: `${clip(pub.title, 160).replace(/\.$/, '')}. `, bold: true });
    const venue = clip(pub.venue, 90);
    if (venue) runs.push({ text: `${venue}.`, italic: true });
    if (pub.doi) runs.push({ text: ` doi:${pdfText(pub.doi)}`, muted: true });
    if (pub.citationCount > 0) runs.push({ text: ` [${pub.citationCount} citations]`, muted: true });
    return runs;
  }

  /** All sections as data, sized by a fitting step. */
  _sections(view, { iprs, grants }, step) {
    const cv = view.cvDetails || {};
    const u = view.user;
    const p = view.profile || {};
    const m = p.metrics || {};
    const ownerKey = nameKey(u.name);
    const take = (list) => (Array.isArray(list) ? list : []).slice(0, step.items);
    const sections = [];

    const summary = this._summary(view);
    if (summary) sections.push({ title: 'Research Profile', paragraph: summary });

    const interests = (view.sections?.researchInterests ? p.researchInterests || [] : []).map(pdfText).filter(Boolean);
    if (interests.length) sections.push({ title: 'Research Interests', inline: interests.slice(0, 12) });

    const education = take(cv.education).map((e) => ({
      runs: [{ text: join([e.degree]), bold: true }, { text: join([e.institution, e.year].filter(Boolean)) ? `, ${join([e.institution, e.year])}` : '' }],
      sub: e.thesis ? `Thesis: ${clip(e.thesis, 140)}` : null,
    }));
    if (education.length) sections.push({ title: 'Education', items: education });

    const experience = take(cv.experience).map((e) => ({
      runs: [{ text: join([e.role]), bold: true }, { text: e.organization ? ` - ${pdfText(e.organization)}` : '' }, { text: e.period ? ` (${pdfText(e.period)})` : '', muted: true }],
      sub: e.details ? clip(e.details, 200) : null,
    }));
    if (experience.length) sections.push({ title: 'Research Experience', items: experience });

    if (view.sections?.publications && view.publications?.length) {
      const total = [`${view.publicationCount || view.publications.length} publications`];
      if (view.sections?.metrics) total.push(`${m.totalCitations || 0} citations`, `h-index ${m.hIndex || 0}`);
      const ids = [p.scopusAuthorId && 'full list on Scopus', p.orcid && 'ORCID'].filter(Boolean);
      sections.push({
        title: 'Selected Publications',
        note: `${total.join(' | ')}${ids.length ? `  (${ids.join(' and ')})` : ''}`,
        items: this._selectedPublications(view, step.pubs).map((pub, i) => ({ number: i + 1, runs: this._citationRuns(pub, ownerKey) })),
      });
    }

    const presentations = take(cv.presentations).map((t) => ({ runs: [{ text: clip(t, 220) }] }));
    if (presentations.length) sections.push({ title: 'Presentations and Posters', items: presentations });

    const honors = [
      ...grants.map((g) => ({ runs: [{ text: `${clip(g.title, 110)}`, bold: true }, { text: ` - ${join([g.fundingAgencyName, g.role, money(g.sanctionedAmount), yearOf(g.sanctionDate || g.createdAt)].filter(Boolean), ', ')}`, muted: true }] })),
      ...iprs.map((r) => ({
        runs: [
          { text: `${IPR_TYPE_LABEL[r.iprType] || 'IPR'} ${r.grantedAt ? 'granted' : r.publicationId || r.publicationDate ? 'published' : 'filed'}: `, muted: true },
          { text: clip(r.title, 120), bold: true },
          { text: ` (${join([r.patentNumber || r.publicationId || r.govtApplicationId, yearOf(r.grantedAt || r.publicationDate || r.createdAt)].filter(Boolean), ', ')})`, muted: true },
        ],
      })),
      ...(cv.awards || []).map((t) => ({ runs: [{ text: clip(t, 200) }] })),
    ].slice(0, step.items + 1);
    if (honors.length) sections.push({ title: 'Grants, Honors and Awards', items: honors });

    const teaching = take(cv.teaching).map((t) => ({ runs: [{ text: clip(t, 200) }] }));
    if (teaching.length) sections.push({ title: 'Teaching Experience', items: teaching });

    const skills = (cv.skills || []).map(pdfText).filter(Boolean);
    if (skills.length) sections.push({ title: 'Skills', inline: skills.slice(0, 20) });

    const memberships = (cv.memberships || []).map(pdfText).filter(Boolean);
    if (memberships.length) sections.push({ title: 'Professional Memberships', inline: memberships.slice(0, 8) });

    const refs = cv.references || [];
    if (refs.length) {
      sections.push({
        title: 'References',
        items: refs.slice(0, 3).map((r) => ({
          runs: [{ text: pdfText(r.name), bold: true }, { text: join([r.designation, r.organization].filter(Boolean)) ? `, ${join([r.designation, r.organization])}` : '' }, { text: join([r.email, r.phone].filter(Boolean), ' | ') ? `  ${join([r.email, r.phone], ' | ')}` : '', muted: true }],
        })),
      });
    } else if (cv.hasReferences) {
      sections.push({ title: 'References', paragraph: 'Available on request.' });
    }
    return sections;
  }

  // ─── Layout ───────────────────────────────────────────────────────────────

  _width(doc) {
    return doc.page.width - doc.page.margins.left - doc.page.margins.right;
  }

  _contactLine(view) {
    const u = view.user;
    const p = view.profile || {};
    return [
      u.phone && pdfText(u.phone),
      u.email && pdfText(u.email),
      p.orcid && `ORCID: ${p.orcid}`,
      p.scopusAuthorId && `Scopus: ${p.scopusAuthorId}`,
      view.cvDetails?.googleScholarUrl && 'Google Scholar',
      p.webOfScienceId && `WoS: ${p.webOfScienceId}`,
    ].filter(Boolean).join('  |  ');
  }

  /** Height the content needs at a step (same text and fonts as drawing). */
  _measure(doc, view, sections, step) {
    const s = step.scale;
    const w = this._width(doc);
    let h = 0;
    doc.font('Helvetica-Bold').fontSize(19 * s); h += doc.heightOfString(pdfText(view.user.name), { width: w });
    doc.font('Helvetica').fontSize(9.5 * s); h += doc.heightOfString(this._roleLine(view), { width: w }) + 2;
    doc.fontSize(8.5 * s); h += doc.heightOfString(this._contactLine(view) || ' ', { width: w }) + 10;
    for (const sec of sections) {
      h += 6 * s + 11 * s + 5; // gap, heading, rule
      if (sec.paragraph) { doc.font('Helvetica').fontSize(9 * s); h += doc.heightOfString(sec.paragraph, { width: w, lineGap: 1 }); }
      if (sec.note) { doc.font('Helvetica-Oblique').fontSize(8 * s); h += doc.heightOfString(sec.note, { width: w }) + 2; }
      if (sec.inline) { doc.font('Helvetica').fontSize(9 * s); h += doc.heightOfString(sec.inline.join('  |  '), { width: w, lineGap: 1 }); }
      for (const item of sec.items || []) {
        const indent = 14;
        doc.font('Helvetica-Bold').fontSize(9 * s); // bold is widest: never under-estimate
        h += doc.heightOfString(item.runs.map((r) => r.text).join(''), { width: w - indent, lineGap: 1 }) + 2 * s;
        if (item.sub) { doc.font('Helvetica-Oblique').fontSize(8.3 * s); h += doc.heightOfString(item.sub, { width: w - indent }); }
      }
    }
    return h + 14; // footer
  }

  _roleLine(view) {
    const u = view.user;
    return [u.designation, u.department, u.school, u.university].map(pdfText).filter(Boolean).join('  |  ');
  }

  _render(view, extras) {
    return new Promise((resolve, reject) => {
      const doc = new PDFDocument({ ...PAGE, autoFirstPage: true, info: { Title: `Research CV - ${pdfText(view.user.name)}`, Author: pdfText(view.user.name), Creator: 'ResearchSphere' } });
      const chunks = [];
      doc.on('data', (c) => chunks.push(c));
      doc.on('end', () => resolve(Buffer.concat(chunks)));
      doc.on('error', reject);
      try {
        const available = doc.page.height - doc.page.margins.top - doc.page.margins.bottom;
        let step = FIT_STEPS[FIT_STEPS.length - 1];
        let sections = this._sections(view, extras, step);
        for (const candidate of FIT_STEPS) {
          const secs = this._sections(view, extras, candidate);
          if (this._measure(doc, view, secs, candidate) <= available) { step = candidate; sections = secs; break; }
        }
        this._draw(doc, view, sections, step);
        doc.end();
      } catch (err) {
        reject(err);
      }
    });
  }

  _draw(doc, view, sections, step) {
    const s = step.scale;
    const left = doc.page.margins.left;
    const w = this._width(doc);
    const bottomLimit = doc.page.height - doc.page.margins.bottom - 14;
    // Never let pdfkit start a second page: anything that would not fit is dropped.
    const fits = (height) => doc.y + height <= bottomLimit;

    // Header
    doc.font('Helvetica-Bold').fontSize(19 * s).fillColor(COLOR.ink).text(pdfText(view.user.name), left, doc.page.margins.top, { width: w });
    const role = this._roleLine(view);
    if (role) doc.font('Helvetica').fontSize(9.5 * s).fillColor(COLOR.muted).text(role, { width: w });
    doc.moveDown(0.15);
    const contact = this._contactLine(view);
    if (contact) {
      doc.font('Helvetica').fontSize(8.5 * s).fillColor(COLOR.accent);
      const scholar = view.cvDetails?.googleScholarUrl;
      if (scholar && contact.includes('Google Scholar')) {
        const [before, after] = contact.split('Google Scholar');
        doc.text(before, { width: w, continued: true }).text('Google Scholar', { link: scholar, underline: true, continued: Boolean(after) });
        if (after) doc.text(after, { link: null, underline: false });
      } else {
        doc.text(contact, { width: w });
      }
    }
    doc.moveDown(0.3);
    doc.moveTo(left, doc.y).lineTo(left + w, doc.y).lineWidth(1.4).strokeColor(COLOR.accent).stroke();
    doc.y += 4;

    for (const sec of sections) {
      if (!fits(30 * s)) break;
      doc.y += 6 * s;
      doc.font('Helvetica-Bold').fontSize(10.5 * s).fillColor(COLOR.accent).text(sec.title.toUpperCase(), left, doc.y, { width: w, characterSpacing: 0.5 });
      const ry = doc.y + 1;
      doc.moveTo(left, ry).lineTo(left + w, ry).lineWidth(0.5).strokeColor(COLOR.rule).stroke();
      doc.y = ry + 3;

      if (sec.note) {
        doc.font('Helvetica-Oblique').fontSize(8 * s).fillColor(COLOR.muted).text(sec.note, left, doc.y, { width: w });
        doc.y += 2;
      }
      if (sec.paragraph) {
        doc.font('Helvetica').fontSize(9 * s).fillColor(COLOR.ink).text(sec.paragraph, left, doc.y, { width: w, lineGap: 1, align: 'justify' });
      }
      if (sec.inline) {
        doc.font('Helvetica').fontSize(9 * s).fillColor(COLOR.ink).text(sec.inline.join('  |  '), left, doc.y, { width: w, lineGap: 1 });
      }
      for (const item of sec.items || []) {
        const indent = 14;
        doc.font('Helvetica-Bold').fontSize(9 * s);
        const need = doc.heightOfString(item.runs.map((r) => r.text).join(''), { width: w - indent, lineGap: 1 });
        if (!fits(need)) break;
        const top = doc.y;
        doc.font('Helvetica').fontSize(9 * s).fillColor(COLOR.muted).text(item.number ? `${item.number}.` : '-', left, top, { width: indent - 3, align: 'right' });
        const runs = item.runs.filter((r) => r.text);
        runs.forEach((r, i) => {
          doc.font(r.bold ? 'Helvetica-Bold' : r.italic ? 'Helvetica-Oblique' : 'Helvetica').fontSize(9 * s).fillColor(r.muted ? COLOR.muted : COLOR.ink);
          const opts = { width: w - indent, continued: i < runs.length - 1, lineGap: 1 };
          if (i === 0) doc.text(r.text, left + indent, top, opts);
          else doc.text(r.text, opts);
        });
        if (item.sub && fits(10 * s)) {
          doc.font('Helvetica-Oblique').fontSize(8.3 * s).fillColor(COLOR.muted).text(item.sub, left + indent, doc.y, { width: w - indent });
        }
        doc.y += 2 * s;
      }
    }

    // Footer, in the bottom margin. pdfkit starts a new page for text below the margin, so the
    // margin is lifted while the footer is drawn.
    const bottom = doc.page.margins.bottom;
    const fy = doc.page.height - bottom + 10;
    const generated = new Date().toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric', timeZone: 'Asia/Kolkata' });
    doc.page.margins.bottom = 0;
    doc.font('Helvetica').fontSize(7 * s).fillColor(COLOR.muted)
      .text(`Generated ${generated} from ResearchSphere`, left, fy, { width: w, align: 'right', lineBreak: false });
    doc.page.margins.bottom = bottom;
  }
}

module.exports = new ResearchCvService();
module.exports.ResearchCvService = ResearchCvService;
module.exports._pdfText = pdfText;
module.exports.FIT_STEPS = FIT_STEPS;
