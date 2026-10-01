import type { NextApiRequest, NextApiResponse } from 'next';
import { issueAdminSession, verifyAdminPassword } from '../../../../lib/agreements/adminSession';

export default function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'POST') {
    res.setHeader('Allow', ['POST']);
    return res.status(405).json({ ok: false, message: 'Method not allowed' });
  }

  const password = typeof req.body?.password === 'string' ? req.body.password : '';

  if (!verifyAdminPassword(password)) {
    return res.status(401).json({ ok: false, message: 'Invalid credentials' });
  }

  issueAdminSession(res);
  return res.status(200).json({ ok: true });
}
