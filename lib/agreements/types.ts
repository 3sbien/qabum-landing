export type AgreementStatus = 'DRAFT' | 'PUBLISHED' | 'SUPERSEDED' | 'ACCEPTED';
export type AcceptanceLinkStatus = 'ACTIVE' | 'REVOKED' | 'USED' | 'EXPIRED';
export type AgreementEventType =
  | 'VERSION_PUBLISHED'
  | 'LINK_CREATED'
  | 'LINK_REVOKED'
  | 'OPENED'
  | 'PDF_DOWNLOADED'
  | 'EMAIL_VERIFIED'
  | 'ACCEPTED'
  | 'CONFIRMATION_EMAIL_SENT';

export interface AgreementVersion {
  id: string;
  agreementId: string;
  versionCode: string;
  status: AgreementStatus;
  sourceDocumentId: string;
  sourceRevisionId: string;
  contractText: string;
  contractTextSha256: string;
  pdfObjectKey: string | null;
  pdfSha256: string | null;
  publishedAt: string;
  publishedBy: string;
  acceptedAt: string | null;
}

export interface AcceptanceStatement {
  key: string;
  text: string;
  required: boolean;
}

export interface AcceptanceEvidence {
  acceptanceId: string;
  agreementVersionId: string;
  acceptanceLinkId: string;
  acceptingName: string;
  acceptingEmail: string;
  capacity: string;
  acceptedAtUtc: string;
  browserTimezone: string | null;
  ipAddress: string | null;
  userAgent: string | null;
  sessionMetadata: Record<string, unknown>;
  statements: AcceptanceStatement[];
  confirmations: Record<string, boolean>;
  documentIdentifier: string;
  evidenceSha256: string;
}

export interface AgreementsRuntimeStatus {
  databaseConfigured: boolean;
  canonicalGoogleDocConfigured: boolean;
  emailEnabled: boolean;
  emailProviderConfigured: boolean;
  testRecipient: string;
  productionRecipientsLocked: boolean;
}
