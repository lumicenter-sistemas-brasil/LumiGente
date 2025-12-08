
// Global Router for Adicionar Opção
window.routerAdicionarOpcao = function () {
    const modal = document.getElementById('modal-pergunta-avaliacao');
    const mode = modal.getAttribute('data-mode');



    if (mode === 'avaliacao') {
        Avaliacoes.adicionarOpcaoAvaliacao();
    } else {
        AvaliacoesTemplates.adicionarOpcao();
    }
};
