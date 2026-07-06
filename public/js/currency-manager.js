const KES_USD_RATE = 130.0;

function getSelectedCurrency() {
    return localStorage.getItem("selected_currency") || "KES";
}

function formatCurrencyValue(value, currency) {
    const isNegative = value < 0;
    const absVal = Math.abs(value);
    if (currency === "USD") {
        const usdValue = absVal / KES_USD_RATE;
        return (isNegative ? "-" : "") + "$" + usdValue.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
    } else {
        return (isNegative ? "-" : "") + "KES " + absVal.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
    }
}

function updateToggleUI() {
    const currency = getSelectedCurrency();
    const kesBtn = document.getElementById("currency-toggle-kes");
    const usdBtn = document.getElementById("currency-toggle-usd");
    
    if (!kesBtn || !usdBtn) return;
    
    if (currency === "USD") {
        kesBtn.className = "px-2.5 py-1 rounded-lg text-[11px] font-extrabold transition-all cursor-pointer text-blue-600 bg-transparent";
        usdBtn.className = "px-2.5 py-1 rounded-lg text-[11px] font-extrabold transition-all cursor-pointer bg-blue-600 text-white shadow-xs";
    } else {
        kesBtn.className = "px-2.5 py-1 rounded-lg text-[11px] font-extrabold transition-all cursor-pointer bg-blue-600 text-white shadow-xs";
        usdBtn.className = "px-2.5 py-1 rounded-lg text-[11px] font-extrabold transition-all cursor-pointer text-blue-600 bg-transparent";
    }
}

function updateAllCurrencyDisplays() {
    const currency = getSelectedCurrency();
    
    // Find all elements displaying KES values and convert them
    const elements = document.querySelectorAll("[data-currency-kes]");
    elements.forEach(el => {
        const rawKes = parseFloat(el.getAttribute("data-currency-kes"));
        if (!isNaN(rawKes)) {
            el.textContent = formatCurrencyValue(rawKes, currency);
        }
    });

    // Update withdraw amount inputs and placeholders if applicable
    const amountInput = document.getElementById("withdraw-amount");
    if (amountInput) {
        const minKes = parseFloat(amountInput.getAttribute("data-min-kes")) || 50.0;
        const maxKes = parseFloat(amountInput.getAttribute("data-max-kes"));
        
        if (currency === "USD") {
            amountInput.min = (minKes / KES_USD_RATE).toFixed(2);
            if (!isNaN(maxKes)) {
                amountInput.max = (maxKes / KES_USD_RATE).toFixed(2);
            }
            amountInput.placeholder = (minKes / KES_USD_RATE).toFixed(2);
            
            const amountLabel = amountInput.previousElementSibling;
            if (amountLabel && amountLabel.textContent.includes("KES")) {
                amountLabel.textContent = "Amount to Withdraw (USD)";
            }
        } else {
            amountInput.min = minKes;
            if (!isNaN(maxKes)) {
                amountInput.max = maxKes;
            }
            amountInput.placeholder = minKes.toFixed(2);
            
            const amountLabel = amountInput.previousElementSibling;
            if (amountLabel && amountLabel.textContent.includes("USD")) {
                amountLabel.textContent = "Amount to Withdraw (KES)";
            }
        }
    }
    
    // Update raw labels on the withdraw page
    const balanceLabel = document.getElementById("available-balance-label");
    if (balanceLabel) {
        balanceLabel.textContent = currency === "USD" ? "Available Balance (USD)" : "Available Balance (KES)";
    }
    const minLabel = document.getElementById("min-withdrawal-label");
    if (minLabel) {
        minLabel.textContent = currency === "USD" ? "Min Withdrawal (USD)" : "Min Withdrawal (KES)";
    }
}

function setGlobalCurrency(currency) {
    localStorage.setItem("selected_currency", currency);
    updateToggleUI();
    updateAllCurrencyDisplays();
    
    // Dispatch event for specialized page scripts (like chart updates)
    window.dispatchEvent(new CustomEvent('currencychange', { detail: { currency } }));
}

// Automatically bind and trigger on load
document.addEventListener("DOMContentLoaded", () => {
    updateToggleUI();
    updateAllCurrencyDisplays();
});
