// games.js - Game Mechanics
const MAX_BET = 250000;

// --- Helpers ---
function getBet(inputId) {
    const input = document.getElementById(inputId);
    const bet = parseInt(input.value);
    if (isNaN(bet) || bet <= 0) {
        showToast("Please enter a valid bet amount.", "error");
        return 0;
    }
    if (bet > MAX_BET) {
        showToast(`Max bet is ${MAX_BET.toLocaleString()} OwO.`, "error");
        return 0;
    }
    if (bet > balance) {
        showToast("Insufficient OwO balance!", "error");
        return 0;
    }
    return bet;
}

function setStatus(elementId, msg, type = "") {
    const el = document.getElementById(elementId);
    if (!el) return;
    el.innerText = msg;
    el.className = `status-badge ${type}`;
}

function capitalize(s) {
    return s.charAt(0).toUpperCase() + s.slice(1);
}

document.addEventListener("DOMContentLoaded", () => {
    try { initSlots(); } catch (e) { console.error("initSlots failed", e); }
    try { initMines(); } catch (e) { console.error("initMines failed", e); }
    try { initCross(); } catch (e) { console.error("initCross failed", e); }
    try { initDice(); } catch (e) { console.error("initDice failed", e); }
    try { initCoinflip(); } catch (e) { console.error("initCoinflip failed", e); }
});

// ===================== SLOTS =====================
const symbols = ['⭕', '🇼', '💎', '🍒', '🍋', '7️⃣'];

function initSlots() {
    document.getElementById("spin-btn").addEventListener("click", () => {
        const bet = getBet("slots-bet");
        if (!bet) return;

        adjustBalance(-bet);
        const btn = document.getElementById("spin-btn");
        btn.disabled = true;
        setStatus("slots-status", "Spinning...", "");

        const slots = [
            document.getElementById("slot1"),
            document.getElementById("slot2"),
            document.getElementById("slot3")
        ];
        slots.forEach(s => s.classList.add("spinning"));

        let spins = 0;
        const spinInterval = setInterval(() => {
            Sounds.spin();
            slots.forEach(slot => {
                slot.innerText = symbols[Math.floor(Math.random() * symbols.length)];
            });
            spins++;

            if (spins > 15) {
                clearInterval(spinInterval);
                btn.disabled = false;
                slots.forEach(s => s.classList.remove("spinning"));
                checkSlotsWin(slots.map(s => s.innerText), bet);
            }
        }, 80);
    });
}

function checkSlotsWin(results, bet) {
    if (results[0] === '⭕' && results[1] === '🇼' && results[2] === '⭕') {
        const win = bet * 35;
        adjustBalance(win);
        Sounds.jackpot();
        if (window.confettiBurst) confettiBurst(50);
        if (window.registerRoundResult) registerRoundResult(true);
        setStatus("slots-status", `OwO Jackpot! +${win}`, "win");
        showToast(`Insane! You hit the OwO Jackpot for ${win}!`, "success");
    } else if (results[0] === results[1] && results[1] === results[2]) {
        const win = bet * 10;
        adjustBalance(win);
        Sounds.win();
        if (window.registerRoundResult) registerRoundResult(true);
        setStatus("slots-status", `Matched 3! +${win}`, "win");
    } else {
        Sounds.loss();
        if (window.registerRoundResult) registerRoundResult(false);
        setStatus("slots-status", `Lost ${bet}`, "loss");
    }
}

// ===================== MINES =====================
// 5x5 board. The player picks how many mines are hidden (1-24) -- more mines
// means fewer safe tiles, so each pick is riskier and pays out more.
// The grid is always rendered: either the live/frozen result of the last
// round, or an empty "ready" grid before the very first bet.
const MINES_SIZE = 25;
const MINES_HOUSE_EDGE = 1.36;
// Raising the fair odds to a power > 1 makes each additional safe pick pay
// off increasingly more instead of growing at a steady rate -- slow early
// on, then ramping up fast the deeper you go.
const MINES_CURVE_EXPONENT = 2.7;

let minesActive = false;
let minesMultiplier = 1.0;
let currentMinesBet = 0;
let currentMineCount = 5;
let minesBoard = [];
let revealedIndices = [];

function minesFairMultiplier(revealed, mineCount) {
    let m = 1;
    for (let i = 0; i < revealed; i++) {
        const denom = MINES_SIZE - mineCount - i;
        if (denom <= 0) break;
        m *= (MINES_SIZE - i) / denom;
    }
    return m;
}

function minesMultiplierFor(revealed, mineCount) {
    return Math.pow(minesFairMultiplier(revealed, mineCount), MINES_CURVE_EXPONENT) * MINES_HOUSE_EDGE;
}

function saveMinesState(state) {
    safeStorage.set("owo_mines_state", JSON.stringify(state));
}

function loadMinesState() {
    const raw = safeStorage.get("owo_mines_state");
    if (!raw) return null;
    try {
        return JSON.parse(raw);
    } catch (e) {
        return null;
    }
}

function buildMinesBoard(mineCount) {
    const board = Array(MINES_SIZE).fill("safe");
    const positions = new Set();
    while (positions.size < mineCount) {
        positions.add(Math.floor(Math.random() * MINES_SIZE));
    }
    positions.forEach(i => (board[i] = "bomb"));
    return board;
}

function renderMinesReadyGrid() {
    const grid = document.getElementById("mines-grid");
    grid.innerHTML = "";
    for (let i = 0; i < MINES_SIZE; i++) {
        const btn = document.createElement("button");
        btn.className = "mine-cell";
        btn.innerText = "❓";
        btn.disabled = true;
        grid.appendChild(btn);
    }
}

function renderMinesGrid(board, revealed, interactive) {
    const grid = document.getElementById("mines-grid");
    grid.innerHTML = "";
    board.forEach((type, index) => {
        const btn = document.createElement("button");
        btn.className = "mine-cell";
        btn.dataset.index = String(index);
        btn.dataset.type = type;

        if (interactive) {
            btn.innerText = "❓";
            btn.addEventListener("click", () => handleMineClick(btn));
        } else {
            const wasRevealed = revealed.includes(index);
            if (type === "bomb") {
                btn.innerText = "💣";
                btn.classList.add("revealed-bomb");
                if (!wasRevealed) btn.classList.add("dim");
            } else if (wasRevealed) {
                btn.innerText = "💎";
                btn.classList.add("revealed-safe");
            } else {
                btn.innerText = "➖";
                btn.classList.add("dim");
            }
            btn.disabled = true;
        }
        grid.appendChild(btn);
    });
}

function updateMinesHint() {
    const hintEl = document.getElementById("mines-next-hint");
    if (!hintEl) return;
    if (minesActive) {
        const next = minesMultiplierFor(revealedIndices.length + 1, currentMineCount);
        const remaining = MINES_SIZE - currentMineCount - revealedIndices.length;
        hintEl.innerText = remaining > 0
            ? `Next safe pick pays ${next.toFixed(2)}x`
            : "Every safe tile is revealed!";
    } else {
        const mc = parseInt(document.getElementById("mines-count").value) || 5;
        const first = minesMultiplierFor(1, mc);
        hintEl.innerText = `With ${mc} mines, your first safe pick pays ${first.toFixed(2)}x. Place a bet to start.`;
    }
}

function endMines(msg, cssClass) {
    minesActive = false;
    document.getElementById("start-mines-btn").style.display = "block";
    document.getElementById("cashout-mines-btn").style.display = "none";
    document.getElementById("cashout-mines-btn").innerText = "Cashout";
    setStatus("mines-status", msg, cssClass);
    // Freeze + fully reveal the board so the round's outcome stays visible,
    // and persist it so it survives a refresh or switching games.
    renderMinesGrid(minesBoard, revealedIndices, false);
    updateMinesHint();
    saveMinesState({
        board: minesBoard,
        revealedIndices,
        mineCount: currentMineCount,
        statusMsg: msg,
        statusClass: cssClass
    });
}

function handleMineClick(btn) {
    if (!minesActive || btn.disabled) return;
    btn.disabled = true;
    const index = parseInt(btn.dataset.index);

    if (btn.dataset.type === "bomb") {
        btn.innerText = "💣";
        btn.classList.add("revealed-bomb");
        Sounds.mineExplode();
        if (window.registerRoundResult) registerRoundResult(false);
        endMines(`Boom! Lost ${currentMinesBet}`, "loss");
        return;
    }

    btn.innerText = "💎";
    btn.classList.add("revealed-safe");
    Sounds.mineSafe();
    revealedIndices.push(index);
    minesMultiplier = minesMultiplierFor(revealedIndices.length, currentMineCount);

    setStatus("mines-status", `Multiplier: ${minesMultiplier.toFixed(2)}x`, "win");
    document.getElementById("cashout-mines-btn").innerText =
        `Cashout (${Math.floor(currentMinesBet * minesMultiplier)})`;
    updateMinesHint();
    saveMinesState({
        board: minesBoard,
        revealedIndices,
        mineCount: currentMineCount,
        statusMsg: `Multiplier: ${minesMultiplier.toFixed(2)}x`,
        statusClass: "win"
    });

    const totalSafeTiles = MINES_SIZE - currentMineCount;
    if (revealedIndices.length === totalSafeTiles) {
        const win = Math.floor(currentMinesBet * minesMultiplier);
        adjustBalance(win);
        Sounds.jackpot();
        if (window.confettiBurst) confettiBurst(50);
        if (window.registerRoundResult) registerRoundResult(true);
        endMines(`Board cleared! +${win}`, "win");
    }
}

function initMines() {
    const savedState = loadMinesState();
    if (savedState && savedState.board) {
        renderMinesGrid(savedState.board, savedState.revealedIndices || [], false);
        setStatus("mines-status", savedState.statusMsg || "Last round", savedState.statusClass || "");
        document.getElementById("mines-count").value = savedState.mineCount || 5;
    } else {
        renderMinesReadyGrid();
    }
    updateMinesHint();

    document.getElementById("mines-count").addEventListener("input", () => {
        document.querySelectorAll(".preset-btn").forEach(b => b.classList.remove("active"));
        updateMinesHint();
    });

    document.querySelectorAll(".preset-btn").forEach(btn => {
        btn.addEventListener("click", () => {
            document.getElementById("mines-count").value = btn.dataset.mines;
            document.querySelectorAll(".preset-btn").forEach(b => b.classList.remove("active"));
            btn.classList.add("active");
            updateMinesHint();
        });
    });

    document.getElementById("start-mines-btn").addEventListener("click", () => {
        const bet = getBet("mines-bet");
        if (!bet) return;

        const mineCount = parseInt(document.getElementById("mines-count").value);
        if (isNaN(mineCount) || mineCount < 1 || mineCount > 24) {
            showToast("Choose a mine count between 1 and 24.", "error");
            return;
        }

        adjustBalance(-bet);
        currentMinesBet = bet;
        currentMineCount = mineCount;
        minesActive = true;
        minesMultiplier = 1.0;
        revealedIndices = [];
        minesBoard = buildMinesBoard(mineCount);

        document.getElementById("start-mines-btn").style.display = "none";
        document.getElementById("cashout-mines-btn").style.display = "block";
        document.getElementById("cashout-mines-btn").innerText = "Cashout";
        setStatus("mines-status", "Game Active", "");
        renderMinesGrid(minesBoard, [], true);
        updateMinesHint();
        saveMinesState({
            board: minesBoard,
            revealedIndices: [],
            mineCount,
            statusMsg: "Round in progress...",
            statusClass: ""
        });
    });

    document.getElementById("cashout-mines-btn").addEventListener("click", () => {
        if (!minesActive || revealedIndices.length === 0) {
            showToast("You need to click at least one square!", "error");
            return;
        }
        const win = Math.floor(currentMinesBet * minesMultiplier);
        adjustBalance(win);
        Sounds.cashout();
        if (window.registerRoundResult) registerRoundResult(true);
        endMines(`Cashed out! +${win} (${minesMultiplier.toFixed(2)}x)`, "win");
    });
}

// ===================== CROSS THE ROAD =====================
// Lane-by-lane cashout ladder (like Mines): each successful crossing raises
// the multiplier, and you can cash out any time. Get hit and you lose the
// bet. 24 lanes total, ending the round automatically if you make it across.
// Traffic gets more dangerous the further you go: survival chance starts
// high and ramps down towards the final lanes, with the danger curve
// accelerating near the end so the last stretch is the scariest.
const CROSS_LANES = 24;
const CROSS_SURVIVE_START = 0.95; // chance of surviving lane 1
const CROSS_SURVIVE_END = 0.5;    // chance of surviving the final lane
const CROSS_RISK_CURVE = 1.4;     // >1 = danger ramps up faster near the end
const CROSS_HOUSE_EDGE = 2.5;

let crossActive = false;
let crossBet = 0;
let crossLane = 0;

function crossSurviveChanceAt(lane) {
    // lane is 1-indexed: chance of surviving THIS lane's traffic.
    const t = (lane - 1) / (CROSS_LANES - 1);
    const eased = Math.pow(t, CROSS_RISK_CURVE);
    return CROSS_SURVIVE_START - (CROSS_SURVIVE_START - CROSS_SURVIVE_END) * eased;
}

function crossMultiplierAt(lane) {
    let m = 1;
    for (let i = 1; i <= lane; i++) {
        m /= crossSurviveChanceAt(i);
    }
    return m * CROSS_HOUSE_EDGE;
}

function renderCrossLadder(currentLane, crashedLane) {
    const ladder = document.getElementById("cross-ladder");
    ladder.innerHTML = "";
    let currentEl = null;
    for (let lane = 1; lane <= CROSS_LANES; lane++) {
        const rung = document.createElement("div");
        rung.className = "cross-rung";
        const mult = crossMultiplierAt(lane);
        const chance = crossSurviveChanceAt(lane);
        // Green (safe) fades toward red (risky) as survival odds drop.
        const hue = Math.round(130 * chance);
        rung.style.setProperty("--risk-hue", hue);
        rung.innerHTML = `<span>Lane ${lane}</span><span>${mult.toFixed(2)}x</span>`;
        if (crashedLane === lane) {
            rung.classList.add("crashed");
        } else if (lane <= currentLane) {
            rung.classList.add("passed");
        } else if (lane === currentLane + 1) {
            rung.classList.add("current");
            currentEl = rung;
        }
        ladder.appendChild(rung);
    }
    if (currentEl) {
        currentEl.scrollIntoView({ behavior: "smooth", block: "center", inline: "center" });
    }
}

function updateCrossToken(lane, crashed) {
    const token = document.getElementById("cross-token");
    const pct = (lane / CROSS_LANES) * 82;
    token.style.marginLeft = pct + "%";
    if (crashed) {
        token.classList.remove("hop");
        token.classList.add("crash");
        token.innerText = "💥";
    } else {
        token.classList.remove("crash");
        token.classList.add("hop");
        setTimeout(() => token.classList.remove("hop"), 350);
    }
}

function endCross(msg, cssClass) {
    crossActive = false;
    document.getElementById("start-cross-btn").style.display = "inline-block";
    document.getElementById("cross-attempt-btn").style.display = "none";
    document.getElementById("cross-cashout-btn").style.display = "none";
    document.getElementById("cross-hint").innerText =
        "Place a bet, then cross lane by lane. Cash out anytime — get hit and you lose it all.";
    setStatus("cross-status", msg, cssClass);
}

function initCross() {
    renderCrossLadder(0, null);

    document.getElementById("start-cross-btn").addEventListener("click", () => {
        const bet = getBet("cross-bet");
        if (!bet) return;

        adjustBalance(-bet);
        crossBet = bet;
        crossActive = true;
        crossLane = 0;

        document.getElementById("start-cross-btn").style.display = "none";
        document.getElementById("cross-attempt-btn").style.display = "inline-block";
        document.getElementById("cross-cashout-btn").style.display = "inline-block";
        document.getElementById("cross-cashout-btn").disabled = true;
        document.getElementById("cross-cashout-btn").innerText = "Cash Out";
        setStatus("cross-status", "Choose your move...", "");
        document.getElementById("cross-hint").innerText = "Cross the next lane, or cash out once you've survived one.";

        renderCrossLadder(0, null);
        const token = document.getElementById("cross-token");
        token.className = "cross-token";
        token.innerText = "🐔";
        token.style.marginLeft = "0%";
    });

    document.getElementById("cross-attempt-btn").addEventListener("click", () => {
        if (!crossActive) return;
        const attemptingLane = crossLane + 1;
        const survives = Math.random() < crossSurviveChanceAt(attemptingLane);

        if (survives) {
            crossLane++;
            Sounds.mineSafe();
            updateCrossToken(crossLane, false);
            renderCrossLadder(crossLane, null);

            const mult = crossMultiplierAt(crossLane);
            document.getElementById("cross-cashout-btn").disabled = false;
            document.getElementById("cross-cashout-btn").innerText = `Cash Out (${Math.floor(crossBet * mult)})`;
            setStatus("cross-status", `Lane ${crossLane}/${CROSS_LANES} — ${mult.toFixed(2)}x`, "win");

            if (crossLane === CROSS_LANES) {
                const win = Math.floor(crossBet * mult);
                adjustBalance(win);
                Sounds.jackpot();
                if (window.confettiBurst) confettiBurst(50);
                if (window.registerRoundResult) registerRoundResult(true);
                endCross(`Made it all the way across! +${win}`, "win");
            }
        } else {
            Sounds.mineExplode();
            updateCrossToken(crossLane, true);
            renderCrossLadder(crossLane, crossLane + 1);
            if (window.registerRoundResult) registerRoundResult(false);
            endCross(`Hit by a car! Lost ${crossBet}`, "loss");
        }
    });

    document.getElementById("cross-cashout-btn").addEventListener("click", () => {
        if (!crossActive || crossLane === 0) return;
        const win = Math.floor(crossBet * crossMultiplierAt(crossLane));
        adjustBalance(win);
        Sounds.cashout();
        if (window.registerRoundResult) registerRoundResult(true);
        endCross(`Cashed out! +${win} (${crossMultiplierAt(crossLane).toFixed(2)}x)`, "win");
    });
}

// ===================== DICE =====================
// Win pays 5x your bet; a loss just costs your bet (the bet is deducted up
// front when you roll).
const DICE_WIN_MULTIPLIER = 2;
const DICE_LOSS_MULTIPLIER = 1;
let diceMode = "under";

function diceWinChance(target, mode) {
    return mode === "under" ? target : 100 - target;
}

function updateDiceDisplay() {
    const target = parseInt(document.getElementById("dice-slider").value);
    document.getElementById("dice-target-value").innerText = target;

    const chance = diceWinChance(target, diceMode);
    document.getElementById("dice-winchance").innerText = chance.toFixed(2) + "%";
    document.getElementById("dice-multiplier").innerText = DICE_WIN_MULTIPLIER.toFixed(2) + "x";

    document.getElementById("dice-track-marker").style.left = target + "%";
    const fill = document.getElementById("dice-track-fill");
    fill.style.background = diceMode === "under"
        ? `linear-gradient(90deg, transparent ${target}%, rgba(10,16,22,0.65) ${target}%)`
        : `linear-gradient(90deg, rgba(10,16,22,0.65) ${target}%, transparent ${target}%)`;
}

function setDiceMode(mode) {
    diceMode = mode;
    document.getElementById("dice-mode-under").classList.toggle("active", mode === "under");
    document.getElementById("dice-mode-over").classList.toggle("active", mode === "over");
    updateDiceDisplay();
}

function initDice() {
    updateDiceDisplay();

    document.getElementById("dice-slider").addEventListener("input", updateDiceDisplay);
    document.getElementById("dice-mode-under").addEventListener("click", () => setDiceMode("under"));
    document.getElementById("dice-mode-over").addEventListener("click", () => setDiceMode("over"));

    document.getElementById("dice-roll-btn").addEventListener("click", () => {
        const bet = getBet("dice-bet");
        if (!bet) return;

        adjustBalance(-bet);
        const target = parseInt(document.getElementById("dice-slider").value);
        Sounds.spin();

        const roll = Math.random() * 100;
        const won = diceMode === "under" ? roll < target : roll > target;
        const display = document.getElementById("dice-roll-number");
        display.innerText = roll.toFixed(2);
        display.classList.remove("win", "loss");

        if (won) {
            const payout = bet * DICE_WIN_MULTIPLIER;
            adjustBalance(payout);
            Sounds.win();
            display.classList.add("win");
            setStatus("dice-status", `Rolled ${roll.toFixed(2)} — Won ${payout}!`, "win");
            if (window.registerRoundResult) registerRoundResult(true);
        } else {
            const totalLoss = bet * DICE_LOSS_MULTIPLIER;
            adjustBalance(-(totalLoss - bet)); // the first `bet` was already deducted above
            Sounds.loss();
            display.classList.add("loss");
            setStatus("dice-status", `Rolled ${roll.toFixed(2)} — Lost ${totalLoss}`, "loss");
            if (window.registerRoundResult) registerRoundResult(false);
        }
    });
}

// ===================== COINFLIP =====================
// A correct call pays 5x your bet; a miss just costs your bet (the bet is
// deducted up front when you flip).
const COIN_WIN_MULTIPLIER = 2;
const COIN_LOSS_MULTIPLIER = 1;
let coinChoice = null;

function setCoinChoice(choice) {
    coinChoice = choice;
    document.getElementById("coin-heads-btn").classList.toggle("selected", choice === "heads");
    document.getElementById("coin-tails-btn").classList.toggle("selected", choice === "tails");
    if (window.Sounds) Sounds.click();
}

function initCoinflip() {
    document.getElementById("coin-heads-btn").addEventListener("click", () => setCoinChoice("heads"));
    document.getElementById("coin-tails-btn").addEventListener("click", () => setCoinChoice("tails"));

    document.getElementById("coin-flip-btn").addEventListener("click", () => {
        if (!coinChoice) {
            showToast("Pick Heads or Tails first!", "error");
            return;
        }
        const bet = getBet("coin-bet");
        if (!bet) return;

        adjustBalance(-bet);
        const btn = document.getElementById("coin-flip-btn");
        btn.disabled = true;
        const visual = document.getElementById("coin-visual");
        visual.classList.remove("flipping");
        void visual.offsetWidth; // restart animation
        visual.classList.add("flipping");
        Sounds.spin();
        setStatus("coin-status", "Flipping...", "");

        setTimeout(() => {
            const result = Math.random() < 0.5 ? "heads" : "tails";
            visual.innerText = result === "heads" ? "🪙" : "🎯";
            btn.disabled = false;

            if (result === coinChoice) {
                const win = bet * COIN_WIN_MULTIPLIER;
                adjustBalance(win);
                Sounds.win();
                setStatus("coin-status", `${capitalize(result)}! Won ${win}`, "win");
                if (window.registerRoundResult) registerRoundResult(true);
            } else {
                const totalLoss = bet * COIN_LOSS_MULTIPLIER;
                adjustBalance(-(totalLoss - bet)); // the first `bet` was already deducted above
                Sounds.loss();
                setStatus("coin-status", `${capitalize(result)}! Lost ${totalLoss}`, "loss");
                if (window.registerRoundResult) registerRoundResult(false);
            }
        }, 700);
    });
}