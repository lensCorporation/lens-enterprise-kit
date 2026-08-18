import { Test, TestingModule } from '@nestjs/testing';
import { SchedulerRegistry } from '@nestjs/schedule';
import { CronService } from './cron.service';

describe('CronService', () => {
  let service: CronService;

  // SchedulerRegistry is mocked so no real cron jobs are registered or started.
  const schedulerRegistryMock = {
    addCronJob: jest.fn(),
    deleteCronJob: jest.fn(),
    getCronJob: jest.fn(),
    getCronJobs: jest.fn().mockReturnValue(new Map()),
    doesExist: jest.fn().mockReturnValue(false),
  };

  beforeEach(async () => {
    jest.clearAllMocks();

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        CronService,
        { provide: SchedulerRegistry, useValue: schedulerRegistryMock },
      ],
    }).compile();

    service = module.get<CronService>(CronService);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
    expect(service).toBeInstanceOf(CronService);
  });

  it('should not register any cron job on construction', () => {
    expect(schedulerRegistryMock.addCronJob).not.toHaveBeenCalled();
  });
});
