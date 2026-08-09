document.addEventListener('DOMContentLoaded', () => {
    const lengthInput   = document.getElementById('length');
    const lengthVal     = document.getElementById('length-val');
    const countInput    = document.getElementById('count');
    const countVal      = document.getElementById('count-val');
    const generateBtn   = document.getElementById('generate-btn');
    const copyBtn       = document.getElementById('copy-btn');
    const resultDisplay = document.getElementById('password-result');
    const errorMsg      = document.getElementById('error-msg');
    const multiResults  = document.getElementById('multi-results');
    const historyList   = document.getElementById('history-list');
    const clearHistory  = document.getElementById('clear-history');
    const strengthBar   = document.getElementById('strength-bar');
    const strengthLabel = document.getElementById('strength-label');

    const uppercaseCb   = document.getElementById('uppercase');
    const lowercaseCb   = document.getElementById('lowercase');
    const numbersCb     = document.getElementById('numbers');
    const symbolsCb     = document.getElementById('symbols');
    const noAmbiguousCb = document.getElementById('no_ambiguous');
    const customNameInput = document.getElementById('custom-name');

    let history = [];

    // Slider labels
    lengthInput.addEventListener('input', () => { lengthVal.textContent = lengthInput.value; });
    countInput.addEventListener('input',  () => { countVal.textContent  = countInput.value;  });

    // Strength scorer
    function scorePassword(pw) {
        let score = 0;
        if (pw.length >= 12) score++;
        if (pw.length >= 20) score++;
        if (/[A-Z]/.test(pw)) score++;
        if (/[a-z]/.test(pw)) score++;
        if (/[0-9]/.test(pw)) score++;
        if (/[^A-Za-z0-9]/.test(pw)) score++;
        return score;
    }

    function updateStrength(pw) {
        if (!pw || pw === 'Click Generate') {
            strengthBar.style.width = '0%';
            strengthLabel.textContent = '';
            return;
        }
        const score = scorePassword(pw);
        const levels = [
            { label: 'Very Weak', color: '#ef4444', pct: '15%' },
            { label: 'Weak',      color: '#f97316', pct: '30%' },
            { label: 'Fair',      color: '#eab308', pct: '50%' },
            { label: 'Good',      color: '#84cc16', pct: '70%' },
            { label: 'Strong',    color: '#22c55e', pct: '85%' },
            { label: 'Very Strong', color: '#10b981', pct: '100%' },
        ];
        const lvl = levels[Math.min(score, levels.length - 1)];
        strengthBar.style.width = lvl.pct;
        strengthBar.style.backgroundColor = lvl.color;
        strengthLabel.textContent = lvl.label;
        strengthLabel.style.color = lvl.color;
    }

    // History
    function addToHistory(pw) {
        history = [pw, ...history.filter(p => p !== pw)].slice(0, 5);
        renderHistory();
    }

    function renderHistory() {
        historyList.innerHTML = '';
        if (history.length === 0) {
            historyList.innerHTML = '<li class="history-empty">No history yet</li>';
            return;
        }
        history.forEach(pw => {
            const li = document.createElement('li');
            li.className = 'history-entry';
            li.title = 'Click to copy';
            li.textContent = pw;
            li.addEventListener('click', () => {
                navigator.clipboard.writeText(pw);
                li.style.borderColor = '#10b981';
                setTimeout(() => li.style.borderColor = '', 1000);
            });
            historyList.appendChild(li);
        });
    }

    clearHistory.addEventListener('click', () => {
        history = [];
        renderHistory();
    });

    // Utility
    function escapeHTML(str) {
        const div = document.createElement('div');
        div.textContent = str;
        return div.innerHTML;
    }

    // Generate
    generateBtn.addEventListener('click', async () => {
        errorMsg.textContent = '';
        multiResults.classList.add('hidden');

        const params = new URLSearchParams({
            length:        lengthInput.value,
            count:         countInput.value,
            uppercase:     uppercaseCb.checked,
            lowercase:     lowercaseCb.checked,
            numbers:       numbersCb.checked,
            symbols:       symbolsCb.checked,
            no_ambiguous:  noAmbiguousCb.checked,
            name:          customNameInput.value.trim(),
        });

        try {
            const response = await fetch(`/generate/?${params.toString()}`);
            const data = await response.json();

            if (!response.ok) {
                errorMsg.textContent = data.error || 'Failed to generate password';
                resultDisplay.textContent = 'Click Generate';
                updateStrength('');
                return;
            }

            const passwords = data.passwords;
            const primary = passwords[0];
            const customName = customNameInput.value.trim();

            // Highlight embedded name in the display
            if (customName && primary.includes(customName)) {
                const idx = primary.indexOf(customName);
                resultDisplay.innerHTML =
                    escapeHTML(primary.slice(0, idx)) +
                    `<mark>${escapeHTML(customName)}</mark>` +
                    escapeHTML(primary.slice(idx + customName.length));
            } else {
                resultDisplay.textContent = primary;
            }
            updateStrength(primary);
            addToHistory(primary);

            // Multi-output
            if (passwords.length > 1) {
                multiResults.classList.remove('hidden');
                multiResults.innerHTML = passwords.map((pw, i) => `
                    <div class="multi-item">
                        <span>${pw}</span>
                        <button class="multi-copy" data-pw="${pw}">Copy</button>
                    </div>
                `).join('');

                multiResults.querySelectorAll('.multi-copy').forEach(btn => {
                    btn.addEventListener('click', () => {
                        navigator.clipboard.writeText(btn.dataset.pw);
                        btn.textContent = 'Copied!';
                        setTimeout(() => btn.textContent = 'Copy', 1500);
                    });
                });

                passwords.forEach(pw => addToHistory(pw));
                // Show first in main display
                resultDisplay.textContent = passwords[0];
            }

        } catch (err) {
            errorMsg.textContent = 'Network error. Please try again.';
        }
    });

    // Copy primary
    copyBtn.addEventListener('click', () => {
        const text = resultDisplay.textContent;
        if (text && text !== 'Click Generate') {
            navigator.clipboard.writeText(text).then(() => {
                const orig = copyBtn.innerHTML;
                copyBtn.innerHTML = `<svg xmlns="http://www.w3.org/2000/svg" width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="#10b981" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="20 6 9 17 4 12"></polyline></svg>`;
                setTimeout(() => { copyBtn.innerHTML = orig; }, 2000);
            });
        }
    });

    // Auto-generate on load
    generateBtn.click();
});
