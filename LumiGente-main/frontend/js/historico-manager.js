/**
 * Histórico Manager - Orquestrador principal
 * Usa módulos auxiliares para funcionalidades específicas
 */

class HistoricoManager {
    constructor() {
        this.dadosHistorico = {};
        this.filtrosAtivos = { periodo: 'todos', tipo: 'todos', departamento: 'todos' };
        this.paginacao = { paginaAtual: 1, itensPorPagina: 50, totalItens: 0 };
        this.cacheManager = window.CacheManager ? new window.CacheManager() : null;
        this.init();
    }

    init() {
        this.setupEventListeners();
        this.verificarPermissoes();
        this.inicializarSecoesFechadas();
    }

    inicializarSecoesFechadas() {
        document.querySelectorAll('.historico-section').forEach(secao => secao.classList.add('collapsed'));
    }

    setupEventListeners() {
        document.addEventListener('click', (e) => {
            if (e.target.closest('[data-tab="historico"]')) this.carregarDadosHistorico();
            if (e.target.closest('.historico-section .card-header')) this.toggleSecao(e.target.closest('.historico-section'));
        });

        ['historico-periodo', 'historico-tipo', 'historico-departamento'].forEach(id => {
            const elemento = document.getElementById(id);
            if (elemento) elemento.addEventListener('change', () => this.aplicarFiltros());
        });

        this.iniciarMonitoramentoSeguranca();
    }

    verificarPermissoes() {
        const usuarioAtual = this.obterUsuarioAtual();
        const temPermissao = HistoricoPermissions.verificarPermissaoUsuario(usuarioAtual);
        const historicoTab = document.getElementById('historico-tab');
        if (historicoTab) historicoTab.style.display = temPermissao ? 'flex' : 'none';
    }

    obterUsuarioAtual() {
        return window.currentUser || { id: 1, nome: 'Usuário Teste', departamento: 'RH', cargo: 'Analista de RH', permissoes: ['rh', 'treinamento'] };
    }

    iniciarMonitoramentoSeguranca() {
        HistoricoPermissions.iniciarMonitoramento(() => {
            const usuarioAtual = this.obterUsuarioAtual();
            return HistoricoPermissions.verificarPermissaoUsuario(usuarioAtual);
        });
    }

    async carregarDadosHistorico() {
        try {
            const usuarioAtual = this.obterUsuarioAtual();
            if (!HistoricoPermissions.verificarPermissaoUsuario(usuarioAtual)) {
                HistoricoPermissions.mostrarErroPermissao();
                return;
            }

            if (this.cacheManager) {
                const dadosCache = this.cacheManager.obterDadosHistorico('todos', this.filtrosAtivos);
                if (dadosCache) {
                    this.dadosHistorico = dadosCache;
                    HistoricoFilters.carregarDepartamentos(this.dadosHistorico);
                    HistoricoFilters.carregarPeriodos(this.dadosHistorico);
                    this.aplicarFiltros();
                    return;
                }
            }
            
            await this.simularCarregamentoDados();
            
            if (this.cacheManager) {
                this.cacheManager.armazenarDadosHistorico('todos', this.dadosHistorico, this.filtrosAtivos);
            }
            
            HistoricoFilters.carregarDepartamentos(this.dadosHistorico);
            HistoricoFilters.carregarPeriodos(this.dadosHistorico);
            this.aplicarFiltros();
        } catch (error) {
            console.error('Erro ao carregar dados históricos:', error);
        }
    }

    async simularCarregamentoDados() {
        try {
            const response = await fetch('/api/historico/dados', {
                method: 'GET',
                headers: { 'Content-Type': 'application/json' }
            });
            
            if (!response.ok) {
                if (response.status === 403) {
                    HistoricoPermissions.mostrarErroPermissao();
                    return;
                }
                throw new Error(`Erro HTTP: ${response.status}`);
            }
            
            const resultado = await response.json();
            
            if (resultado.success && resultado.dados) {
                this.dadosHistorico = resultado.dados;
                console.log('✅ Dados históricos carregados do backend');
            } else {
                console.warn('⚠️ Backend não retornou dados');
                this.dadosHistorico = {};
            }
            
        } catch (error) {
            console.error('❌ Erro ao carregar dados do backend:', error);
            HistoricoExport.mostrarNotificacao('Erro ao carregar dados históricos do servidor', 'error');
            this.dadosHistorico = {};
        }
    }

    aplicarFiltros() {
        this.filtrosAtivos.periodo = document.getElementById('historico-periodo')?.value || 'todos';
        this.filtrosAtivos.tipo = document.getElementById('historico-tipo')?.value || 'todos';
        this.filtrosAtivos.departamento = document.getElementById('historico-departamento')?.value || 'todos';
        this.atualizarExibicao();
    }

    atualizarExibicao() {
        const secoes = document.querySelectorAll('.historico-section');
        secoes.forEach(secao => {
            const tipoSecao = secao.getAttribute('data-tipo');
            const deveExibir = this.filtrosAtivos.tipo === 'todos' || this.filtrosAtivos.tipo === tipoSecao;
            
            if (deveExibir) {
                secao.classList.remove('hidden');
                this.carregarDadosSecao(tipoSecao);
            } else {
                secao.classList.add('hidden');
            }
        });
    }

    carregarDadosSecao(tipoSecao) {
        const dados = this.dadosHistorico[tipoSecao];
        if (!dados) return;

        const loadingElement = document.getElementById(`${tipoSecao}-loading`);
        const tableElement = document.getElementById(`${tipoSecao}-table`);

        if (loadingElement) loadingElement.style.display = 'none';
        if (tableElement) {
            tableElement.style.display = 'block';
            HistoricoRenderer.renderizarTabela(tipoSecao, dados, tableElement, this.paginacao, this.filtrosAtivos);
        }
    }

    irParaPagina(tipoSecao, pagina) {
        this.paginacao.paginaAtual = pagina;
        const dados = this.dadosHistorico[tipoSecao];
        if (dados) {
            const container = document.getElementById(`${tipoSecao}-table`);
            if (container) {
                HistoricoRenderer.renderizarTabela(tipoSecao, dados, container, this.paginacao, this.filtrosAtivos);
            }
        }
    }

    toggleSecao(secao) {
        secao.classList.toggle('collapsed');
    }

    exportHistoricoData(tipoSecao) {
        HistoricoExport.exportarDados(tipoSecao, this.dadosHistorico, this.filtrosAtivos);
    }
}

// Funções globais para compatibilidade
window.loadHistoricoData = function() {
    if (window.historicoManager) window.historicoManager.aplicarFiltros();
};

window.exportHistoricoData = function(tipoSecao) {
    if (window.historicoManager) window.historicoManager.exportHistoricoData(tipoSecao);
};

window.irParaPagina = function(tipoSecao, pagina) {
    if (window.historicoManager) window.historicoManager.irParaPagina(tipoSecao, pagina);
};

document.addEventListener('DOMContentLoaded', function() {
    window.historicoManager = new HistoricoManager();
});