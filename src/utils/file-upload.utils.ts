import { FastifyRequest } from 'fastify';
import { S3Client, PutObjectCommand, CreateBucketCommand } from '@aws-sdk/client-s3';
import path from 'path';
import crypto from 'crypto';

// S3/MinIO client configuration
const s3Client = new S3Client({
  region: process.env.S3_REGION || 'us-east-1',
  endpoint: process.env.S3_ENDPOINT || 'http://localhost:9000', // MinIO endpoint
  credentials: {
    accessKeyId: process.env.S3_ACCESS_KEY || '',
    secretAccessKey: process.env.S3_SECRET_KEY || '',
  },
  forcePathStyle: true, // Required for MinIO
});

const BUCKET_NAME = process.env.S3_BUCKET_NAME || 'public-bucket';

/**
 * Upload file to S3/MinIO
 * @param file - File data from multipart upload
 * @param folder - Optional folder path in bucket
 * @returns Public URL of uploaded file
 */
export async function uploadFileToS3(
  file: { data: Buffer; filename: string; mimetype: string },
  folder: string = 'uploads'
): Promise<string> {
  // Generate unique filename
  const ext = path.extname(file.filename);
  const uniqueName = `${crypto.randomBytes(16).toString('hex')}${ext}`;
  const key = `${folder}/${uniqueName}`;

  // Upload to S3/MinIO
  const command = new PutObjectCommand({
    Bucket: BUCKET_NAME,
    Key: key,
    Body: file.data,
    ContentType: file.mimetype,
    ACL: 'public-read', // Make file publicly accessible
  });

  try {
    await s3Client.send(command);
  } catch (err: any) {
    if (err.name === 'NoSuchBucket') {
      console.log(`⚠️ Bucket '${BUCKET_NAME}' does not exist. Creating it now...`);
      // Create bucket and retry
      await s3Client.send(new CreateBucketCommand({ Bucket: BUCKET_NAME }));
      await s3Client.send(command);
    } else {
      throw err;
    }
  }

  // Return public URL
  const endpoint = (process.env.S3_PUBLIC_URL || process.env.S3_ENDPOINT || '').replace(/\/$/, "");
  const publicUrl = `${endpoint}/${BUCKET_NAME}/${key}`;

  return publicUrl;
}

/**
 * Validate file upload
 * @param file - File to validate
 * @param options - Validation options
 */
export function validateFileUpload(
  file: { filename: string; mimetype: string; data: Buffer },
  options: {
    allowedMimeTypes?: string[];
    maxSizeBytes?: number;
  } = {}
): { valid: boolean; error?: string } {
  const {
    allowedMimeTypes = ['application/pdf', 'image/jpeg', 'image/png', 'image/jpg'],
    maxSizeBytes = 10 * 1024 * 1024, // 10MB default
  } = options;

  // Check file type
  if (!allowedMimeTypes.includes(file.mimetype)) {
    return {
      valid: false,
      error: `Invalid file type. Allowed types: ${allowedMimeTypes.join(', ')}`,
    };
  }

  // Check file size
  if (file.data.length > maxSizeBytes) {
    const maxSizeMB = maxSizeBytes / (1024 * 1024);
    return {
      valid: false,
      error: `File size exceeds ${maxSizeMB}MB limit`,
    };
  }

  return { valid: true };
}

/**
 * Process multipart file upload from Fastify request
 */
export async function processFileUpload(
  request: FastifyRequest,
  fieldName: string = 'file'
): Promise<{ data: Buffer; filename: string; mimetype: string } | null> {
  const data = await request.file();
  
  if (!data) {
    return null;
  }

  // Convert file stream to buffer
  const buffer = await data.toBuffer();

  return {
    data: buffer,
    filename: data.filename,
    mimetype: data.mimetype,
  };
}
