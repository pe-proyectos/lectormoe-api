FROM oven/bun:1.0.29 as base
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
COPY ./env.ts ./env.ts
RUN bun install
# RUN bunx prisma generate
# RUN bunx prisma migrate deploy

FROM base AS release
COPY --from=install /usr/src/app/ .

USER root
EXPOSE 3000/tcp
ENTRYPOINT [ "bun", "run", "env.ts" ]