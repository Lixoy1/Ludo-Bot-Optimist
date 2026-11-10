import assert from "node:assert/strict";
import fs from "node:fs";
import vm from "node:vm";
const html = fs.readFileSync("server-v5/index.html", "utf8");
const start = html.indexOf("<script>", html.indexOf("telegram-web-app.js"));
const end = html.indexOf("</script>", start);
assert.ok(start >= 0 && end > start, "inline room resolver missing");
const script = html.slice(start + 8, end);
function code({startParam="",initData="",search="",hash="",pathname="/",href=""}={}) {
  const context = {
    window: {
      Telegram: {WebApp:{initDataUnsafe:{start_param:startParam,user:{language_code:"ru"}},initData}},
      location:{search,hash,pathname,href}
    },
    URLSearchParams,navigator:{language:"ru"},console,decodeURIComponent
  };
  return vm.runInNewContext(script + "\nROOM_CODE;", context);
}
assert.equal(code({startParam:"join_TSXTEP"}),"TSXTEP");
assert.equal(code({startParam:"TSXTEP"}),"TSXTEP");
assert.equal(code({startParam:"join_TSXTEP_A"}),"TSXTEP_A");
assert.equal(code({initData:"user=%7B%7D&start_param=join_TSXTEP"}),"TSXTEP");
assert.equal(code({search:"?tgWebAppStartParam=join_TSXTEP"}),"TSXTEP");
assert.equal(code({search:"?startapp=TSXTEP"}),"TSXTEP");
assert.equal(code({hash:"#tgWebAppStartParam=join_TSXTEP"}),"TSXTEP");
assert.equal(code({search:"?tgWebAppData=user%3D%257B%257D%26start_param%3Djoin_TSXTEP"}),"TSXTEP");
assert.equal(code({pathname:"/room/TSXTEP"}),"TSXTEP");
assert.equal(code({href:"https://example.org/?startapp=join_TSXTEP"}),"TSXTEP");
assert.equal(code({}),"");
console.log("Telegram room resolver: 11 assertions passed.");
