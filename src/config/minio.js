import * as Minio from 'minio';
import dotenv from 'dotenv';

dotenv.config();

const minioClient = new Minio.Client({
  endPoint: process.env.MINIO_ENDPOINT || 'localhost',
  port: parseInt(process.env.MINIO_PORT) || 9000,
  useSSL: process.env.MINIO_USE_SSL === 'true',
  accessKey: process.env.MINIO_ACCESS_KEY || 'minioadmin',
  secretKey: process.env.MINIO_SECRET_KEY || 'minioadmin',
});

// Ensure bucket exists
const bucketName = process.env.MINIO_BUCKET || 'mpanel-assets';

try {
  const bucketExists = await minioClient.bucketExists(bucketName);
  if (!bucketExists) {
    await minioClient.makeBucket(bucketName, 'us-east-1');
    console.log(`Bucket ${bucketName} created successfully`);
  }
} catch (err) {
  console.error('Error ensuring bucket exists:', err);
}

export { minioClient, bucketName };
