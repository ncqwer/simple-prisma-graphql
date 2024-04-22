import { Job, IJob } from '@midwayjs/cron';
import { FORMAT, Inject } from '@midwayjs/core';
import { TokenService } from '../service/token';

@Job({
  cronTime: process.env.ACCESS_TOKEN_CRON || FORMAT.CRONTAB.EVERY_PER_30_MINUTE,
  start: true,
})
export class AccessTokenJob implements IJob {
  @Inject()
  tokenService: TokenService;
  async onTick() {
    await this.tokenService.generateAccessToken();
  }
}
