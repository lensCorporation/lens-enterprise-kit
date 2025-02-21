import { Injectable } from "@nestjs/common";
import { ISmsService } from "./sms.core";

@Injectable()
export class LensSmsService implements ISmsService {
    constructor() { }
    sendVerificationCode(to: string, code?: string): Promise<boolean> {
        throw new Error("Method not implemented.");
    }
    verifyVerificationCode(to: string, code: string): Promise<boolean> {
        throw new Error("Method not implemented.");
    }

    async sendSms(to: string[], body: string): Promise<boolean> {
        return true;
    }

}