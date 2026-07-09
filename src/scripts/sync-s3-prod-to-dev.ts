import dotenv from "dotenv";
import path from "path";
dotenv.config({ path: path.join(__dirname, "../../.env") });

import { S3Client, ListObjectsV2Command, GetObjectCommand, PutObjectCommand } from "@aws-sdk/client-s3";
import pLimit from "p-limit";

// Verify environment variables for Prod
if (!process.env.S3_ENDPOINT || !process.env.S3_ACCESS_KEY || !process.env.S3_SECRET_KEY) {
  console.error("❌ Missing S3 configuration in production environment (.env file)");
  process.exit(1);
}

const prodBucketName = process.env.S3_BUCKET_NAME || "paperland-bucket";

// Configure Prod S3 Client
const prodS3Client = new S3Client({
  region: "us-east-1",
  endpoint: process.env.S3_ENDPOINT.replace(/\/$/, ""),
  credentials: {
    accessKeyId: process.env.S3_ACCESS_KEY,
    secretAccessKey: process.env.S3_SECRET_KEY,
  },
  forcePathStyle: true,
});

// Configure Dev S3 Client (using public URL for connectivity)
const devS3Config = {
  endpoint: "https://pl-dev-s3.sidattech.com",
  accessKeyId: "JVkMU4mGFhvgZtMV",
  secretAccessKey: "v9H8VMzANV0J8zuixamK9m7QPaaicRZa",
  bucketName: "paperland-dev-bucket",
};

const devS3Client = new S3Client({
  region: "us-east-1",
  endpoint: devS3Config.endpoint,
  credentials: {
    accessKeyId: devS3Config.accessKeyId,
    secretAccessKey: devS3Config.secretAccessKey,
  },
  forcePathStyle: true,
});

// Helper to convert readable stream to Buffer
async function streamToBuffer(stream: any): Promise<Buffer> {
  return new Promise((resolve, reject) => {
    const chunks: any[] = [];
    stream.on("data", (chunk: any) => chunks.push(chunk));
    stream.on("error", reject);
    stream.on("end", () => resolve(Buffer.concat(chunks)));
  });
}

async function syncS3() {
  console.log("🚀 Starting S3 Bucket Synchronization...");
  console.log(`Source (Prod): Endpoint=${process.env.S3_ENDPOINT}, Bucket=${prodBucketName}`);
  console.log(`Destination (Dev): Endpoint=${devS3Config.endpoint}, Bucket=${devS3Config.bucketName}`);
  console.log("--------------------------------------------------------------------------------");

  let continuationToken: string | undefined = undefined;
  let allObjects: any[] = [];

  console.log("🔍 Fetching object list from Production S3 bucket...");
  try {
    do {
      const response: any = await prodS3Client.send(new ListObjectsV2Command({
        Bucket: prodBucketName,
        ContinuationToken: continuationToken,
      }));

      if (response.Contents) {
        allObjects.push(...response.Contents);
      }
      continuationToken = response.NextContinuationToken;
    } while (continuationToken);

    console.log(`✅ Found ${allObjects.length} objects in production bucket.`);
  } catch (error: any) {
    console.error("❌ Failed to list objects from production bucket:", error.message);
    process.exit(1);
  }

  if (allObjects.length === 0) {
    console.log("ℹ️ No objects found to copy.");
    process.exit(0);
  }

  let successCount = 0;
  let failCount = 0;

  // Set concurrency limit (e.g. 10 files in parallel)
  const limit = pLimit(10);

  const copyTasks = allObjects.map((obj, index) => {
    return limit(async () => {
      const key = obj.Key;
      const progress = `[${index + 1}/${allObjects.length}]`;

      if (!key) {
        console.log(`${progress} ⚠️ Skipping object with missing key`);
        return;
      }

      try {
        // 1. Get object from Prod S3
        let getResponse;
        try {
          getResponse = await prodS3Client.send(new GetObjectCommand({
            Bucket: prodBucketName,
            Key: key,
          }));
        } catch (getErr: any) {
          throw new Error(`DOWNLOAD FAILED: ${getErr.message}`);
        }

        if (!getResponse.Body) {
          throw new Error("Empty response body");
        }

        const fileBuffer = await streamToBuffer(getResponse.Body);

        // 2. Put object to Dev S3
        try {
          await devS3Client.send(new PutObjectCommand({
            Bucket: devS3Config.bucketName,
            Key: key,
            Body: fileBuffer,
            ContentType: getResponse.ContentType || "application/octet-stream",
            ACL: "public-read",
          }));
        } catch (putErr: any) {
          throw new Error(`UPLOAD FAILED: ${putErr.message}`);
        }

        successCount++;
        if (successCount % 100 === 0 || successCount === allObjects.length) {
          console.log(`✨ Progress: Copied ${successCount}/${allObjects.length} files successfully.`);
        }
      } catch (error: any) {
        console.error(`${progress} ❌ File ${key} copy failed:`, error.message);
        failCount++;
      }
    });
  });

  // Run all tasks in parallel with the limit
  await Promise.all(copyTasks);

  console.log("--------------------------------------------------------------------------------");
  console.log(`📊 Synchronization finished!`);
  console.log(`✅ Successfully copied: ${successCount} files`);
  console.log(`❌ Failed: ${failCount} files`);
  if (failCount > 0) {
    process.exit(1);
  } else {
    process.exit(0);
  }
}

syncS3().catch((error) => {
  console.error("❌ Unexpected error:", error);
  process.exit(1);
});
