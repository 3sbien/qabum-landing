import Head from 'next/head';
import React, { FormEvent, useEffect, useState } from 'react';

type AdminStatus = {
  authenticated: boolean;
  runtime?: {
    databaseConfigured: boolean;
    canonicalGoogleDocConfigured: boolean;
    emailEnabled: boolean;
    emailProviderConfigured: boolean;
    testRecipient: string;
    productionRecipientsLocked: boolean;
  };
  canonicalDraft?: {
    url: string;
    plannedInitialVersion: string;
  };
  notifications?: {
    carlos: string[];
    testRecipient: string;
    productionCounterpartyEmailsConfigured: number;
    productionCounterpartyEmailsExposed: boolean;
  };
};

export default function AgreementsAdminPage() {
  const [status, setStatus] = useState<AdminStatus>({ authenticated: false });
  const [password, setPassword] = useState('');
  const [message, setMessage] = useState('');

  const loadStatus = async () => {
    const res = await fetch('/api/agreements/admin/status');
    if (res.status === 401) {
      setStatus({ authenticated: false });
      return;
    }
    const data = await res.json();
    setStatus(data);
  };

  useEffect(() => {
    loadStatus();
  }, []);

  const login = async (event: FormEvent) => {
    event.preventDefault();
    setMessage('');
    const res = await fetch('/api/agreements/admin/login', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ password }),
    });
    if (!res.ok) {
      setMessage('Invalid credentials.');
      return;
    }
    setPassword('');
    await loadStatus();
  };

  const logout = async () => {
    await fetch('/api/agreements/admin/logout', { method: 'POST' });
    setStatus({ authenticated: false });
  };

  return (
    <>
      <Head>
        <title>Qabum Agreements Admin</title>
        <meta name="robots" content="noindex,nofollow" />
      </Head>
      <main style={styles.page}>
        <section style={styles.card}>
          <div style={styles.header}>
            <div>
              <div style={styles.brand}>qabum™</div>
              <h1 style={styles.title}>Agreements</h1>
            </div>
            {status.authenticated && <button onClick={logout} style={styles.secondaryButton}>Log out</button>}
          </div>

          {!status.authenticated ? (
            <form onSubmit={login} style={styles.form}>
              <p style={styles.muted}>Carlos-only administration.</p>
              <input
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="Admin password"
                autoComplete="current-password"
                style={styles.input}
              />
              <button type="submit" style={styles.primaryButton}>Sign in</button>
              {message && <p style={styles.error}>{message}</p>}
            </form>
          ) : (
            <div>
              <div style={styles.notice}>
                SAFE TEST MODE — no email may be sent to Steve. Test recipient: {status.runtime?.testRecipient}
              </div>

              <h2 style={styles.sectionTitle}>Steve agreement foundation</h2>
              <dl style={styles.grid}>
                <Item label="Canonical draft" value="Connected by document ID" />
                <Item label="Planned first version" value={status.canonicalDraft?.plannedInitialVersion || '—'} />
                <Item label="Database" value={status.runtime?.databaseConfigured ? 'Configured' : 'Pending'} />
                <Item label="Email provider" value={status.runtime?.emailProviderConfigured ? 'Configured' : 'Pending'} />
                <Item label="Production email" value={status.runtime?.emailEnabled ? 'ENABLED' : 'LOCKED'} />
                <Item label="Test recipient" value={status.notifications?.testRecipient || '—'} />
              </dl>

              <p style={styles.muted}>
                Publishing and acceptance controls will remain unavailable until persistent database,
                immutable PDF storage and Google export credentials are configured and verified.
              </p>

              {status.canonicalDraft?.url && (
                <a href={status.canonicalDraft.url} target="_blank" rel="noreferrer" style={styles.link}>
                  Open canonical Google Doc
                </a>
              )}
            </div>
          )}
        </section>
      </main>
    </>
  );
}

function Item({ label, value }: { label: string; value: string }) {
  return (
    <div style={styles.item}>
      <dt style={styles.label}>{label}</dt>
      <dd style={styles.value}>{value}</dd>
    </div>
  );
}

const styles: Record<string, React.CSSProperties> = {
  page: { minHeight: '100vh', background: '#f5f7fb', padding: '48px 20px' },
  card: { maxWidth: 920, margin: '0 auto', background: '#fff', border: '1px solid #dde3ec', borderRadius: 14, padding: 32, boxShadow: '0 10px 30px rgba(0,0,0,.05)' },
  header: { display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 20, marginBottom: 28 },
  brand: { fontWeight: 800, color: '#003399', letterSpacing: '.02em' },
  title: { margin: '4px 0 0', fontSize: 30, color: '#12233f' },
  form: { display: 'grid', gap: 14, maxWidth: 420 },
  input: { width: '100%', padding: '12px 14px', borderRadius: 8, border: '1px solid #bdc8d8', fontSize: 16 },
  primaryButton: { padding: '12px 18px', border: 0, borderRadius: 8, background: '#003399', color: '#fff', fontWeight: 700, cursor: 'pointer' },
  secondaryButton: { padding: '10px 14px', borderRadius: 8, border: '1px solid #bdc8d8', background: '#fff', cursor: 'pointer' },
  notice: { padding: 14, background: '#fff7dd', border: '1px solid #eed68b', borderRadius: 8, fontWeight: 700, marginBottom: 28 },
  sectionTitle: { color: '#12233f', marginTop: 0 },
  grid: { display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(220px,1fr))', gap: 14, margin: '20px 0 26px' },
  item: { margin: 0, border: '1px solid #e1e6ee', borderRadius: 8, padding: 14 },
  label: { fontSize: 12, fontWeight: 700, textTransform: 'uppercase', color: '#637087', marginBottom: 6 },
  value: { margin: 0, color: '#18253a', fontWeight: 600 },
  muted: { color: '#5c687a', lineHeight: 1.5 },
  error: { color: '#a52020' },
  link: { color: '#003399', fontWeight: 700 },
};
