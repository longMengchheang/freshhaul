'use server';

import { getCurrentUserContext } from '@/lib/server/current-user';
import { hasActiveRole } from '@/lib/user-roles';
import {
  addPaymentMethod,
  getPaymentMethods,
  getAvailableBalance,
  requestWithdrawal,
  getWithdrawalHistory,
  getWithdrawalDetail,
} from '@/lib/server/payment-engine';
import { actionFail, actionOk } from '@/lib/server/action-result';

/**
 * Add driver payment method (Bakong account)
 */
export async function addDriverPaymentMethod(
  bakongAccountId: string,
  accountHolderName: string,
  accountHolderPhone: string
) {
  try {
    const context = await getCurrentUserContext();
    if (!context) {
      return actionFail('UNAUTHORIZED', 'User not authenticated', null);
    }

    if (!hasActiveRole(context.profile.roles, 'driver')) {
      return actionFail('FORBIDDEN', 'Driver role not active on this account', null);
    }

    // Validate input
    if (!bakongAccountId?.trim() || !accountHolderName?.trim() || !accountHolderPhone?.trim()) {
      return actionFail('VALIDATION_ERROR', 'All payment method fields are required', null);
    }

    const method = await addPaymentMethod(
      context.authUser.id,
      bakongAccountId,
      accountHolderName,
      accountHolderPhone
    );

    if (!method) {
      return actionFail('UNKNOWN_ERROR', 'Failed to add payment method', null);
    }

    return actionOk({
      id: method.id,
      bakongAccountId: method.bakong_account_id,
      accountHolderName: method.account_holder_name,
    });
  } catch (error) {
    console.error('Add payment method error:', error);
    return actionFail('UNKNOWN_ERROR', 'Failed to add payment method', null);
  }
}

/**
 * Get driver's payment methods
 */
export async function getDriverPaymentMethods() {
  try {
    const context = await getCurrentUserContext();
    if (!context) {
      return actionFail('UNAUTHORIZED', 'User not authenticated', null);
    }

    if (!hasActiveRole(context.profile.roles, 'driver')) {
      return actionFail('FORBIDDEN', 'Driver role not active on this account', null);
    }

    const methods = await getPaymentMethods(context.authUser.id);

    return actionOk(
      methods.map((m) => ({
        id: m.id,
        bakongAccountId: m.bakong_account_id,
        accountHolderName: m.account_holder_name,
        accountHolderPhone: m.account_holder_phone,
        isDefault: m.is_default,
        verifiedAt: m.verified_at,
      }))
    );
  } catch (error) {
    console.error('Get payment methods error:', error);
    return actionFail('UNKNOWN_ERROR', 'Failed to load payment methods', null);
  }
}

/**
 * Get driver's available balance for withdrawal
 */
export async function getDriverAvailableBalance() {
  try {
    const context = await getCurrentUserContext();
    if (!context) {
      return actionFail('UNAUTHORIZED', 'User not authenticated', null);
    }

    if (!hasActiveRole(context.profile.roles, 'driver')) {
      return actionFail('FORBIDDEN', 'Driver role not active on this account', null);
    }

    const balance = await getAvailableBalance(context.authUser.id);

    return actionOk({
      availableBalance: Math.round(balance * 100) / 100,
      minWithdrawal: 1.0,
      maxWithdrawal: 10000.0,
    });
  } catch (error) {
    console.error('Get available balance error:', error);
    return actionFail('UNKNOWN_ERROR', 'Failed to calculate balance', null);
  }
}

/**
 * Request instant withdrawal
 */
export async function requestInstantWithdrawal(paymentMethodId: string, amountUsd: number) {
  try {
    const context = await getCurrentUserContext();
    if (!context) {
      return actionFail('UNAUTHORIZED', 'User not authenticated', null);
    }

    if (!hasActiveRole(context.profile.roles, 'driver')) {
      return actionFail('FORBIDDEN', 'Driver role not active on this account', null);
    }

    // Validate amount
    if (!amountUsd || amountUsd <= 0) {
      return actionFail('VALIDATION_ERROR', 'Withdrawal amount must be greater than 0', null);
    }

    const result = await requestWithdrawal(context.authUser.id, paymentMethodId, amountUsd);

    if (!result.success) {
      return actionFail('CONFLICT', result.error || 'Failed to request withdrawal', null);
    }

    return actionOk({
      requestId: result.requestId,
      transactionId: result.transactionId,
      status: 'Processing...',
      message: 'Your withdrawal is being processed. Funds should arrive within 2-5 minutes.',
    });
  } catch (error) {
    console.error('Request withdrawal error:', error);
    return actionFail(
      'UNKNOWN_ERROR',
      error instanceof Error ? error.message : 'Failed to request withdrawal',
      null
    );
  }
}

/**
 * Get driver's withdrawal history
 */
export async function getDriverWithdrawalHistory() {
  try {
    const context = await getCurrentUserContext();
    if (!context) {
      return actionFail('UNAUTHORIZED', 'User not authenticated', null);
    }

    if (!hasActiveRole(context.profile.roles, 'driver')) {
      return actionFail('FORBIDDEN', 'Driver role not active on this account', null);
    }

    const history = await getWithdrawalHistory(context.authUser.id);

    return actionOk(
      history.map((wr) => ({
        id: wr.id,
        amountUsd: Number(wr.amount_usd),
        status: wr.status,
        requestedAt: wr.requested_at,
        completedAt: wr.completed_at,
        transactionId: wr.bakong_transaction_id,
        paymentMethod: {
          bakongAccountId: wr.paymentMethod?.bakong_account_id,
          accountHolderName: wr.paymentMethod?.account_holder_name,
        },
      }))
    );
  } catch (error) {
    console.error('Get withdrawal history error:', error);
    return actionFail('UNKNOWN_ERROR', 'Failed to load withdrawal history', null);
  }
}

/**
 * Get withdrawal request details
 */
export async function getWithdrawalRequestDetail(requestId: string) {
  try {
    const context = await getCurrentUserContext();
    if (!context) {
      return actionFail('UNAUTHORIZED', 'User not authenticated', null);
    }

    if (!hasActiveRole(context.profile.roles, 'driver')) {
      return actionFail('FORBIDDEN', 'Driver role not active on this account', null);
    }

    const detail = await getWithdrawalDetail(requestId, context.authUser.id);

    if (!detail) {
      return actionFail('NOT_FOUND', 'Withdrawal request not found', null);
    }

    return actionOk({
      id: detail.id,
      amountUsd: Number(detail.amount_usd),
      status: detail.status,
      requestedAt: detail.requested_at,
      processedAt: detail.processed_at,
      completedAt: detail.completed_at,
      failureReason: detail.failure_reason,
      transactionId: detail.bakong_transaction_id,
      paymentMethod: {
        id: detail.paymentMethod?.id,
        bakongAccountId: detail.paymentMethod?.bakong_account_id,
        accountHolderName: detail.paymentMethod?.account_holder_name,
      },
      executions: detail.executions?.map((ex) => ({
        id: ex.id,
        status: ex.status,
        attemptCount: ex.attempt_count,
        lastAttemptAt: ex.last_attempt_at,
        errorDetails: ex.error_details,
      })) || [],
    });
  } catch (error) {
    console.error('Get withdrawal detail error:', error);
    return actionFail('UNKNOWN_ERROR', 'Failed to load withdrawal details', null);
  }
}
