# prisma-graphql

## 目的
- [x] 使用schema.md就可以直接获得graphql服务器。
- [x] 服务器可以提供路径来更新shcema
- [x] 服务器应该提供对应的一定的鉴权机制


## Quick Start
首先准备好你的schema.prisma文件。
```bash
mkdir prisma
cd prisma
touch schema.prisma
```
以下是一个prisma文件的示例
```prisma
datasource db {
  provider = "mysql"
  url      = env("DATABASE_URL")
}

generator client {
  provider      = "prisma-client-js"
  binaryTargets = ["native"]
  output        = "./generated/prisma-client-js"
}

generator typegraphql {
  provider           = "typegraphql-prisma"
  output             = "./generated/type-graphql"
  emitTranspiledCode = true
}

model User{
  id Int @id @default(autoincrement())

	name String 
}

```
然后启动一个服务器很简单，仅需通过一个命令行即可：
```bash
docker run \
-d \
-e GENERATE_ON_START=OFF \
-e DATABASE_URL="your database uri" \
-e NEED_GRAPHQL_PLAYGROUND=ON \
-p 7001:7001 \
zhujianshi/simple-prisma-graphql
```
或者通过docker-compose，以下是docker-compose示例：
```Compose
version: '3'

services:
  backend:
    ports:
      - '7001:7001'
    environment:
      DATABASE_URL: your-database-uri 
			NEED_GRAPHQL_PLAYGROUND: ON
    volumes:
      - ./prisma:/app/prisma
```
然后在浏览器打开[graphql](http://localhost:7001/graphql)对应的网页端。

## Authorization
服务器内置了一个简单实现的鉴权逻辑：它周期性的在./token文件夹下产生两个文件：
```
token
├── accessToken.txt
└── refreshToken.txt
```
其中分别存放着对应的token。在默认情况下，服务器对所有的query放行，并对所有的mutation请求，要求其在请求头的Authorization字段设置对应时间的accessToken。


## Environment Variables
你可以通过设置特定环境变量的方式来调整服务器的默认行为。以下是环境变量一览：

| 变量名 | 默认值 | 可选值(类型) | Required |
|:--:|:--:|:--:|:--:|
|DATABASE_URL| - | DatabaseURI | ✅ |
|GENERATE_ON_START| - | 'ON' | ❌ |
|NEED_GRAPHQL_PLAYGROUND| - | 'ON' | ❌ |
|ACCESS_TOKEN_CRON| 0/30 * * * * * | CRON表达式 | ❌ |
|REFRESH_TOKEN_CRON| 0 0 0 * * * | CRON表达式 | ❌ |

具体解释如下：

- DATABASE_URL:prisma要求的数据库schema。
- GENERATE_ON_START: 是否在项目启动时，生成对应的graphgl路由。注意：这需要你在对应位置-./prisma/prisma.schema提供对应的schema文件定义。
- NEED_GRAPHQL_PLAYGROUND: 是否开启graphql工作台页面。开启它会使得你开发对应程序变得方便，但由于网络安全方向的考虑，推荐在生产环境关闭它。
- ACCESS_TOKEN_CRON: Access Token的生产周期，默认为30min。推荐设置间隔不小于5min。
- REFRESH_TOKEN_CRON: Refresh Token的生产周期，默认为1天。

## Restful Api
处于开发的边界设置，服务器提供了部分restful api用于远程控制。

### generate
> 需要accessToken: ✅
>
> Method: Post

通过此api，你可以在不重启服务器的同时更新对应的schema定义。对应的请求参数为: 

| key | 默认值 | 可选值(类型) | Required |
|:--:|:--:|:--:|:--:|
| schemaContent | - | String | ❌ |
| stream | false | Boolean | ❌ |

参数详解：

- schemaContent: prisma.schema文件的具体内容
- stream：是否使用事件流的形式返回

返回结果：

在stream为false时：

```ts
{
	code: number; // prisma generate 子命令的返回code
	out: string; // prisma generate 子命令的输出
}
```

在stream为true时：
返回事件流
```ts
{
	event: 'error';
	data: {
		message: string;
	}
} | {
	event: 'data',
	data: {
		message: string;
	}
}
```

### accessToken
> 需要accessToken: ❌
>
> Method: Post

通过此api，你可以基于变化不怎么频繁的refreshToken来获取变化较为平凡的accessToken。

| key | 默认值 | 可选值(类型) | Required |
|:--:|:--:|:--:|:--:|
| refreshToken | - | String | ✅ |
| stream | false | Boolean | ❌ |

参数详解：

- refreshToken: 对应时间的refreshToken 
- stream：是否使用事件流的形式返回

返回结果：

在stream为false时：

```ts
{
	expiredAt: number; // 过期时间的时间戳 
	accessToken: string; // prisma generate 子命令的输出
}
```

在stream为true时：
返回事件流
```ts
{
	event: 'data',
	data: {
		message: string; // 本次的accessToken
	}
}
```





