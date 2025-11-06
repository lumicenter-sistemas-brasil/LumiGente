// Global event handlers
document.addEventListener('DOMContentLoaded', () => {
    // Sidebar overlay
    const sidebarOverlay = document.getElementById('sidebar-overlay');
    if (sidebarOverlay) {
        sidebarOverlay.addEventListener('click', () => {
            if (typeof toggleSidebar === 'function') toggleSidebar();
        });
    }

    // Sidebar close button
    const sidebarCloseBtn = document.querySelector('.sidebar-close-btn');
    if (sidebarCloseBtn) {
        sidebarCloseBtn.addEventListener('click', () => {
            if (typeof toggleSidebar === 'function') toggleSidebar();
        });
    }

    // Sidebar toggle button
    const sidebarToggleBtn = document.querySelector('.sidebar-toggle');
    if (sidebarToggleBtn) {
        sidebarToggleBtn.addEventListener('click', () => {
            if (typeof toggleSidebar === 'function') toggleSidebar();
        });
    }

    // Notifications button
    const notificationsBtn = document.getElementById('notifications-btn');
    if (notificationsBtn) {
        notificationsBtn.addEventListener('click', () => {
            if (typeof NotificationsManager !== 'undefined') NotificationsManager.toggleDropdown();
        });
    }

    // Mark all as read button
    const markAllReadBtn = document.querySelector('.mark-all-read-btn');
    if (markAllReadBtn) {
        markAllReadBtn.addEventListener('click', () => {
            if (typeof NotificationsManager !== 'undefined') NotificationsManager.markAllAsRead();
        });
    }

    // Logout button
    const logoutBtns = document.querySelectorAll('[title="Logout"]');
    logoutBtns.forEach(btn => {
        btn.addEventListener('click', () => {
            if (typeof logout === 'function') logout();
        });
    });

    // Configurações - Password reset buttons (Sistema Novo)
    const requestResetBtn = document.querySelector('#password-reset-initial .btn-amber');
    if (requestResetBtn) {
        requestResetBtn.addEventListener('click', () => {
            if (typeof Configuracoes !== 'undefined') Configuracoes.requestPasswordReset();
        });
    }

    const initiatePasswordChangeBtn = document.getElementById('initiate-password-change-btn');
    if (initiatePasswordChangeBtn) {
        initiatePasswordChangeBtn.addEventListener('click', () => {
            if (typeof Configuracoes !== 'undefined') Configuracoes.initiatePasswordChange();
        });
    }

    const cancelInitialPasswordBtn = document.getElementById('cancel-initial-password-btn');
    if (cancelInitialPasswordBtn) {
        cancelInitialPasswordBtn.addEventListener('click', () => {
            if (typeof Configuracoes !== 'undefined') Configuracoes.cancelReset();
        });
    }

    const verifyTokenBtn = document.querySelector('#password-reset-token-input .btn-amber');
    if (verifyTokenBtn) {
        verifyTokenBtn.addEventListener('click', () => {
            if (typeof Configuracoes !== 'undefined') Configuracoes.verifyToken();
        });
    }

    const cancelTokenBtn = document.getElementById('cancel-token-btn');
    if (cancelTokenBtn) {
        cancelTokenBtn.addEventListener('click', () => {
            if (typeof Configuracoes !== 'undefined') Configuracoes.cancelReset();
        });
    }
});
