import { Job, IJob } from '@midwayjs/cron';
import { FORMAT, Inject } from '@midwayjs/core';
import { TokenService } from '../service/token';

@Job({
  cronTime: process.env.REFRESH_TOKEN_CRON || FORMAT.CRONTAB.EVERY_DAY,
  start: true,
})
export class RefeshTokenJob implements IJob {
  @Inject()
  tokenService: TokenService;
  async onTick() {
    await this.tokenService.generateRefreshToken();
  }
}
