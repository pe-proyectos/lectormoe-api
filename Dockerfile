FROM oven/bun:latest as base
WORKDIR /usr/src/app

FROM base AS install
ARG NODE_VERSION=20
RUN apt update \
    && apt install -y curl
RUN curl -L https://raw.githubusercontent.com/tj/n/master/bin/n -o n \
    && bash n $NODE_VERSION \
    && rm n \
    && npm install -g n

COPY ./package.json ./bun.lockb ./
COPY ./src ./src
COPY ./prisma ./prisma
RUN bun install --production
RUN bunx prisma generate

FROM base AS release
COPY --from=install /usr/src/app/ .

ENV NODE_ENV production
USER bun
EXPOSE 3000/tcp
ENTRYPOINT [ "bun", "src/index.ts" ]