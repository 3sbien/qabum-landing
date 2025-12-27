import {
    StoreConfig,
    TransactionSplitResult,
    CalculateSplitParams,
} from '../types/qabum';
import { getStoreConfig } from './configService';
import { getEthicalCapForSector } from '../utils/ethicalCap';
import { getMerchantSalesSnapshot } from './dataService';

/**
 * Función clave para calcular el desglose financiero (split) de una transacción.
 * Sigue la lógica de priorización y cumple estrictamente con el takeRateCap (tope ético).
 *
 * @param params Parámetros de la transacción.
 * @returns El objeto TransactionSplitResult con los montos y la tasa efectiva para auditoría.
 */
export async function calculateSplit(
    params: CalculateSplitParams,
): Promise<TransactionSplitResult> {
    const { transactionAmount, storeId, merchantId, hasActiveAdvance } = params;

    const config: StoreConfig = getStoreConfig(storeId);

    // Fetch merchant snapshot to determine sector and apply sector-specific ethical cap
    const snapshot = await getMerchantSalesSnapshot({ storeId, merchantId });
    const sector = snapshot.sector as any; // MerchantSector (may be undefined)
    const ethicalCap = getEthicalCapForSector(sector);

    // --- 1. Base rates (intended rates) ---
    // 1.1 Bank MDR – highest priority, never altered
    const mdrRate = config.defaultMdr;

    // 1.2 Qabum margin – fixed by config, never altered by the cap logic
    const qabumMarginRate = Math.min(0.007, config.defaultQabumMarginCap);

    // 1.3 Repayment rate – can be reduced to respect the ethical cap
    const originalRepaymentRate = hasActiveAdvance
        ? config.defaultRepaymentRate
        : 0;

    // Compute the total take rate before applying any cap
    const totalTakeRateBeforeCap =
        mdrRate + qabumMarginRate + originalRepaymentRate;

    // Maximum repayment rate that keeps the total within the ethical cap
    const maxRepaymentRate = Math.max(
        0,
        ethicalCap - (mdrRate + qabumMarginRate),
    );

    // Final repayment rate: only reduced if the cap would be exceeded
    const finalRepaymentRate =
        totalTakeRateBeforeCap > ethicalCap
            ? maxRepaymentRate
            : originalRepaymentRate;

    // The real total take rate after applying the (possibly reduced) repayment rate
    const totalTakeRate = mdrRate + qabumMarginRate + finalRepaymentRate;

    // Flag whether the cap was exceeded and we had to adjust the repayment rate
    const capExceeded = totalTakeRateBeforeCap > ethicalCap;

    // --- 2. Calculate monetary amounts (rounded to 2 decimals) ---
    const mdrAmount =
        Math.round(transactionAmount * mdrRate * 100) / 100;
    const qabumMarginAmount =
        Math.round(transactionAmount * qabumMarginRate * 100) / 100;
    const repaymentAmount =
        Math.round(transactionAmount * finalRepaymentRate * 100) / 100;

    // Total deductions and merchant net amount
    const totalDeductions =
        mdrAmount + qabumMarginAmount + repaymentAmount;
    const merchantNetAmount =
        Math.round((transactionAmount - totalDeductions) * 100) / 100;

    // Effective take rate for audit purposes (no variable duplicada)
    // NOTE: property name can be "effectiveTakeRate", the problem was only the variable.
    //       Here we compute it inline when returning the result.

    // --- 3. Return result ---
    // NOTE: The repayment rate exposed to the front-end is the final (capped) value.
    return {
        grossAmount: transactionAmount,
        mdrAmount,
        qabumMarginAmount,
        repaymentAmount,
        // Expose the final (capped) repayment rate for the UI
        recommendedRepaymentRate: finalRepaymentRate,
        merchantNetAmount,
        effectiveTakeRate: totalDeductions / transactionAmount,
        capExceeded,
    };
}
