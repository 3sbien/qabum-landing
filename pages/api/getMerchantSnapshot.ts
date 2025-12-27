import { NextApiRequest, NextApiResponse } from 'next';
import { getMerchantSalesSnapshot } from '../../lib/services/dataService';

/**
 * Endpoint para obtener el snapshot de ventas de un merchant.
 * Usado por el reporte de Riesgo para mostrar evidencia histórica.
 */
export default async function handler(req: NextApiRequest, res: NextApiResponse) {
    if (req.method !== 'POST') {
        return res.status(405).json({ message: 'Method Not Allowed' });
    }

    try {
        const { storeId, merchantId } = req.body;

        if (!storeId || !merchantId) {
            return res.status(400).json({ message: 'Missing storeId or merchantId' });
        }

        const snapshot = await getMerchantSalesSnapshot({ storeId, merchantId });

        return res.status(200).json(snapshot);

    } catch (error) {
        console.error('Error fetching snapshot:', error);
        return res.status(500).json({ message: 'Internal Server Error' });
    }
}
