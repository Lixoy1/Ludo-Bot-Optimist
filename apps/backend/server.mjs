import { attachRealtime } from "./realtime.mjs";
import { createApiServer } from "./api-server.mjs";
import { RoomService } from "./room-service.mjs";
import { PostgresRoomStore } from "./postgres-room-store.mjs";
import { MemoryRoomStore } from "./room-store.mjs";
const port=Number(process.env.API_PORT??4174),host=process.env.API_HOST??"0.0.0.0";
let store;
if(process.env.DATABASE_URL){store=await PostgresRoomStore.connect(process.env.DATABASE_URL);await store.initialize();process.stdout.write("PostgreSQL persistence enabled.\n");}
else if(process.env.NODE_ENV==="production")throw new Error("DATABASE_URL is required in production; refusing volatile room storage.");
else{store=new MemoryRoomStore();process.stdout.write("WARNING: in-memory rooms; set DATABASE_URL for persistence.\n");}
const service=new RoomService({store});
const server=createApiServer({service});
const realtime=attachRealtime(server,service);
server.listen(port,host,()=>process.stdout.write("OPTIMIST LUDO API + WebSocket: http://"+host+":"+port+"\n"));
async function shutdown(signal){process.stdout.write(signal+": shutting down.\n");server.close(async()=>{realtime.close();await store.close();process.exit(0);});setTimeout(()=>process.exit(1),10000).unref();}
process.on("SIGINT",()=>shutdown("SIGINT"));process.on("SIGTERM",()=>shutdown("SIGTERM"));
