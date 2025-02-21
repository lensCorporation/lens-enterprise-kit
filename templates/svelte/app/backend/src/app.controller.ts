import { Body, Controller, Get, Post, UseGuards } from '@nestjs/common';
// ...
import { SessionContainer } from "supertokens-node/recipe/session";
import { AuthGuard } from './auth/auth.guard';
import { Session } from './auth/session.decorator';
import { Throttle, ThrottlerGuard } from '@nestjs/throttler';
import { AppService } from './app.service';
import { CacheKey, CacheTTL } from '@nestjs/cache-manager';
import { CreateUserDto } from './test.dto';
// ...

@Controller()
export class AppController {


  constructor(private readonly appService: AppService){}


  @Post('test')
  async testFn(@Body() body:CreateUserDto)
  {
    console.log(body)
    return "hi"
  }

  @Throttle({ default: { limit: 1, ttl: 6000 } })
  @UseGuards(ThrottlerGuard) 
  @Get()
  getHello(): any {
    this.appService.getHello()
    return "Hello World"
  }

  @Get('/testManualCache')
  getCache(): any {
    return this.appService.getCache()
  }
  @CacheKey('custom_key')
  @CacheTTL(10000)
  @Get('/testAutomaticCache')
  getCache2(): any {
    console.log('I hit')
    return 'hi'
  }

  // ...
  // Test endpoint for session verification; not part of the Supertokens setup.
  @Get('/test')
  @UseGuards(new AuthGuard())
  getSessionInfo(
    @Session() session: SessionContainer,
  ): Record<string, unknown> {
    return {
      sessionHandle: session.getHandle(),
      userId: session.getUserId(),
      accessTokenPayload: session.getAccessTokenPayload(),
    };
  }
}