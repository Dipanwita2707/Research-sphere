import { SubMenuItem, NavPermissions } from './types';

/** Builds the Research & Development sub-menu items */
export function useRndMenuItems(perms: NavPermissions): SubMenuItem[] {
  const {
    canFileIpr, canFileResearch, isFaculty, isAdmin,
    hasDrdAccess, hasFinanceAccess, hasReviewAccess,
    hasAnalyticsAccess,
    canReviewIpr, canApproveIpr, canReviewResearch, canApproveResearch,
    canReviewBook, canApproveBook, canReviewConference, canApproveConference,
    canReviewGrant, canApproveGrant,
  } = perms;

  const submitTrackChildren: SubMenuItem[] = [
    {
      name: 'My Research',
      description: 'View all your submitted work',
      children: [
        { name: 'All Submissions', href: '/my-work', description: 'View all submissions at once' },
        ...(canFileResearch ? [{ name: 'Research Papers, Books, Chapters & Conference Papers', href: '/research/my-contributions', description: 'View research papers' }] : []),
        ...(canFileIpr ? [{ name: 'Patents / IPR', href: '/ipr/my-applications', description: 'View patent applications' }] : []),
      ],
    },
    {
      name: 'New Filing',
      description: 'Submit new research work',
      children: [
        ...(canFileResearch ? [{ name: 'Research Paper', href: '/research/apply', description: 'Submit new research paper' }] : []),
        ...(canFileIpr ? [{ name: 'Patent / IPR', href: '/ipr/apply', description: 'File new patent or IPR' }] : []),
        { name: 'Book / Chapter', href: '/research/apply?type=book', description: 'Submit book or chapter' },
        { name: 'Conference Paper', href: '/research/apply?type=conference_paper', description: 'Submit conference paper' },
        { name: 'Grant Proposal', href: '/research/apply-grant', description: 'Apply for research grant' },
      ],
    },
  ];

  if (isFaculty) {
    submitTrackChildren.push({ name: 'Mentor Approvals', href: '/mentor-approvals', description: 'Review & approve student work' });
  }

  const reviewApprovalChildren: SubMenuItem[] = [];
  if (hasDrdAccess) reviewApprovalChildren.push({ name: '📊 DRD Dashboard', href: '/drd', description: 'Research & Development overview' });
  if (canReviewIpr || canApproveIpr) reviewApprovalChildren.push({ name: '💡 Review Patents/IPR', href: '/drd/review', description: 'Pending patent applications' });
  if (canReviewResearch || canApproveResearch) reviewApprovalChildren.push({ name: '📝 Review Research Papers', href: '/drd/research?type=research', description: 'Pending research papers' });
  if (canReviewBook || canApproveBook) reviewApprovalChildren.push({ name: '📚 Review Books/Chapters', href: '/drd/research?type=book', description: 'Pending book submissions' });
  if (canReviewConference || canApproveConference) reviewApprovalChildren.push({ name: '🎤 Review Conference Papers', href: '/drd/research?type=conference', description: 'Pending conference papers' });
  if (canReviewGrant || canApproveGrant) reviewApprovalChildren.push({ name: '💰 Review Grant Proposals', href: '/drd/research?type=grant_proposal', description: 'Pending grant applications' });
  if (hasFinanceAccess) reviewApprovalChildren.push({ name: '🏦 Finance & Payments', href: '/finance/dashboard', description: 'Manage incentive payments' });

  const rndSubItems: SubMenuItem[] = [];

  if (canFileIpr || canFileResearch) {
    rndSubItems.push({ name: 'Submit & Track', description: 'File new work & view submissions', children: submitTrackChildren });
  }

  rndSubItems.push({ name: 'Monthly Progress Tracker', href: '/research/progress-tracker', description: 'Track monthly research milestones' });

  if (hasReviewAccess && reviewApprovalChildren.length > 0) {
    rndSubItems.push({ name: 'Review & Approve', description: 'Pending items for review', children: reviewApprovalChildren });
  }

  // Analytics section — gated by analytics-specific permissions (not review permissions)
  if (hasAnalyticsAccess || isAdmin) {
    rndSubItems.push({
      name: '📈 Analytics',
      description: 'Research & IPR analytics dashboards',
      children: [
        { name: 'Overview', href: '/drd/analytics/overview', description: 'High-level KPIs & trends' },
        { name: 'Applicant Analytics', href: '/drd/analytics/applicant', description: 'Submission trends by school & department' },
        { name: 'DRD Member Performance', href: '/drd/analytics/drd-member', description: 'Review turnaround & workload' },
      ],
    });
  }

  if (isAdmin) {
    rndSubItems.push({
      name: '⚙️ R&D Configuration',
      description: 'School assignments & routing',
      children: [
        { name: '💡 IPR Routing', href: '/admin/drd-school-assignment', description: 'Route IPR to schools' },
        { name: '📝 Research Routing', href: '/admin/research-school-assignment', description: 'Route research to schools' },
        { name: '📚 Book Routing', href: '/admin/book-school-assignment', description: 'Route books to schools' },
        { name: '🎤 Conference Routing', href: '/admin/conference-school-assignment', description: 'Route conferences' },
        { name: '💰 Grant Routing', href: '/admin/grant-school-assignment', description: 'Route grants' },
      ],
    });
    rndSubItems.push({
      name: '📜 Incentive Policies',
      description: 'Configure payment policies',
      children: [
        { name: '💡 Patent/IPR Incentives', href: '/admin/incentive-policies', description: 'IPR payment rules' },
        { name: '📝 Research Incentives', href: '/admin/research-policies', description: 'Research payment rules' },
        { name: '📚 Book Incentives', href: '/admin/book-policies', description: 'Book payment rules' },
        { name: '📖 Chapter Incentives', href: '/admin/book-chapter-policies', description: 'Chapter payment rules' },
        { name: '🎤 Conference Incentives', href: '/admin/conference-policies', description: 'Conference payment rules' },
        { name: '💰 Grant Incentives', href: '/admin/grant-policies', description: 'Grant payment rules' },
      ],
    });
  }

  return rndSubItems;
}
