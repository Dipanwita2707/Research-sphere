/**
 * Research CV (PDF) for a researcher, built from the same data the research profile shows.
 *
 * Privacy: the profile is loaded through authorProfileService.getProfileForViewer, so the CV
 * obeys the author's visibility level and section toggles exactly like the profile page (a
 * viewer who may not open the profile gets the same 403/404). Patents and funded grants are
 * listed only when publications are visible. Incentive amounts are never printed: a CV is
 * meant to be shared.
 *
 * Contents: header (name, role, unit, contact, researcher ids), summary metrics, profile,
 * research interests, publications grouped by type (newest first), patents / IPR, grants.
 */
const PDFDocument = require('pdfkit');
const prisma = require('../../../shared/config/database');
const authorProfileService = require('./authorProfile.service');
const { INVENTOR_ROLES } = require('../utils/iprIncentive');

const PAGE = { size: 'A4', margins: { top: 54, bottom: 64, left: 56, right: 56 } };
const COLOR = { accent: '#7D1A34', ink: '#1C1917', muted: '#57534E', rule: '#D6D3D1' };

const PUBLICATION_GROUPS = [
  { type: 'research_paper', heading: 'Journal Articles' },
  { type: 'conference_paper', heading: 'Conference Papers' },
  { type: 'book', heading: 'Books' },
  { type: 'book_chapter', heading: 'Book Chapters' },
];

/** IPR statuses that mean the application was at least filed with the patent office. */
const IPR_CV_STATUSES = ['govt_application_filed', 'published', 'under_finance_review', 'finance_approved', 'finance_rejected', 'completed'];
const GRANT_CV_STATUSES = ['approved', 'completed'];
const IPR_TYPE_LABEL = { patent: 'Patent', copyright: 'Copyright', trademark: 'Trademark', design: 'Design' };

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
const fmtDate = (d) => (d ? new Date(d).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric', timeZone: 'Asia/Kolkata' }) : null);
const yearOf = (d) => (d ? new Date(d).getFullYear() : null);
const money = (n) => (n == null ? null : `Rs. ${Number(n).toLocaleString('en-IN', { maximumFractionDigits: 0 })}`);

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
      take: 200,
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
      take: 200,
    }).catch(() => []);
    return rows.map((g) => ({
      ...g,
      role: g.investigators?.[0]?.roleType === 'pi' || (!g.investigators?.length && g.applicantUserId === userId) ? 'Principal Investigator' : 'Co-Investigator',
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

  _render(view, { iprs, grants }) {
    return new Promise((resolve, reject) => {
      const doc = new PDFDocument({ ...PAGE, bufferPages: true, info: { Title: `Research CV - ${pdfText(view.user.name)}`, Author: pdfText(view.user.name), Creator: 'ResearchSphere' } });
      const chunks = [];
      doc.on('data', (c) => chunks.push(c));
      doc.on('end', () => resolve(Buffer.concat(chunks)));
      doc.on('error', reject);
      try {
        this._header(doc, view);
        this._metrics(doc, view);
        this._profile(doc, view);
        this._publications(doc, view);
        this._iprSection(doc, iprs);
        this._grantSection(doc, grants);
        if (!view.publications.length && !iprs.length && !grants.length) {
          this._section(doc, 'Research Output');
          doc.font('Helvetica').fontSize(10).fillColor(COLOR.muted)
            .text(view.sections?.publications ? 'No approved publications, patents or grants are on record yet.' : 'The researcher has not made their publications visible.');
        }
        this._footers(doc, view);
        doc.end();
      } catch (err) {
        reject(err);
      }
    });
  }

  _width(doc) {
    return doc.page.width - doc.page.margins.left - doc.page.margins.right;
  }

  _header(doc, view) {
    const u = view.user;
    doc.font('Helvetica-Bold').fontSize(22).fillColor(COLOR.ink).text(pdfText(u.name));
    const role = [u.designation, u.department, u.school, u.university].map(pdfText).filter(Boolean);
    if (role.length) doc.moveDown(0.15).font('Helvetica').fontSize(10.5).fillColor(COLOR.muted).text(role.join('  |  '));
    const contact = [u.email, u.phone].map(pdfText).filter(Boolean);
    const p = view.profile || {};
    const ids = [
      p.orcid && `ORCID: ${p.orcid}`,
      p.scopusAuthorId && `Scopus Author ID: ${p.scopusAuthorId}`,
      p.webOfScienceId && `Web of Science: ${p.webOfScienceId}`,
    ].filter(Boolean);
    if (contact.length || ids.length) {
      doc.moveDown(0.2).fontSize(9.5).fillColor(COLOR.muted).text([...contact, ...ids].join('  |  '));
    }
    doc.moveDown(0.6);
    const y = doc.y;
    doc.moveTo(doc.page.margins.left, y).lineTo(doc.page.margins.left + this._width(doc), y).lineWidth(1.5).strokeColor(COLOR.accent).stroke();
    doc.moveDown(0.8);
  }

  _metrics(doc, view) {
    if (!view.sections?.metrics && !view.sections?.publications) return;
    const m = view.profile?.metrics || {};
    const items = [
      view.sections?.publications && ['Publications', view.publications.length],
      view.sections?.metrics && ['Citations', m.totalCitations || 0],
      view.sections?.metrics && ['h-index', m.hIndex || 0],
      view.sections?.metrics && ['i10-index', m.i10Index || 0],
    ].filter(Boolean);
    if (!items.length) return;
    const colW = this._width(doc) / items.length;
    const top = doc.y;
    items.forEach(([label, value], i) => {
      const x = doc.page.margins.left + i * colW;
      doc.font('Helvetica-Bold').fontSize(16).fillColor(COLOR.accent).text(String(value), x, top, { width: colW, align: 'left' });
      doc.font('Helvetica').fontSize(8.5).fillColor(COLOR.muted).text(label.toUpperCase(), x, top + 20, { width: colW, characterSpacing: 0.5 });
    });
    doc.x = doc.page.margins.left;
    doc.y = top + 38;
    doc.moveDown(0.6);
  }

  _section(doc, title) {
    if (doc.y > doc.page.height - doc.page.margins.bottom - 60) doc.addPage();
    doc.x = doc.page.margins.left;
    doc.moveDown(0.4).font('Helvetica-Bold').fontSize(12.5).fillColor(COLOR.accent).text(title.toUpperCase(), { characterSpacing: 0.6 });
    const y = doc.y + 2;
    doc.moveTo(doc.page.margins.left, y).lineTo(doc.page.margins.left + this._width(doc), y).lineWidth(0.5).strokeColor(COLOR.rule).stroke();
    doc.moveDown(0.5);
  }

  _profile(doc, view) {
    const bio = pdfText(view.profile?.bio);
    if (bio) {
      this._section(doc, 'Profile');
      doc.font('Helvetica').fontSize(10).fillColor(COLOR.ink).text(bio, { align: 'justify', lineGap: 1.5 });
    }
    const interests = (view.profile?.researchInterests || []).map(pdfText).filter(Boolean);
    if (view.sections?.researchInterests && interests.length) {
      this._section(doc, 'Research Interests');
      doc.font('Helvetica').fontSize(10).fillColor(COLOR.ink).text(interests.join('  |  '), { lineGap: 1.5 });
    }
  }

  /** "A. Author, B. Owner, C. Other (2024). Title. Venue, 12(3), pp. 1-9. DOI: x" with the owner in bold. */
  _citation(doc, pub, index, ownerKey) {
    const indent = 22;
    const x = doc.page.margins.left;
    const width = this._width(doc) - indent;
    if (doc.y > doc.page.height - doc.page.margins.bottom - 40) doc.addPage();
    const top = doc.y;
    doc.font('Helvetica').fontSize(9.5).fillColor(COLOR.muted).text(`${index}.`, x, top, { width: indent - 4, align: 'right' });

    const authors = (pub.authors || []).map((a) => pdfText(a.name)).filter(Boolean);
    const shown = authors.length > 12 ? [...authors.slice(0, 10), '...', authors[authors.length - 1]] : authors;
    const runs = [];
    shown.forEach((name, i) => {
      runs.push({ text: name, bold: Boolean(ownerKey) && nameKey(name) === ownerKey });
      if (i < shown.length - 1) runs.push({ text: ', ' });
    });
    runs.push({ text: pub.year ? ` (${pub.year}). ` : authors.length ? '. ' : '' });
    runs.push({ text: `${pdfText(pub.title).replace(/\.$/, '')}. `, bold: true });
    const details = [pdfText(pub.venue), pub.volume && `Vol. ${pub.volume}`, pub.issue && `Issue ${pub.issue}`, pub.pages && `pp. ${pdfText(pub.pages)}`].filter(Boolean);
    if (details.length) runs.push({ text: `${details.join(', ')}. `, italic: true });
    if (pub.doi) runs.push({ text: `DOI: ${pdfText(pub.doi)}. ` });
    if (pub.citationCount > 0) runs.push({ text: `Cited by ${pub.citationCount}.`, muted: true });

    // One paragraph of styled runs: position once, then chain with `continued` (no x/y on later runs).
    const visible = runs.filter((r) => r.text);
    visible.forEach((r, i) => {
      const font = r.bold ? 'Helvetica-Bold' : r.italic ? 'Helvetica-Oblique' : 'Helvetica';
      doc.font(font).fontSize(9.5).fillColor(r.muted ? COLOR.muted : COLOR.ink);
      const opts = { width, continued: i < visible.length - 1, lineGap: 1.2 };
      if (i === 0) doc.text(r.text, x + indent, top, opts);
      else doc.text(r.text, opts);
    });
    doc.x = x;
    doc.moveDown(0.45);
  }

  _publications(doc, view) {
    if (!view.sections?.publications || !view.publications.length) return;
    const ownerKey = nameKey(view.user.name);
    const byYearDesc = (a, b) => (b.year || 0) - (a.year || 0) || pdfText(a.title).localeCompare(pdfText(b.title));
    const known = new Set(PUBLICATION_GROUPS.map((g) => g.type));
    const groups = [
      ...PUBLICATION_GROUPS.map((g) => ({ ...g, items: view.publications.filter((p) => p.publicationType === g.type) })),
      { type: 'other', heading: 'Other Publications', items: view.publications.filter((p) => !known.has(p.publicationType)) },
    ].filter((g) => g.items.length);
    groups.forEach((g) => {
      this._section(doc, `${g.heading} (${g.items.length})`);
      [...g.items].sort(byYearDesc).forEach((pub, i) => this._citation(doc, pub, i + 1, ownerKey));
    });
  }

  _entry(doc, index, title, lines) {
    const indent = 22;
    const x = doc.page.margins.left;
    if (doc.y > doc.page.height - doc.page.margins.bottom - 40) doc.addPage();
    const top = doc.y;
    doc.font('Helvetica').fontSize(9.5).fillColor(COLOR.muted).text(`${index}.`, x, top, { width: indent - 4, align: 'right' });
    doc.font('Helvetica-Bold').fontSize(9.5).fillColor(COLOR.ink).text(pdfText(title), x + indent, top, { width: this._width(doc) - indent });
    const detail = lines.map(pdfText).filter(Boolean).join('  |  ');
    if (detail) doc.font('Helvetica').fontSize(9).fillColor(COLOR.muted).text(detail, x + indent, undefined, { width: this._width(doc) - indent });
    doc.x = x;
    doc.moveDown(0.45);
  }

  _iprSection(doc, iprs) {
    if (!iprs.length) return;
    this._section(doc, `Patents & Intellectual Property (${iprs.length})`);
    iprs.forEach((r, i) => {
      const state = r.grantedAt
        ? `Granted ${fmtDate(r.grantedAt)}${r.patentNumber ? `, No. ${r.patentNumber}` : ''}`
        : r.publicationId || r.publicationDate
          ? `Published${r.publicationDate ? ` ${fmtDate(r.publicationDate)}` : ''}${r.publicationId ? `, Publication ID ${r.publicationId}` : ''}`
          : 'Filed';
      this._entry(doc, i + 1, r.title, [
        IPR_TYPE_LABEL[r.iprType] || r.iprType,
        state,
        r.govtApplicationId && `Application No. ${r.govtApplicationId}`,
      ]);
    });
  }

  _grantSection(doc, grants) {
    if (!grants.length) return;
    this._section(doc, `Research Grants & Funded Projects (${grants.length})`);
    grants.forEach((g, i) => {
      this._entry(doc, i + 1, g.title, [
        g.role,
        g.fundingAgencyName,
        money(g.sanctionedAmount) && `Sanctioned ${money(g.sanctionedAmount)}`,
        yearOf(g.sanctionDate || g.createdAt),
      ]);
    });
  }

  _footers(doc, view) {
    const range = doc.bufferedPageRange();
    const generated = fmtDate(new Date());
    for (let i = range.start; i < range.start + range.count; i += 1) {
      doc.switchToPage(i);
      const y = doc.page.height - doc.page.margins.bottom + 24;
      // Writing below the bottom margin would add a page: lift the margin while drawing the footer.
      const bottom = doc.page.margins.bottom;
      doc.page.margins.bottom = 0;
      doc.font('Helvetica').fontSize(8).fillColor(COLOR.muted)
        .text(`Research CV - ${pdfText(view.user.name)}  |  Generated ${generated} from ResearchSphere`, doc.page.margins.left, y, { width: this._width(doc), align: 'left', lineBreak: false })
        .text(`Page ${i - range.start + 1} of ${range.count}`, doc.page.margins.left, y, { width: this._width(doc), align: 'right', lineBreak: false });
      doc.page.margins.bottom = bottom;
    }
  }
}

module.exports = new ResearchCvService();
module.exports.ResearchCvService = ResearchCvService;
module.exports._pdfText = pdfText;
