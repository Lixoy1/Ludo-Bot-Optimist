(function (global) {
    const PALETTE = {
        red:    { top: "#EC625B", base: "#E5463E", dark: "#A3302A" },
        green:  { top: "#3BB772", base: "#22A45D", dark: "#167040" },
        yellow: { top: "#F8C447", base: "#F5B521", dark: "#A87A12" },
        blue:   { top: "#4B93E8", base: "#2D7FE0", dark: "#1D5AA3" },
    };
    const COLORS = Object.keys(PALETTE);

    const CHARACTERS = [
        "optimist", "elvina", "cat", "husky", "ksyusha", "lena",
        "lilya-detective", "natalie", "nikita", "owl", "poison", "raccoon"
    ];

    function charUrl(skin) {
        if (!CHARACTERS.includes(skin)) skin = "optimist";
        return `/static/img/characters/${skin}.webp`;
    }

    function dataUri(skin, color) {
        return charUrl(skin);
    }

    function injectPieceStyles() {
        if (typeof document === "undefined" || document.getElementById("piece-skin-styles")) return;
        const rules = [];
        for (const color of COLORS) {
            rules.push(`.piece.${color} { --pin: url("${charUrl("optimist")}"); --player-color: ${PALETTE[color].base}; }`);
            for (const ch of CHARACTERS) {
                rules.push(`.piece.${color}[data-skin="${ch}"] { --pin: url("${charUrl(ch)}"); }`);
            }
            rules.push(`.piece.${color}[data-skin="obsidian"] { --pin: url("${charUrl("poison")}"); }`);
            rules.push(`.piece.${color}[data-skin="gold"] { --pin: url("${charUrl("optimist")}"); }`);
            rules.push(`.piece.${color}[data-skin="gem"] { --pin: url("${charUrl("elvina")}"); }`);
            rules.push(`.piece.${color}[data-skin="crown"] { --pin: url("${charUrl("nikita")}"); }`);
        }
        const style = document.createElement("style");
        style.id = "piece-skin-styles";
        style.textContent = rules.join("\n");
        document.head.appendChild(style);
    }

    const REDUCED_MOTION = typeof matchMedia === "function" && matchMedia("(prefers-reduced-motion: reduce)").matches;
    const EASE_OUT = "cubic-bezier(.2,.7,.3,1)";
    const rand = (a, b) => a + Math.random() * (b - a);

    function spawn(host, cls, x, y, size, frames, duration, delay, opts) {
        const o = opts || {};
        const w = o.w || size, h = o.h || size;
        const el = document.createElement("div");
        el.className = "fx " + cls;
        el.style.width = w + "px";
        el.style.height = h + "px";
        el.style.left = (x - w / 2) + "px";
        el.style.top = (y - h / 2) + "px";
        if (o.bg) el.style.background = o.bg;
        host.appendChild(el);
        const kill = () => { if (el.parentNode) el.remove(); };
        if (typeof el.animate === "function") {
            const a = el.animate(frames, { duration, delay: delay || 0, easing: o.easing || EASE_OUT, fill: "both" });
            a.onfinish = kill;
        }
        setTimeout(kill, (delay || 0) + duration + 250);
    }

    function ring(host, cls, x, y, size, scaleTo, duration, delay) {
        const k = scaleTo || 1.5;
        spawn(host, cls, x, y, size, [
            { transform: "scale(.25)", opacity: 1 },
            { transform: `scale(${(0.25 + k) / 2})`, opacity: 0.9, offset: 0.45 },
            { transform: `scale(${k})`, opacity: 0 },
        ], duration || 600, delay);
    }

    function burst(host, cls, x, y, n, sz, dist, duration, delay0) {
        for (let i = 0; i < n; i++) {
            const a = (i / n) * Math.PI * 2 + rand(-0.25, 0.25), d = rand(dist[0], dist[1]);
            const dx = Math.cos(a) * d, dy = Math.sin(a) * d, rot = rand(120, 300);
            spawn(host, cls, x, y, rand(sz[0], sz[1]), [
                { transform: "translate(0,0) scale(.3) rotate(0deg)", opacity: 1 },
                { transform: `translate(${dx * 0.72}px, ${dy * 0.72}px) scale(1) rotate(${rot * 0.7}deg)`, opacity: 1, offset: 0.55 },
                { transform: `translate(${dx}px, ${dy}px) scale(.85) rotate(${rot}deg)`, opacity: 0 },
            ], duration, (delay0 || 0) + i * 14);
        }
    }

    function playFxAt(kind, skin, host, x, y, cell) {
        if (REDUCED_MOTION || !host) return;
        if (kind === "capture") {
            ring(host, "fx-ring-gold", x, y, cell * 1.3, 2.2, 800);
            burst(host, "fx-star-crown", x, y, 10, [cell * 0.4, cell * 0.6], [cell * 1.0, cell * 2.0], 1000);
        } else if (kind === "enter") {
            ring(host, "fx-ring-gem", x, y, cell * 1.2, 1.7, 700);
            burst(host, "fx-spark-gem", x, y, 6, [cell * 0.4, cell * 0.6], [cell * 0.7, cell * 1.2], 800);
        } else if (kind === "finish") {
            ring(host, "fx-ring-gold", x, y, cell * 1.5, 2.4, 900);
            burst(host, "fx-coin-gold", x, y, 16, [cell * 0.4, cell * 0.55], [cell * 1.2, cell * 2.5], 1400);
        }
    }

    function playFx(kind, skin, board, coord, color) {
        if (!board || !coord) return;
        const grid = board.querySelector(".board-grid-inner") || board;
        const cell = grid.clientWidth / 15;
        playFxAt(kind, skin, grid, (coord[1] + 0.5) * cell, (coord[0] + 0.5) * cell, cell, color);
    }

    function playDiceFx(skin, diceEl) {
        if (REDUCED_MOTION || !diceEl) return;
        const s = diceEl.clientWidth || 58;
        ring(diceEl, "fx-ring-gold", s / 2, s / 2, s, 1.7, 600);
    }

    global.LudoSkins = {
        ids: CHARACTERS,
        colors: COLORS,
        dataUri,
        injectPieceStyles,
        playFx,
        playFxAt,
        playDiceFx,
        soundFiles: () => [],
        soundKey: () => null,
    };
})(window);
