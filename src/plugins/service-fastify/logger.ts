import {DEBUG_MODE, IPluginLogger} from "@bettercorp/service-base";
import {CleanStringStrength, Tools} from "@bettercorp/tools/lib/Tools";
import {FastifyInstance} from "fastify";
import fp from "fastify-plugin";
import {hostname} from "os";

function plugin(
    fastify: FastifyInstance,
    opts: {
      server: "HTTP" | "HTTPS" | "HEALTH";
      log: IPluginLogger;
      mode: DEBUG_MODE;
    },
    donePlugin: Function,
) {
  const thisHostname = hostname();
  fastify.addHook("onRequest", (request, reply, done) => {
    const contentLength =
              Tools.isStringNumber(request.headers["content-length"]).value ?? -1;
    opts.log.reportStat(
        `[${opts.server}] Request on ${thisHostname} [${request.method}] ${request.hostname} ${request.url} (${request.ip})`,
        contentLength,
    );
    opts.log.reportStat(
        `[${opts.server}] Request [${request.method}] ${request.hostname} ${request.url}`,
        contentLength,
    );
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
    opts.log.reportStat(
        `[${opts.server}] Response on ${thisHostname} [${request.method}] ${request.hostname} ${request.url} (${request.ip})`,
        reply.statusCode,
    );
    opts.log.reportStat(
        `[${opts.server}] Response [${request.method}] ${request.hostname} ${request.url}`,
        reply.statusCode,
    );
    opts.log.reportStat(
        `[${opts.server}] Response time on ${thisHostname} [${request.method}] ${request.hostname} ${request.url} (${request.ip})`,
        reply.elapsedTime,
    );
    opts.log.reportStat(
        `[${opts.server}] Response time [${request.method}] ${request.hostname} ${request.url}`,
        reply.elapsedTime,
    );
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
