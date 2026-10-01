import type { NextApiRequest, NextApiResponse } from 'next';
import { clearAdminSession } from '../../../../lib/agreements/adminSession';

export default function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'POST') {
    res.setHeader('Allow', ['POST']);
    return res.status(405).json({ ok: false, message: 'Method not allowed' });
  }

  clearAdminSession(res);
  return res.status(200).json({ ok: true });
}
