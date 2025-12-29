import { getMerchantSalesSnapshot } from './dataService';
import {
    MerchantRiskProfile,
    AdvanceEligibilityResult,
    MerchantSalesSnapshot,
    RiskBand,
    MerchantSector
} from '../types/risk';
import { getRiskConfig } from './configService';
import { RiskConfig } from '../types/riskConfig';
import { getEthicalCapForSector } from '../utils/ethicalCap';

/**
 * Mapea el perfil de riesgo basándose en el snapshot de ventas del comerciante.
 * @param snapshot Datos de ventas.
 * @param config Configuración de riesgo dinámica.
 * @returns MerchantRiskProfile con límites y tasas.
 */
function deriveRiskProfile(snapshot: MerchantSalesSnapshot, config: RiskConfig): MerchantRiskProfile {
    const {
        averageMonthlyVolume,
        monthlyVolatilityIndex,
        monthsActive,
        hasRecentDrop,
        failedSplitCount,
        merchantId,
        storeId,
        sector
    } = snapshot;

    let riskBand: RiskBand = 'HIGH';
    // Use dynamic default repayment rate from config
    let recommendedRepaymentRate = config.global.defaultRepaymentRate;
    let lossProvisionRate = 0.06; // 6%
    const reasonCodes: string[] = [];

    // Base max advance calculation helpers
    // We respect the multipliers but cap them at the global max multiple
    const globalMaxMult = config.global.maxAdvanceMultipleOfAvgMonthlySales;

    const applyCap = (mult: number) => Math.min(mult, globalMaxMult);

    let maxAdvanceLimit = averageMonthlyVolume * applyCap(0.4);

    // --- Reglas de LOW RISK ---
    if (
        averageMonthlyVolume >= 8000 &&
        monthlyVolatilityIndex <= 0.3 &&
        monthsActive >= 12 &&
        hasRecentDrop === false &&
        failedSplitCount === 0
    ) {
        riskBand = 'LOW';
        maxAdvanceLimit = averageMonthlyVolume * applyCap(1.0); // 100% del volumen (capped globally)
        recommendedRepaymentRate = 0.010; // 1.0%
        // NOTE: Specific band rates override global default if logic dictates, 
        // but we must still respect ethical cap (calculated below).
        lossProvisionRate = 0.01; // 1%
        reasonCodes.push('LOW_RISK_PROFILE');

        // --- Reglas de MEDIUM RISK ---
    } else if (
        averageMonthlyVolume >= 3000 &&
        monthsActive >= 6
    ) {
        riskBand = 'MEDIUM';
        maxAdvanceLimit = averageMonthlyVolume * applyCap(0.7); // 70% del volumen (capped)
        recommendedRepaymentRate = 0.008; // 0.8%
        lossProvisionRate = 0.03; // 3%
        if (monthlyVolatilityIndex > 0.4) reasonCodes.push('HIGH_VOLATILITY');
        if (monthsActive < 12) reasonCodes.push('INTERMEDIATE_HISTORY');
        if (failedSplitCount > 0) reasonCodes.push('FAILED_SPLITS_LITE');

        // --- Reglas de HIGH RISK (Default) ---
    } else {
        // HIGH RISK settings ya inicializados arriba (uses defaultRepaymentRate from config)
        if (averageMonthlyVolume < 3000) reasonCodes.push('LOW_VOLUME');
        if (monthsActive < 6) reasonCodes.push('SHORT_HISTORY');
        if (hasRecentDrop) reasonCodes.push('RECENT_DROP');
        if (failedSplitCount >= 3) reasonCodes.push('FAILED_SPLITS_HIGH');
        if (monthlyVolatilityIndex > 0.6) reasonCodes.push('CRITICAL_VOLATILITY');
    }

    // --- CLAMP REPAYMENT RATE BY ETHICAL CAP ---
    if (sector) { // Only if sector is known
        let ethicalCap = getEthicalCapForSector(sector); // Fallback
        if (config.sectorCaps && config.sectorCaps[sector]) {
            ethicalCap = config.sectorCaps[sector].ethicalCap;
        }

        const mdr = config.global.defaultMdr;
        const marginCap = Math.min(0.007, config.global.defaultQabumMarginCap);

        // Max repayment = EthicalCap - MDR - Margin
        const maxRepayment = Math.max(0, ethicalCap - (mdr + marginCap));

        if (recommendedRepaymentRate > maxRepayment) {
            recommendedRepaymentRate = maxRepayment;
            // reasonCodes.push('REPAYMENT_CAPPED_ETHICAL'); // Optional info
        }
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
}, opts?: { riskConfig?: RiskConfig }): Promise<MerchantRiskProfile> {
    const snapshot = await getMerchantSalesSnapshot(params);
    // Reuse config if passed, else fetch fresh
    const config = opts?.riskConfig ?? await getRiskConfig();
    return deriveRiskProfile(snapshot, config);
}

/**
 * Evalúa si una solicitud de adelanto es elegible y determina el monto final aprobado.
 */
export async function evaluateAdvanceRequest(params: {
    storeId: string;
    merchantId: string;
    requestedAmount: number;
}, opts?: { riskConfig?: RiskConfig }): Promise<AdvanceEligibilityResult> {
    const { storeId, merchantId, requestedAmount } = params;

    // 1. Get Config (Pass through or fresh load)
    const config = opts?.riskConfig ?? await getRiskConfig();

    // 2. Obtener Snapshot Raw para verificaciones duras
    const snapshot = await getMerchantSalesSnapshot({ storeId, merchantId });
    // 3. Derivar Perfil de Riesgo (calculates limits and clamped rates)
    const profile = deriveRiskProfile(snapshot, config);

    let isEligible = false;
    let approvedAmount = 0;
    let decisionReason = 'NOT ELIGIBLE / NO ELEGIBLE';

    // Helper for formatting USD
    const fmt = (num: number) => `USD ${num.toLocaleString('en-US', { minimumFractionDigits: 2 })}`;

    // --- REGLA DE ACTIVIDAD MÍNIMA ---
    // Debe tener al menos X meses de historia Y ventas continuas en los últimos Y meses (Dynamic)
    const minAge = config.global.minPlatformAgeMonths;
    const minActive = config.global.minActiveMonthsLastN;

    const hasSufficientHistory = snapshot.monthsActive >= minAge;
    const hasRecentActivity = snapshot.recentActiveMonths >= minActive;

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
            decisionReason: `NO ELEGIBLE: la cuenta tiene ${snapshot.monthsActive} meses (min: ${minAge}), y registro de ventas en ${snapshot.recentActiveMonths} de los últimos periodos requeridos (min: ${minActive}).`,
            // Audit fields
            riskConfigVersionUsed: config.version,
            riskConfigUpdatedAtUsed: config.updatedAt,
            merchantSectorUsed: snapshot.sector,
            ethicalCapUsed: getEcUsed(snapshot.sector, config),
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
        // Audit fields
        merchantSectorUsed: snapshot.sector,
        ethicalCapUsed: getEcUsed(snapshot.sector, config),
        riskConfigVersionUsed: config.version,
        riskConfigUpdatedAtUsed: config.updatedAt,
    };
}

function getEcUsed(sector: MerchantSector | undefined, config: RiskConfig): number | undefined {
    if (!sector) return undefined;
    if (config.sectorCaps && config.sectorCaps[sector]) {
        return config.sectorCaps[sector].ethicalCap;
    }
    return getEthicalCapForSector(sector);
}
