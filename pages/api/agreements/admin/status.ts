import type { NextApiRequest, NextApiResponse } from 'next';
import { hasValidAdminSession } from '../../../../lib/agreements/adminSession';
import {
  CANONICAL_STEVE_AGREEMENT_DOC_URL,
  CARLOS_NOTIFICATION_EMAILS,
  STEVE_PRODUCTION_EMAILS,
  getAgreementsRuntimeStatus,
} from '../../../../lib/agreements/config';
import { STEVE_INITIAL_VERSION_CODE } from '../../../../lib/agreements/versioning';

export default function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'GET') {
    res.setHeader('Allow', ['GET']);
    return res.status(405).json({ ok: false, message: 'Method not allowed' });
  }

  if (!hasValidAdminSession(req)) {
    return res.status(401).json({ ok: false, authenticated: false });
  }

  return res.status(200).json({
    ok: true,
    authenticated: true,
    runtime: getAgreementsRuntimeStatus(),
    canonicalDraft: {
      url: CANONICAL_STEVE_AGREEMENT_DOC_URL,
      plannedInitialVersion: STEVE_INITIAL_VERSION_CODE,
    },
    notifications: {
      carlos: CARLOS_NOTIFICATION_EMAILS,
      testRecipient: '3sbien@gmail.com',
      productionCounterpartyEmailsConfigured: STEVE_PRODUCTION_EMAILS.length,
      productionCounterpartyEmailsExposed: false,
    },
  });
}
