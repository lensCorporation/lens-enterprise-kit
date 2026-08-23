import { Test, TestingModule } from '@nestjs/testing';
import { HealthCheckService, HttpHealthIndicator } from '@nestjs/terminus';
import { HealthController } from './health.controller';

describe('HealthController', () => {
  let controller: HealthController;

  // Terminus indicators are mocked so the ping never leaves the process.
  const healthCheckServiceMock = {
    check: jest.fn().mockResolvedValue({ status: 'ok', info: {}, error: {}, details: {} }),
  };

  const httpHealthIndicatorMock = {
    pingCheck: jest.fn().mockResolvedValue({ 'nestjs-docs': { status: 'up' } }),
  };

  beforeEach(async () => {
    jest.clearAllMocks();

    const module: TestingModule = await Test.createTestingModule({
      controllers: [HealthController],
      providers: [
        { provide: HealthCheckService, useValue: healthCheckServiceMock },
        { provide: HttpHealthIndicator, useValue: httpHealthIndicatorMock },
      ],
    }).compile();

    controller = module.get<HealthController>(HealthController);
  });

  it('should be defined', () => {
    expect(controller).toBeDefined();
  });

  it('should delegate to HealthCheckService with one indicator', async () => {
    await expect(controller.check()).resolves.toEqual({
      status: 'ok',
      info: {},
      error: {},
      details: {},
    });

    expect(healthCheckServiceMock.check).toHaveBeenCalledTimes(1);
    expect(healthCheckServiceMock.check.mock.calls[0][0]).toHaveLength(1);
  });
});
