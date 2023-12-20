import {
  BSBService,
  BSBServiceConstructor,
  BSBServiceTypes,
  ServiceEventsBase,
} from "@bettercorp/service-base";
import fastify, {
  FastifyInstance,
  FastifyPluginCallback,
  FastifyPluginOptions,
  FastifyPluginAsync,
  FastifyRegisterOptions,
  RouteShorthandOptions,
  FastifyRequest,
  FastifyReply,
} from "fastify";
import fastifyBsbLogger from "./logger";
import { Config, WebServerType } from "./sec-config";
import { Server as HServer } from "http";
import { Server as HSServer } from "https";
import {
  FastifyNoBodyRequestHandler,
  FastifyRequestHandler,
  IWebServerListenerHelper,
} from "./lib";
import { IDictionary } from "@bettercorp/tools/lib/Interfaces";
import { readFileSync } from "fs";
import { hostname } from "os";
import { Tools } from "@bettercorp/tools/lib/Tools";

export interface ServiceTypes extends BSBServiceTypes {
  onEvents: ServiceEventsBase;
  emitEvents: ServiceEventsBase;
  onReturnableEvents: ServiceEventsBase;
  emitReturnableEvents: ServiceEventsBase;
  onBroadcast: ServiceEventsBase;
  emitBroadcast: ServiceEventsBase;
  methods: {
    getServerInstance(): Promise<FastifyInstance<HServer | HSServer>>;
    addHealthCheck(
      pluginName: string,
      checkName: string,
      handler: { (): Promise<boolean> }
    ): Promise<void>;
    register(
      plugin:
        | FastifyPluginCallback<FastifyPluginOptions>
        | FastifyPluginAsync<FastifyPluginOptions>
        | Promise<{ default: FastifyPluginCallback<FastifyPluginOptions> }>
        | Promise<{ default: FastifyPluginAsync<FastifyPluginOptions> }>,
      opts?: FastifyRegisterOptions<FastifyPluginOptions>
    ): Promise<void>;
    head<Path extends string>(
      path: Path,
      handler: FastifyNoBodyRequestHandler<Path>
    ): Promise<void>;
    get<Path extends string>(
      path: Path,
      handler: FastifyNoBodyRequestHandler<Path>
    ): Promise<void>;
    getCustom<
      Path extends string,
      Opts extends RouteShorthandOptions = any,
      Handler extends Function = {
        (request: FastifyRequest, reply: FastifyReply): Promise<void>;
      }
    >(
      path: Path,
      opts: Opts,
      handler: Handler
    ): Promise<void>;
    post<Path extends string>(
      path: Path,
      handler: FastifyRequestHandler<Path>
    ): Promise<void>;
    put<Path extends string>(
      path: Path,
      handler: FastifyRequestHandler<Path>
    ): Promise<void>;
    delete<Path extends string>(
      path: Path,
      handler: FastifyRequestHandler<Path>
    ): Promise<void>;
    patch<Path extends string>(
      path: Path,
      handler: FastifyRequestHandler<Path>
    ): Promise<void>;
    options<Path extends string>(
      path: Path,
      handler: FastifyNoBodyRequestHandler<Path>
    ): Promise<void>;
    all<Path extends string>(
      path: Path,
      handler: FastifyRequestHandler<Path>
    ): Promise<void>;
  };
}

export class Plugin extends BSBService<Config, ServiceTypes> {
  private HTTPFastify!: FastifyInstance<HServer>;
  private HTTPSFastify!: FastifyInstance<HSServer>;
  private HealthChecks: IDictionary<{
    (): Promise<boolean>;
  }> = {};

  initBeforePlugins?: string[] | undefined;
  initAfterPlugins?: string[] | undefined;
  runBeforePlugins?: string[] | undefined;
  runAfterPlugins?: string[] | undefined;
  private getFinalPath(path: string): string {
    let finalPath: string = path;
    if (finalPath.endsWith("/") && finalPath !== "/")
      finalPath = path.substring(0, finalPath.length - 1);
    return finalPath;
  }
  private async getServerToListenTo(): Promise<IWebServerListenerHelper> {
    let serverToListenOn: IWebServerListenerHelper = {
      server: this.HTTPSFastify,
      type: "HTTPS",
    };
    if (this.config.type === WebServerType.http) {
      serverToListenOn = {
        server: this.HTTPFastify,
        type: "HTTP",
      };
    }
    return serverToListenOn;
  }
  methods = {
    addHealthCheck: async (
      pluginName: string,
      checkName: string,
      handler: () => Promise<boolean>
    ): Promise<void> => {
      if (Object.keys(this.HealthChecks).length >= 10)
        throw "Cannot add more than 10 health checks";
      const key = `${pluginName}-${checkName}`;
      if (this.HealthChecks[key] != undefined)
        throw "Cannot set health check where one alread exists";
      this.HealthChecks[key] = handler;
    },
    // DYNAMIC HANDLING
    getServerInstance: async (): Promise<
      FastifyInstance<HServer | HSServer>
    > => {
      return (await this.getServerToListenTo()).server;
    },
    register: async (
      plugin:
        | FastifyPluginCallback<FastifyPluginOptions>
        | FastifyPluginAsync<FastifyPluginOptions>
        | Promise<{ default: FastifyPluginCallback<FastifyPluginOptions> }>
        | Promise<{ default: FastifyPluginAsync<FastifyPluginOptions> }>,
      opts?: FastifyRegisterOptions<FastifyPluginOptions>
    ): Promise<void> => {
      const server = await this.getServerToListenTo();
      this.log.debug(`[{type}] initForPlugins [USE]`, { type: server.type });
      server.server.register(plugin, opts);
      this.log.debug(`[{type}] initForPlugins [USE] OKAY`, {
        type: server.type,
      });
    },
    head: async <Path extends string>(
      path: Path,
      handler: FastifyNoBodyRequestHandler<Path>
    ): Promise<void> => {
      const server = await this.getServerToListenTo();
      this.log.debug(`[{type}] initForPlugins [HEAD] {path}`, {
        type: server.type,
        path: this.getFinalPath(path),
      });
      server.server.head(
        this.getFinalPath(path),
        async (req, reply) =>
          await handler(reply, req.params as any, req.query, req)
      );
      this.log.debug(`[{type}] initForPlugins [HEAD] OKAY`, {
        type: server.type,
      });
    },

    get: async <Path extends string>(
      path: Path,
      handler: FastifyNoBodyRequestHandler<Path>
    ): Promise<void> => {
      const server = await this.getServerToListenTo();
      this.log.debug(`[{type}] initForPlugins [GET] {path}`, {
        type: server.type,
        path: this.getFinalPath(path),
      });
      server.server.get(
        this.getFinalPath(path),
        async (req, reply) =>
          await handler(reply, req.params as any, req.query, req)
      );
      this.log.debug(`[{type}] initForPlugins [GET] OKAY`, {
        type: server.type,
      });
    },
    getCustom: async <
      Path extends string,
      Opts extends RouteShorthandOptions = any,
      Handler extends Function = {
        (request: FastifyRequest, reply: FastifyReply): Promise<void>;
      }
    >(
      path: Path,
      opts: Opts,
      handler: Handler
    ): Promise<void> => {
      const server = await this.getServerToListenTo();
      this.log.debug(`[{type}] initForPlugins [GET CUSTOM] {path}`, {
        type: server.type,
        path: this.getFinalPath(path),
      });
      server.server.get(
        this.getFinalPath(path),
        opts,
        async (a, b) => await handler(a, b)
      );
      this.log.debug(`[{type}] initForPlugins [GET] OKAY`, {
        type: server.type,
      });
    },
    post: async <Path extends string>(
      path: Path,
      handler: FastifyRequestHandler<Path>
    ): Promise<void> => {
      const server = await this.getServerToListenTo();
      this.log.debug(`[{type}] initForPlugins [POST] {path}`, {
        type: server.type,
        path: this.getFinalPath(path),
      });
      server.server.post(
        this.getFinalPath(path),
        async (req, reply) =>
          await handler(reply, req.params as any, req.query, req.body, req)
      );
      this.log.debug(`[{type}] initForPlugins [POST] OKAY`, {
        type: server.type,
      });
    },
    put: async <Path extends string>(
      path: Path,
      handler: FastifyRequestHandler<Path>
    ): Promise<void> => {
      const server = await this.getServerToListenTo();
      this.log.debug(`[{type}] initForPlugins [PUT] {path}`, {
        type: server.type,
        path: this.getFinalPath(path),
      });
      server.server.put(
        this.getFinalPath(path),
        async (req, reply) =>
          await handler(reply, req.params as any, req.query, req.body, req)
      );
      this.log.debug(`[{type}] initForPlugins [PUT] OKAY`, {
        type: server.type,
      });
    },
    delete: async <Path extends string>(
      path: Path,
      handler: FastifyRequestHandler<Path>
    ): Promise<void> => {
      const server = await this.getServerToListenTo();
      this.log.debug(`[{type}] initForPlugins [DELETE] {path}`, {
        type: server.type,
        path: this.getFinalPath(path),
      });
      server.server.delete(
        this.getFinalPath(path),
        async (req, reply) =>
          await handler(reply, req.params as any, req.query, req.body, req)
      );
      this.log.debug(`[{type}] initForPlugins [DELETE] OKAY`, {
        type: server.type,
      });
    },
    patch: async <Path extends string>(
      path: Path,
      handler: FastifyRequestHandler<Path>
    ): Promise<void> => {
      const server = await this.getServerToListenTo();
      this.log.debug(`[{type}] initForPlugins [PATCH] {path}`, {
        type: server.type,
        path: this.getFinalPath(path),
      });
      server.server.patch(
        this.getFinalPath(path),
        async (req, reply) =>
          await handler(reply, req.params as any, req.query, req.body, req)
      );
      this.log.debug(`[{type}] initForPlugins [PATCH] OKAY`, {
        type: server.type,
      });
    },
    options: async <Path extends string>(
      path: Path,
      handler: FastifyNoBodyRequestHandler<Path>
    ): Promise<void> => {
      const server = await this.getServerToListenTo();
      this.log.debug(`[{type}] initForPlugins [OPTIONS] {path}`, {
        type: server.type,
        path: this.getFinalPath(path),
      });
      server.server.options(
        this.getFinalPath(path),
        async (req, reply) =>
          await handler(reply, req.params as any, req.query, req)
      );
      this.log.debug(`[{type}] initForPlugins [OPTIONS] OKAY`, {
        type: server.type,
      });
    },
    all: async <Path extends string>(
      path: Path,
      handler: FastifyRequestHandler<Path>
    ): Promise<void> => {
      const server = await this.getServerToListenTo();
      this.log.debug(`[{type}] initForPlugins [ALL] {path}`, {
        type: server.type,
        path: this.getFinalPath(path),
      });
      server.server.all(
        this.getFinalPath(path),
        async (req, reply) =>
          await handler(reply, req.params as any, req.query, req.body, req)
      );
      this.log.debug(`[{type}] initForPlugins [ALL] OKAY`, {
        type: server.type,
      });
    },
  };
  dispose(): void {
    if (!Tools.isNullOrUndefined(this.HTTPFastify)) this.HTTPFastify.close();
    if (!Tools.isNullOrUndefined(this.HTTPSFastify)) this.HTTPSFastify.close();
  }
  public async run(): Promise<void> {
    this.log.debug(`loaded`);
    if (
      this.config.type === WebServerType.http ||
      this.config.type === WebServerType.dual
    ) {
      this.HTTPFastify.listen(
        {
          host: this.config.host,
          port: this.config.httpPort,
        },
        async (err, address) =>
          err
            ? this.log.error("[HTTP] Error listening error: {err}", { err })
            : this.log.info(`[HTTP] Listening {address} for WW!`, {
                address,
              })
      );
      this.log.info(`[HTTP] Server started {host}:{httpPort}`, {
        host: this.config.host,
        httpPort: this.config.httpPort,
      });
    }
    if (
      this.config.type === WebServerType.https ||
      this.config.type === WebServerType.dual
    ) {
      this.HTTPSFastify.listen(
        {
          host: this.config.host,
          port: this.config.httpsPort,
        },
        async (err, address) =>
          err
            ? this.log.error("[HTTPS] Error listening error: {err}", { err })
            : this.log.info(`[HTTPS] Listening {address}!`, {
                address,
              })
      );
      this.log.info(`[HTTPS] Server started {host}:{httpsPort}`, {
        host: this.config.host,
        httpsPort: this.config.httpsPort,
      });
    }
    if (
      this.config.type === WebServerType.dual &&
      this.config.httpToHttpsRedirect
    ) {
      this.HTTPFastify.get("/*", async (req, reply) => {
        reply.redirect(
          301,
          `https://${req.hostname}:${this.config.httpsPort}${req.url}`
        );
      });
      this.log.info(`[HTTP] Server redirect: {host}:{httpPort}`, {
        host: this.config.host,
        httpPort: this.config.httpPort,
      });
    }
  }
  constructor(config: BSBServiceConstructor) {
    super(config);
    if (this.config.type === WebServerType.http) {
      this.HTTPFastify = fastify({});
      this.HTTPFastify.register(fastifyBsbLogger, this.log);
      this.log.info(`[HTTP] Server ready: {host}:{httpPort}`, {
        host: this.config.host,
        httpPort: this.config.httpPort,
      });
      this.HTTPFastify.setErrorHandler(async (error, request, reply) => {
        this.log.error("[HTTP] Error handled [{statusCode}] {message}", {
          statusCode: error.statusCode ?? "-",
          message: error.message,
        });
        reply.status(500).send("SERVER ERROR");
      });
    }
    if (this.config.type === WebServerType.https) {
      this.HTTPSFastify = fastify({
        https: {
          cert: readFileSync(this.config.httpsCert!),
          key: readFileSync(this.config.httpsKey!),
        },
      });
      this.HTTPSFastify.register(fastifyBsbLogger, this.log);
      this.log.info(`[HTTPS] Server ready: {host}:{httpsPort}`, {
        host: this.config.host,
        httpsPort: this.config.httpsPort,
      });
      this.HTTPSFastify.setErrorHandler(async (error, request, reply) => {
        this.log.error("[HTTPS] Error handled [{statusCode}] {message}", {
          statusCode: error.statusCode ?? "-",
          message: error.message,
        });
        reply.status(500).send("SERVER ERROR");
      });
    }
  }

  public async init(): Promise<void> {
    if (this.config.health) {
      this.methods.get("/health", async (reply, params, query, req) => {
        const checkResults: IDictionary<boolean> = {};
        for (const key of Object.keys(this.HealthChecks)) {
          checkResults[key] = await Promise.race<boolean>([
            new Promise((resolve) =>
              this.HealthChecks[key]()
                .then((x) => resolve(x))
                .catch(() => resolve(false))
            ),
            new Promise((resolve) => setTimeout(() => resolve(false), 500)),
          ]);
        }
        reply.header("Content-Type", "application/json");
        reply.code(200).send({
          requestId: req.id,
          checks: checkResults,
          /*requestIp: {
            ip: req.ip,
            ips: req.ips
          },*/
          requestHostname: req.hostname,
          time: new Date().getTime(),
          alive: true,
          clusterId: hostname(),
        });
      });
    }
  }
}
