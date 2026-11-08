import { EventEmitter } from "node:events";
import { randomBytes, randomInt, timingSafeEqual } from "node:crypto";
import { createClassicState, rollClassicDice, applyClassicMove } from "../../src/engine/classic-engine.mjs";
import { getCharacter } from "../../src/characters.mjs";
import { MemoryRoomStore } from "./room-store.mjs";

const ALPHABET = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
const MAX_ROOM_AGE_MS = 12 * 60 * 60 * 1000;
const code = () => Array.from({length:6}, () => ALPHABET[randomInt(ALPHABET.length)]).join("");
const id = () => randomBytes(8).toString("hex");
const secret = () => randomBytes(32).toString("base64url");
function matches(a,b) {
  if (typeof a !== "string" || typeof b !== "string") return false;
  const x=Buffer.from(a), y=Buffer.from(b);
  return x.length===y.length && timingSafeEqual(x,y);
}
function view(room) {
  return { id:room.id,status:room.status,createdAt:room.createdAt,updatedAt:room.updatedAt,
    players:room.players.map(({secret,...p})=>({...p})),state:room.state?structuredClone(room.state):null };
}
export class RoomService extends EventEmitter {
  #store; #now; #rollDie;
  constructor({store=new MemoryRoomStore(),now=()=>Date.now(),rollDie=()=>randomInt(1,7)}={}) {
    super();
    if (!store || !["get","insert","save","delete"].every(k=>typeof store[k]==="function")) throw new TypeError("Room store adapter is invalid.");
    if(typeof now!=="function"||typeof rollDie!=="function") throw new TypeError("Clock and die roller must be functions.");
    this.#store=store;this.#now=now;this.#rollDie=rollDie;
  }
  async createRoom({username,characterId="optimist"}) {
    const name=String(username??"").trim().slice(0,32);if(!name)throw new TypeError("Username is required.");getCharacter(characterId);
    let room;
    do { const timestamp=this.#now();room={id:code(),status:"waiting",createdAt:timestamp,updatedAt:timestamp,
      players:[{id:id(),username:name,characterId,color:"yellow",secret:secret()}],state:null}; }
    while(!(await this.#store.insert(room)));
    const p=room.players[0];return {room:view(room),playerId:p.id,playerSecret:p.secret};
  }
  async joinRoom(roomId,{username,characterId="optimist"}) {
    const r=await this.#get(roomId),name=String(username??"").trim().slice(0,32);
    if(!name)throw new TypeError("Username is required.");getCharacter(characterId);
    if(r.status!=="waiting")throw new Error("Room is not accepting players.");
    if(r.players.length>=4)throw new Error("Room is full.");
    const p={id:id(),username:name,characterId,color:["yellow","blue","red","green"][r.players.length],secret:secret()};
    r.players.push(p);r.updatedAt=this.#now();await this.#store.save(r);this.emit("room:update",view(r));
    return {room:view(r),playerId:p.id,playerSecret:p.secret};
  }
  async startRoom(roomId,playerId,playerSecret) {
    const r=await this.#get(roomId);this.#auth(r,playerId,playerSecret);
    if(r.status!=="waiting")throw new Error("Room has already started.");
    if(r.players[0].id!==playerId)throw new Error("Only the room host can start the game.");
    if(r.players.length<2)throw new Error("At least two players are required.");
    r.state=createClassicState(r.players.map(({id,username,color,characterId})=>({id,username,color,characterId})));
    r.status="playing";r.updatedAt=this.#now();await this.#store.save(r);this.emit("room:update",view(r));return view(r);
  }
  async getRoom(roomId,playerId,playerSecret) {
    const r=await this.#get(roomId);this.#auth(r,playerId,playerSecret);return view(r);
  }
  async roll(roomId,playerId,playerSecret) {
    const r=await this.#playing(roomId);this.#auth(r,playerId,playerSecret);
    if(r.state.currentPlayer!==playerId)throw new Error("It is not your turn.");
    const dice=this.#rollDie(),result=rollClassicDice(r.state,playerId,dice);
    r.state=result.state;r.updatedAt=this.#now();await this.#store.save(r);this.emit("room:update",view(r));
    return {room:view(r),dice,legalTokenIds:result.legalTokenIds,skipped:result.skipped,bonusRoll:result.bonusRoll,turnAdvanced:result.turnAdvanced};
  }
  async move(roomId,playerId,playerSecret,tokenId) {
    const r=await this.#playing(roomId);this.#auth(r,playerId,playerSecret);
    if(r.state.currentPlayer!==playerId)throw new Error("It is not your turn.");
    const result=applyClassicMove(r.state,playerId,tokenId);r.state=result.state;
    if(r.state.phase==="finished")r.status="finished";
    r.updatedAt=this.#now();await this.#store.save(r);this.emit("room:update",view(r));
    return {room:view(r),captured:result.captured,bonusRoll:result.bonusRoll,turnAdvanced:result.turnAdvanced};
  }
  async #get(roomId) {
    const key=String(roomId??"").toUpperCase(),r=await this.#store.get(key);
    if(!r||this.#now()-r.createdAt>MAX_ROOM_AGE_MS){if(r)await this.#store.delete(key);throw new Error("Room not found or expired.");}
    return r;
  }
  async #playing(roomId) {const r=await this.#get(roomId);if(r.status!=="playing"||!r.state)throw new Error("Game has not started.");return r;}
  #auth(r,pid,s) {const p=r.players.find(x=>x.id===pid);if(!p||!matches(p.secret,s))throw new Error("Player authentication failed.");}
}
