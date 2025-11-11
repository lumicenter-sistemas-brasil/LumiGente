// Histórico - Permissions Module
const HistoricoPermissions = {
    verificarPermissaoUsuario(usuario) {
        if (!usuario) return false;

        const cachedPermissions = window.cachedTabPermissions || usuario.permissions || usuario._cachedPermissions || {};

        if (typeof cachedPermissions.historico !== 'undefined') {
            return Boolean(cachedPermissions.historico);
        }

        const permissoesLista = usuario.permissoes || usuario.Permissoes || [];
        if (Array.isArray(permissoesLista)) {
            const normalized = permissoesLista.map(item => (typeof item === 'string' ? item.toLowerCase() : ''));
            if (normalized.includes('historico') || normalized.includes('rh') || normalized.includes('treinamento')) {
                return true;
            }
        }

        if (usuario.historico === true || usuario.canAccessHistorico === true) {
            return true;
        }

        const departamento = (
            usuario.descricaoDepartamento ||
            usuario.DescricaoDepartamento ||
            usuario.departamento ||
            usuario.Departamento ||
            ''
        ).toString().toUpperCase().trim();

        const setoresAutorizados = [
            'RH',
            'RECURSOS HUMANOS',
            'DEPARTAMENTO RH',
            'DEPARTAMENTO TREINAM&DESENVOLV',
            'TREINAMENTO',
            'T&D',
            'COORDENACAO ADM/RH/SESMT MAO',
            'DEPARTAMENTO ADM/RH/SESMT'
        ];

        const temPermissao = setoresAutorizados.some(setor => departamento.includes(setor)) ||
               usuario.role === 'Administrador' || 
               usuario.is_admin === true;

        return temPermissao;
    },

    mostrarErroPermissao() {
        console.warn('[Historico] Acesso negado para o usuário atual.');
    },

    exibirConteudoPermitido() {
        // Sem ação específica; mantemos a aba renderizada normalmente.
    },

    iniciarMonitoramento(verificarPermissao) {
        const observer = new MutationObserver((mutations) => {
            mutations.forEach((mutation) => {
                if (mutation.type === 'attributes' && mutation.attributeName === 'style') {
                    const target = mutation.target;
                    if (target.getAttribute('data-tab') === 'historico') {
                        if (verificarPermissao()) this.exibirConteudoPermitido();
                        else this.mostrarErroPermissao();
                    }
                }
            });
        });

        const historicoTab = document.querySelector('[data-tab="historico"]');
        if (historicoTab) {
            observer.observe(historicoTab, { attributes: true, attributeFilter: ['style', 'class'] });
        }

        setInterval(() => {
            const tab = document.querySelector('[data-tab="historico"]');
            if (tab && window.getComputedStyle(tab).display !== 'none') {
                if (verificarPermissao()) this.exibirConteudoPermitido();
                else this.mostrarErroPermissao();
            }
        }, 2000);
    }
};
