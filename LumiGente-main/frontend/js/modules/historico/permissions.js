// Histórico - Permissions Module
const HistoricoPermissions = {
    verificarPermissaoUsuario(usuario) {
        if (!usuario) return false;
        
        const departamento = usuario.departamento?.toUpperCase().trim() || '';
        const setoresAutorizados = [
            'RH',
            'DEPARTAMENTO TREINAM&DESENVOLV',
            'COORDENACAO ADM/RH/SESMT MAO',
            'DEPARTAMENTO ADM/RH/SESMT'
        ];
        
        return setoresAutorizados.some(setor => departamento.includes(setor)) ||
               usuario.role === 'Administrador' || 
               usuario.is_admin;
    },

    mostrarErroPermissao() {
        const container = document.getElementById('historico-content');
        if (container) {
            container.innerHTML = `
                <div class="card" style="text-align: center; padding: 60px 20px;">
                    <i class="fas fa-lock" style="font-size: 64px; color: #e5e7eb; margin-bottom: 24px;"></i>
                    <h3 style="color: #6b7280; margin-bottom: 12px;">Acesso Restrito</h3>
                    <p style="color: #9ca3af;">Você não tem permissão para acessar o histórico de feedbacks.</p>
                    <p style="color: #9ca3af; font-size: 14px; margin-top: 8px;">Esta funcionalidade está disponível apenas para RH e T&D.</p>
                </div>
            `;
        }
        
        const historicoTab = document.querySelector('[data-tab="historico"]');
        if (historicoTab) historicoTab.style.display = 'none';
    },

    iniciarMonitoramento(verificarPermissao) {
        const observer = new MutationObserver((mutations) => {
            mutations.forEach((mutation) => {
                if (mutation.type === 'attributes' && mutation.attributeName === 'style') {
                    const target = mutation.target;
                    if (target.getAttribute('data-tab') === 'historico' && !verificarPermissao()) {
                        target.style.display = 'none';
                        this.mostrarErroPermissao();
                    }
                }
            });
        });

        const historicoTab = document.querySelector('[data-tab="historico"]');
        if (historicoTab) {
            observer.observe(historicoTab, { attributes: true, attributeFilter: ['style', 'class'] });
        }

        setInterval(() => {
            if (!verificarPermissao()) {
                const tab = document.querySelector('[data-tab="historico"]');
                if (tab && window.getComputedStyle(tab).display !== 'none') {
                    tab.style.display = 'none';
                    this.mostrarErroPermissao();
                }
            }
        }, 2000);
    }
};
