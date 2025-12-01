// Avaliações - Loader Module
const AvaliacoesLoader = {
    async carregarQuestionario(avaliacao) {
        const container = document.getElementById('formulario-avaliacao');
        container.innerHTML = '<div class="loading"><div class="spinner"></div>Carregando questionário...</div>';
        
        try {
            const tipo = avaliacao.TipoAvaliacao.includes('45') ? '45' : '90';
            const response = await fetch(`/api/avaliacoes/${avaliacao.Id}/respostas`);
            if (!response.ok) throw new Error('Erro ao carregar questionário');
            
            const dadosRespostas = await response.json();
            const perguntas = dadosRespostas.perguntas;
            AvaliacoesRenderer.renderizarQuestionario(perguntas, tipo);
            
        } catch (error) {
            console.error('Erro ao carregar questionário:', error);
            container.innerHTML = `
                <div style="text-align: center; padding: 40px; color: #ef4444;">
                    <i data-lucide="alert-circle" style="width: 48px; height: 48px; margin-bottom: 16px;"></i>
                    <h4>Erro ao carregar questionário</h4>
                    <p>${error.message}</p>
                </div>
            `;
            if (window.lucide && typeof window.lucide.createIcons === 'function') {
                window.lucide.createIcons({ attrs: { 'stroke-width': 2 } });
            }
        }
    },

    async carregarRespostas(avaliacaoId) {
        const container = document.getElementById('respostas-avaliacao');
        container.innerHTML = '<div class="loading"><div class="spinner"></div>Carregando respostas...</div>';
        
        try {
            const response = await fetch(`/api/avaliacoes/${avaliacaoId}/respostas`);
            if (!response.ok) throw new Error('Erro ao carregar respostas');
            
            const dados = await response.json();
            AvaliacoesRenderer.renderizarRespostas(dados);
            
        } catch (error) {
            console.error('Erro ao carregar respostas:', error);
            container.innerHTML = `
                <div style="text-align: center; padding: 40px; color: #ef4444;">
                    <i data-lucide="alert-circle" style="width: 48px; height: 48px; margin-bottom: 16px;"></i>
                    <h4>Erro ao carregar respostas</h4>
                    <p>${error.message}</p>
                </div>
            `;
            if (window.lucide && typeof window.lucide.createIcons === 'function') {
                window.lucide.createIcons({ attrs: { 'stroke-width': 2 } });
            }
        }
    }
};

// Funções globais para compatibilidade
function carregarQuestionarioAvaliacao(avaliacao) {
    AvaliacoesLoader.carregarQuestionario(avaliacao);
}

function carregarRespostasAvaliacao(avaliacaoId) {
    AvaliacoesLoader.carregarRespostas(avaliacaoId);
}

function trocarAbaAvaliacao(aba) {
    if (Avaliacoes && typeof Avaliacoes.switchTab === 'function') {
        Avaliacoes.switchTab(aba);
        if (aba === 'visualizar' && Avaliacoes.state?.avaliacaoAtual?.Id) {
            carregarRespostasAvaliacao(Avaliacoes.state.avaliacaoAtual.Id);
        }
    }
}
