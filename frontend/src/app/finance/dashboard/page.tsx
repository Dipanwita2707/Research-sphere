import { redirect } from 'next/navigation';

/** Old links pointed at /finance/dashboard; the dashboard lives at /finance. */
export default function LegacyFinanceDashboardRedirect() {
  redirect('/finance');
}
