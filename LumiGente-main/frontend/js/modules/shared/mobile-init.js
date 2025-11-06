// Mobile sidebar initialization
if (window.innerWidth <= 768) {
    document.addEventListener('DOMContentLoaded', function() {
        const sidebar = document.getElementById('sidebar');
        const mainContent = document.querySelector('.main-content');
        if (sidebar && mainContent) {
            sidebar.classList.add('hidden');
            mainContent.classList.add('expanded');
        }
    });
}

// RequestIdleCallback polyfill
window.requestIdleCallback = window.requestIdleCallback || function(cb, opts) {
    const start = Date.now();
    return setTimeout(() => cb({ didTimeout: false, timeRemaining: () => Math.max(0, 50 - (Date.now() - start)) }), 1);
};
