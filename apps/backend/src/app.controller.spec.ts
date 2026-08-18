import { Test, TestingModule } from '@nestjs/testing';
import { getQueueToken } from '@nestjs/bullmq';
import { CACHE_MANAGER } from '@nestjs/cache-manager';
import { AppController } from './app.controller';
import { AppService } from './app.service';

describe('AppController', () => {
  let appController: AppController;
  let appService: AppService;

  // AppService injects the BullMQ 'mail-queue' and the cache manager.
  // Both are replaced with in-memory doubles so no Redis connection is opened.
  const mailQueueMock = {
    add: jest.fn(),
    close: jest.fn(),
  };

  const cacheManagerMock = {
    get: jest.fn(),
    set: jest.fn(),
    del: jest.fn(),
  };

  beforeEach(async () => {
    jest.clearAllMocks();

    const app: TestingModule = await Test.createTestingModule({
      controllers: [AppController],
      providers: [
        AppService,
        { provide: getQueueToken('mail-queue'), useValue: mailQueueMock },
        { provide: CACHE_MANAGER, useValue: cacheManagerMock },
      ],
    }).compile();

    appController = app.get<AppController>(AppController);
    appService = app.get<AppService>(AppService);
  });

  describe('root', () => {
    // NOTE: AppController.getHello() calls appService.getHello() but discards the
    // result and returns its own literal 'Hello World' (no exclamation mark).
    // The assertion below records the controller's actual behaviour.
    it('should return "Hello World"', () => {
      const serviceSpy = jest.spyOn(appService, 'getHello');

      expect(appController.getHello()).toBe('Hello World');
      expect(serviceSpy).toHaveBeenCalledTimes(1);
    });
  });
});
