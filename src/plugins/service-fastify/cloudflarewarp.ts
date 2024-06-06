import {DEBUG_MODE, IPluginLogger} from "@bettercorp/service-base";
import {FastifyInstance} from "fastify";
import fp from "fastify-plugin";

function plugin(
    fastify: FastifyInstance,
    opts: {
      log: IPluginLogger;
      mode: DEBUG_MODE;
    },
    donePlugin: Function,
) {
  fastify.addHook("onRequest", (request, reply, done) => {
    // X-Real-Ip
    // X-Is-Trusted
    if (request.headers['X-Is-Trusted'] !== 'yes') {
      opts.log.warn("Cloudflarewarp: X-Is-Trusted header is not set to yes - {status}:{ip}", {
        status: request.headers['X-Is-Trusted'] ?? "unset",
        ip: request.ip,
      });
      return reply.status(403).send("Forbidden");
    }
    if (opts.mode !== "production") {
      opts.log.debug("Cloudflarewarp: X-Is-Trusted header is set to {status} and {ip} is changed to{rip}", {
        status: request.headers['X-Is-Trusted'] ?? "unset",
        ip: request.ip,
        rip: request.headers['X-Real-Ip'] ?? "unset",
      });
    }
    (request as any).ip = request.headers['X-Real-Ip'];
    return done();
  });
    
  donePlugin();
}

export default fp(plugin, {
  name: "fastify-cloudflarewarp",
});
