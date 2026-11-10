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
                    sleep=fast_sleep, current_task=asyncio.current_task
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


if __name__ == "__main__":
    unittest.main()
