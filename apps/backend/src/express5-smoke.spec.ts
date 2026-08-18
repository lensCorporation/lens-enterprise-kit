/* eslint-disable @typescript-eslint/no-var-requires, no-console */
/**
 * Runtime smoke test for the NestJS 10 -> 11 / Express 4 -> 5 upgrade.
 *
 * `nest build` only proves the TypeScript compiles. It proves nothing about whether
 * Express 5's new router (path-to-regexp@8) will accept the route patterns this app
 * registers AT RUNTIME. This file boots a REAL Nest 11 HTTP application
 * (Test.createTestingModule -> app.init()) and drives it with supertest.
 *
 * Self-contained: no Postgres, no Redis, no SuperTokens, no S3.
 *
 * SCOPE - read this before trusting it: every test here boots a SYNTHETIC fixture
 * module defined inside this file. It does NOT boot this repo's AppModule (which
 * needs Postgres/Redis/SuperTokens), and it imports no production source. So it
 * proves the FRAMEWORK STACK works - Nest 11 + Express 5 + multer 2 + Swagger -
 * and it pins the Express 5 breaking changes that would bite this app later
 * (optional ":id?" params now throw at boot; req.query is getter-only).
 * It is NOT a guard on this app's own routes. That assurance comes from the
 * route audit: every @Get/@Post/@Controller path in src/** is a literal string,
 * and the one legacy pattern is forRoutes('*') in auth.module.ts, which Nest 11
 * silently rewrites to '{*path}'.
 *
 * Kept rather than deleted: it costs ~1s and it is the only thing standing
 * between this codebase and a silent Express 5 routing regression.
 */
import {
  All,
  Body,
  Controller,
  Get,
  Injectable,
  INestApplication,
  MiddlewareConsumer,
  Module,
  NestMiddleware,
  NestModule,
  Param,
  Post,
  Query,
  Req,
  UploadedFile,
  UseInterceptors,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger';
import { Test } from '@nestjs/testing';
import * as request from 'supertest';

jest.setTimeout(30000);

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------
async function boot(moduleClass: any): Promise<INestApplication> {
  const moduleRef = await Test.createTestingModule({
    imports: [moduleClass],
  }).compile();
  const app = moduleRef.createNestApplication();
  await app.init();
  return app;
}

/** Boot but capture the error, for "does Express 5 reject this pattern?" probes. */
async function tryBoot(
  moduleClass: any,
): Promise<{ app?: INestApplication; error?: Error }> {
  try {
    return { app: await boot(moduleClass) };
  } catch (error: any) {
    return { error };
  }
}

// ===========================================================================
// Fixtures
// ===========================================================================

/** A normal, Express-5-correct controller. */
@Controller('smoke')
class SmokeController {
  @Get()
  root(): string {
    return 'root-ok';
  }

  @Get('hello')
  hello(): { msg: string } {
    return { msg: 'hello-ok' };
  }

  @Get('items/:id')
  byId(@Param('id') id: string): { id: string } {
    return { id };
  }

  @Get('items/:id/children/:childId')
  nested(@Param() params: any): any {
    return params;
  }

  @Get('search')
  search(@Query('q') q: string, @Query('page') page: string): any {
    return { q, page };
  }

  @Post('items')
  create(@Body() body: any): any {
    return { received: body };
  }

  @All('any')
  anyMethod(@Req() req: any): { method: string } {
    return { method: req.method };
  }

  /** Express 5 named-wildcard ("splat") syntax. */
  @Get('files/*splat')
  splat(@Param() params: any, @Req() req: any): any {
    return { params, path: req.path };
  }

  /**
   * Express 5 optional-group syntax, the replacement for ':id?'.
   * NOTE the slash lives INSIDE the braces: 'opt{/:id}', not 'opt/{:id}'.
   * With 'opt/{:id}' the slash stays literal and '/smoke/opt' 404s.
   */
  @Get('opt{/:id}')
  optionalGroup(@Param('id') id: string): any {
    return { id: id ?? null };
  }

  /** The naive (wrong) translation of ':id?', kept to prove the difference. */
  @Get('optbad/{:id}')
  optionalGroupWrong(@Param('id') id: string): any {
    return { id: id ?? null };
  }

  /** Probes the Express 5 `req.query` getter. */
  @Get('query-mutate')
  queryMutate(@Req() req: any): any {
    const before = { ...req.query };

    let assignThrew = false;
    let assignErrorName: string | null = null;
    try {
      req.query = { replaced: 'yes' };
    } catch (e: any) {
      assignThrew = true;
      assignErrorName = e.constructor.name;
    }

    // In Express 5 `req.query` is a getter that re-parses on every access, so
    // even in-place mutation does not survive to the next read.
    req.query.injected = 'in-place';
    const inPlaceSurvived = req.query.injected === 'in-place';

    return {
      before,
      assignThrew,
      assignErrorName,
      inPlaceSurvived,
      keysAfter: Object.keys(req.query),
    };
  }

  @Post('upload')
  @UseInterceptors(FileInterceptor('file'))
  upload(@UploadedFile() file: any, @Body() body: any): any {
    return {
      originalname: file?.originalname,
      size: file?.size,
      content: file?.buffer?.toString(),
      field: body?.label,
    };
  }
}

@Module({ controllers: [SmokeController] })
class SmokeModule {}

/** Express 4 legacy '*' wildcard on a controller route. */
@Controller('legacy')
class LegacyStarController {
  @Get('*')
  star(@Req() req: any): any {
    return { path: req.path };
  }
}

@Module({ controllers: [LegacyStarController] })
class LegacyStarModule {}

/** Express 4 optional param ':id?' -- removed in path-to-regexp@8. */
@Controller('opt')
class OptionalParamController {
  @Get('thing/:id?')
  thing(@Param('id') id: string): any {
    return { id: id ?? null };
  }
}

@Module({ controllers: [OptionalParamController] })
class OptionalParamModule {}

/** Express 4 regex-ish route. */
@Controller('re')
class RegexRouteController {
  @Get('files/(.*)')
  any(@Req() req: any): any {
    return { path: req.path };
  }
}

@Module({ controllers: [RegexRouteController] })
class RegexRouteModule {}

// --- middleware fixtures ---------------------------------------------------
@Injectable()
class MarkerMiddleware implements NestMiddleware {
  use(req: any, res: any, next: () => void) {
    res.setHeader('x-mw-ran', 'yes');
    // Nest mounts wildcard middleware as app.use('{*path}', mw), so Express
    // consumes the ENTIRE path as the mount prefix: req.url/req.path become '/'
    // and req.baseUrl holds the real path. Only req.originalUrl is intact.
    // (Express 4 + app.use('*') did exactly the same -- this is NOT new in v5,
    // but it is a trap when hand-writing middleware.)
    res.setHeader('x-mw-url', String(req.url));
    res.setHeader('x-mw-baseurl', String(req.baseUrl));
    res.setHeader('x-mw-originalurl', String(req.originalUrl));

    // SuperTokens' express middleware terminates the request itself for the
    // paths it owns (/auth/*) -- paths that have NO Nest controller. It reads
    // `this.request.originalUrl || this.request.url` to do so
    // (supertokens-node/lib/build/framework/express/framework.js:59).
    if (String(req.originalUrl).startsWith('/auth/')) {
      res.status(200).json({ handledByMiddleware: req.originalUrl });
      return;
    }
    next();
  }
}

@Controller()
class MwTargetController {
  @Get()
  index(): string {
    return 'index';
  }

  @Get('mw/root')
  a(): string {
    return 'a';
  }

  @Get('mw/deep/nested/path')
  b(): string {
    return 'b';
  }

  @Get('queues')
  queues(): string {
    return 'queues';
  }

  @Get('queues/static/main.js')
  queuesAsset(): string {
    return 'asset';
  }
}

/** Exactly what src/auth/auth.module.ts:15 does. */
@Module({ controllers: [MwTargetController] })
class MwStarModule implements NestModule {
  configure(consumer: MiddlewareConsumer) {
    consumer.apply(MarkerMiddleware).forRoutes('*');
  }
}

/** The Nest 11 / Express 5 documented equivalent. */
@Module({ controllers: [MwTargetController] })
class MwSplatModule implements NestModule {
  configure(consumer: MiddlewareConsumer) {
    consumer.apply(MarkerMiddleware).forRoutes('{*splat}');
  }
}

/** What @bull-board/nestjs does: forRoutes('/queues'). Must PREFIX-match. */
@Module({ controllers: [MwTargetController] })
class MwPrefixModule implements NestModule {
  configure(consumer: MiddlewareConsumer) {
    consumer.apply(MarkerMiddleware).forRoutes('/queues');
  }
}

// ===========================================================================
// TESTS
// ===========================================================================
describe('Nest 11 / Express 5 runtime smoke', () => {
  // -------------------------------------------------------------------------
  describe('A. the runtime really is Nest 11 on Express 5', () => {
    it('@nestjs/platform-express resolves express@5, core is @nestjs/core@11', () => {
      const expressPkgPath = require.resolve('express/package.json', {
        paths: [require.resolve('@nestjs/platform-express')],
      });
      const expressVersion = require(expressPkgPath).version;
      const nestCoreVersion = require('@nestjs/core/package.json').version;

      console.log(
        `[smoke] @nestjs/core=${nestCoreVersion} express=${expressVersion}`,
      );

      expect(nestCoreVersion.startsWith('11.')).toBe(true);
      expect(expressVersion.startsWith('5.')).toBe(true);
    });
  });

  // -------------------------------------------------------------------------
  describe('B. a real HTTP app boots and serves requests', () => {
    let app: INestApplication;

    beforeAll(async () => {
      app = await boot(SmokeModule);
    });
    afterAll(async () => {
      if (app) await app.close();
    });

    it('app.init() produced a live HTTP server', () => {
      expect(app.getHttpServer()).toBeDefined();
      expect(app.getHttpAdapter().getType()).toBe('express');
    });

    it('GET /smoke -> controller root', async () => {
      const res = await request(app.getHttpServer()).get('/smoke').expect(200);
      expect(res.text).toBe('root-ok');
    });

    it('GET /smoke/hello -> JSON', async () => {
      const res = await request(app.getHttpServer())
        .get('/smoke/hello')
        .expect(200);
      expect(res.body).toEqual({ msg: 'hello-ok' });
    });

    it('GET /smoke/items/:id -> route param', async () => {
      const res = await request(app.getHttpServer())
        .get('/smoke/items/abc-123')
        .expect(200);
      expect(res.body).toEqual({ id: 'abc-123' });
    });

    it('GET /smoke/items/:id/children/:childId -> multiple params', async () => {
      const res = await request(app.getHttpServer())
        .get('/smoke/items/7/children/9')
        .expect(200);
      expect(res.body).toEqual({ id: '7', childId: '9' });
    });

    it('GET /smoke/search?q=..&page=.. -> query string parsing', async () => {
      const res = await request(app.getHttpServer())
        .get('/smoke/search?q=widgets&page=2')
        .expect(200);
      expect(res.body).toEqual({ q: 'widgets', page: '2' });
    });

    it('POST /smoke/items -> JSON body parsing', async () => {
      const res = await request(app.getHttpServer())
        .post('/smoke/items')
        .send({ name: 'thing', n: 7 })
        .expect(201);
      expect(res.body).toEqual({ received: { name: 'thing', n: 7 } });
    });

    it('POST /smoke/items -> urlencoded body parsing', async () => {
      const res = await request(app.getHttpServer())
        .post('/smoke/items')
        .type('form')
        .send({ a: '1' })
        .expect(201);
      expect(res.body).toEqual({ received: { a: '1' } });
    });

    it('@All() answers multiple verbs', async () => {
      expect(
        (await request(app.getHttpServer()).get('/smoke/any').expect(200)).body,
      ).toEqual({ method: 'GET' });
      expect(
        (await request(app.getHttpServer()).put('/smoke/any').expect(200)).body,
      ).toEqual({ method: 'PUT' });
      expect(
        (await request(app.getHttpServer()).delete('/smoke/any').expect(200))
          .body,
      ).toEqual({ method: 'DELETE' });
    });

    it('unknown route still 404s (the router is genuinely wired up)', async () => {
      await request(app.getHttpServer()).get('/definitely-not-here').expect(404);
    });

    it('multer 2 file upload through FileInterceptor works', async () => {
      const res = await request(app.getHttpServer())
        .post('/smoke/upload')
        .field('label', 'my-label')
        .attach('file', Buffer.from('hello-multer'), 'note.txt')
        .expect(201);
      expect(res.body).toEqual({
        originalname: 'note.txt',
        size: 12,
        content: 'hello-multer',
        field: 'my-label',
      });
    });
  });

  // -------------------------------------------------------------------------
  describe('C. Express 5 BREAKING: wildcards must be named', () => {
    let app: INestApplication;

    beforeAll(async () => {
      app = await boot(SmokeModule);
    });
    afterAll(async () => {
      if (app) await app.close();
    });

    it('"/*splat" matches a multi-segment tail and yields an ARRAY param', async () => {
      const res = await request(app.getHttpServer())
        .get('/smoke/files/a/b/c.txt')
        .expect(200);
      console.log('[smoke] splat params =', JSON.stringify(res.body));
      expect(res.body.path).toBe('/smoke/files/a/b/c.txt');
      // Express 4 gave you req.params[0] === 'a/b/c.txt' (a string).
      // Express 5 gives a NAMED param that is an ARRAY of segments.
      expect(Array.isArray(res.body.params.splat)).toBe(true);
      expect(res.body.params.splat).toEqual(['a', 'b', 'c.txt']);
    });

    it('legacy "@Get(\'*\')" still boots -- Nest 11 auto-converts it to "{*path}"', async () => {
      const { app: legacyApp, error } = await tryBoot(LegacyStarModule);
      console.log(
        '[smoke] @Get("*") boot ->',
        error ? `THREW: ${error.message}` : 'booted (auto-converted)',
      );
      expect(error).toBeUndefined();

      const deep = await request(legacyApp.getHttpServer()).get('/legacy/a/b/c');
      const one = await request(legacyApp.getHttpServer()).get(
        '/legacy/anything',
      );
      const bare = await request(legacyApp.getHttpServer()).get('/legacy');

      expect(deep.status).toBe(200);
      expect(one.status).toBe(200);
      // '/legacy/*' -> '/legacy/{*path}': the slash stays literal, so bare
      // '/legacy' does not match. Same as Express 4.
      expect(bare.status).toBe(404);

      await legacyApp.close();
    });

    it('legacy "@Get(\'(.*)\')" still boots -- Nest 11 auto-converts it too', async () => {
      const { app: reApp, error } = await tryBoot(RegexRouteModule);
      console.log(
        '[smoke] @Get("(.*)") boot ->',
        error ? `THREW: ${error.message}` : 'booted (auto-converted)',
      );
      expect(error).toBeUndefined();
      const res = await request(reApp.getHttpServer()).get('/re/files/x/y');
      expect(res.status).toBe(200);
      await reApp.close();
    });
  });

  // -------------------------------------------------------------------------
  describe('D. Express 5 BREAKING: optional params ":id?" are gone', () => {
    it('a controller using ":id?" HARD-FAILS at app.init() -- not caught by nest build', async () => {
      const { app: badApp, error } = await tryBoot(OptionalParamModule);
      console.log(
        '[smoke] ":id?" boot ->',
        error ? `THREW: ${error.message}` : 'booted',
      );
      if (badApp) await badApp.close();

      expect(error).toBeDefined();
      // path-to-regexp@8 rejects the '?' modifier outright. Nest's
      // LegacyRouteConverter only rewrites *, +, and (.*) -- never ':x?'.
      expect(error!.message).toMatch(/Unexpected \?/);
    });

    it('the correct replacement is "path{/:id}" -- slash INSIDE the braces', async () => {
      const app = await boot(SmokeModule);
      const withId = await request(app.getHttpServer()).get('/smoke/opt/xyz');
      const withoutId = await request(app.getHttpServer()).get('/smoke/opt');
      console.log(
        `[smoke] "opt{/:id}": /smoke/opt/xyz=${withId.status} /smoke/opt=${withoutId.status}`,
      );
      expect(withId.status).toBe(200);
      expect(withId.body).toEqual({ id: 'xyz' });
      expect(withoutId.status).toBe(200);
      expect(withoutId.body).toEqual({ id: null });
      await app.close();
    });

    it('the NAIVE translation "path/{:id}" compiles but still 404s without the param', async () => {
      const app = await boot(SmokeModule);
      const withId = await request(app.getHttpServer()).get('/smoke/optbad/xyz');
      const withoutId = await request(app.getHttpServer()).get('/smoke/optbad');
      console.log(
        `[smoke] "optbad/{:id}": /smoke/optbad/xyz=${withId.status} /smoke/optbad=${withoutId.status}`,
      );
      expect(withId.status).toBe(200);
      // The literal slash is outside the optional group -> NOT actually optional.
      expect(withoutId.status).toBe(404);
      await app.close();
    });
  });

  // -------------------------------------------------------------------------
  describe('E. Express 5 BREAKING: req.query is a getter', () => {
    let app: INestApplication;

    beforeAll(async () => {
      app = await boot(SmokeModule);
    });
    afterAll(async () => {
      if (app) await app.close();
    });

    it('assigning req.query throws, and in-place mutation silently does not persist', async () => {
      const res = await request(app.getHttpServer())
        .get('/smoke/query-mutate?a=1')
        .expect(200);
      console.log('[smoke] query-mutate =', JSON.stringify(res.body));

      expect(res.body.before).toEqual({ a: '1' });

      // Express 4: req.query was a plain writable property.
      // Express 5: it is a getter -> assignment throws TypeError.
      expect(res.body.assignThrew).toBe(true);
      expect(res.body.assignErrorName).toBe('TypeError');

      // And because the getter re-parses the URL on every access, mutating the
      // returned object is a silent no-op. This is the dangerous one: no error,
      // the data just vanishes.
      expect(res.body.inPlaceSurvived).toBe(false);
      expect(res.body.keysAfter).toEqual(['a']);
    });
  });

  // -------------------------------------------------------------------------
  describe('F. middleware route patterns (mirrors real modules)', () => {
    it('forRoutes("*") -- src/auth/auth.module.ts:15 -- still runs on every route', async () => {
      const { app, error } = await tryBoot(MwStarModule);
      console.log(
        '[smoke] forRoutes("*") boot ->',
        error ? `THREW: ${error.message}` : 'booted (auto-converted, no warning)',
      );
      expect(error).toBeUndefined();

      const root = await request(app.getHttpServer()).get('/');
      const one = await request(app.getHttpServer()).get('/mw/root');
      const deep = await request(app.getHttpServer()).get(
        '/mw/deep/nested/path',
      );
      console.log(
        `[smoke] forRoutes("*"): / -> ${root.headers['x-mw-ran']} (${root.status}), ` +
          `/mw/root -> ${one.headers['x-mw-ran']} (${one.status}), ` +
          `/mw/deep/nested/path -> ${deep.headers['x-mw-ran']} (${deep.status})`,
      );

      expect(root.headers['x-mw-ran']).toBe('yes');
      expect(one.headers['x-mw-ran']).toBe('yes');
      expect(deep.headers['x-mw-ran']).toBe('yes');

      // THE ONE THAT ACTUALLY MATTERS for SuperTokens: the middleware must run
      // on paths that have NO Nest controller at all, and be able to terminate
      // the request itself. The entire /auth/* surface is served this way.
      const unrouted = await request(app.getHttpServer()).get(
        '/auth/signinup/code',
      );
      console.log(
        `[smoke] forRoutes("*") on UNROUTED /auth/signinup/code -> ` +
          `${unrouted.status} ${JSON.stringify(unrouted.body)}`,
      );
      expect(unrouted.status).toBe(200);
      expect(unrouted.body).toEqual({
        handledByMiddleware: '/auth/signinup/code',
      });

      // Document the mount-prefix stripping that makes req.url useless here.
      expect(deep.headers['x-mw-url']).toBe('/');
      expect(deep.headers['x-mw-baseurl']).toBe('/mw/deep/nested/path');
      expect(deep.headers['x-mw-originalurl']).toBe('/mw/deep/nested/path');

      await app.close();
    });

    it('forRoutes("{*splat}") -- the documented Nest 11 form -- behaves identically', async () => {
      const { app, error } = await tryBoot(MwSplatModule);
      expect(error).toBeUndefined();
      const root = await request(app.getHttpServer()).get('/');
      const deep = await request(app.getHttpServer()).get(
        '/mw/deep/nested/path',
      );
      expect(root.headers['x-mw-ran']).toBe('yes');
      expect(deep.headers['x-mw-ran']).toBe('yes');
      await app.close();
    });

    it('forRoutes("/queues") -- @bull-board/nestjs -- still PREFIX-matches sub-paths', async () => {
      const { app, error } = await tryBoot(MwPrefixModule);
      expect(error).toBeUndefined();

      const exact = await request(app.getHttpServer()).get('/queues');
      const asset = await request(app.getHttpServer()).get(
        '/queues/static/main.js',
      );
      const unrelated = await request(app.getHttpServer()).get('/mw/root');
      console.log(
        `[smoke] forRoutes("/queues"): /queues -> ${exact.headers['x-mw-ran']}, ` +
          `/queues/static/main.js -> ${asset.headers['x-mw-ran']}, ` +
          `/mw/root -> ${unrelated.headers['x-mw-ran']}`,
      );

      expect(exact.headers['x-mw-ran']).toBe('yes');
      // If this ever regresses to exact-match, the Bull dashboard UI 404s.
      expect(asset.headers['x-mw-ran']).toBe('yes');
      expect(unrelated.headers['x-mw-ran']).toBeUndefined();
      await app.close();
    });

    it('app.use("/trpc", handler) -- nestjs-trpc express driver -- mounts and strips the prefix', async () => {
      const moduleRef = await Test.createTestingModule({
        imports: [SmokeModule],
      }).compile();
      const app = moduleRef.createNestApplication();
      app.use('/trpc', (req: any, res: any) => {
        res.json({ mounted: true, url: req.url, baseUrl: req.baseUrl });
      });
      await app.init();

      const res = await request(app.getHttpServer())
        .get('/trpc/products.list?input=%7B%7D')
        .expect(200);
      console.log('[smoke] app.use("/trpc") ->', JSON.stringify(res.body));
      expect(res.body.mounted).toBe(true);
      expect(res.body.baseUrl).toBe('/trpc');
      expect(res.body.url).toBe('/products.list?input=%7B%7D');
      await app.close();
    });
  });

  // -------------------------------------------------------------------------
  describe('G. SwaggerModule.setup() -- main.ts:78 -- under Express 5', () => {
    it('registers /api-docs and serves the UI + JSON without a route-pattern error', async () => {
      const moduleRef = await Test.createTestingModule({
        imports: [SmokeModule],
      }).compile();
      const app = moduleRef.createNestApplication();

      const config = new DocumentBuilder()
        .setTitle('CDMS API')
        .setVersion('3.0')
        .addBearerAuth()
        .build();
      const document = SwaggerModule.createDocument(app, config);
      SwaggerModule.setup('api-docs', app, document);
      await app.init();

      const ui = await request(app.getHttpServer()).get('/api-docs');
      const json = await request(app.getHttpServer()).get('/api-docs-json');
      console.log(
        `[smoke] swagger: /api-docs=${ui.status} /api-docs-json=${json.status}`,
      );

      expect([200, 301, 302]).toContain(ui.status);
      expect(json.status).toBe(200);
      expect(json.body.info.title).toBe('CDMS API');
      await app.close();
    });
  });
});
