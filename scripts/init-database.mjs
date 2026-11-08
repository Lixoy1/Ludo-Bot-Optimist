import { PostgresRoomStore } from "../apps/backend/postgres-room-store.mjs";
if (!process.env.DATABASE_URL) throw new Error("DATABASE_URL is required.");
const store = await PostgresRoomStore.connect(process.env.DATABASE_URL);
try {
  await store.initialize();
  process.stdout.write("OPTIMIST LUDO database schema is ready.\n");
} finally {
  await store.close();
}
