(function () {
    const THEMES = {
        neon: {
            img: "/static/img/board-neon.png",
            bg: "#0B0E1F",
            ring: "rgba(255, 255, 255, 0.85)",
            ringHi: "#FFE14A",
            dims: { red: "rgba(255,65,112,0.4)", green: "rgba(44,245,158,0.4)", yellow: "rgba(255,225,74,0.4)", blue: "rgba(63,182,255,0.4)" }
        },
        royal: {
            img: "/static/img/board-royal.png",
            bg: "#121B33",
            ring: "rgba(255, 243, 196, 0.9)",
            ringHi: "#F5C542",
            dims: { red: "rgba(229,70,62,0.4)", green: "rgba(34,164,93,0.4)", yellow: "rgba(245,181,33,0.4)", blue: "rgba(45,127,224,0.4)" }
        }
    };

    function art(id) {
        const th = THEMES[id] || THEMES.neon;
        return `<img class="board-art" src="${th.img}" alt="Board" style="position:absolute;inset:0;width:100%;height:100%;object-fit:fill;pointer-events:none;z-index:0;">`;
    }

    function vars(id) {
        const th = THEMES[id] || THEMES.neon;
        return {
            "--board-bg": th.bg,
            "--dim-red": th.dims.red,
            "--dim-green": th.dims.green,
            "--dim-yellow": th.dims.yellow,
            "--dim-blue": th.dims.blue,
            "--ring": th.ring,
            "--ring-hi": th.ringHi
        };
    }

    window.BoardThemes = {
        ids: Object.keys(THEMES),
        has: (id) => id in THEMES,
        art,
        vars
    };
})();
