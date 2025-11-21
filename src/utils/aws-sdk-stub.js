/**
 * @aws-sdk/client-s3 stub - placeholder until package is installed
 * This allows the server to start while the package installation issue is resolved
 */

export class S3Client {
  constructor(config) {
    this.config = config;
    console.warn('⚠️  @aws-sdk/client-s3 not installed - S3 operations will fail');
  }
  
  async send(command) {
    throw new Error('@aws-sdk/client-s3 package not installed. Please run: npm install @aws-sdk/client-s3');
  }
}

export class PutObjectCommand {
  constructor(params) {
    this.params = params;
  }
}

export class GetObjectCommand {
  constructor(params) {
    this.params = params;
  }
}

export class DeleteObjectCommand {
  constructor(params) {
    this.params = params;
  }
}
