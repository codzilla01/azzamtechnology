(function () {
    'use strict';
    const $ = selector => document.querySelector(selector);
    const loginView = $('#login-view');
    const setupView = $('#setup-view');
    const card = $('.auth-card');

    const commonErrors = {
        INVALID_USERNAME: 'اسم المستخدم يجب أن يكون من ٣ إلى ٣٢ حرفاً إنجليزياً أو رقماً، ويمكن أن يتضمن . أو _ أو -.',
        INVALID_PASSWORD: 'اختر كلمة مرور من ١٢ حرفاً على الأقل ولا تزيد على ٢٥٦ بايت.',
        PASSWORD_UNCHANGED: 'اختر كلمة مرور مختلفة عن الحالية.',
        TOO_MANY_ATTEMPTS: 'محاولات كثيرة. انتظر ١٥ دقيقة ثم حاول مجدداً.',
        AUTH_UNAVAILABLE: 'خدمة تسجيل الدخول غير متاحة. تحقّق من إعداد الخادم ثم حاول مجدداً.',
        HTTPS_REQUIRED: 'يتطلب تسجيل الدخول اتصالاً آمناً عبر HTTPS.'
    };

    function showError(element, message) {
        element.hidden = false;
        I18n.setMessage(element, message);
    }
    function clearError(element) {
        element.hidden = true;
        element.textContent = '';
        delete element.dataset.i18nMessage;
    }
    function showLogin() {
        $('#auth-loading').hidden = true;
        loginView.hidden = false;
        setupView.hidden = true;
        card.setAttribute('aria-labelledby', 'login-title');
    }
    function showSetup(username, currentPassword = '') {
        $('#auth-loading').hidden = true;
        loginView.hidden = true;
        setupView.hidden = false;
        card.setAttribute('aria-labelledby', 'setup-title');
        $('#setup-username').value = username;
        $('#setup-current-password').value = currentPassword;
        $('#login-password').value = '';
        $('#setup-title').focus();
    }
    async function post(endpoint, body) {
        const response = await fetch('/api/auth/' + endpoint, {
            method: 'POST', cache: 'no-store', headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(body)
        });
        const result = await response.json();
        return { response, result };
    }

    $('#login-form').addEventListener('submit', async event => {
        event.preventDefault();
        const error = $('#login-error');
        const button = $('#login-submit');
        clearError(error);
        button.disabled = true;
        const username = $('#login-username').value.trim();
        const password = $('#login-password').value;
        try {
            const { response, result } = await post('login', { username, password });
            if (!response.ok) {
                showError(error, result.code === 'INVALID_CREDENTIALS' ? 'اسم المستخدم أو كلمة المرور غير صحيحة.' : (commonErrors[result.code] || commonErrors.AUTH_UNAVAILABLE));
                return;
            }
            if (result.mustChange) showSetup(result.username, password);
            else window.location.replace('/admin.html');
        } catch (err) { showError(error, commonErrors.AUTH_UNAVAILABLE); }
        finally { button.disabled = false; }
    });

    $('#setup-form').addEventListener('submit', async event => {
        event.preventDefault();
        const error = $('#setup-error');
        const button = $('#setup-submit');
        clearError(error);
        const newPassword = $('#setup-new-password').value;
        if (newPassword !== $('#setup-confirm-password').value) { showError(error, 'كلمتا المرور غير متطابقتين.'); return; }
        button.disabled = true;
        try {
            const { response, result } = await post('change', {
                username: $('#setup-username').value.trim(), currentPassword: $('#setup-current-password').value, newPassword
            });
            if (!response.ok) {
                if (result.code === 'NOT_AUTHENTICATED' || result.code === 'ACCOUNT_CHANGED') {
                    showLogin();
                    showError($('#login-error'), 'انتهت الجلسة. سجّل الدخول مجدداً.');
                    return;
                }
                const message = result.code === 'INVALID_CREDENTIALS' ? 'كلمة المرور الحالية غير صحيحة.' : (commonErrors[result.code] || 'تعذر حفظ بيانات الدخول. قد يكون التغيير قد تم؛ حاول تسجيل الدخول بالبيانات الجديدة.');
                showError(error, message);
                return;
            }
            window.location.replace('/admin.html');
        } catch (err) { showError(error, 'تعذر حفظ بيانات الدخول. قد يكون التغيير قد تم؛ حاول تسجيل الدخول بالبيانات الجديدة.'); }
        finally { button.disabled = false; }
    });

    $('#setup-logout').addEventListener('click', async event => {
        event.currentTarget.disabled = true;
        try {
            const { response } = await post('logout', {});
            if (!response.ok && response.status !== 401) throw new Error('logout');
            $('#setup-form').reset();
            clearError($('#setup-error'));
            showLogin();
            $('#login-username').focus();
        } catch (err) { showError($('#setup-error'), 'تعذر تسجيل الخروج. حاول مرة أخرى.'); }
        finally { event.currentTarget.disabled = false; }
    });

    (async function initialize() {
        try {
            const response = await fetch('/api/auth/session', { cache: 'no-store' });
            const session = await response.json();
            if (!response.ok) { showLogin(); showError($('#login-error'), commonErrors[session.code] || commonErrors.AUTH_UNAVAILABLE); }
            else if (session.authenticated && session.mustChange) showSetup(session.username);
            else if (session.authenticated) window.location.replace('/admin.html');
            else showLogin();
        } catch (error) { showLogin(); showError($('#login-error'), commonErrors.AUTH_UNAVAILABLE); }
    })();
})();
