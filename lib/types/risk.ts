export type RiskBand = 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL';
export type ReputationTier = 'REP1' | 'REP2' | 'REP3';

export type ReputationReasonCode =
    | 'GOOD_VOLUME'
    | 'MODEST_VOLUME'
    | 'LOW_VOLUME'
    | 'LOW_VOLATILITY'
    | 'MEDIUM_VOLATILITY'
    | 'HIGH_VOLATILITY'
    | 'LONG_TRACK_RECORD'
    | 'MID_TRACK_RECORD'
    | 'SHORT_TRACK_RECORD'
    | 'CONSISTENT_RECENT_ACTIVITY'
    | 'PARTIAL_RECENT_ACTIVITY'
    | 'WEAK_RECENT_ACTIVITY'
    | 'NO_FAILED_SPLITS'
    | 'MINOR_FAILED_SPLITS'
    | 'REPEATED_FAILED_SPLITS'
    | 'RECENT_DROP_PENALTY';

export interface MerchantSalesSnapshot {
    merchantId: string;
    storeId: string;
    averageMonthlyVolume: number;
    monthlyVolatilityIndex: number;
    monthsActive: number;
    recentActiveMonths: number;
    hasRecentDrop: boolean;
    failedSplitCount: number;
    merchantName?: string;
    onboardDate?: string;
    sector?: MerchantSector; // optional sector
}

export interface MerchantRiskProfile {
    merchantId: string;
    storeId: string;
    riskBand: RiskBand;
    maxAdvanceLimit: number;
    recommendedRepaymentRate: number;
    lossProvisionRate: number;
    reasonCodes: string[];
}

export interface ReputationScoreBreakdown {
    volume: number;
    stability: number;
    tenure: number;
    activity: number;
    discipline: number;
    penalties: number;
    total: number;
}

export interface ReputationTierRule {
    tier: ReputationTier;
    minScore: number;
    minMonthsActive: number;
    minRecentActiveMonths: number;
    maxFailedSplits: number;
    requiresNoRecentDrop: boolean;
    summary: string;
}

export interface MerchantReputationProfile {
    merchantId: string;
    storeId: string;
    repTier: ReputationTier;
    repScore: number;
    reasonCodes: ReputationReasonCode[];
    scoreBreakdown: ReputationScoreBreakdown;
}

export interface AdvanceEligibilityResult {
    merchantId: string;
    storeId: string;
    requestedAmount: number;
    isEligible: boolean;
    approvedAmount: number;
    riskProfile: MerchantRiskProfile;
    decisionReason: string;
    estimatedPaybackMonths?: number | null;
    // New audit/visibility fields
    merchantSectorUsed?: MerchantSector;
    ethicalCapUsed?: number;
    riskConfigVersionUsed?: number;
    riskConfigUpdatedAtUsed?: string;
    // Optional: Effective take rate info if calculated during eligibility
    // Note: strictly this belongs to transaction split, but if we clamp repayment rate here,
    // it helps to show the cap used.
}

export type MerchantSector =
    | 'HIGH_SENSITIVITY'    // supermercados, farmacias grandes, mayoristas
    | 'STANDARD_PYME'       // retail y servicios PYME estándar
    | 'HIGH_MARGIN_SERVICE' // restaurantes, turismo, servicios con mayor margen
    ;
