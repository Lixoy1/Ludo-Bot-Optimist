import assert from "node:assert/strict";
import fs from "node:fs";
import vm from "node:vm";
const html = fs.readFileSync("index.html", "utf8");
const scriptStart = html.indexOf("<script>");
const scriptEnd = html.indexOf("</script>", scriptStart);
assert.ok(scriptStart >= 0 && scriptEnd > scriptStart, "inline ROOM_CODE script must exist");
const script = html.slice(scriptStart + "<script>".length, scriptEnd);
function roomCode({ startParam = "", initData = "", search = "", hash = "", pathname = "/" } = {}) {
  const context = {
    window: {
      Telegram: { WebApp: { initDataUnsafe: { start_param: startParam, user: { language_code: "ru" } }, initData } },
      location: { search, hash, pathname }
    },
    URLSearchParams,
    navigator: { language: "ru" },
    console
  };
  vm.runInNewContext(script, context);
  return context.ROOM_CODE;
}
assert.equal(roomCode({ startParam: "join_TSXTEP" }), "TSXTEP");
assert.equal(roomCode({ startParam: "TSXTEP" }), "TSXTEP");
assert.equal(roomCode({ startParam: "join_TSXTEP_A" }), "TSXTEP_A");
assert.equal(roomCode({ initData: "user=%7B%7D&start_param=join_TSXTEP" }), "TSXTEP");
assert.equal(roomCode({ search: "?tgWebAppStartParam=join_TSXTEP" }), "TSXTEP");
assert.equal(roomCode({ hash: "#tgWebAppStartParam=join_TSXTEP" }), "TSXTEP");
assert.equal(roomCode({ pathname: "/room/TSXTEP" }), "TSXTEP");
console.log("Room deep-link parsing: 7 assertions passed.");
