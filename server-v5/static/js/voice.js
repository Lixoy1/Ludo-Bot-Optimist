// ─────────────── 🎙️ Free voice chat for all players ───────────────
// Every player in an active game can enable or mute their microphone.
// Audio is peer-to-peer via WebRTC; STUN is the default and optional TURN
// credentials arrive through VOICE_CONFIG when coturn is configured.
// The game WebSocket relays only signaling messages (offer/answer/ICE).
// Players can mute individual speakers; reconnect logic restores peer links.

const Voice = (() => {
    const STUN = [{ urls: ["stun:stun.l.google.com:19302", "stun:stun.cloudflare.com:3478"] }];
    let iceServers = STUN;   // + TURN (VOICE_CONFIG)
    let hasTurn = false;
    let players = [];
    let isPlayer = false;    // kóriwshige túyme kórinbeydi
    let amVip = true;
    let mic = null;          // óz mikrofonım (MediaStream) — birinshi qosqanda alınadı
    let micOn = false;
    let micLevel = null;     // óz dawısım ushın analyser
    let gen = 0;             // offer nomeri (eski baylanıstıń kandidatları aralaspasın)
    const out = {};          // tıńlawshı uid → baylanıs (men sóyleymen)
    const inn = {};          // sóylewshi uid → baylanıs + audio
    const muted = new Set(); // men óshirgen sóylewshiler
    const onSet = new Set(); // mikrofonı qosılǵan VIP'ler
    const retries = {};      // qayta jalǵaw waqıtları (sheklew)
    let diagLeft = 12;
    let poll = null;

    const sendWs = (m) => { if (typeof ws !== "undefined" && ws && ws.readyState === 1) ws.send(JSON.stringify(m)); };
    const cardOf = (uid) => {
        const p = players.find((x) => String(x.user_id) === String(uid));
        return p ? document.getElementById(`player-${p.color}`) : null;
    };

    // Diagnostika: serverdiń logına (qaysı telefonda ne bolǵanın anıqlaw ushın)
    function diag(ev, info) {
        if (diagLeft-- <= 0) return;
        let plat = "";
        try { plat = Telegram.WebApp.platform || ""; } catch (e) {}
        sendWs({ action: "VOICE_DIAG", ev, plat, info: String(info || "").slice(0, 200) });
    }

    function config(ice) {
        const turn = Array.isArray(ice) ? ice.filter((s) => s && s.urls) : [];
        hasTurn = turn.length > 0;
        iceServers = STUN.concat(turn);
    }

    function setPlayers(list, spectators) {
        const seated = Array.isArray(list) ? list : [];
        const viewers = Array.isArray(spectators) ? spectators : [];
        const combined = [...seated, ...viewers.map((p) => ({ ...p, vip: true, is_spectator: true }))];
        const unique = new Map();
        combined.forEach((p) => { if (p && p.user_id !== undefined) unique.set(String(p.user_id), p); });
        players = [...unique.values()];
        const me = players.find((p) => String(p.user_id) === String(userId));
        isPlayer = !!me; // authenticated spectators can speak too
        amVip = true;
        renderButton();
        if (!me) return;
        players.filter((p) => p.vip && String(p.user_id) !== String(userId))
            .forEach((p) => sendWs({ action: "VOICE", to: p.user_id, kind: "hello" }));
        if (mic) players.filter((p) => String(p.user_id) !== String(userId))
            .forEach((p) => { if (!out[p.user_id]) offerTo(p.user_id); });
        startPoll();
    }

    // Jańa baylanıs: kandidatlar jıynalıwına qaray toplap jiberiledi (offer/answer'den keyin)
    function makeLink(uid, side, g) {
        const link = { pc: new RTCPeerConnection({ iceServers }), uid, side, g, ready: false, sent: false,
            pending: [], batch: [], timer: null, types: new Set(), reported: false, discTimer: null };
        const flush = () => {
            link.timer = null;
            if (!link.sent || !link.batch.length) return;
            sendWs({ action: "VOICE", to: uid, kind: "ice", side: side === "out" ? "spk" : "lis", g: link.g, candidates: link.batch });
            link.batch = [];
        };
        link.flush = flush;
        link.pc.onicecandidate = (e) => {
            if (!e.candidate) { flush(); return; }
            link.types.add(e.candidate.type || "?");
            link.batch.push(e.candidate.toJSON ? e.candidate.toJSON() : e.candidate);
            if (!link.timer) link.timer = setTimeout(flush, 150);
        };
        const check = () => {
            if ((side === "out" ? out[uid] : inn[uid]) !== link) return;   // almastırılǵan eski baylanıs
            const st = link.pc.connectionState || link.pc.iceConnectionState;
            if (st === "connected" || st === "completed") {
                clearTimeout(link.discTimer);
                link.discTimer = null;
                if (!link.reported) { link.reported = true; pairTypes(link.pc).then((t) => diag("ok", `${side} ${t}${hasTurn ? " turn" : ""}`)); }
            } else if (st === "failed") {
                clearTimeout(link.discTimer);
                // connectionstatechange hám iceconnectionstatechange ekewi de keledi — bir ret
                if (!link.failReported) {
                    link.failReported = true;
                    diag("fail", `${side} local=${[...link.types].join("/") || "-"}${hasTurn ? " turn" : ""}`);
                }
                recover(link);
            } else if (st === "disconnected" && !link.discTimer) {
                link.discTimer = setTimeout(() => recover(link), 4000);   // qısqa úzilis óz-ózinen tiklenbese
            }
        };
        link.pc.addEventListener("connectionstatechange", check);
        link.pc.addEventListener("iceconnectionstatechange", check);
        return link;
    }

    // Offer/answer jiberilgennen keyin: SDP'ge kirip ketken kandidatlar qaytalanbaydı, qalǵanı — trickle
    function markSent(link) {
        link.sent = true;
        link.batch = [];
        if (link.pc.iceGatheringState !== "complete") link.flush();
    }

    function addRemote(link, cands) {
        (cands || []).forEach((c) => {
            if (link.ready) link.pc.addIceCandidate(c).catch(() => {});
            else link.pending.push(c);
        });
    }

    function setReady(link) {
        link.ready = true;
        addRemote(link, link.pending.splice(0));
    }

    // Kandidatlardıń bir bólimi tez jıynaladı — offer'ge kirsin (eski klientler de tıńlay alsın)
    function waitIce(pc, ms) {
        if (pc.iceGatheringState === "complete") return Promise.resolve();
        return new Promise((res) => {
            const t = setTimeout(res, ms);
            pc.addEventListener("icegatheringstatechange", () => {
                if (pc.iceGatheringState === "complete") { clearTimeout(t); res(); }
            });
        });
    }

    // Baylanıs qulasa: sóylewshi — jańa offer, tıńlawshı — sóylewshiden jańa offer soraydı
    function recover(link) {
        const key = link.side + link.uid, now = Date.now();
        if (link.recoveredAt && now - link.recoveredAt < 5000) return;   // bir waqıya eki ret kelse
        link.recoveredAt = now;
        retries[key] = (retries[key] || []).filter((t) => now - t < 60000);
        if (retries[key].length >= 4) return;   // minutına 4 retten artıq emes
        retries[key].push(now);
        if (link.side === "out") { if (mic) offerTo(link.uid); }
        else sendWs({ action: "VOICE", to: link.uid, kind: "hello" });
    }

    async function offerTo(uid) {
        if (!mic) return;
        uid = String(uid);
        if (out[uid]) { try { out[uid].pc.close(); } catch (e) {} }
        const link = out[uid] = makeLink(uid, "out", ++gen);
        mic.getTracks().forEach((t) => link.pc.addTrack(t, mic));
        try {
            await link.pc.setLocalDescription(await link.pc.createOffer());
            await waitIce(link.pc, 700);
            if (out[uid] !== link) return;
            sendWs({ action: "VOICE", to: uid, kind: "offer", on: micOn, g: link.g, sdp: link.pc.localDescription });
            markSent(link);
        } catch (e) {}
    }

    // Mikrofon qátesi — túrine qaray túsindiriw (Android/iOS ushın — qayaqtan ruqsat beriw)
    function micError(e) {
        const n = (e && e.name) || "";
        let plat = "";
        try { plat = Telegram.WebApp.platform || ""; } catch (x) {}
        let key = "voice_failed";
        if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) key = "voice_unsupported";
        else if (["NotAllowedError", "SecurityError", "PermissionDeniedError"].includes(n)) {
            key = plat === "android" ? "voice_denied_android" : plat === "ios" ? "voice_denied_ios" : "voice_denied";
        } else if (["NotFoundError", "OverconstrainedError", "DevicesNotFoundError"].includes(n)) key = "voice_nomic";
        else if (["NotReadableError", "TrackStartError", "AbortError"].includes(n)) key = "voice_busy";
        showChatNotification('', tr(key), null, 8000);
        diag("mic", `${n || "no-mediaDevices"} ${(e && e.message) || ""}`);
    }

    async function toggleMic() {
        if (!amVip) {   // reserved for a future entitlement check
            showChatNotification('', tr("voice_vip_only"), null, 1500);   // qısqa — tez óshedi
            try { Telegram.WebApp.HapticFeedback.notificationOccurred('warning'); } catch (e) {}
            return;
        }
        if (!mic) {
            try {
                if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) throw new TypeError("no mediaDevices");
                mic = await navigator.mediaDevices.getUserMedia({
                    audio: { echoCancellation: true, noiseSuppression: true, autoGainControl: true } });
            } catch (e) {
                micError(e);
                return;
            }
            micLevel = analyser(mic);
            micOn = true;
            players.filter((p) => String(p.user_id) !== String(userId)).forEach((p) => offerTo(p.user_id));
        } else {
            micOn = !micOn;
        }
        mic.getAudioTracks().forEach((t) => { t.enabled = micOn; });
        sendWs({ action: "VOICE_MIC", on: micOn });
        setOn(userId, micOn);
        renderButton();
        showChatNotification('', tr(micOn ? "voice_on" : "voice_off"), null);
        try { Telegram.WebApp.HapticFeedback.impactOccurred('light'); } catch (e) {}
    }

    // Eski klient (deploy waqtında) offer nomerin jibermeydi — onda tekserilmeydi
    const sameGen = (link, m) => m.g === undefined || link.g === undefined || link.g === m.g;

    async function onSignal(m) {
        const from = String(m.from);
        try {
            if (m.kind === "hello") { if (mic) offerTo(from); return; }
            if (m.kind === "offer") {
                if (inn[from]) { try { inn[from].pc.close(); } catch (e) {} }
                const link = makeLink(from, "in", m.g);
                link.audio = audioOf(from);
                inn[from] = link;
                link.pc.ontrack = (e) => {
                    link.audio.srcObject = e.streams[0] || new MediaStream([e.track]);
                    link.audio.muted = muted.has(from);
                    tryPlay(link.audio);
                };
                await link.pc.setRemoteDescription(m.sdp);
                setReady(link);
                await link.pc.setLocalDescription(await link.pc.createAnswer());
                await waitIce(link.pc, 700);
                if (inn[from] !== link) return;
                sendWs({ action: "VOICE", to: from, kind: "answer", g: link.g, sdp: link.pc.localDescription });
                markSent(link);
                setOn(from, !!m.on);
                return;
            }
            if (m.kind === "answer") {
                const link = out[from];
                if (link && sameGen(link, m) && link.pc.signalingState === "have-local-offer") {
                    await link.pc.setRemoteDescription(m.sdp);
                    setReady(link);
                }
                return;
            }
            if (m.kind === "ice") {
                // sóylewshiniń kandidatları — meniń kiriwshi baylanısıma, tıńlawshınıkı — shıǵıwshıǵa
                const link = m.side === "spk" ? inn[from] : out[from];
                if (link && sameGen(link, m)) addRemote(link, m.candidates);
            }
        } catch (e) {}
    }

    function onMic(m) { if (String(m.user_id) !== String(userId)) setOn(m.user_id, !!m.on); }

    // Kartochkada 🎤 (yamasa 🔇 — men óshirgen bolsam)
    function setOn(uid, on) {
        uid = String(uid);
        if (on) onSet.add(uid); else onSet.delete(uid);
        const card = cardOf(uid);
        if (!card) return;
        card.dataset.voice = on ? (muted.has(uid) ? "muted" : "on") : "";
        if (!on) card.classList.remove("talking");
        const b = card.querySelector(".voice-badge");
        if (b) b.textContent = muted.has(uid) ? "🔇" : "🎤";
    }

    function toggleMute(color) {
        const p = players.find((x) => x.color === color);
        if (!p || String(p.user_id) === String(userId)) return;
        const uid = String(p.user_id);
        if (muted.has(uid)) muted.delete(uid); else muted.add(uid);
        if (inn[uid]) inn[uid].audio.muted = muted.has(uid);
        setOn(uid, onSet.has(uid));
    }

    function audioOf(uid) {
        let a = document.getElementById("voice-au-" + uid);
        if (!a) {
            a = document.createElement("audio");
            a.id = "voice-au-" + uid;
            a.autoplay = true;
            a.setAttribute("playsinline", "");
            a.hidden = true;
            document.body.appendChild(a);
        }
        return a;
    }
    let autoplayReported = false;
    function tryPlay(a) {
        const p = a.play();
        if (p && p.catch) {
            p.catch((e) => {
                if (!autoplayReported) { autoplayReported = true; diag("autoplay", e && e.name); }
            });
        }
    }
    // iOS/Android: dawıs tek paydalanıwshı ekranǵa tiygennen keyin oynaydı — hár basıwda qayta urınamız
    document.addEventListener("pointerdown", () => {
        Object.values(inn).forEach((x) => { if (x.audio && x.audio.paused && x.audio.srcObject) tryPlay(x.audio); });
    }, { passive: true });
    // Qosımsha fonnan qaytqanda: toqtap qalǵan dawıslar hám qulaǵan baylanıslar
    document.addEventListener("visibilitychange", () => {
        if (document.visibilityState !== "visible") return;
        [...Object.values(out), ...Object.values(inn)].forEach((link) => {
            const st = link.pc.connectionState || link.pc.iceConnectionState;
            if (st === "failed" || st === "disconnected" || st === "closed") recover(link);
            else if (link.audio && link.audio.paused && link.audio.srcObject) tryPlay(link.audio);
        });
    });

    // Tańlanǵan kandidat jubınıń túrleri (host / srflx / relay) — diagnostika ushın
    async function pairTypes(pc) {
        try {
            const stats = await pc.getStats();
            const byId = {};
            let pair = null;
            stats.forEach((s) => { byId[s.id] = s; });
            stats.forEach((s) => { if (s.type === "transport" && s.selectedCandidatePairId) pair = byId[s.selectedCandidatePairId]; });
            if (!pair) stats.forEach((s) => { if (!pair && s.type === "candidate-pair" && (s.selected || (s.nominated && s.state === "succeeded"))) pair = s; });
            const l = pair && byId[pair.localCandidateId], r = pair && byId[pair.remoteCandidateId];
            return `${l ? l.candidateType : "?"}-${r ? r.candidateType : "?"}`;
        } catch (e) { return "?"; }
    }

    function analyser(stream) {
        try {
            const ac = new (window.AudioContext || window.webkitAudioContext)();
            ac.resume && ac.resume();
            const an = ac.createAnalyser();
            an.fftSize = 256;
            ac.createMediaStreamSource(stream).connect(an);
            const buf = new Uint8Array(an.fftSize);
            return () => {
                an.getByteTimeDomainData(buf);
                let peak = 0;
                for (let i = 0; i < buf.length; i++) peak = Math.max(peak, Math.abs(buf[i] - 128));
                return peak / 128;
            };
        } catch (e) { return null; }
    }

    // Sóylep atırǵanlar: kartochka jaltıraydı (kiris dawıs dárejesi — RTP, analyser'siz)
    function startPoll() {
        if (poll) return;
        poll = setInterval(() => {
            Object.entries(inn).forEach(([uid, x]) => {
                const card = cardOf(uid);
                if (!card) return;
                let lvl = 0;
                try {
                    const r = x.pc.getReceivers()[0];
                    const ss = r && r.getSynchronizationSources ? r.getSynchronizationSources() : [];
                    lvl = ss.length ? (ss[0].audioLevel || 0) : 0;
                } catch (e) {}
                card.classList.toggle("talking", onSet.has(uid) && !muted.has(uid) && lvl > 0.03);
            });
            const mine = cardOf(userId);
            const lvl = micOn && micLevel ? micLevel() : 0;
            if (mine) mine.classList.toggle("talking", micOn && lvl > 0.06);
            const btn = document.getElementById("voice-btn");
            if (btn) btn.classList.toggle("talking", micOn && lvl > 0.06);
        }, 250);
    }

    function renderButton() {
        const btn = document.getElementById("voice-btn");
        if (!btn) return;
        btn.hidden = !isPlayer;
        btn.classList.remove("is-locked");
        btn.classList.toggle("is-on", micOn);
        btn.querySelector(".mic-on").hidden = !micOn;
        btn.querySelector(".mic-off").hidden = micOn;
    }

    function stop() {
        Object.values(out).forEach((l) => { try { l.pc.close(); } catch (e) {} });
        Object.values(inn).forEach((l) => { try { l.pc.close(); } catch (e) {} if (l.audio) l.audio.srcObject = null; });
        Object.keys(out).forEach((k) => delete out[k]);
        Object.keys(inn).forEach((k) => delete inn[k]);
        if (mic) mic.getTracks().forEach((t) => t.stop());
        mic = null; micOn = false; micLevel = null;
        if (poll) { clearInterval(poll); poll = null; }
        amVip = false;
        isPlayer = false;
        renderButton();
        document.querySelectorAll(".player-card").forEach((c) => { c.dataset.voice = ""; c.classList.remove("talking"); });
    }

    // Usı reńdegi oyınshınıń dawısın men óshirgenbe (profil popup'ı ushın)
    function isMuted(color) {
        const p = players.find((x) => x.color === color);
        return !!p && muted.has(String(p.user_id));
    }

    return { config, setPlayers, toggleMic, toggleMute, isMuted, onSignal, onMic, stop };
})();