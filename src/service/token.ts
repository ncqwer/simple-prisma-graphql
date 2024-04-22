import { Autoload, Init, Provide, Scope, ScopeEnum } from '@midwayjs/core';
import { v4 as uuid } from 'uuid';
import fsp, { constants } from 'fs/promises';
import * as path from 'path';
import { cwd } from 'process';
import dayjs from 'dayjs';

@Autoload()
@Provide()
@Scope(ScopeEnum.Singleton)
export class TokenService {
  private accessToken: string;
  private prevAccessToken: string;
  private accessTokenAt: number;
  private refreshToken: string;
  private prevRefreshToken: string;
  private refreshTokenAt: number;

  cbs: ((accessToken: string) => void)[] = [];

  @Init()
  async init() {
    const dir = path.dirname(path.resolve(cwd(), 'token', 'accessToken.txt'));
    try {
      await fsp.access(dir, constants.R_OK | constants.W_OK);
    } catch {
      await fsp.mkdir(dir, { recursive: true });
    }
  }

  getAccesstoken() {
    return this.accessToken;
  }

  async generateAccessToken() {
    const newToken = uuid();
    await fsp.writeFile(
      path.resolve(cwd(), 'token', 'accessToken.txt'),
      newToken,
      { encoding: 'utf-8' }
    );
    this.prevAccessToken = this.accessToken;
    this.accessToken = newToken;
    this.accessTokenAt = dayjs().valueOf();

    this.cbs.forEach(f => f(this.accessToken));
  }

  register(cb: (accessToken: string) => void) {
    this.cbs.push(cb);
    return () => {
      this.cbs = this.cbs.filter(v => v !== cb);
    };
  }
  async generateRefreshToken() {
    const newToken = uuid();
    await fsp.writeFile(
      path.resolve(cwd(), 'token', 'refreshToken.txt'),
      newToken,
      { encoding: 'utf-8' }
    );
    this.prevRefreshToken = this.refreshToken;
    this.refreshToken = newToken;
    this.refreshTokenAt = dayjs().valueOf();
  }

  isValidAccessToken(token: string) {
    const minutes = dayjs().diff(dayjs(this.accessTokenAt), 'minutes');
    return (
      token === this.accessToken ||
      (this.prevAccessToken && token === this.prevAccessToken && minutes < 5)
    );
  }

  isValidRefreshToken(token: string) {
    const minutes = dayjs().diff(dayjs(this.refreshTokenAt), 'minutes');
    return (
      token === this.refreshToken ||
      (this.prevRefreshToken && token === this.prevRefreshToken && minutes < 5)
    );
  }
}
