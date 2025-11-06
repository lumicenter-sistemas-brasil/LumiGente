// Histórico Tab Module
const Historico = {
    manager: null,

    async load() {
        // Inicializar o HistoricoManager se ainda não foi inicializado
        if (!this.manager && typeof HistoricoManager !== 'undefined') {
            this.manager = new HistoricoManager();
        }
        
        // Verificar permissões
        await this.checkPermissions();
        
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
        const historicoContent = document.getElementById('historico-content');
        if (historicoContent) {
            if (!hasPermission) {
                historicoContent.innerHTML = `
                    <div class="card" style="text-align: center; padding: 60px 20px;">
                        <i class="fas fa-lock" style="font-size: 64px; color: #e5e7eb; margin-bottom: 24px;"></i>
                        <h3 style="color: #6b7280; margin-bottom: 12px;">Acesso Restrito</h3>
                        <p style="color: #9ca3af;">Você não tem permissão para acessar o histórico de feedbacks.</p>
                        <p style="color: #9ca3af; font-size: 14px; margin-top: 8px;">Esta funcionalidade está disponível apenas para RH e T&D.</p>
                    </div>
                `;
            }
        }
        
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
