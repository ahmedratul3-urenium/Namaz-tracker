let prayerTimes = {};
let timerInterval;

const cityInput = document.getElementById("city-input");
const searchBtn = document.getElementById("search-btn");
const locDisplay = document.getElementById("location-display");
const islamicDateDisplay = document.getElementById("islamic-date");
const settingsBtn = document.getElementById("settings-btn");
const installBtn = document.getElementById("install-btn");
const settingsModal = document.getElementById("settings-modal");
const closeModal = document.getElementById("close-modal");
const saveSettingsBtn = document.getElementById("save-settings");
const calcMethodSelect = document.getElementById("calc-method");
const enableAudioCheckbox = document.getElementById("enable-audio");
const enablePushCheckbox = document.getElementById("enable-push");
const adhanAudio = document.getElementById("adhan-audio");

let installPrompt = null;

let config = {
    city: localStorage.getItem("namazCity") || "",
    method: localStorage.getItem("namazMethod") || "1",
    alarms: JSON.parse(localStorage.getItem("namazAlarms")) || {
        "Fajr": true, "Sunrise": false, "Dhuhr": true, "Asr": true, "Maghrib": true, "Isha": true
    },
    enableAudio: localStorage.getItem("namazAudio") !== "false",
    enablePush: localStorage.getItem("namazPush") !== "false"
};

function init() {
    if(cityInput) cityInput.value = config.city;
    if(calcMethodSelect) calcMethodSelect.value = config.method;
    if(enableAudioCheckbox) enableAudioCheckbox.checked = config.enableAudio;
    if(enablePushCheckbox) enablePushCheckbox.checked = config.enablePush;
    setupAlarmToggles();
    if (config.city) fetchPrayerTimes(config.city, config.method);
}

// PWA Install Logic
window.addEventListener("beforeinstallprompt", (event) => {
    event.preventDefault();
    installPrompt = event;
    installBtn.classList.remove("hidden");
});

installBtn.addEventListener("click", async () => {
    if (!installPrompt) {
        alert("Install feature is only available when viewing from a web server (http://localhost:3000). If you opened index.html directly from your file system, the browser won't show the install prompt.");
        return;
    }
    installPrompt.prompt();
    const result = await installPrompt.userChoice;
    installPrompt = null;
    installBtn.classList.add("hidden");
});

window.addEventListener("appinstalled", () => {
    installPrompt = null;
    installBtn.classList.add("hidden");
});

if(searchBtn) {
    searchBtn.addEventListener("click", () => {
        const act = () => {
            const city = cityInput.value.trim();
            if (city) {
                config.city = city;
                localStorage.setItem("namazCity", city);
                fetchPrayerTimes(city, config.method);
                cityInput.value = "";
            }
        }
        if (config.enablePush && Notification.permission !== "granted" && Notification.permission !== "denied") {
            Notification.requestPermission().then(act);
        } else {
            act();
        }
    });
}

if(cityInput) {
    cityInput.addEventListener("keypress", (e) => {
        if (e.key === "Enter") searchBtn.click();
    });
}

if(settingsBtn) settingsBtn.addEventListener("click", () => settingsModal.classList.remove("hidden"));
if(closeModal) closeModal.addEventListener("click", () => settingsModal.classList.add("hidden"));

if(settingsModal) {
    settingsModal.addEventListener("click", (e) => {
        if(e.target === settingsModal) settingsModal.classList.add("hidden");
    });
}

if(saveSettingsBtn) {
    saveSettingsBtn.addEventListener("click", () => {
        config.method = calcMethodSelect.value;
        config.enableAudio = enableAudioCheckbox.checked;
        config.enablePush = enablePushCheckbox.checked;
        
        localStorage.setItem("namazMethod", config.method);
        localStorage.setItem("namazAudio", !!config.enableAudio);
        localStorage.setItem("namazPush", !!config.enablePush);
        
        settingsModal.classList.add("hidden");
        
        if (config.city) fetchPrayerTimes(config.city, config.method);
        if (config.enablePush && Notification.permission !== "granted") Notification.requestPermission();
    });
}

function setupAlarmToggles() {
    document.querySelectorAll(".alarm-toggle").forEach(btn => {
        const row = btn.closest(".prayer-row");
        const prayer = row.dataset.prayer;
        
        if (config.alarms[prayer]) {
            btn.classList.add("active");
            btn.innerHTML = "<i class=\"fa-solid fa-bell\"></i>";
        } else {
            btn.classList.remove("active");
            btn.innerHTML = "<i class=\"fa-solid fa-bell-slash\"></i>";
        }

        btn.addEventListener("click", () => {
            config.alarms[prayer] = !config.alarms[prayer];
            localStorage.setItem("namazAlarms", JSON.stringify(config.alarms));
            
            if (config.alarms[prayer]) {
                btn.classList.add("active");
                btn.innerHTML = "<i class=\"fa-solid fa-bell\"></i>";
            } else {
                btn.classList.remove("active");
                btn.innerHTML = "<i class=\"fa-solid fa-bell-slash\"></i>";
            }
        });
    });
}

async function fetchPrayerTimes(address, method) {
    try {
        locDisplay.innerHTML = "<i class=\"fa-solid fa-spinner fa-spin\"></i> Loading...";
        const date = new Date();
        const dateStr = `${date.getDate()}-${date.getMonth() + 1}-${date.getFullYear()}`;
        
        // Try to be more specific: add Bangladesh if it looks like a BD city
        let searchAddress = address;
        if (!address.toLowerCase().includes("bangladesh") && !address.includes(",")) {
            searchAddress = address + ", Bangladesh";
        }
        
        const res = await fetch(`https://api.aladhan.com/v1/timingsByAddress/${dateStr}?address=${encodeURIComponent(searchAddress)}&method=${method}`);
        const data = await res.json();
        
        if (data.code === 200) {
            const timings = data.data.timings;
            prayerTimes = {
                "Fajr": timings.Fajr, "Sunrise": timings.Sunrise, "Dhuhr": timings.Dhuhr,
                "Asr": timings.Asr, "Maghrib": timings.Maghrib, "Isha": timings.Isha
            };
            
            document.getElementById("time-fajr").textContent = tConvert(timings.Fajr);
            document.getElementById("time-sunrise").textContent = tConvert(timings.Sunrise);
            document.getElementById("time-dhuhr").textContent = tConvert(timings.Dhuhr);
            document.getElementById("time-asr").textContent = tConvert(timings.Asr);
            document.getElementById("time-maghrib").textContent = tConvert(timings.Maghrib);
            document.getElementById("time-isha").textContent = tConvert(timings.Isha);
            
            const iftarTime = timings.Maghrib;
            const sahriTime = timings.Imsak || tConvertBackAndSubtract(timings.Fajr, 10); 

            document.getElementById("time-iftar").textContent = tConvert(iftarTime);
            document.getElementById("time-sahri").textContent = tConvert(sahriTime);
            
            // Show the exact address the user searched for
            locDisplay.innerHTML = "<i class=\"fa-solid fa-location-dot\"></i> " + address.toUpperCase();
            
            const hijri = data.data.date.hijri;
            islamicDateDisplay.textContent = `${hijri.day} ${hijri.month.en} ${hijri.year} AH`;

            startCountdown();
        } else {
            locDisplay.innerHTML = "<i class=\"fa-solid fa-circle-exclamation\"></i> Location not found";
        }
    } catch (err) {
        locDisplay.innerHTML = "<i class=\"fa-solid fa-circle-exclamation\"></i> Network error";
    }
}

function tConvertBackAndSubtract(timeStr, minsToSubtract) {
    let [h, m] = timeStr.split(":");
    let dateObj = new Date();
    dateObj.setHours(h, m, 0);
    dateObj.setMinutes(dateObj.getMinutes() - minsToSubtract);
    let newH = String(dateObj.getHours()).padStart(2, '0');
    let newM = String(dateObj.getMinutes()).padStart(2, '0');
    return `${newH}:${newM}`;
}

function tConvert(time) {
    if (!time) return "--:--";
    time = time.toString().match(/^([01]\d|2[0-3])(:)([0-5]\d)(:[0-5]\d)?$/) || [time];
    if (time.length > 1) {
        time = time.slice(1);
        time[5] = +time[0] < 12 ? " AM" : " PM";
        time[0] = +time[0] % 12 || 12;
    }
    return time.join("");
}

let lastPlayedPrayer = null;

function startCountdown() {
    if (timerInterval) clearInterval(timerInterval);
    
    timerInterval = setInterval(() => {
        const now = new Date();
        const currentTime = `${String(now.getHours()).padStart(2, "0")}:${String(now.getMinutes()).padStart(2, "0")}`;
        
        let nextPrayer = null;
        let nextTimeStr = null;
        
        const prayers = ["Fajr", "Sunrise", "Dhuhr", "Asr", "Maghrib", "Isha"];
        for (let p of prayers) {
            if (prayerTimes[p] > currentTime) {
                nextPrayer = p;
                nextTimeStr = prayerTimes[p];
                break;
            }
        }
        
        if (!nextPrayer) {
            nextPrayer = "Fajr";
            nextTimeStr = prayerTimes["Fajr"];
        }

        document.querySelectorAll(".prayer-row").forEach(row => {
            if(row.dataset.prayer === nextPrayer) row.classList.add("active-next");
            else row.classList.remove("active-next");
        });
        
        document.getElementById("next-prayer-name").textContent = nextPrayer;
        
        const [nextH, nextM] = nextTimeStr.split(":");
        const nextTime = new Date();
        nextTime.setHours(parseInt(nextH), parseInt(nextM), 0, 0);
        
        if (prayerTimes["Isha"] <= currentTime && nextPrayer === "Fajr") {
            nextTime.setDate(nextTime.getDate() + 1);
        }
        
        const diff = nextTime.getTime() - now.getTime();
        
        if (diff <= 1000 && diff >= 0) triggerAlarm(nextPrayer);

        const h = Math.floor((diff % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60));
        const m = Math.floor((diff % (1000 * 60 * 60)) / (1000 * 60));
        const s = Math.floor((diff % (1000 * 60)) / 1000);
        
        document.getElementById("countdown").textContent = 
            `${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}:${String(s).padStart(2, "0")}`;
            
    }, 1000);
}

function triggerAlarm(prayerName) {
    if (lastPlayedPrayer === prayerName) return;
    lastPlayedPrayer = prayerName;
    if (!config.alarms[prayerName]) return;

    if (config.enablePush && Notification.permission === "granted") {
        new Notification("Namaz Time", {
            body: `It's time for ${prayerName} prayer.`,
            icon: "icons/icon-192.png"
        });
    }

    if (config.enableAudio && prayerName !== "Sunrise") {
        adhanAudio.play().catch(e => console.log("Audio skipped:", e));
    }
}

if ("serviceWorker" in navigator) {
    navigator.serviceWorker.register("sw.js").catch(()=>{});
}

init();
