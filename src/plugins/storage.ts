import { S3Client } from "@aws-sdk/client-s3";

if (!process.env.S3_ENDPOINT || !process.env.S3_ACCESS_KEY || !process.env.S3_SECRET_KEY) {
  throw new Error("Missing S3 configuration in environment variables");
}

export const s3Client = new S3Client({
  region: "us-east-1", // MinIO requires a region, even if ignored
  endpoint: process.env.S3_ENDPOINT?.replace(/\/$/, ""),
  credentials: {
    accessKeyId: process.env.S3_ACCESS_KEY,
    secretAccessKey: process.env.S3_SECRET_KEY,
  },
  forcePathStyle: true, // Required for MinIO
});

export const S3_BUCKET_NAME = process.env.S3_BUCKET_NAME || "public-bucket";
