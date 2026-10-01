import type { AgreementsRuntimeStatus } from './types';
import { isAgreementsStorageConfigured } from './storage';

export const AGREEMENTS_FROM_EMAIL = 'cfounder@qabum.com';
export const AGREEMENTS_BCC_EMAIL = '3sbien@gmail.com';
export const AGREEMENTS_TEST_RECIPIENT = '3sbien@gmail.com';
export const CARLOS_NOTIFICATION_EMAILS = [
  'carloslandazuri@gmail.com',
  'cfounder@qabum.com',
] as const;

// These addresses are stored for future production configuration only.
// They MUST NOT be used by test or preview email flows.
export const STEVE_PRODUCTION_EMAILS = [
  'stevedale71@gmail.com',
  'stevebreeder@gmail.com',
] as const;

export const CANONICAL_STEVE_AGREEMENT_DOC_ID =
  '1l4ysOvMHlUyNUdYJzUn4dCXXOPY3JoxEMzqfe_oEZA8';

export const CANONICAL_STEVE_AGREEMENT_DOC_URL =
  'https://docs.google.com/document/d/1l4ysOvMHlUyNUdYJzUn4dCXXOPY3JoxEMzqfe_oEZA8/edit';

export function getAgreementsRuntimeStatus(): AgreementsRuntimeStatus {
  const emailEnabled = process.env.QABUM_AGREEMENTS_EMAIL_ENABLED === 'true';

  return {
    databaseConfigured: Boolean(process.env.QABUM_AGREEMENTS_DATABASE_URL),
    storageConfigured: isAgreementsStorageConfigured(),
    canonicalGoogleDocConfigured: true,
    emailEnabled,
    emailProviderConfigured: Boolean(process.env.QABUM_RESEND_API_KEY),
    testRecipient: AGREEMENTS_TEST_RECIPIENT,
    productionRecipientsLocked: !emailEnabled,
  };
}

export function normalizeAgreementRecipients(emails: string[]): string[] {
  const normalized = emails
    .map((email) => email.trim().toLowerCase())
    .filter(Boolean);

  return [...new Set(normalized)];
}

export function assertSafeEmailRecipients(emails: string[]): void {
  if (process.env.QABUM_AGREEMENTS_EMAIL_ENABLED === 'true') {
    return;
  }

  const recipients = normalizeAgreementRecipients(emails);
  if (
    recipients.length !== 1 ||
    recipients[0] !== AGREEMENTS_TEST_RECIPIENT
  ) {
    throw new Error(
      'Agreements email is in safe test mode. Only 3sbien@gmail.com may receive messages.',
    );
  }
}

export function assertSafeEmailRecipient(email: string): void {
  assertSafeEmailRecipients([email]);
}
