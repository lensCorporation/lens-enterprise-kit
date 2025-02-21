import { Injectable } from '@nestjs/common';
import { ContextOptions, TRPCContext } from 'nestjs-trpc';
import { Request, Response } from 'express';
@Injectable()
export class AppContext implements TRPCContext {
  async create(opt: ContextOptions): Promise<IAppContext> {
    return {
      req: opt.req,
      res: opt.res,
    };
  }
}


export interface IAppContext {
  req: Request;
  res: Response;
}