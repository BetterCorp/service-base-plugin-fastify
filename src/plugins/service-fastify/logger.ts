import { IPluginLogger } from "@bettercorp/service-base";
import { CleanStringStrength, Tools } from "@bettercorp/tools/lib/Tools";
import { FastifyInstance, FastifyRequestContext } from "fastify";
import fp from "fastify-plugin";
import { hostname } from "os";

interface LoggerFastifyRequestContext extends FastifyRequestContext {
  startTime: [number, number];
}

function plugin(
  fastify: FastifyInstance,
  log: IPluginLogger,
  donePlugin: Function
) {
  fastify.addHook("onRequest", (request, reply, done) => {
    log.reportStat(
      `FASTIFY_REQUEST_${request.method}_${Tools.cleanString(
        request.hostname,
        255,
        CleanStringStrength.hard
      )}_${request.routeOptions.config.url}`,
      1
    );
    log.reportStat(
      `FASTIFY_REQUEST_${hostname()}_${request.method}_${Tools.cleanString(
        request.hostname,
        255,
        CleanStringStrength.hard
      )}_${request.routeOptions.config.url}`,
      1
    );
    log.reportTextStat(
      `Fastify Request [{method}] {oshostname} {hostname} {url} ({ip})`,
      {
        oshostname: hostname(),
        hostname: Tools.cleanString(
          request.hostname,
          255,
          CleanStringStrength.hard
        ),
        ip: request.ip,
        method: request.method,
        url: request.routeOptions.url,
      }
    );
    (request.context as LoggerFastifyRequestContext).startTime =
      process.hrtime();
    done();
  });

  // Add a hook for onResponse
  fastify.addHook("onResponse", (request, reply, done) => {
    const responseTime = process.hrtime(
      (request.context as LoggerFastifyRequestContext).startTime
    );
    const responseTimeInMs = responseTime[0] * 1e3 + responseTime[1] * 1e-6;
    log.reportStat(
      `FASTIFY_RESPONSE_${request.method}_${Tools.cleanString(
        request.hostname,
        255,
        CleanStringStrength.hard
      )}_${request.routeOptions.config.url}`,
      responseTimeInMs
    );
    log.reportStat(
      `FASTIFY_RESPONSE_${request.method}_${Tools.cleanString(
        request.hostname,
        255,
        CleanStringStrength.hard
      )}_${request.routeOptions.config.url}_STATUS`,

      reply.statusCode
    );
    log.reportStat(
      `FASTIFY_RESPONSE_${hostname()}_${request.method}_${Tools.cleanString(
        request.hostname,
        255,
        CleanStringStrength.hard
      )}_${request.routeOptions.config.url}`,
      responseTimeInMs
    );
    log.reportStat(
      `FASTIFY_RESPONSE_${hostname()}_${request.method}_${Tools.cleanString(
        request.hostname,
        255,
        CleanStringStrength.hard
      )}_${request.routeOptions.config.url}_STATUS`,
      reply.statusCode
    );
    log.reportTextStat(
      `Fastify Response [{method}] {oshostname} {hostname} {url} ({ip}) Took {responseTimeInMs}ms and code {statusCode}`,
      {
        oshostname: hostname(),
        hostname: Tools.cleanString(
          request.hostname,
          255,
          CleanStringStrength.hard
        ),
        ip: request.ip,
        method: request.method,
        url: request.routeOptions.url,
        responseTimeInMs,
        statusCode: reply.statusCode,
      }
    );
    done();
  });

  donePlugin();
}

export default fp(plugin, {
  name: "fastify-bsb-logger",
});
