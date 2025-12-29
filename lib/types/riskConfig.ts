
import { MerchantSector } from "./risk";

export interface SectorCapConfig {
    ethicalCap: number;
    maxAdvanceMultipleOfAvgMonthlySales?: number;
}

export interface GlobalRiskConfig {
    defaultMdr: number;
    defaultQabumMarginCap: number;
    defaultRepaymentRate: number;
    maxAdvanceMultipleOfAvgMonthlySales: number;
    minPaybackMonths: number;
    maxPaybackMonths: number;
    minPlatformAgeMonths: number;
    minActiveMonthsLastN: number;
}

export interface RiskConfig {
    version: number;
    updatedAt: string;
    global: GlobalRiskConfig;
    sectorCaps: Record<MerchantSector, SectorCapConfig>;
}
