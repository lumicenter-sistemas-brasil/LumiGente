// Histórico Tab Module
const Historico = {
    manager: null,

    async load() {
        // Inicializar o HistoricoManager se ainda não foi inicializado
        if (!this.manager && typeof HistoricoManager !== 'undefined') {
            this.manager = new HistoricoManager();
        }
        
        // Verificar permissões
        const hasPermission = await this.checkPermissions();
        if (!hasPermission) {
            return;
        }

        // Carregar dados se tiver permissão
        if (this.manager) {
            this.manager.aplicarFiltros();
        }
    },

    async checkPermissions() {
        const user = State.getUser();
        if (!user) return false;
        
        const departamento = user.departamento?.toUpperCase().trim() || '';
        const setoresAutorizados = [
            'RH',
            'DEPARTAMENTO TREINAM&DESENVOLV',
            'COORDENACAO ADM/RH/SESMT MAO',
            'DEPARTAMENTO ADM/RH/SESMT'
        ];
        
        const hasPermission = setoresAutorizados.some(setor => departamento.includes(setor));
        
        // Mostrar/ocultar conteúdo baseado na permissão
        return hasPermission;
    },

    exportData(tipoSecao) {
        if (this.manager) {
            this.manager.exportHistoricoData(tipoSecao);
        }
    },

    applyFilters() {
        if (this.manager) {
            this.manager.aplicarFiltros();
        }
    },

    goToPage(tipoSecao, pagina) {
        if (this.manager) {
            this.manager.irParaPagina(tipoSecao, pagina);
        }
    }
};

// Global functions for onclick compatibility
function loadHistoricoData() {
    Historico.applyFilters();
}

function exportHistoricoData(tipoSecao) {
    Historico.exportData(tipoSecao);
}

function irParaPagina(tipoSecao, pagina) {
    Historico.goToPage(tipoSecao, pagina);
}

function clearHistoricoFilters() {
    if (!Historico.manager && window.historicoManager) {
        Historico.manager = window.historicoManager;
    }
    if (!Historico.manager && typeof HistoricoManager !== 'undefined') {
        Historico.manager = new HistoricoManager();
    }
    if (Historico.manager) {
        Historico.manager.resetFiltros();
    }
}
