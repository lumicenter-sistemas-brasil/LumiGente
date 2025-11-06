// Modal Module - Gerenciamento de modais
const Modal = {
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
    }
};
