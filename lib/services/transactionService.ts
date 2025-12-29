import {
    StoreConfig,
    TransactionSplitResult,
    CalculateSplitParams,
} from '../types/qabum';
import { getStoreConfig, getRiskConfig } from './configService'; // Import getRiskConfig
import { getEthicalCapForSector } from '../utils/ethicalCap';
import { getMerchantSalesSnapshot } from './dataService';
import { MerchantSector } from '../types/risk';

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

    // Load store config (legacy/structural) AND risk config (dynamic overrides)
    const _storeConfig: StoreConfig = getStoreConfig(storeId);
    const riskConfig = await getRiskConfig();

    // Fetch merchant snapshot to determine sector and apply sector-specific ethical cap
    const snapshot = await getMerchantSalesSnapshot({ storeId, merchantId });
    const sector = snapshot.sector as MerchantSector | undefined;

    // Determine ethical cap from dynamic config, fallback to utils if missing/undefined
    let ethicalCap: number;
    if (sector && riskConfig.sectorCaps[sector]) {
        ethicalCap = riskConfig.sectorCaps[sector].ethicalCap;
    } else {
        ethicalCap = getEthicalCapForSector(sector);
    }

    // Use global risk parameters from the dynamic config
    // We prioritize the dynamic config over the hardcoded store config mock
    const globalParams = riskConfig.global;

    // --- 1. Base rates (intended rates) ---
    // 1.1 Bank MDR – highest priority, never altered
    const mdrRate = globalParams.defaultMdr;

    // 1.2 Qabum margin – fixed by config, never altered by the cap logic
    // Keeping the hard 0.7% (0.007) internal cap logic from before if it was intentional business logic? 
    // "Math.min(0.007, config.defaultQabumMarginCap)"
    // I will preserve the 0.007 constraint if it seems like a hard system limit, but use the dynamic config as the source.
    const qabumMarginRate = Math.min(0.007, globalParams.defaultQabumMarginCap);

    // 1.3 Repayment rate – can be reduced to respect the ethical cap
    const originalRepaymentRate = hasActiveAdvance
        ? globalParams.defaultRepaymentRate
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
