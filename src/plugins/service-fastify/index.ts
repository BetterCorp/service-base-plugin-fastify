import {
  BSBError,
  BSBPluginConfig,
  BSBPluginEvents,
  BSBService,
  BSBServiceConstructor,
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
import fastifyCloudflareWarp from "./cloudflarewarp";
import {WebServerType, secSchema} from "./config";
import {Server as HServer} from "http";
import {Server as HSServer} from "https";
import {
  FastifyNoBodyRequestHandler,
  FastifyRequestHandler,
  IWebServerListenerHelper,
} from "./lib";
import {IDictionary} from "@bettercorp/tools/lib/Interfaces";
import {readFileSync, existsSync} from "fs";
import {hostname} from "os";
import {Tools} from "@bettercorp/tools/lib/Tools";

const pluginMetaSymbol = Symbol.for("plugin-meta");

interface FastifyMetadataPluginMetadata {
  fastify: string;
  name: string;
}

interface FastifyMetadataPlugin {
  [key: string]: any; // Other properties can be typed as needed.
  [pluginMetaSymbol]: FastifyMetadataPluginMetadata;
}

export class Config
    extends BSBPluginConfig<typeof secSchema> {
  migrate(toVersion: string, fromVersion: string | null, fromConfig: any) {
    return fromConfig;
  }

  validationSchema = secSchema;
}

export interface Events
    extends BSBPluginEvents {
  onEvents: ServiceEventsBase;
  emitEvents: ServiceEventsBase;
  onReturnableEvents: ServiceEventsBase;
  emitReturnableEvents: ServiceEventsBase;
  onBroadcast: ServiceEventsBase;
  emitBroadcast: ServiceEventsBase;
}

export class Plugin
    extends BSBService<Config, Events> {
  private HealthFastify!: FastifyInstance;
  private HTTPFastify!: FastifyInstance;
  private HTTPSFastify!: FastifyInstance;
  private HealthChecks: IDictionary<{
    (): Promise<boolean>;
  }> = {};
  private RegisteredPlugins: Array<string> = [];

  initBeforePlugins?: string[] | undefined;
  initAfterPlugins?: string[] | undefined;
  runBeforePlugins?: string[] | undefined;
  runAfterPlugins?: string[] | undefined;

  private getFinalPath(path: string): string {
    let finalPath: string = path;
    if (finalPath.endsWith("/") && finalPath !== "/") {
      finalPath = path.substring(0, finalPath.length - 1);
    }
    return finalPath;
  }

  private async getServerToListenTo(): Promise<IWebServerListenerHelper> {
    let serverToListenOn: IWebServerListenerHelper = {
      server: this.HTTPSFastify,
      type: "HTTPS",
      port: this.config.httpsPort,
    };
    if (this.config.type === WebServerType.http) {
      serverToListenOn = {
        server: this.HTTPFastify,
        type: "HTTP",
        port: this.config.httpPort,
      };
    }
    return serverToListenOn;
  }

  methods = {
    addHealthCheck: async (
        pluginName: string,
        checkName: string,
        handler: () => Promise<boolean>,
    ): Promise<void> => {
      if (Object.keys(this.HealthChecks).length >= 10) {
        throw "Cannot add more than 10 health checks";
      }
      const key = `${pluginName}-${checkName}`;
      if (this.HealthChecks[key] != undefined) {
        throw "Cannot set health check where one alread exists";
      }
      this.HealthChecks[key] = handler;
    },
    // DYNAMIC HANDLING
    getServerInstance: async (): Promise<
        FastifyInstance<HServer | HSServer>
    > => {
      return (
          await this.getServerToListenTo()
      ).server;
    },
    register: async (
        plugin:
            | FastifyPluginCallback<FastifyPluginOptions>
            | FastifyPluginAsync<FastifyPluginOptions>
            | Promise<{ default: FastifyPluginCallback<FastifyPluginOptions> }>
            | Promise<{ default: FastifyPluginAsync<FastifyPluginOptions> }>,
        opts?: FastifyRegisterOptions<FastifyPluginOptions>,
    ): Promise<void> => {
      const server = await this.getServerToListenTo();
      const pluginMeta =
                (
                    plugin as unknown as FastifyMetadataPlugin
                )[pluginMetaSymbol] ?? {};
      const pluginName = pluginMeta.name ?? "unknown/internal/custom";
      this.log.debug(`[{type}] initForPlugins [REGISTER] {pluginName}`, {
        type: server.type,
        pluginName,
      });
      if (this.RegisteredPlugins.includes(pluginName)) {
        this.log.warn(
            `[{type}] initForPlugins [REGISTER] {pluginName} ALREADY REGISTERED`,
            {type: server.type, pluginName},
        );
        return;
      }
      if (pluginMeta.name !== undefined && pluginMeta.name !== null) {
        this.RegisteredPlugins.push(pluginName);
      }

      server.server.register(plugin, opts);
      this.log.debug(`[{type}] initForPlugins [REGISTER] {pluginName} OKAY`, {
        type: server.type,
        pluginName,
      });
    },
    head: async <Path extends string>(
        path: Path,
        handler: FastifyNoBodyRequestHandler<Path>,
    ): Promise<void> => {
      const server = await this.getServerToListenTo();
      this.log.debug(`[{type}] initForPlugins [HEAD] {path}`, {
        type: server.type,
        path: this.getFinalPath(path),
      });
      server.server.head(
          this.getFinalPath(path),
          async (req, reply) =>
              await handler(reply, req.params as any, req.query, req),
      );
      this.log.debug(`[{type}] initForPlugins [HEAD] OKAY`, {
        type: server.type,
      });
    },

    get: async <Path extends string>(
        path: Path,
        handler: FastifyNoBodyRequestHandler<Path>,
    ): Promise<void> => {
      const server = await this.getServerToListenTo();
      this.log.debug(`[{type}] initForPlugins [GET] {path}`, {
        type: server.type,
        path: this.getFinalPath(path),
      });
      server.server.get(
          this.getFinalPath(path),
          async (req, reply) =>
              await handler(reply, req.params as any, req.query, req),
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
        handler: Handler,
    ): Promise<void> => {
      const server = await this.getServerToListenTo();
      this.log.debug(`[{type}] initForPlugins [GET CUSTOM] {path}`, {
        type: server.type,
        path: this.getFinalPath(path),
      });
      server.server.get(
          this.getFinalPath(path),
          opts,
          async (a, b) => await handler(a, b),
      );
      this.log.debug(`[{type}] initForPlugins [GET] OKAY`, {
        type: server.type,
      });
    },
    post: async <Path extends string>(
        path: Path,
        handler: FastifyRequestHandler<Path>,
    ): Promise<void> => {
      const server = await this.getServerToListenTo();
      this.log.debug(`[{type}] initForPlugins [POST] {path}`, {
        type: server.type,
        path: this.getFinalPath(path),
      });
      server.server.post(
          this.getFinalPath(path),
          async (req, reply) =>
              await handler(reply, req.params as any, req.query, req.body, req),
      );
      this.log.debug(`[{type}] initForPlugins [POST] OKAY`, {
        type: server.type,
      });
    },
    put: async <Path extends string>(
        path: Path,
        handler: FastifyRequestHandler<Path>,
    ): Promise<void> => {
      const server = await this.getServerToListenTo();
      this.log.debug(`[{type}] initForPlugins [PUT] {path}`, {
        type: server.type,
        path: this.getFinalPath(path),
      });
      server.server.put(
          this.getFinalPath(path),
          async (req, reply) =>
              await handler(reply, req.params as any, req.query, req.body, req),
      );
      this.log.debug(`[{type}] initForPlugins [PUT] OKAY`, {
        type: server.type,
      });
    },
    delete: async <Path extends string>(
        path: Path,
        handler: FastifyRequestHandler<Path>,
    ): Promise<void> => {
      const server = await this.getServerToListenTo();
      this.log.debug(`[{type}] initForPlugins [DELETE] {path}`, {
        type: server.type,
        path: this.getFinalPath(path),
      });
      server.server.delete(
          this.getFinalPath(path),
          async (req, reply) =>
              await handler(reply, req.params as any, req.query, req.body, req),
      );
      this.log.debug(`[{type}] initForPlugins [DELETE] OKAY`, {
        type: server.type,
      });
    },
    patch: async <Path extends string>(
        path: Path,
        handler: FastifyRequestHandler<Path>,
    ): Promise<void> => {
      const server = await this.getServerToListenTo();
      this.log.debug(`[{type}] initForPlugins [PATCH] {path}`, {
        type: server.type,
        path: this.getFinalPath(path),
      });
      server.server.patch(
          this.getFinalPath(path),
          async (req, reply) =>
              await handler(reply, req.params as any, req.query, req.body, req),
      );
      this.log.debug(`[{type}] initForPlugins [PATCH] OKAY`, {
        type: server.type,
      });
    },
    options: async <Path extends string>(
        path: Path,
        handler: FastifyNoBodyRequestHandler<Path>,
    ): Promise<void> => {
      const server = await this.getServerToListenTo();
      this.log.debug(`[{type}] initForPlugins [OPTIONS] {path}`, {
        type: server.type,
        path: this.getFinalPath(path),
      });
      server.server.options(
          this.getFinalPath(path),
          async (req, reply) =>
              await handler(reply, req.params as any, req.query, req),
      );
      this.log.debug(`[{type}] initForPlugins [OPTIONS] OKAY`, {
        type: server.type,
      });
    },
    all: async <Path extends string>(
        path: Path,
        handler: FastifyRequestHandler<Path>,
    ): Promise<void> => {
      const server = await this.getServerToListenTo();
      this.log.debug(`[{type}] initForPlugins [ALL] {path}`, {
        type: server.type,
        path: this.getFinalPath(path),
      });
      server.server.all(
          this.getFinalPath(path),
          async (req, reply) =>
              await handler(reply, req.params as any, req.query, req.body, req),
      );
      this.log.debug(`[{type}] initForPlugins [ALL] OKAY`, {
        type: server.type,
      });
    },
  };

  dispose(): void {
    if (!Tools.isNullOrUndefined(this.HTTPFastify)) {
      this.HTTPFastify.close();
    }
    if (!Tools.isNullOrUndefined(this.HTTPSFastify)) {
      this.HTTPSFastify.close();
    }
    if (!Tools.isNullOrUndefined(this.HealthFastify)) {
      this.HealthFastify.close();
    }
  }

  public async run(): Promise<void> {
    this.log.debug(`loaded`);
    if (
        this.config.type === WebServerType.http // || this.config.type === WebServerType.dual
    ) {
      this.HTTPFastify.listen(
          {
            exclusive: this.config.exclusive,
            readableAll: this.config.readableAll,
            writableAll: this.config.writableAll,
            ipv6Only: this.config.ipv6Only,
            host: this.config.host,
            port: this.config.httpPort,
          },
          async (err, address) =>
              err
              ? this.log.error("[HTTP] Error listening error: {err}", {
                err,
              })
              : this.log.info(`[HTTP] Listening {address} for WW!`, {
                address,
              }),
      );
      this.log.info(`[HTTP] Server started {host}:{httpPort}`, {
        host: this.config.host,
        httpPort: this.config.httpPort,
      });
    }
    if (
        this.config.type === WebServerType.https// || this.config.type === WebServerType.dual
    ) {
      this.HTTPSFastify.listen(
          {
            exclusive: this.config.exclusive,
            readableAll: this.config.readableAll,
            writableAll: this.config.writableAll,
            ipv6Only: this.config.ipv6Only,
            host: this.config.host,
            port: this.config.httpsPort,
          },
          async (err, address) =>
              err
              ? this.log.error("[HTTPS] Error listening error: {err}", {
                err,
              })
              : this.log.info(`[HTTPS] Listening {address}!`, {
                address,
              }),
      );
      this.log.info(`[HTTPS] Server started {host}:{httpsPort}`, {
        host: this.config.host,
        httpsPort: this.config.httpsPort,
      });
    }
    /*if (
        this.config.type === WebServerType.dual &&
        this.config.httpToHttpsRedirect
    ) {
      this.HTTPFastify.get("/*", async (req, reply) => {
        reply.redirect(
            301,
            `https://${req.hostname}:${this.config.httpsPort}${req.url}`,
        );
      });
      this.log.info(`[HTTP] Server redirect: {host}:{httpPort}`, {
        host: this.config.host,
        httpPort: this.config.httpPort,
      });
    }*/
  }

  constructor(config: BSBServiceConstructor) {
    super(config);
    if (this.config.health && this.config.healthServerPort) {
      this.HealthFastify = fastify({
        http2: this.config.http2,
        logger: false,
      } as any) as any; 
      if (this.config.behindTraefikWithCloudflareWarp) {
        this.log.info("Cloudflarewarp parser enabled");
        this.HealthFastify.register(fastifyCloudflareWarp, {
          log: this.log,
          mode: this.mode,
        });
      }
      this.HealthFastify.register(fastifyBsbLogger, {
        server: "HEALTH",
        log: this.log,
        metrics: this.metrics,
        mode: this.mode,
      });
      this.log.info(`[HEALTH] Server ready: {host}:{httpPort}`, {
        host: this.config.host,
        httpPort: this.config.healthServerPort,
      });
      this.HealthFastify.setErrorHandler(async (error, request, reply) => {
        this.log.error(
            "[HEALTH] Error handled [{statusCode}] {message}",
            {
              statusCode: error.statusCode ?? "-",
              message: error.message,
            },
        );
        reply.status(500)
             .send("SERVER ERROR");
      });
    }
    if (this.config.type === WebServerType.http) {
      this.HTTPFastify = fastify({
        http2: this.config.http2,
        logger: false,
      } as any) as any;// we do not want the default fastify logger since we have our own.
      if (this.config.behindTraefikWithCloudflareWarp) {
        this.log.info("Cloudflarewarp parser enabled");
        this.HTTPFastify.register(fastifyCloudflareWarp, {
          log: this.log,
          mode: this.mode,          
        });
      }
      this.HTTPFastify.register(fastifyBsbLogger, {
        server: "HTTP",
        log: this.log,
        metrics: this.metrics,
        mode: this.mode,
      });
      this.log.info(`[HTTP] Server ready: {host}:{httpPort}`, {
        host: this.config.host,
        httpPort: this.config.httpPort,
      });
      this.HTTPFastify.setErrorHandler(async (error, request, reply) => {
        this.log.error("[HTTP] Error handled [{statusCode}] {message}", {
          statusCode: error.statusCode ?? "-",
          message: error.message,
        });
        reply.status(500)
             .send("SERVER ERROR");
      });
    }
    if (this.config.type === WebServerType.https) {
      if (!this.config.httpsCert
          || !existsSync(this.config.httpsCert)) {
        throw new BSBError("HTTPS Cert config is invalid - cert:{cert}", {cert: this.config.httpsCert ?? "null"});
      }
      if (!this.config.httpsKey
          || !existsSync(this.config.httpsKey)) {
        throw new BSBError("HTTPS Cert config is invalid - key:{cert}", {cert: this.config.httpsKey ?? "null"});
      }
      this.HTTPSFastify = fastify({
        http2: this.config.http2,
        https: {
          allowHTTP1: this.config.allowHTTP1,
          cert: readFileSync(this.config.httpsCert),
          key: readFileSync(this.config.httpsKey),
        },
        logger: false,
      } as any) as any;// we do not want the default fastify logger since we have our own.
      if (this.config.behindTraefikWithCloudflareWarp) {
        this.log.info("Cloudflarewarp parser enabled");
        this.HTTPSFastify.register(fastifyCloudflareWarp, {
          log: this.log,
          mode: this.mode,
        });
      }
      this.HTTPSFastify.register(fastifyBsbLogger, {
        server: "HTTPS",
        log: this.log,
        metrics: this.metrics,
        mode: this.mode,
      });
      this.log.info(`[HTTPS] Server ready: {host}:{httpsPort}`, {
        host: this.config.host,
        httpsPort: this.config.httpsPort,
      });
      this.HTTPSFastify.setErrorHandler(async (error, request, reply) => {
        this.log.error(
            "[HTTPS] Error handled [{statusCode}] {message}",
            {
              statusCode: error.statusCode ?? "-",
              message: error.message,
            },
        );
        reply.status(500)
             .send("SERVER ERROR");
      });
    }
  }

  public async init(): Promise<void> {
    if (this.config.health) {
      const handler = async (req:FastifyRequest, reply: FastifyReply) => {
        const checkResults: IDictionary<boolean> = {};
        for (const key of Object.keys(this.HealthChecks)) {
          checkResults[key] = await Promise.race<boolean>([
            new Promise((resolve) =>
                this.HealthChecks[key]()
                    .then((x) => resolve(x))
                    .catch(() => resolve(false)),
            ),
            new Promise((resolve) => setTimeout(() => resolve(false), 500)),
          ]);
        }
        reply.header("Content-Type", "application/json");
        reply.code(202)
             .send({
               requestId: req.id,
               checks: checkResults,
               requestHostname: req.hostname,
               time: new Date().getTime(),
               alive: true,
               clusterId: hostname(),
             });
      }
      if (this.config.healthServerPort) {
        this.HealthFastify.get("/health", handler);
        this.log.info('Health server ready on HEALTH:{port}', {port: this.config.healthServerPort});
      } else {
        const healthServer = (await this.getServerToListenTo());
        healthServer.server.get("/health", handler);
        this.log.info('Health server ready on {server}:{port}', {server: healthServer.type, port: healthServer.port});
      }
    }
  }
}
