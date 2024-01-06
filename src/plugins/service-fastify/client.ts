import { BSBService, BSBServiceClient } from "@bettercorp/service-base";
import {
  FastifyPluginCallback,
  FastifyPluginOptions,
  RawServerDefault,
  FastifyTypeProviderDefault,
  FastifyPluginAsync,
  FastifyRegisterOptions,
  FastifyInstance,
  RouteShorthandOptions,
  FastifyRequest,
  FastifyReply,
} from "fastify";
import {
  FastifyNoBodyRequestHandler,
  FastifyRequestHandler,
} from "../../plugins/service-fastify/lib";
import { Plugin } from "./plugin";
import { Server as HServer } from "http";
import { Server as HSServer } from "https";

export class Fastify extends BSBServiceClient<Plugin> {
  public readonly pluginName = "service-fastify";
  public readonly initBeforePlugins?: string[] | undefined;
  public readonly initAfterPlugins: string[] = ["service-fastify"];
  public readonly runBeforePlugins: string[] = ["service-fastify"];
  public readonly runAfterPlugins?: string[] | undefined;
  dispose?(): void;
  init?(): Promise<void>;
  run?(): Promise<void>;
  public constructor(context: BSBService<any, any>) {
    super(context);
  }

  async addHealthCheck(
    service: BSBService<any>,
    checkName: string,
    handler: () => Promise<boolean>
  ): Promise<void> {
    await this.callMethod(
      "addHealthCheck",
      service.pluginName,
      checkName,
      handler
    );
  }
  public async register(
    plugin:
      | FastifyPluginCallback<
          FastifyPluginOptions,
          RawServerDefault,
          FastifyTypeProviderDefault
        >
      | FastifyPluginAsync<
          FastifyPluginOptions,
          RawServerDefault,
          FastifyTypeProviderDefault
        >
      | Promise<{
          default: FastifyPluginCallback<
            FastifyPluginOptions,
            RawServerDefault,
            FastifyTypeProviderDefault
          >;
        }>
      | Promise<{
          default: FastifyPluginAsync<
            FastifyPluginOptions,
            RawServerDefault,
            FastifyTypeProviderDefault
          >;
        }>,
    opts?: FastifyRegisterOptions<FastifyPluginOptions> | undefined
  ): Promise<void> {
    await this.callMethod("register", plugin, opts);
  }

  public async getServer(): Promise<FastifyInstance<HServer | HSServer>> {
    return await this.callMethod("getServerInstance");
  }

  public async head<Path extends string>(
    path: Path,
    handler: FastifyNoBodyRequestHandler<Path>
  ): Promise<void> {
    await this.callMethod("head", path, handler as any);
  }
  public async get<Path extends string>(
    path: Path,
    handler: FastifyNoBodyRequestHandler<Path>
  ): Promise<void> {
    await this.callMethod("get", path, handler as any);
  }
  public async getCustom<
    Path extends string,
    Opts extends RouteShorthandOptions = any,
    Handler extends Function = {
      (request: FastifyRequest, reply: FastifyReply): Promise<void>;
    }
  >(path: Path, opts: Opts, handler: Handler): Promise<void> {
    await this.callMethod("getCustom", path, opts, handler as any);
  }
  public async post<Path extends string>(
    path: Path,
    handler: FastifyRequestHandler<Path>
  ): Promise<void> {
    await this.callMethod("post", path, handler as any);
  }
  public async put<Path extends string>(
    path: Path,
    handler: FastifyRequestHandler<Path>
  ): Promise<void> {
    await this.callMethod("put", path, handler as any);
  }
  public async delete<Path extends string>(
    path: Path,
    handler: FastifyRequestHandler<Path>
  ): Promise<void> {
    await this.callMethod("delete", path, handler as any);
  }
  public async patch<Path extends string>(
    path: Path,
    handler: FastifyRequestHandler<Path>
  ): Promise<void> {
    await this.callMethod("patch", path, handler as any);
  }
  public async options<Path extends string>(
    path: Path,
    handler: FastifyNoBodyRequestHandler<Path>
  ): Promise<void> {
    await this.callMethod("options", path, handler as any);
  }
  public async all<Path extends string>(
    path: Path,
    handler: FastifyRequestHandler<Path>
  ): Promise<void> {
    await this.callMethod("all", path, handler as any);
  }
}
