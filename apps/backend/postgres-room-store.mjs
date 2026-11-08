export class PostgresRoomStore {
  #pool;
  constructor(pool){if(!pool||typeof pool.query!=="function")throw new TypeError("A pg Pool is required.");this.#pool=pool;}
  static async connect(connectionString){
    const {Pool}=await import("pg");
    const pool=new Pool({connectionString,max:Number(process.env.PG_POOL_MAX??10),idleTimeoutMillis:30000,connectionTimeoutMillis:5000,ssl:process.env.PGSSL==="disable"?false:undefined});
    await pool.query("SELECT 1");return new PostgresRoomStore(pool);
  }
  async initialize(){
    await this.#pool.query(`CREATE TABLE IF NOT EXISTS ludo_rooms(
      room_code CHAR(6) PRIMARY KEY,status TEXT NOT NULL CHECK(status IN ('waiting','playing','finished')),
      created_at BIGINT NOT NULL,updated_at BIGINT NOT NULL,room_data JSONB NOT NULL,version BIGINT NOT NULL DEFAULT 1
    ); CREATE INDEX IF NOT EXISTS ludo_rooms_updated_at_idx ON ludo_rooms(updated_at);`);
  }
  async get(id){
    const {rows}=await this.#pool.query("SELECT room_data,version FROM ludo_rooms WHERE room_code=$1",[id]);
    return rows[0]?{...rows[0].room_data,_storeVersion:Number(rows[0].version)}:null;
  }
  async insert(room){
    try{const clean={...room};delete clean._storeVersion;
      await this.#pool.query("INSERT INTO ludo_rooms(room_code,status,created_at,updated_at,room_data) VALUES($1,$2,$3,$4,$5::jsonb)",[room.id,room.status,room.createdAt,room.updatedAt,JSON.stringify(clean)]);
      room._storeVersion=1;return true;
    }catch(e){if(e.code==="23505")return false;throw e;}
  }
  async save(room){
    const clean={...room};delete clean._storeVersion;
    const {rowCount}=await this.#pool.query(
      "UPDATE ludo_rooms SET status=$2,updated_at=$3,room_data=$4::jsonb,version=version+1 WHERE room_code=$1 AND version=$5",
      [room.id,room.status,room.updatedAt,JSON.stringify(clean),room._storeVersion]);
    if(!rowCount)throw Object.assign(new Error("Room changed concurrently; refresh and retry."),{code:"ROOM_CONFLICT"});
    room._storeVersion+=1;
  }
  async delete(id){await this.#pool.query("DELETE FROM ludo_rooms WHERE room_code=$1",[id]);}
  async close(){await this.#pool.end();}
}
