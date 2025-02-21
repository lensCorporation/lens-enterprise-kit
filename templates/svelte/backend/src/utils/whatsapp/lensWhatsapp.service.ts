import { Injectable, Logger } from '@nestjs/common';
import { IWhatsAppService } from './whatsapp.core';
@Injectable()
export class LensWhatsAppService implements IWhatsAppService {
    private logger = new Logger(LensWhatsAppService.name);
    private lensWhatsAppUrl: string|undefined
    private lensCloudApiKey: string|undefined
    constructor() {
        this.lensWhatsAppUrl = process.env.LENSWHATSAPP_URL;
        this.lensCloudApiKey = process.env.LENS_CLOUD_API_KEY;
     }
    
   async sendMessage(to: string[], message: string, imageUrl?: string, videoUrl?: string): Promise<boolean> {

       if(!this.lensWhatsAppUrl ) {
        this.logger.log('LENSWHATSAPP_URL is not defined');
        return false;
       }
       if(!this.lensCloudApiKey ) {
        this.logger.log('LENS_CLOUD_API_KEY is not defined');
        return false;
       }
       this.logger.log(`Sending message to ${to} with message ${message}`);
       const response = await fetch(this.lensWhatsAppUrl, {
           method: 'POST',
           headers: {
               'Content-Type': 'application/json',
               'Authorization': `Bearer ${this.lensCloudApiKey}`
           },
           body: JSON.stringify({
               mobiles:to,
               text:message,
               image_link:imageUrl,
               videoUrl,
               apiKey:this.lensCloudApiKey
           })
       });
       if(!response.ok) {
           this.logger.log(`Failed to send message to ${to} with message ${message}`);
           return false;
       }
       this.logger.log(`Successfully sent message to ${to} with message ${message}`);
       return true;
   }
}