export class MemoryRoomStore {
  #rooms = new Map();
  async get(id) {
    const room = this.#rooms.get(id);
    return room ? structuredClone(room) : null;
  }
  async insert(room) {
    if (this.#rooms.has(room.id)) return false;
    this.#rooms.set(room.id, structuredClone(room));
    return true;
  }
  async save(room) {
    if (!this.#rooms.has(room.id)) throw new Error("Room not found.");
    this.#rooms.set(room.id, structuredClone(room));
  }
  async delete(id) { this.#rooms.delete(id); }
  async close() {}
}
