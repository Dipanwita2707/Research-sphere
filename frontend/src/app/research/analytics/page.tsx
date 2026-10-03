import { redirect } from 'next/navigation';

// This route used to render generated demo numbers. Real research analytics live
// under DRD Analytics, so keep old links working by sending them there.
export default function ResearchAnalyticsRedirect() {
  redirect('/drd/analytics/overview');
}
