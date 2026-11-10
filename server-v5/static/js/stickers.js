// ─────────────────────────── Skin stikerleri (interaktiv) ───────────────────────────
// Hár satıp alınatuǵın skinniń óz toplamı — 4 interaktiv stiker: zat jiberiwshiniń
// kartochkasınan ushıp shıǵıp, alıwshınıń kartochkasında «isleydi» (jarıladı, muzlatadı,
// urıp aylandıradı, teńgesin tartıp aladı ...). Tematika skinniki: Obsidian — qara tas,
// tútin, kúlgin jalın; Altın — teńge, altın; Kristal — muz, kristal, ráńbáreń; Taj —
// patshalıq, konfetti, ot. Toplam skin iyesine (⚜️ VIP'te — hámmesi) ashıq; ruqsattı
// server tekseredi (app/stickers.py — id'ler usı katalog penen birdey). Stiker id'i:
// "<skin>:<at>". Animaciya — Web Animations API (tek transform/opacity), súwretler —
// SVG data URI (<img>); bárshesi bólek fixed qatlamda, basıwlarǵa kesent bermeydi.
// Hár basqıshtıń óz dawısı bar (sticker_sfx.js — Web Audio'da sintezlenedi).
// Ulıwma stikerler — burınǵısha Lottie fayllar (static/animations, hámmege ashıq).
(function (global) {
    const PACKS = {
        obsidian: ["bomb", "shuriken", "ghost", "storm"],
        gold: ["coins", "hammer", "magnet", "champagne"],
        gem: ["freeze", "cupid", "rainbow", "laser"],
        crown: ["cannon", "fireball", "party", "fanfare"],
    };

    const NS = "http://www.w3.org/2000/svg";
    const FONT = "font-family='Arial Black,Arial,Helvetica,sans-serif' font-weight='900'";

    // ─────────────────────────────── Súwretler ───────────────────────────────
    // Kórsetiw/ushıw waqtındaǵı jeńil «tınısh» animaciyalar (SVG ishinde — <img>'de de isleydi)
    const IDLE = "<style>.p{transform-box:fill-box;transform-origin:center}" +
        ".sway{transform-origin:50px 88px;animation:sway 1.6s ease-in-out infinite}@keyframes sway{25%{transform:rotate(-6deg)}75%{transform:rotate(6deg)}}" +
        ".spin{transform-origin:50px 50px;animation:spin 2.4s linear infinite}@keyframes spin{to{transform:rotate(360deg)}}" +
        ".float{animation:float 1.8s ease-in-out infinite}@keyframes float{50%{transform:translateY(-4px)}}" +
        ".tw{animation:tw 1.3s ease-in-out infinite}@keyframes tw{0%,100%{transform:scale(.4);opacity:.2}50%{transform:scale(1);opacity:1}}" +
        ".flk{animation:flk 1.4s steps(1) infinite}@keyframes flk{0%,100%{opacity:1}46%,54%{opacity:.15}}" +
        ".pul{animation:pul .5s ease-in-out infinite alternate}@keyframes pul{to{transform:scale(.6) rotate(45deg)}}" +
        ".fl{transform-box:fill-box;transform-origin:50% 100%;animation:fl .32s ease-in-out infinite alternate}@keyframes fl{to{transform:scale(1.06,1.14)}}" +
        ".flh{transform-box:fill-box;transform-origin:100% 50%;animation:flh .3s ease-in-out infinite alternate}@keyframes flh{to{transform:scale(1.15,1.08)}}" +
        "</style>";
    const doc = (body, vb = "0 0 100 100", stretch = false) =>
        `<svg xmlns='${NS}' viewBox='${vb}'${stretch ? " preserveAspectRatio='none'" : ""}>${body}</svg>`;
    const stops = (list) => list.map(([o, c, op]) =>
        `<stop offset='${o}' stop-color='${c}'${op == null ? "" : ` stop-opacity='${op}'`}/>`).join("");
    const lin = (id, list, x1 = 0, y1 = 0, x2 = 0, y2 = 1) =>
        `<linearGradient id='${id}' x1='${x1}' y1='${y1}' x2='${x2}' y2='${y2}'>${stops(list)}</linearGradient>`;
    const rad = (id, list, cx = 0.5, cy = 0.5, r = 0.5) =>
        `<radialGradient id='${id}' cx='${cx}' cy='${cy}' r='${r}'>${stops(list)}</radialGradient>`;
    // Juldız/jarılıs: n ushlı, r1 — sırtqı, r2 — ishki radius
    const spikes = (n, r1, r2, cx = 50, cy = 50, rot = 0) => Array.from({ length: n * 2 }, (_, i) => {
        const r = i % 2 ? r2 : r1, a = (rot + i * 180 / n - 90) * Math.PI / 180;
        return `${(cx + r * Math.cos(a)).toFixed(1)},${(cy + r * Math.sin(a)).toFixed(1)}`;
    }).join(" ");
    const sparkle = (cx, cy, r, fill, stroke, cls = "", delay = 0) => {
        const q = r * 0.18;
        return `<path class='p ${cls}' style='animation-delay:${-delay}s' d='M${cx} ${cy - r}Q${cx + q} ${cy - q} ${cx + r} ${cy}` +
            `Q${cx + q} ${cy + q} ${cx} ${cy + r}Q${cx - q} ${cy + q} ${cx - r} ${cy}Q${cx - q} ${cy - q} ${cx} ${cy - r}Z' ` +
            `fill='${fill}' stroke='${stroke}' stroke-width='1.2' stroke-linejoin='round'/>`;
    };
    const coinAt = (x, y, r) => `<circle cx='${x}' cy='${y}' r='${r}' fill='#F5C542' stroke='#8A5A00' stroke-width='2'/>` +
        `<circle cx='${x}' cy='${y}' r='${(r * 0.6).toFixed(1)}' fill='none' stroke='#FFF1BF' stroke-width='1.4'/>`;
    const HEART_D = "M0 2.6C-2.2 1 -3.4 -.4 -3.4 -1.8C-3.4 -3 -2.5 -3.8 -1.5 -3.8C-.8 -3.8 -.3 -3.4 0 -2.9" +
        "C.3 -3.4 .8 -3.8 1.5 -3.8C2.5 -3.8 3.4 -3 3.4 -1.8C3.4 -.4 2.2 1 0 2.6Z";
    const RAINBOW = ["#FF5A5F", "#FFB020", "#FFE04A", "#3DD68C", "#4BA3FF", "#A78BFA"];
    const CONFETTI = ["#F43F5E", "#22C55E", "#3B82F6", "#FACC15", "#A855F7"];

    const CLOUD = `<defs>${lin("cl", [[0, "#6B7488"], [1, "#262C3A"]])}</defs>` +
        "<path d='M28 66Q13 66 13 53Q13 40 27 40Q29 23 47 23Q62 23 66 35Q83 33 85 50Q87 66 72 66Z' fill='url(#cl)' stroke='#0B0E14' stroke-width='2.5' stroke-linejoin='round'/>" +
        "<path d='M30 44Q32 32 46 30' fill='none' stroke='#fff' stroke-opacity='.25' stroke-width='3' stroke-linecap='round'/>";
    const CRYSTAL = `<defs>${lin("c", [[0, "#ECFEFF"], [0.5, "#67E8F9"], [1, "#0EA5E9"]], 0, 0, 1, 1)}</defs>`;
    const GEMSTONE = CRYSTAL + "<path d='M28 36L39 22H61L72 36L50 80Z' fill='url(#c)' stroke='#0369A1' stroke-width='2.5' stroke-linejoin='round'/>" +
        "<path d='M28 36H72M39 22L45 36L50 80L55 36L61 22' fill='none' stroke='#fff' stroke-opacity='.75' stroke-width='1.6' stroke-linejoin='round'/>";
    const ARROW = `<defs>${lin("h", [[0, "#FBCFE8"], [0.5, "#F472B6"], [1, "#BE185D"]], 0, 0, 1, 1)}</defs>` +
        "<rect x='14' y='18' width='76' height='4' rx='2' fill='#E0F2FE' stroke='#0369A1' stroke-width='1.2'/>" +
        "<path d='M4 8L20 20L4 32L12 20Z' fill='#67E8F9' stroke='#0369A1' stroke-width='1.5' stroke-linejoin='round'/>" +
        "<path d='M15 8L31 20L15 32L23 20Z' fill='#A5F3FC' stroke='#0369A1' stroke-width='1.5' stroke-linejoin='round'/>" +
        `<path transform='translate(100 20) rotate(-90) scale(4.2)' d='${HEART_D}' fill='url(#h)' stroke='#831843' stroke-width='.4'/>` +
        "<path d='M90 20L101 12M90 20L101 28' stroke='#fff' stroke-opacity='.6' stroke-width='1.2'/>";
    const FIREBALL = `<defs>${rad("f", [[0, "#FFFFFF"], [0.35, "#FDE047"], [0.75, "#F97316"], [1, "#DC2626"]], 0.6, 0.5, 0.55)}</defs>` +
        "<path class='flh' d='M80 30Q46 2 4 16Q30 22 22 30Q30 38 4 44Q46 58 80 30Z' fill='#DC2626'/>" +
        "<path class='flh' style='animation-delay:-.15s' d='M80 30Q54 12 22 20Q38 26 34 30Q38 34 22 40Q54 48 80 30Z' fill='#F97316'/>" +
        "<circle cx='84' cy='30' r='21' fill='url(#f)' stroke='#B91C1C' stroke-width='1.5'/>" +
        "<circle cx='60' cy='12' r='2' fill='#FDE047'/><circle cx='52' cy='48' r='1.6' fill='#FDE047'/>";
    const TRUMPET = `<defs>${lin("t", [[0, "#FFF1BF"], [0.5, "#F1C34E"], [1, "#B98512"]])}</defs>` +
        "<path d='M30 44H60V80L45 72L30 80Z' fill='#B91C1C' stroke='#5F0E0E' stroke-width='2' stroke-linejoin='round'/>" +
        "<path d='M38 64L37 55L41 58L45 52L49 58L53 55L52 64Z' fill='#F5C542' stroke='#6E4C06' stroke-width='1.2' stroke-linejoin='round'/>" +
        "<rect x='6' y='37' width='10' height='8' rx='2' fill='#B98512' stroke='#6E4C06' stroke-width='1.8'/>" +
        [30, 40, 50].map((x) => `<rect x='${x}' y='26' width='6' height='11' rx='1.5' fill='url(#t)' stroke='#6E4C06' stroke-width='1.6'/>`).join("") +
        "<rect x='14' y='36' width='52' height='10' rx='4' fill='url(#t)' stroke='#6E4C06' stroke-width='2'/>" +
        "<path d='M64 37L94 20V62L64 45Z' fill='url(#t)' stroke='#6E4C06' stroke-width='2.2' stroke-linejoin='round'/>" +
        "<ellipse cx='94' cy='41' rx='4' ry='21' fill='#F5C542' stroke='#6E4C06' stroke-width='2'/>";
    const NOTE = (fill, stroke) => `<g fill='${fill}' stroke='${stroke}' stroke-width='1.2' stroke-linejoin='round'>` +
        "<ellipse cx='-3' cy='5' rx='4' ry='3' transform='rotate(-20 -3 5)'/><path d='M0 5V-9L8 -6V-2L2 -4V5Z'/></g>";
    const spark = (fill, stroke) => () => doc(sparkle(0, 0, 8, fill, stroke), "-10 -10 20 20");

    // name -> () => SVG (src() data URI'ge aylandırıp keshleydi)
    const A = {
        // ── Obsidian ──
        bomb: () => doc(IDLE + `<defs>${rad("g", [[0, "#6B7488"], [0.55, "#262C3A"], [1, "#0B0E14"]], 0.38, 0.35, 0.7)}</defs>` +
            "<circle cx='48' cy='60' r='30' fill='url(#g)' stroke='#05070B' stroke-width='2'/>" +
            "<path d='M28 54L39 59L35 71M60 42L55 55L68 61L64 74' fill='none' stroke='#A78BFA' stroke-width='2.4' stroke-linecap='round' stroke-linejoin='round'/>" +
            "<ellipse cx='37' cy='46' rx='9' ry='5' fill='#fff' fill-opacity='.2' transform='rotate(-30 37 46)'/>" +
            "<rect x='38' y='25' width='20' height='10' rx='3' fill='#3A4152' stroke='#05070B' stroke-width='2' transform='rotate(14 48 30)'/>" +
            "<path d='M52 26Q55 13 69 12' fill='none' stroke='#C4B5FD' stroke-width='3' stroke-linecap='round'/>" +
            sparkle(71, 11, 9, "#F5D0FE", "#7C3AED", "pul") + "<circle cx='71' cy='11' r='2.6' fill='#fff'/>"),
        shuriken: () => doc(IDLE + `<defs>${lin("g", [[0, "#6B7488"], [1, "#12161F"]], 0, 0, 1, 1)}</defs><g class='spin'>` +
            [0, 90, 180, 270].map((r) => `<path transform='rotate(${r + 45} 50 50)' d='M50 50L40 38Q46 22 50 5Q54 22 60 38Z' ` +
                "fill='url(#g)' stroke='#C4B5FD' stroke-width='1.8' stroke-linejoin='round'/>").join("") +
            "<circle cx='50' cy='50' r='12' fill='#1B2029' stroke='#8B5CF6' stroke-width='3'/><circle cx='50' cy='50' r='4.5' fill='#A78BFA'/></g>"),
        ghost: () => doc(IDLE + `<defs>${lin("g", [[0, "#5B6478"], [0.65, "#2A3040"], [1, "#2A3040", 0.25]])}</defs><g class='float'>` +
            "<path d='M20 54Q12 58 13 67M80 54Q88 58 87 67' fill='none' stroke='#3A4152' stroke-width='7' stroke-linecap='round'/>" +
            "<path d='M24 90V46Q24 15 50 15Q76 15 76 46V90Q70 82 63 90Q56 82 50 90Q44 82 37 90Q30 82 24 90Z' fill='url(#g)' stroke='#8B5CF6' stroke-width='2.2' stroke-opacity='.85' stroke-linejoin='round'/>" +
            "<ellipse cx='40' cy='43' rx='6.5' ry='8.5' fill='#EDE9FE'/><ellipse cx='60' cy='43' rx='6.5' ry='8.5' fill='#EDE9FE'/>" +
            "<circle cx='41.5' cy='45' r='3.2' fill='#4C1D95'/><circle cx='61.5' cy='45' r='3.2' fill='#4C1D95'/>" +
            "<ellipse cx='50' cy='64' rx='7' ry='9' fill='#0B0E14'/></g>"),
        storm: () => doc(IDLE + CLOUD +
            "<path class='flk' d='M52 62L41 80H51L45 97L64 73H53L60 62Z' fill='#EDE9FE' stroke='#6D28D9' stroke-width='2.2' stroke-linejoin='round'/>"),
        cloud: () => doc(CLOUD),
        bolt: () => doc("<path d='M25 2L7 52H20L11 98L35 40H22L31 2Z' fill='#F5F3FF' stroke='#7C3AED' stroke-width='3' stroke-linejoin='round'/>", "0 0 42 100"),
        boo: () => doc(`<text x='50' y='54' text-anchor='middle' dominant-baseline='middle' ${FONT} font-size='32' fill='#EDE9FE' ` +
            "stroke='#4C1D95' stroke-width='6' stroke-linejoin='round' paint-order='stroke' transform='rotate(-8 50 50)'>BOO!</text>"),
        smoke: () => doc("<g fill='#A3ABB9' fill-opacity='.85'><circle cx='38' cy='56' r='18'/><circle cx='58' cy='46' r='20'/><circle cx='64' cy='62' r='15'/><circle cx='46' cy='68' r='14'/></g>"),
        smokeV: () => doc("<g fill='#8B7FB8' fill-opacity='.8'><circle cx='38' cy='56' r='18'/><circle cx='58' cy='46' r='20'/><circle cx='64' cy='62' r='15'/><circle cx='46' cy='68' r='14'/></g>"),
        shard: () => doc("<path d='M3 -7L8 6L-6 4Z' fill='#262C3A' stroke='#A78BFA' stroke-width='1.2' stroke-linejoin='round'/>", "-9 -9 18 18"),
        boomV: () => doc(`<polygon points='${spikes(14, 48, 28)}' fill='#7C3AED'/><polygon points='${spikes(12, 36, 20, 50, 50, 12)}' fill='#F0ABFC'/><circle cx='50' cy='50' r='15' fill='#fff'/>`),
        soot: () => doc(`<defs>${rad("s", [[0, "#0B0E14", 0.9], [0.6, "#0B0E14", 0.55], [1, "#0B0E14", 0]])}</defs>` +
            [[30, 26, 30, 20], [70, 22, 34, 22], [108, 28, 30, 20], [52, 34, 26, 14], [92, 36, 24, 12]]
                .map(([x, y, rx, ry]) => `<ellipse cx='${x}' cy='${y}' rx='${rx}' ry='${ry}' fill='url(#s)'/>`).join("") +
            "<g fill='#FB923C'><circle cx='40' cy='20' r='1.4'/><circle cx='84' cy='30' r='1.2'/><circle cx='112' cy='18' r='1.3'/></g>", "0 0 140 50", true),
        flash: () => doc("<rect width='140' height='50' rx='12' fill='#F5F3FF' fill-opacity='.9'/>", "0 0 140 50", true),
        sparkV: spark("#F5D0FE", "#7C3AED"),
        // ── Altın ──
        bag: () => doc(IDLE + `<defs>${lin("g", [[0, "#F0C14B"], [1, "#9A6A12"]], 0, 0, 1, 1)}</defs><g class='sway'>` +
            coinAt(42, 24, 9) + coinAt(58, 21, 9) +
            "<path d='M36 34Q21 46 19 65Q17 91 50 91Q83 91 81 65Q79 46 64 34Z' fill='url(#g)' stroke='#6E4C06' stroke-width='2.5' stroke-linejoin='round'/>" +
            "<path d='M33 30Q50 38 67 30L65 39Q50 45 35 39Z' fill='#8A5A00' stroke='#5A3A00' stroke-width='2' stroke-linejoin='round'/>" +
            `<text x='50' y='68' text-anchor='middle' dominant-baseline='middle' ${FONT} font-size='30' fill='#FFF1BF' stroke='#6E4C06' stroke-width='3' paint-order='stroke'>$</text></g>` +
            sparkle(82, 22, 7, "#FFF3C4", "#B98512", "tw")),
        coin: () => doc(coinAt(0, 0, 10) + "<path d='M-4 -5Q0 -7 4 -5' fill='none' stroke='#fff' stroke-width='1.4' stroke-linecap='round' stroke-opacity='.8'/>", "-12 -12 24 24"),
        hammer: () => doc(IDLE + `<defs>${lin("h", [[0, "#FFF1BF"], [0.5, "#F1C34E"], [1, "#B98512"]])}</defs><g class='sway'><g transform='rotate(-30 50 50)'>` +
            "<rect x='45' y='36' width='10' height='58' rx='4' fill='#7C4A12' stroke='#3B2205' stroke-width='2'/>" +
            "<path d='M45 80H55M45 86H55' stroke='#3B2205' stroke-width='1.5'/>" +
            "<rect x='20' y='14' width='60' height='28' rx='7' fill='url(#h)' stroke='#6E4C06' stroke-width='2.5'/>" +
            "<rect x='20' y='14' width='9' height='28' rx='4' fill='#C08A16' stroke='#6E4C06' stroke-width='2'/>" +
            "<rect x='71' y='14' width='9' height='28' rx='4' fill='#C08A16' stroke='#6E4C06' stroke-width='2'/>" +
            "<rect x='32' y='19' width='34' height='5' rx='2.5' fill='#fff' fill-opacity='.55'/></g></g>"),
        starY: () => doc(`<polygon points='${spikes(5, 10, 4.4, 0, 0)}' fill='#FDE047' stroke='#A16207' stroke-width='1.4' stroke-linejoin='round'/>`, "-12 -12 24 24"),
        pow: () => doc(`<polygon points='${spikes(10, 48, 26)}' fill='#F59E0B'/><polygon points='${spikes(8, 32, 18, 50, 50, 20)}' fill='#FDE68A'/><circle cx='50' cy='50' r='10' fill='#fff'/>`),
        magnet: () => doc(IDLE + `<defs>${lin("g", [[0, "#FFE9A0"], [0.5, "#F5C542"], [1, "#B98512"]], 0, 0, 1, 0)}</defs>` +
            "<path d='M24 62V40A26 26 0 0 1 76 40V62H60V40A10 10 0 0 0 40 40V62Z' fill='url(#g)' stroke='#6E4C06' stroke-width='2.5' stroke-linejoin='round'/>" +
            "<rect x='24' y='60' width='16' height='14' rx='2' fill='#E5E7EB' stroke='#4B5563' stroke-width='2.5'/>" +
            "<rect x='60' y='60' width='16' height='14' rx='2' fill='#E5E7EB' stroke='#4B5563' stroke-width='2.5'/>" +
            "<g class='flk' fill='none' stroke='#FDE68A' stroke-width='3' stroke-linecap='round'><path d='M26 82Q32 88 38 82'/><path d='M62 82Q68 88 74 82'/>" +
            "<path d='M22 90Q32 98 42 90'/><path d='M58 90Q68 98 78 90'/></g>"),
        bottle: () => doc(IDLE + `<defs>${lin("b", [[0, "#123524"], [0.45, "#2F6B4F"], [1, "#0B2418"]], 0, 0, 1, 0)}` +
            `${lin("f", [[0, "#FFE9A0"], [0.5, "#E0A92A"], [1, "#9A6A12"]], 0, 0, 1, 0)}</defs><g class='sway'>` +
            "<path d='M42 12H58V30Q58 36 64 42Q70 48 70 58V88Q70 94 64 94H36Q30 94 30 88V58Q30 48 36 42Q42 36 42 30Z' fill='url(#b)' stroke='#06140D' stroke-width='2.5' stroke-linejoin='round'/>" +
            "<path d='M41 10H59V30Q59 35 63 40H37Q41 35 41 30Z' fill='url(#f)' stroke='#6E4C06' stroke-width='2' stroke-linejoin='round'/>" +
            "<rect x='43' y='3' width='14' height='9' rx='3' fill='#D6A15A' stroke='#6E4C06' stroke-width='2'/>" +
            "<rect x='34' y='56' width='32' height='24' rx='4' fill='url(#f)' stroke='#6E4C06' stroke-width='2'/>" +
            `<polygon points='${spikes(5, 7, 3, 50, 68)}' fill='#FFF6C9' stroke='#8A5A00' stroke-width='1'/>` +
            "<rect x='35' y='45' width='4' height='40' rx='2' fill='#fff' fill-opacity='.22'/></g>" +
            "<g fill='none' stroke='#FDE68A' stroke-width='1.6'><circle class='p tw' cx='76' cy='20' r='3.4'/>" +
            "<circle class='p tw' style='animation-delay:-.6s' cx='84' cy='34' r='2.4'/></g>"),
        cork: () => doc("<rect x='-6' y='-4' width='12' height='8' rx='3' fill='#D6A15A' stroke='#6E4C06' stroke-width='1.6'/>", "-8 -8 16 16"),
        foam: () => doc("<circle r='5' fill='#FFFBEB' stroke='#FDE68A' stroke-width='1.2'/>", "-7 -7 14 14"),
        bubble: () => doc("<circle r='5' fill='#FFFBEB' fill-opacity='.25' stroke='#FDE68A' stroke-width='1.4'/>", "-7 -7 14 14"),
        sparkG: spark("#FFF3C4", "#B98512"),
        // ── Kristal ──
        crystal: () => doc(IDLE + CRYSTAL + "<g transform='rotate(35 50 50)'>" +
            "<path d='M50 6L66 26V74L50 94L34 74V26Z' fill='url(#c)' stroke='#0369A1' stroke-width='2.5' stroke-linejoin='round'/>" +
            "<path d='M50 6V94M34 26L50 36L66 26M34 74L50 64L66 74' fill='none' stroke='#fff' stroke-opacity='.75' stroke-width='1.6'/></g>" +
            sparkle(80, 22, 7, "#fff", "#0EA5E9", "tw") + sparkle(20, 78, 5, "#fff", "#0EA5E9", "tw", 0.6)),
        snow: () => doc([["#38BDF8", 3.6], ["#fff", 2]].map(([c, w]) => `<g stroke='${c}' stroke-width='${w}' stroke-linecap='round' fill='none'>` +
            [0, 60, 120].map((r) => `<path transform='rotate(${r})' d='M0 -8V8M-2.5 -5.5L0 -3L2.5 -5.5M-2.5 5.5L0 3L2.5 5.5'/>`).join("") + "</g>").join(""), "-10 -10 20 20"),
        ice: () => doc(`<defs>${lin("i", [[0, "#E0F7FF", 0.94], [0.5, "#9BE3F7", 0.82], [1, "#5CC8EE", 0.9]], 0, 0, 1, 1)}</defs>` +
            "<rect x='2' y='3' width='136' height='38' rx='10' fill='url(#i)' stroke='#F0FBFF' stroke-width='2.5'/>" +
            "<path d='M14 11L28 33M40 9L50 25M98 11L114 35M120 10L128 20' stroke='#fff' stroke-opacity='.8' stroke-width='2.2' stroke-linecap='round'/>" +
            "<path d='M18 41L22 49L26 41M58 41L61 47L64 41M94 41L98 50L102 41M120 41L122 46L124 41' fill='#CFF5FF' stroke='#7DD3FC' stroke-width='1.2' stroke-linejoin='round'/>",
            "0 0 140 50", true),
        iceShard: () => doc("<path d='M0 -8L6 5L-5 6Z' fill='#BAE6FD' fill-opacity='.9' stroke='#fff' stroke-width='1.2' stroke-linejoin='round'/>", "-9 -9 18 18"),
        arrow: () => doc(ARROW, "0 0 120 40"),
        cupid: () => doc(IDLE + `<g transform='translate(50 52) rotate(-35) scale(.82) translate(-60 -20)'>${ARROW}</g>` +
            `<g transform='translate(24 26) scale(2)'><path class='p tw' d='${HEART_D}' fill='#F472B6' stroke='#9D174D' stroke-width='.4'/></g>` +
            `<g transform='translate(78 74) scale(1.5)'><path class='p tw' style='animation-delay:-.6s' d='${HEART_D}' fill='#F9A8D4' stroke='#9D174D' stroke-width='.5'/></g>`),
        heart: () => doc(`<path d='${HEART_D}' fill='#F472B6' stroke='#9D174D' stroke-width='.5'/>`, "-4.5 -4.5 9 9"),
        rainbow: () => doc(IDLE + RAINBOW.map((c, i) => {
            const r = 38 - i * 5.2;
            return `<path d='M${50 - r} 72A${r} ${r} 0 0 1 ${50 + r} 72' fill='none' stroke='${c}' stroke-width='5.6' stroke-linecap='round'/>`;
        }).join("") + "<g fill='#fff' stroke='#CBD5E1' stroke-width='1.5'><circle cx='9' cy='74' r='7'/><circle cx='17' cy='70' r='8'/><circle cx='22' cy='76' r='6'/>" +
            "<circle cx='91' cy='74' r='7'/><circle cx='83' cy='70' r='8'/><circle cx='78' cy='76' r='6'/></g>" +
            sparkle(50, 18, 6, "#fff", "#0EA5E9", "tw") + sparkle(78, 30, 4, "#FDE68A", "#B45309", "tw", 0.5) + sparkle(22, 32, 4, "#FBCFE8", "#9D174D", "tw", 0.9)),
        prism: () => doc(IDLE + "<g class='flk' stroke-linecap='round'><path d='M64 46L96 30' stroke='#F9A8D4' stroke-width='4'/><path d='M64 50L97 46' stroke='#67E8F9' stroke-width='4'/>" +
            "<path d='M64 54L95 62' stroke='#FDE68A' stroke-width='4'/></g>" + GEMSTONE),
        gemStone: () => doc(GEMSTONE),
        scorch: () => doc(`<defs>${rad("s", [[0, "#0B0E14", 0.8], [0.6, "#0B0E14", 0.45], [1, "#0B0E14", 0]])}</defs><circle r='15' fill='url(#s)'/>` +
            "<g fill='#A5F3FC'><circle cx='-5' cy='-3' r='1.2'/><circle cx='4' cy='5' r='1'/><circle cx='6' cy='-6' r='.9'/></g>", "-16 -16 32 32"),
        sparkC: spark("#A5F3FC", "#0E7490"),
        sparkP: spark("#FBCFE8", "#9D174D"),
        sparkY: spark("#FDE68A", "#92400E"),
        sparkW: spark("#FFFFFF", "#0369A1"),
        // ── Taj ──
        cannon: () => doc(IDLE + `<defs>${lin("i", [[0, "#6B7280"], [0.5, "#374151"], [1, "#111827"]])}</defs><g transform='rotate(-22 42 62)'>` +
            "<rect x='30' y='48' width='54' height='24' rx='9' fill='url(#i)' stroke='#0B0F17' stroke-width='2.5'/>" +
            "<rect x='80' y='45' width='9' height='30' rx='3' fill='#1F2937' stroke='#0B0F17' stroke-width='2.5'/>" +
            "<rect x='40' y='47' width='5' height='26' fill='#F5C542' stroke='#6E4C06' stroke-width='1.2'/>" +
            "<rect x='68' y='47' width='5' height='26' fill='#F5C542' stroke='#6E4C06' stroke-width='1.2'/>" +
            "<rect x='34' y='52' width='42' height='4' rx='2' fill='#fff' fill-opacity='.18'/></g>" +
            "<circle cx='40' cy='72' r='16' fill='#B91C1C' stroke='#5F0E0E' stroke-width='2.5'/>" +
            "<path d='M40 58V86M26 72H54M30 62L50 82M50 62L30 82' stroke='#F5C542' stroke-width='2.4'/>" +
            "<circle cx='40' cy='72' r='5' fill='#F5C542' stroke='#6E4C06' stroke-width='1.6'/>"),
        ball: () => doc(`<defs>${rad("g", [[0, "#9CA3AF"], [0.5, "#374151"], [1, "#0B0F17"]], 0.35, 0.3, 0.75)}</defs><circle r='10' fill='url(#g)' stroke='#05070B' stroke-width='1.2'/>`, "-12 -12 24 24"),
        boomR: () => doc(`<polygon points='${spikes(14, 48, 28)}' fill='#EF4444'/><polygon points='${spikes(12, 36, 20, 50, 50, 12)}' fill='#FACC15'/><circle cx='50' cy='50' r='15' fill='#fff'/>`),
        fireball: () => doc(IDLE + FIREBALL, "0 0 120 60"),
        fireTile: () => doc(IDLE + `<g transform='translate(50 50) rotate(-35) scale(.8) translate(-62 -30)'>${FIREBALL}</g>`),
        flame: () => doc(IDLE + "<g class='fl'><path d='M20 2C27 16 37 23 37 39C37 51 29 58 20 58C11 58 3 51 3 39C3 28 12 24 13 12C16 19 18 18 20 2Z' fill='#EF4444'/>" +
            "<path d='M20 16C25 26 31 30 31 41C31 50 26 55 20 55C14 55 9 50 9 41C9 34 15 31 16 24C18 29 19 27 20 16Z' fill='#F97316'/>" +
            "<path d='M20 31C23 37 26 40 26 46C26 51 23 54 20 54C17 54 14 51 14 46C14 42 17 40 20 31Z' fill='#FDE047'/></g>", "0 0 40 60"),
        ember: () => doc("<circle r='3' fill='#FDBA74'/><circle r='1.4' fill='#FEF3C7'/>", "-4 -4 8 8"),
        popper: () => doc(IDLE + "<g transform='rotate(32 50 62)'><path d='M50 96L33 40H67Z' fill='#7C3AED' stroke='#3B0764' stroke-width='2.5' stroke-linejoin='round'/>" +
            "<path d='M38 56H62M42 70H58M46 84H54' stroke='#F5C542' stroke-width='5'/>" +
            "<ellipse cx='50' cy='40' rx='17' ry='5.5' fill='#F5C542' stroke='#6E4C06' stroke-width='2'/></g>" +
            [[68, 14, 20], [84, 26, -30], [76, 36, 40], [88, 10, -10], [58, 22, 60]].map(([x, y, r], i) =>
                `<g transform='translate(${x} ${y}) rotate(${r})'><rect class='p tw' style='animation-delay:${-i * 0.25}s' x='-2.5' y='-4.5' width='5' height='9' rx='1' fill='${CONFETTI[i]}'/></g>`).join("")),
        trumpet: () => doc(IDLE + TRUMPET + `<g transform='translate(84 12)'><g class='p tw'>${NOTE("#F5C542", "#6E4C06")}</g></g>`),
        horn: () => doc(TRUMPET),
        note: () => doc(NOTE("#F5C542", "#6E4C06"), "-9 -11 20 20"),
        noteP: () => doc(NOTE("#C4B5FD", "#4C1D95"), "-9 -11 20 20"),
        banner: () => doc("<path d='M22 12H8L14 25L8 38H22ZM118 12H132L126 25L132 38H118Z' fill='#7F1D1D' stroke='#450A0A' stroke-width='2' stroke-linejoin='round'/>" +
            "<rect x='18' y='8' width='104' height='34' rx='4' fill='#B91C1C' stroke='#F5C542' stroke-width='3'/>" +
            `<text x='70' y='26' text-anchor='middle' dominant-baseline='central' ${FONT} font-size='24' fill='#FDE047' stroke='#6E4C06' stroke-width='3' paint-order='stroke'>GG</text>`, "0 0 140 50"),
    };
    CONFETTI.forEach((c, i) => {
        A["confetti" + i] = () => doc(`<rect x='-3' y='-5' width='6' height='10' rx='1.2' fill='${c}'/>`, "-6 -6 12 12");
        A["streamer" + i] = () => doc(`<path d='M4 36C14 28 6 20 16 14S20 4 30 4' fill='none' stroke='${c}' stroke-width='4' stroke-linecap='round'/>`, "0 0 34 40");
    });

    // Paneldegi/dúkandaǵı kórinisi (stiker id → súwret)
    const TILE = {
        "obsidian:bomb": "bomb", "obsidian:shuriken": "shuriken", "obsidian:ghost": "ghost", "obsidian:storm": "storm",
        "gold:coins": "bag", "gold:hammer": "hammer", "gold:magnet": "magnet", "gold:champagne": "bottle",
        "gem:freeze": "crystal", "gem:cupid": "cupid", "gem:rainbow": "rainbow", "gem:laser": "prism",
        "crown:cannon": "cannon", "crown:fireball": "fireTile", "crown:party": "popper", "crown:fanfare": "trumpet",
    };

    const cache = {};
    const src = (name) => cache[name] || (cache[name] = "data:image/svg+xml;charset=utf-8," + encodeURIComponent(A[name]()));
    let preloaded = false;
    // Barlıq súwretlerdi aldın júklew — animaciya waqtında bos (júklenbegen) súwret kórinbesin
    function preload() {
        if (preloaded || typeof Image === "undefined") return;
        preloaded = true;
        Object.keys(A).forEach((k) => { const img = new Image(); img.src = src(k); });
    }

    // ─────────────────────────── Animaciya dvijogı ───────────────────────────
    const T = (x, y, r = 0, sx = 1, sy = sx) =>
        `translate(${x}px,${y}px) translate(-50%,-50%) rotate(${r}deg) scale(${sx},${sy})`;
    const wait = (ms) => new Promise((res) => setTimeout(res, ms));
    // Dawıs (sticker_sfx.js; menyuden dawıs óshirilse — tınısh); d — keshigiw, sekund
    const sfx = (name, d) => { try { if (global.LudoSfx) global.LudoSfx.play(name, d); } catch (e) {} };

    function layer() {
        let l = document.getElementById("stk-layer");
        if (!l) {
            l = document.createElement("div");
            l.id = "stk-layer";
            l.style.cssText = "position:fixed;inset:0;pointer-events:none;z-index:4000;overflow:hidden";
            document.body.appendChild(l);
        }
        return l;
    }
    function put(name, x, y, w, h = w) {
        const el = document.createElement("img");
        el.alt = "";
        el.src = src(name);
        el.style.cssText = `position:absolute;left:0;top:0;width:${w}px;height:${h}px;pointer-events:none;will-change:transform,opacity`;
        el.style.transform = T(x, y);
        layer().appendChild(el);
        return el;
    }
    // Animaciya pitkende element óshiriledi (qanday da bolsa 6 s'tan keyin — qátege qarsı)
    function bye(el, a) {
        const rm = () => el.remove();
        if (a && a.finished) a.finished.then(rm, rm);
        setTimeout(rm, 6000);
    }
    function anim(el, keyframes, opts) {
        const a = el.animate(keyframes, Object.assign({ fill: "forwards" }, opts));
        bye(el, a);
        return a;
    }

    // Ushıw jolı: eki noqat arasındaǵı iymeklik (taxta — ekran orayı tárepke iyiledi)
    function normal(a, b) {
        const dx = b.x - a.x, dy = b.y - a.y, len = Math.hypot(dx, dy) || 1;
        let nx = dy / len, ny = -dx / len;
        if ((innerWidth / 2 - (a.x + b.x) / 2) * nx + (innerHeight / 2 - (a.y + b.y) / 2) * ny < 0) { nx = -nx; ny = -ny; }
        return { x: nx, y: ny };
    }
    function curve(a, b, arc) {
        const dx = b.x - a.x, dy = b.y - a.y, n = normal(a, b);
        return (t) => {
            const k = arc * 4 * t * (1 - t), kd = arc * 4 * (1 - 2 * t);
            return { x: a.x + dx * t + n.x * k, y: a.y + dy * t + n.y * k, ang: Math.atan2(dy + n.y * kd, dx + n.x * kd) * 180 / Math.PI };
        };
    }
    function frames(a, b, o) {
        const at = curve(a, b, o.arc || 0), out = [];
        const s0 = o.s0 == null ? 1 : o.s0, s1 = o.s1 == null ? 1 : o.s1, r0 = o.rot0 || 0, r1 = o.rot1 || 0;
        for (let i = 0; i <= 16; i++) {
            const t = i / 16, p = at(t), s = s0 + (s1 - s0) * t;
            const wave = o.wave ? Math.sin(t * Math.PI * 4) * o.wave : 0;
            out.push({
                transform: T(p.x, p.y + wave, o.orient ? p.ang : r0 + (r1 - r0) * t, s, s),
                opacity: o.o0 == null ? 1 : Math.min(1, o.o0 + t * 3), offset: t,
            });
        }
        return out;
    }
    function fly(el, a, b, o = {}) {
        const an = el.animate(frames(a, b, o), { duration: o.dur || 700, easing: o.easing || "ease-in-out", fill: "forwards" });
        return an.finished.catch(() => {});
    }
    // Bólekshe shashıraydı: a0..a1 — baǵıt (gradus, 0 — oń, 90 — tómen), grav — aqırında tómen/joqarı awısıw
    function burst(name, c, o = {}) {
        const n = o.n || 8, d0 = o.d0 || 20, d1 = o.d1 || 50, a0 = o.a0 == null ? 0 : o.a0, a1 = o.a1 == null ? 360 : o.a1;
        const s0 = o.s0 == null ? 0.5 : o.s0, s1 = o.s1 == null ? 1 : o.s1, spin = o.spin == null ? 180 : o.spin;
        for (let i = 0; i < n; i++) {
            const ang = (a0 + (a1 - a0) * (i + 0.2 + Math.random() * 0.6) / n) * Math.PI / 180;
            const d = d0 + Math.random() * (d1 - d0), ex = c.x + Math.cos(ang) * d, ey = c.y + Math.sin(ang) * d;
            const r = (Math.random() - 0.5) * 2 * spin;
            anim(put(typeof name === "function" ? name(i) : name, c.x, c.y, o.size || 16), [
                { transform: T(c.x, c.y, 0, s0), opacity: 1 },
                { transform: T(ex, ey, r * 0.6, s1), opacity: 1, offset: 0.55 },
                { transform: T(ex + (ex - c.x) * 0.15, ey + (o.grav || 0), r, s1 * 0.9), opacity: 0 },
            ], { duration: o.dur || 800, delay: o.delay || 0, easing: "cubic-bezier(.2,.7,.3,1)", fill: "both" });
        }
    }
    // Kartochkanı tolıq jabatuǵın qatlam (muz, qurım, shaqmaq jarqılı)
    function cover(card, name, o = {}) {
        const r = card.getBoundingClientRect(), pad = o.pad == null ? 6 : o.pad;
        const inD = o.inD == null ? 120 : o.inD, hold = o.hold == null ? 1000 : o.hold, outD = o.outD == null ? 500 : o.outD;
        const total = inD + hold + outD;
        anim(put(name, r.left + r.width / 2, r.top + r.height / 2, r.width + pad * 2, r.height + pad * 2),
            [{ opacity: 0 }, { opacity: 1, offset: inD / total }, { opacity: 1, offset: (inD + hold) / total }, { opacity: 0 }],
            { duration: total, delay: o.delay || 0, fill: "both" });
    }
    // Alıwshı kartochkasınıń reakciyası
    const REACT = {
        shake: [[0, -7, 7, -6, 5, -3, 0].map((x) => ({ transform: `translateX(${x}px)` })), 500],
        heavy: [[0, -11, 10, -9, 8, -6, 4, -2, 0].map((x, i) => ({ transform: `translate(${x}px,${i % 2 ? 2 : -2}px) rotate(${x / 5}deg)` })), 700],
        squash: [["1,1", "1.14,.7", ".94,1.1", "1.03,.97", "1,1"].map((s) => ({ transform: `scale(${s})`, transformOrigin: "50% 100%" })), 600],
        shiver: [Array.from({ length: 15 }, (_, i) => ({ transform: `translateX(${i === 14 ? 0 : i % 2 ? 2 : -2}px)` })), 1100],
        bounce: [[0, -10, 0, -4, 0].map((y) => ({ transform: `translateY(${y}px)` })), 650],
        pulse: [[1, 1.08, 1, 1.06, 1].map((s) => ({ transform: `scale(${s})` })), 800],
        zap: [[[0, 1], [-5, 2.2], [5, 0.6], [-4, 1.8], [3, 0.8], [0, 1]].map(([x, br]) => ({ transform: `translateX(${x}px)`, filter: `brightness(${br})` })), 450],
    };
    function react(card, kind, delay = 0) {
        try { card.animate(REACT[kind][0], { duration: REACT[kind][1], delay, easing: "ease-out" }); } catch (e) {}
    }
    function glow(card, color, dur = 1200) {
        try {
            card.animate([{ boxShadow: `0 0 0 0 ${color}` }, { boxShadow: `0 0 22px 6px ${color}`, offset: 0.3 }, { boxShadow: `0 0 0 0 ${color}` }], { duration: dur });
        } catch (e) {}
    }
    function flashAt(name, c, size, dur = 480) {
        anim(put(name, c.x, c.y, size), [{ transform: T(c.x, c.y, 0, 0.2), opacity: 1 }, { transform: T(c.x, c.y, 15, 1.2), opacity: 0 }], { duration: dur, easing: "ease-out" });
    }
    function boom(c, flashArt, smokeArt, debris) {
        sfx("boom");
        flashAt(flashArt, c, 110);
        burst(smokeArt, c, { n: 7, size: 34, d0: 26, d1: 58, dur: 1100, grav: -14, s0: 0.4, s1: 1.3 });
        burst(debris, c, { n: 7, size: 14, d0: 30, d1: 60, dur: 750, grav: 36, spin: 360 });
    }
    const fadeOut = (el, dur = 300, delay = 0) => anim(el, [{ opacity: 1 }, { opacity: 0 }], { duration: dur, delay });

    // ─────────────── Interaktiv stikerler: a — jiberiwshi, b — alıwshı (avatar orayları) ───────────────
    const FX = {
        // 💣 Obsidian bomba: kúlgin jarılıs, tútin, tas sınıqları, kartochkada qurım
        "obsidian:bomb": async ({ a, b, card }) => {
            const el = put("bomb", a.x, a.y, 46);
            sfx("throw");
            sfx("fuse");
            await fly(el, a, b, { arc: 70, dur: 800, rot1: 400 });
            el.remove();
            boom(b, "boomV", "smokeV", "shard");
            react(card, "heavy");
            cover(card, "soot", { hold: 1100 });
        },
        // Shuriken: zıpıldap ushıp, kartochkaǵa qadaladı
        "obsidian:shuriken": async ({ a, b, card }) => {
            const el = put("shuriken", a.x, a.y, 40);
            sfx("shing");
            await fly(el, a, b, { arc: 25, dur: 520, rot1: 1080, easing: "ease-in" });
            sfx("thunk");
            burst("sparkV", b, { n: 6, size: 11, d0: 14, d1: 28, dur: 380 });
            react(card, "shake");
            anim(el, [
                { transform: T(b.x, b.y, 1080) }, { transform: T(b.x, b.y, 1092), offset: 0.08 },
                { transform: T(b.x, b.y, 1072), offset: 0.16 }, { transform: T(b.x, b.y, 1084), offset: 0.24 },
                { transform: T(b.x, b.y, 1080), opacity: 1, offset: 0.75 }, { transform: T(b.x, b.y, 1080), opacity: 0 },
            ], { duration: 1600 });
        },
        // 👻 Arwaq: tolqınlanıp ushıp barıp «BOO!» — kartochka qorqıp qaltıraydı
        "obsidian:ghost": async ({ a, b, card }) => {
            const g = put("ghost", a.x, a.y, 50);
            sfx("woo");
            await fly(g, a, b, { arc: 30, dur: 1200, wave: 10, s0: 0.5, o0: 0 });
            sfx("boo");
            react(card, "shiver");
            const by = b.y - 30 < 20 ? b.y + 32 : b.y - 30;
            anim(put("boo", b.x, by, 72), [
                { transform: T(b.x, by, 0, 0) }, { transform: T(b.x, by, -6, 1.2), offset: 0.15 },
                { transform: T(b.x, by, 0, 1), offset: 0.25 }, { transform: T(b.x, by, 0, 1), opacity: 1, offset: 0.8 },
                { transform: T(b.x, by - 10, 0, 1), opacity: 0 },
            ], { duration: 1300 });
            anim(g, [{ transform: T(b.x, b.y, 0, 1), opacity: 1 }, { transform: T(b.x, b.y - 6, 0, 1.6), opacity: 0.9, offset: 0.3 },
                { transform: T(b.x, b.y - 40, 0, 1.2), opacity: 0 }], { duration: 1100 });
        },
        // ⛈ Qara bult: alıwshınıń ústine kelip, eki ret shaqmaq uradı
        "obsidian:storm": async ({ a, b, card }) => {
            const top = { x: b.x + 4, y: Math.max(24, b.y - 36) };
            const c = put("cloud", a.x, a.y, 54);
            sfx("wind");
            await fly(c, a, top, { arc: 40, dur: 750, s0: 0.6 });
            anim(c, [{ transform: T(top.x, top.y) }, { transform: T(top.x - 2, top.y + 1), offset: 0.25 }, { transform: T(top.x + 2, top.y), offset: 0.5 },
                { transform: T(top.x, top.y), opacity: 1, offset: 0.8 }, { transform: T(top.x, top.y - 8), opacity: 0 }], { duration: 1500 });
            const strike = () => {
                sfx("thunder");
                const y0 = top.y + 12, h = Math.max(22, b.y - y0 + 4);
                anim(put("bolt", b.x, y0 + h / 2, h * 0.42, h), [{ opacity: 0 }, { opacity: 1, offset: 0.1 }, { opacity: 0.3, offset: 0.4 },
                    { opacity: 1, offset: 0.55 }, { opacity: 0 }], { duration: 300 });
                cover(card, "flash", { inD: 30, hold: 50, outD: 160, pad: 2 });
                react(card, "zap");
                burst("smoke", b, { n: 3, size: 20, d0: 10, d1: 22, dur: 800, grav: -18, a0: -150, a1: -30, s0: 0.3 });
            };
            strike();
            await wait(420);
            strike();
        },
        // 💰 Teńge qapshıǵı: alıwshınıń ústinde jarılıp, teńgeler jawadı
        "gold:coins": async ({ a, b, card, r }) => {
            const top = { x: b.x + 10, y: b.y - 28 };
            const bag = put("bag", a.x, a.y, 46);
            sfx("throw");
            await fly(bag, a, top, { arc: 70, dur: 750, rot1: 20 });
            sfx("coins");
            anim(bag, [{ transform: T(top.x, top.y, 20, 1), opacity: 1 }, { transform: T(top.x, top.y, 0, 1.4), opacity: 0 }], { duration: 240 });
            const floor = r.bottom - 6;
            for (let i = 0; i < 12; i++) {
                const lx = r.left + 10 + Math.random() * (r.width - 20), px = (top.x + lx) / 2, py = top.y - 16 - Math.random() * 22;
                anim(put("coin", top.x, top.y, 15), [
                    { transform: T(top.x, top.y, 0, 0.5, 0.5), opacity: 1, easing: "ease-out" },
                    { transform: T(px, py, 0, 1, 0.25), offset: 0.3, easing: "ease-in" },
                    { transform: T(lx, floor, 0, 1, 1), offset: 0.62, easing: "ease-out" },
                    { transform: T(lx, floor - 8, 0, 0.3, 1), offset: 0.74, easing: "ease-in" },
                    { transform: T(lx, floor, 0, 1, 1), opacity: 1, offset: 0.86 },
                    { transform: T(lx, floor, 0, 1, 1), opacity: 0 },
                ], { duration: 1300, delay: i * 45, fill: "both" });
            }
            react(card, "shake", 300);
            burst("sparkG", b, { n: 4, size: 14, d0: 10, d1: 34, dur: 900, delay: 350 });
        },
        // 🔨 Altın balǵa: basına urıp, kartochka jalpayadı, juldızlar aylanadı
        "gold:hammer": async ({ a, b, card }) => {
            const top = { x: b.x - 4, y: b.y - 34 };
            const h = put("hammer", a.x, a.y, 50);
            sfx("throw");
            await fly(h, a, top, { arc: 60, dur: 650, rot1: 730 });
            anim(h, [
                { transform: T(top.x, top.y, 730), easing: "ease-in" }, { transform: T(b.x - 10, b.y - 16, 860), offset: 0.16 },
                { transform: T(b.x - 8, b.y - 20, 845), offset: 0.3 }, { transform: T(b.x + 6, b.y - 46, 900), opacity: 1, offset: 0.62 },
                { transform: T(b.x + 14, b.y - 60, 930), opacity: 0 },
            ], { duration: 850 });
            await wait(140);
            sfx("bonk");
            sfx("dizzy", 0.15);
            react(card, "squash");
            flashAt("pow", { x: b.x, y: b.y - 6 }, 56, 380);
            const cx = b.x, cy = b.y - 20;
            for (let k = 0; k < 3; k++) {
                const fr = [];
                for (let i = 0; i <= 24; i++) {
                    const t = i / 24, th = (t * 720 + k * 120) * Math.PI / 180;
                    fr.push({ transform: T(cx + Math.cos(th) * 22, cy + Math.sin(th) * 6, t * 360, 0.75 + 0.25 * Math.sin(th)),
                        opacity: t > 0.85 ? (1 - t) / 0.15 : 1, offset: t });
                }
                anim(put("starY", cx, cy, 14), fr, { duration: 1500 });
            }
        },
        // 🧲 Magnit: alıwshınıń teńgelerin tartıp alıp, jiberiwshige alıp keledi
        "gold:magnet": async ({ a, b, card, from }) => {
            const below = b.y - 36 < 22;
            const hov = { x: b.x, y: below ? b.y + 36 : b.y - 36 };
            const rot = below ? 540 : 360;   // astında bolsa — ushları joqarıǵa (alıwshıǵa) qaraydı
            const m = put("magnet", a.x, a.y, 44);
            sfx("throw");
            await fly(m, a, hov, { arc: 50, dur: 650, rot1: rot });
            sfx("hum");
            sfx("pull");
            react(card, "shake");
            const back = curve(hov, a, 50);
            for (let i = 0; i < 5; i++) {
                const fr = [{ transform: T(b.x, b.y, 0, 0.4, 0.4), opacity: 0, offset: 0 },
                    { transform: T(hov.x, hov.y + (below ? -10 : 10), 0, 1, 0.3), opacity: 1, offset: 0.22 }];
                for (let j = 1; j <= 10; j++) {
                    const p = back(j / 10);
                    fr.push({ transform: T(p.x, p.y, 0, 1, j % 2 ? 0.3 : 1), opacity: j === 10 ? 0 : 1, offset: 0.22 + 0.078 * j });
                }
                anim(put("coin", b.x, b.y, 15), fr, { duration: 1100, delay: 150 + i * 120, fill: "both" });
            }
            await wait(700);
            const fr = frames(hov, a, { arc: 50, rot0: rot, rot1: rot, s1: 0.6 });
            fr[fr.length - 1].opacity = 0;
            anim(m, fr, { duration: 1000, easing: "ease-in" });
            await wait(900);
            sfx("kaching");
            react(from, "bounce");
            burst("sparkG", a, { n: 4, size: 14, d0: 10, d1: 28, dur: 800 });
        },
        // 🍾 Shampan: alıwshınıń janında tıǵını atılıp, kópik shashıladı
        "gold:champagne": async ({ a, b, card, dir }) => {
            const pos = { x: b.x - dir * 30, y: b.y - 4 }, tilt = dir * 55, R = 360 * dir + tilt;
            const bt = put("bottle", a.x, a.y, 50);
            sfx("throw");
            await fly(bt, a, pos, { arc: 60, dur: 700, rot1: R });
            sfx("shake");
            bt.animate([-8, 8, -8, 8, 0].map((d) => ({ transform: T(pos.x, pos.y, R + d) })), { duration: 320 });
            await wait(320);
            sfx("cork");
            sfx("fizz", 0.05);
            const nx = Math.sin(tilt * Math.PI / 180), ny = -Math.cos(tilt * Math.PI / 180);
            const neck = { x: pos.x + nx * 22, y: pos.y + ny * 22 };
            anim(put("cork", neck.x, neck.y, 14), [{ transform: T(neck.x, neck.y), opacity: 1 },
                { transform: T(neck.x + nx * 40 + dir * 10, neck.y - 50, 540 * dir), opacity: 1, offset: 0.6 },
                { transform: T(neck.x + nx * 60, neck.y - 30, 720 * dir), opacity: 0 }], { duration: 700, easing: "ease-out" });
            const ang = Math.atan2(ny, nx) * 180 / Math.PI;
            burst("foam", neck, { n: 16, size: 10, d0: 24, d1: 64, dur: 800, grav: 26, a0: ang - 32, a1: ang + 32, s0: 0.5, s1: 1.2 });
            burst("bubble", b, { n: 6, size: 10, d0: 14, d1: 30, dur: 1300, grav: -30, a0: -160, a1: -20, delay: 200 });
            react(card, "shiver");
            anim(bt, [{ transform: T(pos.x, pos.y, R), opacity: 1 }, { transform: T(pos.x, pos.y, R - dir * 20), opacity: 1, offset: 0.6 },
                { transform: T(pos.x, pos.y + 10, R - dir * 20), opacity: 0 }], { duration: 1200, delay: 300 });
        },
        // 🧊 Muz: kartochka muzlap qaltıraydı, keyin muz shashılıp ketedi
        "gem:freeze": async ({ a, b, card, r }) => {
            const s = put("crystal", a.x, a.y, 40);
            sfx("whooshHi");
            await fly(s, a, b, { arc: 30, dur: 560, rot1: 720, easing: "ease-in" });
            s.remove();
            sfx("freeze");
            burst("snow", b, { n: 8, size: 14, d0: 18, d1: 42, dur: 800 });
            cover(card, "ice", { inD: 140, hold: 1300, outD: 120, pad: 7 });
            react(card, "shiver", 150);
            await wait(1450);
            sfx("shatter");
            burst("iceShard", { x: r.left + r.width / 2, y: r.top + r.height / 2 }, { n: 12, size: 15, d0: 30, d1: 72, dur: 850, grav: 44, spin: 360 });
        },
        // 💘 Kristal oq: kartochkaǵa qadalıp, júreksheler shashıraydı
        "gem:cupid": async ({ a, b, card }) => {
            const dx = b.x - a.x, dy = b.y - a.y, L = Math.hypot(dx, dy) || 1;
            const end = { x: b.x - dx / L * 22, y: b.y - dy / L * 22 };   // júrek ushı — avatarda
            const ar = put("arrow", a.x, a.y, 66, 22);
            sfx("twang");
            await fly(ar, a, end, { arc: 18, dur: 480, orient: true, easing: "ease-in" });
            sfx("hearts");
            const ang = curve(a, end, 18)(1).ang;
            anim(ar, [0, 7, -5, 3, 0].map((d, i) => ({ transform: T(end.x, end.y, ang + d), offset: i * 0.08 }))
                .concat([{ transform: T(end.x, end.y, ang), opacity: 1, offset: 0.8 }, { transform: T(end.x, end.y, ang), opacity: 0 }]), { duration: 1600 });
            react(card, "pulse");
            glow(card, "rgba(244,114,182,.85)", 1300);
            burst("heart", b, { n: 9, size: 16, d0: 24, d1: 52, dur: 1300, grav: -18, a0: -170, a1: -10, s0: 0.4, s1: 1.1 });
        },
        // 🌈 Ráńbáreń kópir: jiberiwshiden alıwshıǵa sızıladı, aqırında kristal ushqınlar
        "gem:rainbow": async ({ a, b, card }) => {
            const ARC = 70, n = normal(a, b);
            sfx("rainbow");
            const mid = { x: (a.x + b.x) / 2 + n.x * ARC * 2, y: (a.y + b.y) / 2 + n.y * ARC * 2 };
            const svg = document.createElementNS(NS, "svg");
            svg.setAttribute("width", innerWidth);
            svg.setAttribute("height", innerHeight);
            svg.style.cssText = "position:absolute;left:0;top:0;overflow:visible";
            layer().appendChild(svg);
            RAINBOW.forEach((c, k) => {
                const o = (k - 2.5) * 4.6, p = document.createElementNS(NS, "path");
                p.setAttribute("d", `M${a.x + n.x * o} ${a.y + n.y * o}Q${mid.x + n.x * o} ${mid.y + n.y * o} ${b.x + n.x * o} ${b.y + n.y * o}`);
                p.setAttribute("fill", "none");
                p.setAttribute("stroke", c);
                p.setAttribute("stroke-width", "5");
                p.setAttribute("stroke-linecap", "round");
                svg.appendChild(p);
                const len = p.getTotalLength();
                p.style.strokeDasharray = `${len}px`;
                p.style.strokeDashoffset = `${len}px`;
                p.animate([{ strokeDashoffset: `${len}px` }, { strokeDashoffset: "0px" }], { duration: 700, delay: k * 35, easing: "ease-out", fill: "forwards" });
            });
            anim(svg, [{ opacity: 1 }, { opacity: 1, offset: 0.75 }, { opacity: 0 }], { duration: 2100 });
            const at = curve(a, b, ARC);
            ["sparkC", "sparkP", "sparkY", "sparkW", "sparkC"].forEach((s, i) => {
                const p = at((i + 1) / 6);
                anim(put(s, p.x, p.y, 16), [{ transform: T(p.x, p.y, 0, 0), opacity: 0 }, { transform: T(p.x, p.y, 90, 1.2), opacity: 1, offset: 0.4 },
                    { transform: T(p.x, p.y, 180, 0), opacity: 0 }], { duration: 900, delay: 700 * (i + 1) / 6, fill: "both" });
            });
            await wait(650);
            sfx("sparkle");
            burst((i) => ["sparkC", "sparkP", "sparkY", "sparkW"][i % 4], b, { n: 12, size: 15, d0: 20, d1: 48, dur: 1000 });
            glow(card, "rgba(103,232,249,.85)", 1300);
            react(card, "bounce");
        },
        // Lazer: kristaldan nur atıladı, kartochka kúyedi
        "gem:laser": async ({ a, b, card }) => {
            const g = { x: a.x, y: a.y - 4 };
            const gem = put("gemStone", g.x, g.y, 36);
            sfx("charge");
            gem.animate([{ transform: T(g.x, g.y, 0, 0) }, { transform: T(g.x, g.y, 0, 1.15), offset: 0.7 }, { transform: T(g.x, g.y, 0, 1) }], { duration: 260, fill: "forwards" });
            await wait(260);
            const dx = b.x - g.x, dy = b.y - g.y, L = Math.hypot(dx, dy), ang = Math.atan2(dy, dx) * 180 / Math.PI;
            const beam = document.createElement("div");
            beam.style.cssText = `position:absolute;left:0;top:0;width:${L}px;height:6px;border-radius:3px;transform-origin:0 50%;` +
                "background:linear-gradient(90deg,rgba(165,243,252,.2),#67E8F9 12%,#fff 50%,#F9A8D4 88%,#F472B6);" +
                "box-shadow:0 0 8px 2px rgba(103,232,249,.8),0 0 16px 4px rgba(244,114,182,.5)";
            const base = `translate(${g.x}px,${g.y - 3}px) rotate(${ang}deg)`;
            beam.style.transform = base + " scaleX(0)";
            layer().appendChild(beam);
            sfx("laser");
            anim(beam, [{ transform: base + " scaleX(0)", opacity: 1 }, { transform: base + " scaleX(1)", opacity: 1, offset: 0.14 },
                { transform: base + " scaleX(1)", opacity: 0.65, offset: 0.3 }, { transform: base + " scaleX(1)", opacity: 1, offset: 0.45 },
                { transform: base + " scaleX(1)", opacity: 0.7, offset: 0.62 }, { transform: base + " scaleX(1)", opacity: 0 }], { duration: 1050 });
            await wait(150);
            for (let i = 0; i < 3; i++) burst((k) => (k % 2 ? "sparkC" : "sparkW"), b, { n: 5, size: 11, d0: 12, d1: 28, dur: 420, delay: i * 230 });
            anim(put("scorch", b.x, b.y, 38), [{ opacity: 0 }, { opacity: 1, offset: 0.15 }, { opacity: 1, offset: 0.7 }, { opacity: 0 }], { duration: 1400 });
            react(card, "zap");
            react(card, "shake", 450);
            glow(card, "rgba(244,114,182,.8)", 1000);
            await wait(800);
            fadeOut(gem);
        },
        // Patsha zambıregi: jiberiwshiniń janınan atadı, oq alıwshınıń ústinde jarıladı
        "crown:cannon": async ({ a, b, card, dir }) => {
            const p = { x: a.x + dir * 6, y: a.y - 8 };
            const cn = put("cannon", p.x, p.y, 50);
            sfx("clunk");
            cn.animate([{ transform: T(p.x, p.y, 0, 0, 0) }, { transform: T(p.x, p.y, 0, 1.1 * dir, 1.1), offset: 0.7 }, { transform: T(p.x, p.y, 0, dir, 1) }], { duration: 260, fill: "forwards" });
            await wait(380);
            sfx("cannon");
            cn.animate([{ transform: T(p.x, p.y, 0, dir, 1) }, { transform: T(p.x - dir * 7, p.y + 2, -dir * 6, dir, 1), offset: 0.2 }, { transform: T(p.x, p.y, 0, dir, 1) }], { duration: 380 });
            const mz = { x: p.x + dir * 17, y: p.y - 4 };
            flashAt("boomR", mz, 34, 260);
            burst("smoke", mz, { n: 3, size: 22, d0: 8, d1: 20, dur: 900, grav: -16, s0: 0.4, s1: 1.2 });
            const ball = put("ball", mz.x, mz.y, 18);
            await fly(ball, mz, b, { arc: 70, dur: 650 });
            ball.remove();
            boom(b, "boomR", "smoke", "ember");
            react(card, "heavy");
            cover(card, "soot", { hold: 1000 });
            fadeOut(cn, 400, 200);
        },
        // 🔥 Ot sharı: izinde ushqınlar, kartochka janadı, keyin qurım qaladı
        "crown:fireball": async ({ a, b, card, r }) => {
            const fb = put("fireball", a.x, a.y, 60, 30);
            sfx("fire");
            const at = curve(a, b, 45);
            for (let i = 1; i <= 8; i++) {
                const p = at(i / 9);
                anim(put("ember", p.x, p.y, 8), [{ transform: T(p.x, p.y), opacity: 0 }, { transform: T(p.x, p.y), opacity: 1, offset: 0.05 },
                    { transform: T(p.x + (Math.random() - 0.5) * 10, p.y - 14, 0, 0.4), opacity: 0 }], { duration: 600, delay: 650 * i / 9, fill: "both" });
            }
            await fly(fb, a, b, { arc: 45, dur: 650, orient: true, easing: "ease-in" });
            fb.remove();
            sfx("burn");
            burst("ember", b, { n: 10, size: 9, d0: 18, d1: 40, dur: 650 });
            glow(card, "rgba(249,115,22,.9)", 1500);
            react(card, "shake");
            for (let i = 0; i < 4; i++) {
                const x = r.left + r.width * (0.14 + i * 0.24), y = r.bottom - 14;
                anim(put("flame", x, y, 24, 36), [{ transform: T(x, y, 0, 0.2, 0.2), opacity: 0 }, { transform: T(x, y - 4, 0, 1, 1), opacity: 1, offset: 0.15 },
                    { transform: T(x, y - 6, 0, 1.05, 1.2), opacity: 1, offset: 0.75 }, { transform: T(x, y - 14, 0, 0.4, 0.4), opacity: 0 }],
                { duration: 1500, delay: i * 60, fill: "both" });
            }
            await wait(1300);
            burst("smoke", { x: r.left + r.width / 2, y: r.top + 6 }, { n: 3, size: 24, d0: 8, d1: 22, dur: 1000, grav: -20, a0: -150, a1: -30, s0: 0.4, s1: 1.2 });
            cover(card, "soot", { inD: 200, hold: 600 });
        },
        // 🎉 Bayram: alıwshınıń janında konfetti atıladı
        "crown:party": async ({ a, b, card, dir }) => {
            const pos = { x: b.x - dir * 18, y: b.y + 10 }, R = 360 * dir;
            const pp = put("popper", a.x, a.y, 44);
            sfx("throw");
            await fly(pp, a, pos, { arc: 60, dur: 650, rot1: R });
            sfx("popper");
            sfx("kazoo");
            anim(pp, [{ transform: T(pos.x, pos.y, R, 1) }, { transform: T(pos.x - dir * 4, pos.y + 4, R - dir * 10, 1.2), offset: 0.25 },
                { transform: T(pos.x, pos.y, R, 1), opacity: 1, offset: 0.6 }, { transform: T(pos.x, pos.y + 6, R, 0.9), opacity: 0 }], { duration: 900 });
            const mouth = { x: pos.x + 5, y: pos.y - 4 };
            burst((i) => "confetti" + (i % CONFETTI.length), mouth, { n: 26, size: 10, d0: 40, d1: 95, dur: 1500, grav: 70, a0: -165, a1: -15, spin: 540, s0: 0.6 });
            burst((i) => "streamer" + (i % CONFETTI.length), mouth, { n: 4, size: 28, d0: 30, d1: 60, dur: 1400, grav: 40, a0: -150, a1: -30, spin: 120 });
            react(card, "bounce");
            glow(card, "rgba(245,197,66,.85)", 1200);
        },
        // 🎺 Kerney: notalar ushıp barıp, alıwshınıń kartochkasında patsha «GG» bayraǵı
        "crown:fanfare": async ({ a, b, card, dir, r }) => {
            const p = { x: a.x + dir * 10, y: a.y - 10 };
            const tp = put("horn", p.x, p.y, 46);
            tp.animate([{ transform: T(p.x, p.y, 0, 0, 0) }, { transform: T(p.x, p.y, -dir * 10, dir * 1.1, 1.1), offset: 0.7 },
                { transform: T(p.x, p.y, -dir * 10, dir, 1) }], { duration: 260, fill: "forwards" });
            await wait(260);
            sfx("fanfare");
            tp.animate([1, 1.14, 1, 1.14, 1, 1.14, 1].map((s) => ({ transform: T(p.x, p.y, -dir * 10, dir * s, s) })), { duration: 900 });
            const bell = { x: p.x + dir * 20, y: p.y - 6 }, end = { x: b.x, y: b.y - 16 };
            for (let i = 0; i < 6; i++) {
                const fr = frames(bell, end, { arc: 30, wave: 8, s0: 0.5, o0: 0 });
                fr[fr.length - 1].opacity = 0;
                anim(put(i % 2 ? "noteP" : "note", bell.x, bell.y, 16), fr, { duration: 900, delay: i * 130, fill: "both" });
            }
            await wait(1000);
            const bx = r.left + r.width / 2, by = r.top > 50 ? r.top - 16 : r.bottom + 16;
            anim(put("banner", bx, by, 100, 36), [{ transform: T(bx, by, 0, 0, 1) }, { transform: T(bx, by, 0, 1.12, 1), offset: 0.12 },
                { transform: T(bx, by, 0, 1, 1), opacity: 1, offset: 0.2 }, { transform: T(bx, by, 0, 1, 1), opacity: 1, offset: 0.85 },
                { transform: T(bx, by - 8, 0, 1, 1), opacity: 0 }], { duration: 1700 });
            react(card, "bounce");
            glow(card, "rgba(245,197,66,.85)", 1200);
            burst("sparkG", { x: bx, y: by }, { n: 6, size: 13, d0: 30, d1: 56, dur: 900 });
            fadeOut(tp);
        },
    };

    // Stikerdi oynatıw: jiberiwshi kartochkasınan alıwshı kartochkasına (avatar — «bası»)
    function play(id, fromCard, toCard) {
        const fx = FX[id];
        if (!fx || !fromCard || !toCard || !document.body.animate) return false;
        preload();
        const aim = (card) => {
            const r = (card.querySelector(".avatar") || card).getBoundingClientRect();
            return { x: r.left + r.width / 2, y: r.top + r.height / 2, w: r.width };
        };
        const a = aim(fromCard), b = aim(toCard);
        if (!a.w || !b.w) return false;
        fx({ a, b, card: toCard, from: fromCard, dir: b.x >= a.x ? 1 : -1, r: toCard.getBoundingClientRect() }).catch(() => {});
        return true;
    }

    const packOf = (id) => {
        const [skin, name] = String(id || "").split(":");
        return PACKS[skin] && PACKS[skin].includes(name) ? skin : null;
    };

    global.LudoStickers = {
        packs: PACKS,
        ids: (skin) => (PACKS[skin] || []).map((n) => `${skin}:${n}`),
        packOf,
        isSkin: (id) => packOf(id) !== null,
        dataUri: (id) => (TILE[id] ? src(TILE[id]) : ""),
        play,
        preload,
    };
})(window);