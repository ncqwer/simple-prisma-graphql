/* eslint-disable node/no-unpublished-import */
/* eslint-disable node/no-unpublished-require */
import { Autoload, Inject, Provide, Scope, ScopeEnum } from '@midwayjs/core';
import { cwd } from 'process';
import * as path from 'path';
import * as fsp from 'fs/promises';
import md5 = require('md5');

import { ApolloServer } from '@apollo/server';
// import { ApolloServerPluginDrainHttpServer } from '@apollo/server/plugin/drainHttpServer';
import { koaMiddleware } from '@as-integrations/koa';
import { Authorized, buildSchema } from 'type-graphql';
import {
  ApolloServerPluginLandingPageLocalDefault,
  ApolloServerPluginLandingPageProductionDefault,
} from '@apollo/server/plugin/landingPage/default';

import { SSEStream } from '../utils/SSEStream';
import { execCommand } from '../utils/execCommand';
import { TokenService } from './token';
import type { PrismaClient } from '@prisma/client';

export type GenerateServiceState =
  | {
      type: 'reject';
      message: string;
    }
  | {
      type: 'fufilled';
    }
  | {
      type: 'pending';
    };

@Autoload()
@Provide()
@Scope(ScopeEnum.Singleton)
export class GenerateService {
  private prisma?: PrismaClient;
  private server?: ApolloServer;
  private middleware?: ReturnType<typeof koaMiddleware>;

  private prevHash?: string;
  private status: GenerateServiceState = {
    type: 'reject',
    message: 'no schema',
  };

  @Inject()
  tokenService: TokenService;

  getMiddleware() {
    if (this.status.type === 'pending')
      throw new Error('graphql中间件正在生成');
    if (this.status.type === 'reject') throw new Error(this.status.message);
    if (!this.prevHash) throw new Error('没有任何schema');
    return this.middleware!;
  }

  clearRequireCache() {
    const prismaDir = path.dirname(
      require.resolve('../../prisma/generated/prisma-client-js')
    );
    const prismaReg = new RegExp(`^${prismaDir}`);

    const typegraphqlDir = path.dirname(
      require.resolve('../../prisma/generated/type-graphql')
    );
    const typegraphqlReg = new RegExp(`^${typegraphqlDir}`);
    for (const k of Object.keys(require.cache)) {
      if (prismaReg.test(k)) {
        delete require.cache[k];
      }
      if (typegraphqlReg.test(k)) {
        delete require.cache[k];
      }
    }
  }

  async generate(content?: string) {
    if (this.status.type === 'pending') throw new Error('上次生成过程没有结束');
    let schemaContent: string;
    try {
      const schemaPath = path.resolve(cwd(), 'prisma', 'schema.prisma');
      if (content) {
        await fsp.writeFile(schemaPath, content, { encoding: 'utf-8' });
        schemaContent = content;
      } else {
        schemaContent = await fsp.readFile(schemaPath, {
          encoding: 'utf-8',
        });
      }
    } catch (e) {
      throw new Error('找不到schema文件');
    }
    const hash = md5(schemaContent);
    if (this.prevHash === hash) throw new Error('schema文件一致');
    this.prevHash = hash;
    this.status = {
      type: 'pending',
    };

    const stream = new SSEStream();

    let flag = true;
    let error = null;

    stream.on('close', () => {
      flag = false;
    });

    let promise: Promise<any>;
    if (process.env.SKIP_PRISMA_GENERATE && !content) {
      promise = Promise.resolve();
    } else {
      promise = execCommand('yarn prisma generate', (type, message) => {
        if (flag) {
          stream.write({ type, message });
          if (
            type === 'error' &&
            !/^Debugger attached/.test(message) &&
            !/^Waiting for the debugger to disconnect/.test(message)
          ) {
            error = message;
          }
        }
      });
    }

    promise
      .then(async () => {
        if (!error) {
          try {
            if (this.prisma) {
              await this.prisma.$disconnect();
              this.prisma = null;
            }
            if (this.server) {
              await this.server.stop();
              this.server = null;
            }

            // readme: 由于TS的target是commonjs，import会变为require,在重新加载前需要清除cache
            if (require) {
              this.clearRequireCache();
            }

            const { PrismaClient } = await import(
              // `../../prisma/generated/prisma-client-js?hash=${this.prevHash}`
              '../../prisma/generated/prisma-client-js'
            );
            const { resolvers, applyResolversEnhanceMap } = await import(
              // `../../prisma/generated/type-graphql?hash=${this.prevHash}`
              '../../prisma/generated/type-graphql'
            );
            applyResolversEnhanceMap(
              this.getModelNames(resolvers as any[]).reduce(
                (acc, name) => ({
                  ...acc,
                  [name]: {
                    _all: [Authorized()],
                  },
                }),
                {} as any
              )
            );
            this.prisma = new PrismaClient();
            const tokenService = this.tokenService;
            const schema = await buildSchema(
              Object.assign(
                {
                  resolvers,
                  dateScalarMode: 'timestamp',
                  validate: false,
                },
                {
                  authChecker({ context, info }) {
                    // here we can read the user from context
                    // and check his permission in the db against the `roles` argument
                    // that comes from the `@Authorized` decorator, eg. ["ADMIN", "MODERATOR"]
                    if (info.operation.operation === 'mutation') {
                      return tokenService.isValidAccessToken(context.token);
                    }
                    return true;
                  },
                }
              ) as any
            );
            this.server = new ApolloServer({
              schema,
              status400ForVariableCoercionErrors: true,
              introspection:
                !!process.env.NEED_GRAPHQL_PLAYGROUND ||
                process.env.NODE_ENV !== 'production',
              plugins: [
                // Install a landing page plugin based on NODE_ENV
                process.env.NEED_GRAPHQL_PLAYGROUND ||
                process.env.NODE_ENV !== 'production'
                  ? ApolloServerPluginLandingPageLocalDefault({})
                  : ApolloServerPluginLandingPageProductionDefault({
                      // graphRef: 'my-graph-id@my-graph-variant',
                      // footer: false,
                    }),
              ],
              // formatError: (formattedError, error) => {
              //   // unwrapResolverError removes the outer GraphQLError wrapping from
              //   // errors thrown in resolvers, enabling us to check the instance of
              //   // the original error
              //   // if (unwrapResolverError(error) instanceof CustomDBError) {
              //   // }
              //   return { message: 'Internal server error' };
              // },
            });
            await this.server.start();
            this.middleware = koaMiddleware(this.server, {
              context: async ({ ctx }) => {
                return {
                  prisma: this.prisma,
                  token: ctx.headers.Authorization || ctx.headers.authorization,
                };
              },
            });
            this.status = { type: 'fufilled' };
            if (flag) {
              stream.write({ message: '[DONE]' });
            }
          } catch (e) {
            this.status = { type: 'reject', message: e.toString() };
          }
        } else {
          this.status = { type: 'reject', message: error };
          if (flag) {
            stream.write({ type: 'error', message: error });
            stream.write({ message: '[DONE]' });
          }
        }
      })
      .catch(e => {
        this.status = { type: 'reject', message: e.toString() };
        if (flag) {
          stream.write({ type: 'error', message: error });
          stream.write({ message: '[DONE]' });
        }
      });

    return [stream, promise] as const;
  }

  getModelNames(resolvers: any[]) {
    const nameSet = new Set<string>();
    for (const resolver of resolvers) {
      const name = resolver.name
        .replace(/CrudResolver$/, '')
        .replace(/RelationsResolver$/, '');
      nameSet.add(name);
    }
    return Array.from(nameSet.values());
  }
}
