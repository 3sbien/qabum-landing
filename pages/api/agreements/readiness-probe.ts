import type { NextApiRequest, NextApiResponse } from 'next';
import { verifyAgreementsDatabase } from '../../../lib/agreements/db';
import { verifyAgreementsStorage } from '../../../lib/agreements/storage';

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'GET') {
    res.setHeader('Allow', ['GET']);
    return res.status(405).json({ ok: false });
  }

  if (process.env.VERCEL_ENV !== 'preview' || process.env.QABUM_AGREEMENTS_EMAIL_ENABLED === 'true') {
    return res.status(404).json({ ok: false });
  }

  const result = {
    databaseLive: false,
    storageLive: false,
  };

  try {
    result.databaseLive = await verifyAgreementsDatabase();
  } catch {}

  try {
    result.storageLive = await verifyAgreementsStorage();
  } catch {}

  return res.status(result.databaseLive && result.storageLive ? 200 : 503).json({
    ok: result.databaseLive && result.storageLive,
    ...result,
  });
}
