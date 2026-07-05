// Premium Modal Alerts & Dialogs for PESAQUASH
function showSystemAlert(message) {
    // Create alert overlay
    const overlay = document.createElement("div");
    overlay.className = "fixed inset-0 z-100 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs transition-opacity duration-200 opacity-0";
    
    // Icon selection
    let iconSvg = `
        <svg class="h-6 w-6 text-blue-600" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2">
            <path stroke-linecap="round" stroke-linejoin="round" d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
        </svg>
    `;
    let title = "System Notification";
    
    const msgLower = message.toLowerCase();
    if (msgLower.includes("success") || msgLower.includes("complete") || msgLower.includes("updated") || msgLower.includes("approved") || msgLower.includes("correct") || msgLower.includes("won") || msgLower.includes("added")) {
        iconSvg = `
            <svg class="h-6 w-6 text-emerald-600 animate-pulse" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2">
                <path stroke-linecap="round" stroke-linejoin="round" d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
        `;
        title = "Operation Successful";
    } else if (msgLower.includes("error") || msgLower.includes("invalid") || msgLower.includes("fail") || msgLower.includes("incorrect") || msgLower.includes("warn") || msgLower.includes("closed") || msgLower.includes("block") || msgLower.includes("warning")) {
        iconSvg = `
            <svg class="h-6 w-6 text-rose-600 animate-bounce" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2">
                <path stroke-linecap="round" stroke-linejoin="round" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
            </svg>
        `;
        title = "System Alert";
    }

    const formattedMsg = message.replace(/\n/g, "<br>");
    
    overlay.innerHTML = `
        <div class="glass-card bg-white rounded-2xl p-6 max-w-sm w-full border border-slate-200 shadow-2xl space-y-4 transform transition-all scale-95 duration-200">
            <div class="flex items-center space-x-3">
                <div class="h-10 w-10 bg-slate-50 border border-slate-100 rounded-xl flex items-center justify-center shrink-0">
                    ${iconSvg}
                </div>
                <h3 class="text-sm font-black tracking-wider text-slate-900 uppercase font-mono">${title}</h3>
            </div>
            <p class="text-xs text-slate-650 font-bold leading-relaxed font-mono">${formattedMsg}</p>
            <div class="pt-2">
                <button id="system-alert-ok-btn" class="w-full bg-blue-600 hover:bg-blue-700 text-white font-bold text-xs uppercase tracking-wider py-3.5 px-6 rounded-xl transition-all cursor-pointer shadow-xs active:scale-[0.98]">
                    Acknowledge
                </button>
            </div>
        </div>
    `;
    
    document.body.appendChild(overlay);
    
    // Transition in
    setTimeout(() => {
        overlay.classList.remove("opacity-0");
        overlay.classList.add("opacity-100");
        const card = overlay.querySelector(".glass-card");
        if (card) {
            card.classList.remove("scale-95");
            card.classList.add("scale-100");
        }
    }, 10);

    return new Promise((resolve) => {
        document.getElementById("system-alert-ok-btn").addEventListener("click", function() {
            // Transition out
            overlay.classList.remove("opacity-100");
            overlay.classList.add("opacity-0");
            const card = overlay.querySelector(".glass-card");
            if (card) {
                card.classList.remove("scale-100");
                card.classList.add("scale-95");
            }
            setTimeout(() => {
                overlay.remove();
                resolve(true);
            }, 200);
        });
    });
}

function showSystemConfirm(message) {
    // Create confirm overlay
    const overlay = document.createElement("div");
    overlay.className = "fixed inset-0 z-100 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs transition-opacity duration-200 opacity-0";
    
    let iconSvg = `
        <svg class="h-6 w-6 text-amber-500 animate-bounce" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2">
            <path stroke-linecap="round" stroke-linejoin="round" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
        </svg>
    `;
    let title = "Confirm Action";

    const formattedMsg = message.replace(/\n/g, "<br>");
    
    overlay.innerHTML = `
        <div class="glass-card bg-white rounded-2xl p-6 max-w-sm w-full border border-slate-200 shadow-2xl space-y-4 transform transition-all scale-95 duration-200">
            <div class="flex items-center space-x-3">
                <div class="h-10 w-10 bg-amber-50 border border-amber-100 rounded-xl flex items-center justify-center shrink-0">
                    ${iconSvg}
                </div>
                <h3 class="text-sm font-black tracking-wider text-slate-900 uppercase font-mono">${title}</h3>
            </div>
            <p class="text-xs text-slate-650 font-bold leading-relaxed font-mono">${formattedMsg}</p>
            <div class="grid grid-cols-2 gap-3 pt-2">
                <button id="system-confirm-cancel-btn" class="w-full bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold text-xs uppercase tracking-wider py-3.5 px-6 rounded-xl transition-all cursor-pointer border border-slate-200 active:scale-[0.98]">
                    Cancel
                </button>
                <button id="system-confirm-yes-btn" class="w-full bg-blue-600 hover:bg-blue-700 text-white font-bold text-xs uppercase tracking-wider py-3.5 px-6 rounded-xl transition-all cursor-pointer shadow-xs active:scale-[0.98]">
                    Confirm
                </button>
            </div>
        </div>
    `;
    
    document.body.appendChild(overlay);
    
    // Transition in
    setTimeout(() => {
        overlay.classList.remove("opacity-0");
        overlay.classList.add("opacity-100");
        const card = overlay.querySelector(".glass-card");
        if (card) {
            card.classList.remove("scale-95");
            card.classList.add("scale-100");
        }
    }, 10);

    return new Promise((resolve) => {
        document.getElementById("system-confirm-yes-btn").addEventListener("click", function() {
            closeOverlay(true);
        });
        document.getElementById("system-confirm-cancel-btn").addEventListener("click", function() {
            closeOverlay(false);
        });

        function closeOverlay(result) {
            overlay.classList.remove("opacity-100");
            overlay.classList.add("opacity-0");
            const card = overlay.querySelector(".glass-card");
            if (card) {
                card.classList.remove("scale-100");
                card.classList.add("scale-95");
            }
            setTimeout(() => {
                overlay.remove();
                resolve(result);
            }, 200);
        }
    });
}

// Global overrides for native alerts (non-blocking style wrapper)
window.alert = function(msg) {
    showSystemAlert(msg);
};
