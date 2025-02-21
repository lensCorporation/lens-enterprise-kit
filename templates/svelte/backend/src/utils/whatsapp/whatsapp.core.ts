export interface IWhatsAppService {
    sendMessage(to: string[], message: string, imageUrl?: string, videoUrl?: string,): Promise<boolean>;
}
