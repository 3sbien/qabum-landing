import { neon } from '@neondatabase/serverless';

let client: ReturnType<typeof neon> | null = null;

export function getAgreementsDb() {
  const connectionString = process.env.QABUM_AGREEMENTS_DATABASE_URL;
  if (!connectionString) {
    throw new Error('QABUM_AGREEMENTS_DATABASE_URL is not configured');
  }

  if (!client) {
    client = neon(connectionString);
  }

  return client;
}

export async function verifyAgreementsDatabase(): Promise<boolean> {
  const sql = getAgreementsDb();
  const rows = await sql`
    SELECT
      current_database() AS database_name,
      current_user AS database_user
  `;

  return rows.length === 1 && rows[0]?.database_name === 'qabum_agreements';
}
