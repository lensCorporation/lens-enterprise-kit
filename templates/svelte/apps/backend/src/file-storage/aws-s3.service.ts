import { Injectable } from "@nestjs/common";
import { IFileStorage } from "./interface/IFileStorage";
import { DeleteObjectCommand, PutObjectCommand, S3Client } from "@aws-sdk/client-s3";
import { ConfigService } from "@nestjs/config";

@Injectable()
export class AwsS3Service implements IFileStorage {
  private s3: S3Client;
  private bucketName: string;
  private region: string;

  constructor(private configService: ConfigService) {
    this.region = this.configService.get("AWS_REGION");
    const accessKeyId = this.configService.get("AWS_ACCESS_KEY_ID");
    const secretAccessKey = this.configService.get("AWS_SECRET_ACCESS_KEY");

    this.s3 = new S3Client({
      region: this.region,
      // Fall back to the SDK's default credential chain when keys are not set
      ...(accessKeyId && secretAccessKey
        ? { credentials: { accessKeyId, secretAccessKey } }
        : {}),
    });

    this.bucketName = this.configService.get("AWS_BUCKET_NAME")||'NO_BUCKET';
    if (!this.bucketName) {
      throw new Error("AWS_BUCKET_NAME is not set in environment variables.");
    }
  }

  async uploadFile(file: Express.Multer.File): Promise<string> {
    const key = `${Date.now()}-${file.originalname}`; // Unique file name

    await this.s3.send(
      new PutObjectCommand({
        Bucket: this.bucketName,
        Key: key,
        Body: file.buffer,
        ACL: "public-read",
        ContentType: file.mimetype,
      }),
    );

    return `https://${this.bucketName}.s3.${this.region}.amazonaws.com/${encodeURIComponent(key)}`; // Return public URL of the file
  }

  async deleteFile(fileUrl: string): Promise<boolean> {
    try {
      const key = new URL(fileUrl).pathname.split("/").slice(-1)[0]; // Extract file name from URL
      await this.s3.send(
        new DeleteObjectCommand({ Bucket: this.bucketName, Key: decodeURIComponent(key) }),
      );
      return true;
    } catch (error) {
      console.error("Error deleting file:", error);
      return false;
    }
  }
}
