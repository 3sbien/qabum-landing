import { NextApiRequest, NextApiResponse } from 'next';
import { processAndSaveTransaction, getMerchantSalesSnapshot } from '../../lib/services/dataService';

/**
 * Endpoint de la API para procesar una nueva transacción.
 * Método: POST
 * Ruta: /api/processTransaction
 *
 * Simula la entrada de datos desde el frontend para ejecutar el Core Financiero.
 */
export default async function handler(req: NextApiRequest, res: NextApiResponse) {
    if (req.method !== 'POST') {
        return res.status(405).json({ message: 'Method Not Allowed. Use POST.' });
    }

    try {
        const { storeId, merchantId, transactionAmount } = req.body;

        if (!storeId || !merchantId || typeof transactionAmount !== 'number') {
            return res.status(400).json({ message: 'Missing required fields: storeId, merchantId, or transactionAmount.' });
        }

        // Llamada al servicio DAO que ejecuta el motor de split
        const splitResult = await processAndSaveTransaction(storeId, merchantId, transactionAmount);

        // EXTRA: Obtener snapshot para que la UI pueda simular el "Avg Monthly Volume"
        // Esto es un hack para la verificación UI; en prod sería un endpoint separado.
        const snapshot = await getMerchantSalesSnapshot({ storeId, merchantId });

        return res.status(200).json({
            message: 'Transaction processed successfully and split recorded.',
            data: {
                ...splitResult,
                averageMonthlyVolume: snapshot.averageMonthlyVolume // Injecting volume for UI
            }
        });

    } catch (error) {
        console.error('API Error processing transaction:', error);
        const errorMessage = error instanceof Error ? error.message : 'An unknown error occurred';
        return res.status(500).json({ message: 'Failed to process transaction due to internal error', error: errorMessage });
    }
}
