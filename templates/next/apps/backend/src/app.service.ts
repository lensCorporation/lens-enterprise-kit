import { Inject, Injectable } from '@nestjs/common';
import { InjectQueue } from '@nestjs/bullmq';
import { Queue } from 'bullmq';
import { CACHE_MANAGER,Cache } from '@nestjs/cache-manager';
@Injectable()
export class AppService {
  constructor(
    @InjectQueue('mail-queue') private readonly mailQueue:Queue,@Inject(CACHE_MANAGER) private cacheManager: Cache
  ) {
    
  }
  async getCache(): Promise<any> {
    // let value = await this.cacheManager.get('key');
    // if (!value) {
    //   console.log('Cache miss')
    //   value = 1;
    //   await this.cacheManager.set('key', value);
    //   return {value:value,message:"Cache miss"}
    // }
    // else if(value ==5){
    //     this.cacheManager.del('key');
    // }
    // else{
    //     await this.cacheManager.set('key', Number(value)+1);
    // }
    // return {
    //   value:value,
    // };


    //expiry cache
    // let value = await this.cacheManager.get('key');
    // if(value){
    //   return {
    //     message:'Cache hit',
    //   }
    // }
    // this.cacheManager.set('key',{value:1},10000);
    // return {
    //   message:'Cache miss',
    // }

    console.log('I am beign hit')
    return {
      message:'Hello There',
    }
    
  }
  getHello(): string {
    this.mailQueue.add('send-mail', {
      to: 'nishchal.tiwari@lenscorp.ai',
      subject: 'Test',
      text: 'This is a test',
    });
    return 'Hello World!';
  }
}
