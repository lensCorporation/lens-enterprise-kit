import { Injectable } from '@nestjs/common';
import { ContextOptions, TRPCContext } from 'nestjs-trpc';
import { IAppContext } from './trpc.context';

@Injectable()
export class AppContext implements TRPCContext {
  async create(opt: ContextOptions){
    return {
      req: opt.req,
      res: opt.res,
    };
  }
}