// main.js - Core Logic, UI Navigation, and Notifications
let balance = 1000;

// --- Safe Storage ---
// Some environments (sandboxed previews, strict privacy modes, file:// origins
// in certain browsers) throw when localStorage is touched at all. Previously
// a single thrown error here (e.g. inside initDataStore) would stop every
// later init() call in the same handler -- including initTOS -- which is why
// the Terms of Service modal could silently fail to appear. Everything now
// goes through this wrapper, which falls back to an in-memory store instead
// of crashing.
const _memoryStore = {};
const safeStorage = {
    get(key) {
        try {
            return localStorage.getItem(key);
        } catch (e) {
            return Object.prototype.hasOwnProperty.call(_memoryStore, key) ? _memoryStore[key] : null;
        }
    },
    set(key, value) {
        try {
            localStorage.setItem(key, value);
        } catch (e) {
            _memoryStore[key] = value;
        }
    }
};
window.safeStorage = safeStorage;

document.addEventListener("DOMContentLoaded", () => {
    // Each init runs independently so one failure can't block the rest
    // (this is also what guarantees the TOS modal always gets a chance to show).
    const inits = [initDataStore, initTOS, initNavigation, initDaily, updateBalanceDisplay];
    inits.forEach((fn) => {
        try {
            fn();
        } catch (err) {
            console.error(`OwO Gambling: ${fn.name} failed`, err);
        }
    });
});

// Custom Notification System (Replaces alert)
window.showToast = function (message, type = 'info') {
    const container = document.getElementById('toast-container');
    if (!container) return;
    const toast = document.createElement('div');
    toast.className = `toast ${type}`;

    // Add icon based on type
    let icon = 'ℹ️';
    if (type === 'success') icon = '✅';
    if (type === 'error') icon = '❌';

    toast.innerHTML = `<span>${icon}</span> <span>${message}</span>`;
    container.appendChild(toast);

    // Animate out and remove
    setTimeout(() => {
        toast.style.opacity = '0';
        setTimeout(() => toast.remove(), 300);
    }, 3500);
};

function initDataStore() {
    const stored = safeStorage.get("owo_balance");
    if (stored !== null && !isNaN(parseInt(stored))) {
        balance = parseInt(stored);
    } else {
        saveBalance();
    }
}

function saveBalance() {
    safeStorage.set("owo_balance", balance.toString());
    updateBalanceDisplay();
}

function updateBalanceDisplay() {
    const el = document.getElementById("balance-display");
    if (el) el.innerText = balance.toLocaleString();
}

// --- Win Streak Tracker ---
// A little dopamine hit for consecutive wins across ANY game. Resets to 0
// the moment a round is lost.
let winStreak = 0;
window.registerRoundResult = function (won) {
    winStreak = won ? winStreak + 1 : 0;
    updateStreakDisplay();
};

function updateStreakDisplay() {
    const el = document.getElementById("streak-display");
    if (!el) return;
    if (winStreak >= 2) {
        el.style.display = "flex";
        el.innerText = `🔥 ${winStreak} win streak!`;
    } else {
        el.style.display = "none";
    }
}

// --- Confetti Burst ---
// Lightweight celebration effect for jackpots and big clears. Pure DOM/CSS,
// no canvas needed.
window.confettiBurst = function (count = 40) {
    const pieces = ['🎉', '✨', '💰', '🎊', '⭐', '🪙'];
    for (let i = 0; i < count; i++) {
        const el = document.createElement("div");
        el.className = "confetti-piece";
        el.innerText = pieces[Math.floor(Math.random() * pieces.length)];
        el.style.left = Math.random() * 100 + "vw";
        el.style.fontSize = (14 + Math.random() * 16) + "px";
        el.style.animationDuration = (2 + Math.random() * 1.5) + "s";
        el.style.animationDelay = (Math.random() * 0.3) + "s";
        document.body.appendChild(el);
        setTimeout(() => el.remove(), 4000);
    }
};

window.adjustBalance = function (amount) {
    balance += amount;
    saveBalance();

    const pill = document.querySelector(".balance-pill");
    if (pill) {
        pill.classList.remove("flash-win", "flash-loss");
        // Force reflow so the animation can restart on rapid consecutive calls
        void pill.offsetWidth;
        pill.classList.add(amount >= 0 ? "flash-win" : "flash-loss");
        setTimeout(() => pill.classList.remove("flash-win", "flash-loss"), 500);
    }
};

function initTOS() {
    const tosModal = document.getElementById("tos-modal");
    const acceptBtn = document.getElementById("accept-tos");
    if (!tosModal || !acceptBtn) return;

    if (safeStorage.get("owo_tos_accepted") !== "true") {
        tosModal.style.display = "flex";
    }

    acceptBtn.addEventListener("click", () => {
        if (window.Sounds) window.Sounds.click();
        safeStorage.set("owo_tos_accepted", "true");
        tosModal.style.display = "none";
        showToast("Welcome to OwO Gambling!", "success");
    });
}

function initNavigation() {
    const navBtns = document.querySelectorAll(".nav-btn");
    const sections = document.querySelectorAll(".game-section");

    navBtns.forEach(btn => {
        btn.addEventListener("click", () => {
            if (window.Sounds) window.Sounds.click();
            navBtns.forEach(b => b.classList.remove("active"));
            sections.forEach(s => s.classList.remove("active"));

            btn.classList.add("active");
            const target = document.getElementById(btn.dataset.target);
            if (target) target.classList.add("active");
        });
    });
}

function initDaily() {
    const dailyBtn = document.getElementById("daily-btn");
    if (!dailyBtn) return;

    dailyBtn.addEventListener("click", () => {
        const lastClaim = safeStorage.get("owo_daily_claim");
        const now = new Date().getTime();
        const DAY_IN_MS = 86400000;

        if (!lastClaim || now - parseInt(lastClaim) > DAY_IN_MS) {
            adjustBalance(500);
            safeStorage.set("owo_daily_claim", now.toString());
            if (window.Sounds) window.Sounds.win();
            showToast("Successfully claimed 500 OwO!", "success");
        } else {
            if (window.Sounds) window.Sounds.loss();
            const timeLeft = DAY_IN_MS - (now - parseInt(lastClaim));
            const hoursLeft = Math.floor(timeLeft / (1000 * 60 * 60));
            const minsLeft = Math.floor((timeLeft % (1000 * 60 * 60)) / (1000 * 60));
            showToast(`Already claimed! Wait ${hoursLeft}h ${minsLeft}m.`, "error");
        }
    });
}