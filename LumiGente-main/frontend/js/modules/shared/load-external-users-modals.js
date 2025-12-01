// Carrega os modais de usuários externos dinamicamente
(async function loadExternalUsersModals() {
    try {
        const response = await fetch('../pages/external-users-modals.html');
        const html = await response.text();
        
        // Cria um container temporário
        const container = document.createElement('div');
        container.innerHTML = html;
        
        // Adiciona os modais ao body
        document.body.appendChild(container);
    } catch (error) {
        console.error('Erro ao carregar modais de usuários externos:', error);
    }
})();
