import { redirect } from 'next/navigation';

/**
 * Retired legacy IPR finance review. IPR incentives now become payout lines when DRD publishes
 * the IPR and are verified and paid in the payout ledger, so old links land there.
 */
export default function LegacyFinanceProcessingPage() {
  redirect('/finance/payouts');
}
