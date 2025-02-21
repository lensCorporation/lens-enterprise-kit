import { Processor, WorkerHost } from '@nestjs/bullmq';
import { Job } from 'bullmq';
import { Logger } from '@nestjs/common';
import { LensMailService } from 'src/utils/mail/utils.lensMail.service';

@Processor('mail-queue')
export class MailConsumer extends WorkerHost {
  private readonly logger = new Logger(MailConsumer.name);

  constructor(private readonly mailService: LensMailService) {
    super();
  }

  async process(job: Job<any, any, string>): Promise<any> {
    try {
      switch (job.name) {
        case 'send-mail': {
          this.logger.log(`Processing mail job: ${job.id}`);
          this.logger.log(`Job data: ${JSON.stringify(job.data)}`);

          // Simulating mail send process
          const success = await this.mailService.sendMail(
            [job.data.to],
            job.data.subject,
            job.data.text
          );

          if (!success) {
            throw new Error('Failed to send email');
          }

          // Simulate progress tracking
          for (let i = 0; i <= 100; i += 20) {
            // await new Promise(resolve => setTimeout(resolve, 500));
            await job.updateProgress(i);
            await job.log(`📊 Progress: ${i}% completed`);
          }

          this.logger.log(`✅ Mail job ${job.id} completed successfully.`);
          return { status: 'success', message: 'Mail sent successfully' };
        }

        case 'concatenate': {
          // Placeholder for another job type
          break;
        }

        default:
          this.logger.warn(`⚠️ Unknown job type: ${job.name}`);
          break;
      }
    } catch (error) {
      this.logger.error(`❌ Error processing job ${job.id}: ${error.message}`);
      throw error;
    }
  }
}
