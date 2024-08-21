import {DEBUG_MODE, IPluginLogger, IPluginMetrics} from "@bettercorp/service-base";
import {CleanStringStrength, Tools} from "@bettercorp/tools/lib/Tools";
import {FastifyInstance} from "fastify";
import fp from "fastify-plugin";

//import {hostname} from "os";

function plugin(
    fastify: FastifyInstance,
    opts: {
      server: "HTTP" | "HTTPS" | "HEALTH";
      log: IPluginLogger;
      metrics: IPluginMetrics;
      mode: DEBUG_MODE;
    },
    donePlugin: Function,
) {
  //const thisHostname = hostname();
  const metrics = {
    requests: opts.metrics.createCounter('requests', 'The amount of requests received', 'The amount of requests received', ['method', 'path']),
    responses: opts.metrics.createCounter('responses', 'The amount of requests responded to', 'The amount of requests responded to', ['method', 'path', 'status']),
    gauges: opts.metrics.createGauge('responseTimes', 'The requests this service has received', 'The requests this service has received', ['method', 'path', 'status']),
  };
  fastify.addHook("onRequest", (request, reply, done) => {
    // const contentLength =
    //           Tools.isStringNumber(request.headers["content-length"]).value ?? -1;
    metrics.requests.inc(1, {
      method: request.method.toUpperCase(),
      path: request.url,
    });
    // opts.log.reportStat(
    //     `[${opts.server}] Request on ${thisHostname} [${request.method}] ${request.hostname} ${request.url} (${request.ip})`,
    //     contentLength,
    // );
    // opts.log.reportStat(
    //     `[${opts.server}] Request [${request.method}] ${request.hostname} ${request.url}`,
    //     contentLength,
    // );
    if (opts.mode !== "production") {
      opts.log.debug(
          `[{server}] Request [{method}] {hostname} {url} ({ip}) headers [{headers}]`,
          {
            server: opts.server,
            hostname: Tools.cleanString(
                request.hostname,
                255,
                CleanStringStrength.soft,
            ),
            ip: request.ip,
            method: request.method,
            url: Tools.cleanString(request.url, 255, CleanStringStrength.soft),
            headers: Object.keys(request.headers)
                .map((x) => `${x}=${request.headers[x]}`)
                .join(", "),
          },
      );
    } else {
      opts.log.info(
          `[{server}] Request [{method}] {hostname} {url} ({ip})`,
          {
            server: opts.server,
            hostname: Tools.cleanString(
                request.hostname,
                255,
                CleanStringStrength.soft,
            ),
            ip: request.ip,
            method: request.method,
            url: Tools.cleanString(request.url, 255, CleanStringStrength.soft),
          },
      );
    }
    done();
  });

  // Add a hook for onResponse
  fastify.addHook("onResponse", (request, reply, done) => {
    metrics.responses.inc(1, {
      method: request.method.toUpperCase(),
      path: request.url,
      status: reply.statusCode.toString(),
    });
    metrics.gauges.set(reply.elapsedTime, {
      method: request.method.toUpperCase(),
      path: request.url,
      status: reply.statusCode.toString(),
    });
    // opts.log.reportStat(
    //     `[${opts.server}] Response on ${thisHostname} [${request.method}] ${request.hostname} ${request.url} (${request.ip})`,
    //     reply.statusCode,
    // );
    // opts.log.reportStat(
    //     `[${opts.server}] Response [${request.method}] ${request.hostname} ${request.url}`,
    //     reply.statusCode,
    // );
    // opts.log.reportStat(
    //     `[${opts.server}] Response time on ${thisHostname} [${request.method}] ${request.hostname} ${request.url} (${request.ip})`,
    //     reply.elapsedTime,
    // );
    // opts.log.reportStat(
    //     `[${opts.server}] Response time [${request.method}] ${request.hostname} ${request.url}`,
    //     reply.elapsedTime,
    // );
    if (opts.mode !== "production") {
      opts.log.debug(
          `[{server}] Response [{method}] {hostname} {url} ({ip}) code {statusCode}`,
          {
            server: opts.server,
            hostname: Tools.cleanString(
                request.hostname,
                255,
                CleanStringStrength.soft,
            ),
            ip: request.ip,
            method: request.method,
            url: Tools.cleanString(request.url, 255, CleanStringStrength.soft),
            statusCode: reply.statusCode,
          },
      );
    } else {
      opts.log.info(
          `[{server}] Response [{method}] {hostname} {url} ({ip}) code {statusCode}`,
          {
            statusCode: reply.statusCode,
            server: opts.server,
            hostname: Tools.cleanString(
                request.hostname,
                255,
                CleanStringStrength.soft,
            ),
            ip: request.ip,
            method: request.method,
            url: Tools.cleanString(request.url, 255, CleanStringStrength.soft),
          },
      );
    }
    done();
  });

  donePlugin();
}

export default fp(plugin, {
  name: "fastify-bsb-logger",
});
