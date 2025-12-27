export interface StoreConfig {
    id: string;
    code: string;
    countryCode: string;
    currencyCode: string;
    takeRateCap: number;
    defaultMdr: number;
    defaultQabumMarginCap: number;
    defaultRepaymentRate: number;
}

export interface TransactionSplitResult {
    grossAmount: number;
    mdrAmount: number;
    qabumMarginAmount: number;
    repaymentAmount: number;
    merchantNetAmount: number;
    effectiveTakeRate: number;
    capExceeded: boolean;
}

export interface CalculateSplitParams {
    transactionAmount: number;
    storeId: string;
    merchantId: string;
    hasActiveAdvance: boolean;
}