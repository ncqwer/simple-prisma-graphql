import { Configuration, App, Inject } from '@midwayjs/core';
import * as koa from '@midwayjs/koa';
import * as validate from '@midwayjs/validate';
import * as info from '@midwayjs/info';
import cors from '@koa/cors';
import bodyParser from 'koa-bodyparser';
import * as dotenv from 'dotenv';
import { join } from 'path';
// import { DefaultErrorFilter } from './filter/default.filter';
// import { NotFoundFilter } from './filter/notfound.filter';
import { GraphqlMiddleware } from './middleware/graphql';
import { GenerateService } from './service/generate';
import { TokenService } from './service/token';
import * as cron from '@midwayjs/cron';

dotenv.config();

@Configuration({
  imports: [
    koa,
    validate,
    {
      component: info,
      enabledEnvironment: ['local'],
    },
    cron,
  ],
  importConfigs: [join(__dirname, './config')],
})
export class ContainerLifeCycle {
  @App()
  app: koa.Application;

  @Inject()
  genrateServices: GenerateService;

  @Inject()
  tokenServices: TokenService;

  async onReady() {
    // add middleware
    this.app.useMiddleware([
      cors({
        origin: process.env.CROS_ORIGIN || '*',
      }),
      bodyParser(),
      GraphqlMiddleware,
    ]);

    if (process.env.GENERATE_ON_START) {
      const [stream, promise] = await this.genrateServices.generate();
      stream.on('data', v => console.log(v.toString()));
      await promise;
    }
    await this.tokenServices.generateAccessToken();
    await this.tokenServices.generateRefreshToken();
    // add filter
    // this.app.useFilter([NotFoundFilter, DefaultErrorFilter]);
  }
}
