import { createApiServer } from "./api-server.mjs";

const port = Number(process.env.API_PORT ?? 4174);
const host = process.env.API_HOST ?? "0.0.0.0";
const server = createApiServer();

server.listen(port, host, () => {
  process.stdout.write("OPTIMIST LUDO API: http://" + host + ":" + port + "\n");
});
