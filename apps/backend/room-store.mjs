export class MemoryRoomStore {
  #rooms = new Map();
  async get(id) {
    const entry=this.#rooms.get(id);
    return entry ? { ...structuredClone(entry.room), _storeVersion:entry.version } : null;
  }
  async insert(room) {
    if(this.#rooms.has(room.id))return false;
    const clean=structuredClone(room);delete clean._storeVersion;
    this.#rooms.set(room.id,{room:clean,version:1});return true;
  }
  async save(room) {
    const entry=this.#rooms.get(room.id);
    if(!entry)throw new Error("Room not found.");
    if(room._storeVersion!==entry.version)throw Object.assign(new Error("Room changed concurrently; refresh and retry."),{code:"ROOM_CONFLICT"});
    const clean=structuredClone(room);delete clean._storeVersion;
    this.#rooms.set(room.id,{room:clean,version:entry.version+1});
    room._storeVersion=entry.version+1;
  }
  async delete(id){this.#rooms.delete(id);}
  async close(){}
}
