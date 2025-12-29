
import { NextApiRequest, NextApiResponse } from 'next';
import { getRiskConfig, updateRiskConfig } from '../../lib/services/configService';
import { validateRiskConfig } from '../../lib/utils/riskConfigValidation';

/**
 * Endpoint for Supra-Admin to get/manage Risk Configuration.
 * AUTH: Requires x-qabum-admin-token header.
 */
export default async function handler(req: NextApiRequest, res: NextApiResponse) {
    const token = req.headers['x-qabum-admin-token'];
    const expectedToken = process.env.QABUM_SUPRA_ADMIN_TOKEN;

    // Fail safe: if no token configured in env, deny everything.
    if (!expectedToken || token !== expectedToken) {
        return res.status(401).json({ message: 'Unauthorized' });
    }

    try {
        if (req.method === 'GET') {
            const config = await getRiskConfig();
            return res.status(200).json(config);
        } else if (req.method === 'PUT') {
            const validation = validateRiskConfig(req.body);
            if (!validation.ok) {
                return res.status(400).json({
                    message: 'Validation failed',
                    errors: validation.errors
                });
            }

            // Extract metadata for audit
            // Note: req.body might contain 'reason' depending on how client sends it, 
            // but validateRiskConfig expects strictly RiskConfig shape? 
            // Actually validateRiskConfig checks the structure. 
            // We should ensure the client sends the config object merged or as a property.
            // The prompt says: "PUT -> accepts JSON body, validates via validateRiskConfig"
            // "reason: optional body.reason string (keep optional)"
            // The validation ignores extra fields? 
            // My validation function checks specific fields but doesn't strictly forbid extras unless I iterate keys.
            // validateRiskConfig: "if (!input || typeof input !== 'object') ... checks props"
            // It does NOT strictly forbid extra props. So body.reason is fine.

            const meta = {
                actor: (req.headers['x-qabum-actor'] as string) || 'supra-admin',
                reason: req.body.reason || 'Admin UI Update',
                userAgent: req.headers['user-agent'] || 'unknown',
                ip: req.socket.remoteAddress || 'unknown'
            };

            await updateRiskConfig(validation.value, meta);
            return res.status(200).json(validation.value);
        } else {
            res.setHeader('Allow', ['GET', 'PUT']);
            return res.status(405).json({ message: `Method ${req.method} Not Allowed` });
        }
    } catch (error) {
        console.error("Config API Error:", error);
        return res.status(500).json({ message: 'Internal Server Error' });
    }
}
