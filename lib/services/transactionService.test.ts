
import { calculateSplit } from './transactionService';
import { getStoreConfig } from './configService';
import { StoreConfig } from '../types/qabum';

// Mock ConfigService to control the environment for tests
jest.mock('./configService');
const mockedGetStoreConfig = getStoreConfig as jest.MockedFunction<typeof getStoreConfig>;

describe('Transaction Split Engine (Module 1)', () => {

    const MOCK_CONFIG_BASE: StoreConfig = {
        id: 'test-store',
        code: 'TEST',
        countryCode: 'EC',
        currencyCode: 'USD',
        takeRateCap: 0.0300,        // 3.00%
        defaultMdr: 0.0220,         // 2.20%
        defaultQabumMarginCap: 0.0150,
        defaultRepaymentRate: 0.0080 // 0.80%
    };

    beforeEach(() => {
        jest.clearAllMocks();
    });

    // CASO A: Transacción normal con adelanto activo.
    // Objetivo: Verificar que sigan configuraciones básicas si no se excede el Cap.
    // Nota: Con la config base (2.20 + 0.80 + 0.70 = 3.70 > 3.00), SIEMPRE se excede.
    // Para probar el caso "Normal", debemos mockear una config donde la suma NO exceda.
    // Ej: MDR 2.00%, Repayment 0.10%, Base Margin 0.70% => Total 2.80% < 3.00%.
    test('A) Normal Transaction: Should apply base rates when total < Cap', async () => {
        mockedGetStoreConfig.mockReturnValue({
            ...MOCK_CONFIG_BASE,
            defaultMdr: 0.0200,      // 2.00%
            defaultRepaymentRate: 0.0010 // 0.10%
        });

        // Margin base in code is 0.0070.
        // Expected Total: 0.0200 + 0.0010 + 0.0070 = 0.0280 (2.80%)

        const result = await calculateSplit({
            transactionAmount: 100.00,
            storeId: 'test-store',
            hasActiveAdvance: true
        });

        expect(result.capExceeded).toBe(false);
        expect(result.effectiveTakeRate).toBeCloseTo(0.0280, 4);
        expect(result.mdrAmount).toBe(2.00); // 100 * 0.02
        expect(result.repaymentAmount).toBe(0.10); // 100 * 0.001
        expect(result.qabumMarginAmount).toBe(0.70); // 100 * 0.007
    });

    // CASO B: Transacción con recorte de Repago (y margenes).
    // Config base: MDR 0.022 + Margin 0.007 + Repay 0.010 = 0.039 > 0.030.
    // Exceso = 0.009.
    // Prioridad 1 Recorte: Repayment. Max available to cut from repay = 0.010.
    // Recortamos 0.009 de Repayment. New Repay = 0.001.
    test('B) Capped Transaction: Should reduce Repayment/Margin to respect Cap', async () => {
        mockedGetStoreConfig.mockReturnValue({
            ...MOCK_CONFIG_BASE,
            defaultMdr: 0.0220,       // 2.20%
            defaultRepaymentRate: 0.0100, // 1.00%
            takeRateCap: 0.0300       // 3.00%
        });

        // Base Calculation:
        // MDR: 0.0220
        // Margin: 0.0070
        // Repayment: 0.0100
        // Total Initial: 0.0390
        // Excess: 0.0090

        // Logic Recortes:
        // 1. Cut Repayment (0.0100). Need to cut 0.0090.
        // New Repayment = 0.0100 - 0.0090 = 0.0010.
        // Excess = 0.

        // Final Rates: MDR 0.0220 + Margin 0.0070 + Repay 0.0010 = 0.0300.

        const result = await calculateSplit({
            transactionAmount: 100.00,
            storeId: 'test-store',
            hasActiveAdvance: true
        });

        expect(result.capExceeded).toBe(true);
        expect(result.effectiveTakeRate).toBeCloseTo(0.0300, 4);
        expect(result.repaymentAmount).toBe(0.10); // 100 * 0.0010
        expect(result.qabumMarginAmount).toBe(0.70); // Unchanged
    });

    // CASO C: Error Fatal (Configuración Inconsistente).
    // MDR + Margin Mínimo > Cap.
    // Code Logic: Margin can be reduced to 0. 
    // So Error triggers if: MDR > Cap.
    test('C) Fatal Error: Should throw if MDR > Cap', async () => {
        mockedGetStoreConfig.mockReturnValue({
            ...MOCK_CONFIG_BASE,
            defaultMdr: 0.0350, // 3.50%
            takeRateCap: 0.0300 // 3.00%
        });

        await expect(calculateSplit({
            transactionAmount: 100.00,
            storeId: 'test-store',
            hasActiveAdvance: true
        })).rejects.toThrow("ERROR FATAL");
    });

});
