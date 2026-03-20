import 'server-only';

export type DealLifecycleStatus =
  | 'pending'
  | 'accepted'
  | 'rejected'
  | 'transport_pending'
  | 'in_transit'
  | 'completed'
  | 'cancelled';

interface TransitionValidationInput {
  currentStatus: string;
  nextStatus: DealLifecycleStatus;
  hasAssignedDriver: boolean;
}

interface TransitionValidationResult {
  ok: boolean;
  error?: string;
}

const ALLOWED_DEAL_TRANSITIONS: Record<DealLifecycleStatus, readonly DealLifecycleStatus[]> = {
  pending: ['transport_pending', 'rejected', 'cancelled'],
  accepted: ['transport_pending', 'cancelled'],
  transport_pending: ['in_transit', 'cancelled'],
  in_transit: ['completed', 'cancelled'],
  rejected: [],
  completed: [],
  cancelled: [],
};

function normalizeDealStatus(status: string): DealLifecycleStatus | null {
  if (status === 'accepted') return 'transport_pending';
  if (
    status === 'pending' ||
    status === 'rejected' ||
    status === 'transport_pending' ||
    status === 'in_transit' ||
    status === 'completed' ||
    status === 'cancelled'
  ) {
    return status;
  }

  return null;
}

export function validateDealTransition(input: TransitionValidationInput): TransitionValidationResult {
  const normalizedCurrent = normalizeDealStatus(input.currentStatus);
  if (!normalizedCurrent) {
    return { ok: false, error: 'This deal is in an unknown state. Refresh and try again.' };
  }

  if (normalizedCurrent === input.nextStatus) {
    return { ok: true };
  }

  const allowedTargets = ALLOWED_DEAL_TRANSITIONS[normalizedCurrent];
  if (!allowedTargets.includes(input.nextStatus)) {
    return {
      ok: false,
      error: `Cannot move deal from ${normalizedCurrent} to ${input.nextStatus}.`,
    };
  }

  if ((input.nextStatus === 'in_transit' || input.nextStatus === 'completed') && !input.hasAssignedDriver) {
    return { ok: false, error: 'A verified driver must be assigned before this status update.' };
  }

  return { ok: true };
}

export function mapCommercialDealActionToStatus(
  action: 'accepted' | 'rejected' | 'completed' | 'cancelled',
): DealLifecycleStatus {
  if (action === 'accepted') {
    return 'transport_pending';
  }

  return action;
}

