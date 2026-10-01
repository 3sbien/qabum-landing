import { neon } from '@neondatabase/serverless';
import { ListObjectsV2Command, S3Client } from '@aws-sdk/client-s3';

if (process.env.VERCEL_ENV === 'preview' && process.env.QABUM_AGREEMENTS_EMAIL_ENABLED !== 'true') {
  const databaseUrl = process.env.QABUM_AGREEMENTS_DATABASE_URL;
  const accessKeyId = process.env.QABUM_AGREEMENTS_STORAGE_ACCESS_KEY_ID;
  const secretAccessKey = process.env.QABUM_AGREEMENTS_STORAGE_SECRET_ACCESS_KEY;

  if (!databaseUrl || !accessKeyId || !secretAccessKey) {
    throw new Error('Qabum Agreements preview backend credentials are incomplete');
  }

  const sql = neon(databaseUrl);
  const rows = await sql`SELECT current_database() AS database_name`;
  if (rows[0]?.database_name !== 'qabum_agreements') {
    throw new Error('Qabum Agreements preview database verification failed');
  }

  const s3 = new S3Client({
    region: 'us-east-1',
    endpoint: 'https://br-bold-dawn-awhmjvkl.storage.c-12.us-east-1.aws.neon.tech',
    credentials: { accessKeyId, secretAccessKey },
    forcePathStyle: true,
  });

  await s3.send(
    new ListObjectsV2Command({
      Bucket: 'qabum-agreements',
      MaxKeys: 1,
    }),
  );

  console.log('Qabum Agreements preview backend readiness verified.');
}
