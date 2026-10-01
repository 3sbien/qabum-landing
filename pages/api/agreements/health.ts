import type { NextApiRequest, NextApiResponse } from 'next';
import { getAgreementsRuntimeStatus } from '../../../lib/agreements/config';
import { verifyAgreementsDatabase } from '../../../lib/agreements/db';
import { verifyAgreementsStorage } from '../../../lib/agreements/storage';

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'GET') {
    res.setHeader('Allow', ['GET']);
    return res.status(405).json({ ok: false });
  }

  const status = getAgreementsRuntimeStatus();
  let databaseLive = false;
  let storageLive = false;

  if (process.env.VERCEL_ENV === 'preview') {
    try {
      databaseLive = await verifyAgreementsDatabase();
    } catch {}

    try {
      storageLive = await verifyAgreementsStorage();
    } catch {}
  }

  res.setHeader('Cache-Control', 'no-store');

  return res.status(200).json({
    ok: true,
    module: 'agreements',
    mode: status.emailEnabled ? 'production-email-enabled' : 'safe-test',
    databaseConfigured: status.databaseConfigured,
    databaseLive,
    storageConfigured: status.storageConfigured,
    storageLive,
    canonicalGoogleDocConfigured: status.canonicalGoogleDocConfigured,
    emailEnabled: status.emailEnabled,
    adminPasswordConfigured: Boolean(process.env.QABUM_AGREEMENTS_ADMIN_PASSWORD),
    adminSecretConfigured: Boolean(process.env.QABUM_AGREEMENTS_ADMIN_SECRET),
    testRecipient: status.testRecipient,
  });
}
