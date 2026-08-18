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
    // aws-sdk v2's managed upload() validated params client-side and rejected a
    // missing Body. PutObjectCommand does not, so without this guard a file from
    // multer's diskStorage (buffer === undefined) writes a 0-byte object and
    // still returns a healthy-looking URL.
    if (!file?.buffer) {
      throw new Error(
        "AwsS3Service.uploadFile requires an in-memory file buffer (multer memoryStorage).",
      );
    }

    // Resolve the region BEFORE uploading, so a resolution failure cannot strand
    // an uploaded object behind a URL we are unable to construct.
    const region = this.region || (await this.resolveRegion());

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

    return `https://${this.bucketName}.s3.${region}.amazonaws.com/${encodeURIComponent(key)}`; // Return public URL of the file
  }

  /**
   * v2 returned uploadResult.Location straight from the SDK, so it could never
   * produce a bad host. The v3 rewrite builds the URL itself, so an unset
   * AWS_REGION would otherwise persist a URL containing the literal string
   * "undefined". Fall back to whatever region the SDK actually resolved
   * (env, shared profile, or instance metadata).
   */
  private async resolveRegion(): Promise<string> {
    const configured = (this.s3.config as { region?: unknown })?.region;
    const resolved =
      typeof configured === "function"
        ? await (configured as () => Promise<string> | string)()
        : configured;

    if (!resolved || typeof resolved !== "string") {
      throw new Error(
        "AWS_REGION is not set and could not be resolved from the AWS SDK configuration.",
      );
    }
    return resolved;
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
