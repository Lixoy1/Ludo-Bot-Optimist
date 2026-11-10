"""Focused regression tests for the solo-vs-AI room flow."""
import asyncio
import os
import sys
import unittest
from pathlib import Path
from types import SimpleNamespace
from unittest.mock import patch

os.environ.setdefault("APP_ENV", "development")
os.environ.setdefault("DATABASE_PATH", ":memory:")
sys.path.insert(0, str(Path(__file__).resolve().parent))

import server  # noqa: E402


class BotRoomTests(unittest.TestCase):
    def make_room(self, players=None):
        return {
            "code": "BOTTEST",
            "status": "WAITING",
            "game_mode": "STANDARD",
            "players": list(players or []),
            "board_state": {
                "green": [-1, -1, -1, -1],
                "yellow": [-1, -1, -1, -1],
                "blue": [-1, -1, -1, -1],
                "red": [-1, -1, -1, -1],
            },
            "turn": "green",
            "dice": None,
            "consecutive_sixes": 0,
            "sockets": {},
            "turn_gen": 0,
            "turn_task": None,
            "actor_task": None,
            "start_task": None,
        }

    def test_one_human_fills_three_unique_ai_seats(self):
        room = self.make_room([{
            "user_id": "human-1", "name": "Player", "color": "green",
            "team": "B", "skin": "optimist", "finished": False,
        }])
        server.fill_bot_seats(room)
        bots = [player for player in room["players"] if player.get("is_bot")]
        self.assertEqual(len(room["players"]), 4)
        self.assertEqual(len(bots), 3)
        self.assertEqual(len({player["color"] for player in room["players"]}), 4)
        self.assertEqual(len({player["user_id"] for player in room["players"]}), 4)
        self.assertTrue(all(player.get("opening_roll_completed") for player in bots))

    def test_bot_prefers_a_safe_track_capture(self):
        room = self.make_room()
        room["game_mode"] = "STANDARD"
        room["board_state"]["green"] = [5, 10, -1, -1]
        # Yellow's global position is 6: green token 0 captures it by moving 5 -> 6.
        room["board_state"]["yellow"] = [45, -1, -1, -1]
        bot = {"user_id": "bot", "color": "green", "team": "B"}
        chosen = server.choose_bot_piece(room, "green", [0, 1], 1, bot)
        self.assertEqual(chosen, 0)

    def test_bot_prefers_exact_finish(self):
        room = self.make_room()
        room["board_state"]["green"] = [55, 20, -1, -1]
        bot = {"user_id": "bot", "color": "green", "team": "B"}
        chosen = server.choose_bot_piece(room, "green", [0, 1], 1, bot)
        self.assertEqual(chosen, 0)

    def test_opening_roll_stops_on_first_six(self):
        class Recorder:
            def __init__(self):
                self.events = []

            async def send_json(self, payload):
                self.events.append(payload)

        async def fast_sleep(_seconds):
            return None

        async def run():
            room = self.make_room([{
                "user_id": "human-1", "name": "Player", "color": "green",
                "team": "B", "skin": "optimist", "finished": False,
                "opening_roll_completed": False,
            }])
            room["status"] = "PLAYING"
            recorder = Recorder()
            room["sockets"] = {"human-1": recorder}
            server.ROOM_LOCKS[room["code"]] = asyncio.Lock()
            armed = []
            with (
                patch.object(server.random, "randint", return_value=6),
                patch.object(server, "arm_turn_timer", side_effect=lambda r: armed.append(r["code"])),
                patch.object(server, "asyncio", SimpleNamespace(
                    sleep=fast_sleep,
                    current_task=asyncio.current_task,
                    wait_for=asyncio.wait_for
                )),
            ):
                await server.auto_roll_until_six(room, "green")
            self.assertEqual(room["dice"], 6)
            self.assertTrue(room["players"][0]["opening_roll_completed"])
            self.assertEqual(len(armed), 1)
            dice_events = [event for event in recorder.events if event.get("event") == "DICE_RESULT"]
            self.assertEqual(len(dice_events), 1)
            self.assertTrue(dice_events[0]["auto_start_complete"])

        asyncio.run(run())

    def test_opening_auto_roll_does_not_repeat_after_player_has_completed_it(self):
        room = self.make_room([{
            "user_id": "human-1", "name": "Player", "color": "green",
            "team": "B", "skin": "optimist", "finished": False,
            "opening_roll_completed": True,
        }])
        room["status"] = "PLAYING"
        server.ROOM_LOCKS[room["code"]] = asyncio.Lock()
        armed = []
        with patch.object(server, "arm_turn_timer", side_effect=lambda r: armed.append(r["code"])):
            asyncio.run(server.schedule_turn_actor(room))
        self.assertEqual(armed, ["BOTTEST"])
        self.assertIsNone(room["actor_task"])



    def test_quick_start_as_seated_player_fills_three_bots_and_starts(self):
        async def run():
            room = self.make_room([{
                "user_id": "human-1", "name": "Player", "color": "green",
                "team": "B", "skin": "optimist", "finished": False,
            }])
            server.ROOM_LOCKS[room["code"]] = asyncio.Lock()
            with (
                patch.object(server, "broadcast", new=unittest.mock.AsyncMock()),
                patch.object(server, "sync_tg_message", new=unittest.mock.AsyncMock()),
                patch.object(server, "save_room_db", new=unittest.mock.AsyncMock()),
                patch.object(server, "schedule_turn_actor", new=unittest.mock.AsyncMock()),
            ):
                ok, message = await server.start_waiting_room(room, "human-1", source="miniapp_quick_start")
            self.assertTrue(ok, message)
            self.assertEqual(room["status"], "PLAYING")
            self.assertEqual(len(room["players"]), 4)
            self.assertEqual(sum(1 for p in room["players"] if p.get("is_bot")), 3)
        asyncio.run(run())

    def test_quick_start_rejects_non_seated_user(self):
        async def run():
            room = self.make_room([{
                "user_id": "human-1", "name": "Player", "color": "green",
                "team": "B", "skin": "optimist", "finished": False,
            }])
            server.ROOM_LOCKS[room["code"]] = asyncio.Lock()
            ok, message = await server.start_waiting_room(room, "stranger", source="miniapp_quick_start")
            self.assertFalse(ok)
            self.assertIn("присоедин", message.lower())
            self.assertEqual(room["status"], "WAITING")
            self.assertEqual(len(room["players"]), 1)
        asyncio.run(run())

    def test_group_start_uses_same_path_as_mini_app_start(self):
        async def run():
            room = self.make_room([{
                "user_id": "human-1", "name": "Player", "color": "green",
                "team": "B", "skin": "optimist", "finished": False,
            }])
            room["creator_user_id"] = "human-1"
            server.ROOM_LOCKS[room["code"]] = asyncio.Lock()
            with (
                patch.object(server, "broadcast", new=unittest.mock.AsyncMock()),
                patch.object(server, "sync_tg_message", new=unittest.mock.AsyncMock()),
                patch.object(server, "save_room_db", new=unittest.mock.AsyncMock()),
                patch.object(server, "schedule_turn_actor", new=unittest.mock.AsyncMock()),
            ):
                ok, message = await server.start_waiting_room(room, "human-1", source="telegram_group")
            self.assertTrue(ok, message)
            self.assertEqual(room["status"], "PLAYING")
            self.assertEqual(len(room["players"]), 4)
        asyncio.run(run())

    def test_room_page_embeds_server_resolved_code(self):
        page = server.render_game_page_html("TSXTEP")
        self.assertIn('window.__LUDO_SERVER_ROOM_CODE__ = "TSXTEP";', page)
        self.assertIn('let ROOM_CODE = window.__LUDO_SERVER_ROOM_CODE__ || resolveLudoRoomCode();', page)

    def test_room_page_embeds_team_suffix(self):
        page = server.render_game_page_html("TSXTEP_A")
        self.assertIn('window.__LUDO_SERVER_ROOM_CODE__ = "TSXTEP_A";', page)

    def test_root_page_does_not_inject_demo_as_real_room(self):
        page = server.render_game_page_html("")
        self.assertIn('window.__LUDO_SERVER_ROOM_CODE__ = "";', page)


    def test_waiting_group_keyboard_opens_mini_app_directly_without_join_or_start_buttons(self):
        room = self.make_room([])
        room["code"] = "ABC123"
        keyboard = server.render_tg_lobby_kb(room)
        buttons = [button for row in keyboard.inline_keyboard for button in row]
        self.assertEqual(len(buttons), 1)
        self.assertEqual(buttons[0].text, "🎲 Открыть игру")
        self.assertIsNotNone(buttons[0].web_app)
        self.assertEqual(buttons[0].web_app.url, f"{server.WEBAPP_URL}/room/ABC123")
        self.assertIsNone(buttons[0].callback_data)

    def test_team_mode_has_direct_web_app_links_for_both_teams(self):
        room = self.make_room([])
        room["code"] = "ABC123"
        room["game_mode"] = "TEAM"
        keyboard = server.render_tg_lobby_kb(room)
        buttons = [button for row in keyboard.inline_keyboard for button in row]
        self.assertEqual([button.text for button in buttons], ["🔴🟡 Команда A", "🟢🔵 Команда B"])
        self.assertEqual(buttons[0].web_app.url, f"{server.WEBAPP_URL}/room/ABC123_A")
        self.assertEqual(buttons[1].web_app.url, f"{server.WEBAPP_URL}/room/ABC123_B")

    def test_started_group_button_reopens_the_game_directly(self):
        room = self.make_room([{
            "user_id": "human-1", "name": "Player", "color": "green",
            "team": "B", "skin": "optimist", "finished": False,
        }])
        room["code"] = "ABC123"
        room["status"] = "PLAYING"
        keyboard = server.render_tg_lobby_kb(room)
        button = keyboard.inline_keyboard[0][0]
        self.assertEqual(button.text, "🎮 Вернуться в игру")
        self.assertEqual(button.web_app.url, f"{server.WEBAPP_URL}/room/ABC123")

    def test_lobby_waits_for_second_player_then_starts_fifteen_second_countdown(self):
        async def run():
            room = self.make_room([{
                "user_id": "human-1", "name": "Player", "color": "green",
                "team": "B", "skin": "optimist", "finished": False,
            }])
            room["lobby_deadline"] = None
            server.ensure_lobby_timer(room)
            self.assertIsNone(room["start_task"])
            self.assertIsNone(room["lobby_deadline"])

            room["players"].append({
                "user_id": "human-2", "name": "Player 2", "color": "yellow",
                "team": "A", "skin": "optimist", "finished": False,
            })
            before = server.time.time()
            server.ensure_lobby_timer(room)
            self.assertIsNotNone(room["start_task"])
            self.assertGreaterEqual(room["lobby_deadline"] - before, 14.9)
            self.assertLessEqual(room["lobby_deadline"] - before, 15.1)
            room["start_task"].cancel()
            await asyncio.gather(room["start_task"], return_exceptions=True)

        asyncio.run(run())

if __name__ == "__main__":
    unittest.main()
