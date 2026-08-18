import { Test, TestingModule } from '@nestjs/testing';
import { ThrottlerGuard } from '@nestjs/throttler';
import { LocalauthController } from './localauth.controller';
import { LocalauthService } from './localauth.service';
import { AuthGuard } from './localauth.guard';

describe('LocalauthController', () => {
  let controller: LocalauthController;

  // The controller only depends on LocalauthService; it is fully mocked so no
  // database, Redis or JWT machinery is touched.
  const localAuthServiceMock = {
    createUser: jest.fn(),
    login: jest.fn(),
    getSessions: jest.fn(),
    refreshToken: jest.fn(),
    activateUserMFA: jest.fn(),
    disableUserMFA: jest.fn(),
    logout: jest.fn(),
  };

  const allowGuard = { canActivate: jest.fn().mockReturnValue(true) };

  beforeEach(async () => {
    jest.clearAllMocks();

    const module: TestingModule = await Test.createTestingModule({
      controllers: [LocalauthController],
      providers: [{ provide: LocalauthService, useValue: localAuthServiceMock }],
    })
      // Route handlers are decorated with @UseGuards(ThrottlerGuard) and
      // @UseGuards(AuthGuard); both are replaced so their own dependencies
      // (throttler storage, Redis-backed AuthHelper) are never constructed.
      .overrideGuard(ThrottlerGuard)
      .useValue(allowGuard)
      .overrideGuard(AuthGuard)
      .useValue(allowGuard)
      .compile();

    controller = module.get<LocalauthController>(LocalauthController);
  });

  it('should be defined', () => {
    expect(controller).toBeDefined();
  });

  it('should delegate login to LocalauthService with (req, body)', async () => {
    const req = { ip: '127.0.0.1' } as any;
    const body = { email: 'user@example.com', password: 'secret' };
    const expected = { accessToken: 'a', refreshToken: 'r' };
    localAuthServiceMock.login.mockResolvedValue(expected);

    await expect(controller.login(body, req)).resolves.toBe(expected);
    expect(localAuthServiceMock.login).toHaveBeenCalledWith(req, body);
  });
});
