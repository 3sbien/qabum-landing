-- Qabum Agreements
-- Immutable published versions + append-only evidentiary records.
-- PostgreSQL / Neon compatible.

CREATE TABLE IF NOT EXISTS agreements (
    id TEXT PRIMARY KEY,
    code TEXT NOT NULL UNIQUE,
    title TEXT NOT NULL,
    canonical_source_url TEXT NOT NULL,
    canonical_source_document_id TEXT NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    created_by TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS agreement_versions (
    id TEXT PRIMARY KEY,
    agreement_id TEXT NOT NULL REFERENCES agreements(id),
    version_code TEXT NOT NULL UNIQUE,
    status TEXT NOT NULL CHECK (status IN ('PUBLISHED', 'SUPERSEDED', 'ACCEPTED')),
    source_revision_id TEXT NOT NULL,
    contract_text TEXT NOT NULL,
    contract_text_sha256 TEXT NOT NULL,
    pdf_object_key TEXT,
    pdf_sha256 TEXT,
    published_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    published_by TEXT NOT NULL,
    accepted_at TIMESTAMPTZ,
    UNIQUE (agreement_id, source_revision_id)
);

CREATE TABLE IF NOT EXISTS counterparties (
    id TEXT PRIMARY KEY,
    display_name TEXT NOT NULL,
    legal_name TEXT,
    email TEXT NOT NULL,
    capacity TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS acceptance_links (
    id TEXT PRIMARY KEY,
    agreement_version_id TEXT NOT NULL REFERENCES agreement_versions(id),
    counterparty_id TEXT NOT NULL REFERENCES counterparties(id),
    token_sha256 TEXT NOT NULL UNIQUE,
    status TEXT NOT NULL CHECK (status IN ('ACTIVE', 'REVOKED', 'USED', 'EXPIRED')),
    expires_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    revoked_at TIMESTAMPTZ,
    used_at TIMESTAMPTZ
);

CREATE TABLE IF NOT EXISTS acceptances (
    id TEXT PRIMARY KEY,
    agreement_version_id TEXT NOT NULL UNIQUE REFERENCES agreement_versions(id),
    acceptance_link_id TEXT NOT NULL UNIQUE REFERENCES acceptance_links(id),
    counterparty_id TEXT NOT NULL REFERENCES counterparties(id),
    accepting_name TEXT NOT NULL,
    accepting_email TEXT NOT NULL,
    capacity TEXT NOT NULL,
    accepted_at_utc TIMESTAMPTZ NOT NULL,
    browser_timezone TEXT,
    ip_address INET,
    user_agent TEXT,
    session_metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
    acceptance_statements JSONB NOT NULL,
    confirmations JSONB NOT NULL,
    document_identifier TEXT NOT NULL,
    evidence_sha256 TEXT NOT NULL UNIQUE,
    accepted_pdf_object_key TEXT,
    accepted_pdf_sha256 TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS agreement_events (
    id BIGSERIAL PRIMARY KEY,
    agreement_version_id TEXT NOT NULL REFERENCES agreement_versions(id),
    acceptance_link_id TEXT REFERENCES acceptance_links(id),
    acceptance_id TEXT REFERENCES acceptances(id),
    event_type TEXT NOT NULL,
    occurred_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    actor TEXT,
    ip_address INET,
    user_agent TEXT,
    metadata JSONB NOT NULL DEFAULT '{}'::jsonb
);

CREATE INDEX IF NOT EXISTS agreement_events_version_idx
    ON agreement_events (agreement_version_id, occurred_at);

CREATE INDEX IF NOT EXISTS agreement_events_link_idx
    ON agreement_events (acceptance_link_id, occurred_at);

-- Legal/evidentiary safeguard: accepted versions and acceptance records are append-only.
CREATE OR REPLACE FUNCTION qabum_block_evidence_mutation()
RETURNS trigger AS $$
BEGIN
    RAISE EXCEPTION 'Qabum accepted evidence is immutable';
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS block_acceptance_update ON acceptances;
CREATE TRIGGER block_acceptance_update
BEFORE UPDATE OR DELETE ON acceptances
FOR EACH ROW EXECUTE FUNCTION qabum_block_evidence_mutation();

CREATE OR REPLACE FUNCTION qabum_block_accepted_version_mutation()
RETURNS trigger AS $$
BEGIN
    IF OLD.status = 'ACCEPTED' THEN
        RAISE EXCEPTION 'Accepted agreement versions are immutable';
    END IF;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS block_accepted_version_update ON agreement_versions;
CREATE TRIGGER block_accepted_version_update
BEFORE UPDATE OR DELETE ON agreement_versions
FOR EACH ROW EXECUTE FUNCTION qabum_block_accepted_version_mutation();
