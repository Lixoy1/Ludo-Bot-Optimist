import os, random, string, asyncio, sqlite3, hmac, hashlib, json, time, base64, secrets, re
from urllib.parse import parse_qsl
from contextlib import asynccontextmanager
from fastapi import FastAPI, WebSocket, WebSocketDisconnect, Request, HTTPException
from fastapi.staticfiles import StaticFiles
from fastapi.responses import HTMLResponse, JSONResponse, Response
from aiogram import Bot, Dispatcher, types, F
from aiogram.filters import CommandStart, Command
from aiogram.types import InlineKeyboardMarkup, InlineKeyboardButton, WebAppInfo

BOT_TOKEN = os.getenv("BOT_TOKEN", "ВСТАВЬ_СЮДА_ТОКЕН_БОТА")
WEBAPP_URL = os.getenv("WEBAPP_URL", "https://твой-домен.ru").rstrip("/")
APP_ENV = os.getenv("APP_ENV", "development").strip().lower()
ALLOW_DEV_AUTH = APP_ENV != "production" and os.getenv("ALLOW_DEV_AUTH", "true").strip().lower() in {"1", "true", "yes", "on"}
BOT_TOKEN_PLACEHOLDER = "ВСТАВЬ_СЮДА_ТОКЕН_БОТА"

COLORS = ["green", "yellow", "blue", "red"]
COLOR_EMOJI = {"green": "🟢", "yellow": "🟡", "blue": "🔵", "red": "🔴"}
CHARACTER_IDS = {"optimist", "elvina", "nikita", "lilya-detective", "natalie", "ksyusha", "lena", "poison", "cat", "husky", "owl", "raccoon"}
MODE_NAMES = {
    "STANDARD": "🎲 Стандарт",
    "TEAM": "🤝 Команда 2×2",
    "QUICK": "⚡ Быстрая игра",
    "BLITZ": "🔥 Блиц (15 сек)"
}
SAFE_GLOBAL = {0, 8, 13, 21, 26, 34, 39, 47}
START_OFFSET = {"green": 0, "yellow": 13, "blue": 26, "red": 39}

ROOMS = {}
ROOM_LOCKS = {}
DB_LOCK = asyncio.Lock()

# Temporary voice-note storage and per-WebSocket session tokens (same pattern as Durak).
VOICE_SESSIONS = {}
VOICE_FILES = {}
VOICE_MAX_BYTES = 512 * 1024
VOICE_MAX_TOTAL_BYTES = 16 * 1024 * 1024
VOICE_MAX_FILES = 80
VOICE_MAX_DURATION_SECONDS = 30
VOICE_TTL_SECONDS = 6 * 60 * 60
VOICE_MIME_TYPES = {"audio/webm", "audio/ogg", "audio/mp4"}

# ─── Telegram WebApp authentication ───
def verify_telegram_init_data(init_data: str) -> dict:
    """Verify Telegram WebApp initData. Never trust initDataUnsafe or client user_id."""
    if not init_data:
        raise HTTPException(status_code=403, detail="Telegram initData is required")
    if BOT_TOKEN == BOT_TOKEN_PLACEHOLDER:
        raise HTTPException(status_code=503, detail="BOT_TOKEN is not configured")
    try:
        pairs = parse_qsl(init_data, keep_blank_values=True)
        parsed = dict(pairs)
        if len(parsed) != len(pairs):
            raise HTTPException(status_code=403, detail="Duplicate initData fields")
        received_hash = parsed.pop("hash", None)
        if not received_hash:
            raise HTTPException(status_code=403, detail="Invalid initData format")
        auth_date = int(parsed.get("auth_date", "0"))
        now = int(time.time())
        if auth_date <= 0 or auth_date > now + 60 or now - auth_date > 86400:
            raise HTTPException(status_code=403, detail="Telegram auth_date is invalid or expired")
        data_check_string = "\n".join(f"{k}={v}" for k, v in sorted(parsed.items()))
        secret_key = hmac.new(b"WebAppData", BOT_TOKEN.encode(), hashlib.sha256).digest()
        calculated_hash = hmac.new(secret_key, data_check_string.encode(), hashlib.sha256).hexdigest()
        if not hmac.compare_digest(calculated_hash, received_hash):
            raise HTTPException(status_code=403, detail="Telegram signature mismatch")
        user_data = json.loads(parsed.get("user", "{}"))
        user_id = user_data.get("id")
        if not user_id:
            raise HTTPException(status_code=403, detail="Telegram user is missing")
        return {"id": str(user_id), "first_name": str(user_data.get("first_name") or "Игрок")[:64],
                "photo_url": str(user_data.get("photo_url") or "")[:2048]}
    except HTTPException:
        raise
    except Exception:
        raise HTTPException(status_code=403, detail="Telegram authentication failed")


def resolve_webapp_identity(init_data: str = "", user_id: str = "", name: str = "Игрок", photo_url: str = "") -> dict:
    """Use signed Telegram identity in production; allow browser identities only in development."""
    if init_data:
        return verify_telegram_init_data(init_data)
    if ALLOW_DEV_AUTH:
        return {"id": str(user_id or "player1")[:128], "first_name": str(name or "Игрок")[:64],
                "photo_url": str(photo_url or "")[:2048]}
    raise HTTPException(status_code=403, detail="Telegram WebApp authentication is required")


def build_voice_ice_servers(user_id: str) -> list:
    """Generate one-hour coturn REST credentials when TURN is configured."""
    urls = [value.strip() for value in os.getenv("TURN_URLS", "").split(",") if value.strip()]
    shared_secret = os.getenv("TURN_SHARED_SECRET", "").strip()
    if not urls or not shared_secret:
        return []
    username = f"{int(time.time()) + 3600}:{user_id}"
    credential = base64.b64encode(hmac.new(shared_secret.encode(), username.encode(), hashlib.sha1).digest()).decode()
    return [{"urls": urls, "username": username, "credential": credential}]


# ─── Persistent database: Neon PostgreSQL in production, SQLite locally ───
DATABASE_URL = os.getenv("DATABASE_URL", "").strip()
DB_BACKEND = "postgres" if DATABASE_URL else "sqlite"

if DATABASE_URL:
    import psycopg
    _raw_db = psycopg.connect(DATABASE_URL, connect_timeout=20)
else:
    DB_PATH = os.getenv("DATABASE_PATH", "ludo.db")
    os.makedirs(os.path.dirname(os.path.abspath(DB_PATH)), exist_ok=True)
    _raw_db = sqlite3.connect(DB_PATH, check_same_thread=False)

class DatabaseAdapter:
    """Keep the existing SQLite-style call sites working on both database engines."""
    def __init__(self, connection, backend):
        self.connection = connection
        self.backend = backend

    def execute(self, query, params=()):
        if self.backend == "postgres":
            query = query.replace(
                "INSERT OR REPLACE INTO rooms (code, state_json) VALUES (?, ?)",
                "INSERT INTO rooms (code, state_json) VALUES (?, ?) "
                "ON CONFLICT (code) DO UPDATE SET state_json = EXCLUDED.state_json"
            )
            query = query.replace("?", "%s")
        return self.connection.execute(query, params)

    def commit(self):
        return self.connection.commit()

    def close(self):
        return self.connection.close()

db = DatabaseAdapter(_raw_db, DB_BACKEND)
db.execute("""
CREATE TABLE IF NOT EXISTS users (
    user_id TEXT PRIMARY KEY,
    name TEXT DEFAULT 'Игрок',
    photo_url TEXT DEFAULT '',
    rating INTEGER DEFAULT 1000,
    games INTEGER DEFAULT 0,
    wins INTEGER DEFAULT 0,
    best_streak INTEGER DEFAULT 0,
    skin TEXT DEFAULT 'optimist',
    board_theme TEXT DEFAULT 'neon',
    fav_color TEXT DEFAULT ''
)
""")
db.execute("""
CREATE TABLE IF NOT EXISTS rooms (
    code TEXT PRIMARY KEY,
    state_json TEXT NOT NULL
)
""")
db.commit()

async def save_room_db(room: dict):
    try:
        snapshot = {
            "code": room["code"],
            "status": room["status"],
            "game_mode": room["game_mode"],
            "players": room["players"],
            "board_state": room["board_state"],
            "turn": room["turn"],
            "dice": room["dice"],
            "consecutive_sixes": room.get("consecutive_sixes", 0),
            "chat_id": room.get("chat_id"),
            "msg_id": room.get("msg_id"),
            "creator_user_id": room.get("creator_user_id"),
            "results_recorded": bool(room.get("results_recorded", False))
        }
        async with DB_LOCK:
            db.execute("INSERT OR REPLACE INTO rooms (code, state_json) VALUES (?, ?)", (room["code"], json.dumps(snapshot)))
            db.commit()
    except Exception:
        pass

def restore_room_from_db(code: str):
    """Restore one room from PostgreSQL/SQLite when it is absent from memory."""
    try:
        row = db.execute("SELECT state_json FROM rooms WHERE code=?", (code,)).fetchone()
        if not row:
            return None
        data = json.loads(row[0])
        if data.get("status") == "FINISHED":
            return None
        data["sockets"] = {}
        data["spectators"] = {}
        data.setdefault("results_recorded", False)
        data["start_task"] = None
        data["turn_task"] = None
        data["turn_gen"] = int(data.get("turn_gen", 0))
        data.setdefault("lobby_deadline", None)
        data["actor_task"] = None
        data.setdefault("creator_user_id", None)
        ROOMS[code] = data
        ROOM_LOCKS.setdefault(code, asyncio.Lock())
        return data
    except Exception as exc:
        print(f"[ROOM_RESTORE_ERROR] room={code} error={type(exc).__name__}: {exc}")
        return None

def load_rooms_from_db():
    try:
        rows = db.execute("SELECT code FROM rooms").fetchall()
        for (code,) in rows:
            restore_room_from_db(code)
    except Exception as exc:
        print(f"[ROOMS_LOAD_ERROR] error={type(exc).__name__}: {exc}")

load_rooms_from_db()

async def get_user(uid: str, name: str = "Игрок", photo_url: str = ""):
    async with DB_LOCK:
        cur = db.execute("SELECT user_id, name, photo_url, rating, games, wins, best_streak, skin, board_theme, fav_color FROM users WHERE user_id=?", (uid,))
        row = cur.fetchone()
        if not row:
            db.execute("INSERT INTO users (user_id, name, photo_url) VALUES (?, ?, ?)", (uid, name, photo_url))
            db.commit()
            return {"user_id": uid, "name": name, "photo_url": photo_url, "rating": 1000, "games": 0, "wins": 0, "best_streak": 0, "skin": "optimist", "board_theme": "neon", "fav_color": None}
        if name and name != "Игрок" and row[1] != name:
            db.execute("UPDATE users SET name=? WHERE user_id=?", (name, uid))
        if photo_url and row[2] != photo_url:
            db.execute("UPDATE users SET photo_url=? WHERE user_id=?", (photo_url, uid))
        db.commit()
        return {
            "user_id": row[0],
            "name": name if (name and name != "Игрок") else row[1],
            "photo_url": photo_url or row[2] or "",
            "rating": row[3], "games": row[4], "wins": row[5], "best_streak": row[6],
            "skin": row[7] or "optimist", "board_theme": row[8] or "neon",
            "fav_color": row[9] if row[9] else None
        }

# ─── Управление комнатами ───
def gen_code():
    return "".join(random.choices(string.ascii_uppercase + string.digits, k=6))

async def create_room_state(code: str, mode: str = "STANDARD", chat_id: int = None, msg_id: int = None, creator_user_id: int = None):
    mode = str(mode or "STANDARD").upper()
    if mode not in MODE_NAMES:
        raise ValueError("Unsupported game mode")
    if code not in ROOMS:
        ROOMS[code] = {
            "code": code,
            "status": "WAITING",
            "game_mode": mode,
            "players": [],
            "spectators": {},
            "results_recorded": False,
            "board_state": {"green": [-1]*4, "yellow": [-1]*4, "blue": [-1]*4, "red": [-1]*4},
            "turn": "green",
            "dice": None,
            "consecutive_sixes": 0,
            "sockets": {},
            "chat_id": chat_id,
            "msg_id": msg_id,
            "creator_user_id": str(creator_user_id) if creator_user_id is not None else None,
            "start_task": None,
            "lobby_deadline": None,
            "turn_task": None,
            "turn_gen": 0,
            "actor_task": None
        }
        ROOM_LOCKS[code] = asyncio.Lock()
        await save_room_db(ROOMS[code])
    return ROOMS[code]

def render_tg_lobby_text(room):
    title = MODE_NAMES.get(room["game_mode"], "🎲 Optimist Ludo")
    players = room["players"]
    if room["status"] == "WAITING":
        header = f"🎮 **Optimist Ludo — {title}**\nИгроков: **{len(players)}/4**\n\n"
        if room["game_mode"] == "TEAM":
            team_a = [f"• {COLOR_EMOJI[p['color']]} {p['name']}" for p in players if p.get("team") == "A"]
            team_b = [f"• {COLOR_EMOJI[p['color']]} {p['name']}" for p in players if p.get("team") == "B"]
            body = "**Команда A (🔴🟡):**\n" + ("\n".join(team_a) if team_a else "_пусто_") + "\n\n"
            body += "**Команда B (🟢🔵):**\n" + ("\n".join(team_b) if team_b else "_пусто_")
        else:
            lines = [f"{i+1}. {COLOR_EMOJI[p['color']]} {p['name']}" for i, p in enumerate(players)]
            while len(lines) < 4:
                lines.append(f"{len(lines)+1}. _Ожидание игрока..._")
            body = "\n".join(lines)
        if len(players) < 2:
            footer = "\n\n⏳ _Ожидаем второго игрока. После его входа игра начнётся автоматически через 15 секунд._"
        else:
            remaining = max(0, int((room.get("lobby_deadline") or (time.time() + 15)) - time.time()))
            footer = (f"\n\n⏳ _Автостарт через {remaining} сек. или сразу при заполнении 4/4._"
                      "\n🤖 _Можно начать раньше с ботами прямо в игре._")
        return header + body + footer
    elif room["status"] == "PLAYING":
        active = next((p for p in players if p.get("color") == room.get("turn")), None)
        plist = "\n".join([
            f"{'👉 ' if p is active else ''}{COLOR_EMOJI[p['color']]} {p['name']}{' (БОТ)' if p.get('is_bot') else ''}{' — ХОДИТ' if p is active else ''}"
            for p in players
        ])
        turn_line = f"\n\n🎲 **Сейчас ходит: {active['name']}**" if active else ""
        return f"🔥 **Игра идёт! ({title})**{turn_line}\n\n{plist}"
    else:
        sorted_p = sorted(players, key=lambda x: x.get("rank") or 99)
        res = "\n".join([f"#{p.get('rank', '×')} {COLOR_EMOJI[p['color']]} {p['name']}" for p in sorted_p])
        return f"🏆 **Игра окончена! ({title})**\n\n{res}"

def room_webapp_url(code: str) -> str:
    """Open the configured Main Mini App directly in the current Telegram chat."""
    normalized = normalize_room_code(code)
    return f"https://t.me/Ludo_optimist_bot?startapp=join_{normalized}"

def render_tg_lobby_kb(room):
    code = room["code"]
    if room["status"] == "FINISHED":
        return InlineKeyboardMarkup(inline_keyboard=[
            [InlineKeyboardButton(text="🔄 Новая игра", callback_data=f"new_{room['game_mode']}")]
        ])
    # URL deep links work in group chats. web_app InlineKeyboardButtons are
    # private-chat-only, so use Telegram Main Mini App startapp links here.
    if room["game_mode"] == "TEAM" and room["status"] == "WAITING":
        return InlineKeyboardMarkup(inline_keyboard=[
            [
                InlineKeyboardButton(text="🔴🟡 Команда A", url=room_webapp_url(code + "_A")),
                InlineKeyboardButton(text="🟢🔵 Команда B", url=room_webapp_url(code + "_B"))
            ]
        ])
    label = "🎲 Открыть игру" if room["status"] == "WAITING" else "🎮 Вернуться в игру"
    return InlineKeyboardMarkup(inline_keyboard=[
        [InlineKeyboardButton(text=label, url=room_webapp_url(code))]
    ])

async def sync_tg_message(room):
    await save_room_db(room)
    if not room.get("chat_id") or not room.get("msg_id") or bot is None:
        return
    try:
        await asyncio.wait_for(
            bot.edit_message_text(
                chat_id=room["chat_id"],
                message_id=room["msg_id"],
                text=render_tg_lobby_text(room),
                reply_markup=render_tg_lobby_kb(room),
                parse_mode="Markdown"
            ),
            timeout=4.0
        )
    except asyncio.TimeoutError:
        print(f"[TELEGRAM_SYNC_TIMEOUT] room={room.get('code')} status={room.get('status')}")
    except Exception as exc:
        print(f"[TELEGRAM_SYNC_ERROR] room={room.get('code')} error={type(exc).__name__}: {exc}")

async def broadcast(room, payload):
    # A stale mobile WebSocket must not block starting the whole match.
    for uid, ws in list(room["sockets"].items()):
        try:
            await asyncio.wait_for(ws.send_json(payload), timeout=1.5)
        except Exception as exc:
            if room["sockets"].get(uid) is ws:
                room["sockets"].pop(uid, None)
            print(f"[WS_BROADCAST_DROP] room={room.get('code')} user={uid} error={type(exc).__name__}")

def can_move_any(board, color, val):
    for pos in board[color]:
        if pos == -1 and val == 6:
            return True
        if pos >= 0 and pos + val <= 56:
            return True
    return False

def assign_finish_rank(room, player):
    """Assign exactly one deterministic finish place to a player or bot."""
    if player.get("rank") is None:
        player["rank"] = 1 + sum(1 for item in room["players"] if item.get("rank") is not None)
    player["finished"] = True
    return player["rank"]


def standard_match_complete(room):
    """A standard match ends only after all four seats have a final place."""
    players = room.get("players", [])
    return bool(players) and all(p.get("finished") or p.get("left") for p in players)


async def record_match_results(room):
    """Record rank-based rating once; only first place counts as a win."""
    if room.get("results_recorded"):
        return {}
    rating_by_rank = {1: 25, 2: 10, 3: -5, 4: -15}
    changes = {}
    async with DB_LOCK:
        for player in room.get("players", []):
            if player.get("is_bot") or player.get("rank") is None:
                continue
            rank = int(player["rank"])
            delta = rating_by_rank.get(rank, 0)
            wins = 1 if rank == 1 else 0
            db.execute(
                "UPDATE users SET games=games+1, wins=wins+?, rating=rating+? WHERE user_id=?",
                (wins, delta, str(player["user_id"]))
            )
            changes[str(player["user_id"])] = {"rank": rank, "rating_delta": delta, "win": bool(wins)}
        db.commit()
    room["results_recorded"] = True
    await save_room_db(room)
    return changes


def get_room_member(room, user_id):
    """Return a seated player or an authenticated spectator, never a bot socket."""
    uid = str(user_id)
    seated = next((
        p for p in room.get("players", [])
        if str(p.get("user_id")) == uid and not p.get("left")
    ), None)
    if seated:
        return seated
    return room.get("spectators", {}).get(uid)


def can_control_game(room, user_id, websocket):
    """Only the user's live seated socket may control dice or pieces."""
    uid = str(user_id)
    player = next((
        p for p in room.get("players", [])
        if str(p.get("user_id")) == uid and not p.get("left")
    ), None)
    if not player or player.get("is_bot"):
        return None
    if room.get("sockets", {}).get(uid) is not websocket:
        return None
    if player.get("finished"):
        if room.get("game_mode") != "TEAM":
            return None
        teammate = next((
            p for p in room.get("players", [])
            if p.get("team") == player.get("team")
            and p.get("color") != player.get("color")
            and not p.get("finished") and not p.get("left")
        ), None)
        if not teammate:
            return None
    return player

def arm_turn_timer(room):
    room["turn_gen"] += 1
    gen = room["turn_gen"]
    t_sec = 15 if room["game_mode"] == "BLITZ" else 30

    async def _timeout():
        await asyncio.sleep(t_sec + 1)
        async with ROOM_LOCKS[room["code"]]:
            if room["status"] == "PLAYING" and room["turn_gen"] == gen:
                await next_turn(room)

    room["turn_task"] = asyncio.create_task(_timeout())

BOT_ROSTER = [
    ("НАТАЛИ", "natalie"), ("НИКИТА", "nikita"), ("ЛИЛЯ", "lilya-detective"),
    ("ХАСКИ", "husky"), ("СОВА", "owl"), ("ЕНОТ", "raccoon"),
    ("POISON", "poison"), ("ЭЛЬВИНА", "elvina")
]

def fill_bot_seats(room):
    """Fill all empty seats with in-game AI players; no extra Telegram bots are needed."""
    used = {p["color"] for p in room["players"]}
    seat = 0
    while len(room["players"]) < 4:
        color = next((c for c in COLORS if c not in used), None)
        if not color:
            break
        name, skin = BOT_ROSTER[seat % len(BOT_ROSTER)]
        bot_id = f"bot_{room['code']}_{seat + 1}"
        room["players"].append({
            "user_id": bot_id, "name": name, "photo_url": "", "color": color,
            "team": "A" if color in ("red", "yellow") else "B",
            "skin": skin, "is_bot": True, "vip": False,
            "missed_turns": 0, "rank": None, "left": False, "finished": False, "opening_roll_completed": True
        })
        used.add(color)
        seat += 1

def bot_legal_pieces(room, color, dice):
    return [
        index for index, pos in enumerate(room["board_state"][color])
        if (pos == -1 and dice == 6) or (0 <= pos <= 56 and pos + dice <= 56)
    ]

def choose_bot_piece(room, color, legal_pieces, dice, bot):
    """Use a measured strategy: progress, safe squares, captures and exposure risk."""
    board = room["board_state"]
    best_index, best_score = legal_pieces[0], float("-inf")
    for index in legal_pieces:
        pos = board[color][index]
        new_pos = 0 if pos == -1 and dice == 6 else pos + dice
        if new_pos == 56:
            score = 100000.0
        else:
            global_index = (START_OFFSET[color] + new_pos) % 52
            score = 240.0 + new_pos * 9.0
            if pos == -1:
                score += 300.0
            if global_index in SAFE_GLOBAL:
                score += 115.0

            capture_count = 0
            threatened_count = 0
            if global_index not in SAFE_GLOBAL:
                for enemy_color, positions in board.items():
                    if enemy_color == color:
                        continue
                    enemy = next((p for p in room["players"] if p["color"] == enemy_color), None)
                    if room["game_mode"] == "TEAM" and enemy and enemy.get("team") == bot.get("team"):
                        continue
                    enemy_global_positions = [
                        (START_OFFSET[enemy_color] + enemy_pos) % 52
                        for enemy_pos in positions if 0 <= enemy_pos <= 50
                    ]
                    capture_count += sum(1 for enemy_idx in enemy_global_positions if enemy_idx == global_index)
                    threatened_count += sum(
                        1 for enemy_idx in enemy_global_positions
                        if 1 <= (global_index - enemy_idx) % 52 <= 6
                    )
                score += capture_count * 340.0
                score -= threatened_count * 125.0

        if pos >= 0:
            score += (new_pos - pos) * (7.0 if pos >= 51 else 4.0)
        score += random.random() * 1.5
        if score > best_score:
            best_index, best_score = index, score
    return best_index

async def schedule_turn_actor(room):
    """Start the autonomous action for the active seat once."""
    if room.get("status") != "PLAYING":
        return
    task = room.get("actor_task")
    if task and not task.done():
        return
    player = next((p for p in room["players"] if p["color"] == room["turn"]), None)
    if not player or player.get("finished") or player.get("left"):
        return
    if player.get("is_bot"):
        room["actor_task"] = asyncio.create_task(run_bot_turn(room))
        return
    positions = room["board_state"].get(player["color"], [])
    if room.get("dice") is None and not player.get("opening_roll_completed") and positions and all(pos == -1 for pos in positions):
        room["actor_task"] = asyncio.create_task(auto_roll_until_six(room, player["color"]))
    else:
        arm_turn_timer(room)

async def auto_roll_until_six(room, color):
    """Auto-roll the opening until a six appears, then return control to the player."""
    current = asyncio.current_task()
    try:
        for _ in range(90):
            await asyncio.sleep(0.55)
            async with ROOM_LOCKS[room["code"]]:
                if room.get("status") != "PLAYING" or room.get("turn") != color or room.get("dice") is not None:
                    return
                player = next((p for p in room["players"] if p["color"] == color), None)
                if not player or player.get("is_bot") or player.get("opening_roll_completed") or any(pos != -1 for pos in room["board_state"].get(color, [])):
                    return
                value = random.randint(1, 6)
                room["consecutive_sixes"] = room.get("consecutive_sixes", 0) + 1 if value == 6 else 0
                completed = value == 6
                if completed:
                    player["opening_roll_completed"] = True
                    room["dice"] = 6
                    arm_turn_timer(room)
                await broadcast(room, {
                    "event": "DICE_RESULT", "color": color, "value": value,
                    "board_state": room["board_state"], "auto_start": True,
                    "auto_start_complete": completed
                })
                await save_room_db(room)
                if completed:
                    return
        async with ROOM_LOCKS[room["code"]]:
            if room.get("status") == "PLAYING" and room.get("turn") == color and room.get("dice") is None:
                player = next((p for p in room["players"] if p["color"] == color), None)
                if player:
                    player["opening_roll_completed"] = True
                arm_turn_timer(room)
                await broadcast(room, {"event": "GAME_ERROR", "message": "Автозапуск остановлен. Бросьте кубик вручную."})
    finally:
        if room.get("actor_task") is current:
            room["actor_task"] = None

async def apply_bot_move(room, bot, piece_index):
    color = bot["color"]
    value = room.get("dice")
    if value is None:
        return
    old_pos = room["board_state"][color][piece_index]
    if old_pos == -1 and value == 6:
        new_pos = 0
    elif 0 <= old_pos <= 56 and old_pos + value <= 56:
        new_pos = old_pos + value
    else:
        room["dice"] = None
        room["actor_task"] = None
        await next_turn(room)
        return

    room["board_state"][color][piece_index] = new_pos
    captured_any = False
    if 0 <= new_pos <= 50:
        global_index = (START_OFFSET[color] + new_pos) % 52
        if global_index not in SAFE_GLOBAL:
            for enemy_color, positions in room["board_state"].items():
                if enemy_color == color:
                    continue
                enemy = next((p for p in room["players"] if p["color"] == enemy_color), None)
                if room["game_mode"] == "TEAM" and enemy and enemy.get("team") == bot.get("team"):
                    continue
                for enemy_index, enemy_pos in enumerate(positions):
                    if 0 <= enemy_pos <= 50 and (START_OFFSET[enemy_color] + enemy_pos) % 52 == global_index:
                        positions[enemy_index] = -1
                        captured_any = True

    room["dice"] = None
    await save_room_db(room)
    await broadcast(room, {
        "event": "PIECE_MOVED", "board_state": room["board_state"],
        "move_info": {"color": color, "piece_id": piece_index, "from": old_pos, "to": new_pos, "is_bot": True}
    })

    just_finished = all(pos == 56 for pos in room["board_state"][color]) and not bot.get("finished")
    if just_finished:
        assign_finish_rank(room, bot)
        if room["game_mode"] == "TEAM":
            team_done = all(p.get("finished") or p.get("left") for p in room["players"] if p.get("team") == bot.get("team"))
            if team_done:
                room["status"] = "FINISHED"
                room["actor_task"] = None
                rating_changes = await record_match_results(room)
                await broadcast(room, {"event": "GAME_OVER", "players": room["players"], "rating_changes": rating_changes})
                await sync_tg_message(room)
                return
        elif standard_match_complete(room):
            room["status"] = "FINISHED"
            room["actor_task"] = None
            rating_changes = await record_match_results(room)
            await broadcast(room, {"event": "GAME_OVER", "players": room["players"], "rating_changes": rating_changes})
            await sync_tg_message(room)
            return
        elif room["game_mode"] != "TEAM":
            room["actor_task"] = None
            await next_turn(room)
            return

    if value == 6 or new_pos == 56 or captured_any:
        active_p = next((p for p in room["players"] if p["color"] == room["turn"]), bot)
        await broadcast(room, {
            "event": "TURN_CHANGED", "active_color": room["turn"], "active_user_id": active_p["user_id"],
            "board_state": room["board_state"], "players": room["players"],
            "timer": 15 if room["game_mode"] == "BLITZ" else 30
        })
        room["actor_task"] = None
        await schedule_turn_actor(room)
    else:
        room["actor_task"] = None
        await next_turn(room)

async def run_bot_turn(room):
    current = asyncio.current_task()
    try:
        for _ in range(12):
            await asyncio.sleep(random.uniform(1.15, 1.65))
            async with ROOM_LOCKS[room["code"]]:
                if room.get("status") != "PLAYING":
                    return
                bot = next((p for p in room["players"] if p["color"] == room["turn"]), None)
                if not bot or not bot.get("is_bot") or room.get("dice") is not None:
                    return
                value = random.randint(1, 6)
                room["consecutive_sixes"] = room.get("consecutive_sixes", 0) + 1 if value == 6 else 0
                if room["consecutive_sixes"] >= 3:
                    room["consecutive_sixes"] = 0
                    await broadcast(room, {
                        "event": "DICE_RESULT", "color": bot["color"], "value": value,
                        "board_state": room["board_state"], "is_bot": True
                    })
                    room["actor_task"] = None
                    await next_turn(room)
                    return
                room["dice"] = value
                legal = bot_legal_pieces(room, bot["color"], value)
                await broadcast(room, {
                    "event": "DICE_RESULT", "color": bot["color"], "value": value,
                    "board_state": room["board_state"], "is_bot": True,
                    "auto_start": all(pos == -1 for pos in room["board_state"][bot["color"]])
                })
                await save_room_db(room)
                if not legal:
                    room["dice"] = None
                    if value == 6:
                        continue
                    room["actor_task"] = None
                    await next_turn(room)
                    return
                piece_index = choose_bot_piece(room, bot["color"], legal, value, bot)

            await asyncio.sleep(random.uniform(0.65, 0.9))
            async with ROOM_LOCKS[room["code"]]:
                if room.get("status") != "PLAYING" or room.get("turn") != bot["color"] or room.get("dice") != value:
                    return
                await apply_bot_move(room, bot, piece_index)
                return

        async with ROOM_LOCKS[room["code"]]:
            if room.get("status") == "PLAYING":
                room["actor_task"] = None
                await next_turn(room)
    finally:
        if room.get("actor_task") is current:
            room["actor_task"] = None

async def begin_match(room):
    if room["status"] != "WAITING" or not room["players"]:
        return
    fill_bot_seats(room)
    room["start_task"] = None
    room["status"] = "PLAYING"
    room["lobby_deadline"] = None
    room["turn"] = room["players"][0]["color"]
    room["consecutive_sixes"] = 0
    room["dice"] = None
    active_p = room["players"][0]
    t_sec = 15 if room["game_mode"] == "BLITZ" else 30
    await save_room_db(room)
    await broadcast(room, {
        "event": "GAME_STARTED", "status": "PLAYING", "game_mode": room["game_mode"],
        "board_state": room["board_state"], "players": room["players"],
        "spectators": list(room.get("spectators", {}).values()),
        "turn": room["turn"], "active_user_id": active_p["user_id"],
        "dice": room.get("dice"), "timer": t_sec
    })
    # Board and bot/player turn logic are live before the Telegram group edit.
    await schedule_turn_actor(room)
    try:
        await asyncio.wait_for(sync_tg_message(room), timeout=4.5)
    except asyncio.TimeoutError:
        print(f"[GAME_START_SYNC_TIMEOUT] room={room.get('code')}")

async def start_waiting_room(room, actor_id, source="miniapp", websocket=None):
    """One authoritative start path for Telegram group and Mini App buttons."""
    code = room["code"]
    lock = ROOM_LOCKS.setdefault(code, asyncio.Lock())
    actor_id = str(actor_id)
    async with lock:
        if room.get("status") != "WAITING":
            return False, "Игра уже началась или комната закрыта."
        if not room.get("players"):
            return False, "Сначала нажмите «Присоединиться»."
        seated = any(str(p.get("user_id")) == actor_id for p in room["players"])
        if not seated:
            return False, "Сначала присоединитесь к комнате."
        if websocket is not None:
            room.setdefault("sockets", {})[actor_id] = websocket
            try:
                await websocket.send_json({"event": "STARTING", "message": "Запускаем игру и добавляем ботов…"})
            except Exception:
                pass
        task = room.get("start_task")
        if task and not task.done() and task is not asyncio.current_task():
            task.cancel()
        room["start_task"] = None
        try:
            await begin_match(room)
        except Exception as exc:
            print(f"[GAME_START_ERROR] room={code} source={source} actor={actor_id} error={type(exc).__name__}: {exc}")
            return False, "Не удалось запустить игру. Попробуйте ещё раз."
        if room.get("status") != "PLAYING":
            return False, "Игра не запустилась. Проверьте состав игроков."
        print(f"[GAME_START_OK] room={code} source={source} actor={actor_id} players={len(room['players'])}")
        return True, "Игра началась!"

async def schedule_autostart(room):
    current = asyncio.current_task()
    try:
        deadline = room.get("lobby_deadline") or (time.time() + 15)
        await asyncio.sleep(max(0, deadline - time.time()))
        async with ROOM_LOCKS[room["code"]]:
            # A match starts only after at least two real players have joined.
            if room["status"] == "WAITING" and len(room.get("players", [])) >= 2:
                await begin_match(room)
    finally:
        if room.get("start_task") is current:
            room["start_task"] = None

def ensure_lobby_timer(room):
    # No visible "Start" stage: one player waits; the second starts a
    # 15-second countdown; four players start the match immediately.
    if room.get("status") != "WAITING":
        return
    task = room.get("start_task")
    if len(room.get("players", [])) < 2:
        room["lobby_deadline"] = None
        if task and not task.done():
            task.cancel()
        room["start_task"] = None
        return
    if task is None or task.done():
        room["lobby_deadline"] = time.time() + 15
        room["start_task"] = asyncio.create_task(schedule_autostart(room))

async def next_turn(room):
    old_timer = room.get("turn_task")
    if old_timer and old_timer is not asyncio.current_task() and not old_timer.done():
        old_timer.cancel()
    room["turn_task"] = None
    room["turn_gen"] = room.get("turn_gen", 0) + 1
    room["dice"] = None
    room["consecutive_sixes"] = 0
    current_index = COLORS.index(room["turn"]) if room.get("turn") in COLORS else -1
    active_p = None
    for offset in range(1, len(COLORS) + 1):
        candidate_color = COLORS[(current_index + offset) % len(COLORS)]
        candidate = next((
            p for p in room["players"]
            if p["color"] == candidate_color and not p.get("finished") and not p.get("left")
        ), None)
        if candidate:
            active_p = candidate
            break
    if not active_p:
        return
    room["turn"] = active_p["color"]
    t_sec = 15 if room["game_mode"] == "BLITZ" else 30
    await save_room_db(room)
    await broadcast(room, {
        "event": "TURN_CHANGED", "active_color": room["turn"], "active_user_id": active_p["user_id"],
        "board_state": room["board_state"], "players": room["players"],
        "spectators": list(room.get("spectators", {}).values()), "timer": t_sec
    })
    await sync_tg_message(room)
    await schedule_turn_actor(room)

# ─── Telegram-бот ───
bot = Bot(token=BOT_TOKEN) if BOT_TOKEN != BOT_TOKEN_PLACEHOLDER else None
dp = Dispatcher()
BOT_USERNAME = os.getenv("BOT_USERNAME", "Ludo_optimist_bot").lstrip("@").casefold()


def command_targets_this_bot(message: types.Message) -> bool:
    """Avoid reacting to group commands intended for another bot or nobody."""
    text_value = str(message.text or "").strip()
    token = text_value.split(maxsplit=1)[0] if text_value else ""
    if "@" in token:
        target = token.rsplit("@", 1)[1].casefold()
        return target == BOT_USERNAME
    return getattr(message.chat, "type", "private") == "private"

@dp.message(CommandStart())
async def cmd_start(message: types.Message):
    if not command_targets_this_bot(message):
        return
    await send_start_menu(message)


@dp.message(Command("help"))
async def cmd_help(message: types.Message):
    if not command_targets_this_bot(message):
        return
    help_text = (
        "🎲 **OPTIMIST LUDO — помощь**\\n\\n"
        "🎮 **Начать игру**\\n"
        "• В личном чате: /start или /game — выбрать режим и создать партию.\\n"
        "• В группе: /game@Ludo_optimist_bot — создать стол.\\n"
        "• Подключайтесь по кнопке «Открыть игру» прямо из сообщения группы.\\n\\n"
        "👥 **Подключиться к игре**\\n"
        "Нажмите ссылку-приглашение от создателя и откройте игру через кнопку бота.\\n\\n"
        "🎭 **Персонажи и доски**\\n"
        "В меню выберите «Мои персонажи и доски», чтобы открыть профиль.\\n\\n"
        "🎙️ **Голосовые и чат**\\n"
        "Откройте чат в игре. Для голосового сообщения удерживайте кнопку микрофона и отпустите, чтобы отправить.\\n\\n"
        "Если игра не открывается, отправьте /start и нажмите кнопку запуска ещё раз."
    )
    await message.answer(help_text, parse_mode="Markdown")


@dp.message(Command("game", "play", "ludo"))
async def cmd_game(message: types.Message):
    if not command_targets_this_bot(message):
        return
    await send_start_menu(message)


async def send_start_menu(message: types.Message):
    # A group invite is opened in the private bot chat first. Telegram supplies
    # signed WebApp initData only when the WebApp is launched from this button.
    parts = (message.text or "").split(maxsplit=1)
    payload = parts[1].strip() if len(parts) > 1 else ""
    if payload == "cabinet":
        kb = InlineKeyboardMarkup(inline_keyboard=[[
            InlineKeyboardButton(text="🎭 Открыть профиль и персонажей", web_app=WebAppInfo(url=f"{WEBAPP_URL}/cabinet"))
        ]])
        await message.answer("Профиль Optimist Ludo — выберите персонажа, любимый цвет и тему доски.", reply_markup=kb)
        return
    if payload.startswith("join_"):
        room_path = payload[5:].upper()
        code = room_path.split("_", 1)[0]
        room = ROOMS.get(code) or restore_room_from_db(code)
        if not room or room.get("status") not in ("WAITING", "PLAYING"):
            await message.answer("Эта игровая комната уже недоступна. Попросите друга создать новую.")
            return
        if message.chat.type != "private":
            await message.answer("Чтобы войти в игру, откройте личный чат с @Ludo_optimist_bot.")
            return
        join_url = f"{WEBAPP_URL}/room/{room_path}"
        kb = InlineKeyboardMarkup(inline_keyboard=[[
            InlineKeyboardButton(text="🎲 Открыть игру и присоединиться", web_app=WebAppInfo(url=join_url))
        ]])
        await message.answer(
            f"Комната **{code}** найдена. Нажмите кнопку ниже — так Telegram передаст данные для безопасного входа.",
            reply_markup=kb,
            parse_mode="Markdown"
        )
        return

    kb = InlineKeyboardMarkup(inline_keyboard=[
        [
            InlineKeyboardButton(text="🎲 Стандарт", callback_data="new_STANDARD"),
            InlineKeyboardButton(text="🤝 Команда 2×2", callback_data="new_TEAM")
        ],
        [
            InlineKeyboardButton(text="⚡ Быстрая (2 фишки)", callback_data="new_QUICK"),
            InlineKeyboardButton(text="🔥 Блиц (15 сек)", callback_data="new_BLITZ")
        ],
        [InlineKeyboardButton(text="🎭 Мои персонажи и доски", url=f"https://t.me/Ludo_optimist_bot?start=cabinet")]
    ])
    await message.answer(
        "🎲 **Optimist Ludo**\nВыберите режим игры для этого чата:",
        reply_markup=kb,
        parse_mode="Markdown"
    )

@dp.callback_query(F.data.startswith("new_"))
async def cb_new_game(call: types.CallbackQuery):
    mode = call.data.split("_", 1)[1]
    code = gen_code()
    room = await create_room_state(code, mode, chat_id=call.message.chat.id, msg_id=call.message.message_id, creator_user_id=call.from_user.id)
    await call.message.edit_text(
        render_tg_lobby_text(room),
        reply_markup=render_tg_lobby_kb(room),
        parse_mode="Markdown"
    )
    await call.answer("Комната создана. Отправьте друзьям кнопку «Присоединиться к игре».")

@dp.callback_query(F.data.startswith("join_"))
async def cb_join_game(call: types.CallbackQuery):
    code = call.data.split("_", 1)[1].upper()
    room = ROOMS.get(code) or restore_room_from_db(code)
    if not room or room.get("status") != "WAITING":
        await call.answer("Комната уже закрыта или игра началась.", show_alert=True)
        return
    uid = str(call.from_user.id)
    async with ROOM_LOCKS[code]:
        if room.get("status") != "WAITING":
            await call.answer("Регистрация закрыта.", show_alert=True)
            return
        existing = next((p for p in room["players"] if str(p.get("user_id")) == uid), None)
        if existing:
            ensure_lobby_timer(room)
            await sync_tg_message(room)
            await call.answer("Ты уже за столом.")
            return
        if len(room["players"]) >= 4:
            await call.answer("Все места уже заняты.", show_alert=True)
            return
        # aiogram User has no photo_url attribute. Reuse the profile photo
        # already stored from signed Mini App initData instead.
        profile = await get_user(
            uid,
            call.from_user.first_name or "Игрок",
            ""
        )
        taken = {p["color"] for p in room["players"]}
        if room["game_mode"] == "TEAM":
            team = "A" if len(room["players"]) % 2 == 0 else "B"
            pool = ["red", "yellow"] if team == "A" else ["green", "blue"]
            color = next((c for c in pool if c not in taken), None)
        else:
            team = None
            fav = profile.get("fav_color")
            color = fav if fav in COLORS and fav not in taken else None
        if not color:
            color = next((c for c in COLORS if c not in taken), None)
        if not color:
            await call.answer("Свободных цветов нет.", show_alert=True)
            return
        room["players"].append({
            "user_id": uid,
            "name": profile["name"],
            "photo_url": profile["photo_url"],
            "color": color,
            "team": team or ("A" if color in ("red", "yellow") else "B"),
            "skin": profile["skin"],
            "opening_roll_completed": False,
            "vip": True,
            "missed_turns": 0,
            "rank": None,
            "left": False
        })
        if room["game_mode"] == "QUICK":
            room["board_state"][color] = [-1, -1]
        elif room["game_mode"] == "BLITZ":
            room["board_state"][color] = [0, -1, -1, -1]
        ensure_lobby_timer(room)
        await sync_tg_message(room)
        await broadcast(room, {
            "event": "ROOM_STATE",
            "status": "WAITING",
            "game_mode": room["game_mode"],
            "players": room["players"],
            "lobby_deadline": room.get("lobby_deadline"),
            "creator_user_id": room.get("creator_user_id")
        })
        if len(room["players"]) >= 4:
            task = room.get("start_task")
            if task and not task.done():
                task.cancel()
            room["start_task"] = None
            await begin_match(room)
    await call.answer("Ты за столом!")


@dp.callback_query(F.data.startswith("start_"))
async def cb_start_game(call: types.CallbackQuery):
    code = call.data.split("_", 1)[1].upper()
    room = ROOMS.get(code) or restore_room_from_db(code)
    if not room:
        await call.answer("Комната не найдена.", show_alert=True)
        return
    # Acknowledge immediately; do not leave Telegram's callback spinner running
    # while network synchronization or AI initialization happens.
    await call.answer("⏳ Запускаю игру…")
    ok, message = await start_waiting_room(room, call.from_user.id, source="telegram_group")
    if not ok:
        await call.message.answer(f"⚠️ {message}")
        return
    # begin_match -> sync_tg_message already edits the original lobby message
    # and replaces its buttons with a single "Войти в игру" link.


@dp.my_chat_member()
async def on_bot_membership_changed(event: types.ChatMemberUpdated):
    old_status = event.old_chat_member.status
    new_status = event.new_chat_member.status
    chat = event.chat
    if chat.type not in ("group", "supergroup"):
        return

    # Bot was added to a group: explain setup and whether admin rights are present.
    if new_status in ("member", "administrator") and old_status in ("left", "kicked"):
        is_admin = new_status == "administrator"
        message = (
            "🎲 **Optimist Ludo добавлен в группу!**\\n\\n"
            "Базовая игра, создание комнат и подключение игроков работают без прав администратора. "
            "Для запуска отправьте /game и выберите режим.\\n\\n"
            + ("✅ Бот уже администратор группы." if is_admin else
               "ℹ️ Сейчас бот не администратор. Это не мешает игре. Если хотите выдать ему права, "
               "откройте настройки группы → Администраторы → Добавить администратора → Optimist Ludo. "
               "Не выдавайте право добавлять новых администраторов.")
        )
        try:
            await event.bot.send_message(chat.id, message, parse_mode="Markdown")
        except Exception as exc:
            print(f"[BOT_ADDED_NOTICE] chat={chat.id} error={exc}")
        return

    # Bot was promoted later.
    if new_status == "administrator" and old_status != "administrator":
        try:
            await event.bot.send_message(
                chat.id,
                "✅ **Права администратора получены.**\\n"
                "Теперь можно создавать комнаты командой /game. "
                "Для обычной партии дополнительных разрешений не требуется.",
                parse_mode="Markdown"
            )
        except Exception as exc:
            print(f"[BOT_ADMIN_NOTICE] chat={chat.id} error={exc}")

# ─── FastAPI Сервер ───
@asynccontextmanager
async def lifespan(app: FastAPI):
    if APP_ENV == "production" and BOT_TOKEN == BOT_TOKEN_PLACEHOLDER:
        raise RuntimeError("BOT_TOKEN must be configured in production")
    if bot is not None:
        try:
            await bot.set_my_commands([
                types.BotCommand(command="start", description="Открыть Optimist Ludo"),
                types.BotCommand(command="game", description="Создать игру"),
                types.BotCommand(command="help", description="Помощь и правила"),
            ], scope=types.BotCommandScopeAllPrivateChats())
            await bot.set_my_commands([
                types.BotCommand(command="game", description="Создать игру"),
                types.BotCommand(command="help", description="Помощь и правила"),
            ], scope=types.BotCommandScopeAllGroupChats())
        except Exception as exc:
            print(f"[BOT_COMMANDS] Не удалось обновить меню команд: {exc}")
    task = asyncio.create_task(dp.start_polling(bot)) if bot is not None else None
    try:
        yield
    finally:
        if task:
            task.cancel()
            try:
                await task
            except asyncio.CancelledError:
                pass
        if bot is not None:
            await bot.session.close()
        db.close()

app = FastAPI(lifespan=lifespan)
app.mount("/static", StaticFiles(directory="static"), name="static")

@app.get("/healthz", include_in_schema=False)
async def healthz():
    try:
        db.execute("SELECT 1").fetchone()
    except Exception:
        raise HTTPException(status_code=503, detail="Database unavailable")
    return {"status": "ok"}


def _voice_session(request: Request, room_code: str):
    token = request.headers.get("x-room-session", "")
    session = VOICE_SESSIONS.get(token)
    if not session or session.get("room_code") != room_code:
        raise HTTPException(status_code=401, detail="Голосовая сессия устарела. Переподключись к игре.")
    room = ROOMS.get(room_code) or restore_room_from_db(room_code)
    if not room:
        raise HTTPException(status_code=404, detail="Игровая комната не найдена.")
    user_id = str(session["user_id"])
    if user_id not in room.get("sockets", {}):
        raise HTTPException(status_code=403, detail="Голосовой доступ доступен только подключённым к комнате.")
    member = get_room_member(room, user_id)
    if not member:
        raise HTTPException(status_code=403, detail="Не удалось определить участника комнаты.")
    return session, room, member


def _prune_voice_files():
    now = time.time()
    for voice_id, item in list(VOICE_FILES.items()):
        if now - item["created_at"] > VOICE_TTL_SECONDS:
            VOICE_FILES.pop(voice_id, None)


@app.post("/api/rooms/{room_code}/voice")
async def upload_room_voice(room_code: str, request: Request):
    code = normalize_room_code(room_code)
    if not code or "_" in code:
        raise HTTPException(status_code=404, detail="Игровая комната не найдена.")
    session, room, player = _voice_session(request, code)
    mime_type = request.headers.get("content-type", "").split(";", 1)[0].strip().lower()
    if mime_type not in VOICE_MIME_TYPES:
        raise HTTPException(status_code=415, detail="Поддерживаются WebM, OGG и MP4.")
    try:
        duration_seconds = int(request.headers.get("x-voice-duration", "0"))
    except (TypeError, ValueError):
        duration_seconds = 0
    if not 1 <= duration_seconds <= VOICE_MAX_DURATION_SECONDS:
        raise HTTPException(status_code=400, detail="Длительность голосового должна быть от 1 до 30 секунд.")
    try:
        declared_size = int(request.headers.get("content-length", "0"))
    except (TypeError, ValueError):
        declared_size = 0
    if declared_size > VOICE_MAX_BYTES:
        raise HTTPException(status_code=413, detail="Голосовое слишком большое. Запиши его короче.")
    chunks, total = [], 0
    async for chunk in request.stream():
        total += len(chunk)
        if total > VOICE_MAX_BYTES:
            raise HTTPException(status_code=413, detail="Голосовое слишком большое. Запиши его короче.")
        chunks.append(chunk)
    audio_bytes = b"".join(chunks)
    if len(audio_bytes) < 256:
        raise HTTPException(status_code=400, detail="Запись пустая или слишком короткая.")
    _prune_voice_files()
    stored_bytes = sum(len(item["data"]) for item in VOICE_FILES.values())
    while len(VOICE_FILES) >= VOICE_MAX_FILES or stored_bytes + len(audio_bytes) > VOICE_MAX_TOTAL_BYTES:
        oldest_id = min(VOICE_FILES, key=lambda key: VOICE_FILES[key]["created_at"], default=None)
        if oldest_id is None:
            break
        removed = VOICE_FILES.pop(oldest_id)
        stored_bytes -= len(removed["data"])
    if stored_bytes + len(audio_bytes) > VOICE_MAX_TOTAL_BYTES:
        raise HTTPException(status_code=503, detail="Временное хранилище голосовых заполнено. Попробуй позже.")

    voice_id = secrets.token_hex(16)
    VOICE_FILES[voice_id] = {
        "room_code": code,
        "mime_type": mime_type,
        "data": audio_bytes,
        "created_at": time.time()
    }
    message = {
        "user_id": str(session["user_id"]),
        "name": player.get("name", "Игрок"),
        "color": player.get("color", ""),
        "voice_id": voice_id,
        "mime_type": mime_type,
        "duration_seconds": duration_seconds
    }
    await broadcast(room, {"event": "NEW_VOICE_MESSAGE", "message": message})
    return JSONResponse({"voice_id": voice_id}, status_code=201)


@app.get("/api/rooms/{room_code}/voice/{voice_id}")
async def get_room_voice(room_code: str, voice_id: str, request: Request):
    code = normalize_room_code(room_code)
    if not code or "_" in code or not re.fullmatch(r"[a-f0-9]{32}", voice_id):
        raise HTTPException(status_code=404, detail="Голосовое сообщение не найдено.")
    _session, _room, _player = _voice_session(request, code)
    _prune_voice_files()
    item = VOICE_FILES.get(voice_id)
    if not item or item["room_code"] != code:
        raise HTTPException(status_code=404, detail="Голосовое сообщение уже недоступно.")
    return Response(
        content=item["data"],
        media_type=item["mime_type"],
        headers={
            "Content-Disposition": "inline",
            "Cache-Control": "private, no-store",
            "X-Content-Type-Options": "nosniff"
        }
    )


def normalize_room_code(raw_code: str) -> str:
    code = str(raw_code or "").strip().upper()
    if code.startswith("JOIN_"):
        code = code[5:]
    if code.startswith("ROOM_"):
        code = code[5:]
    if not code:
        return ""
    parts = code.split("_")
    base = parts[0]
    if len(base) != 6 or not all(ch in string.ascii_uppercase + string.digits for ch in base):
        raise ValueError("Invalid room code")
    if len(parts) == 2 and parts[1] in ("A", "B"):
        return code
    if len(parts) == 1:
        return base
    raise ValueError("Invalid room suffix")

def render_game_page_html(room_code: str = "") -> str:
    """Render index.html with a trusted room code embedded by the server."""
    page_path = os.path.join(os.path.dirname(__file__), "index.html")
    with open(page_path, "r", encoding="utf-8") as page:
        html = page.read()
    marker = 'window.__LUDO_SERVER_ROOM_CODE__ = "";'
    if marker not in html:
        raise RuntimeError("Room-code injection marker is missing from index.html")
    return html.replace(marker, f"window.__LUDO_SERVER_ROOM_CODE__ = {json.dumps(room_code)};", 1)

@app.get("/")
@app.get("/room/{room_code}")
async def game_page(request: Request, room_code: str = ""):
    raw_code = room_code or (
        request.query_params.get("room_code")
        or request.query_params.get("room")
        or request.query_params.get("tgWebAppStartParam")
        or request.query_params.get("startapp")
        or request.query_params.get("start_param")
        or ""
    )
    try:
        code = normalize_room_code(raw_code)
    except ValueError:
        return HTMLResponse("Invalid room code", status_code=400)
    return HTMLResponse(render_game_page_html(code))

@app.get("/cabinet")
async def cabinet_page():
    with open("cabinet.html", "r", encoding="utf-8") as f:
        return HTMLResponse(f.read())

@app.post("/api/game/create")
@app.get("/api/game/create")  # legacy compatibility
async def api_game_create(request: Request, mode: str = "STANDARD", init_data: str = ""):
    init_data = request.headers.get("X-Telegram-Init-Data", "") or init_data
    resolve_webapp_identity(init_data, name="Optimist")
    mode = str(mode or "STANDARD").upper()
    if mode not in MODE_NAMES:
        raise HTTPException(status_code=400, detail="Unsupported game mode")
    code = gen_code()
    while code in ROOMS:
        code = gen_code()
    await create_room_state(code, mode)
    base_url = WEBAPP_URL
    if not base_url or "твой-домен.ru" in base_url or "your-domain.com" in base_url:
        base_url = str(request.base_url).rstrip("/")
    return {"code": code, "join_url": f"{base_url}/room/{code}"}


@app.get("/api/me")
async def api_me(init_data: str = "", user_id: str = "", name: str = "Игрок"):
    identity = resolve_webapp_identity(init_data, user_id=user_id, name=name)
    uid = identity["id"]
    name = identity["first_name"]
    photo_url = identity["photo_url"]
    u = await get_user(uid, name, photo_url)
    win_rate = round((u["wins"] / u["games"]) * 100) if u["games"] > 0 else 0
    return {
        "name": u["name"], "photo_url": u["photo_url"], "rating": u["rating"], "games": u["games"],
        "wins": u["wins"], "win_rate": win_rate, "best_streak": u["best_streak"],
        "prefs": {"skin": u["skin"], "board_theme": u["board_theme"], "fav_color": u["fav_color"]}
    }

@app.post("/api/prefs")
async def api_prefs(req: Request):
    data = await req.json()
    init_data = str(data.get("init_data", "") or "")
    identity = resolve_webapp_identity(init_data, user_id=str(data.get("user_id", "") or ""),
                                        name=str(data.get("name", "Игрок") or "Игрок"))
    uid = identity["id"]
    await get_user(uid)
    async with DB_LOCK:
        if "skin" in data and data["skin"] in [
            "optimist", "elvina", "cat", "husky", "ksyusha", "lena",
            "lilya-detective", "natalie", "nikita", "owl", "poison", "raccoon"
        ]:
            db.execute("UPDATE users SET skin=? WHERE user_id=?", (data["skin"], uid))
        if "board_theme" in data and data["board_theme"] in ["neon", "royal"]:
            db.execute("UPDATE users SET board_theme=? WHERE user_id=?", (data["board_theme"], uid))
        if "fav_color" in data and data["fav_color"] in [None, "green", "yellow", "blue", "red"]:
            db.execute("UPDATE users SET fav_color=? WHERE user_id=?", (data["fav_color"] or "", uid))
        db.commit()
    return {"ok": True}

@app.websocket("/ws/{room_code}")
async def ws_endpoint(websocket: WebSocket, room_code: str):
    await websocket.accept()
    base_code = room_code.split("_")[0]
    if not (1 <= len(base_code) <= 10 and all(c in string.ascii_uppercase + string.digits for c in base_code)):
        await websocket.close(code=1008)
        return
    room = ROOMS.get(base_code)
    if room is None:
        # Recover a room persisted by the Telegram bot if this worker's in-memory
        # cache does not contain it. Never silently create a new empty 0/4 room.
        async with DB_LOCK:
            row = db.execute("SELECT state_json FROM rooms WHERE code=?", (base_code,)).fetchone()
        if row:
            try:
                room = json.loads(row[0])
                room["sockets"] = {}
                room["start_task"] = None
                room["turn_task"] = None
                room["turn_gen"] = int(room.get("turn_gen", 0))
                room["actor_task"] = None
                room.setdefault("creator_user_id", None)
                ROOMS[base_code] = room
                ROOM_LOCKS.setdefault(base_code, asyncio.Lock())
            except (TypeError, ValueError, json.JSONDecodeError):
                room = None
    if room is None:
        await websocket.send_json({
            "event": "ROOM_NOT_FOUND",
            "message": "Комната не найдена. Вернитесь в группу и нажмите «Войти в игру» ещё раз."
        })
        await websocket.close(code=4404)
        return

    uid = None
    voice_session_token = None
    await websocket.send_json({
        "event": "CONNECTION_ESTABLISHED",
        "status": room.get("status", "WAITING"),
        "players": room.get("players", []),
        "game_mode": room.get("game_mode", "STANDARD")
    })

    try:
        while True:
            data = await websocket.receive_json()
            act = data.get("action")

            if act in ("START_GAME", "START_WITH_BOTS") and not uid:
                try:
                    identity = resolve_webapp_identity(
                        str(data.get("init_data", "") or ""),
                        user_id=str(data.get("user_id", "") or ""),
                        name=str(data.get("name", "Player") or "Player"),
                        photo_url=str(data.get("photo_url", "") or "")
                    )
                    uid = identity["id"]
                except HTTPException:
                    await websocket.send_json({"event": "AUTH_ERROR", "message": "Telegram authentication failed. Reopen the game from the group button."})
                    continue

            if act not in ("PING", "JOIN_GAME") and not uid:
                await websocket.send_json({"event": "AUTH_ERROR", "message": "Join the game first"})
                continue

            if act == "PING":
                await websocket.send_json({"event": "PONG"})

            elif act == "JOIN_GAME":
                init_data = str(data.get("init_data", "") or "")
                try:
                    identity = resolve_webapp_identity(init_data, user_id=str(data.get("user_id", "") or ""),
                                                        name=str(data.get("name", "Optimist") or "Optimist"),
                                                        photo_url=str(data.get("photo_url", "") or ""))
                except HTTPException:
                    await websocket.send_json({"event": "AUTH_ERROR", "message": "Telegram authentication failed"})
                    await websocket.close(code=4403)
                    return
                uid = identity["id"]
                name = identity["first_name"]
                photo_url = identity["photo_url"]
                team = data.get("team")
                u = await get_user(uid, name, photo_url)
                requested_skin = str(data.get("skin", "") or "").strip().lower()
                if requested_skin in CHARACTER_IDS:
                    async with DB_LOCK:
                        db.execute("UPDATE users SET skin=? WHERE user_id=?", (requested_skin, uid))
                        db.commit()
                    u["skin"] = requested_skin
                
                async with ROOM_LOCKS[room["code"]]:
                    room.setdefault("spectators", {})
                    room["sockets"][uid] = websocket

                    # Бесплатно разрешаем чат, темы и 4 набора стикеров всем
                    await websocket.send_json({"event": "CHAT_PERM", "can_write": True})
                    await websocket.send_json({"event": "STICKER_PACKS", "packs": ["obsidian", "gold", "gem", "crown"]})
                    await websocket.send_json({"event": "BOARD_THEME", "theme": u["board_theme"]})
                    voice_ice = build_voice_ice_servers(uid)
                    if voice_ice:
                        await websocket.send_json({"event": "VOICE_CONFIG", "ice": voice_ice})

                    existing = next((p for p in room["players"] if p["user_id"] == uid), None)
                    if existing:
                        existing["name"] = u["name"]
                        existing["photo_url"] = u["photo_url"]
                        existing["skin"] = u["skin"]
                        existing.setdefault("opening_roll_completed", False)
                        existing["left"] = False
                    elif room["status"] == "WAITING" and len(room["players"]) < 4:
                        taken = {p["color"] for p in room["players"]}
                        if room["game_mode"] == "TEAM":
                            pool = ["red", "yellow"] if team == "A" else ["green", "blue"]
                            avail = [c for c in pool if c not in taken]
                            color = avail[0] if avail else next(c for c in COLORS if c not in taken)
                        else:
                            fav = u["fav_color"]
                            color = fav if (fav in COLORS and fav not in taken) else next(c for c in COLORS if c not in taken)

                        room["players"].append({
                            "user_id": uid,
                            "name": u["name"],
                            "photo_url": u["photo_url"],
                            "color": color,
                            "team": team or ("A" if color in ("red", "yellow") else "B"),
                            "skin": u["skin"],
                            "opening_roll_completed": False,
                            "vip": True,  # Оставлено true, чтобы UI не блокировал микрофон в клиенте
                            "missed_turns": 0,
                            "rank": None,
                            "left": False
                        })

                        if room["game_mode"] == "QUICK":
                            room["board_state"][color] = [-1, -1]
                        elif room["game_mode"] == "BLITZ":
                            room["board_state"][color] = [0, -1, -1, -1]

                    seated_now = next((p for p in room["players"] if str(p.get("user_id")) == str(uid)), None)
                    if seated_now:
                        room["spectators"].pop(uid, None)
                    else:
                        room["spectators"][uid] = {
                            "user_id": uid, "name": u["name"], "photo_url": u["photo_url"],
                            "vip": True, "is_spectator": True
                        }

                    if room["status"] == "WAITING":
                        ensure_lobby_timer(room)
                        await sync_tg_message(room)
                        await broadcast(room, {
                            "event": "ROOM_STATE",
                            "status": "WAITING",
                            "game_mode": room["game_mode"],
                            "players": room["players"],
                            "spectators": list(room.get("spectators", {}).values()),
                            "lobby_deadline": room.get("lobby_deadline"),
                            "creator_user_id": room.get("creator_user_id")
                        })
                        if len(room["players"]) >= 4:
                            task = room.get("start_task")
                            if task and not task.done():
                                task.cancel()
                            room["start_task"] = None
                            await begin_match(room)
                    else:
                        active_p = next((p for p in room["players"] if p["color"] == room["turn"]), room["players"][0])
                        await websocket.send_json({
                            "event": "GAME_STARTED",
                            "status": "PLAYING",
                            "game_mode": room["game_mode"],
                            "board_state": room["board_state"],
                            "players": room["players"],
                            "spectators": list(room.get("spectators", {}).values()),
                            "turn": room["turn"],
                            "active_user_id": active_p["user_id"],
                            "dice": room.get("dice"),
                            "timer": 15 if room["game_mode"] == "BLITZ" else 30
                        })
                    # Issue a scoped token after the player identity and room membership are established.
                    if voice_session_token:
                        VOICE_SESSIONS.pop(voice_session_token, None)
                    voice_session_token = secrets.token_hex(32)
                    VOICE_SESSIONS[voice_session_token] = {"user_id": uid, "room_code": room["code"]}
                    await websocket.send_json({"event": "VOICE_SESSION", "token": voice_session_token})
                    await broadcast(room, {
                        "event": "ROOM_MEMBERS",
                        "players": room["players"],
                        "spectators": list(room.get("spectators", {}).values())
                    })

            elif act in ("START_GAME", "START_WITH_BOTS"):
                ok, message = await start_waiting_room(
                    room,
                    uid,
                    source="miniapp_quick_start" if act == "START_WITH_BOTS" else "miniapp_start",
                    websocket=websocket
                )
                if not ok:
                    await websocket.send_json({"event": "GAME_ERROR", "message": message})

            elif act == "LEAVE_GAME":
                if not uid:
                    continue
                async with ROOM_LOCKS[room["code"]]:
                    if room["status"] == "WAITING":
                        room["players"] = [p for p in room["players"] if p["user_id"] != uid]
                        room["sockets"].pop(uid, None)
                        # If fewer than two players remain, cancel the countdown.
                        if len(room["players"]) < 2:
                            task = room.get("start_task")
                            if task and not task.done():
                                task.cancel()
                            room["start_task"] = None
                            room["lobby_deadline"] = None

                        await broadcast(room, {
                            "event": "ROOM_STATE",
                            "status": "WAITING",
                            "game_mode": room["game_mode"],
                            "players": room["players"],
                            "lobby_deadline": room.get("lobby_deadline"),
                            "creator_user_id": room.get("creator_user_id")
                        })
                        if not room["players"]:
                            room["lobby_deadline"] = None
                        await sync_tg_message(room)
                    elif room["status"] == "PLAYING":
                        me = next((p for p in room["players"] if p["user_id"] == uid), None)
                        if me:
                            me["left"] = True
                            assign_finish_rank(room, me)
                            room["board_state"][me["color"]] = [-1] * len(room["board_state"][me["color"]])
                            room["sockets"].pop(uid, None)

                            remaining = [p for p in room["players"] if not p.get("finished") and not p.get("left")]
                            team_done = False
                            if room["game_mode"] == "TEAM":
                                team_done = all(
                                    p.get("finished") or p.get("left")
                                    for p in room["players"] if p.get("team") == me.get("team")
                                )
                            if not remaining or team_done or (room["game_mode"] != "TEAM" and standard_match_complete(room)):
                                room["status"] = "FINISHED"
                                if room.get("turn_task"):
                                    room["turn_task"].cancel()
                                rating_changes = await record_match_results(room)
                                await broadcast(room, {
                                    "event": "GAME_OVER",
                                    "players": room["players"],
                                    "board_state": room["board_state"],
                                    "rating_changes": rating_changes
                                })
                                await sync_tg_message(room)
                            elif room["turn"] == me["color"]:
                                await next_turn(room)
                            else:
                                await save_room_db(room)
                                await broadcast(room, {
                                    "event": "PIECE_MOVED",
                                    "board_state": room["board_state"],
                                    "players": room["players"],
                                    "spectators": list(room.get("spectators", {}).values())
                                })

            elif act == "ROLL_DICE":
                async with ROOM_LOCKS[room["code"]]:
                    me = can_control_game(room, uid, websocket)
                    if not me:
                        await websocket.send_json({"event": "DICE_REJECTED", "message": "Только активный участник партии может бросать кубик."})
                        continue
                    if me["color"] != room["turn"]:
                        await websocket.send_json({"event": "DICE_REJECTED", "message": "Сейчас ход другого игрока."})
                        continue
                    if room["dice"] is not None:
                        await websocket.send_json({"event": "DICE_REJECTED", "message": "Кубик уже брошен. Выберите фишку."})
                        continue
                    # A manual tap can take over from the opening auto-roll helper.
                    if not me.get("opening_roll_completed"):
                        me["opening_roll_completed"] = True
                        opening_task = room.get("actor_task")
                        if opening_task and opening_task is not asyncio.current_task() and not opening_task.done():
                            opening_task.cancel()
                        room["actor_task"] = None
                    val = random.randint(1, 6)
                    if val == 6:
                        room["consecutive_sixes"] = room.get("consecutive_sixes", 0) + 1
                    else:
                        room["consecutive_sixes"] = 0

                    if room["consecutive_sixes"] >= 3:
                        await broadcast(room, {
                            "event": "DICE_RESULT",
                            "color": me["color"],
                            "value": val,
                            "board_state": room["board_state"]
                        })
                        await asyncio.sleep(0.8)
                        await next_turn(room)
                        continue

                    room["dice"] = val
                    arm_turn_timer(room)
                    await broadcast(room, {
                        "event": "DICE_RESULT",
                        "color": me["color"],
                        "value": val,
                        "board_state": room["board_state"]
                    })
                    if not can_move_any(room["board_state"], me["color"], val):
                        await asyncio.sleep(1.0)
                        await next_turn(room)

            elif act == "MOVE_PIECE":
                async with ROOM_LOCKS[room["code"]]:
                    me = can_control_game(room, uid, websocket)
                    try:
                        pid = int(data.get("piece_id", -1))
                    except (TypeError, ValueError, OverflowError):
                        await websocket.send_json({"event": "GAME_ERROR", "message": "Invalid piece ID"})
                        continue
                    val = room["dice"]
                    if not me or me["color"] != room["turn"] or val is None:
                        await websocket.send_json({"event": "MOVE_REJECTED", "message": "Только участник на своём ходу может двигать фишки."})
                        continue

                    target_color = me["color"]
                    if room["game_mode"] == "TEAM" and me.get("finished"):
                        mate = next((p for p in room["players"] if p["team"] == me["team"] and p["color"] != me["color"]), None)
                        if mate:
                            target_color = mate["color"]

                    if not 0 <= pid < len(room["board_state"][target_color]):
                        await websocket.send_json({"event": "GAME_ERROR", "message": "Invalid piece ID"})
                        continue
                    pos = room["board_state"][target_color][pid]
                    if pos == -1 and val == 6:
                        new_pos = 0
                    elif pos >= 0 and pos + val <= 56:
                        new_pos = pos + val
                    else:
                        continue

                    room["board_state"][target_color][pid] = new_pos
                    room["dice"] = None
                    captured_any = False

                    if 0 <= new_pos <= 50:
                        g_idx = (START_OFFSET[target_color] + new_pos) % 52
                        if g_idx not in SAFE_GLOBAL:
                            for other_col, arr in room["board_state"].items():
                                if other_col == target_color:
                                    continue
                                if room["game_mode"] == "TEAM":
                                    other_p = next((p for p in room["players"] if p["color"] == other_col), None)
                                    if other_p and other_p["team"] == me["team"]:
                                        continue
                                for idx_o, o_pos in enumerate(arr):
                                    if 0 <= o_pos <= 50 and (START_OFFSET[other_col] + o_pos) % 52 == g_idx:
                                        arr[idx_o] = -1
                                        captured_any = True

                    await save_room_db(room)
                    await broadcast(room, {"event": "PIECE_MOVED", "board_state": room["board_state"]})

                    fin_p = next((p for p in room["players"] if p["color"] == target_color), me)
                    just_finished = all(p == 56 for p in room["board_state"][target_color]) and not fin_p.get("finished")
                    if just_finished:
                        assign_finish_rank(room, fin_p)

                        if room["game_mode"] == "TEAM":
                            team_done = all(
                                p.get("finished") or p.get("left")
                                for p in room["players"] if p.get("team") == me["team"]
                            )
                            if team_done:
                                room["status"] = "FINISHED"
                                rating_changes = await record_match_results(room)
                                await broadcast(room, {"event": "GAME_OVER", "players": room["players"], "rating_changes": rating_changes})
                                await sync_tg_message(room)
                                continue
                        elif standard_match_complete(room):
                            room["status"] = "FINISHED"
                            rating_changes = await record_match_results(room)
                            await broadcast(room, {"event": "GAME_OVER", "players": room["players"], "rating_changes": rating_changes})
                            await sync_tg_message(room)
                            continue
                        elif room["game_mode"] != "TEAM":
                            # A finished player never keeps the turn just because they rolled a six or captured.
                            await next_turn(room)
                            continue

                    if val == 6 or new_pos == 56 or captured_any:
                        arm_turn_timer(room)
                        await broadcast(room, {
                            "event": "TURN_CHANGED",
                            "active_color": room["turn"],
                            "active_user_id": uid,
                            "board_state": room["board_state"],
                            "players": room["players"],
                            "timer": 15 if room["game_mode"] == "BLITZ" else 30
                        })
                    else:
                        await next_turn(room)

            elif act == "SEND_MESSAGE":
                if not uid or room.get("sockets", {}).get(uid) is not websocket:
                    continue
                sender = get_room_member(room, uid)
                if sender:
                    await broadcast(room, {
                        "event": "NEW_MESSAGE",
                        "message": {
                            "user_id": uid, "name": sender.get("name", "Гость"),
                            "color": sender.get("color", "guest"),
                            "text": str(data.get("text", ""))[:200]
                        }
                    })

            elif act == "SEND_VOICE_MESSAGE":
                await websocket.send_json({
                    "event": "VOICE_ERROR",
                    "message": "Голосовые отправляются отдельным медиаканалом. Обнови игру и попробуй ещё раз."
                })

            elif act == "SEND_ANIMATION":
                if not any(p["user_id"] == uid for p in room["players"]):
                    continue
                await broadcast(room, {
                    "event": "ANIMATION_SENT",
                    "from_color": data.get("from_color"),
                    "to_color": data.get("to_color"),
                    "animation": data.get("animation")
                })

            elif act == "VOICE":
                if not uid or room.get("sockets", {}).get(uid) is not websocket:
                    continue
                target = str(data.get("to", ""))
                if target in room["sockets"]:
                    data["from"] = uid
                    await room["sockets"][target].send_json(data)

            elif act == "VOICE_DIAG":
                if uid:
                    event_name = str(data.get("ev", "unknown"))[:40]
                    platform = str(data.get("plat", ""))[:40]
                    detail = str(data.get("info", ""))[:160]
                    print(f"[VOICE_DIAG] user={uid} platform={platform} event={event_name} info={detail}")

            elif act == "VOICE_MIC":
                if not uid or room.get("sockets", {}).get(uid) is not websocket:
                    continue
                await broadcast(room, {"event": "VOICE_MIC", "user_id": uid, "on": bool(data.get("on"))})

            elif act == "PLAYER_INFO":
                target_u = await get_user(str(data.get("user_id", "")))
                wr = round((target_u["wins"] / target_u["games"]) * 100) if target_u["games"] > 0 else 0
                await websocket.send_json({
                    "event": "PLAYER_INFO",
                    "user_id": target_u["user_id"],
                    "league": "🏆 Optimist League",
                    "rating": target_u["rating"],
                    "games": target_u["games"],
                    "wins": target_u["wins"],
                    "win_rate": wr,
                    "badges": 12,
                    "badges_total": 12
                })

    except WebSocketDisconnect:
        if voice_session_token:
            VOICE_SESSIONS.pop(voice_session_token, None)
        if uid and room.get("sockets", {}).get(uid) is websocket:
            del room["sockets"][uid]
            if uid in room.get("spectators", {}):
                room["spectators"].pop(uid, None)
                await broadcast(room, {
                    "event": "ROOM_MEMBERS",
                    "players": room["players"],
                    "spectators": list(room.get("spectators", {}).values())
                })
