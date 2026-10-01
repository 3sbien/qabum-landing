import {
  GetObjectCommand,
  HeadObjectCommand,
  PutObjectCommand,
  S3Client,
} from '@aws-sdk/client-s3';

export const AGREEMENTS_STORAGE_BUCKET = 'qabum-agreements';
export const AGREEMENTS_STORAGE_ENDPOINT =
  'https://br-bold-dawn-awhmjvkl.storage.c-12.us-east-1.aws.neon.tech';
export const AGREEMENTS_STORAGE_REGION = 'us-east-1';

let client: S3Client | null = null;

function storageCredentials() {
  const accessKeyId = process.env.QABUM_AGREEMENTS_STORAGE_ACCESS_KEY_ID;
  const secretAccessKey = process.env.QABUM_AGREEMENTS_STORAGE_SECRET_ACCESS_KEY;

  if (!accessKeyId || !secretAccessKey) {
    throw new Error('Qabum Agreements private storage credentials are not configured');
  }

  return { accessKeyId, secretAccessKey };
}

export function isAgreementsStorageConfigured(): boolean {
  return Boolean(
    process.env.QABUM_AGREEMENTS_STORAGE_ACCESS_KEY_ID &&
      process.env.QABUM_AGREEMENTS_STORAGE_SECRET_ACCESS_KEY,
  );
}

export function getAgreementsStorage(): S3Client {
  if (!client) {
    client = new S3Client({
      region: AGREEMENTS_STORAGE_REGION,
      endpoint: AGREEMENTS_STORAGE_ENDPOINT,
      credentials: storageCredentials(),
      forcePathStyle: true,
    });
  }

  return client;
}

export async function putImmutableAgreementObject(
  objectKey: string,
  body: Buffer | Uint8Array,
  contentType: string,
  metadata: Record<string, string> = {},
): Promise<void> {
  const storage = getAgreementsStorage();

  const existing = await storage.send(
    new HeadObjectCommand({
      Bucket: AGREEMENTS_STORAGE_BUCKET,
      Key: objectKey,
    }),
  ).then(
    () => true,
    (error: { name?: string; $metadata?: { httpStatusCode?: number } }) => {
      if (error?.name === 'NotFound' || error?.$metadata?.httpStatusCode === 404) {
        return false;
      }
      throw error;
    },
  );

  if (existing) {
    throw new Error('Refusing to overwrite an existing immutable agreement object');
  }

  await storage.send(
    new PutObjectCommand({
      Bucket: AGREEMENTS_STORAGE_BUCKET,
      Key: objectKey,
      Body: body,
      ContentType: contentType,
      Metadata: metadata,
    }),
  );
}

export async function getAgreementObject(objectKey: string): Promise<Buffer> {
  const storage = getAgreementsStorage();
  const result = await storage.send(
    new GetObjectCommand({
      Bucket: AGREEMENTS_STORAGE_BUCKET,
      Key: objectKey,
    }),
  );

  if (!result.Body) {
    throw new Error('Agreement object has no body');
  }

  const bytes = await result.Body.transformToByteArray();
  return Buffer.from(bytes);
}
