// Centralized inline event handlers replacement
document.addEventListener('DOMContentLoaded', () => {
    // Event delegation for all onclick handlers
    document.body.addEventListener('click', (e) => {
        const target = e.target.closest('[data-action]');
        if (!target) return;

        const action = target.getAttribute('data-action');
        const param = target.getAttribute('data-param');

        // Map actions to functions
        const actions = {
            // Quick actions
            'toggleQuickActionsDropdown': () => typeof toggleQuickActionsDropdown === 'function' && toggleQuickActionsDropdown(),
            'openFeedbackModal': () => {
                if (typeof setQuickActionValue === 'function') setQuickActionValue(target.getAttribute('data-label') || 'Enviar Feedback');
                if (typeof openFeedbackModal === 'function') openFeedbackModal();
                if (typeof closeQuickActionsDropdown === 'function') closeQuickActionsDropdown();
            },
            'openRecognitionModal': () => {
                if (typeof setQuickActionValue === 'function') setQuickActionValue(target.getAttribute('data-label') || 'Reconhecer Colega');
                if (typeof openRecognitionModal === 'function') openRecognitionModal();
                if (typeof closeQuickActionsDropdown === 'function') closeQuickActionsDropdown();
            },
            'openNewObjetivoModal': () => {
                if (typeof setQuickActionValue === 'function') setQuickActionValue(target.getAttribute('data-label') || 'Novo Objetivo');
                if (typeof openNewObjetivoModal === 'function') openNewObjetivoModal();
                if (typeof closeQuickActionsDropdown === 'function') closeQuickActionsDropdown();
            },
            
            // Feedback
            'switchFeedbackTab': () => typeof switchFeedbackTab === 'function' && switchFeedbackTab(param),
            'clearFeedbackFilters': () => typeof clearFeedbackFilters === 'function' && clearFeedbackFilters(),
            'toggleFilters': () => typeof toggleFilters === 'function' && toggleFilters(param),
            'closeFeedbackModal': () => typeof closeFeedbackModal === 'function' && closeFeedbackModal(),
            'submitFeedback': () => typeof submitFeedback === 'function' && submitFeedback(),
            'selectUser': () => typeof selectUser === 'function' && selectUser('', '', param),
            
            // Recognition
            'clearRecognitionFilters': () => typeof clearRecognitionFilters === 'function' && clearRecognitionFilters(),
            'closeRecognitionModal': () => typeof closeRecognitionModal === 'function' && closeRecognitionModal(),
            'submitRecognition': () => typeof submitRecognition === 'function' && submitRecognition(),
            
            // Team
            'selectTeamUser': () => typeof selectTeamUser === 'function' && selectTeamUser('', param),
            'clearTeamFilters': () => typeof clearTeamFilters === 'function' && clearTeamFilters(),
            
            // Analytics
            'loadAnalytics': () => typeof loadAnalytics === 'function' && loadAnalytics(),
            'exportReport': () => typeof exportReport === 'function' && exportReport(param),
            
            // Humor
            'submitHumor': () => typeof submitHumor === 'function' && submitHumor(),
            
            // Objetivos
            'closeObjetivoModal': () => typeof closeObjetivoModal === 'function' && closeObjetivoModal(),
            'submitObjetivo': () => typeof submitObjetivo === 'function' && submitObjetivo(),
            
            // Pesquisas
            'clearSurveyFilters': () => typeof clearSurveyFilters === 'function' && clearSurveyFilters(),
            'closePesquisaModal': () => typeof closePesquisaModal === 'function' && closePesquisaModal(),
            'submitPesquisa': () => typeof submitPesquisa === 'function' && submitPesquisa(),
            'closeResponderPesquisaModal': () => typeof closeResponderPesquisaModal === 'function' && closeResponderPesquisaModal(),
            'submitRespostaPesquisa': () => typeof submitRespostaPesquisa === 'function' && submitRespostaPesquisa(),
            'closeVerRespostasModal': () => typeof closeVerRespostasModal === 'function' && closeVerRespostasModal(),
            
            // Avaliações
            'abrirModalEditarQuestionarios': () => typeof abrirModalEditarQuestionarios === 'function' && abrirModalEditarQuestionarios(),
            'toggleAvaliacoesView': () => typeof toggleAvaliacoesView === 'function' && toggleAvaliacoesView(param),
            'fecharModalEditarQuestionarios': () => typeof fecharModalEditarQuestionarios === 'function' && fecharModalEditarQuestionarios(),
            'selecionarTemplateEdicao': () => typeof selecionarTemplateEdicao === 'function' && selecionarTemplateEdicao(param),
            'adicionarNovaPergunta': () => typeof adicionarNovaPergunta === 'function' && adicionarNovaPergunta(),
            'salvarQuestionario': () => typeof salvarQuestionario === 'function' && salvarQuestionario(),
            'fecharModalResponderAvaliacao': () => typeof fecharModalResponderAvaliacao === 'function' && fecharModalResponderAvaliacao(),
            'trocarAbaAvaliacao': () => typeof trocarAbaAvaliacao === 'function' && trocarAbaAvaliacao(param),
            'enviarRespostasAvaliacao': () => typeof enviarRespostasAvaliacao === 'function' && enviarRespostasAvaliacao(),
            'fecharModalReabrirAvaliacao': () => typeof fecharModalReabrirAvaliacao === 'function' && fecharModalReabrirAvaliacao(),
            'reabrirAvaliacao': () => typeof reabrirAvaliacao === 'function' && reabrirAvaliacao(),
            'fecharModalEditarPergunta': () => typeof fecharModalEditarPergunta === 'function' && fecharModalEditarPergunta(),
            'adicionarOpcao': () => typeof adicionarOpcao === 'function' && adicionarOpcao(),
            'salvarPergunta': () => typeof salvarPergunta === 'function' && salvarPergunta(),
            
            // Histórico
            'exportHistoricoData': () => typeof exportHistoricoData === 'function' && exportHistoricoData(param),
            
            // Window actions
            'openWindow': () => window.open(param, '_blank', target.getAttribute('data-features') || '')
        };

        if (actions[action]) {
            e.preventDefault();
            actions[action]();
        }
    });

    // Handle onchange for selects
    document.body.addEventListener('change', (e) => {
        if (e.target.id === 'historico-periodo' || e.target.id === 'historico-tipo' || e.target.id === 'historico-departamento') {
            if (typeof loadHistoricoData === 'function') loadHistoricoData();
        }
    });
});
