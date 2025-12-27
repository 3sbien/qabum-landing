import { MerchantSector } from "../types/risk";

/**
 * Returns the ethical take‑rate cap for a given merchant sector.
 * If the sector is undefined or not recognised, the default STANDARD_PYME cap is used.
 */
export function getEthicalCapForSector(sector?: MerchantSector): number {
    const caps: Record<MerchantSector, number> = {
        HIGH_SENSITIVITY: 0.022,
        STANDARD_PYME: 0.027,
        HIGH_MARGIN_SERVICE: 0.03,
    };
    return sector && caps[sector] ? caps[sector] : caps.STANDARD_PYME;
}
