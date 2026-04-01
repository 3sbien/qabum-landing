import { NextApiRequest, NextApiResponse } from 'next';
import { getMerchantReputationProfile } from '../../lib/services/reputationService';

/**
 * Endpoint para obtener el perfil reputacional de un merchant.
 * Usado por el back-office para mostrar REP tier, score y reasons.
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

        const reputation = await getMerchantReputationProfile({ storeId, merchantId });
        return res.status(200).json(reputation);
    } catch (error) {
        console.error('Error fetching merchant reputation:', error);
        return res.status(500).json({ message: 'Internal Server Error' });
    }
}
