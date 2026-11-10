const tg = window.Telegram.WebApp;
tg.expand();

// ─────────────────── Telegram «chrome» (header/fon/lifecycle) ────────────────
// Mini App'tı Telegram interfeysi menen tegis qospalastıramız. Barlıq shaqırıwlar
// qátege shıdamlı: eski Telegram versiyalarında yamasa lokal brauzerde (dev)
// bul metodlar bolmawı múmkin — bolmasa úndemey ótkerip jiberemiz.
try { tg.ready && tg.ready(); } catch (e) {}
// Header hám fon oyınnıń qara temasına sáykes (aq/kók default header oyın ústinde
// «jamaw» bolıp turmawı ushın). Reń style.css-tegi --bg-1 penen birdey.
try { tg.setHeaderColor && tg.setHeaderColor('#10162A'); } catch (e) {}
try { tg.setBackgroundColor && tg.setBackgroundColor('#0B0F1A'); } catch (e) {}
// Oyın ishinde tastı basıw/súyriw waqtında Mini App qáте túrde tómenge súyrilip
// kishireymewi/jabılmawı ushın tik swipe'ti óshiremiz (Bot API 7.7+).
try { tg.disableVerticalSwipes && tg.disableVerticalSwipes(); } catch (e) {}

// ────────────────────────── Haptic feedback (Telegram) ──────────────────────
// Tastıń júrisi, jeliniw, náwbet hám jeńis sıyaqlı sátlerde telefon jeńil
// dirildeydi — oyın «premium» sezimin beredi. Barlıq shaqırıwlar qátege
// shıдамлы (HapticFeedback bolmasa yamasa qollanбаса — úndemey ótkeremiz).
const HF = (tg && tg.HapticFeedback) ? tg.HapticFeedback : null;

// ── Paydalanıwshı sazlamaları (Menyu popup) — localStorage'ta saqlanadı ──
// '0' = óshirilgen; basqa/joq = qosılǵan (default: qosılǵan).
let soundEnabled = localStorage.getItem('ludo_sound') !== '0';
let vibrationEnabled = localStorage.getItem('ludo_vibration') !== '0';

function hapticImpact(style) {   // 'light' | 'medium' | 'heavy' | 'rigid' | 'soft'
    if (!vibrationEnabled) return;
    try { HF && HF.impactOccurred(style); } catch (e) {}
}
function hapticNotify(type) {     // 'error' | 'success' | 'warning'
    if (!vibrationEnabled) return;
    try { HF && HF.notificationOccurred(type); } catch (e) {}
}
function hapticSelection() {
    if (!vibrationEnabled) return;
    try { HF && HF.selectionChanged(); } catch (e) {}
}

// ─────────────────────────── Kóp tillilik (i18n) ────────────────────────────
// LANG — index.html serverden injekciyalaydı (bólme tili = gruppa/jeke chat tili).
const APP_LANG = (typeof LANG !== 'undefined' && LANG) ? LANG : 'en';
const I18N = {
    en: {
        welcome: "Welcome to Ludo King", create_game: "Create game",
        color_red: "Red", color_green: "Green", color_blue: "Blue", color_yellow: "Yellow",
        game_over: "Finished!", chat: "Chat", chat_ph: "Type a message...", chat_vip_only: "⚜️ Only players and VIPs can write here", chat_locked_ph: "⚜️ Players & VIP only", voice_aria: "Microphone", voice_on: "🎤 Microphone on — everyone in the game hears you", voice_off: "🔇 Microphone off", voice_denied: "🎤 Microphone access was denied", voice_denied_android: "🎤 No microphone access. Phone Settings → Apps → Telegram → Permissions → Microphone → Allow", voice_denied_ios: "🎤 No microphone access. iPhone Settings → Telegram → turn on Microphone", voice_nomic: "🎤 No microphone found on this device", voice_busy: "🎤 The microphone is busy in another app (call, recorder). Close it and try again", voice_unsupported: "🎤 This Telegram version doesn't support the microphone. Please update Telegram", voice_failed: "🎤 Couldn't turn on the microphone. Please try again", voice_vip_only: "⚜️ The microphone is for VIP only. Get VIP in the Shop",
        send_sticker: "Send a sticker", pp_games: "Games", pp_wins: "Wins", pp_rate: "Win rate", pp_badges: "Badges", pp_me: "This is you", pp_react: "React", pp_mute: "Mute", pp_unmute: "Unmute", stickers_general: "General", sticker_locked: "🔒 Unlocks with the «{skin}» skin — get the skin or ⚜️ VIP in the Shop", skin_obsidian: "Obsidian", skin_gold: "Gold", skin_gem: "Crystal", skin_crown: "Crown", error: "An error occurred!",
        no_server: "Could not connect to the server.", cancelled: "❌ Registration cancelled.",
        link_copied: "Link copied! Send it to your friends.", join_game: "Join the game",
        team_a: "Team A", team_b: "Team B", game_finished: "GAME OVER!",
        title_single: "Standard", title_random: "Random", title_team: "Team", title_team_random: "Team-Random", title_quick: "Quick game", title_blitz: "Blitz",
        menu: "Menu", leave_game: "Leave game", sound: "Sound", vibration: "Vibration", on: "On", off: "Off",
        leave_confirm: "Leave the game?",
        waiting_players: "Waiting for players", you: "You", close: "Close",
        choose_character: "Choose your character", choose_character_note: "Pick the character you will use in this match.", confirm_character: "Choose and join", voice_note: "Voice message", recording: "Recording… tap to send",
    },
    ru: {
        welcome: "Добро пожаловать в Ludo King", create_game: "Создать игру",
        color_red: "Красный", color_green: "Зелёный", color_blue: "Синий", color_yellow: "Жёлтый",
        game_over: "Игра окончена!", chat: "Чат", chat_ph: "Введите сообщение...", chat_vip_only: "⚜️ Писать могут только игроки и VIP", chat_locked_ph: "⚜️ Только игроки и VIP", voice_aria: "Микрофон", voice_on: "🎤 Микрофон включён — вас слышат все в игре", voice_off: "🔇 Микрофон выключен", voice_denied: "🎤 Нет доступа к микрофону", voice_denied_android: "🎤 Нет доступа к микрофону. Настройки телефона → Приложения → Telegram → Разрешения → Микрофон → Разрешить", voice_denied_ios: "🎤 Нет доступа к микрофону. Настройки iPhone → Telegram → включите Микрофон", voice_nomic: "🎤 На устройстве не найден микрофон", voice_busy: "🎤 Микрофон занят другим приложением (звонок, диктофон). Закройте его и попробуйте снова", voice_unsupported: "🎤 Эта версия Telegram не поддерживает микрофон. Обновите Telegram", voice_failed: "🎤 Не удалось включить микрофон. Попробуйте ещё раз", voice_vip_only: "⚜️ Микрофон — только для VIP. VIP можно купить в Магазине",
        send_sticker: "Отправить стикер", pp_games: "Игры", pp_wins: "Победы", pp_rate: "% побед", pp_badges: "Значки", pp_me: "Это вы", pp_react: "Реакция", pp_mute: "Заглушить", pp_unmute: "Включить звук", stickers_general: "Общие", sticker_locked: "🔒 Открывается со скином «{skin}» — купите скин или ⚜️ VIP в Магазине", skin_obsidian: "Обсидиан", skin_gold: "Золото", skin_gem: "Кристалл", skin_crown: "Корона", error: "Произошла ошибка!",
        no_server: "Не удалось подключиться к серверу.", cancelled: "❌ Регистрация отменена.",
        link_copied: "Ссылка скопирована! Отправьте её друзьям.", join_game: "Войти в игру",
        team_a: "Команда A", team_b: "Команда B", game_finished: "ИГРА ОКОНЧЕНА!",
        title_single: "Стандарт", title_random: "Случайный", title_team: "Команда", title_team_random: "Команда-Случайный", title_quick: "Быстрая игра", title_blitz: "Блиц",
        menu: "Меню", leave_game: "Выйти из игры", sound: "Звук", vibration: "Вибрация", on: "Вкл", off: "Выкл",
        leave_confirm: "Выйти из игры?",
        waiting_players: "Ожидание игроков", you: "Вы", close: "Закрыть",
        choose_character: "Выберите персонажа", choose_character_note: "Выберите героя, которым будете играть в этом матче.", confirm_character: "Выбрать и войти", voice_note: "Голосовое сообщение", recording: "Идёт запись… нажмите, чтобы отправить",
    },
    kaa: {
        welcome: "Ludo King-ke xosh keldińiz", create_game: "Oyın jaratıw",
        color_red: "Qızıl", color_green: "Jasıl", color_blue: "Kók", color_yellow: "Sarı",
        game_over: "Juwmaqlandı!", chat: "Chat", chat_ph: "Xabar jazıń...", chat_vip_only: "⚜️ Tek oyınshılar hám VIP'ler jaza aladı", chat_locked_ph: "⚜️ Tek oyınshılar hám VIP", voice_aria: "Mikrofon", voice_on: "🎤 Mikrofon qosıldı — oyındaǵılardıń hámmesi sizdi esitedi", voice_off: "🔇 Mikrofon óshirildi", voice_denied: "🎤 Mikrofonǵa ruqsat berilmedi", voice_denied_android: "🎤 Mikrofonǵa ruqsat joq. Telefon sazlamaları → Qosımshalar → Telegram → Ruqsatlar → Mikrofon → «Ruqsat etiw»", voice_denied_ios: "🎤 Mikrofonǵa ruqsat joq. iPhone sazlamaları → Telegram → Mikrofon'dı qosıń", voice_nomic: "🎤 Bul qurılmada mikrofon tabılmadı", voice_busy: "🎤 Mikrofon basqa qosımshada bánt (qońıraw, dawıs jazıw). Sonı jawıp, qayta urınıń", voice_unsupported: "🎤 Telegram'nıń bul versiyası mikrofondı qollamaydı. Telegram'dı jańalań", voice_failed: "🎤 Mikrofon qosılmadı. Qayta urınıp kóriń", voice_vip_only: "⚜️ Mikrofon — tek VIP ushın. VIP'ti Dúkanda alıwǵa boladı",
        send_sticker: "Stiker jiberiw", pp_games: "Oyınlar", pp_wins: "Jeńisler", pp_rate: "Jeńis %", pp_badges: "Nıshanlar", pp_me: "Bul siz", pp_react: "Reakciya", pp_mute: "Dawısın óshir", pp_unmute: "Dawısın qos", stickers_general: "Ulıwma", sticker_locked: "🔒 «{skin}» skini menen ashıladı — Dúkannan skin yamasa ⚜️ VIP alıń", skin_obsidian: "Obsidian", skin_gold: "Altın", skin_gem: "Kristal", skin_crown: "Taj", error: "Qáte júz berdi!",
        no_server: "Server menen baylanısıp bolmadı.", cancelled: "❌ Dizimnen ótiw qaldırıldı.",
        link_copied: "Silteme kóshirildi! Doslarıńızǵa jiberiń.", join_game: "Oyınǵa qosılıw",
        team_a: "A komanda", team_b: "B komanda", game_finished: "OYIN TAMAMLANDI!",
        title_single: "Standart", title_random: "Random", title_team: "Komanda", title_team_random: "Komanda-Random", title_quick: "Tez oyın", title_blitz: "Blits",
        menu: "Menyu", leave_game: "Oyınnan shıǵıw", sound: "Dawıs", vibration: "Vibratsiya", on: "Qosıq", off: "Óshik",
        leave_confirm: "Oyınnan shıǵasızba?",
        waiting_players: "Oyınshılar kútilmekte", you: "Siz", close: "Jabıw",
    },
    kk: {
        welcome: "Ludo King-ке қош келдіңіз", create_game: "Ойын жасау",
        color_red: "Қызыл", color_green: "Жасыл", color_blue: "Көк", color_yellow: "Сары",
        game_over: "Аяқталды!", chat: "Чат", chat_ph: "Хабар жазыңыз...", chat_vip_only: "⚜️ Тек ойыншылар мен VIP-тер жаза алады", chat_locked_ph: "⚜️ Тек ойыншылар мен VIP", voice_aria: "Микрофон", voice_on: "🎤 Микрофон қосылды — ойындағылардың бәрі сізді естиді", voice_off: "🔇 Микрофон өшірілді", voice_denied: "🎤 Микрофонға рұқсат берілмеді", voice_denied_android: "🎤 Микрофонға рұқсат жоқ. Телефон баптаулары → Қолданбалар → Telegram → Рұқсаттар → Микрофон → Рұқсат ету", voice_denied_ios: "🎤 Микрофонға рұқсат жоқ. iPhone баптаулары → Telegram → Микрофонды қосыңыз", voice_nomic: "🎤 Бұл құрылғыда микрофон табылмады", voice_busy: "🎤 Микрофон басқа қолданбада бос емес (қоңырау, диктофон). Оны жауып, қайта көріңіз", voice_unsupported: "🎤 Telegram-ның бұл нұсқасы микрофонды қолдамайды. Telegram-ды жаңартыңыз", voice_failed: "🎤 Микрофон қосылмады. Қайта көріңіз", voice_vip_only: "⚜️ Микрофон — тек VIP үшін. VIP-ті Дүкеннен алуға болады",
        send_sticker: "Стикер жіберу", pp_games: "Ойындар", pp_wins: "Жеңістер", pp_rate: "Жеңіс %", pp_badges: "Белгілер", pp_me: "Бұл сіз", pp_react: "Реакция", pp_mute: "Дыбысын өшіру", pp_unmute: "Дыбысын қосу", stickers_general: "Жалпы", sticker_locked: "🔒 «{skin}» скинімен ашылады — Дүкеннен скин немесе ⚜️ VIP алыңыз", skin_obsidian: "Обсидиан", skin_gold: "Алтын", skin_gem: "Кристалл", skin_crown: "Тәж", error: "Қате орын алды!",
        no_server: "Сервермен байланысу мүмкін болмады.", cancelled: "❌ Тіркеу тоқтатылды.",
        link_copied: "Сілтеме көшірілді! Достарыңызға жіберіңіз.", join_game: "Ойынға қосылу",
        team_a: "A командасы", team_b: "B командасы", game_finished: "ОЙЫН АЯҚТАЛДЫ!",
        title_single: "Стандарт", title_random: "Кездейсоқ", title_team: "Команда", title_team_random: "Команда-Кездейсоқ", title_quick: "Жылдам ойын", title_blitz: "Блиц",
        menu: "Мәзір", leave_game: "Ойыннан шығу", sound: "Дыбыс", vibration: "Діріл", on: "Қосулы", off: "Өшірулі",
        leave_confirm: "Ойыннан шығасыз ба?",
        waiting_players: "Ойыншылар күтілуде", you: "Сіз", close: "Жабу",
    },
    uz: {
        welcome: "Ludo King-ga xush kelibsiz", create_game: "Oʻyin yaratish",
        color_red: "Qizil", color_green: "Yashil", color_blue: "Koʻk", color_yellow: "Sariq",
        game_over: "Oʻyin tugadi!", chat: "Chat", chat_ph: "Xabar yozing...", chat_vip_only: "⚜️ Faqat oʻyinchilar va VIP'lar yoza oladi", chat_locked_ph: "⚜️ Faqat oʻyinchilar va VIP", voice_aria: "Mikrofon", voice_on: "🎤 Mikrofon yoqildi — oʻyindagilarning hammasi sizni eshitadi", voice_off: "🔇 Mikrofon oʻchirildi", voice_denied: "🎤 Mikrofonga ruxsat berilmadi", voice_denied_android: "🎤 Mikrofonga ruxsat yoʻq. Telefon sozlamalari → Ilovalar → Telegram → Ruxsatlar → Mikrofon → Ruxsat berish", voice_denied_ios: "🎤 Mikrofonga ruxsat yoʻq. iPhone sozlamalari → Telegram → Mikrofonni yoqing", voice_nomic: "🎤 Bu qurilmada mikrofon topilmadi", voice_busy: "🎤 Mikrofon boshqa ilovada band (qoʻngʻiroq, diktofon). Uni yopib, qayta urinib koʻring", voice_unsupported: "🎤 Telegramning bu versiyasi mikrofonni qoʻllamaydi. Telegramni yangilang", voice_failed: "🎤 Mikrofon yoqilmadi. Qayta urinib koʻring", voice_vip_only: "⚜️ Mikrofon — faqat VIP uchun. VIP'ni Doʻkondan olish mumkin",
        send_sticker: "Stiker yuborish", pp_games: "Oʻyinlar", pp_wins: "Gʻalabalar", pp_rate: "Gʻalaba %", pp_badges: "Nishonlar", pp_me: "Bu siz", pp_react: "Reaksiya", pp_mute: "Ovozini oʻchirish", pp_unmute: "Ovozini yoqish", stickers_general: "Umumiy", sticker_locked: "🔒 «{skin}» skini bilan ochiladi — Doʻkondan skin yoki ⚜️ VIP oling", skin_obsidian: "Obsidian", skin_gold: "Oltin", skin_gem: "Kristall", skin_crown: "Toj", error: "Xatolik yuz berdi!",
        no_server: "Server bilan bogʻlanib boʻlmadi.", cancelled: "❌ Roʻyxatdan oʻtish bekor qilindi.",
        link_copied: "Havola nusxalandi! Doʻstlaringizga yuboring.", join_game: "Oʻyinga qoʻshilish",
        team_a: "A jamoa", team_b: "B jamoa", game_finished: "OʻYIN TUGADI!",
        title_single: "Standart", title_random: "Random", title_team: "Jamoa", title_team_random: "Jamoa-Random", title_quick: "Tez oʻyin", title_blitz: "Blits",
        menu: "Menyu", leave_game: "Oʻyindan chiqish", sound: "Ovoz", vibration: "Tebranish", on: "Yoniq", off: "Oʻchiq",
        leave_confirm: "Oʻyindan chiqasizmi?",
        waiting_players: "Oʻyinchilar kutilmoqda", you: "Siz", close: "Yopish",
    },
};
function tr(key) {
    const d = I18N[APP_LANG] || I18N.en;
    return (d[key] !== undefined) ? d[key] : (I18N.en[key] !== undefined ? I18N.en[key] : key);
}
function applyStaticI18n() {
    document.querySelectorAll('[data-i18n]').forEach(el => { el.textContent = tr(el.dataset.i18n); });
    document.querySelectorAll('[data-i18n-ph]').forEach(el => { el.placeholder = tr(el.dataset.i18nPh); });
    document.querySelectorAll('[data-i18n-aria]').forEach(el => { el.setAttribute('aria-label', tr(el.dataset.i18nAria)); });
}

// Tabler Icons (MIT) — halatına qaray almasatuǵın menyu ikonkaları.
function svgIcon(paths, size) {
    size = size || 22;
    return `<svg viewBox="0 0 24 24" width="${size}" height="${size}" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${paths}</svg>`;
}
const ICONS = {
    soundOn: svgIcon('<path d="M15 8a5 5 0 0 1 0 8"/><path d="M17.7 5a9 9 0 0 1 0 14"/><path d="M6 15h-2a1 1 0 0 1 -1 -1v-4a1 1 0 0 1 1 -1h2l3.5 -4.5a.8 .8 0 0 1 1.5 .5v14a.8 .8 0 0 1 -1.5 .5l-3.5 -4.5"/>'),
    soundOff: svgIcon('<path d="M6 15h-2a1 1 0 0 1 -1 -1v-4a1 1 0 0 1 1 -1h2l3.5 -4.5a.8 .8 0 0 1 1.5 .5v14a.8 .8 0 0 1 -1.5 .5l-3.5 -4.5"/><path d="M16 10l4 4m0 -4l-4 4"/>'),
    vibrationOn: svgIcon('<path d="M3 5a2 2 0 0 1 2 -2h8a2 2 0 0 1 2 2v14a2 2 0 0 1 -2 2h-8a2 2 0 0 1 -2 -2z"/><path d="M8 4l2 0"/><path d="M9 17l0 .01"/><path d="M21 6l-2 3l2 3l-2 3l2 3"/>'),
    vibrationOff: svgIcon('<path d="M7.159 3.185c.256 -.119 .54 -.185 .841 -.185h8a2 2 0 0 1 2 2v9m0 4v1a2 2 0 0 1 -2 2h-8a2 2 0 0 1 -2 -2v-13"/><path d="M11 4h2"/><path d="M3 3l18 18"/><path d="M12 17v.01"/>'),
};
document.addEventListener('DOMContentLoaded', applyStaticI18n);
// Tas suwretleri (klassik + skinler) — skins.js CSS qaǵıydaların qosadı
try { window.LudoSkins && LudoSkins.injectPieceStyles(); } catch (e) { console.error("skins:", e); }
document.addEventListener('DOMContentLoaded', () => { try { updateMenuUI(); } catch (e) {} });

let userId = "";
let userName = "";

// Náwbet waqıtı (sekund) hám jonlar (neshe ret ótkerip jiberse shıǵadı) rejimge baylanıslı:
// ⚜️ Blits — 15 s hám 1 jon, qalǵanı — 30 s hám 3 jon (game_engine.TURN_SECONDS / LIVES)
const TURN_SECONDS = { BLITZ: 15 };
const LIVES = { BLITZ: 1 };
let turnSeconds = 30;
let turnLives = 3;
function setTurnSeconds(mode) { turnSeconds = TURN_SECONDS[mode] || 30; turnLives = LIVES[mode] || 3; }

let localTimerInterval = null;
let currentTimerValue = 30;
let currentTimerColor = null;

function startLocalTimer(color, initialTime) {
    if (localTimerInterval) clearInterval(localTimerInterval);
    currentTimerColor = color;
    currentTimerValue = initialTime !== undefined ? initialTime : turnSeconds;
    
    updateTimerUI(currentTimerColor, currentTimerValue);
    
    localTimerInterval = setInterval(() => {
        currentTimerValue--;
        if (currentTimerValue < 0) currentTimerValue = 0;
        updateTimerUI(currentTimerColor, currentTimerValue);
    }, 1000);
}

function stopLocalTimer() {
    if (localTimerInterval) clearInterval(localTimerInterval);
}

let userPhotoUrl = "";
if (tg.initDataUnsafe && tg.initDataUnsafe.user) {
    userId = tg.initDataUnsafe.user.id.toString();
    userName = tg.initDataUnsafe.user.first_name;
    userPhotoUrl = tg.initDataUnsafe.user.photo_url || "";
} else {
    // Eger kompyuterde brauzerden kirip tekserip atırǵan bolsa (Fallback)
    userId = localStorage.getItem("ludo_user_id");
    if (!userId) {
        userId = "user_" + Math.random().toString(36).substring(2, 9);
        localStorage.setItem("ludo_user_id", userId);
    }
    userName = localStorage.getItem("ludo_user_name") || "Oyınshı_" + Math.floor(Math.random() * 100);
}

const LUDO_CHARACTERS = [
    ["optimist", "Оптимист"], ["elvina", "Эльвина"], ["nikita", "Никита"],
    ["lilya-detective", "Лиля-детектив"], ["natalie", "Натали"], ["ksyusha", "Ксюша"],
    ["lena", "Лена"], ["poison", "Poison"], ["cat", "Кот"], ["husky", "Хаски"],
    ["owl", "Сова"], ["raccoon", "Енот"]
];
let selectedCharacterId = localStorage.getItem("ludo_match_character") || "optimist";
if (!LUDO_CHARACTERS.some(([id]) => id === selectedCharacterId)) selectedCharacterId = "optimist";
let joinConfirmed = false;
let joinRequestPending = false;
let joinedThisRoom = false;
let characterPrefsLoaded = false;

function renderCharacterOptions() {
    const host = document.getElementById("character-options");
    if (!host) return;
    host.innerHTML = LUDO_CHARACTERS.map(([id, label]) => `
        <button type="button" class="character-option ${selectedCharacterId === id ? "selected" : ""}"
                data-character="${id}" onclick="selectLudoCharacter('${id}')">
            <img src="/static/img/characters/${id}.webp" alt="" loading="lazy"><span>${label}</span>
        </button>`).join("");
    const title = document.getElementById("character-select-title");
    const note = document.getElementById("character-select-note");
    const confirm = document.getElementById("character-confirm-btn");
    if (title) title.textContent = tr("choose_character");
    if (note) note.textContent = tr("choose_character_note");
    if (confirm) confirm.textContent = tr("confirm_character");
}

function selectLudoCharacter(id) {
    if (!LUDO_CHARACTERS.some(([key]) => key === id)) return;
    selectedCharacterId = id;
    renderCharacterOptions();
}

async function showCharacterSelection() {
    const overlay = document.getElementById("character-select-overlay");
    if (!overlay) { joinConfirmed = true; autoJoinGame(); return; }
    const status = document.getElementById("character-select-error");
    if (status) status.textContent = "";
    if (!characterPrefsLoaded && tg.initData) {
        try {
            const response = await fetch(`/api/me?init_data=${encodeURIComponent(tg.initData)}`, { cache: "no-store" });
            if (response.ok) {
                const profile = await response.json();
                const skin = profile.prefs && profile.prefs.skin;
                if (LUDO_CHARACTERS.some(([id]) => id === skin)) selectedCharacterId = skin;
            }
        } catch (error) {
            console.warn("Could not load saved character:", error);
        }
        characterPrefsLoaded = true;
    }
    renderCharacterOptions();
    overlay.hidden = false;
}

function confirmCharacterChoice() {
    if (!tg.initData) {
        const status = document.getElementById("character-select-error");
        if (status) status.textContent = "Откройте игру через кнопку Telegram-бота, чтобы подтвердить аккаунт.";
        return;
    }
    localStorage.setItem("ludo_match_character", selectedCharacterId);
    joinConfirmed = true;
    const overlay = document.getElementById("character-select-overlay");
    if (overlay) overlay.hidden = true;
    joinRequestPending = false;
    autoJoinGame();
}

async function createGame() {
    try {
        // Telegram initData imzasın jiberemiz — server tek haqıyqıy Mini App
        // paydalanıwshısına oyın jaratıwǵa ruxsat etedi (anonim flood tosıladı).
        const response = await fetch('/api/game/create', {
            method: 'POST',
            headers: { 'X-Telegram-Init-Data': (tg && tg.initData) ? tg.initData : '' },
        });
        const data = await response.json();
        
        if (data.join_url) {
            window.location.href = data.join_url;
        } else {
            alert(tr("error"));
        }
    } catch (error) {
        console.error("Error creating game:", error);
        alert(tr("no_server"));
    }
}

let myColor = null;
let myTeam = null;
let ws = null;
let reconnectTimer = null;
let autoMoveTimeout = null;
let activeTurnColor = null;
let latestRoomState = null;


// Sesli effektler (Web Audio API)
const audioVer = "564325262546";
const soundUrls = {
    roll: `/static/sounds/roll.wav?v=${audioVer}`,
    move: `/static/sounds/move.wav?v=${audioVer}`,
    kick: `/static/sounds/kick.wav?v=${audioVer}`,
    eat: `/static/sounds/kick.wav?v=${audioVer}`,
    win: `/static/sounds/win.wav?v=${audioVer}`,
    turn: `/static/sounds/turn.wav?v=${audioVer}`
};

const audioCtx = new (window.AudioContext || window.webkitAudioContext)();
const audioBuffers = {};
// Skin stikerleriniń dawısları (sticker_sfx.js) — sol AudioContext, menyudegi dawıs sazlaması
if (window.LudoSfx) LudoSfx.attach(audioCtx, () => soundEnabled);

async function loadSound(name, url) {
    try {
        const response = await fetch(url);
        const arrayBuffer = await response.arrayBuffer();
        const audioBuffer = await audioCtx.decodeAudioData(arrayBuffer);
        audioBuffers[name] = audioBuffer;
    } catch (e) {
        console.error(`Dawıs júklenbedi: ${name}`, e);
    }
}

Object.keys(soundUrls).forEach(name => {
    loadSound(name, soundUrls[name]);
});

// ── Skin dawısları: oyınshınıń skini bolsa — sol skinniń dawısı, bolmasa — ádettegi ──
const SKIN_SOUND_VER = "3";
const _skinSoundsLoaded = new Set();
// Waqıya → ádettegi (klassik) dawıs atı
const DEFAULT_SOUND = { roll: "roll", move: "move", turn: "turn", capture: "eat", finish: "win" };

// Bólmedegi oyınshılardıń skin dawısların (bir ret) júkleydi
function loadSkinSounds(players) {
    if (!window.LudoSkins) return;
    (players || []).forEach(p => {
        const skin = p && p.skin;
        if (!skin || skin === "classic" || _skinSoundsLoaded.has(skin)) return;
        _skinSoundsLoaded.add(skin);
        LudoSkins.soundFiles(skin, SKIN_SOUND_VER).forEach(f => loadSound(f.key, f.url));
    });
}

// color — waqıyanıń iyesi (kubik taslaǵan / júrgen / jegen / finishke jetken oyınshı)
function playSkinSound(color, ev) {
    const skin = skinByColor()[color];
    const key = skin && skin !== "classic" && window.LudoSkins ? LudoSkins.soundKey(skin, ev) : null;
    if (key && audioBuffers[key]) { playSound(key); return; }
    if (DEFAULT_SOUND[ev]) playSound(DEFAULT_SOUND[ev]);   // júklenbegen bolsa da — ádettegi
}

function playSound(name) {
    if (!soundEnabled) return;   // Menyuдан dawıs óshirilgen bolsa — tınısh
    if (!audioBuffers[name]) return;
    const _start = () => {
        try {
            const source = audioCtx.createBufferSource();
            source.buffer = audioBuffers[name];
            source.connect(audioCtx.destination);
            source.start(0);
        } catch (e) {
            console.error("Dawıs shıǵarıwda qáte:", e);
        }
    };
    // Mini App background'қa túsip qaйtqanда AudioContext 'suspended'/'interrupted'
    // bolıp qaladı. resume() — ASINXRON: burın resume shaqırılıp, DÁRHAL start(0)
    // qılınatuǵın edi (context ele suspend -> dawıs úndemey joǵalatuǵın edi). Endi
    // resume TAMAMLANǴANNAN keyin oynatamız.
    if (audioCtx.state !== 'running') {
        audioCtx.resume().then(_start).catch(() => {});
    } else {
        _start();
    }
}

let teamParam = null;
let cleanRoomCode = "";
let roomConnectionStarted = false;

function applyResolvedRoomCode(rawCode) {
    const code = String(rawCode || "").trim().toUpperCase().replace(/^JOIN_/, "").replace(/^ROOM_/, "");
    if (!/^[A-Z0-9]{6}(?:_[AB])?$/.test(code)) return false;
    ROOM_CODE = code;
    teamParam = null;
    cleanRoomCode = code;
    const parts = code.split("_");
    if (parts.length === 2) {
        teamParam = parts[1];
        cleanRoomCode = parts[0];
    }
    localStorage.setItem("ludo_last_room_code", code);
    console.info("[LUDO_ROOM_RESOLVED]", {
        room: code,
        source: window.__LUDO_SERVER_ROOM_CODE__ ? "server-path" : "telegram-start-param-or-url"
    });
    return true;
}

function bootRoomConnection(attempt = 0) {
    try { tg.ready && tg.ready(); } catch (e) {}
    if (roomConnectionStarted) return;
    const resolved = window.__LUDO_SERVER_ROOM_CODE__ ||
        (typeof window.__resolveLudoRoomCode === "function" ? window.__resolveLudoRoomCode() : ROOM_CODE);
    if (applyResolvedRoomCode(resolved)) {
        roomConnectionStarted = true;
        connectWebSocket();
        return;
    }
    if (attempt < 24) {
        setTimeout(() => bootRoomConnection(attempt + 1), 250);
        return;
    }
    console.error("[LUDO_ROOM_MISSING]", {
        path: window.location.pathname,
        search: window.location.search,
        startParam: tg?.initDataUnsafe?.start_param || "",
        initDataPresent: Boolean(tg?.initData)
    });
    const title = document.getElementById("room-title");
    if (title) title.textContent = "Не удалось получить код комнаты";
    const waiting = document.querySelector(".lobby-title");
    if (waiting) waiting.textContent = "Вернитесь в группу и откройте игру кнопкой «Войти в игру»";
    showChatNotification("", "Telegram не передал код комнаты. Закройте игру и откройте её повторно из последнего сообщения бота.", null, 9000);
}
bootRoomConnection();

let messageQueue = [];
let isProcessingQueue = false;

async function processQueue() {
    if (isProcessingQueue || messageQueue.length === 0) return;
    isProcessingQueue = true;
    try {
        while (messageQueue.length > 0) {
            const data = messageQueue.shift();
            await handleMessage(data);
        }
    } catch (e) {
        console.error("Queue error:", e);
    } finally {
        isProcessingQueue = false;
        if (messageQueue.length > 0) setTimeout(processQueue, 0);
    }
}


// Qaйta-jalǵanıw «jumsaq»: turaqlı 3 sek ornına EKSPONENCIAL backoff + JITTER.
// Server bógelgende (yamasa restart bolǵanda) júzlegen klient birdей urıp
// «thundering herd» jasamasın hám serverdiń qalpına keliwine tosqınlıq etpesin
// dep: her sátsiz urınıwda kútiw waqtı 2× ósedi (2s→4s→…→30s shegi), ústine
// azǵantay tosınnan (jitter) qosılıp klientler bir-birinen ajıraydı.
let reconnectAttempts = 0;
const RECONNECT_BASE_MS = 2000;
const RECONNECT_MAX_MS = 30000;

function connectWebSocket() {
    if (reconnectTimer) clearTimeout(reconnectTimer);

    const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
    ws = new WebSocket(`${protocol}//${window.location.host}/ws/${cleanRoomCode}`);

    ws.onopen = function() {
        console.log("WS Connected");
        reconnectAttempts = 0;   // sátli qosılıw — backoff'tı nolge qaйtaramız
        if (reconnectTimer) {
            clearTimeout(reconnectTimer);
            reconnectTimer = null;
        }
        startHeartbeat();
    };

    ws.onmessage = function(event) {
        lastActivityAt = Date.now();   // baylanıs tiri belgisi (heartbeat ushın)
        let data;
        try {
            data = JSON.parse(event.data);
        } catch (e) {
            console.warn("WS: buzıq freym", e);
            return;
        }
        if (data.event === "PONG") return;   // heartbeat juwabı — tek tirishilik belgisi
        messageQueue.push(data);
        processQueue();
    };

    ws.onclose = function(event) {
        console.log("WS Closed:", event);
        voiceSessionToken = "";
        stopHeartbeat();
        joinRequestPending = false;
        if (event.code === 4403 || event.code === 4404) {
            console.warn("WS: terminal room/auth error; automatic reconnect disabled.", event.code);
            diceRequestPending = false;
            return;
        }
        diceRequestPending = false;
        // Eksponencial backoff + jitter menen qayta qosılıwǵa urınıw.
        if (!reconnectTimer) {
            const backoff = Math.min(RECONNECT_MAX_MS, RECONNECT_BASE_MS * Math.pow(2, reconnectAttempts));
            const delay = backoff + Math.floor(Math.random() * 1000);   // jitter (de-sync)
            reconnectAttempts++;
            console.log(`Reconnecting in ${delay}ms (urınıw ${reconnectAttempts})`);
            reconnectTimer = setTimeout(() => {
                connectWebSocket();
            }, delay);
        }
    };

    ws.onerror = function(err) {
        console.error("WS Error:", err);
        ws.close();
    };
}

// ── Baylanıs tirishiligi (heartbeat) hám app-lifecycle (background <-> foreground)
let heartbeatTimer = null;
let lastActivityAt = Date.now();
let hiddenAt = 0;
const HEARTBEAT_MS = 10000;   // her 10 sek PING jiberemiz
const STALE_MS = 25000;       // 25 sek esh xabar/PONG kelmese -> socket ólgen dep esaplaymız

function stopHeartbeat() {
    if (heartbeatTimer) { clearInterval(heartbeatTimer); heartbeatTimer = null; }
}

function startHeartbeat() {
    stopHeartbeat();
    lastActivityAt = Date.now();
    heartbeatTimer = setInterval(() => {
        if (!ws || ws.readyState !== WebSocket.OPEN) return;
        // Jat (half-open) socket: uzaq waqıt esh xabar/PONG kelmese — ólgen dep,
        // jabamız (onclose -> reconnect). Mobil'de background'tan keyin úndemey
        // ólgen baylanıstı (onclose ámelde bolmaйtuǵın halat) usı anıqlaydı.
        if (Date.now() - lastActivityAt > STALE_MS) {
            console.warn("WS stale — reconnect");
            try { ws.close(); } catch (e) {}
            return;
        }
        try { ws.send(JSON.stringify({ action: "PING" })); } catch (e) {}
    }, HEARTBEAT_MS);
}

function resumeAudio() {
    if (audioCtx.state !== 'running') audioCtx.resume().catch(() => {});
}

// Eski socket-ti «taza» jabıp (onclose reconnect'ti qospaуı ushın handlerlerdi
// alıp taslap) dárhal jańadan qosıladı.
function reconnectNow() {
    if (ws) {
        try { ws.onclose = null; ws.onerror = null; ws.close(); } catch (e) {}
    }
    if (reconnectTimer) { clearTimeout(reconnectTimer); reconnectTimer = null; }
    reconnectAttempts = 0;   // paydalanıwshı tikkeley qaйttı — dárhal, backoff'sız
    connectWebSocket();
}

// Mini App tómenge túsirilip (background) qaйta ashılǵanда: dawıstı tikleйmiz hám
// baylanıstı sinxronlaymız — kerek bolsa taza reconnect (qoldан «reload» ornına).
function onAppForeground() {
    resumeAudio();
    const wasHiddenLong = hiddenAt && (Date.now() - hiddenAt > 1500);
    hiddenAt = 0;
    if (!ws || ws.readyState === WebSocket.CLOSED || ws.readyState === WebSocket.CLOSING || wasHiddenLong) {
        // CONNECTION_ESTABLISHED -> autoJoin -> server ROOM_STATE/GAME_STARTED penen sinxron
        reconnectNow();
    } else if (ws.readyState === WebSocket.OPEN) {
        try { ws.send(JSON.stringify({ action: "PING" })); } catch (e) {}
    }
}

document.addEventListener('visibilitychange', () => {
    if (document.visibilityState === 'hidden') {
        hiddenAt = Date.now();
    } else {
        onAppForeground();
    }
});
window.addEventListener('focus', onAppForeground);
window.addEventListener('pageshow', onAppForeground);
// Telegram WebApp'tıń óz lifecycle waqıyası (jańaraq versiyalarda bar) — bolsa isletemiz
if (typeof tg !== 'undefined' && tg && typeof tg.onEvent === 'function') {
    try { tg.onEvent('activated', onAppForeground); } catch (e) {}
}

// iOS/Safari: AudioContext'ti birinshi paydalanıwshı háreketinde «ashamız» (unlock).
// Bunsız iOS foreground'taǵı (gesture emes) resume()-di bloklaydı — qarsılastıń
// júrisi sıyaqlı waqıyalarǵa dawıs shıqpaydı.
function _unlockAudioOnce() {
    resumeAudio();
    document.removeEventListener('pointerdown', _unlockAudioOnce);
    document.removeEventListener('touchstart', _unlockAudioOnce);
}
document.addEventListener('pointerdown', _unlockAudioOnce);
document.addEventListener('touchstart', _unlockAudioOnce);

function computeRoomTitle(data) {
    // Backend turnir matchı ushın title (Saralaw, Yarım final, ...) jiberedi.
    if (data && data.title) return data.title;
    // Bolmasa oyın rejiminen esaplaymız (Random `R_` prefiksi menen).
    const mode = (data && data.game_mode) || "STANDARD";
    const isRandom = (typeof ROOM_CODE === "string" && ROOM_CODE.startsWith("R_"));
    if (mode === "TEAM") return isRandom ? tr("title_team_random") : tr("title_team");
    if (mode === "QUICK") return tr("title_quick");
    if (mode === "BLITZ") return tr("title_blitz");
    return isRandom ? tr("title_random") : tr("title_single");
}

function setRoomTitle(data) {
    const el = document.getElementById("room-title");
    if (!el) return;
    const title = computeRoomTitle(data);
    if (title) {
        el.textContent = title;
        el.style.display = "block";
    }
}

async function handleMessage(data) {
    // Title'di tek title/game_mode bar event'lerde jańalaymız (basqa event'ler
    // turnir title'in joqqa shıǵarmasın).
    if (data.title || data.game_mode) setRoomTitle(data);

    if (data.players) {
        if (latestRoomState) latestRoomState.players = data.players;
        const me = data.players.find(p => String(p.user_id) === String(userId));
        if(me) {
            myColor = me.color;
            myTeam = me.team;
        }
    }

    if (data.status === "FINISHED") {
        showGameOver(data.players, data.rating_changes);
        return;
    }

    if (data.status === "PLAYING" && data.board_state) {
        document.getElementById("game-info").style.display = "none";
        document.getElementById("board-container").style.display = "block";
        if (typeof previousState === 'undefined' || previousState === null) {
            initBoardUI(data);
            await renderPieces(data.board_state);
        }
    }

        if (data.event === "ROOM_NOT_FOUND") {
            joinRequestPending = false;
            joinConfirmed = false;
            const title = document.getElementById("room-title");
            if (title) title.textContent = "Комната " + (cleanRoomCode || "неизвестна");
            const waiting = document.querySelector(".lobby-title");
            if (waiting) waiting.textContent = "Комната не найдена на сервере";
            const slots = document.getElementById("lobby-slots");
            if (slots) slots.innerHTML = '<div class="room-error-state">Комната больше не существует или сервер не восстановил её данные.</div>';
            showChatNotification("", data.message || "Комната не найдена. Создайте новую игру в группе.", null, 9000);
        } else if (data.event === "STARTING") {
            const quickStart = document.getElementById("lobby-start-bots");
            if (quickStart) {
                quickStart.disabled = true;
                quickStart.textContent = "⏳ ЗАПУСКАЕМ ИГРУ…";
            }
            showChatNotification("", data.message || "Запускаем игру…", null, 2500);
        } else if (data.event === "AUTH_ERROR") {
            joinRequestPending = false;
            const quickStart = document.getElementById("lobby-start-bots");
            if (quickStart) {
                quickStart.disabled = false;
                quickStart.textContent = "🤖 НАЧАТЬ ИГРУ С БОТАМИ";
            }
            showChatNotification('', data.message || "Требуется открыть игру через Telegram", null, 7000);
        } else if (data.event === "GAME_ERROR") {
            const quickStart = document.getElementById("lobby-start-bots");
            if (quickStart) {
                quickStart.disabled = false;
                quickStart.textContent = "🤖 НАЧАТЬ ИГРУ С БОТАМИ";
            }
            showChatNotification('', data.message || tr("error"), null, 4500);
        } else if (data.event === "CONNECTION_ESTABLISHED") {
            diceRequestPending = false;
            const alreadySeated = (data.players || []).some(p => String(p.user_id) === String(userId));
            const canChooseCharacter = data.status === "WAITING" &&
                !alreadySeated && (data.players || []).length < 4;
            if (canChooseCharacter && !joinConfirmed) {
                void showCharacterSelection();
            } else {
                joinConfirmed = true;
                autoJoinGame();
            }
        } else if (data.event === "ROOM_STATE") {
            latestRoomState = data;
            if ((data.players || []).some(p => String(p.user_id) === String(userId))) {
                joinedThisRoom = true;
                joinConfirmed = true;
                localStorage.setItem("ludo_last_joined_room", cleanRoomCode);
                joinRequestPending = false;
            }
            setTurnSeconds(data.game_mode);
            updateRoomUI(data);
            // Keep the lobby visible while the room is waiting; the old markup
            // hid the lobby and showed an empty board before GAME_STARTED.
            if (data.status === "WAITING") {
                document.getElementById("game-info").style.display = "block";
                document.getElementById("board-container").style.display = "none";
            } else if (data.status === "PLAYING") {
                updateLobbyCountdown(null, 0, "PLAYING");
                document.getElementById("game-info").style.display = "none";
                document.getElementById("board-container").style.display = "block";
                if (data.board_state) {
                    initBoardUI(data);
                    await renderPieces(data.board_state);
                }
            }
            // Update player membership immediately so the mic button is not
            // hidden while players are still in the lobby.
            Voice.setPlayers(data.players || []);
            if (data.status === "PLAYING" && data.turn) {
                startLocalTimer(data.turn, data.timer || turnSeconds);
                if (data.turn === myColor && activeTurnColor !== data.turn) {
                    playSkinSound(myColor, 'turn');
                    hapticImpact('rigid');   // sizdiń náwbetińiz — anıq soqqı
                }
                activeTurnColor = data.turn;
            }
        } else if (data.event === "VOICE_SESSION") {
            voiceSessionToken = String(data.token || "");
        } else if (data.event === "VOICE_ERROR") {
            showChatNotification("", data.message || "Ошибка голосового сообщения.", null, 5000);
        } else if (data.event === "VOICE") {
            Voice.onSignal(data);
        } else if (data.event === "VOICE_CONFIG") {
            Voice.config(data.ice);   // TURN server (waqıtsha parol) — dawıs P2P ótpese
        } else if (data.event === "VOICE_MIC") {
            Voice.onMic(data);
        } else if (data.event === "BOARD_THEME") {
            applyBoardTheme(data.theme);
        } else if (data.event === "PLAYER_INFO") {
            onPlayerInfo(data);
        } else if (data.event === "STICKER_PACKS") {
            setStickerPacks(data.packs);
        } else if (data.event === "CHAT_PERM") {
            setChatPermission(data.can_write);
        } else if (data.event === "CHAT_DENIED") {
            setChatPermission(false);
            addMessageToUI({ system: true, text: tr("chat_vip_only") });
        } else if (data.event === "GAME_STARTED") {
            diceRequestPending = false;
            currentValidPieces = [];
            latestRoomState = data;
            joinedThisRoom = (data.players || []).some(p => String(p.user_id) === String(userId));
            if (joinedThisRoom) {
                joinConfirmed = true;
                localStorage.setItem("ludo_last_joined_room", cleanRoomCode);
            }
            joinRequestPending = false;
            const picker = document.getElementById("character-select-overlay");
            if (picker) picker.hidden = true;
            setTurnSeconds(data.game_mode);
            const quickStart = document.getElementById("lobby-start-bots");
            if (quickStart) quickStart.hidden = true;
            document.getElementById("game-info").style.display = "none";
            document.getElementById("board-container").style.display = "block";
            initBoardUI(data);
            Voice.setPlayers(data.players);   // ⚜️ VIP dawıs chatı
            activeTurnColor = data.turn;
            // Reconnect/resync waqtında GAME_STARTED házirgi tolıq taxtanı jiberedi;
            // eski previousState menen diff qılınsa jalǵan «slide»/«eat» animaciya hám
            // dawıs shıǵatuǵın edi. Nolge túsirip, taxtanı STATIK saldırамız.
            previousState = null;
            await renderPieces(data.board_state);
            updateTurnUI(data.turn, data.active_user_id, data.players);
            startLocalTimer(data.turn, data.timer || turnSeconds);
            if (data.dice !== null && data.dice !== undefined) {
                showDiceResult(data.turn, data.dice);
                if (String(data.turn) === String(myColor)) {
                    setDiceComment("ВЫПАЛО " + data.dice, "Выбери подсвеченную фишку.");
                    setTimeout(() => highlightValidPieces(data.turn, data.dice, data.board_state), 150);
                } else {
                    setDiceComment("ХОД ИГРОКА", "Ожидаем, пока игрок передвинет фишку.");
                }
            }
            if (data.turn === myColor) { playSkinSound(myColor, 'turn'); hapticImpact('rigid'); }
        } else if (data.event === "DICE_REJECTED") {
            diceRequestPending = false;
            showChatNotification("", data.message || "Сейчас нельзя бросить кубик.", null, 2500);
        } else if (data.event === "DICE_RESULT") {
            diceRequestPending = false;
            showDiceResult(data.color, data.value);
            if (data.auto_start && !data.auto_start_complete) {
                setTurnComment("Первый запуск", "Автоматически бросаем кубик до первой шестёрки.", (latestRoomState?.players || []).length);
                setDiceComment("АВТОСТАРТ · ИЩЕМ ШЕСТЁРКУ", `Выпало ${data.value}. Кубик бросается дальше автоматически.`);
            } else if (data.is_bot) {
                setDiceComment("ХОД БОТА", `Бросок: ${data.value}. Бот выбирает фишку.`);
            } else if (data.auto_start_complete) {
                setTurnComment("Твой ход", "Выпала шестёрка. Выбери фишку, чтобы выйти из базы.", (latestRoomState?.players || []).length);
                setDiceComment("ШЕСТЁРКА!", "Фишка выходит из базы. Выбери одну из подсвеченных фишек.");
                startLocalTimer(data.color, data.timer || turnSeconds);
                setTimeout(() => highlightValidPieces(data.color, data.value, data.board_state), 150);
            } else {
                setDiceComment(`ВЫПАЛО ${data.value}`, "Выбери подсвеченную фишку.");
                startLocalTimer(data.color, data.timer || turnSeconds);
                setTimeout(() => highlightValidPieces(data.color, data.value, data.board_state), 150);
            }
        } else if (data.event === "TURN_CHANGED") {
            diceRequestPending = false;
            currentValidPieces = [];
            updateTurnUI(data.active_color, data.active_user_id, data.players || (latestRoomState && latestRoomState.players));
            if (data.active_color === myColor && activeTurnColor !== data.active_color) {
                playSkinSound(myColor, 'turn');
                hapticImpact('rigid');   // sizdiń náwbetińiz
            }
            activeTurnColor = data.active_color;
            await renderPieces(data.board_state);
            updateTurnUI(data.active_color, data.active_user_id, data.players);
            startLocalTimer(data.active_color, data.timer || turnSeconds);
        } else if (data.event === "NO_VALID_MOVES") {
            currentValidPieces = [];
        } else if (data.event === "PIECE_MOVED") {
            currentValidPieces = [];
            await renderPieces(data.board_state);
            if (data.move_info && data.move_info.is_bot) {
                setTurnComment("Бот сделал ход", "Соперник передвинул фишку и рассчитывает следующий ход.", (latestRoomState?.players || []).length);
                setDiceComment("ХОД БОТА", "Соперник передвинул фишку.");
            }
            if(data.winner_info) {
                celebrateWinner(data.winner_info);
            }
        } else if (data.event === "TIMER_TICK") {
            // Serverden kelmeydi, biraq eski xabarlar qalıp ketken bolsa
            updateTimerUI(data.color, data.time);
        } else if (data.event === "PLAYER_KICKED") {
            console.log(`Oyınshı ${data.name} (${data.color}) shıǵarıldı.`);
        } else if (data.event === "GAME_OVER") {
            stopLocalTimer();
            Voice.stop();
            closePlayerPop();
            showGameOver(data.players, data.rating_changes);
        } else if (data.event === "NEW_MESSAGE" || data.event === "NEW_VOICE_MESSAGE") {
            addMessageToUI(data.message);
        } else if (data.event === "ANIMATION_SENT") {
            playAnimation(data.from_color, data.to_color, data.animation);
        } else if (data.event === "GAME_CANCELLED") {
            alert(tr("cancelled"));
            if (window.Telegram && window.Telegram.WebApp && window.Telegram.WebApp.initDataUnsafe && window.Telegram.WebApp.initDataUnsafe.user) {
                window.Telegram.WebApp.close();
            } else {
                location.reload();
            }
    }
}

function autoJoinGame() {
    if (!joinConfirmed) {
        void showCharacterSelection();
        return;
    }
    if (!ws || ws.readyState !== WebSocket.OPEN || joinRequestPending) return;
    // Enter immediately. The cabinet's saved character remains the default;
    // only send a match override when the player explicitly saved one locally.
    joinRequestPending = true;
    const payload = {
        action: "JOIN_GAME",
        init_data: tg.initData,
        user_id: userId,
        name: userName,
        photo_url: userPhotoUrl,
        team: teamParam
    };
    const savedCharacter = localStorage.getItem("ludo_match_character");
    if (savedCharacter && LUDO_CHARACTERS.some(([id]) => id === savedCharacter)) {
        payload.skin = savedCharacter;
    }
    try {
        ws.send(JSON.stringify(payload));
    } catch (error) {
        joinRequestPending = false;
        console.error("[LUDO_JOIN_SEND_ERROR]", error);
    }
}

function formatName(name) {
    if (!name) return "";
    return name.length > 15 ? name.substring(0, 15) + "..." : name;
}

// Paydalanıwshı kiritken teкстti innerHTML-ge salıwdan aldın qáwipsizlestiriw (XSS-tıń aldın alıw).
function escapeHtml(str) {
    if (str === undefined || str === null) return "";
    return String(str)
        .replace(/&/g, "&amp;")
        .replace(/</g, "&lt;")
        .replace(/>/g, "&gt;")
        .replace(/"/g, "&quot;")
        .replace(/'/g, "&#39;");
}

// Atınıń birinshi háribi (avatar ushın). Emoji/surrogate juplıqların durıs alıw ushın Array.from.
function initialOf(name) {
    const ch = Array.from(String(name || "").trim())[0];
    return ch ? ch.toUpperCase() : "?";
}

// Lobbi orını: tolı (avatar + at [+ «Siz»]) yamasa bos (kútiw noqatları).
function buildLobbySlot(player) {
    const slot = document.createElement("div");
    if (!player) {
        slot.className = "slot empty";
        slot.innerHTML = '<span class="slot-wait"><i></i><i></i><i></i></span>';
        return slot;
    }
    const isMe = player.user_id === userId;
    slot.className = "slot active" + (isMe ? " is-me" : "");

    const avatar = document.createElement("span");
    avatar.className = "slot-avatar" + (player.color === "yellow" || player.color === "blue" ? ` is-${player.color}` : "");
    if (player.color) avatar.style.setProperty("--pc", `var(--${player.color})`);
    if (player.photo_url) {
        avatar.style.backgroundImage = `url("${player.photo_url}")`;
        avatar.textContent = "";
    } else {
        avatar.textContent = initialOf(player.name);
    }

    const text = document.createElement("span");
    text.className = "slot-text";
    const name = document.createElement("span");
    name.className = "slot-name";
    name.textContent = formatName(player.name);
    text.appendChild(name);
    if (isMe) {
        const you = document.createElement("span");
        you.className = "slot-you";
        you.textContent = tr("you");
        text.appendChild(you);
    }
    slot.append(avatar, text);
    return slot;
}

let lobbyCountdownInterval = null;
function updateLobbyCountdown(deadline, playerCount, status) {
    const panel = document.getElementById("lobby-countdown-panel");
    const timer = document.getElementById("lobby-countdown");
    if (!panel || !timer) return;
    if (status !== "WAITING" || Number(playerCount || 0) < 2) {
        panel.hidden = true;
        if (lobbyCountdownInterval) clearInterval(lobbyCountdownInterval);
        lobbyCountdownInterval = null;
        return;
    }
    panel.hidden = false;
    if (lobbyCountdownInterval) clearInterval(lobbyCountdownInterval);
    const serverDeadline = Number(deadline || 0) * 1000;
    const fallbackDeadline = Date.now() + 15000;
    const tick = () => {
        const left = serverDeadline > 0 ? Math.max(0, Math.ceil((serverDeadline - Date.now()) / 1000)) : Math.max(0, Math.ceil((fallbackDeadline - Date.now()) / 1000));
        timer.textContent = String(Math.floor(left / 60)).padStart(2, "0") + ":" + String(left % 60).padStart(2, "0");
        const label = panel.querySelector(".lobby-countdown-label");
        if (label) label.textContent = left === 0 ? "ЗАПУСКАЕМ ИГРУ" : "АВТОСТАРТ ЧЕРЕЗ";
    };
    tick();
    lobbyCountdownInterval = setInterval(tick, 1000);
}

function updateRoomUI(data) {
    const slotsContainer = document.getElementById("lobby-slots");
    if (!slotsContainer) return;

    slotsContainer.innerHTML = "";
    const isTeamMode = data.game_mode === "TEAM";

    const countEl = document.getElementById("lobby-count");
    if (countEl) countEl.textContent = `${data.players.length}/4`;
    updateLobbyCountdown(data.lobby_deadline, data.players.length, data.status);

    if (isTeamMode) {
        const teams = ["A", "B"];
        teams.forEach(t => {
            const teamDiv = document.createElement("div");
            teamDiv.className = "team-group";
            const label = document.createElement("div");
            label.className = "team-name";
            label.textContent = tr('team_' + t.toLowerCase());
            teamDiv.appendChild(label);

            const teamPlayers = data.players.filter(p => p.team === t);
            for (let i = 0; i < 2; i++) {
                teamDiv.appendChild(buildLobbySlot(teamPlayers[i]));
            }
            slotsContainer.appendChild(teamDiv);
        });
    } else {
        // 4 slot jaratıw
        for (let i = 0; i < 4; i++) {
            slotsContainer.appendChild(buildLobbySlot(data.players[i]));
        }
    }

    const startBtn = document.getElementById("start-btn");
    if (startBtn) startBtn.style.display = "none";
    const isAlreadyIn = data.players.some(p => String(p.user_id) === String(userId));
    const controls = document.getElementById("controls");
    const botStartBtn = document.getElementById("lobby-start-bots");
    const botStartNote = document.getElementById("lobby-start-note");
    if (botStartBtn) {
        botStartBtn.hidden = !(isAlreadyIn && data.status === "WAITING" && data.players.length < 2);
        botStartBtn.disabled = false;
        botStartBtn.textContent = "🤖 НАЧАТЬ ИГРУ С БОТАМИ";
        botStartBtn.onclick = () => {
            if (!ws || ws.readyState !== WebSocket.OPEN) {
                showChatNotification("", "Нет соединения с сервером. Подождите подключения.", null, 4000);
                return;
            }
            botStartBtn.disabled = true;
            botStartBtn.textContent = "⏳ ЗАПУСКАЕМ ИГРУ…";
            ws.send(JSON.stringify({
                action: "START_WITH_BOTS",
                user_id: userId,
                init_data: tg?.initData || ""
            }));
        };
    }
    if (botStartNote) botStartNote.hidden = !(isAlreadyIn && data.status === "WAITING" && data.players.length < 2);

    // Spectator join control
    let joinBtn = document.getElementById("lobby-join-btn");
    if (!joinBtn && !isAlreadyIn && data.status === "WAITING" && data.players.length < 4) {
        joinBtn = document.createElement("button");
        joinBtn.id = "lobby-join-btn";
        joinBtn.className = "btn btn-primary lobby-join-btn";
        joinBtn.innerText = tr("join_game");
        joinBtn.onclick = autoJoinGame;
        controls.appendChild(joinBtn);
    } else if (joinBtn && (isAlreadyIn || data.status !== "WAITING" || data.players.length >= 4)) {
        joinBtn.remove();
    }
}



function copyRoomLink() {
    const link = window.location.href;
    navigator.clipboard.writeText(link).then(() => {
        alert(tr("link_copied"));
    });
}

function startGame() {
    if(ws) ws.send(JSON.stringify({ action: "START_GAME", user_id: userId }));
}

let diceRequestPending = false;

function rollDice() {
    if (!ws || ws.readyState !== WebSocket.OPEN || diceRequestPending) return;
    if (myColor && activeTurnColor && String(myColor) !== String(activeTurnColor)) return;
    if (currentValidPieces && currentValidPieces.length) return;
    diceRequestPending = true;
    hapticImpact('medium');
    try {
        ws.send(JSON.stringify({ action: "ROLL_DICE", user_id: userId }));
    } catch (error) {
        diceRequestPending = false;
        console.error("[DICE_SEND_ERROR]", error);
        showChatNotification("", "Не удалось отправить бросок. Проверь соединение.", null, 2500);
    }
}

function initBoardUI(data) {
    loadSkinSounds(data.players);   // bólmedegi skinlerdiń dawısları (oyın baslanıwı hám qayta jalǵanıw)
    drawBoard(data);
    updateTurnUI(data.turn, data.active_user_id, data.players);
    
    // Dice-boxlarǵa click qosıw (HTML dan da kútilsin, biraq JS isenimdirek)
    document.querySelectorAll('.dice-container').forEach(box => {
        box.onclick = () => rollDice();
    });

    data.players.forEach(p => {
        const wrapper = document.getElementById(`wrapper-${p.color}`);
        if (wrapper) wrapper.style.visibility = "visible";

        const card = document.getElementById(`player-${p.color}`);
        if(card) {
            card.querySelector('.player-name').innerText = formatName(p.name);
            const avatar = card.querySelector('.avatar');
            if (avatar) {
                avatar.style.backgroundImage = characterImageFor(p);
                avatar.textContent = "";
            }
            const note = card.querySelector(".player-comment");
            if (note) note.textContent = p.is_bot ? "БОТ-СОПЕРНИК" : "В ИГРЕ";
            if (card) card.classList.toggle("is-bot", !!p.is_bot);
        }
        // Kubik hám kartochka oyınshınıń tas skini menen birdey stilde (Taj — avatar ústinde taj)
        const dice = document.getElementById(`dice-${p.color}`);
        if (dice) dice.dataset.skin = p.skin || "classic";
        if (card) card.dataset.skin = p.skin || "classic";
        if (card) card.dataset.vip = p.vip ? "1" : "";   // ⚜️ VIP belgisi
    });

    console.log("Oyın baslandı. Board:", data.board_state);
}

// ─────────────────────── Taxta suwreti (bir SVG qatlam) ─────────────────────
// SVG hám temalar — themes.js (BoardThemes). Grid kletkaları onıń ústinde mólder
// turadı — tek taslardıń tayanısh noqatı. ⚜️ VIP teması: server JOIN_GAME'ge juwap
// retinde BOARD_THEME jiberedi (VIP — óz teması; bolmasa VIP jaratqan bólmeniń teması).
let boardTheme = "neon";
let boardArtCache = null;

function buildBoardArt() {
    if (!boardArtCache) boardArtCache = BoardThemes.art(boardTheme);
    return boardArtCache;
}

function applyBoardTheme(id) {
    if (!BoardThemes.has(id)) id = "classic";
    const board = document.getElementById("ludo-board");
    if (board) {
        board.dataset.theme = id;
        Object.entries(BoardThemes.vars(id)).forEach(([k, v]) => board.style.setProperty(k, v));
    }
    if (id === boardTheme) return;
    boardTheme = id;
    boardArtCache = null;
    const art = board && board.querySelector(".board-art");
    if (art) art.outerHTML = buildBoardArt();
}

function drawBoard(roomData) {
    const board = document.getElementById("ludo-board");
    if(!board) return;
    const state = roomData || latestRoomState;
    board.innerHTML = buildBoardArt();
    const grid = document.createElement("div");
    grid.className = "board-grid-inner";

    for(let r=0; r<15; r++) {
        for(let c=0; c<15; c++) {
            const cell = document.createElement("div");
            cell.className = "cell";
            cell.id = `cell-${r}-${c}`;
            cell.style.position = "relative";

            let baseColor = null;
            if (r < 6 && c < 6) baseColor = "green";
            else if (r < 6 && c > 8) baseColor = "yellow";
            else if (r > 8 && c > 8) baseColor = "blue";
            else if (r > 8 && c < 6) baseColor = "red";

            if (baseColor) {
                cell.classList.add(`${baseColor}-base`);
                if (state && state.game_mode === "TEAM") {
                    const cornerCells = { "green": [5,5], "yellow": [5,9], "blue": [9,9], "red": [9,5] };
                    const teamLabels = { "red": "A", "yellow": "A", "green": "B", "blue": "B" };
                    const spot = cornerCells[baseColor];
                    if (r === spot[0] && c === spot[1]) {
                        cell.innerHTML = `<span class="team-label">${teamLabels[baseColor]}</span>`;
                    }
                }
                const isSpot = BASE_POSITIONS[baseColor].some(coord => coord[0] === r && coord[1] === c);
                if (isSpot) {
                    cell.classList.add("base-spot", `spot-${baseColor}`);
                }
            }
            grid.appendChild(cell);
        }
    }
    board.appendChild(grid);
}

function showDiceResult(color, value) {
    playSkinSound(color, 'roll');
    skinDiceFx(color);

    const die = document.getElementById("main-die");
    if(die) {
        die.classList.toggle("odd-roll");
        die.classList.toggle("even-roll");
        die.dataset.roll = value;
    }

    const diceContainer = document.getElementById("main-dice");
    if(diceContainer) {
        diceContainer.classList.remove("active");
        diceContainer.classList.remove("pop");
        void diceContainer.offsetWidth;
        diceContainer.classList.add("pop");
        diceContainer.addEventListener("animationend", function _off() {
            diceContainer.classList.remove("pop");
            diceContainer.removeEventListener("animationend", _off);
        }, { once: true });
    }
}

function updateTimerUI(color, time) {
    const percentage = (time / turnSeconds) * 100;
    const playerCard = document.getElementById(`player-${color}`);
    if(!playerCard) return;
    
    // Aktiv sızıqshanı tabıw (óshpegen AQIRǴI sızıqsha)
    const loaders = playerCard.querySelectorAll('.life-dot:not(.missed):not(.off) .life-loader');
    if(loaders.length > 0) {
        const lastLoader = loaders[loaders.length - 1];
        lastLoader.style.width = `${percentage}%`;
        // Waqıt az qalǵanda (≤10 s; Blits'te ≤5 s) sızıqsha qızılǵa ótedi; basqa waqıtta — oyınshı reńi (CSS)
        lastLoader.classList.toggle("low", time <= Math.min(10, turnSeconds / 3));
    }
}

// ───────────────────────── Confetti (jeńis salyutı) ─────────────────────────
// Sırtqı kitapхanasız — óz canvas'ımızda. Jeńiste (game over, 1-orın) hám óz
// tasıń úyge jetkende oynaйdı. Jeńil hám ózi tazalanadı (durationMs sońında).
function launchConfetti(durationMs) {
    durationMs = durationMs || 2500;
    let canvas = document.getElementById('confetti-canvas');
    if (!canvas) {
        canvas = document.createElement('canvas');
        canvas.id = 'confetti-canvas';
        canvas.style.cssText = 'position:fixed;inset:0;width:100%;height:100%;pointer-events:none;z-index:6000;';
        document.body.appendChild(canvas);
    }
    const ctx = canvas.getContext('2d');
    const DPR = Math.min(2, window.devicePixelRatio || 1);
    const W = window.innerWidth, H = window.innerHeight;
    canvas.width = W * DPR;
    canvas.height = H * DPR;
    ctx.setTransform(DPR, 0, 0, DPR, 0, 0);

    const colors = ['#E5463E', '#22A45D', '#F5B521', '#2D7FE0', '#F7CC66', '#F3F5F9'];

    // Eki qaptaldaǵı «zambırek» (cannon): tómen-shep hám tómen-oń múyeshlerden
    // ortaǵa qaray joqarı atıladı, keyin awırlıq penen tógiledi — Telegram quiz
    // confetti sıyaqlı. Hár bólekshe óz ómirin (life) tawısqan sayın ásten óshedi.
    const parts = [];
    const PER_SIDE = 70;
    function spawnCannon(originX, angleDeg) {
        for (let i = 0; i < PER_SIDE; i++) {
            const spread = 55;                                    // shashıraw múyeshi
            const a = (angleDeg + (Math.random() - 0.5) * spread) * Math.PI / 180;
            const speed = 13 + Math.random() * 9;                 // baslanǵısh tezlik
            const ticks = 280 + Math.random() * 100;              // ómir uzınlıǵı (freym)
            parts.push({
                x: originX,
                y: H + 8,
                r: 4 + Math.random() * 5,
                c: colors[(Math.random() * colors.length) | 0],
                vx: Math.cos(a) * speed,
                vy: -Math.sin(a) * speed,                         // joqarı = teris
                rot: Math.random() * Math.PI,
                vrot: -0.25 + Math.random() * 0.5,
                wobble: Math.random() * Math.PI * 2,              // flutter fazası
                wobbleSpeed: 0.05 + Math.random() * 0.06,         // terbeliw tezligi
                life: 1,
                decay: 1 / ticks,
            });
        }
    }
    spawnCannon(0, 60);       // shep zambırek — joqarı-ońǵa
    spawnCannon(W, 120);      // oń zambırek — joqarı-shepke

    const GRAVITY = 0.09;     // hár freym vy'ǵa qosıladı (kishi = ásterek túsedi)
    const DRAG = 0.99;        // hawa qarsılıǵı — tezlikti ásten pásейtedi
    const start = performance.now();
    const MAX_MS = Math.max(durationMs, 2500) + 7000;   // qáwipsizlik shegi (uzaqraq)

    function frame(now) {
        const t = now - start;
        ctx.clearRect(0, 0, W, H);

        let alive = 0;
        for (const p of parts) {
            if (p.life <= 0) continue;
            p.wobble += p.wobbleSpeed;
            p.vx *= DRAG;
            p.vy = p.vy * DRAG + GRAVITY;
            p.x += p.vx + Math.sin(p.wobble) * 0.7;   // flutter — bir jaqqa-bir jaqqa terbeliw
            p.y += p.vy;
            p.rot += p.vrot;
            p.life -= p.decay;
            if (p.life <= 0 || p.y - p.r > H) continue;   // óli yamasa ekran astında
            alive++;
            // Aйlanǵanda qaǵaz jińishkerip-keńeйedi (3D flip sezimi).
            const tw = p.r * (0.35 + 0.65 * Math.abs(Math.cos(p.wobble)));
            ctx.save();
            ctx.globalAlpha = Math.max(0, Math.min(1, p.life));
            ctx.translate(p.x, p.y);
            ctx.rotate(p.rot);
            ctx.fillStyle = p.c;
            ctx.fillRect(-tw / 2, -p.r / 2, tw, p.r * 0.62);
            ctx.restore();
        }

        if (alive > 0 && t < MAX_MS) {
            requestAnimationFrame(frame);
        } else {
            ctx.globalAlpha = 1;
            ctx.clearRect(0, 0, W, H);
            canvas.remove();
        }
    }
    requestAnimationFrame(frame);
}

function celebrateWinner(info) {
    // Atı qasına medal qosıw logikası updateTurnUI ishinde islenedi.
    // Óz reńim barlıq tasların úyge jetkende — jeńis dirildewi (confetti tek
    // aqırǵı game over'da, qos salyut bolmawı ushın).
    if (info && info.color === myColor) hapticNotify('success');
}

function showGameOver(players, ratingChanges) {
    ratingChanges = ratingChanges || {};
    const overlay = document.getElementById("game-over-overlay");
    const resultsContainer = document.getElementById("final-results");
    if (!overlay || !resultsContainer) return;

    resultsContainer.innerHTML = "";
    
    // Oyınshılardı rank boyınsha sortlaw (Rank joqlar eń aqırında)
    const sortedPlayers = [...players].sort((a, b) => {
        const rankA = (a.rank === "KICKED" || a.rank === null) ? 99 : a.rank;
        const rankB = (b.rank === "KICKED" || b.rank === null) ? 99 : b.rank;
        return rankA - rankB;
    });

    sortedPlayers.forEach(p => {
        const row = document.createElement("div");
        const isOut = (p.rank === undefined || p.rank === null || p.rank === "KICKED" || p.rank === 99 || p.rank === 0);
        const isMe = String(p.user_id) === String(userId);
        row.className = "result-row"
            + (isOut ? " rank-out" : ` rank-${p.rank}`)
            + (isMe ? " is-me" : "");

        // Orın: 1/2/3… dóńgelekte; shıǵıp ketken (KICKED/OUT) — «×»
        const rankText = isOut ? "×" : String(p.rank);

        // Ball ózgerisi (delta): oń tárepte +20 jasıl / -15 qızıl
        let deltaHtml = "";
        const ch = ratingChanges[String(p.user_id)];
        if (ch && typeof ch.delta === "number") {
            const d = ch.delta;
            const sign = d > 0 ? "+" : "";
            deltaHtml = `<span class="rr-delta ${d > 0 ? 'up' : 'down'}">${sign}${d}</span>`;
        }

        const youHtml = isMe ? ` <span class="rr-you">(${escapeHtml(tr("you"))})</span>` : "";
        row.innerHTML = `
            <span class="rr-rank">${rankText}</span>
            <span class="rr-name">${escapeHtml(formatName(p.name))}${youHtml}</span>
            ${deltaHtml}
        `;
        resultsContainer.appendChild(row);
    });

    overlay.style.display = "flex";

    // Juwmaq salyutı — tek BIR ret (showGameOver eki ret shaqırılıwı múmkin:
    // FINISHED statusı hám GAME_OVER waqıyası). Óz oyınshım (yamasa komandam)
    // 1-orın bolsa — confetti + jeńis dirildewi; bolmasa jeńil «soft» soqqı.
    if (!showGameOver._done) {
        showGameOver._done = true;
        const me = players.find(p => String(p.user_id) === String(userId));
        if (me && me.rank === 1) {
            launchConfetti(2800);
            hapticNotify('success');
        } else if (me) {
            hapticImpact('soft');
        }
    }
}

// Juwmaq oknasınıń «Jabıw» túymesi: Telegram ishinde Mini App'ti jabadı,
// brauzerde (dev) — tek oknanı jasıradı.
function closeGameOver() {
    hapticSelection();
    if (tg && tg.initDataUnsafe && tg.initDataUnsafe.user) {
        try { tg.close(); return; } catch (e) {}
    }
    const overlay = document.getElementById("game-over-overlay");
    if (overlay) overlay.style.display = "none";
}

function showGameOverModal(players) {
    const sorted = [...players].sort((a, b) => (a.rank || 99) - (b.rank || 99));
    let msg = tr("game_finished") + "\n\n";
    sorted.forEach(p => {
        msg += `#${p.rank}: ${p.name} (${p.color})\n`;
    });
    alert(msg);
    location.reload(); // Betti jańalap bólmeden shıǵıw
}

function updateLivesUI(color, missed_turns, rank) {
    const card = document.getElementById(`player-${color}`);
    const dots = card.querySelectorAll('.life-dot');
    
    if(rank) {
        const isTeamMode = latestRoomState && latestRoomState.game_mode === "TEAM";
        if (!isTeamMode) {
            card.querySelector('.lives-container').style.display = "none";
            return;
        }
    }

    dots.forEach((dot, idx) => {
        const loader = dot.querySelector('.life-loader');
        dot.classList.toggle("off", idx >= turnLives);   // ⚜️ Blits'te — 1 sızıqsha
        if (idx >= turnLives - missed_turns) {
            dot.classList.add("missed");
            if(loader) loader.style.width = "0%";
        } else {
            dot.classList.remove("missed");
            if(loader) {
                loader.style.width = "100%";
                loader.classList.remove("low");
            }
        }
    });
}

function setDiceComment(title, message) {
    const titleEl = document.getElementById("dice-comment-title");
    const textEl = document.getElementById("dice-comment-text");
    if (titleEl) titleEl.textContent = title || "";
    if (textEl) textEl.textContent = message || "";
}

function setTurnComment(title, message, count) {
    const titleEl = document.getElementById("turn-commentary-title");
    const textEl = document.getElementById("turn-commentary-text");
    const countEl = document.getElementById("turn-commentary-count");
    if (titleEl) titleEl.textContent = title || "";
    if (textEl) textEl.textContent = message || "";
    if (countEl && Number.isFinite(count)) countEl.textContent = `${count} / 4`;
}

function characterImageFor(player) {
    const id = player && player.skin;
    const safe = LUDO_CHARACTERS.some(([key]) => key === id) ? id : "optimist";
    return `url("/static/img/characters/${safe}.webp")`;
}

function updateTurnUI(active_color, active_user_id, players) {
    const board = document.getElementById("ludo-board");
    if(board) {
        board.classList.remove("active-red", "active-green", "active-yellow", "active-blue");
        board.classList.add(`active-${active_color}`);
    }

    if(players) {
        const isTeamMode = latestRoomState && latestRoomState.game_mode === "TEAM";
        players.forEach(p => {
            updateLivesUI(p.color, p.missed_turns, p.rank);
            const card = document.getElementById(`player-${p.color}`);
            if(card) {
                const nameEl = card.querySelector('.player-name');
                if(nameEl) nameEl.innerText = formatName(p.name);
                const avatar = card.querySelector('.avatar');
                if (avatar) {
                    avatar.style.backgroundImage = characterImageFor(p);
                    avatar.textContent = "";
                    if (!isTeamMode && [1, 2, 3].includes(p.rank)) avatar.dataset.rank = p.rank;
                    else delete avatar.dataset.rank;
                }
                const note = card.querySelector('.player-comment');
                if (note) {
                    note.textContent = p.finished ? "ФИНИШ" :
                        (p.is_bot ? (p.color === active_color ? "БОТ · ХОДИТ" : "БОТ-СОПЕРНИК") :
                        (p.color === active_color ? (String(p.user_id) === String(userId) ? "ТВОЙ ХОД" : "ХОДИТ") : "В ИГРЕ"));
                }
                card.classList.toggle("is-bot", !!p.is_bot);
            }
        });
    }

    const activePlayer = (players || []).find(p => p.color === active_color);
    const banner = document.getElementById("turn-commentary");
    if (banner) banner.style.setProperty("--turn-color", `var(--${active_color})`);
    const myTurn = String(active_user_id) === String(userId);
    setTurnComment(
        activePlayer ? (activePlayer.is_bot ? `Ход: ${activePlayer.name}` : (myTurn ? "Твой ход" : `Ход: ${activePlayer.name}`)) : "Ожидание",
        activePlayer ? (activePlayer.is_bot ? "Бот думает над доской." : (myTurn ? "Собери стол и бросай кубик." : "Сейчас ход другого игрока.")) : "Собираем игроков за столом.",
        (players || []).length
    );
    const turnIcon = document.getElementById("turn-commentary-icon");
    if (turnIcon) turnIcon.textContent = activePlayer && activePlayer.is_bot ? "♟" : (myTurn ? "👑" : "♛");
    if (activePlayer) {
        if (activePlayer.is_bot) setDiceComment(`ХОД БОТА · ${activePlayer.name}`, "Соперник думает над ходом.");
        else if (myTurn) setDiceComment("ТВОЙ ХОД", "Кубик автоматически бросается до первой шестёрки, затем выбери фишку.");
        else setDiceComment(`ХОД · ${activePlayer.name}`, "Дожидаемся броска соперника.");
    }

    const mainDice = document.getElementById("main-dice");
    if(mainDice) {
        mainDice.style.setProperty("--pc", `var(--${active_color})`);
        const activePlayer = (players || []).find(p => p.color === active_color);
        mainDice.dataset.skin = (activePlayer && activePlayer.skin) || "optimist";
        const isMyTurn = (active_user_id === userId);
        mainDice.classList.toggle("active", isMyTurn);
        mainDice.style.pointerEvents = isMyTurn ? "auto" : "none";
        mainDice.style.opacity = isMyTurn ? "1" : "0.78";
    }

    document.querySelectorAll('.player-card').forEach(card => {
        card.classList.toggle("is-active", card.id === `player-${active_color}`);
    });
}

const MAIN_PATH = [
    [6,1], [6,2], [6,3], [6,4], [6,5], [5,6], [4,6], [3,6], [2,6], [1,6], [0,6],
    [0,7], [0,8], [1,8], [2,8], [3,8], [4,8], [5,8], [6,9], [6,10], [6,11], [6,12], [6,13], [6,14],
    [7,14], [8,14], [8,13], [8,12], [8,11], [8,10], [8,9], [9,8], [10,8], [11,8], [12,8], [13,8], [14,8],
    [14,7], [14,6], [13,6], [12,6], [11,6], [10,6], [9,6], [8,5], [8,4], [8,3], [8,2], [8,1], [8,0],
    [7,0], [6,0] 
];

const HOME_PATHS = {
    "green":  [[7,1], [7,2], [7,3], [7,4], [7,5]],
    "yellow": [[1,7], [2,7], [3,7], [4,7], [5,7]],
    "blue":   [[7,13], [7,12], [7,11], [7,10], [7,9]],
    "red":    [[13,7], [12,7], [11,7], [10,7], [9,7]]
};
const BASE_POSITIONS = {
    "green":  [[1,1], [1,4], [4,1], [4,4]],
    "yellow": [[1,10], [1,13], [4,10], [4,13]],
    "blue":   [[10,10], [10,13], [13,10], [13,13]],
    "red":    [[10,1], [10,4], [13,1], [13,4]]
};
const START_POS_IDX = {"green": 0, "yellow": 13, "blue": 26, "red": 39};
let previousState = null;
function getPieceCoords(color, pos, idx) {
    let coord;
    if (pos === -1) {
        coord = BASE_POSITIONS[color][idx];
    } else if (pos >= 0 && pos <= 50) {
        const globalIdx = (START_POS_IDX[color] + pos) % 52;
        coord = MAIN_PATH[globalIdx];
    } else if (pos >= 51 && pos <= 55) {
        coord = HOME_PATHS[color][pos - 51];
    } else if (pos === 56) {
        if (color === "green") coord = [7, 6];
        else if (color === "yellow") coord = [6, 7];
        else if (color === "blue") coord = [7, 8];
        else if (color === "red") coord = [8, 7];
    }
    return coord;
}

async function renderPieces(board_state) {
    if (!board_state) return;

    if (previousState) {
        let moveInfo = null;
        let eatInfos = [];
        let enterInfos = [];   // bazadan shıqqan taslar (-1 → jolǵa)

        // Tabıw
        for (const color in board_state) {
            for (let i = 0; i < board_state[color].length; i++) {   // 4 tas (⚜️ Tez oyında 2)
                const oldPos = previousState[color][i];
                const newPos = board_state[color][i];
                
                if (newPos > oldPos && oldPos !== -1) {
                    moveInfo = { color, i, oldPos, newPos };
                }
                if (newPos === -1 && oldPos !== -1) {
                    eatInfos.push({ color, i, oldPos });
                }
                if (oldPos === -1 && newPos >= 0) {
                    enterInfos.push({ color, i, newPos });
                }
            }
        }

        if (moveInfo || eatInfos.length > 0) {
            const midState = JSON.parse(JSON.stringify(board_state));
            
            // Jelingen taslardıń ornın waqtınsha saqlap turamız
            eatInfos.forEach(eat => {
                midState[eat.color][eat.i] = eat.oldPos;
            });

            if (moveInfo) {
                await animatePieceMove(moveInfo.color, moveInfo.i, moveInfo.oldPos, moveInfo.newPos, midState);
            }
            
            previousState = { ...midState };
            for(let c in midState) previousState[c] = [...midState[c]];

            if (eatInfos.length > 0) {
                // Jelingen taslardı arqaǵa júrgiziw
                for (const eat of eatInfos) {
                    if (moveInfo) {
                        skinFx('capture', moveInfo.color, getPieceCoords(eat.color, eat.oldPos, eat.i));
                        playSkinSound(moveInfo.color, 'capture');   // jegen oyınshınıń skini
                    } else {
                        playSound('eat');
                    }
                    // Óz tasım jelinse — kúshli eskertiw; basqanıki jelinse (men
                    // oyınshı bolsam) — awır soqqı. Kóriwshige (myColor joq) dirildew joq.
                    if (eat.color === myColor) hapticNotify('warning');
                    else if (myColor) hapticImpact('heavy');
                    await animatePieceEaten(eat.color, eat.i, eat.oldPos, board_state);
                    previousState = { ...board_state };
                    for(let c in board_state) previousState[c] = [...board_state[c]];
                }
            }
        } else {
             drawPiecesStatic(board_state);
        }
        enterInfos.forEach(en => {
            skinFx('enter', en.color, getPieceCoords(en.color, en.newPos, en.i));
            playSkinSound(en.color, 'enter');
        });
    } else {
        drawPiecesStatic(board_state);
    }
    
    previousState = { ...board_state };
    for(let c in board_state) previousState[c] = [...board_state[c]];
}
// Reń → oyınshınıń qoyılǵan tas skini (server player.skin beredi; joq bolsa — klassik)
function skinByColor() {
    const map = {};
    ((latestRoomState && latestRoomState.players) || []).forEach(pl => {
        if (pl && pl.color) map[pl.color] = pl.skin || "classic";
    });
    return map;
}

// Oyınshı skininiń effekti (úyden shıǵıw / iz / tas jew / finish) — oyındı bógemeydi
// Skin vizual effekti (dawıs — playSkinSound arqalı bólek)
function skinFx(kind, color, coord) {
    try {
        const skin = skinByColor()[color];
        if (!skin || skin === "classic" || !window.LudoSkins) return;
        const board = document.getElementById("ludo-board");
        if (board && coord) LudoSkins.playFx(kind, skin, board, coord, color);
    } catch (e) {}
}

// Kubik taslaǵanda skin effekti (Kristal, Taj) — kubik ústinde
function skinDiceFx(color) {
    try {
        const skin = skinByColor()[color];
        if (!skin || skin === "classic" || !window.LudoSkins) return;
        LudoSkins.playDiceFx(skin, document.getElementById("main-dice"));
    } catch (e) {}
}

function drawPiecesStatic(board_state) {
    const cellsMap = {};
    const currentPiecesOnBoard = new Set();
    const skins = skinByColor();
    
    Object.keys(board_state).forEach(color => {
        board_state[color].forEach((pos, idx) => {
            const coord = getPieceCoords(color, pos, idx);
            if(coord) {
                const cellId = `cell-${coord[0]}-${coord[1]}`;
                if(!cellsMap[cellId]) cellsMap[cellId] = [];
                cellsMap[cellId].push({ color, idx });
                currentPiecesOnBoard.add(`piece-${color}-${idx}`);
            }
        });
    });

    // Remove pieces that are no longer on the board
    document.querySelectorAll('.piece').forEach(p => {
        if (!currentPiecesOnBoard.has(p.id)) {
            p.remove();
        }
    });

    Object.keys(cellsMap).forEach(cellId => {
        const cell = document.getElementById(cellId);
        if(!cell) return;
        const pieces = cellsMap[cellId];
        const count = pieces.length;

        pieces.forEach((p, i) => {
            const pieceId = `piece-${p.color}-${p.idx}`;
            let piece = document.getElementById(pieceId);
            
            if (!piece) {
                piece = document.createElement("div");
                piece.id = pieceId;
                piece.className = `piece ${p.color}`;
            }
            const skin = skins[p.color] || "classic";
            if (piece.dataset.skin !== skin) piece.dataset.skin = skin;

            // TEAM mode logic for piece interaction
            let canClickThisPiece = (p.color === myColor);
            if (latestRoomState && latestRoomState.game_mode === "TEAM") {
                const me = latestRoomState.players.find(pl => pl.user_id === userId);
                if (me && (me.finished || me.rank !== null)) {
                    // I have finished, can move teammate's pieces
                    const teammate = latestRoomState.players.find(pl => pl.team === me.team && pl.color !== me.color);
                    if (teammate && p.color === teammate.color) {
                        canClickThisPiece = true;
                    }
                }
            }

            if (canClickThisPiece) {
                piece.onclick = (e) => { e.stopPropagation(); movePiece(p.idx); };
                if (currentValidPieces.includes(p.idx)) {
                    piece.classList.add("highlight");
                } else {
                    piece.classList.remove("highlight");
                }
            } else {
                piece.onclick = null;
                piece.classList.remove("highlight");
            }

            // Taslar sanına qaray poziciya hám ólshem
            if (count === 1) {
                piece.style.top = "50%"; piece.style.left = "50%";
                piece.style.width = "90%";
            } else if (count === 2) {
                piece.style.top = (i === 0) ? "35%" : "65%";
                piece.style.left = (i === 0) ? "35%" : "65%";
                piece.style.width = "70%";
            } else if (count === 3) {
                const pos = [{t:"30%", l:"30%"}, {t:"30%", l:"70%"}, {t:"70%", l:"50%"}];
                piece.style.top = pos[i].t; piece.style.left = pos[i].l;
                piece.style.width = "60%";
            } else if (count === 4) {
                const pos = [{t:"30%", l:"30%"}, {t:"30%", l:"70%"}, {t:"70%", l:"30%"}, {t:"70%", l:"70%"}];
                piece.style.top = pos[i].t; piece.style.left = pos[i].l;
                piece.style.width = "55%";
            } else {
                // 5 yamasa onnan kóp taslar ushın (Maksimum 16)
                let cols = Math.ceil(Math.sqrt(count));
                let rows = Math.ceil(count / cols);
                let r = Math.floor(i / cols);
                let c = i % cols;
                let stepY = 60 / Math.max(1, (rows - 1));
                let stepX = 60 / Math.max(1, (cols - 1));
                piece.style.top = `${20 + r * stepY}%`;
                piece.style.left = `${20 + c * stepX}%`;
                piece.style.width = `${Math.max(30, 90 / cols)}%`;
            }
            
            // Z-index: Aldıda turǵan (tómenrektegi yáǵnıy top mánisi úlken) taslar ústinde kóriniwi kerek
            piece.style.zIndex = 100 + parseInt(piece.style.top);

            if (piece.parentElement !== cell) {
                cell.appendChild(piece);
            }
        });
    });
}

// Tastı jol boyınsha jıljıtadı: pútkil jol BIR Web Animations API animaciyası,
// tek `transform` — brauzer onı kompozitorda (GPU) oynatadı. Burın hár qádem
// `top/left` + setTimeout edi: hár kadrda layout + taxtanı qayta sızıw, hálsiz
// telefonlarda processor bánt bolsa taymerler keshigip, tas «irkilip» júretuǵın edi.
// Endi JS bánt bolsa da qozǵalıs tegis. path — [r, c] koordinatalar (birinshisi = baslanǵısh).
const PIECE_STEP_MS = 85;      // bir kletkaǵa júriw waqtı
// Jelingen tastıń bazaǵa qaytıwı: aldın soqqı sátinde sál toqtap (jew effekti kórinsin),
// keyin hár kletkaǵa 70 ms; jaqın qaytıw da tım tez bolmasın (min), uzaǵı oyındı
// sozbasın (max) — ulıwma waqıt usı aralıqta.
const EATEN_PAUSE_MS = 300;
const PIECE_BACK_STEP_MS = 70;
const EATEN_BACK_MIN_MS = 700;
const EATEN_BACK_MAX_MS = 2800;

async function animatePieceAlongPath(piece, board, path, stepMs, onStep) {
    const grid = board.querySelector(".board-grid-inner") || board;
    const size = grid.clientWidth / 15;
    const at = (c) => `translate(${(c[1] + 0.5) * size}px, ${(c[0] + 0.5) * size}px) translate(-50%, -85%)`;

    // Jıljıytuǵın tastı board dárejesine kóteremiz; poziciya tek transform arqalı
    piece.classList.remove("highlight");
    piece.style.transition = "none";
    piece.style.width = (size * 0.9) + "px";
    piece.style.left = "0px";
    piece.style.top = "0px";
    piece.style.zIndex = 3000;   // animaciya waqtında bárinen ústinde
    piece.style.transform = at(path[0]);
    grid.appendChild(piece);

    if (path.length > 1) {
        const total = stepMs * (path.length - 1);
        if (onStep) {
            // Qádem dawısları/izleri — hár kletkaǵa jetken sátte (qozǵalıstan ǵárezsiz).
            // Taymerler ÓSHIRILMEYDI: sońǵı qádemniki animaciya tamamlanıwı menen bir
            // waqıtta keledi — óshirsek, sońǵı qádemniń dawısı/izi joǵalıp qalatuǵın edi.
            for (let i = 1; i < path.length; i++) setTimeout(() => onStep(i), stepMs * i);
        }
        if (typeof piece.animate === "function") {
            const frames = path.map((c, i) => ({ transform: at(c), offset: i / (path.length - 1) }));
            const anim = piece.animate(frames, { duration: total, easing: "linear", fill: "forwards" });
            // Qorǵaw: bet jasırın bolsa (Mini App fon'da) brauzer animaciyanı toqtatadı hám
            // `finished` keshigedi — xabarlar náwbeti bógelmewi ushın taymer menen jarısadı.
            await Promise.race([
                anim.finished.catch(() => {}),
                new Promise(r => setTimeout(r, total + 150)),
            ]);
            piece.style.transform = at(path[path.length - 1]);
            anim.cancel();
        } else {
            await new Promise(r => setTimeout(r, total));   // eski brauzer — sekirip ótedi
        }
    }

    // Tamam — inline transform'dı alıp, tas CSS boyınsha kletkaǵa qaytadı (drawPiecesStatic)
    piece.style.transform = "";
    piece.style.zIndex = "";
}

function _pathCoords(color, pieceIdx, from, to) {
    const out = [];
    const step = to >= from ? 1 : -1;
    for (let p = from; step > 0 ? p <= to : p >= to; p += step) {
        const c = getPieceCoords(color, p, pieceIdx);
        if (c) out.push(c);
    }
    return out;
}

// drawPiecesStatic aldınan transition'dı óshirip, keyin tiklew — tas jańa kletkaǵa
// «ushıp» barmasın (top/left 0.2s transition iske túspesin).
function _drawStaticNoTransition(piece, finalState) {
    piece.style.transition = "none";
    drawPiecesStatic(finalState);
    void piece.offsetWidth;   // reflow — jańa poziciya transition'sız qollanılsın
    piece.style.transition = "";
}

async function animatePieceMove(color, pieceIdx, oldPos, newPos, finalState) {
    const board = document.getElementById("ludo-board");
    const piece = document.getElementById(`piece-${color}-${pieceIdx}`);
    if (!board || !piece) {
        // Fallback: element tabılmasa eski usıl (tolıq qayta sızıw)
        drawPiecesStatic(finalState);
        if (newPos === 56) { playSound('win'); if (color === myColor) hapticNotify('success'); }
        return;
    }

    const path = _pathCoords(color, pieceIdx, oldPos, newPos);
    await animatePieceAlongPath(piece, board, path, PIECE_STEP_MS, (i) => {
        playSkinSound(color, 'move');
        skinFx('trail', color, path[i - 1]);   // artta qalǵan kletkada iz
    });
    if (newPos === 56) {
        skinFx('finish', color, path[path.length - 1]);
        playSkinSound(color, 'finish');
        if (color === myColor) hapticNotify('success');
    }
    _drawStaticNoTransition(piece, finalState);
}

async function animatePieceEaten(color, pieceIdx, oldPos, finalState) {
    // Tas jelingeninde bazaǵa qaytıw animaciyası (jol boyınsha keyin qaytıw).
    const board = document.getElementById("ludo-board");
    const piece = document.getElementById(`piece-${color}-${pieceIdx}`);
    if (!board || !piece) {
        drawPiecesStatic(finalState);
        await new Promise(r => setTimeout(r, 100));
        return;
    }

    const path = _pathCoords(color, pieceIdx, oldPos, 0);
    const steps = Math.max(1, path.length - 1);
    const total = Math.min(EATEN_BACK_MAX_MS, Math.max(EATEN_BACK_MIN_MS, steps * PIECE_BACK_STEP_MS));
    await new Promise(r => setTimeout(r, EATEN_PAUSE_MS));
    await animatePieceAlongPath(piece, board, path, total / steps, null);
    _drawStaticNoTransition(piece, finalState);
    await new Promise(r => setTimeout(r, 100));
}

let currentValidPieces = [];

function highlightValidPieces(dice_color, dice_value, board_state) {
    if(!myColor || !board_state[dice_color]) return;
    if(dice_color !== myColor) return;
    
    currentValidPieces = []; // Tazalaw

    let targetColor = myColor;
    if (latestRoomState && latestRoomState.game_mode === "TEAM") {
        const me = latestRoomState.players.find(pl => pl.user_id === userId);
        if (me && (me.finished || me.rank !== null)) {
            const teammate = latestRoomState.players.find(pl => pl.team === me.team && pl.color !== me.color);
            if (teammate) targetColor = teammate["color"];
        }
    }

    // Barlıq tasıńızdı tekserip shıǵıw
    board_state[targetColor].forEach((pos, idx) => {
        let canMove = false;
        if (pos === -1 && dice_value === 6) canMove = true;
        else if (pos !== -1 && pos + dice_value <= 56) canMove = true;
        
        if (canMove) {
            currentValidPieces.push(idx);
        }
    });

    // Klasstı qosıw ushın DOM elementlerin tabıw
    currentValidPieces.forEach(pieceId => {
        const pieceEl = document.getElementById(`piece-${targetColor}-${pieceId}`);
        if (pieceEl) {
            pieceEl.classList.add("highlight");
        }
    });

    // Júre alatuǵın taslar tayar — jińishke tańlaw dirildewi (tas basıw ushın cue).
    if (currentValidPieces.length > 0) hapticSelection();

    // Avtomat túrde júriw (Auto-move) eger barlıq júre alatuǵın taslar bir kletkada bolsa yamasa tek 1 tas bolsa
    if (currentValidPieces.length > 0) {
        let firstPiecePos = board_state[targetColor][currentValidPieces[0]];
        let allSamePosition = true;
        
        for (let i = 1; i < currentValidPieces.length; i++) {
            if (board_state[targetColor][currentValidPieces[i]] !== firstPiecePos) {
                allSamePosition = false;
                break;
            }
        }
        
        if (allSamePosition) {
            if (autoMoveTimeout) clearTimeout(autoMoveTimeout);
            autoMoveTimeout = setTimeout(() => movePiece(currentValidPieces[0]), 500);
        }
    }
}

function movePiece(piece_id) {
    if (autoMoveTimeout) {
        clearTimeout(autoMoveTimeout);
        autoMoveTimeout = null;
    }
    currentValidPieces = [];
    hapticImpact('light');   // tas tańlaw/júriw — jeńil soqqı
    if(ws) ws.send(JSON.stringify({ action: "MOVE_PIECE", user_id: userId, piece_id: piece_id }));
}





let isChatOpen = false;

// Tómengi túymelerdiń (menyu/chat) «ashıq» halatın hám oqılmaǵan belgisin jańalaw.
function syncFabs() {
    const chatBtn = document.getElementById('chat-toggle-btn');
    const menuBtn = document.getElementById('menu-toggle-btn');
    if (chatBtn) {
        chatBtn.classList.toggle('is-open', isChatOpen);
        if (isChatOpen) chatBtn.classList.remove('has-unread');
    }
    if (menuBtn) menuBtn.classList.toggle('is-open', isMenuOpen);
}

function toggleChat() {
    const chat = document.getElementById('chat-container');
    const btn = document.getElementById('chat-toggle-btn');
    const notif = document.getElementById('chat-notification');
    const messagesContainer = document.getElementById('chat-messages');
    
    if (chat.style.display === 'none') {
        // Eki popup birdей ashıq turmasın — menyu ashıq bolsa jabamız.
        const menu = document.getElementById('menu-container');
        if (menu && menu.style.display === 'flex') { menu.style.display = 'none'; isMenuOpen = false; }

        chat.style.display = 'flex';
        isChatOpen = true;

        if (messagesContainer) {
            messagesContainer.scrollTop = messagesContainer.scrollHeight;
        }

        if (notif) {
            notif.classList.remove('show');
            setTimeout(() => notif.style.display = 'none', 300);
        }
    } else {
        chat.style.display = 'none';
        isChatOpen = false;
    }
    syncFabs();
}


// ─────────────────────────── Menyu popup'ı (sazlamalar) ──────────────────────
let isMenuOpen = false;

function toggleMenu() {
    const menu = document.getElementById('menu-container');
    if (!menu) return;
    if (menu.style.display === 'none' || !menu.style.display) {
        // Chat ashıq bolsa jabamız (eki popup birdей ashıq turmasın).
        const chat = document.getElementById('chat-container');
        if (chat && chat.style.display === 'flex') { chat.style.display = 'none'; isChatOpen = false; }

        updateMenuUI();
        menu.style.display = 'flex';
        isMenuOpen = true;
        hapticSelection();
    } else {
        menu.style.display = 'none';
        isMenuOpen = false;
    }
    syncFabs();
}

// Ikonka knopkalarınıń halatın (on/off klassları + tooltip) házirgi sazlamaǵa
// qaray jańalaydı. Jazıw joq — halat tek vizual effektler menen belgilenedi.
function updateMenuUI() {
    const sIcon = document.getElementById('menu-sound-icon');
    const sBtn = document.getElementById('menu-sound-btn');
    if (sIcon) sIcon.innerHTML = soundEnabled ? ICONS.soundOn : ICONS.soundOff;
    if (sBtn) {
        sBtn.classList.toggle('on', soundEnabled);
        sBtn.classList.toggle('off', !soundEnabled);
        sBtn.title = tr('sound') + ': ' + (soundEnabled ? tr('on') : tr('off'));
    }

    const vIcon = document.getElementById('menu-vibration-icon');
    const vBtn = document.getElementById('menu-vibration-btn');
    if (vIcon) vIcon.innerHTML = vibrationEnabled ? ICONS.vibrationOn : ICONS.vibrationOff;
    if (vBtn) {
        vBtn.classList.toggle('on', vibrationEnabled);
        vBtn.classList.toggle('off', !vibrationEnabled);
        vBtn.title = tr('vibration') + ': ' + (vibrationEnabled ? tr('on') : tr('off'));
    }

    const lBtn = document.getElementById('menu-leave-btn');
    if (lBtn) lBtn.title = tr('leave_game');
}

// Toggle basılǵanda kishi "pop" (pulse) effekti — halattıń ózgergenin sezdiredi.
function menuPop(btn) {
    if (!btn) return;
    btn.classList.remove('pop');
    void btn.offsetWidth;   // reflow — animatsiyanı qaйta baslaw ushın
    btn.classList.add('pop');
    setTimeout(() => btn.classList.remove('pop'), 400);
}

function toggleSoundSetting() {
    soundEnabled = !soundEnabled;
    localStorage.setItem('ludo_sound', soundEnabled ? '1' : '0');
    updateMenuUI();
    menuPop(document.getElementById('menu-sound-btn'));
    hapticSelection();
    if (soundEnabled) playSound('turn');   // qosılǵanın tastıйıqlaw ushın kishi ses
}

function toggleVibrationSetting() {
    vibrationEnabled = !vibrationEnabled;
    localStorage.setItem('ludo_vibration', vibrationEnabled ? '1' : '0');
    updateMenuUI();
    menuPop(document.getElementById('menu-vibration-btn'));
    if (vibrationEnabled) hapticImpact('medium');   // qosılǵanın sezdiriw
}

// Telegram'nıń óz rastlaw dialogı (bolmasa — brauzer confirm'i).
function askConfirm(message, onYes) {
    if (tg && typeof tg.showConfirm === 'function') {
        try { tg.showConfirm(message, (ok) => { if (ok) onYes(); }); return; }
        catch (e) {}
    }
    if (window.confirm(message)) onYes();
}

function leaveGame() {
    askConfirm(tr('leave_confirm'), () => {
        // Serverге shıǵıw haqqında xabar beremiz (KICK sıyaqlı, biraq bloksiz).
        try {
            if (ws && ws.readyState === WebSocket.OPEN) {
                ws.send(JSON.stringify({ action: "LEAVE_GAME", user_id: userId }));
            }
        } catch (e) { console.warn("leave send failed:", e); }
        hapticImpact('heavy');
        // Xabar serverге jetsin dep az kútip, keyin Mini App'ti jabamız.
        setTimeout(() => {
            if (tg && tg.initDataUnsafe && tg.initDataUnsafe.user) {
                try { tg.close(); } catch (e) { location.reload(); }
            } else {
                location.reload();
            }
        }, 300);
    });
}


// Sırttan kirgen kóriwshi (VIP emes) chatqa jaza almaydı — server CHAT_PERM jiberedi
function setChatPermission(canWrite) {
    const input = document.getElementById('chat-input');
    const btn = document.querySelector('.chat-input-area .send-btn');
    if (!input) return;
    input.disabled = !canWrite;
    if (btn) btn.disabled = !canWrite;
    input.dataset.i18nPh = canWrite ? "chat_ph" : "chat_locked_ph";
    input.placeholder = tr(input.dataset.i18nPh);
}

function sendMessage() {
    const input = document.getElementById('chat-input');
    const text = input.value.trim();
    if (!text) return;
    // Socket ASHIQ (OPEN) emes bolsa (reconnect ortasında) — ws.send() qátelik
    // beredi hám xabar úndemey joǵaladı. Sonlıqtan halattı tekseremiz: ashıq
    // bolmasa tekstti SAQLAP (input'tı tazalamay) baylanıstı jańalaймız, user
    // qaйta basıp jibere aladı.
    if (!ws || ws.readyState !== WebSocket.OPEN) {
        if (typeof onAppForeground === 'function') onAppForeground();  // reconnect
        return;
    }
    try {
        ws.send(JSON.stringify({
            action: "SEND_MESSAGE",
            user_id: userId,
            name: userName,
            text: text
        }));
        input.value = "";
        hapticSelection();
    } catch (e) {
        console.warn("chat send failed:", e);   // input tazalanbaydı — qaйta urınıwǵa boladı
    }
}



let voiceNoteRecorder = null;
let voiceNoteStream = null;
let voiceNoteChunks = [];
let voiceNoteStartedAt = 0;
let voiceNoteMaxTimer = null;
let voiceSessionToken = "";

async function uploadVoiceMessage(blob, durationSeconds) {
    if (!cleanRoomCode || !voiceSessionToken) {
        showChatNotification("", "Игровой голосовой канал ещё подключается. Попробуй через секунду.", null, 4000);
        return;
    }
    const mimeType = (blob.type || "audio/webm").split(";")[0].toLowerCase();
    if (!["audio/webm", "audio/ogg", "audio/mp4"].includes(mimeType)) {
        showChatNotification("", "Формат записи не поддерживается. Обнови Telegram.", null, 5000);
        return;
    }
    try {
        const response = await fetch("/api/rooms/" + encodeURIComponent(cleanRoomCode) + "/voice", {
            method: "POST",
            headers: {
                "content-type": mimeType,
                "x-room-session": voiceSessionToken,
                "x-voice-duration": String(durationSeconds)
            },
            body: blob
        });
        const data = await response.json().catch(() => ({}));
        if (!response.ok) throw new Error(data.detail || data.message || "Не удалось отправить голосовое сообщение.");
    } catch (error) {
        showChatNotification("", error instanceof Error ? error.message : "Не удалось отправить голосовое сообщение.", null, 6000);
        console.warn("[VOICE_UPLOAD_ERROR]", error);
    }
}

async function toggleVoiceNoteRecording() {
    const button = document.getElementById("voice-note-btn");
    if (voiceNoteRecorder && voiceNoteRecorder.state === "recording") {
        voiceNoteRecorder.stop();
        return;
    }
    if (!navigator.mediaDevices?.getUserMedia || typeof MediaRecorder === "undefined") {
        showChatNotification("", "Запись аудио не поддерживается этим браузером Telegram.", null, 6000);
        return;
    }
    if (!ws || ws.readyState !== WebSocket.OPEN || !voiceSessionToken) {
        showChatNotification("", "Голосовой канал переподключается. Попробуй ещё раз через секунду.", null, 4000);
        return;
    }
    try {
        voiceNoteStream = await navigator.mediaDevices.getUserMedia({
            audio: { echoCancellation: true, noiseSuppression: true, autoGainControl: true }
        });
        const preferred = ["audio/webm;codecs=opus", "audio/ogg;codecs=opus", "audio/mp4"];
        const mimeType = preferred.find(type => MediaRecorder.isTypeSupported?.(type));
        const recorderOptions = mimeType
            ? { mimeType, audioBitsPerSecond: 32_000 }
            : { audioBitsPerSecond: 32_000 };
        voiceNoteRecorder = new MediaRecorder(voiceNoteStream, recorderOptions);
        voiceNoteChunks = [];
        voiceNoteStartedAt = Date.now();
        voiceNoteRecorder.addEventListener("dataavailable", event => {
            if (event.data && event.data.size > 0) voiceNoteChunks.push(event.data);
        });
        voiceNoteRecorder.addEventListener("error", event => {
            console.warn("[VOICE_RECORDER_ERROR]", event.error || event);
            showChatNotification("", "Не удалось записать звук. Проверь доступ к микрофону.", null, 5000);
            if (voiceNoteRecorder?.state === "recording") voiceNoteRecorder.stop();
        });
        voiceNoteRecorder.addEventListener("stop", () => {
            if (voiceNoteMaxTimer) clearTimeout(voiceNoteMaxTimer);
            voiceNoteMaxTimer = null;
            const recorder = voiceNoteRecorder;
            voiceNoteRecorder = null;
            const stream = voiceNoteStream;
            voiceNoteStream = null;
            if (stream) stream.getTracks().forEach(track => track.stop());
            if (button) {
                button.classList.remove("is-recording");
                button.textContent = "🎙️";
                button.title = "Записать голосовое сообщение";
            }
            const elapsed = (Date.now() - voiceNoteStartedAt) / 1000;
            const durationSeconds = Math.ceil(elapsed);
            const blob = new Blob(voiceNoteChunks, {
                type: (recorder && recorder.mimeType) || voiceNoteChunks[0]?.type || "audio/webm"
            });
            voiceNoteChunks = [];
            if (elapsed < 0.8 || blob.size < 256) {
                showChatNotification("", "Запись слишком короткая или пустая. Запиши ещё раз.", null, 4000);
                console.warn("[VOICE_RECORD_EMPTY]", { elapsed, bytes: blob.size, mime: blob.type });
                return;
            }
            if (blob.size > 512 * 1024) {
                showChatNotification("", "Запись получилась слишком большой. Попробуй говорить короче.", null, 5000);
                return;
            }
            void uploadVoiceMessage(blob, Math.min(30, durationSeconds));
        });
        voiceNoteRecorder.start(250);
        if (button) {
            button.classList.add("is-recording");
            button.textContent = "■";
            button.title = "Остановить запись и отправить";
        }
        showChatNotification("", "Запись началась. Нажми ■, чтобы отправить.", null, 32000);
        voiceNoteMaxTimer = setTimeout(() => {
            showChatNotification("", "Достигнут лимит записи — отправляем голосовое.", null, 3500);
            if (voiceNoteRecorder?.state === "recording") voiceNoteRecorder.stop();
        }, 30_000);
    } catch (error) {
        if (voiceNoteStream) voiceNoteStream.getTracks().forEach(track => track.stop());
        voiceNoteStream = null;
        voiceNoteRecorder = null;
        if (button) {
            button.classList.remove("is-recording");
            button.textContent = "🎙️";
        }
        const message = error?.name === "NotAllowedError"
            ? "Разрешите Telegram доступ к микрофону в настройках телефона."
            : error?.name === "NotReadableError"
                ? "Микрофон занят другим приложением. Закрой запись экрана/диктофон и попробуй снова."
                : "Не удалось включить запись. Проверь доступ к микрофону.";
        showChatNotification("", message, null, 6500);
        console.warn("[VOICE_START_FAILED]", error);
    }
}

function handleChatKey(event) {
    if (event.key === 'Enter') sendMessage();
}


function getLightColor(colorName) {
    const colorMap = {
        'red': '#F08A84',
        'blue': '#7FB0F0',
        'green': '#6FD39A',
        'yellow': '#F7CC66'
    };
    return colorMap[colorName] || colorName;
}

function formatLudoVoiceTime(seconds) {
    const total = Math.max(0, Math.floor(Number(seconds) || 0));
    return Math.floor(total / 60) + ":" + String(total % 60).padStart(2, "0");
}

function createLudoVoicePlayer(message) {
    const wrapper = document.createElement("div");
    wrapper.className = "voice-player";
    const button = document.createElement("button");
    button.type = "button";
    button.className = "voice-play";
    button.textContent = "▶";
    button.setAttribute("aria-label", "Прослушать голосовое сообщение");

    const track = document.createElement("div");
    track.className = "voice-track";
    track.setAttribute("role", "progressbar");
    track.setAttribute("aria-label", "Прогресс голосового сообщения");
    const progress = document.createElement("div");
    progress.className = "voice-progress";
    track.append(progress);

    const duration = document.createElement("span");
    duration.className = "voice-duration";
    duration.textContent = formatLudoVoiceTime(message.durationSeconds);

    const audio = document.createElement("audio");
    audio.preload = "none";
    audio.hidden = true;
    let objectUrl = "";
    const releaseAudio = () => {
        if (objectUrl) URL.revokeObjectURL(objectUrl);
        objectUrl = "";
        audio.removeAttribute("src");
        audio.load();
    };
    audio.addEventListener("timeupdate", () => {
        const ratio = Number.isFinite(audio.duration) && audio.duration > 0 ? audio.currentTime / audio.duration : 0;
        progress.style.width = Math.max(0, Math.min(1, ratio)) * 100 + "%";
        duration.textContent = formatLudoVoiceTime(audio.currentTime) + " / " + formatLudoVoiceTime(message.durationSeconds);
    });
    audio.addEventListener("play", () => { button.textContent = "Ⅱ"; });
    audio.addEventListener("pause", () => { button.textContent = "▶"; });
    audio.addEventListener("ended", () => {
        button.textContent = "▶";
        progress.style.width = "0%";
        duration.textContent = formatLudoVoiceTime(message.durationSeconds);
        releaseAudio();
    });
    button.addEventListener("click", async () => {
        if (!voiceSessionToken) {
            showChatNotification("", "Переподключаем голосовой канал. Попробуй ещё раз через секунду.", null, 3500);
            return;
        }
        if (audio.src) {
            if (audio.paused) {
                try { await audio.play(); }
                catch { showChatNotification("", "Не удалось воспроизвести запись.", null, 4500); }
            } else audio.pause();
            return;
        }
        button.disabled = true;
        duration.textContent = "Загрузка…";
        try {
            const response = await fetch(
                "/api/rooms/" + encodeURIComponent(message.roomCode) + "/voice/" + encodeURIComponent(message.voiceId),
                { headers: { "x-room-session": voiceSessionToken } }
            );
            if (!response.ok) {
                const data = await response.json().catch(() => ({}));
                throw new Error(data.detail || data.message || "Голосовое сообщение недоступно.");
            }
            const blob = await response.blob();
            if (!blob.size) throw new Error("Аудиофайл пустой. Запиши сообщение ещё раз.");
            objectUrl = URL.createObjectURL(blob);
            audio.src = objectUrl;
            await audio.play();
            duration.textContent = formatLudoVoiceTime(message.durationSeconds);
        } catch (error) {
            releaseAudio();
            duration.textContent = formatLudoVoiceTime(message.durationSeconds);
            showChatNotification("", error instanceof Error ? error.message : "Не удалось загрузить голосовое сообщение.", null, 5000);
            console.warn("[VOICE_PLAYBACK_ERROR]", error);
        } finally {
            button.disabled = false;
        }
    });
    track.addEventListener("click", event => {
        if (!audio.src || !Number.isFinite(audio.duration) || audio.duration <= 0) return;
        const bounds = track.getBoundingClientRect();
        const ratio = Math.max(0, Math.min(1, (event.clientX - bounds.left) / bounds.width));
        audio.currentTime = ratio * audio.duration;
    });
    wrapper.append(button, track, duration, audio);
    return wrapper;
}

function addMessageToUI(msg) {
    const container = document.getElementById('chat-messages');
    const btn = document.getElementById('chat-toggle-btn');
    const msgDiv = document.createElement('div');
    const isMe = msg.user_id === userId;
    const displayColor = getLightColor(msg.color);

    // Sistema xabarı (mısalı «🚪 X oyınnan shıqtı») — ortalıqta, solǵın, atsız.
    if (msg.system) {
        msgDiv.className = 'chat-msg system-msg';
        msgDiv.innerHTML = `<span>${escapeHtml(msg.text)}</span>`;
        container.appendChild(msgDiv);
        container.scrollTop = container.scrollHeight;
        if (!isChatOpen) showChatNotification('', msg.text, null);
        return;
    }

    msgDiv.className = `chat-msg ${isMe ? 'my-msg' : 'other-msg'}`;
    const author = isMe ? '' : `<small style="color: ${displayColor};">${escapeHtml(msg.name)}</small>`;
    if (msg.voice_id && /^[a-f0-9]{32}$/.test(msg.voice_id)) {
        msgDiv.innerHTML = `${author}<div class="voice-message-caption">🎙️ Голосовое сообщение · ${Math.max(1, Number(msg.duration_seconds) || 1)} сек.</div>`;
        msgDiv.appendChild(createLudoVoicePlayer({
            roomCode: cleanRoomCode,
            voiceId: msg.voice_id,
            durationSeconds: Number(msg.duration_seconds) || 1
        }));
    } else if (msg.audio_data) {
        // Compatibility with older voice messages already sent through WebSocket.
        const mime = ["audio/webm", "audio/ogg", "audio/mp4"].includes(msg.mime_type) ? msg.mime_type : "audio/webm";
        msgDiv.innerHTML = `${author}<div class="voice-message-caption">🎙️ Голосовое сообщение</div>`;
        const player = document.createElement("audio");
        player.className = "voice-message-audio";
        player.controls = true;
        player.preload = "metadata";
        player.src = `data:${mime};base64,${msg.audio_data}`;
        msgDiv.appendChild(player);
    } else {
        msgDiv.innerHTML = `${author}<span>${escapeHtml(msg.text)}</span>`;
    }

    container.appendChild(msgDiv);
    container.scrollTop = container.scrollHeight;

    // Eger chat jabıq bolsa hám xabar basqa adamnan kelse, aqırǵı xabardı kórsetiw
    if (!isChatOpen && !isMe) {
        showChatNotification(msg.name, (msg.voice_id || msg.audio_data) ? tr("voice_note") : msg.text, msg.color);
        if (btn) btn.classList.add('has-unread');
    }
}

let chatNotifTimeout = null;
function showChatNotification(name, text, color, durationMs = 5000) {
    let notif = document.getElementById('chat-notification');
    if (!notif) {
        notif = document.createElement('div');
        notif.id = 'chat-notification';
        document.body.appendChild(notif);
    }
    
    const displayColor = getLightColor(color);
    notif.innerHTML = name
        ? `<strong style="color: ${displayColor || '#F3F5F9'};">${escapeHtml(name)}:</strong> ${escapeHtml(text)}`
        : `${escapeHtml(text)}`;   // sistema xabarı — atsız
    notif.style.display = 'block';
    
    void notif.offsetWidth; // Animaciya ushın
    notif.classList.add('show');
    
    if (chatNotifTimeout) clearTimeout(chatNotifTimeout);
    
    chatNotifTimeout = setTimeout(() => {
        notif.classList.remove('show');
        setTimeout(() => {
            if (!notif.classList.contains('show')) {
                notif.style.display = 'none';
            }
        }, 300);
    }, durationMs);
}

// ─────────────── Oyınshı profili: kartochka basılǵanda kishkene popup ───────────────
// Kartochkanıń qasında ashıladı: at, ⚜️ VIP, skin, liga/reyting, statistika (server PLAYER_INFO —
// tek usı bólmedegi oyınshı haqqında, 60 s keshlenedi) hám háreketler: reakciya (stiker paneli),
// dawısın óshiriw (VIP sóylewshi).
const PP_ICONS = {
    react: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><circle cx="11" cy="13" r="8"/><path d="M7.5 15.5a4.5 4.5 0 0 0 7 0"/><path d="M8.5 10.5h.01M13.5 10.5h.01"/><path d="M19 2v4M17 4h4"/></svg>',
    mic: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><rect x="9" y="3" width="6" height="11" rx="3"/><path d="M5 11a7 7 0 0 0 14 0"/><path d="M12 18v3"/></svg>',
    micOff: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M15 9.3V6a3 3 0 0 0-5.7-1.3"/><path d="M9 9v2a3 3 0 0 0 4.9 2.3"/><path d="M19 11a7 7 0 0 1-1.1 3.8M5 11a7 7 0 0 0 10.5 6"/><path d="M12 18v3"/><path d="M3 3l18 18"/></svg>',
};
const playerInfoCache = {};      // user_id -> { at, data }

function playerByColor(color) {
    return ((latestRoomState && latestRoomState.players) || []).find(p => p.color === color) || null;
}

function openPlayerPop(color) {
    const p = playerByColor(color);
    const pop = document.getElementById('player-pop');
    if (!p || !pop) return;
    hapticSelection();
    renderPlayerPop(p);
    placePlayerPop(color);
    document.getElementById('player-pop-backdrop').hidden = false;
    pop.hidden = false;
    const c = playerInfoCache[p.user_id];
    if (c && Date.now() - c.at < 60000) fillPlayerPop(c.data);
    else if (ws && ws.readyState === 1) ws.send(JSON.stringify({ action: "PLAYER_INFO", user_id: p.user_id, lang: APP_LANG }));
}

function closePlayerPop() {
    const pop = document.getElementById('player-pop');
    if (pop) pop.hidden = true;
    const bd = document.getElementById('player-pop-backdrop');
    if (bd) bd.hidden = true;
}
window.addEventListener('resize', closePlayerPop);

// Kartochkanıń astında (tómengi kartochkada — ústinde), ushlıǵı kartochkaǵa qaraydı
function placePlayerPop(color) {
    const pop = document.getElementById('player-pop');
    const card = document.getElementById(`player-${color}`);
    if (!card) return;
    const r = card.getBoundingClientRect();
    const w = Math.min(300, window.innerWidth - 24);
    const left = Math.max(12, Math.min(r.left + r.width / 2 - w / 2, window.innerWidth - w - 12));
    const above = r.top + r.height / 2 > window.innerHeight / 2;
    pop.style.width = w + 'px';
    pop.style.left = left + 'px';
    pop.style.top = above ? '' : (r.bottom + 10) + 'px';
    pop.style.bottom = above ? (window.innerHeight - r.top + 10) + 'px' : '';
    pop.classList.toggle('is-above', above);
    pop.style.setProperty('--ax', Math.max(20, Math.min(r.left + r.width / 2 - left, w - 20)) + 'px');
}

const ppStat = (id, label) => `<div class="pp-stat"><b id="${id}">—</b><span>${escapeHtml(label)}</span></div>`;
const ppAction = (act, icon, label, on) =>
    `<button type="button" class="pp-act${on ? ' is-on' : ''}" data-act="${act}">${icon}<span>${escapeHtml(label)}</span></button>`;

function renderPlayerPop(p) {
    const pop = document.getElementById('player-pop');
    const me = p.user_id === userId;
    const uid = String(p.user_id);
    const actions = [];
    if (!me && myColor) actions.push(ppAction('react', PP_ICONS.react, tr('pp_react')));
    if (!me && myColor) {   // tek VIP sóyley aladı
        const m = Voice.isMuted(p.color);
        actions.push(ppAction('voice', m ? PP_ICONS.micOff : PP_ICONS.mic, tr(m ? 'pp_unmute' : 'pp_mute'), m));
    }
    const skin = window.LudoSkins ? `<img class="pp-skin" alt="" src="${LudoSkins.dataUri(p.skin || 'classic', p.color)}">` : '';
    pop.innerHTML = `
        <div class="pp-head">
            <span class="avatar pp-avatar" data-c="${p.color}" style="--pc: var(--${p.color});${p.photo_url ? `background-image:url('${escapeHtml(p.photo_url)}')` : ''}">${p.photo_url ? '' : escapeHtml(initialOf(p.name))}</span>
            <div class="pp-who">
                <div class="pp-name"><span>${escapeHtml(p.name || '')}</span>${p.vip ? '<span class="pp-vip">⚜️ VIP</span>' : ''}</div>
                <div class="pp-league" id="pp-league"><span class="pp-skel"></span></div>
            </div>
            ${skin}
        </div>
        <div class="pp-stats">${ppStat('pp-games', tr('pp_games'))}${ppStat('pp-wins', tr('pp_wins'))}${ppStat('pp-rate', tr('pp_rate'))}${ppStat('pp-badges', tr('pp_badges'))}</div>
        ${me ? `<div class="pp-note">${escapeHtml(tr('pp_me'))}</div>` : ''}
        ${actions.length ? `<div class="pp-actions">${actions.join('')}</div>` : ''}`;
    pop.dataset.uid = uid;
    pop.querySelectorAll('.pp-act').forEach(b => { b.onclick = () => playerPopAction(b.dataset.act, p); });
}

function fillPlayerPop(d) {
    const pop = document.getElementById('player-pop');
    if (!pop || pop.hidden || pop.dataset.uid !== String(d.user_id)) return;
    const set = (id, v) => { const el = document.getElementById(id); if (el) el.textContent = v; };
    const lg = document.getElementById('pp-league');
    if (lg) lg.innerHTML = `${escapeHtml(d.league)} · <b>${Number(d.rating) || 0}</b>`;
    set('pp-games', d.games);
    set('pp-wins', d.wins);
    set('pp-rate', d.win_rate + '%');
    set('pp-badges', `${d.badges}/${d.badges_total}`);
}

function onPlayerInfo(d) {
    playerInfoCache[d.user_id] = { at: Date.now(), data: d };
    fillPlayerPop(d);
}

function playerPopAction(act, p) {
    if (act === 'react') { closePlayerPop(); openAnimationModal(p.color); return; }
    if (act === 'voice') Voice.toggleMute(p.color);
    hapticImpact('light');
    renderPlayerPop(p);   // túyme halatı jańalanadı; statistika — keshten
    const c = playerInfoCache[p.user_id];
    if (c) fillPlayerPop(c.data);
}

let animationTargetColor = null;

let animationObserver = null;

// Bir animatsiya elementiniń lottie-player'in júklep oynatadı (data-src -> src).
function loadAnimationItem(item) {
    const player = item.querySelector('lottie-player');
    if (!player) return;
    const dataSrc = player.getAttribute('data-src');
    if (!dataSrc || player.getAttribute('src')) {
        // Aldın júklengen — tek dawam ettiremiz
        try { player.play(); } catch (e) {}
        return;
    }
    // src'siz jaratılǵan lottie-player durıs initializatsiyalanбаydı, sonlıqtan
    // jańasın jasaймız (data-src saqlanǵan halda).
    const newPlayer = document.createElement('lottie-player');
    newPlayer.setAttribute('src', dataSrc);
    newPlayer.setAttribute('background', 'transparent');
    newPlayer.setAttribute('speed', '1');
    newPlayer.setAttribute('loop', 'true');
    newPlayer.setAttribute('autoplay', 'true');
    newPlayer.style.width = '100%';
    newPlayer.style.height = '100%';
    newPlayer.style.pointerEvents = 'none';
    newPlayer.setAttribute('data-src', dataSrc);
    item.replaceChild(newPlayer, player);
}

// ── Stiker toplamları: «Ulıwma» (Lottie, hámmege) + hár skinniń óz stikerleri (stickers.js).
// Skin toplamı skin iyesine (⚜️ VIP'ke — hámmesi) ashıq: server STICKER_PACKS jiberedi
// hám jiberilgen stikerdi ózi de tekseredi.
let stickerPacks = new Set();
let stickerTab = null;
const STICKER_TAB_KEY = "ludo_sticker_tab";

function setStickerPacks(packs) {
    stickerPacks = new Set(packs || []);
    if (window.LudoStickers) LudoStickers.preload();   // animaciya waqtında súwretler tayın bolsın
    if (window.LudoSfx) LudoSfx.load();                // hám dawısları (bir audio-sprite)
    const modal = document.getElementById('animation-modal');
    if (modal && modal.style.display !== 'none') selectStickerTab(stickerTab);
}

function defaultStickerTab() {
    let saved = null;
    try { saved = localStorage.getItem(STICKER_TAB_KEY); } catch (e) {}
    if (saved === "general" || (window.LudoStickers && LudoStickers.packs[saved])) return saved;
    const me = latestRoomState && (latestRoomState.players || []).find(p => p.user_id === userId);
    return me && stickerPacks.has(me.skin) ? me.skin : "general";   // óz skininiń toplamı
}

function renderStickerTabs(active) {
    const bar = document.getElementById('sticker-tabs');
    if (!bar || !window.LudoStickers) return;
    bar.innerHTML = "";
    ["general", ...Object.keys(LudoStickers.packs)].forEach(tab => {
        const b = document.createElement('button');
        b.type = "button";
        b.className = "sticker-tab" + (tab === active ? " is-active" : "");
        b.setAttribute("role", "tab");
        b.setAttribute("aria-selected", tab === active ? "true" : "false");
        // Kishkene ikonka + atı (stikerlerge uqsamasın): ulıwma — sızıq smaylik, skin — óz tası
        const ico = document.createElement('span');
        ico.className = "st-ico";
        const name = document.createElement('span');
        name.className = "st-name";
        if (tab === "general") {
            ico.innerHTML = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><circle cx="12" cy="12" r="9"/><path d="M8.5 14.5a4.5 4.5 0 0 0 7 0"/><path d="M9 9.5h.01M15 9.5h.01"/></svg>';
            name.textContent = tr("stickers_general");
        } else {
            const img = document.createElement('img');   // skinniń tası — oyınshınıń reńinde
            img.alt = "";
            img.src = LudoSkins.dataUri(tab, myColor || "red");
            ico.appendChild(img);
            name.textContent = tr("skin_" + tab);
            if (!stickerPacks.has(tab)) {
                b.classList.add("is-locked");
                ico.insertAdjacentHTML("beforeend", '<span class="tab-lock">🔒</span>');
            }
        }
        b.append(ico, name);
        b.onclick = () => selectStickerTab(tab, true);
        bar.appendChild(b);
    });
}

function selectStickerTab(tab, byUser) {
    if (!window.LudoStickers || !LudoStickers.packs[tab]) tab = "general";
    if (byUser && tab !== stickerTab) hapticSelection();
    stickerTab = tab;
    if (byUser) { try { localStorage.setItem(STICKER_TAB_KEY, tab); } catch (e) {} }
    renderStickerTabs(tab);
    const general = document.getElementById('sticker-general');
    const pack = document.getElementById('sticker-pack');
    const lock = document.getElementById('sticker-lock');
    if (!general || !pack || !lock) return;
    if (tab === "general") {
        general.hidden = false;
        pack.hidden = true;
        lock.hidden = true;
        observeLottie(true);
        return;
    }
    general.hidden = true;
    observeLottie(false);
    // Jabıq toplam da kórinedi (ne alatuǵını kórinsin), biraq jiberilmeydi
    const locked = false;
    pack.innerHTML = "";
    LudoStickers.ids(tab).forEach(id => {
        const item = document.createElement('div');
        item.className = "animation-item sticker-item" + (locked ? " is-locked" : "");
        const img = document.createElement('img');
        img.alt = "";
        img.src = LudoStickers.dataUri(id);
        item.appendChild(img);
        item.onclick = () => sendAnimation(id);
        pack.appendChild(item);
    });
    pack.hidden = false;
    lock.hidden = !locked;
    if (locked) lock.textContent = tr("sticker_locked").replace("{skin}", tr("skin_" + tab));
}

// Ulıwma toplam: tek kórinetuǵın Lottie'lerdi júkleymiz (IntersectionObserver) — barlıq
// animaciyanı birden júklemew/oynatpaw ushın (CPU/tarmaq únem); basqa bólimde — pauza.
function observeLottie(on) {
    const grid = document.getElementById('sticker-general');
    if (!grid) return;
    const items = grid.querySelectorAll('.animation-item');
    if (on) {
        if (!animationObserver) {
            animationObserver = new IntersectionObserver((entries) => {
                entries.forEach(entry => {
                    if (entry.isIntersecting) {
                        loadAnimationItem(entry.target);
                    } else {
                        const player = entry.target.querySelector('lottie-player');
                        if (player) { try { player.pause(); } catch (e) {} }
                    }
                });
            }, { root: grid, rootMargin: '50px', threshold: 0.1 });
        }
        items.forEach(item => animationObserver.observe(item));
        return;
    }
    if (animationObserver) items.forEach(item => animationObserver.unobserve(item));
    grid.querySelectorAll('lottie-player').forEach(player => {
        try { player.pause(); } catch (e) {}
    });
}

function openAnimationModal(targetColor) {
    if (!myColor) return; // Tek aktiv oyınshılar animatsiya jibere aladı
    if (myColor === targetColor) return; // Ózińe jibere almaysań

    animationTargetColor = targetColor;
    const modal = document.getElementById('animation-modal');
    if (!modal) return;
    modal.style.display = 'flex';
    selectStickerTab(stickerTab || defaultStickerTab());
}

function closeAnimationModal() {
    animationTargetColor = null;
    const modal = document.getElementById('animation-modal');
    if (!modal) return;
    modal.style.display = 'none';
    observeLottie(false);   // baqlawdı toqtatıp, animaciyalardı pauza qılamız (CPU únem)
    const pack = document.getElementById('sticker-pack');
    if (pack) pack.innerHTML = "";
}

function sendAnimation(animName) {
    if (!ws || !myColor || !animationTargetColor) return;
    // Jabıq skin toplamı: jiberilmeydi — eskertiw jazıwı silkinedi
    if (false) {
        hapticNotify('warning');
        const lock = document.getElementById('sticker-lock');
        if (lock) { lock.classList.remove('nudge'); void lock.offsetWidth; lock.classList.add('nudge'); }
        return;
    }
    
    ws.send(JSON.stringify({
        action: "SEND_ANIMATION",
        user_id: userId,
        animation: animName,
        from_color: myColor,
        to_color: animationTargetColor
    }));
    hapticImpact('light');

    closeAnimationModal();
}

function playAnimation(fromColor, toColor, animName) {
    const fromCard = document.getElementById(`player-${fromColor}`);
    const toCard = document.getElementById(`player-${toColor}`);
    
    if (!fromCard || !toCard) return;
    
    // Skin stikeri — interaktiv animaciya (stickers.js): zat ushıp barıp, alıwshınıń kartochkasında «isleydi»
    if (window.LudoStickers && LudoStickers.isSkin(animName)) {
        LudoStickers.play(animName, fromCard, toCard);
        return;
    }

    const fromRect = fromCard.getBoundingClientRect();
    const toRect = toCard.getBoundingClientRect();

    const animEl = document.createElement('lottie-player');
    animEl.setAttribute('src', `/static/animations/${animName}`);
    animEl.setAttribute('background', 'transparent');
    animEl.setAttribute('speed', '1');
    animEl.setAttribute('autoplay', 'true');
    animEl.setAttribute('loop', 'true');
    animEl.className = 'flying-animation';

    // Set initial position to center of fromCard
    animEl.style.left = (fromRect.left + fromRect.width / 2) + 'px';
    animEl.style.top = (fromRect.top + fromRect.height / 2) + 'px';
    animEl.style.width = '40px';
    animEl.style.height = '40px';
    animEl.style.pointerEvents = 'none';
    
    document.body.appendChild(animEl);
    
    // Force reflow
    void animEl.offsetWidth;
    
    // Animate to center of toCard
    animEl.style.left = (toRect.left + toRect.width / 2) + 'px';
    animEl.style.top = (toRect.top + toRect.height / 2) + 'px';
    
    // Remove after 3 seconds
    setTimeout(() => {
        if (animEl.parentNode) animEl.parentNode.removeChild(animEl);
    }, 3000);
}