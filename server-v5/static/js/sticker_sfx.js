// ─────────────────────── Skin stikerleriniń dawısları ───────────────────────
// Haqıyqıy jazıwlar (CC0 — static/sounds/stickers/LICENSE.txt): barlıq dawıslar bir
// audio-sprite'ta (sfx.mp3, bir soraw), hár waqıya — sol fayldaǵı [baslanıwı, uzınlıǵı] (s).
// Stiker animaciyasınıń hár basqıshı (atıw, ushıw, tiyiw) óz dawısın shaqıradı
// (stickers.js → LudoSfx.play). main.js oyınnıń AudioContext'in hám «dawıs qosılǵan ba»
// shártin beredi (attach) — menyuden dawıs óshirilse, stikerler de tınısh.
window.LudoSfx = (() => {
    const URL = "/static/sounds/stickers/sfx.wav?v=2";
    // Sprite kartası — scratchpad sfx_build.py jıynaǵan sfx.mp3 penen birge jańalanadı
    const SPRITE = {"throw":[0.0,0.327],"whooshHi":[0.537,0.229],"boom":[0.976,1.243],"fuse":[2.429,0.835],"shing":[3.474,0.424],"thunk":[4.109,0.283],"woo":[4.601,1.338],"boo":[6.149,0.87],"wind":[7.229,0.936],"thunder":[8.375,1.908],"coins":[10.493,1.018],"bonk":[11.721,0.433],"dizzy":[12.364,0.897],"hum":[13.471,1.331],"pull":[15.012,0.779],"kaching":[16.001,0.542],"shake":[16.753,0.462],"cork":[17.425,0.175],"fizz":[17.81,1.252],"freeze":[19.273,0.416],"shatter":[19.898,1.076],"twang":[21.185,0.457],"hearts":[21.852,0.638],"rainbow":[22.7,1.282],"sparkle":[24.193,0.431],"charge":[24.834,0.252],"laser":[25.296,0.926],"clunk":[26.431,0.517],"cannon":[27.158,0.877],"fire":[28.246,0.785],"burn":[29.24,1.656],"popper":[31.106,0.824],"kazoo":[32.14,0.834],"fanfare":[33.184,2.143]};

    let ctx = null;
    let out = null;
    let buf = null;
    let loading = null;
    let enabled = () => true;

    function attach(audioContext, isEnabled) {
        ctx = audioContext;
        if (isEnabled) enabled = isEnabled;
        out = ctx.createGain();
        out.gain.value = 0.9;
        out.connect(ctx.destination);
    }

    // Sprite'tı bir ret júklep decode qıladı (oyınǵa kirgende — stiker jiberilgende tayın tursın)
    function load() {
        if (buf || loading || !ctx) return loading;
        loading = fetch(URL)
            .then((r) => r.arrayBuffer())
            .then((ab) => new Promise((res, rej) => ctx.decodeAudioData(ab, res, rej)))
            .then((b) => { buf = b; })
            .catch(() => { loading = null; });   // keyingi joly qayta urınadı
        return loading;
    }

    // delay — sekund (animaciyanıń keyingi basqıshına)
    function play(name, delay = 0) {
        if (!ctx || !SPRITE[name] || !enabled()) return;
        if (!buf) { load(); return; }   // ele júklenbegen — bul ret tınısh
        const run = () => {
            try {
                const s = ctx.createBufferSource();
                s.buffer = buf;
                s.connect(out);
                s.start(ctx.currentTime + 0.01 + delay, SPRITE[name][0], SPRITE[name][1]);
            } catch (e) {}
        };
        if (ctx.state === "running") run();
        else ctx.resume().then(run).catch(() => {});
    }

    return { attach, load, play, names: Object.keys(SPRITE) };
})();