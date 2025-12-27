

declare var process: any;
import { calculateSplit } from './lib/services/transactionService';

async function runTests() {
    console.log("--- INICIANDO VERIFICACIÓN MANUAL DEL MOTOR DE SPLIT ---");
    let failures = 0;

    // --- CASO A: Normal Transaction ---
    try {
        console.log("\n[TEST A] Transacción Normal (Sin tope)...");
        const result = await calculateSplit({
            transactionAmount: 100.00,
            storeId: 'test-case-a',
            merchantId: 'test-merchant-a',
            hasActiveAdvance: true
        });

        const expectedTotal = 0.0200 + 0.0010 + 0.0070; // 0.0280
        if (!result.capExceeded && Math.abs(result.effectiveTakeRate - expectedTotal) < 0.0001) {
            console.log("PASS: Cálculo correcto. Rate:", result.effectiveTakeRate);
        } else {
            console.error("FAIL: Resultado inesperado.", result);
            failures++;
        }
    } catch (e) {
        console.error("FAIL: Error excepción en caso A.", e);
        failures++;
    }

    // --- CASO B: Capped Transaction ---
    try {
        console.log("\n[TEST B] Transacción con Recorte (Cap Exceeded)...");
        // Using ec-qabum-001 (MDR 2.20, Margin 0.70, Repay 0.80 => Total 3.70 > 3.00)
        const result = await calculateSplit({
            transactionAmount: 100.00,
            storeId: 'ec-qabum-001',
            merchantId: 'test-merchant-b',
            hasActiveAdvance: true
        });

        if (result.capExceeded && Math.abs(result.effectiveTakeRate - 0.0300) < 0.0001) {
            console.log("PASS: Recorte aplicado correctamente a 3.00%.");
            // Verificar prioridades: Repay debe haber bajado.
            // Original Repay 0.80%. Excess 0.70%. Repay reduced by 0.70% => 0.10%.
            // 100 * 0.0010 = 0.10.
            if (Math.abs(result.repaymentAmount - 0.10) < 0.02) {
                console.log("PASS: Recorte aplicado a Repayment prioritariamente.");
            } else {
                console.error("FAIL: Repayment amount incorrecto.", result.repaymentAmount);
                failures++;
            }
        } else {
            console.error("FAIL: No se aplicó el Cap correctamente.", result);
            failures++;
        }
    } catch (e) {
        console.error("FAIL: Error excepción en caso B.", e);
        failures++;
    }

    // --- CASO C: Error Fatal ---
    try {
        console.log("\n[TEST C] Error Fatal (MDR > Cap)...");
        await calculateSplit({
            transactionAmount: 100.00,
            storeId: 'test-case-c',
            merchantId: 'test-merchant-c',
            hasActiveAdvance: true
        });
        console.error("FAIL: Debería haber lanzado error FATAL.");
        failures++;
    } catch (e: any) {
        if (e.message && e.message.includes("ERROR FATAL")) {
            console.log("PASS: Error Fatal capturado correctamente.");
        } else {
            console.error("FAIL: Error capturado incorrecto.", e);
            failures++;
        }
    }

    console.log("\n--- RESULTADO FINAL ---");
    if (failures === 0) {
        console.log("✅ TODO CORRECTO: El motor funciona según las especificaciones.");
        process.exit(0);
    } else {
        console.error(`❌ FALLO: Se encontraron ${failures} errores.`);
        process.exit(1);
    }
}

runTests();
