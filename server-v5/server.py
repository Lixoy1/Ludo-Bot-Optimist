import os, random, string, asyncio, sqlite3, hmac, hashlib, json, time, base64
from urllib.parse import parse_qsl
from contextlib import asynccontextmanager
from fastapi import FastAPI, WebSocket, WebSocketDisconnect, Request, HTTPException
from fastapi.staticfiles import StaticFiles
from fastapi.responses import HTMLResponse, JSONResponse
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


# ─── База SQLite для профилей и персистентного хранения комнат ───
DB_PATH = os.getenv("DATABASE_PATH", "ludo.db")
os.makedirs(os.path.dirname(os.path.abspath(DB_PATH)), exist_ok=True)
db = sqlite3.connect(DB_PATH, check_same_thread=False)
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
            "creator_user_id": room.get("creator_user_id")
        }
        async with DB_LOCK:
            db.execute("INSERT OR REPLACE INTO rooms (code, state_json) VALUES (?, ?)", (room["code"], json.dumps(snapshot)))
            db.commit()
    except Exception:
        pass

def load_rooms_from_db():
    try:
        for code, state_json in db.execute("SELECT code, state_json FROM rooms").fetchall():
            data = json.loads(state_json)
            if data.get("status") != "FINISHED":
                data["sockets"] = {}
                data["start_task"] = None
                data["turn_task"] = None
                data["turn_gen"] = 0
                data["actor_task"] = None
                data.setdefault("creator_user_id", None)
                ROOMS[code] = data
                ROOM_LOCKS[code] = asyncio.Lock()
    except Exception:
        pass

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
            "board_state": {"green": [-1]*4, "yellow": [-1]*4, "blue": [-1]*4, "red": [-1]*4},
            "turn": "green",
            "dice": None,
            "consecutive_sixes": 0,
            "sockets": {},
            "chat_id": chat_id,
            "msg_id": msg_id,
            "creator_user_id": str(creator_user_id) if creator_user_id is not None else None,
            "start_task": None,
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
        header = f"🎮 **Optimist Ludo — {title}**\nКомната: `{room['code']}` | Игроков: **{len(players)}/4**\n\n"
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
        footer = ("\n\n🤖 _Можно играть одному: нажмите «Играть с ботами», и свободные места займут AI-соперники._\n"
                  "⏳ _Если ждёте людей, игра стартует автоматически через 15 сек после входа 2-го игрока (или при 4/4)._")
        return header + body + footer
    elif room["status"] == "PLAYING":
        active = next((p for p in players if p.get("color") == room.get("turn")), None)
        plist = "\n".join([
            f"{'👉 ' if p is active else ''}{COLOR_EMOJI[p['color']]} {p['name']}{' — ХОДИТ' if p is active else ''}"
            for p in players
        ])
        turn_line = f"\n\n🎲 **Сейчас ходит: {active['name']}**" if active else ""
        return f"🔥 **Игра идёт! ({title})**\nКомната: `{room['code']}`{turn_line}\n\n{plist}"
    else:
        sorted_p = sorted(players, key=lambda x: x.get("rank") or 99)
        res = "\n".join([f"#{p.get('rank', '×')} {COLOR_EMOJI[p['color']]} {p['name']}" for p in sorted_p])
        return f"🏆 **Игра окончена! ({title})**\n\n{res}"

def render_tg_lobby_kb(room):
    code = room["code"]
    if room["status"] == "FINISHED":
        return InlineKeyboardMarkup(inline_keyboard=[
            [InlineKeyboardButton(text="🔄 Новая игра", callback_data=f"new_{room['game_mode']}")]
        ])
    if room["status"] == "WAITING":
        return InlineKeyboardMarkup(inline_keyboard=[
            [InlineKeyboardButton(text="🎲 Присоединиться", callback_data=f"join_{code}")],
            [InlineKeyboardButton(text="▶️ Старт", callback_data=f"start_{code}")]
        ])
    return InlineKeyboardMarkup(inline_keyboard=[
        [InlineKeyboardButton(text="🎮 Войти в игру", url=f"https://t.me/Ludo_optimist_bot?startapp=join_{code}")],
        [InlineKeyboardButton(text="🔄 Новая игра", callback_data=f"new_{room['game_mode']}")]
    ])

async def sync_tg_message(room):
    await save_room_db(room)
    if not room.get("chat_id") or not room.get("msg_id"):
        return
    try:
        await bot.edit_message_text(
            chat_id=room["chat_id"],
            message_id=room["msg_id"],
            text=render_tg_lobby_text(room),
            reply_markup=render_tg_lobby_kb(room),
            parse_mode="Markdown"
        )
    except Exception:
        pass

async def broadcast(room, payload):
    for ws in list(room["sockets"].values()):
        try:
            await ws.send_json(payload)
        except Exception:
            pass

def can_move_any(board, color, val):
    for pos in board[color]:
        if pos == -1 and val == 6:
            return True
        if pos >= 0 and pos + val <= 56:
            return True
    return False

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
    """Prioritize finishing, capturing, leaving base, then advancing."""
    board = room["board_state"]
    best_index, best_score = legal_pieces[0], float("-inf")
    for index in legal_pieces:
        pos = board[color][index]
        new_pos = 0 if pos == -1 and dice == 6 else pos + dice
        score = 0.0
        if new_pos == 56:
            score += 100000
        elif new_pos >= 51:
            score += 2500 + new_pos
        else:
            global_index = (START_OFFSET[color] + new_pos) % 52
            score += 300 + new_pos * 12
            if pos == -1:
                score += 450
            if global_index in SAFE_GLOBAL:
                score += 80
            else:
                for enemy_color, positions in board.items():
                    if enemy_color == color:
                        continue
                    enemy = next((p for p in room["players"] if p["color"] == enemy_color), None)
                    if room["game_mode"] == "TEAM" and enemy and enemy.get("team") == bot.get("team"):
                        continue
                    score += sum(
                        12000 for enemy_pos in positions
                        if 0 <= enemy_pos <= 50 and
                        (START_OFFSET[enemy_color] + enemy_pos) % 52 == global_index
                    )
        if pos >= 0:
            score += (new_pos - pos) * (8 if pos >= 51 else 4)
        score += (3 - index) * 0.01
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

    if all(pos == 56 for pos in room["board_state"][color]):
        bot["finished"] = True
        finished_count = sum(1 for p in room["players"] if p.get("rank"))
        bot["rank"] = finished_count + 1
        if room["game_mode"] == "TEAM":
            team_done = all(p.get("finished") for p in room["players"] if p.get("team") == bot.get("team"))
            if team_done:
                room["status"] = "FINISHED"
                room["actor_task"] = None
                await broadcast(room, {"event": "GAME_OVER", "players": room["players"], "rating_changes": {}})
                await sync_tg_message(room)
                return
        elif finished_count + 1 >= len(room["players"]) - 1:
            room["status"] = "FINISHED"
            room["actor_task"] = None
            await broadcast(room, {"event": "GAME_OVER", "players": room["players"], "rating_changes": {}})
            await sync_tg_message(room)
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
            await asyncio.sleep(0.62)
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

            await asyncio.sleep(0.48)
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
    room["turn"] = room["players"][0]["color"]
    room["consecutive_sixes"] = 0
    room["dice"] = None
    active_p = room["players"][0]
    t_sec = 15 if room["game_mode"] == "BLITZ" else 30
    await broadcast(room, {
        "event": "GAME_STARTED", "status": "PLAYING", "game_mode": room["game_mode"],
        "board_state": room["board_state"], "players": room["players"],
        "turn": room["turn"], "active_user_id": active_p["user_id"], "timer": t_sec
    })
    await sync_tg_message(room)
    await save_room_db(room)
    await schedule_turn_actor(room)

async def schedule_autostart(room):
    current = asyncio.current_task()
    try:
        await asyncio.sleep(15)
        async with ROOM_LOCKS[room["code"]]:
            if room["status"] == "WAITING" and len(room["players"]) >= 2:
                await begin_match(room)
    finally:
        if room.get("start_task") is current:
            room["start_task"] = None

async def next_turn(room):
    old_timer = room.get("turn_task")
    if old_timer and old_timer is not asyncio.current_task() and not old_timer.done():
        old_timer.cancel()
    room["turn_task"] = None
    room["turn_gen"] = room.get("turn_gen", 0) + 1
    room["dice"] = None
    room["consecutive_sixes"] = 0
    active_colors = [p["color"] for p in room["players"] if not p.get("finished") and not p.get("left")]
    if not active_colors:
        return
    idx = (active_colors.index(room["turn"]) + 1) % len(active_colors) if room["turn"] in active_colors else 0
    room["turn"] = active_colors[idx]
    active_p = next((p for p in room["players"] if p["color"] == room["turn"]), room["players"][0])
    t_sec = 15 if room["game_mode"] == "BLITZ" else 30
    await save_room_db(room)
    await broadcast(room, {
        "event": "TURN_CHANGED", "active_color": room["turn"], "active_user_id": active_p["user_id"],
        "board_state": room["board_state"], "players": room["players"], "timer": t_sec
    })
    await sync_tg_message(room)
    await schedule_turn_actor(room)

# ─── Telegram-бот ───
bot = Bot(token=BOT_TOKEN) if BOT_TOKEN != BOT_TOKEN_PLACEHOLDER else None
dp = Dispatcher()

@dp.message(CommandStart())
async def cmd_start(message: types.Message):
    await send_start_menu(message)


@dp.message(Command("game", "play", "ludo"))
async def cmd_game(message: types.Message):
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
        room = ROOMS.get(code)
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
    room = ROOMS.get(code)
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
        await sync_tg_message(room)
    await call.answer("Ты за столом!")


@dp.callback_query(F.data.startswith("start_"))
async def cb_start_game(call: types.CallbackQuery):
    code = call.data.split("_", 1)[1]
    room = ROOMS.get(code)
    if not room or room.get("status") != "WAITING":
        await call.answer("Комната уже закрыта или игра началась.", show_alert=True)
        return
    creator_id = str(room.get("creator_user_id") or "")
    if creator_id and str(call.from_user.id) != creator_id:
        await call.answer("Начать игру может только создатель комнаты.", show_alert=True)
        return
    async with ROOM_LOCKS[code]:
        if room.get("status") != "WAITING":
            await call.answer("Игра уже началась.", show_alert=True)
            return
        creator_id = str(room.get("creator_user_id") or "")
        if creator_id and str(call.from_user.id) != creator_id:
            await call.answer("Начать игру может только создатель комнаты.", show_alert=True)
            return
        if not room["players"]:
            await call.answer("Сначала нажмите «Присоединиться».", show_alert=True)
            return
        task = room.get("start_task")
        if task and not task.done():
            task.cancel()
        room["start_task"] = None
        await begin_match(room)
    await call.answer("Игра началась!")
    # Publish a separate game-entry message, matching the reference bot flow.
    enter_kb = InlineKeyboardMarkup(inline_keyboard=[[
        InlineKeyboardButton(
            text="🎮 Войти в игру",
            url=f"https://t.me/Ludo_optimist_bot?startapp=join_{code}"
        )
    ]])
    await call.message.answer(
        f"🎮 Игра началась! ({MODE_NAMES.get(room['game_mode'], 'Optimist Ludo')})\n"
        + "\n".join(f"{COLOR_EMOJI[p['color']]} {p['name']}" for p in room["players"]),
        reply_markup=enter_kb
    )

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
    except sqlite3.Error:
        raise HTTPException(status_code=503, detail="Database unavailable")
    return {"status": "ok"}

@app.get("/")
@app.get("/room/{room_code}")
async def game_page(room_code: str = "DEMO"):
    if len(room_code) > 10 or not all(c in string.ascii_uppercase + string.digits + "_" for c in room_code):
        return HTMLResponse("Invalid room code", status_code=400)
    with open("index.html", "r", encoding="utf-8") as f:
        html = f.read().replace('const ROOM_CODE = "KOL541";', f'const ROOM_CODE = "{room_code}";')
    return HTMLResponse(html)

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
    room = await create_room_state(base_code)
    uid = None
    await websocket.send_json({"event": "CONNECTION_ESTABLISHED"})

    try:
        while True:
            data = await websocket.receive_json()
            act = data.get("action")

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

                        await sync_tg_message(room)

                    if room["status"] == "WAITING":
                        await broadcast(room, {
                            "event": "ROOM_STATE",
                            "status": "WAITING",
                            "game_mode": room["game_mode"],
                            "players": room["players"]
                        })
                        # Joining only seats the player. The explicit group START
                        # callback controls when the match begins.
                    else:
                        active_p = next((p for p in room["players"] if p["color"] == room["turn"]), room["players"][0])
                        await websocket.send_json({
                            "event": "GAME_STARTED",
                            "status": "PLAYING",
                            "game_mode": room["game_mode"],
                            "board_state": room["board_state"],
                            "players": room["players"],
                            "turn": room["turn"],
                            "active_user_id": active_p["user_id"],
                            "timer": 15 if room["game_mode"] == "BLITZ" else 30
                        })

            elif act == "START_GAME":
                if not uid:
                    continue
                async with ROOM_LOCKS[room["code"]]:
                    if room["status"] != "WAITING":
                        await websocket.send_json({"event": "GAME_ERROR", "message": "Игра уже началась"})
                    elif not room["players"] or room["players"][0]["user_id"] != uid:
                        await websocket.send_json({"event": "GAME_ERROR", "message": "Начать игру может только создатель комнаты"})
                    elif len(room["players"]) < 1:
                        await websocket.send_json({"event": "GAME_ERROR", "message": "Сначала войдите в комнату"})
                    else:
                        task = room.get("start_task")
                        if task and not task.done():
                            task.cancel()
                        room["start_task"] = None
                        await begin_match(room)

            elif act == "LEAVE_GAME":
                if not uid:
                    continue
                async with ROOM_LOCKS[room["code"]]:
                    if room["status"] == "WAITING":
                        room["players"] = [p for p in room["players"] if p["user_id"] != uid]
                        room["sockets"].pop(uid, None)
                        # Если игроков < 2, отменяем старт
                        if len(room["players"]) < 2 and room["start_task"]:
                            room["start_task"].cancel()
                            room["start_task"] = None
                        
                        await broadcast(room, {
                            "event": "ROOM_STATE",
                            "status": "WAITING",
                            "game_mode": room["game_mode"],
                            "players": room["players"]
                        })
                        await sync_tg_message(room)
                    elif room["status"] == "PLAYING":
                        me = next((p for p in room["players"] if p["user_id"] == uid), None)
                        if me:
                            me["left"] = True
                            me["finished"] = True
                            room["board_state"][me["color"]] = [-1] * len(room["board_state"][me["color"]])
                            room["sockets"].pop(uid, None)
                            
                            remaining = [p for p in room["players"] if not p.get("finished") and not p.get("left")]
                            if len(remaining) <= 1:
                                if remaining:
                                    winner = remaining[0]
                                    winner["rank"] = 1
                                    async with DB_LOCK:
                                        db.execute("UPDATE users SET games=games+1, wins=wins+1, rating=rating+25 WHERE user_id=?", (winner["user_id"],))
                                        db.commit()
                                room["status"] = "FINISHED"
                                if room["turn_task"]:
                                    room["turn_task"].cancel()
                                await save_room_db(room)
                                await broadcast(room, {
                                    "event": "GAME_OVER",
                                    "players": room["players"],
                                    "board_state": room["board_state"],
                                    "rating_changes": {}
                                })
                                await sync_tg_message(room)
                            else:
                                await broadcast(room, {
                                    "event": "PIECE_MOVED",
                                    "board_state": room["board_state"]
                                })
                                if room["turn"] == me["color"]:
                                    await next_turn(room)
                                else:
                                    await save_room_db(room)

            elif act == "ROLL_DICE":
                async with ROOM_LOCKS[room["code"]]:
                    me = next((p for p in room["players"] if p["user_id"] == uid), None)
                    if not me or me["color"] != room["turn"] or room["dice"] is not None:
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
                    me = next((p for p in room["players"] if p["user_id"] == uid), None)
                    try:
                        pid = int(data.get("piece_id", -1))
                    except (TypeError, ValueError, OverflowError):
                        await websocket.send_json({"event": "GAME_ERROR", "message": "Invalid piece ID"})
                        continue
                    val = room["dice"]
                    if not me or me["color"] != room["turn"] or val is None:
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

                    if all(p == 56 for p in room["board_state"][target_color]):
                        fin_p = next((p for p in room["players"] if p["color"] == target_color), me)
                        fin_p["finished"] = True
                        finished_count = sum(1 for p in room["players"] if p.get("rank"))
                        fin_p["rank"] = finished_count + 1
                        async with DB_LOCK:
                            db.execute("UPDATE users SET games=games+1, wins=wins+1, rating=rating+25 WHERE user_id=?", (fin_p["user_id"],))
                            db.commit()

                        if room["game_mode"] == "TEAM":
                            team_done = all(p.get("finished") for p in room["players"] if p["team"] == me["team"])
                            if team_done:
                                room["status"] = "FINISHED"
                                await broadcast(room, {"event": "GAME_OVER", "players": room["players"], "rating_changes": {}})
                                await sync_tg_message(room)
                                continue
                        elif finished_count + 1 >= len(room["players"]) - 1:
                            room["status"] = "FINISHED"
                            await broadcast(room, {"event": "GAME_OVER", "players": room["players"], "rating_changes": {}})
                            await sync_tg_message(room)
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
                me = next((p for p in room["players"] if p["user_id"] == uid), None)
                if me:
                    await broadcast(room, {
                        "event": "NEW_MESSAGE",
                        "message": {"user_id": uid, "name": me["name"], "color": me["color"], "text": str(data.get("text", ""))[:200]}
                    })

            elif act == "SEND_VOICE_MESSAGE":
                me = next((p for p in room["players"] if p["user_id"] == uid), None)
                if not me:
                    continue
                encoded = str(data.get("audio_data", "") or "")
                mime_type = str(data.get("mime_type", "audio/webm") or "audio/webm").lower().split(";")[0]
                if mime_type not in {"audio/webm", "audio/ogg", "audio/mp4"} or not encoded or len(encoded) > 900000:
                    continue
                try:
                    audio_bytes = base64.b64decode(encoded, validate=True)
                except Exception:
                    continue
                if not audio_bytes or len(audio_bytes) > 675000:
                    continue
                await broadcast(room, {
                    "event": "NEW_VOICE_MESSAGE",
                    "message": {
                        "user_id": uid, "name": me["name"], "color": me["color"],
                        "mime_type": mime_type, "audio_data": encoded,
                        "duration_ms": max(0, min(30000, int(data.get("duration_ms", 0) or 0)))
                    }
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
                if not any(p["user_id"] == uid for p in room["players"]):
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
                if not any(p["user_id"] == uid for p in room["players"]):
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
        if uid and uid in room["sockets"]:
            del room["sockets"][uid]
