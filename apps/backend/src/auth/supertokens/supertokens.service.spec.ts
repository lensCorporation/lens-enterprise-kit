import { Test, TestingModule } from '@nestjs/testing';

// The SupertokensService constructor calls supertokens.init(...) with real
// connection config. Mock the SDK and its recipes so nothing is initialised
// and no network request is ever made from the test process.
jest.mock('supertokens-node', () => ({
  __esModule: true,
  default: { init: jest.fn() },
}));

jest.mock('supertokens-node/recipe/session', () => ({
  __esModule: true,
  default: { init: jest.fn(() => ({ recipeId: 'session' })) },
}));

jest.mock('supertokens-node/recipe/emailpassword', () => ({
  __esModule: true,
  default: { init: jest.fn(() => ({ recipeId: 'emailpassword' })) },
}));

import supertokens from 'supertokens-node';
import Session from 'supertokens-node/recipe/session';
import EmailPassword from 'supertokens-node/recipe/emailpassword';
import { SupertokensService } from './supertokens.service';
import { AuthModuleConfig, ConfigInjectionToken } from '../config.interface';

describe('SupertokensService', () => {
  let service: SupertokensService;

  const config: AuthModuleConfig = {
    appInfo: {
      appName: 'test-app',
      apiDomain: 'http://localhost:3000',
      websiteDomain: 'http://localhost:3000',
      apiBasePath: '/auth',
      websiteBasePath: '/auth',
    },
    connectionURI: 'http://localhost:3567',
    apiKey: 'test-api-key',
  };

  beforeEach(async () => {
    jest.clearAllMocks();

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        SupertokensService,
        { provide: ConfigInjectionToken, useValue: config },
      ],
    }).compile();

    service = module.get<SupertokensService>(SupertokensService);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  it('should initialise the SuperTokens SDK from the injected config', () => {
    expect(supertokens.init).toHaveBeenCalledTimes(1);
    expect(supertokens.init).toHaveBeenCalledWith(
      expect.objectContaining({
        appInfo: config.appInfo,
        supertokens: {
          connectionURI: config.connectionURI,
          apiKey: config.apiKey,
        },
      }),
    );
    expect(EmailPassword.init).toHaveBeenCalledTimes(1);
    expect(Session.init).toHaveBeenCalledTimes(1);
  });
});
