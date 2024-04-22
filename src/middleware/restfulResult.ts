import { Middleware, IMiddleware } from '@midwayjs/core';
import { NextFunction, Context } from '@midwayjs/koa';

@Middleware()
export class RestfulMiddleware implements IMiddleware<Context, NextFunction> {
  resolve() {
    return async (ctx: Context, next: NextFunction) => {
      // 控制器前执行的逻辑
      try {
        return await next();
      } catch (e) {
        ctx.set({
          'Content-Type': 'application/json',
        });
        ctx.status = 400;
        ctx.body = {
          error: e.message,
        };
      }
    };
  }

  static getName(): string {
    return 'restful';
  }
}
