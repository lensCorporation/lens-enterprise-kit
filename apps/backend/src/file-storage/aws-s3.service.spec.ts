/**
 * Tests for the aws-sdk v2 -> @aws-sdk/client-s3 v3 migration of AwsS3Service.
 *
 * These tests document ACTUAL current behaviour of the v3 rewrite. Where that
 * behaviour differs from what the v2 implementation produced, the difference is
 * called out in a comment beginning with "MIGRATION NOTE" or "BUG" rather than
 * being smoothed over.
 *
 * No network calls happen: @aws-sdk/client-s3 is replaced wholesale.
 */

// ---------------------------------------------------------------------------
// jest.mock is hoisted above the imports, so the factory cannot close over
// consts declared later in this file. Everything it needs is built inside it
// and handed back on the mocked module under __-prefixed keys.
// ---------------------------------------------------------------------------
jest.mock("@aws-sdk/client-s3", () => {
  const sendMock = jest.fn();
  const clientConfigs: any[] = [];

  class PutObjectCommand {
    constructor(public readonly input: any) {}
  }

  class DeleteObjectCommand {
    constructor(public readonly input: any) {}
  }

  // The real SDK exposes the RESOLVED config, where region is a provider
  // function - not the raw string handed to the constructor. Model that, and
  // let a test drive what the SDK itself would resolve (env / shared profile /
  // instance metadata) when no region was passed in.
  const sdkResolved: { region?: string } = {};

  class S3Client {
    public readonly config: any;
    public readonly send = sendMock;

    constructor(config: any) {
      clientConfigs.push(config);
      this.config = {
        ...config,
        region: async () => {
          const resolved = config.region ?? sdkResolved.region;
          if (!resolved) throw new Error("Region is missing");
          return resolved;
        },
      };
    }
  }

  return {
    S3Client,
    PutObjectCommand,
    DeleteObjectCommand,
    __sendMock: sendMock,
    __clientConfigs: clientConfigs,
    __sdkResolved: sdkResolved,
  };
});

import { ConfigService } from "@nestjs/config";
import { Test } from "@nestjs/testing";
import { DeleteObjectCommand, PutObjectCommand } from "@aws-sdk/client-s3";
import { AwsS3Service } from "./aws-s3.service";

const s3ModuleMock = jest.requireMock("@aws-sdk/client-s3") as any;
const sendMock: jest.Mock = s3ModuleMock.__sendMock;
const clientConfigs: any[] = s3ModuleMock.__clientConfigs;
const sdkResolved: { region?: string } = s3ModuleMock.__sdkResolved;

// 2026-08-18T12:00:00.000Z - pinned so every Key assertion is deterministic.
const FIXED_NOW = 1787054400000;

const DEFAULT_ENV: Record<string, string | undefined> = {
  AWS_REGION: "us-east-1",
  AWS_ACCESS_KEY_ID: "AKIAEXAMPLEKEY",
  AWS_SECRET_ACCESS_KEY: "example-secret-key",
  AWS_BUCKET_NAME: "test-bucket",
};

/** Derive the file type straight from the service so the spec cannot drift. */
type UploadFile = Parameters<AwsS3Service["uploadFile"]>[0];

function createConfigService(env: Record<string, string | undefined> = {}): ConfigService {
  const merged = { ...DEFAULT_ENV, ...env };
  return {
    get: jest.fn((key: string) => merged[key]),
  } as unknown as ConfigService;
}

function createService(env: Record<string, string | undefined> = {}): AwsS3Service {
  return new AwsS3Service(createConfigService(env));
}

function makeFile(overrides: Partial<UploadFile> = {}): UploadFile {
  return {
    fieldname: "file",
    originalname: "photo.png",
    encoding: "7bit",
    mimetype: "image/png",
    size: 4,
    buffer: Buffer.from("data"),
    ...overrides,
  } as unknown as UploadFile;
}

/** The single command handed to S3Client.send on call `index`. */
function sentCommand(index = 0): any {
  return sendMock.mock.calls[index][0];
}

describe("AwsS3Service (aws-sdk v2 -> v3 migration)", () => {
  let consoleErrorSpy: jest.SpyInstance;

  beforeEach(() => {
    sendMock.mockReset();
    sendMock.mockResolvedValue({ $metadata: { httpStatusCode: 200 } });
    clientConfigs.length = 0;
    jest.useFakeTimers({ now: FIXED_NOW });
    consoleErrorSpy = jest.spyOn(console, "error").mockImplementation(() => undefined);
  });

  afterEach(() => {
    jest.useRealTimers();
    consoleErrorSpy.mockRestore();
  });

  // -------------------------------------------------------------------------
  describe("construction", () => {
    it("is resolvable through Nest DI with a mocked ConfigService", async () => {
      jest.useRealTimers(); // Nest's compile() should not run against fake timers.

      const moduleRef = await Test.createTestingModule({
        providers: [AwsS3Service, { provide: ConfigService, useValue: createConfigService() }],
      }).compile();

      expect(moduleRef.get(AwsS3Service)).toBeInstanceOf(AwsS3Service);
    });

    it("builds the S3Client with the configured region and explicit credentials", () => {
      createService();

      expect(clientConfigs).toHaveLength(1);
      expect(clientConfigs[0]).toEqual({
        region: "us-east-1",
        credentials: {
          accessKeyId: "AKIAEXAMPLEKEY",
          secretAccessKey: "example-secret-key",
        },
      });
    });

    it("omits `credentials` entirely when key/secret are absent, so the v3 default credential chain applies", () => {
      createService({ AWS_ACCESS_KEY_ID: undefined, AWS_SECRET_ACCESS_KEY: undefined });

      expect(clientConfigs[0]).toEqual({ region: "us-east-1" });
      expect(clientConfigs[0]).not.toHaveProperty("credentials");
    });

    it("BUG (pre-existing): the AWS_BUCKET_NAME guard is dead code - `|| 'NO_BUCKET'` means it can never fire", async () => {
      // `this.bucketName = get("AWS_BUCKET_NAME") || 'NO_BUCKET'` is always truthy,
      // so `if (!this.bucketName) throw ...` is unreachable. A missing bucket name
      // is silently accepted and leaks into the object URL that gets persisted.
      let service: AwsS3Service;
      expect(() => {
        service = createService({ AWS_BUCKET_NAME: undefined });
      }).not.toThrow();

      const url = await service.uploadFile(makeFile());
      expect(sentCommand().input.Bucket).toBe("NO_BUCKET");
      expect(url).toBe("https://NO_BUCKET.s3.us-east-1.amazonaws.com/1787054400000-photo.png");
    });
  });

  // -------------------------------------------------------------------------
  describe("uploadFile", () => {
    it("sends exactly one PutObjectCommand with Bucket, Key, Body, ACL and ContentType", async () => {
      const service = createService();
      const buffer = Buffer.from("hello world");
      const file = makeFile({
        originalname: "photo.png",
        mimetype: "image/png",
        buffer,
      });

      await service.uploadFile(file);

      expect(sendMock).toHaveBeenCalledTimes(1);
      const command = sentCommand();
      expect(command).toBeInstanceOf(PutObjectCommand);
      expect(command.input).toEqual({
        Bucket: "test-bucket",
        Key: "1787054400000-photo.png",
        Body: buffer,
        ACL: "public-read",
        ContentType: "image/png",
      });
      // Body must be the very same Buffer instance, not a copy or a stream.
      expect(command.input.Body).toBe(buffer);
    });

    it("builds the Key as `<Date.now()>-<originalname>`", async () => {
      const service = createService();

      await service.uploadFile(makeFile({ originalname: "a.txt" }));
      expect(sentCommand(0).input.Key).toBe(`${FIXED_NOW}-a.txt`);

      jest.setSystemTime(FIXED_NOW + 1500);
      await service.uploadFile(makeFile({ originalname: "a.txt" }));
      expect(sentCommand(1).input.Key).toBe(`${FIXED_NOW + 1500}-a.txt`);
    });

    it("returns the constructed virtual-hosted URL for a simple filename", async () => {
      // MIGRATION NOTE: v2 returned `uploadResult.Location` straight from the SDK.
      // v3 hand-builds this string instead - see the "v2 vs v3" block below.
      const service = createService();

      const url = await service.uploadFile(makeFile({ originalname: "photo.png" }));

      expect(url).toBe("https://test-bucket.s3.us-east-1.amazonaws.com/1787054400000-photo.png");
    });

    it("uses the configured region in the host", async () => {
      const service = createService({ AWS_REGION: "eu-central-1" });

      const url = await service.uploadFile(makeFile({ originalname: "photo.png" }));

      expect(url).toBe("https://test-bucket.s3.eu-central-1.amazonaws.com/1787054400000-photo.png");
    });

    it("propagates a rejection from S3Client.send (uploadFile has no try/catch)", async () => {
      const service = createService();
      sendMock.mockRejectedValueOnce(new Error("AccessDenied"));

      await expect(service.uploadFile(makeFile())).rejects.toThrow("AccessDenied");
    });
  });

  // -------------------------------------------------------------------------
  describe("key encoding (upload) vs decoding (delete)", () => {
    it('handles "my report (final).pdf": raw key on the wire, percent-encoded in the URL', async () => {
      const service = createService();

      const url = await service.uploadFile(
        makeFile({ originalname: "my report (final).pdf", mimetype: "application/pdf" }),
      );

      // The Key sent to S3 is the RAW, unencoded key - correct, the SDK signs/escapes it.
      expect(sentCommand(0).input.Key).toBe("1787054400000-my report (final).pdf");

      // The returned URL percent-encodes the whole key with encodeURIComponent.
      // Note that encodeURIComponent leaves "(" and ")" untouched.
      expect(url).toBe(
        "https://test-bucket.s3.us-east-1.amazonaws.com/1787054400000-my%20report%20(final).pdf",
      );
    });

    it("round-trips: deleteFile(uploadFile(...)) targets exactly the key that was uploaded", async () => {
      const service = createService();
      const file = makeFile({ originalname: "my report (final).pdf" });

      const url = await service.uploadFile(file);
      const uploadedKey = sentCommand(0).input.Key;

      const result = await service.deleteFile(url);

      expect(result).toBe(true);
      const deleteCommand = sentCommand(1);
      expect(deleteCommand).toBeInstanceOf(DeleteObjectCommand);
      expect(deleteCommand.input.Key).toBe(uploadedKey);
      expect(deleteCommand.input.Key).toBe("1787054400000-my report (final).pdf");
    });

    it.each([
      ["photo.png"],
      ["my report (final).pdf"],
      ["a&b+c d.pdf"],
      ["nested/dir/report.pdf"],
      ["100% done#1?.pdf"],
      ["café ñ.png"],
      ["quote'and*bang!.png"],
    ])("encode/decode is self-consistent for %s", async (originalname) => {
      const service = createService();

      const url = await service.uploadFile(makeFile({ originalname }));
      const uploadedKey = sentCommand(0).input.Key;
      expect(uploadedKey).toBe(`${FIXED_NOW}-${originalname}`);

      await expect(service.deleteFile(url)).resolves.toBe(true);
      expect(sentCommand(1).input.Key).toBe(uploadedKey);
    });

    it("a '/' in originalname is escaped to %2F, so the last-path-segment parse still recovers the full key", async () => {
      // Worth pinning: deleteFile takes only the final "/"-separated segment.
      // It survives here only because encodeURIComponent escaped the slash.
      const service = createService();

      const url = await service.uploadFile(makeFile({ originalname: "nested/dir/report.pdf" }));

      expect(url).toBe(
        "https://test-bucket.s3.us-east-1.amazonaws.com/1787054400000-nested%2Fdir%2Freport.pdf",
      );
      await service.deleteFile(url);
      expect(sentCommand(1).input.Key).toBe("1787054400000-nested/dir/report.pdf");
    });
  });

  // -------------------------------------------------------------------------
  describe("deleteFile", () => {
    it("extracts the key from the URL, decodes it, and sends a DeleteObjectCommand", async () => {
      const service = createService();

      const result = await service.deleteFile(
        "https://test-bucket.s3.us-east-1.amazonaws.com/1787054400000-my%20report.pdf",
      );

      expect(result).toBe(true);
      expect(sendMock).toHaveBeenCalledTimes(1);
      const command = sentCommand();
      expect(command).toBeInstanceOf(DeleteObjectCommand);
      expect(command.input).toEqual({
        Bucket: "test-bucket",
        Key: "1787054400000-my report.pdf",
      });
    });

    it("takes the Bucket from config, not from the URL host", async () => {
      const service = createService();

      await service.deleteFile("https://some-other-bucket.s3.us-east-1.amazonaws.com/abc.png");

      expect(sentCommand().input.Bucket).toBe("test-bucket");
    });

    it("still resolves legacy v2-style URLs that have no region segment in the host", async () => {
      // Objects uploaded before this migration were stored with the SDK's own
      // Location string. The bucket comes from config, so those URLs keep working.
      const service = createService();

      const result = await service.deleteFile(
        "https://test-bucket.s3.amazonaws.com/1700000000000-legacy%20file.pdf",
      );

      expect(result).toBe(true);
      expect(sentCommand().input.Key).toBe("1700000000000-legacy file.pdf");
    });

    it("decodes v2-style %28/%29 escaping of parentheses back to the real key", async () => {
      // aws-sdk v2 escaped ()!'* in the Location it returned; encodeURIComponent
      // does not. Both encodings decode to the same key, so delete still works.
      const service = createService();

      await service.deleteFile(
        "https://test-bucket.s3.amazonaws.com/1700000000000-my%20report%20%28final%29.pdf",
      );

      expect(sentCommand().input.Key).toBe("1700000000000-my report (final).pdf");
    });

    it("returns false and does not throw when S3Client.send rejects", async () => {
      const service = createService();
      sendMock.mockRejectedValueOnce(new Error("NoSuchKey"));

      const result = await service.deleteFile(
        "https://test-bucket.s3.us-east-1.amazonaws.com/1787054400000-photo.png",
      );

      expect(result).toBe(false);
      expect(sendMock).toHaveBeenCalledTimes(1);
      expect(consoleErrorSpy).toHaveBeenCalledWith("Error deleting file:", expect.any(Error));
    });

    it("returns false without calling S3 when the input is not a parseable URL", async () => {
      const service = createService();

      await expect(service.deleteFile("1787054400000-photo.png")).resolves.toBe(false);
      expect(sendMock).not.toHaveBeenCalled();
    });

    it("returns false when the URL contains a malformed percent-escape", async () => {
      // decodeURIComponent throws URIError on a lone '%'; the catch swallows it.
      const service = createService();

      await expect(
        service.deleteFile("https://test-bucket.s3.us-east-1.amazonaws.com/100%ZZ.pdf"),
      ).resolves.toBe(false);
    });
  });

  // -------------------------------------------------------------------------
  describe("v2 -> v3 behavioural differences worth flagging", () => {
    it("FIXED: an unset AWS_REGION falls back to the region the SDK resolved", async () => {
      // Regression guard. The first cut of the v3 rewrite interpolated
      // this.region straight into the persisted URL, so an unset AWS_REGION
      // produced https://<bucket>.s3.undefined.amazonaws.com/<key> - a
      // permanently broken URL written to the database. v2 could never do this
      // because it returned uploadResult.Location from the SDK.
      sdkResolved.region = "eu-west-2"; // as if resolved from profile / IMDS
      const service = createService({ AWS_REGION: undefined });

      const url = await service.uploadFile(makeFile({ originalname: "photo.png" }));

      expect(url).toBe("https://test-bucket.s3.eu-west-2.amazonaws.com/1787054400000-photo.png");
      expect(url).not.toContain("undefined");
    });

    it("FIXED: an unresolvable region throws BEFORE anything is uploaded", async () => {
      // Failing closed matters more than failing late: if the region cannot be
      // resolved we must not leave an object in the bucket that no stored URL
      // points at.
      sdkResolved.region = undefined;
      const service = createService({ AWS_REGION: undefined });

      await expect(
        service.uploadFile(makeFile({ originalname: "photo.png" })),
      ).rejects.toThrow(/Region is missing|AWS_REGION is not set/);

      expect(sendMock).not.toHaveBeenCalled();
    });

    it("MIGRATION NOTE: the returned URL is now always the regional virtual-hosted form", async () => {
      // aws-sdk v2 defaulted to the legacy global endpoint for us-east-1
      // (https://<bucket>.s3.amazonaws.com/<key>). The v3 rewrite always emits
      // the regional host, so newly stored URLs differ, as strings, from the
      // historical ones for the same bucket.
      const service = createService({ AWS_REGION: "us-east-1" });

      const url = await service.uploadFile(makeFile({ originalname: "photo.png" }));

      expect(new URL(url).host).toBe("test-bucket.s3.us-east-1.amazonaws.com");
      expect(new URL(url).host).not.toBe("test-bucket.s3.amazonaws.com");
    });

    it("FIXED: a file with no buffer (multer diskStorage) is rejected, not silently uploaded", async () => {
      // Regression guard. v2's managed s3.upload() validated params client-side
      // and rejected a missing Body. PutObjectCommand does not, so the first cut
      // of the v3 rewrite wrote a 0-byte object and handed back a URL that
      // looked perfectly healthy. This branch also bumps multer 1 -> 2, where a
      // diskStorage-configured FileInterceptor yields file.buffer === undefined.
      const service = createService();

      await expect(service.uploadFile(makeFile({ buffer: undefined }))).rejects.toThrow(
        /requires an in-memory file buffer/,
      );

      expect(sendMock).not.toHaveBeenCalled();
    });

    it("MIGRATION NOTE: uploadFile is a single PutObject - no automatic multipart for large bodies", async () => {
      // v2's s3.upload() transparently switched to multipart above ~5 MB.
      // Everything here goes through one PutObjectCommand regardless of size.
      const service = createService();

      await service.uploadFile(makeFile({ buffer: Buffer.alloc(6 * 1024 * 1024), size: 6 * 1024 * 1024 }));

      expect(sendMock).toHaveBeenCalledTimes(1);
      expect(sentCommand()).toBeInstanceOf(PutObjectCommand);
    });
  });
});
