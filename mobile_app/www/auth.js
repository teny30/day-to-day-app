document.addEventListener('DOMContentLoaded', () => {
    const authForm       = document.getElementById('auth-form');
    const authTitle      = document.getElementById('auth-title');
    const authSubtitle   = document.getElementById('auth-subtitle');
    const authBtn        = document.getElementById('auth-btn');
    const authSwitchText = document.getElementById('auth-switch-text');
    const authSwitchLink = document.getElementById('auth-switch-link');
    const authError      = document.getElementById('auth-error');
    const authIcon       = document.querySelector('.auth-icon');

    let isLogin = true;
    let isSubmitting = false;

    authSwitchLink.addEventListener('click', (e) => {
        e.preventDefault();
        isLogin = !isLogin;
        authTitle.textContent      = isLogin ? 'Welcome Back'            : 'Create Account';
        authSubtitle.textContent   = isLogin ? 'Sign in to access Tasks & Passwords' : 'Sign up to get started';
        authBtn.textContent        = isLogin ? 'Sign In'                 : 'Register';
        authSwitchText.textContent = isLogin ? "Don't have an account?" : "Already have an account?";
        authSwitchLink.textContent = isLogin ? 'Register'              : 'Sign In';
        if (authIcon) authIcon.textContent = isLogin ? '⚡' : '🚀';
        authError.textContent      = '';
    });

    async function doAuth() {
        if (isSubmitting) return;

        authError.textContent = '';
        const username = document.getElementById('username').value.trim();
        const password = document.getElementById('password').value;

        if (!username || !password) {
            authError.textContent = 'Please fill in all fields.';
            return;
        }

        isSubmitting = true;
        authBtn.textContent = isLogin ? 'Signing in…' : 'Creating account…';
        authBtn.disabled = true;

        const endpoint = isLogin ? '/api/login' : '/api/register';
        try {
            const response = await fetch(endpoint, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ username, password })
            });
            const data = await response.json();
            if (!response.ok) {
                authError.textContent = data.error || 'An error occurred';
                authBtn.textContent = isLogin ? 'Sign In' : 'Register';
                authBtn.disabled = false;
                isSubmitting = false;
                return;
            }
            window.location.replace('/');
        } catch (error) {
            authError.textContent = 'Network error. Please try again.';
            authBtn.textContent = isLogin ? 'Sign In' : 'Register';
            authBtn.disabled = false;
            isSubmitting = false;
        }
    }

    if (authForm) {
        authForm.addEventListener('submit', (e) => {
            e.preventDefault();
            doAuth();
        });
    }

    authBtn.addEventListener('click', (e) => {
        e.preventDefault();
        doAuth();
    });
});


