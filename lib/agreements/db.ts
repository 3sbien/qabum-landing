import { neon } from '@neondatabase/serverless';

export function getAgreementsDb() {
  const connectionString = process.env.QABUM_AGREEMENTS_DATABASE_URL;
  if (!connectionString) {
    throw new Error('QABUM_AGREEMENTS_DATABASE_URL is not configured');
  }

  return neon(connectionString);
}

export async function verifyAgreementsDatabase(): Promise<boolean> {
  const sql = getAgreementsDb();
  const rows = await sql`
    SELECT
      current_database() AS database_name,
      current_user AS database_user
  `;

  const first = rows[0] as { database_name?: string } | undefined;
  return first?.database_name === 'qabum_agreements';
}
