import { Injectable } from '@nestjs/common';
import * as speakeasy from 'speakeasy';
import * as qrcode from 'qrcode';

@Injectable()
export class MfaService {
  async generateSecret(email: string) {
    const secret = speakeasy.generateSecret({ name: `MyApp (${email})` });
    return {
      secret: secret.base32,
      qrCode: await qrcode.toDataURL(secret.otpauth_url),
    };
  }

  verifyToken(secret: string, token: string): boolean {
    return speakeasy.totp.verify({
      secret,
      encoding: 'base32',
      token,
    });
  }
}
