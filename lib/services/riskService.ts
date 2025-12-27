import { getMerchantSalesSnapshot } from './dataService';
import {
    MerchantRiskProfile,
    AdvanceEligibilityResult,
    MerchantSalesSnapshot,
    RiskBand
} from '../types/risk';

/**
 * Mapea el perfil de riesgo basándose en el snapshot de ventas del comerciante.
 * @param snapshot Datos de ventas.
 * @returns MerchantRiskProfile con límites y tasas.
 */
function deriveRiskProfile(snapshot: MerchantSalesSnapshot): MerchantRiskProfile {
    const {
        averageMonthlyVolume,
        monthlyVolatilityIndex,
        monthsActive,
        hasRecentDrop,
        failedSplitCount,
        merchantId,
        storeId
    } = snapshot;

    let riskBand: RiskBand = 'HIGH';
    let maxAdvanceLimit = averageMonthlyVolume * 0.4;
    let recommendedRepaymentRate = 0.005; // 0.5%
    let lossProvisionRate = 0.06; // 6%
    const reasonCodes: string[] = [];

    // --- Reglas de LOW RISK ---
    if (
        averageMonthlyVolume >= 8000 &&
        monthlyVolatilityIndex <= 0.3 &&
        monthsActive >= 12 &&
        hasRecentDrop === false &&
        failedSplitCount === 0
    ) {
        riskBand = 'LOW';
        maxAdvanceLimit = averageMonthlyVolume * 1.0; // 100% del volumen
        recommendedRepaymentRate = 0.010; // 1.0%
        lossProvisionRate = 0.01; // 1%
        reasonCodes.push('LOW_RISK_PROFILE');

        // --- Reglas de MEDIUM RISK ---
    } else if (
        averageMonthlyVolume >= 3000 &&
        monthsActive >= 6
    ) {
        riskBand = 'MEDIUM';
        maxAdvanceLimit = averageMonthlyVolume * 0.7; // 70% del volumen
        recommendedRepaymentRate = 0.008; // 0.8%
        lossProvisionRate = 0.03; // 3%
        if (monthlyVolatilityIndex > 0.4) reasonCodes.push('HIGH_VOLATILITY');
        if (monthsActive < 12) reasonCodes.push('INTERMEDIATE_HISTORY');
        if (failedSplitCount > 0) reasonCodes.push('FAILED_SPLITS_LITE');

        // --- Reglas de HIGH RISK (Default) ---
    } else {
        // HIGH RISK settings ya inicializados arriba (0.4x volumen, 0.5% Repayment, 6% Loss Prov)
        if (averageMonthlyVolume < 3000) reasonCodes.push('LOW_VOLUME');
        if (monthsActive < 6) reasonCodes.push('SHORT_HISTORY');
        if (hasRecentDrop) reasonCodes.push('RECENT_DROP');
        if (failedSplitCount >= 3) reasonCodes.push('FAILED_SPLITS_HIGH');
        if (monthlyVolatilityIndex > 0.6) reasonCodes.push('CRITICAL_VOLATILITY');
    }

    return {
        merchantId,
        storeId,
        riskBand,
        maxAdvanceLimit: Math.floor(maxAdvanceLimit), // Redondeamos límite a entero
        recommendedRepaymentRate,
        lossProvisionRate,
        reasonCodes,
    };
}

/**
 * Obtiene el Perfil de Riesgo del comerciante.
 */
export async function getMerchantRiskProfile(params: {
    storeId: string;
    merchantId: string;
}): Promise<MerchantRiskProfile> {
    const snapshot = await getMerchantSalesSnapshot(params);
    return deriveRiskProfile(snapshot);
}

/**
 * Evalúa si una solicitud de adelanto es elegible y determina el monto final aprobado.
 */
export async function evaluateAdvanceRequest(params: {
    storeId: string;
    merchantId: string;
    requestedAmount: number;
}): Promise<AdvanceEligibilityResult> {
    const { storeId, merchantId, requestedAmount } = params;

    // 1. Obtener Snapshot Raw para verificaciones duras
    const snapshot = await getMerchantSalesSnapshot({ storeId, merchantId });
    // 2. Derivar Perfil de Riesgo
    const profile = deriveRiskProfile(snapshot);

    let isEligible = false;
    let approvedAmount = 0;
    let decisionReason = 'NOT ELIGIBLE / NO ELEGIBLE';

    // Helper for formatting USD
    const fmt = (num: number) => `USD ${num.toLocaleString('en-US', { minimumFractionDigits: 2 })}`;

    // --- REGLA DE ACTIVIDAD MÍNIMA ---
    // Debe tener al menos 3 meses de historia Y ventas continuas en los últimos 3 meses
    const hasSufficientHistory = snapshot.monthsActive >= 3;
    const hasRecentActivity = snapshot.recentActiveMonths >= 3;

    if (!hasSufficientHistory || !hasRecentActivity) {
        return {
            merchantId,
            storeId,
            requestedAmount,
            isEligible: false,
            approvedAmount: 0,
            riskProfile: {
                ...profile,
                maxAdvanceLimit: 0, // Forzar límite a 0
            },
            decisionReason: `NO ELEGIBLE: la cuenta tiene ${snapshot.monthsActive} meses, pero no registra ventas continuas en los últimos 3 meses.`,
        };
    }

    if (profile.riskBand === 'LOW') {
        if (requestedAmount <= profile.maxAdvanceLimit) {
            isEligible = true;
            approvedAmount = requestedAmount;
            decisionReason = `Requested: ${fmt(requestedAmount)}. Limit: ${fmt(profile.maxAdvanceLimit)}. Approved: full requested amount.`;
        } else {
            isEligible = true;
            approvedAmount = profile.maxAdvanceLimit;
            decisionReason = `Requested: ${fmt(requestedAmount)}. Limit: ${fmt(profile.maxAdvanceLimit)}. Approved: capped at limit.`;
        }
    } else if (profile.riskBand === 'MEDIUM') {
        if (requestedAmount <= profile.maxAdvanceLimit) {
            isEligible = true;
            approvedAmount = requestedAmount;
            decisionReason = `Requested: ${fmt(requestedAmount)}. Limit: ${fmt(profile.maxAdvanceLimit)}. Approved: full requested amount.`;
        } else {
            isEligible = false;
            approvedAmount = 0;
            decisionReason = `Requested: ${fmt(requestedAmount)}. Limit: ${fmt(profile.maxAdvanceLimit)}. Approved: NO (exceeds limit).`;
        }
    } else { // HIGH Risk
        // Solo permite el 50% del Max Advance Limit para HIGH risk
        const highRiskCap = profile.maxAdvanceLimit * 0.5;
        if (requestedAmount <= highRiskCap) {
            isEligible = true;
            approvedAmount = requestedAmount;
            decisionReason = `Requested: ${fmt(requestedAmount)}. Limit: ${fmt(highRiskCap)} (High Risk Cap). Approved: full requested amount.`;
        } else {
            isEligible = false;
            approvedAmount = 0;
            decisionReason = `Requested: ${fmt(requestedAmount)}. Limit: ${fmt(highRiskCap)} (High Risk Cap). Approved: NO (exceeds strict cap).`;
        }
    }

    // Calculate estimated payback in months
    // estimatedPaybackMonths is an estimation based on approvedAmount,
    // averageMonthlyVolume and recommendedRepaymentRate, assuming stable sales.
    let estimatedPaybackMonths: number | null = null;
    const avgMonthlyVolume = snapshot.averageMonthlyVolume ?? 0;
    const recommendedRate = profile.recommendedRepaymentRate;

    if (approvedAmount > 0 && avgMonthlyVolume > 0 && recommendedRate > 0) {
        const monthlyRepayment = avgMonthlyVolume * recommendedRate;
        if (monthlyRepayment > 0) {
            estimatedPaybackMonths = approvedAmount / monthlyRepayment;
        }
    }

    return {
        merchantId,
        storeId,
        requestedAmount,
        isEligible,
        approvedAmount: isEligible ? Math.floor(approvedAmount) : 0, // Redondeamos a entero si es aprobado
        riskProfile: profile,
        decisionReason,
        estimatedPaybackMonths,
    };
}
