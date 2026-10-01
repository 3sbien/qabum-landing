# Qabum Agreements Foundation

This branch builds the Agreements foundation without changing production.

## Canonical drafting rule

The Steve agreement uses one canonical Google Doc as the living negotiation workspace:

- Document ID: 1l4ysOvMHlUyNUdYJzUn4dCXXOPY3JoxEMzqfe_oEZA8
- The Google Doc is mutable during negotiation.
- Editing the Google Doc never makes a Qabum version legally final.
- Qabum creates an immutable version only after an explicit Publish for Acceptance action.

## Non-negotiable evidence rules

1. Published versions store the exact source revision ID, exact contract text, text SHA-256 and PDF SHA-256.
2. Acceptance links store only a SHA-256 hash of the opaque link token.
3. OPENED and PDF_DOWNLOADED are separate events and never constitute acceptance.
4. ACCEPTED evidence is append-only.
5. Accepted versions cannot be overwritten.
6. Amendments or renegotiations create a new version.
7. Production email is OFF unless QABUM_AGREEMENTS_EMAIL_ENABLED=true.
8. While production email is OFF, only 3sbien@gmail.com may be used as a test recipient.

## Admin authentication

The first version intentionally uses a simple Carlos-only login:

- QABUM_AGREEMENTS_ADMIN_PASSWORD
- QABUM_AGREEMENTS_ADMIN_SECRET
- HttpOnly, Secure, SameSite=Strict session cookie
- 8-hour expiry

The existing browser-stored supra-admin token is not reused for Agreements.

## Infrastructure still required before production activation

- QABUM_AGREEMENTS_DATABASE_URL pointing to PostgreSQL/Neon.
- Private object storage for immutable PDFs and accepted PDFs.
- Google service credential or OAuth path with read/export access to the canonical document.
- Resend API key (or replacement provider) for transactional email.
- Explicit production email activation by Carlos.

No email is sent to Steve from this foundation branch.

## Preview environment

Preview is intentionally isolated from production. Any new secret added to Vercel Preview requires a new preview deployment before the runtime can observe it. Admin authentication secrets are also Preview-only during this foundation phase.

<!-- preview refresh after admin password rotation -->


## Database least-privilege model

The application must not run with the database-owner role in production.

- Schema/database owner: qabum_agreements_app
- Restricted application role: qabum_agreements_runtime
- Runtime role has no DELETE privileges and no schema ownership.
- Acceptance records and audit events are protected by database triggers in addition to restricted grants.
- Published snapshot fields are immutable; only lifecycle status fields may change.

## Private PDF storage

Neon Object Storage is enabled with a private bucket:

- Bucket: qabum-agreements
- Region: us-east-1
- Access: private
- Application credentials must be supplied only through:
  - QABUM_AGREEMENTS_STORAGE_ACCESS_KEY_ID
  - QABUM_AGREEMENTS_STORAGE_SECRET_ACCESS_KEY

The application refuses to overwrite an existing immutable agreement object.
