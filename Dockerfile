FROM node:16-alpine AS build

WORKDIR /app

COPY . .

RUN yarn install 

RUN yarn build \
	&& rm -rf node_modules \
	&& yarn install --production 

FROM node:16-alpine

WORKDIR /app

COPY --from=build /app/dist ./dist
COPY --from=build /app/bootstrap.js ./
COPY --from=build /app/yarn.lock ./
COPY --from=build /app/package.json ./
COPY --from=build /app/node_modules ./node_modules

RUN apk add --no-cache tzdata

ENV TZ="Asia/Shanghai"


# 如果端口更换，这边可以更新一下
EXPOSE 7001

CMD yarn start
