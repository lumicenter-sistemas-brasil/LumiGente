// Users Module - Gerenciamento de usuários
const Users = {
    async load() {
        try {
            const users = await API.get('/api/users/feedback');
            State.setUsers(users);
            this.updateSelects();
        } catch (error) {
            console.error('Erro ao carregar usuários:', error);
        }
    },

    updateSelects() {
        const users = State.getUsers();
        const currentUser = State.getUser();

        this.updateSelect('feedback-to-user-list', users, currentUser, 'feedback-to-user');
        this.updateSelect('recognition-to-user-list', users, currentUser, 'recognition-to-user');
        this.updateSelect('objetivo-responsavel-list', users, currentUser, 'objetivo-responsavel');
    },

    updateSelect(listId, users, currentUser, inputId) {
        const list = document.getElementById(listId);
        if (!list) return;

        const placeholder = inputId.includes('objetivo') ? 
            'Selecionar responsável...' : 
            'Selecionar colaborador...';

        list.innerHTML = `<div class="select-option" data-value="" onclick="Users.select('', '${placeholder}', '${inputId}')">${placeholder}</div>`;
        
        users.forEach(user => {
            if (user.userId !== currentUser.userId) {
                const nomeCompleto = user.nomeCompleto || user.NomeCompleto || 'Nome não informado';
                const departamento = user.descricaoDepartamento || user.DescricaoDepartamento || user.departamento || user.Departamento || 'Departamento não informado';
                list.innerHTML += `<div class="select-option" data-value="${user.userId}" onclick="Users.select('${user.userId}', '${nomeCompleto} - ${departamento}', '${inputId}')">${nomeCompleto} - ${departamento}</div>`;
            }
        });
    },

    filter(searchId, listId) {
        const searchInput = document.getElementById(searchId);
        const list = document.getElementById(listId);
        const searchTerm = searchInput.value.toLowerCase();

        list.querySelectorAll('.select-option').forEach(option => {
            const text = option.textContent.toLowerCase();
            option.style.display = text.includes(searchTerm) ? 'block' : 'none';
        });

        list.classList.add('show');
    },

    select(value, text, inputId) {
        const input = document.getElementById(inputId);
        const searchInput = document.getElementById(inputId + '-search');
        const list = document.getElementById(inputId + '-list');

        input.value = value;
        if (searchInput) {
            searchInput.value = value ? text : '';
        }

        list.classList.remove('show');
    }
};

// Global functions for onclick handlers
function filterUsers(searchId, listId) {
    Users.filter(searchId, listId);
}

function selectUser(value, text, inputId) {
    Users.select(value, text, inputId);
}
