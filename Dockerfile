FROM node:20.11 as base
LABEL Author FullDive backend team

FROM base as build

ENV PROTOC_ZIP=protoc-3.13.0-linux-x86_64.zip
RUN apt-get update && apt-get install -y unzip && apt-get install -y curl && apt-get install -y openssl
RUN curl -OL https://github.com/protocolbuffers/protobuf/releases/download/v3.13.0/$PROTOC_ZIP \
    && unzip -o $PROTOC_ZIP -d /usr/local bin/protoc \
    && unzip -o $PROTOC_ZIP -d /usr/local 'include/*' \
    && rm -f $PROTOC_ZIP \

ENV NODE_DIR /home/node/app
WORKDIR $NODE_DIR

COPY package.json yarn.lock ./
RUN yarn install
COPY . .
RUN yarn generate:domain
RUN yarn build

EXPOSE 8080

USER node:node
CMD ["yarn", "start:prod"]
