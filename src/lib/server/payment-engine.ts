'use server';

import { eq, and } from 'drizzle-orm';
import { db } from '@/lib/db';
import { driverPaymentMethods, withdrawalRequests, withdrawalExecutions, users } from '@/lib/db/schema';
import type { InferSelectModel } from 'drizzle-orm';
import { getDriverEarningsSummary } from '@/lib/server/driver-earnings';

export type PaymentMethod = InferSelectModel<typeof driverPaymentMethods>;
export type WithdrawalRequest = InferSelectModel<typeof withdrawalRequests>;
export type WithdrawalExecution = InferSelectModel<typeof withdrawalExecutions>;

export interface WithdrawalResult {
  success: boolean;
  requestId?: string;
  transactionId?: string;
  error?: string;
}

const MIN_WITHDRAWAL_USD = 1.0;
const MAX_WITHDRAWAL_USD = 10000.0;

/**
 * Add or update driver payment method (Bakong account)
 */
export async function addPaymentMethod(
  driverId: string,
  bakongAccountId: string,
  accountHolderName: string,
  accountHolderPhone: string
): Promise<PaymentMethod | null> {
  try {
    // Check if account already exists
    const existing = await db.query.driverPaymentMethods.findFirst({
      where: eq(driverPaymentMethods.bakong_account_id, bakongAccountId),
    });

    if (existing) {
      // Update existing
      const updated = await db
        .update(driverPaymentMethods)
        .set({
          account_holder_name: accountHolderName,
          account_holder_phone: accountHolderPhone,
          updated_at: new Date(),
        })
        .where(eq(driverPaymentMethods.id, existing.id))
        .returning();

      return updated[0] || null;
    }

    // Create new payment method
    const result = await db
      .insert(driverPaymentMethods)
      .values({
        driver_id: driverId,
        bakong_account_id: bakongAccountId,
        account_holder_name: accountHolderName,
        account_holder_phone: accountHolderPhone,
        is_default: true,
      })
      .returning();

    return result[0] || null;
  } catch (error) {
    console.error('Add payment method error:', error);
    return null;
  }
}

/**
 * Get driver's available payment methods
 */
export async function getPaymentMethods(driverId: string): Promise<PaymentMethod[]> {
  try {
    return await db.query.driverPaymentMethods.findMany({
      where: eq(driverPaymentMethods.driver_id, driverId),
    });
  } catch (error) {
    console.error('Get payment methods error:', error);
    return [];
  }
}

/**
 * Get driver's available balance for withdrawal
 */
export async function getAvailableBalance(driverId: string): Promise<number> {
  try {
    const now = new Date();
    const thirtyDaysAgo = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);

    const summary = await getDriverEarningsSummary(driverId, thirtyDaysAgo, now);

    // Deduct pending withdrawals from available balance
    const pendingWithdrawals = await db.query.withdrawalRequests.findMany({
      where: and(
        eq(withdrawalRequests.driver_id, driverId),
        eq(withdrawalRequests.status, 'processing')
      ),
    });

    const pendingTotal = pendingWithdrawals.reduce(
      (sum, wr) => sum + Number(wr.amount_usd || 0),
      0
    );

    return Math.max(0, summary.netProfit - pendingTotal);
  } catch (error) {
    console.error('Get available balance error:', error);
    return 0;
  }
}

/**
 * Request instant withdrawal of earnings
 */
export async function requestWithdrawal(
  driverId: string,
  paymentMethodId: string,
  amountUsd: number
): Promise<WithdrawalResult> {
  try {
    // Validate amount
    if (amountUsd < MIN_WITHDRAWAL_USD || amountUsd > MAX_WITHDRAWAL_USD) {
      return {
        success: false,
        error: `Withdrawal amount must be between $${MIN_WITHDRAWAL_USD} and $${MAX_WITHDRAWAL_USD}`,
      };
    }

    // Verify driver and payment method
    const driver = await db.query.users.findFirst({
      where: eq(users.id, driverId),
    });

    if (!driver) {
      return { success: false, error: 'Driver not found' };
    }

    const paymentMethod = await db.query.driverPaymentMethods.findFirst({
      where: and(
        eq(driverPaymentMethods.id, paymentMethodId),
        eq(driverPaymentMethods.driver_id, driverId)
      ),
    });

    if (!paymentMethod) {
      return { success: false, error: 'Payment method not found' };
    }

    // Check available balance
    const available = await getAvailableBalance(driverId);
    if (amountUsd > available) {
      return {
        success: false,
        error: `Insufficient balance. Available: $${available.toFixed(2)}`,
      };
    }

    // Create withdrawal request
    const request = await db
      .insert(withdrawalRequests)
      .values({
        driver_id: driverId,
        payment_method_id: paymentMethodId,
        amount_usd: amountUsd.toString(),
        status: 'requested',
      })
      .returning();

    if (!request[0]) {
      return { success: false, error: 'Failed to create withdrawal request' };
    }

    // Process withdrawal immediately
    const processed = await processWithdrawal(request[0]);

    return processed;
  } catch (error) {
    console.error('Request withdrawal error:', error);
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error',
    };
  }
}

/**
 * Process withdrawal (connect to Bakong in production)
 */
export async function processWithdrawal(
  withdrawalRequest: WithdrawalRequest
): Promise<WithdrawalResult> {
  try {
    const requestId = withdrawalRequest.id;
    const amount = Number(withdrawalRequest.amount_usd);

    // Get payment method details
    const paymentMethod = await db.query.driverPaymentMethods.findFirst({
      where: eq(driverPaymentMethods.id, withdrawalRequest.payment_method_id),
    });

    if (!paymentMethod) {
      return { success: false, error: 'Payment method not found', requestId };
    }

    // Update status to processing
    await db
      .update(withdrawalRequests)
      .set({
        status: 'processing',
        processed_at: new Date(),
      })
      .where(eq(withdrawalRequests.id, requestId));

    // Create execution record
    const execution = await db
      .insert(withdrawalExecutions)
      .values({
        withdrawal_request_id: requestId,
        driver_id: withdrawalRequest.driver_id,
        payment_method_id: withdrawalRequest.payment_method_id,
        amount_usd: amount.toString(),
        status: 'processing',
        attempt_count: 1,
      })
      .returning();

    if (!execution[0]) {
      return {
        success: false,
        error: 'Failed to create withdrawal execution',
        requestId,
      };
    }

    // In production, call Bakong API here
    // For now, simulate successful transfer
    const transactionId = `BAKONG-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;

    // Simulate Bakong response
    const bakongResponse = {
      status: 'success',
      transactionId,
      timestamp: new Date().toISOString(),
      amount,
      recipientAccount: paymentMethod.bakong_account_id,
      recipientName: paymentMethod.account_holder_name,
    };

    // Update execution with response
    await db
      .update(withdrawalExecutions)
      .set({
        status: 'completed',
        bakong_response: JSON.stringify(bakongResponse),
        last_attempt_at: new Date(),
      })
      .where(eq(withdrawalExecutions.id, execution[0].id));

    // Update withdrawal request as completed
    await db
      .update(withdrawalRequests)
      .set({
        status: 'completed',
        completed_at: new Date(),
        bakong_transaction_id: transactionId,
      })
      .where(eq(withdrawalRequests.id, requestId));

    return {
      success: true,
      requestId,
      transactionId,
    };
  } catch (error) {
    console.error('Process withdrawal error:', error);

    // Update execution status to failed
    if ('id' in withdrawalRequest && withdrawalRequest.id) {
      const executions = await db.query.withdrawalExecutions.findMany({
        where: eq(withdrawalExecutions.withdrawal_request_id, withdrawalRequest.id),
      });

      if (executions.length > 0) {
        await db
          .update(withdrawalExecutions)
          .set({
            status: 'failed',
            error_details: JSON.stringify({
              error: error instanceof Error ? error.message : 'Unknown error',
              timestamp: new Date().toISOString(),
            }),
            last_attempt_at: new Date(),
          })
          .where(eq(withdrawalExecutions.id, executions[0].id));
      }

      // Update withdrawal request as failed
      await db
        .update(withdrawalRequests)
        .set({
          status: 'failed',
          failure_reason: error instanceof Error ? error.message : 'Unknown error',
        })
        .where(eq(withdrawalRequests.id, withdrawalRequest.id));
    }

    return {
      success: false,
      error: error instanceof Error ? error.message : 'Withdrawal processing failed',
      requestId: withdrawalRequest.id,
    };
  }
}

/**
 * Get withdrawal history for driver
 */
export async function getWithdrawalHistory(driverId: string, limit: number = 10) {
  try {
    return await db.query.withdrawalRequests.findMany({
      where: eq(withdrawalRequests.driver_id, driverId),
      with: {
        paymentMethod: true,
        executions: true,
      },
      orderBy: (wr) => wr.created_at,
      limit,
    });
  } catch (error) {
    console.error('Get withdrawal history error:', error);
    return [];
  }
}

/**
 * Get withdrawal request details
 */
export async function getWithdrawalDetail(requestId: string, driverId: string) {
  try {
    return await db.query.withdrawalRequests.findFirst({
      where: and(
        eq(withdrawalRequests.id, requestId),
        eq(withdrawalRequests.driver_id, driverId)
      ),
      with: {
        paymentMethod: true,
        executions: true,
      },
    });
  } catch (error) {
    console.error('Get withdrawal detail error:', error);
    return null;
  }
}
