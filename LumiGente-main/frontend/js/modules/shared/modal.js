// Modal Module - Gerenciamento de modais
window.Modal = {
    open(modalId) {
        const modal = document.getElementById(modalId);
        if (modal) modal.classList.remove('hidden');
    },

    close(modalId) {
        const modal = document.getElementById(modalId);
        if (modal) {
            this.clearFields(modalId);
            modal.classList.add('hidden');
        }
    },

    clearFields(modalId) {
        const modal = document.getElementById(modalId);
        if (!modal) return;

        modal.querySelectorAll('input[type="text"], input[type="email"], input[type="number"], input[type="date"], input[type="datetime-local"], textarea').forEach(el => {
            el.value = '';
        });

        modal.querySelectorAll('select').forEach(el => {
            el.selectedIndex = 0;
        });

        modal.querySelectorAll('.badge-option').forEach(el => {
            el.classList.remove('selected');
        });
    },

    closeAll() {
        document.querySelectorAll('.modal-overlay:not(.hidden)').forEach(modal => {
            modal.classList.add('hidden');
        });
    },

    closeTopmost() {
        const openModals = Array.from(document.querySelectorAll('.modal-overlay:not(.hidden)'));
        if (openModals.length > 0) {
            // Encontrar o modal com maior z-index (o que está por cima)
            let topModal = openModals[0];
            let maxZIndex = parseInt(window.getComputedStyle(topModal).zIndex) || 0;
            
            for (let i = 1; i < openModals.length; i++) {
                const zIndex = parseInt(window.getComputedStyle(openModals[i]).zIndex) || 0;
                if (zIndex > maxZIndex) {
                    maxZIndex = zIndex;
                    topModal = openModals[i];
                }
            }
            
            topModal.classList.add('hidden');
        }
    }
};

// Listener global para ESC - fecha apenas o modal mais recente
document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape') {
        e.preventDefault();
        e.stopPropagation();
        Modal.closeTopmost();
    }
}, true);
