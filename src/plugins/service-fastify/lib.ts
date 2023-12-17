import {
  FastifyBaseLogger,
  FastifyInstance,
  FastifyReply,
  FastifyRequest,
  FastifySchema,
  FastifyTypeProviderDefault,
  RawServerDefault,
  RequestGenericInterface,
  RequestParamsDefault,
  RequestQuerystringDefault,
  RouteGenericInterface,
} from "fastify";
import { IncomingHttpHeaders, IncomingMessage } from "http";

export interface FastifyHeadersWithIP extends IncomingHttpHeaders {
  ip: string;
}

export interface IWebServerInitPlugin {
  arg1: any;
  arg2?: any;
}
export interface IWebServerListenerHelper {
  server: FastifyInstance;
  type: string;
}
export interface FastifyRequestInterface<
  Body = any,
  Params = RequestParamsDefault,
  Querystring = RequestQuerystringDefault,
  Headers = FastifyHeadersWithIP
> extends RequestGenericInterface {
  Body?: Body;
  Querystring?: Querystring;
  Params?: Params;
  Headers?: Headers;
}

export type ParamsFromPathItemStringUndefined<T extends string> =
  T extends `${infer Pre}?` ? Pre : T;

export type ParamsFromPathUntouched<T extends string> = T extends
  | `${infer Pre}:${infer Param}/${infer Post}`
  ? Param | ParamsFromPathUntouched<`${Pre}${Post}`>
  : never;

export type ParamsFromPath<T extends string> = {
  [Key in ParamsFromPathUntouched<T> as ParamsFromPathItemStringUndefined<Key>]: Key extends `${infer Name}?`
    ? string | undefined
    : string;
};

export type FastifyRequestPath<
  Path extends string,
  Body = any,
  Query = any,
  Headers = any,
  OverrideParams = never
> = FastifyRequest<{
  Params: Readonly<ParamsFromPath<Path> | OverrideParams>;
  Querystring: Readonly<Query>;
  Body: Readonly<Body>;
  headers: Readonly<Headers>;
}>;

export interface FastifyRequestHandler<Path extends string> {
  (
    reply: FastifyReply,
    params: Readonly<ParamsFromPath<Path>>,
    query: any,
    body: any,
    request: FastifyRequest<
      RouteGenericInterface,
      RawServerDefault,
      IncomingMessage,
      FastifySchema,
      FastifyTypeProviderDefault,
      any,
      FastifyBaseLogger
    >
  ): Promise<void>;
}
export interface FastifyNoBodyRequestHandler<Path extends string> {
  (
    reply: FastifyReply,
    params: Readonly<ParamsFromPath<Path>>,
    query: any,
    request: FastifyRequest<
      RouteGenericInterface,
      RawServerDefault,
      IncomingMessage,
      FastifySchema,
      FastifyTypeProviderDefault,
      any,
      FastifyBaseLogger
    >
  ): Promise<void>;
}
