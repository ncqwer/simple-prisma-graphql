import {
  Body,
  ContentType,
  Controller,
  Get,
  Inject,
  Post,
} from '@midwayjs/core';
import { GenerateService } from '../service/generate';
import { TokenService } from '../service/token';
import { SSEStream } from '../utils/SSEStream';
import { Context } from '@midwayjs/koa';

import dayjs from 'dayjs';
import cornParser from 'cron-parser';
import { RestfulMiddleware } from '../middleware/restfulResult';
import { AccessTokenMiddleware } from '../middleware/accessToken';

@Controller('/', { middleware: [RestfulMiddleware] })
export class HomeController {
  @Inject()
  generateService: GenerateService;

  @Inject()
  tokenService: TokenService;

  @Inject()
  ctx: Context;

  @Get('/')
  async home(): Promise<string> {
    return 'Hello Midwayjs!';
  }

  @Post('/generate', { middleware: [AccessTokenMiddleware] })
  @ContentType('application/json')
  async generate(
    @Body('schemaContent') schemaContent?: string,
    @Body('stream') stream = false
  ) {
    console.log(this.ctx.request.body);
    const [_stream, promise] = await this.generateService.generate(
      schemaContent
    );
    if (stream) {
      const ctx = this.ctx;

      ctx.request.socket.setTimeout(0);
      ctx.req.socket.setNoDelay(true);
      ctx.req.socket.setKeepAlive(true);

      ctx.set({
        'Content-Type': 'text/event-stream',
        'Cache-Control': 'no-cache',
        Connection: 'keep-alive',
      });

      ctx.status = 200;
      ctx.body = _stream;
    } else {
      this.ctx.set({
        'Content-Type': 'application/json',
      });
      this.ctx.status = 200;
      this.ctx.body = await promise;
    }
  }

  @Post('/accessToken')
  async accessToken(
    @Body('refreshToken') refreshToken: string,
    @Body('stream') stream = false
  ) {
    if (!this.tokenService.isValidRefreshToken(refreshToken))
      throw new Error('No Permission!!!');
    if (stream) {
      const stream = new SSEStream();
      let flag = true;
      const cb = (token: string) => {
        if (flag) {
          stream.write({ type: 'data', message: token });
        }
      };
      cb(this.tokenService.getAccesstoken());
      const un = this.tokenService.register(cb);
      stream.on('close', () => {
        flag = false;
        un();
      });
      const ctx = this.ctx;

      ctx.request.socket.setTimeout(0);
      ctx.req.socket.setNoDelay(true);
      ctx.req.socket.setKeepAlive(true);

      ctx.set({
        'Content-Type': 'text/event-stream',
        'Cache-Control': 'no-cache',
        Connection: 'keep-alive',
      });

      ctx.status = 200;
      ctx.body = stream;
    } else {
      const cronString = process.env.ACCESS_TOKEN_CRON || '*/30 * * * *';
      const expiredAt = dayjs(
        cornParser.parseExpression(cronString).next().toString()
      ).valueOf();
      this.ctx.set({
        'Content-Type': 'application/json',
      });
      this.ctx.status = 200;
      this.ctx.body = {
        expiredAt,
        accessToken: this.tokenService.getAccesstoken(),
      };
    }
  }
}
