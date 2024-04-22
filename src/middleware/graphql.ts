import { Middleware, IMiddleware, Inject } from '@midwayjs/core';
import { NextFunction, Context } from '@midwayjs/koa';
import { GenerateService } from '../service/generate';

@Middleware()
export class GraphqlMiddleware implements IMiddleware<Context, NextFunction> {
  @Inject()
  generateService: GenerateService;

  match(ctx: Context): boolean {
    // 下面的匹配到的路由会执行此中间件
    if (ctx.path.startsWith('/graphql')) {
      return true;
    }
    return false;
  }

  resolve() {
    return async (ctx: Context, next: NextFunction) => {
      const middleware = this.generateService.getMiddleware();
      return middleware(ctx as any, next);
    };
  }

  static getName(): string {
    return 'graphql';
  }
}
