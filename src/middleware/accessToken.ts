import { Middleware, IMiddleware, Inject } from '@midwayjs/core';
import { NextFunction, Context } from '@midwayjs/koa';
import { TokenService } from '../service/token';

@Middleware()
export class AccessTokenMiddleware
  implements IMiddleware<Context, NextFunction>
{
  @Inject()
  tokenService: TokenService;

  resolve() {
    return async (ctx: Context, next: NextFunction) => {
      // 控制器前执行的逻辑
      const accessToken: string = (ctx.headers?.Authorization ||
        ctx.headers.authorization) as string;
      if (!this.tokenService.isValidAccessToken(accessToken)) {
        throw new Error('Token is expired!');
      }
      return await next();
    };
  }

  static getName(): string {
    return 'accessToken';
  }
}
