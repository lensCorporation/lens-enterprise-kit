export interface IMailService {
    sendMail(to: string[], subject: string, body: string, from?: string): Promise<boolean>;
}
  