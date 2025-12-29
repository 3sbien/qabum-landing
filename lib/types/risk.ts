export type RiskBand = 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL';

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
