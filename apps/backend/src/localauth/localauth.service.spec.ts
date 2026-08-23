import { Test, TestingModule } from '@nestjs/testing';
import { LocalauthService } from './localauth.service';
import { PrismaService } from '../prisma.service';
import { AuthHelper } from './utils/auth.helper';

describe('LocalauthService', () => {
  let service: LocalauthService;

  // PrismaService is mocked delegate-by-delegate: no database connection is
  // opened and onModuleInit/$connect is never reached.
  const prismaServiceMock = {
    user: {
      create: jest.fn(),
      findUnique: jest.fn(),
      update: jest.fn(),
    },
    userLoginDetails: {
      create: jest.fn(),
      findUnique: jest.fn(),
      update: jest.fn(),
    },
    mfa: {
      create: jest.fn(),
      findUnique: jest.fn(),
    },
  };

  // AuthHelper is Redis- and JWT-backed in production, so it is mocked wholesale.
  const authHelperMock = {
    generateTokens: jest.fn(),
    validateAccessToken: jest.fn(),
    refreshAccessToken: jest.fn(),
    generateMfaSecret: jest.fn(),
    verifyMfaToken: jest.fn(),
    getAllActiveSessions: jest.fn(),
    sendMFA: jest.fn(),
    logout: jest.fn(),
  };

  beforeEach(async () => {
    jest.clearAllMocks();

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        LocalauthService,
        { provide: PrismaService, useValue: prismaServiceMock },
        { provide: AuthHelper, useValue: authHelperMock },
      ],
    }).compile();

    service = module.get<LocalauthService>(LocalauthService);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  it('should delegate logout to AuthHelper and return its message', async () => {
    const req = { user: { id: 'user-1' }, sessionId: 'session-1' } as any;
    authHelperMock.logout.mockResolvedValue({ message: 'Logged out successfully' });

    await expect(service.logout(req)).resolves.toEqual({
      message: 'Logged out successfully',
    });
    expect(authHelperMock.logout).toHaveBeenCalledWith(req);
  });
});
