(function () {
    const THEMES = {
        neon: {
            img: "/static/img/board-neon.png",
            bg: "#0B0E1F",
            ring: "rgba(255,255,255,.85)",
            ringHi: "#00DFFF",
            dims: {
                red: "rgba(255,65,112,.4)",
                green: "rgba(44,245,158,.4)",
                yellow: "rgba(255,225,74,.4)",
                blue: "rgba(63,182,255,.4)"
            }
        },
        classic: {
            bg: "#F4F1E9",
            ring: "rgba(70,78,88,.7)",
            ringHi: "#596B7A",
            dims: {
                red: "rgba(202,91,83,.18)",
                green: "rgba(74,145,91,.18)",
                yellow: "rgba(204,164,63,.18)",
                blue: "rgba(75,132,190,.18)"
            }
        }
    };

    // Classic 15x15 Ludo board. The transparent grid layer above this SVG
    // remains responsible for movement, selectable cells and piece positions.
    function classicArt() {
        return `<svg class="board-art board-art-classic" viewBox="0 0 600 600" role="img" aria-label="Classic Ludo board" style="position:absolute;inset:0;width:100%;height:100%;pointer-events:none;z-index:0">
            <rect x="8" y="8" width="584" height="584" rx="12" fill="#FFFDF8" stroke="#B8B5AC" stroke-width="5"/>
            <rect x="26" y="26" width="219.2" height="219.2" fill="#BFDCC5"/>
            <rect x="354.8" y="26" width="219.2" height="219.2" fill="#F0E2B7"/>
            <rect x="354.8" y="354.8" width="219.2" height="219.2" fill="#C5D8EA"/>
            <rect x="26" y="354.8" width="219.2" height="219.2" fill="#EBC9C5"/>
            <g fill="none" stroke="#8E918D" stroke-width="2.2">
                <rect x="26" y="26" width="219.2" height="219.2"/>
                <rect x="354.8" y="26" width="219.2" height="219.2"/>
                <rect x="354.8" y="354.8" width="219.2" height="219.2"/>
                <rect x="26" y="354.8" width="219.2" height="219.2"/>
            </g>
<g fill="#FCFBF7" stroke="#FFFFFF" stroke-width="2"><circle cx="135.6" cy="135.6" r="88"/><circle cx="464.4" cy="135.6" r="88"/><circle cx="464.4" cy="464.4" r="88"/><circle cx="135.6" cy="464.4" r="88"/></g>
            <g fill="#FCFBF7" stroke-width="4">
                <circle cx="80.9" cy="80.9" r="17" stroke="#79A987"/>
                <circle cx="190.5" cy="80.9" r="17" stroke="#79A987"/>
                <circle cx="80.9" cy="190.5" r="17" stroke="#79A987"/>
                <circle cx="190.5" cy="190.5" r="17" stroke="#79A987"/>
                <circle cx="409.5" cy="80.9" r="17" stroke="#C1A45C"/>
                <circle cx="519.1" cy="80.9" r="17" stroke="#C1A45C"/>
                <circle cx="409.5" cy="190.5" r="17" stroke="#C1A45C"/>
                <circle cx="519.1" cy="190.5" r="17" stroke="#C1A45C"/>
                <circle cx="409.5" cy="409.5" r="17" stroke="#7D9FBE"/>
                <circle cx="519.1" cy="409.5" r="17" stroke="#7D9FBE"/>
                <circle cx="409.5" cy="519.1" r="17" stroke="#7D9FBE"/>
                <circle cx="519.1" cy="519.1" r="17" stroke="#7D9FBE"/>
                <circle cx="80.9" cy="409.5" r="17" stroke="#C28C85"/>
                <circle cx="190.5" cy="409.5" r="17" stroke="#C28C85"/>
                <circle cx="80.9" cy="519.1" r="17" stroke="#C28C85"/>
                <circle cx="190.5" cy="519.1" r="17" stroke="#C28C85"/>
            </g>
            <path d="M245.2 245.2H354.8V354.8H245.2Z" fill="#FBFAF6" stroke="#8E918D" stroke-width="2.2"/>
            <path d="M245.2 245.2L300 300L354.8 245.2Z" fill="#F0E2B7"/>
            <path d="M354.8 245.2L300 300L354.8 354.8Z" fill="#C5D8EA"/>
            <path d="M354.8 354.8L300 300L245.2 354.8Z" fill="#EBC9C5"/>
            <path d="M245.2 354.8L300 300L245.2 245.2Z" fill="#BFDCC5"/>
            <circle cx="300" cy="300" r="8" fill="#FFFDF8" stroke="#A8A397" stroke-width="2"/>
            <g fill="none" stroke="#FFFFFF" stroke-width="1.5" opacity=".55">
                <path d="M26 252H245M355 252H574M26 348H245M355 348H574"/>
            </g>
        </svg>`;
    }

    function art(id) {
        if (id === "classic") return classicArt();
        const th = THEMES[id] || THEMES.neon;
        return '<img class="board-art" src="' + th.img + '" alt="Board" style="position:absolute;inset:0;width:100%;height:100%;object-fit:fill;pointer-events:none;z-index:0;">';
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

    window.BoardThemes = { ids: Object.keys(THEMES), has: id => id in THEMES, art, vars };
})();
