import dotenv from "dotenv";
import path from "path";

// Load environment variables from the root .env fi
dotenv.config({ path: path.join(__dirname, "../../.env") });

import { s3Client, S3_BUCKET_NAME } from "../plugins/storage";
import { ListBucketsCommand } from "@aws-sdk/client-s3";

async function verifyS3Connection() {
  console.log("Verifying S3 Connection...");
  console.log(`Endpoint: ${process.env.S3_ENDPOINT}`);
  console.log(`Bucket: ${S3_BUCKET_NAME}`);

  try {
    const command = new ListBucketsCommand({});
    const response = await s3Client.send(command);

    console.log("Connection Successful!");
    console.log("Buckets found:");
    response.Buckets?.forEach((bucket) => {
      console.log(`- ${bucket.Name}`);
    });

    const bucketExists = response.Buckets?.some(
      (b) => b.Name === S3_BUCKET_NAME
    );

    if (bucketExists) {
      console.log(`\nSUCCESS: Bucket '${S3_BUCKET_NAME}' found.`);
    } else {
      console.error(`\nWARNING: Bucket '${S3_BUCKET_NAME}' NOT found in the list.`);
    }
  } catch (error) {
    console.error("ERROR: Failed to connect or list buckets.");
    console.error(error);
  }
}

verifyS3Connection();
