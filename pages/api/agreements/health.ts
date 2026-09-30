import type { NextApiRequest, NextApiResponse } from 'next';
import { getAgreementsRuntimeStatus } from '../../../lib/agreements/config';

export default function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'GET') {
    res.setHeader('Allow', ['GET']);
    return res.status(405).json({ ok: false });
  }

  const status = getAgreementsRuntimeStatus();

  return res.status(200).json({
    ok: true,
    module: 'agreements',
    mode: status.emailEnabled ? 'production-email-enabled' : 'safe-test',
    databaseConfigured: status.databaseConfigured,
    canonicalGoogleDocConfigured: status.canonicalGoogleDocConfigured,
    emailEnabled: status.emailEnabled,
    testRecipient: status.testRecipient,
  });
}
