import type { NextApiRequest, NextApiResponse } from 'next';
import { evaluateAdvanceRequest } from '../../lib/services/riskService';
import { AdvanceEligibilityResult } from '../../lib/types/risk';
import { getRiskConfig } from '../../lib/services/configService';

/**
 * Endpoint API para solicitar una evaluación de elegibilidad de adelanto.
 * Llama al RiskService.
 * RUTA: /api/requestAdvanceEligibility
 */
export default async function handler(req: NextApiRequest, res: NextApiResponse) {
    if (req.method !== 'POST') {
        return res.status(405).json({ message: 'Method Not Allowed' });
    }

    const { storeId, merchantId, requestedAmount } = req.body;

    if (!merchantId || !storeId) {
        return res.status(400).json({ message: 'Store ID and Merchant ID are required.' });
    }

    const amount = Number(requestedAmount) || 0;

    try {
        // Fetch fresh dynamic risk config
        const riskConfig = await getRiskConfig();

        const assessment: AdvanceEligibilityResult = await evaluateAdvanceRequest({
            storeId: storeId as string,
            merchantId: merchantId as string,
            requestedAmount: amount
        }, { riskConfig }); // Pass dynamic config

        // Return the assessment result directly as expected by the UI
        return res.status(200).json(assessment);

    } catch (error) {
        console.error('Error assessing eligibility:', error);
        return res.status(500).json({ message: 'Internal Server Error during risk assessment.' });
    }
}
