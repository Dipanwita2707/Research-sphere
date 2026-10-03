'use client';

import React, { useState } from 'react';
import { useToast } from '@/shared/ui-components/Toast';
import { AdjustDialog, CreateBatchDialog, ReasonDialog, RecommendDialog } from './PayoutActionDialogs';
import {
  useAdjustPayout, useCancelPayout, useCreateBatch, useHoldPayout, useRecommendPayouts,
} from '../hooks/useFinance';
import { budgetWarningText, formatINR } from '../utils/format';
import type { PayoutBatch, PayoutLine } from '../types';

export type PayoutActionKind = 'recommend' | 'hold' | 'adjust' | 'cancel' | 'batch';

const OPEN = ['pending_verification', 'recommended', 'on_hold'];

/** Which actions a line allows in its current state (same rules as the backend). */
export function allowedActions(line: Pick<PayoutLine, 'status' | 'batchId'>): Record<PayoutActionKind, boolean> {
  const unbatched = !line.batchId;
  return {
    recommend: unbatched && (line.status === 'pending_verification' || line.status === 'on_hold'),
    hold: unbatched && (line.status === 'pending_verification' || line.status === 'recommended'),
    adjust: unbatched && OPEN.includes(line.status),
    cancel: unbatched && OPEN.includes(line.status),
    batch: unbatched && line.status === 'recommended',
  };
}

function LineContext({ line }: { line: PayoutLine }) {
  return (
    <div className="rounded-lg border border-stone-200 bg-stone-50 px-3 py-2.5 text-sm dark:border-gray-700 dark:bg-gray-900/50">
      <div className="flex items-baseline justify-between gap-3">
        <span className="font-medium text-stone-900 dark:text-white">{line.payeeName}</span>
        <span className="shrink-0 font-semibold tabular-nums text-stone-900 dark:text-white">{formatINR(line.approvedAmount)}</span>
      </div>
      <p className="mt-0.5 line-clamp-2 text-xs text-stone-500 dark:text-gray-400">{line.title}</p>
    </div>
  );
}

/**
 * Owns the payout action dialogs and their mutations. Call `open(kind, lines)` from a row,
 * the selection toolbar or the detail drawer; `onDone` runs after a successful action.
 */
export function usePayoutActions({
  onDone,
  onBatchCreated,
}: { onDone?: (kind: PayoutActionKind) => void; onBatchCreated?: (batch: PayoutBatch) => void } = {}) {
  const toast = useToast();
  const [state, setState] = useState<{ kind: PayoutActionKind; lines: PayoutLine[] } | null>(null);
  const recommend = useRecommendPayouts();
  const hold = useHoldPayout();
  const adjust = useAdjustPayout();
  const cancel = useCancelPayout();
  const createBatch = useCreateBatch();

  const close = () => setState(null);
  const lines = state?.lines || [];
  const line = lines[0];
  const total = lines.reduce((s, l) => s + (l.approvedAmount || 0), 0);
  const finish = (kind: PayoutActionKind, message: string) => {
    toast.success(message);
    onDone?.(kind);
  };

  const dialogs = (
    <>
      <RecommendDialog
        open={state?.kind === 'recommend'}
        onClose={close}
        count={lines.length}
        total={total}
        onSubmit={async (comments) => {
          const res = await recommend.mutateAsync({ ids: lines.map((l) => l.id), comments });
          finish('recommend', `${res.recommended} line${res.recommended === 1 ? '' : 's'} recommended for payment.`);
          const warning = budgetWarningText(res.budgetWarnings);
          if (warning) toast.warning(warning, 'Over research budget');
        }}
      />
      {line && (
        <>
          <ReasonDialog
            open={state?.kind === 'hold'}
            onClose={close}
            title="Put on hold"
            description="The line stays out of payment batches until someone recommends it again. The author sees the reason."
            label="Reason for hold"
            placeholder="e.g. Awaiting proof of indexing from the author"
            confirmLabel="Put on hold"
            context={<LineContext line={line} />}
            onSubmit={async (reason) => {
              await hold.mutateAsync({ id: line.id, reason });
              finish('hold', `${line.payeeName}'s line is on hold.`);
            }}
          />
          <ReasonDialog
            open={state?.kind === 'cancel'}
            onClose={close}
            danger
            title="Cancel payout line"
            description="The line will not be paid. This cannot be undone; a corrected claim for the same work can be paid later."
            label="Reason for cancelling"
            confirmLabel="Cancel line"
            context={<LineContext line={line} />}
            onSubmit={async (reason) => {
              await cancel.mutateAsync({ id: line.id, reason });
              finish('cancel', `${line.payeeName}'s line was cancelled.`);
            }}
          />
          <AdjustDialog
            open={state?.kind === 'adjust'}
            onClose={close}
            payeeName={line.payeeName}
            calculatedAmount={line.calculatedAmount}
            approvedAmount={line.approvedAmount}
            onSubmit={async (amount, reason) => {
              await adjust.mutateAsync({ id: line.id, amount, reason });
              finish('adjust', `Amount for ${line.payeeName} changed to ${formatINR(amount)}.`);
            }}
          />
        </>
      )}
      <CreateBatchDialog
        open={state?.kind === 'batch'}
        onClose={close}
        count={lines.length}
        total={total}
        onSubmit={async (title) => {
          const batch = await createBatch.mutateAsync({ ids: lines.map((l) => l.id), title });
          finish('batch', `Batch ${batch.batchNumber} created and sent for approval.`);
          onBatchCreated?.(batch);
        }}
      />
    </>
  );

  return {
    open: (kind: PayoutActionKind, target: PayoutLine[]) => setState({ kind, lines: target }),
    dialogs: dialogs as React.ReactNode,
  };
}
