import {z} from "zod";

export const WebServerType = {
  http: "http",
  https: "https",
  //dual: "dual",
};
export type WebServerTypes = (typeof WebServerType)[keyof typeof WebServerType];

const validHostsV4 = [
  "0.0.0.0",
  "localhost",
  "127.0.0.1",
];
const validHostsV6 = [
  "::",
  "localhost",
  "::1",
];
const ipv4Pattern =
          /^((25[0-5]|2[0-4][0-9]|[01]?[0-9][0-9]?)\.){3}(25[0-5]|2[0-4][0-9]|[01]?[0-9][0-9]?)$/;
const ipv6Pattern =
          /^([0-9a-fA-F]{1,4}:){7,7}[0-9a-fA-F]{1,4}|([0-9a-fA-F]{1,4}:){1,7}:|([0-9a-fA-F]{1,4}:){1,6}:[0-9a-fA-F]{1,4}|([0-9a-fA-F]{1,4}:){1,5}(:[0-9a-fA-F]{1,4}){1,2}|([0-9a-fA-F]{1,4}:){1,4}(:[0-9a-fA-F]{1,4}){1,3}|([0-9a-fA-F]{1,4}:){1,3}(:[0-9a-fA-F]{1,4}){1,4}|([0-9a-fA-F]{1,4}:){1,2}(:[0-9a-fA-F]{1,4}){1,5}|[0-9a-fA-F]{1,4}:((:[0-9a-fA-F]{1,4}){1,6})|:((:[0-9a-fA-F]{1,4}){1,7}|:)|fe80:(:[0-9a-fA-F]{0,4}){0,4}%[0-9a-zA-Z]{1,}|::(ffff(:0{1,4}){0,1}:){0,1}((25[0-5]|(2[0-4]|1{0,1}[0-9]){0,1}[0-9])\.){3,3}(25[0-5]|(2[0-4]|1{0,1}[0-9]){0,1}[0-9])|([0-9a-fA-F]{1,4}:){1,4}:((25[0-5]|(2[0-4]|1{0,1}[0-9]){0,1}[0-9])\.){3,3}(25[0-5]|(2[0-4]|1{0,1}[0-9]){0,1}[0-9])$/;

export const secSchema = z
    .object({
      behindTraefikWithCloudflareWarp: z
          .boolean()
          .default(false)
          .describe("Enable /health cloudflarewarp parser: If this is behind https://github.com/BetterCorp/cloudflarewarp with traefik"),
      health: z
          .boolean()
          .default(false)
          .describe("Enable /health endpoint: Used to monitoring"),
      healthServerPort: z
          .number()
          .optional()
          .describe("Enable /health endpoint on a different port"),
      type: z
          .enum(Object.values(WebServerType) as [string, ...string[]])
          .default(WebServerType.http)
          .describe("Server Type: HTTP/HTTPS or both"),
      /*httpToHttpsRedirect: z
          .boolean()
          .default(true)
          .describe(
              "HTTP to HTTPS redirect: If you are using both HTTP and HTTPS, then we can automatically redirect HTTP to HTTPS",
          ),*/
      httpPort: z
          .number()
          .min(0)
          .max(65535)
          .default(3000)
          .describe(
              "HTTP Server Port: If using the HTTP server, the port to bind to",
          ),
      httpsPort: z
          .number()
          .min(0)
          .max(65535)
          .default(3000)
          .describe(
              "HTTPS Server Port: If using the HTTPS server, the port to bind to",
          ),
      httpsCert: z
          .string()
          .nullable()
          .default(null)
          .describe("HTTPS Cert File: The full path for the HTTP certificate file"),
      httpsKey: z
          .string()
          .nullable()
          .default(null)
          .describe(
              "HTTPS Cert Key File: The full path for the HTTP certificate key file",
          ),
      host: z
          .string()
          .default("localhost")
          .refine(
              (value) => {
                return (
                    validHostsV4.includes(value) ||
                    validHostsV6.includes(value) ||
                    ipv4Pattern.test(value) ||
                    ipv6Pattern.test(value)
                );
              },
              {
                message: "Invalid host. It should be a valid host name or IP address",
              },
          )
          .describe(
              "Host:" +
              validHostsV4.join("/") +
              "/" +
              validHostsV6.join("/") +
              " type host definition",
          ),
      exclusive: z
          .boolean()
          .default(false)
          .describe(
              "Exclusive: If true, the server will only listen on the specified host. If false, it will listen on all hosts",
          ),
      readableAll: z
          .boolean()
          .default(false)
          .describe(
              "Readable All: If true, the server will listen on all IPv4 addresses",
          ),
      writableAll: z
          .boolean()
          .default(false)
          .describe(
              "Writable All: If true, the server will listen on all IPv6 addresses",
          ),
      ipv6Only: z
          .boolean()
          .default(false)
          .describe(
              "IPv6 Only: If true, the server will only listen on IPv6 addresses",
          ),
      http2: z
          .boolean()
          .optional()
          .default(false)
          .describe(
              "Enable/Disable HTTP2",
          ),
      allowHTTP1: z
          .boolean()
          .optional()
          .default(false)
          .describe(
              "HTTP2 Fallback to HTTP1 when not supported",
          ),
    })
    /*.refine(
     (value) => {
     if (
     (value && validHostsV6.includes(value.host)) ||
     ipv6Pattern.test(value.host)
     ) {
     return false;
     }
     return true;
     },
     {
     message: "ipv6Only can only be true if host is an IPv6 address",
     }
     )
     .refine(
     (value) =>
     value &&
     value.type === WebServerType.dual &&
     value.httpPort == value.httpsPort &&
     value.httpPort !== 0,
     {
     message: "httpPort and httpsPort must be different",
     }
     )*/
    .default({});
