
import { RiskConfig, GlobalRiskConfig, SectorCapConfig } from "../types/riskConfig";
import { MerchantSector } from "../types/risk";

const KNOWN_SECTORS: MerchantSector[] = [
    'HIGH_SENSITIVITY',
    'STANDARD_PYME',
    'HIGH_MARGIN_SERVICE'
];

/**
 * Helper to coerce input to a finite number.
 * Accepts numbers or strings (handles comma as decimal separator).
 */
function coerceDecimal(value: any): number | null {
    if (typeof value === 'number') {
        return Number.isFinite(value) ? value : null;
    }
    if (typeof value === 'string') {
        const normalized = value.trim().replace(',', '.');
        if (normalized === '') return null;
        const parsed = parseFloat(normalized);
        return Number.isFinite(parsed) ? parsed : null;
    }
    return null;
}

/**
 * Helper to coerce input to a finite integer.
 */
function coerceInt(value: any): number | null {
    const dec = coerceDecimal(value);
    if (dec === null) return null;
    return Number.isInteger(dec) ? dec : Math.round(dec); // Allow rounding or strict? 
    // Requirement says "integer". Let's restrict to safe integers.
    // Actually, best to just check isInteger after parse.
    // But if someone types "3.0" it should be 3.
    // Let's safe-guard:
    const intVal = Math.round(dec);
    return Number.isSafeInteger(intVal) ? intVal : null;
}

function validateGlobalConfig(global: any): { errors: string[], cleanGlobal: GlobalRiskConfig | null } {
    const errors: string[] = [];
    if (!global || typeof global !== 'object') {
        return { errors: ["Missing global config"], cleanGlobal: null };
    }

    const clean: any = {};

    // defaultMdr
    const defaultMdr = coerceDecimal(global.defaultMdr);
    if (defaultMdr === null || defaultMdr < 0 || defaultMdr > 1) {
        errors.push("defaultMdr must be a finite number between 0 and 1");
    } else {
        clean.defaultMdr = defaultMdr;
    }

    // defaultQabumMarginCap
    const defaultQabumMarginCap = coerceDecimal(global.defaultQabumMarginCap);
    if (defaultQabumMarginCap === null || defaultQabumMarginCap < 0 || defaultQabumMarginCap > 1) {
        errors.push("defaultQabumMarginCap must be a finite number between 0 and 1");
    } else {
        clean.defaultQabumMarginCap = defaultQabumMarginCap;
    }

    // defaultRepaymentRate
    const defaultRepaymentRate = coerceDecimal(global.defaultRepaymentRate);
    if (defaultRepaymentRate === null || defaultRepaymentRate < 0 || defaultRepaymentRate > 1) {
        errors.push("defaultRepaymentRate must be a finite number between 0 and 1");
    } else {
        clean.defaultRepaymentRate = defaultRepaymentRate;
    }

    // maxAdvanceMultipleOfAvgMonthlySales
    const maxVal = coerceDecimal(global.maxAdvanceMultipleOfAvgMonthlySales);
    if (maxVal === null || maxVal <= 0 || maxVal > 10) {
        errors.push("maxAdvanceMultipleOfAvgMonthlySales must be a number > 0 and <= 10");
    } else {
        clean.maxAdvanceMultipleOfAvgMonthlySales = maxVal;
    }

    // minPaybackMonths
    const minPay = coerceInt(global.minPaybackMonths);
    if (minPay === null || minPay < 1 || minPay > 60) {
        errors.push("minPaybackMonths must be an integer between 1 and 60");
    } else {
        clean.minPaybackMonths = minPay;
    }

    // maxPaybackMonths - depends on minPay existence, so check generic range first
    const maxPay = coerceInt(global.maxPaybackMonths);
    if (maxPay === null || maxPay > 60) { // Lower bound check needs minPay
        errors.push("maxPaybackMonths must be an integer <= 60");
    } else if (clean.minPaybackMonths && maxPay < clean.minPaybackMonths) {
        errors.push("maxPaybackMonths must be >= minPaybackMonths");
    } else {
        clean.maxPaybackMonths = maxPay;
    }

    // minPlatformAgeMonths
    const minAge = coerceInt(global.minPlatformAgeMonths);
    if (minAge === null || minAge < 0 || minAge > 60) {
        errors.push("minPlatformAgeMonths must be an integer between 0 and 60");
    } else {
        clean.minPlatformAgeMonths = minAge;
    }

    // minActiveMonthsLastN
    const minActive = coerceInt(global.minActiveMonthsLastN);
    if (minActive === null || minActive < 0 || minActive > 24) {
        errors.push("minActiveMonthsLastN must be an integer between 0 and 24");
    } else {
        clean.minActiveMonthsLastN = minActive;
    }

    if (errors.length > 0) return { errors, cleanGlobal: null };
    return { errors: [], cleanGlobal: clean as GlobalRiskConfig };
}

function validateSectorCaps(caps: any): { errors: string[], cleanCaps: Record<MerchantSector, SectorCapConfig> | null } {
    const errors: string[] = [];
    if (!caps || typeof caps !== 'object') {
        return { errors: ["Missing sectorCaps"], cleanCaps: null };
    }

    const clean: any = {};

    for (const sector of KNOWN_SECTORS) {
        if (!caps[sector]) {
            errors.push(`Missing config for sector: ${sector}`);
            continue;
        }

        const rawCap = caps[sector];
        const sectorClean: any = {};

        // ethicalCap
        const ethicalCap = coerceDecimal(rawCap.ethicalCap);
        if (ethicalCap === null || ethicalCap < 0 || ethicalCap > 1) {
            errors.push(`Sector ${sector}: ethicalCap must be a finite number between 0 and 1`);
        } else {
            sectorClean.ethicalCap = ethicalCap;
        }

        // maxAdvanceMultipleOfAvgMonthlySales (optional)
        if (rawCap.maxAdvanceMultipleOfAvgMonthlySales !== undefined && rawCap.maxAdvanceMultipleOfAvgMonthlySales !== null && rawCap.maxAdvanceMultipleOfAvgMonthlySales !== "") {
            const secMax = coerceDecimal(rawCap.maxAdvanceMultipleOfAvgMonthlySales);
            if (secMax === null || secMax <= 0 || secMax > 10) {
                errors.push(`Sector ${sector}: maxAdvanceMultipleOfAvgMonthlySales must be > 0 and <= 10`);
            } else {
                sectorClean.maxAdvanceMultipleOfAvgMonthlySales = secMax;
            }
        }

        clean[sector] = sectorClean;
    }

    if (errors.length > 0) return { errors, cleanCaps: null };
    return { errors: [], cleanCaps: clean };
}

export function validateRiskConfig(input: any): { ok: true; value: RiskConfig } | { ok: false; errors: string[] } {
    const errors: string[] = [];

    if (!input || typeof input !== 'object') {
        return { ok: false, errors: ["Invalid input object"] };
    }

    // Version
    const version = coerceInt(input.version);
    if (version === null || version < 1) {
        errors.push("Version must be an integer >= 1");
    }

    // UpdatedAt
    // We treat strict string or just pass it through; configService updates it anyway. 
    // But validation should allow it to be anything or string.

    // Global
    const globalRes = validateGlobalConfig(input.global);
    if (globalRes.errors.length > 0) {
        errors.push(...globalRes.errors);
    }

    // Sector Caps
    const capsRes = validateSectorCaps(input.sectorCaps);
    if (capsRes.errors.length > 0) {
        errors.push(...capsRes.errors);
    }

    if (errors.length > 0) {
        return { ok: false, errors };
    }

    // Construct the clean config
    const cleanConfig: RiskConfig = {
        version: version!, // asserted safe by check above
        updatedAt: input.updatedAt || new Date().toISOString(),
        global: globalRes.cleanGlobal!,
        sectorCaps: capsRes.cleanCaps!
    };

    return { ok: true, value: cleanConfig };
}
