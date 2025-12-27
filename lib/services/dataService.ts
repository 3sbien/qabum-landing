import { CalculateSplitParams, TransactionSplitResult } from '../types/qabum';
import { calculateSplit } from './transactionService';
import { MerchantSalesSnapshot } from '../types/risk';

/**
 * Simulación de base de datos: Provee snapshots de ventas de comerciantes.
 * Este módulo imita la consulta a una BD real para obtener el historial necesario
 * para el cálculo de riesgo.
 */

// --- DATOS PARA EL MÓDULO DE RIESGO (Module 4) ---
const merchantData: Record<string, MerchantSalesSnapshot> = {
    // ----------------------------------------------------
    // PERFIL LOW RISK (Cumple todos los criterios)
    // - AVG Volumen: $30,000.00 (Límite Máx. debe ser $30,000.00)
    // - Antigüedad: 24 meses
    // ----------------------------------------------------
    'merch-001': {
        merchantId: 'merch-001',
        storeId: 'ec-qabum-001',
        averageMonthlyVolume: 30000,
        monthlyVolatilityIndex: 0.15, // Baja volatilidad
        monthsActive: 24,
        recentActiveMonths: 3,
        hasRecentDrop: false,
        failedSplitCount: 0,
        sector: 'HIGH_SENSITIVITY',
    },
    // ----------------------------------------------------
    // PERFIL MEDIUM RISK
    // - AVG Volumen: $5,000.00 (Límite Máx. debe ser 70% de 5k = $3,500.00)
    // - Antigüedad: 8 meses
    // ----------------------------------------------------
    'merch-002': {
        merchantId: 'merch-002',
        storeId: 'ec-qabum-001',
        averageMonthlyVolume: 5000,
        monthlyVolatilityIndex: 0.45, // Volatilidad media
        monthsActive: 8,
        recentActiveMonths: 3,
        hasRecentDrop: false,
        failedSplitCount: 1,
        sector: 'STANDARD_PYME',
    },
    // ----------------------------------------------------
    // PERFIL HIGH RISK (Volumen bajo y poca antigüedad)
    // - AVG Volumen: $1,500.00 (Límite Máx. debe ser 40% de 1.5k = $600.00)
    // - Antigüedad: 3 meses
    // ----------------------------------------------------
    'merch-003': {
        merchantId: 'merch-003',
        storeId: 'ec-qabum-001',
        averageMonthlyVolume: 1500,
        monthlyVolatilityIndex: 0.70, // Alta volatilidad
        monthsActive: 3,
        recentActiveMonths: 3,
        hasRecentDrop: true,
        failedSplitCount: 3,
        sector: 'HIGH_MARGIN_SERVICE',
    },
};

// --- Mock para el Split Core (Modules 1-3) ---
const MERCHANT_STATUS_MOCK: Record<string, { hasActiveAdvance: boolean, isEligible: boolean }> = {
    'merch-001': { hasActiveAdvance: true, isEligible: true },
    'merch-002': { hasActiveAdvance: false, isEligible: true },
    'merch-003': { hasActiveAdvance: false, isEligible: false },
};

/**
 * Obtiene el historial de ventas del comerciante para el cálculo de riesgo.
 */
export async function getMerchantSalesSnapshot(params: {
    storeId: string;
    merchantId: string;
}): Promise<MerchantSalesSnapshot> {
    const data = merchantData[params.merchantId];

    if (!data) {
        // Simulación de un comerciante que no existe o es nuevo (Volumen 0, Actividad 0)
        return {
            merchantId: params.merchantId,
            storeId: params.storeId,
            averageMonthlyVolume: 0,
            monthlyVolatilityIndex: 1.0,
            monthsActive: 0,
            recentActiveMonths: 0,
            hasRecentDrop: true,
            failedSplitCount: 10,
        };
    }

    return data;
}

// Exportamos los datos simulados para que la UI pueda acceder a ellos si es necesario
export const simulatedMerchantData = merchantData;


/**
 * 1. Simula el procesamiento completo de una transacción:
 * - Obtiene el estado del merchant.
 * - Llama al motor de cálculo del split.
 * - Simula guardar el resultado auditable en la tabla 'transactions'.
 */
export async function processAndSaveTransaction(
    storeId: string,
    merchantId: string,
    transactionAmount: number
): Promise<TransactionSplitResult> {

    // Simular obtención del estado del merchant (necesario para el split)
    const merchantStatus = MERCHANT_STATUS_MOCK[merchantId] || { hasActiveAdvance: false, isEligible: false };

    const params: CalculateSplitParams = {
        transactionAmount,
        storeId,
        merchantId,
        hasActiveAdvance: merchantStatus.hasActiveAdvance,
    };

    // 2. Llamar al motor de cálculo (la lógica central)
    const splitResult = await calculateSplit(params);

    // 3. SIMULACIÓN DE GUARDADO AUDITABLE
    console.log(`[DB SAVE SUCCESS] Transacción de $${transactionAmount} para ${merchantId} guardada. Take Rate Efectivo: ${splitResult.effectiveTakeRate.toFixed(4)}`);

    return splitResult;
}
