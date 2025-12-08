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
            'closeDeleteObjetivoModal': () => {
                if (window.Objetivos && typeof Objetivos.closeDeleteModal === 'function') {
                    Objetivos.closeDeleteModal();
                }
            },
            'cancelDeleteObjetivo': () => {
                if (window.Objetivos && typeof Objetivos.closeDeleteModal === 'function') {
                    Objetivos.closeDeleteModal();
                }
            },
            'confirmDeleteObjetivo': () => {
                if (window.Objetivos && typeof Objetivos.confirmDelete === 'function') {
                    Objetivos.confirmDelete();
                }
            },
            
            // PDIs
            'closePDIDetalhesModal': () => {
                if (window.PDIs && typeof PDIs.closeDetalhesModal === 'function') {
                    PDIs.closeDetalhesModal();
                }
            },
            'closePDICheckinModal': () => {
                if (window.PDIs && typeof PDIs.closeCheckinModal === 'function') {
                    PDIs.closeCheckinModal();
                }
            },
            'cancelPDICheckin': () => {
                if (window.PDIs && typeof PDIs.closeCheckinModal === 'function') {
                    PDIs.closeCheckinModal();
                }
            },
            'submitPDICheckin': () => {
                if (window.PDIs && typeof PDIs.submitCheckin === 'function') {
                    PDIs.submitCheckin();
                }
            },
            'closePDIApprovalModal': () => {
                if (window.PDIs && typeof PDIs.closeApprovalModal === 'function') {
                    PDIs.closeApprovalModal();
                }
            },
            'confirmApprovePDI': () => {
                if (window.PDIs && typeof PDIs.confirmApprove === 'function') {
                    PDIs.confirmApprove();
                }
            },

            // Pesquisas
            'clearSurveyFilters': () => typeof clearSurveyFilters === 'function' && clearSurveyFilters(),
            'closePesquisaModal': () => typeof closePesquisaModal === 'function' && closePesquisaModal(),
            'submitPesquisa': () => typeof submitPesquisa === 'function' && submitPesquisa(),
            'closeResponderPesquisaModal': () => typeof closeResponderPesquisaModal === 'function' && closeResponderPesquisaModal(),
            'submitRespostaPesquisa': () => typeof submitRespostaPesquisa === 'function' && submitRespostaPesquisa(),
            'closeVerRespostasModal': () => typeof closeVerRespostasModal === 'function' && closeVerRespostasModal(),

            // Avaliações
            'abrirModalEditarQuestionarios': () => {
                if (typeof AvaliacoesTemplates !== 'undefined' && typeof AvaliacoesTemplates.abrirModalEdicao === 'function') {
                    AvaliacoesTemplates.abrirModalEdicao();
                }
            },
            'toggleAvaliacoesView': () => typeof toggleAvaliacoesView === 'function' && toggleAvaliacoesView(param),
            'fecharModalEditarQuestionarios': () => {
                if (typeof AvaliacoesTemplates !== 'undefined' && typeof AvaliacoesTemplates.fecharModalEdicao === 'function') {
                    AvaliacoesTemplates.fecharModalEdicao();
                }
            },
            'selecionarTemplateEdicao': () => {
                if (typeof AvaliacoesTemplates !== 'undefined' && typeof AvaliacoesTemplates.selecionarTemplate === 'function') {
                    AvaliacoesTemplates.selecionarTemplate(param);
                }
            },
            'adicionarNovaPergunta': () => {
                if (typeof AvaliacoesTemplates !== 'undefined' && typeof AvaliacoesTemplates.abrirModalNovaPergunta === 'function') {
                    AvaliacoesTemplates.abrirModalNovaPergunta();
                }
            },
            'salvarQuestionario': () => {
                if (typeof AvaliacoesTemplates !== 'undefined' && typeof AvaliacoesTemplates.salvarAlteracoes === 'function') {
                    AvaliacoesTemplates.salvarAlteracoes();
                }
            },
            'fecharModalResponderAvaliacao': () => {
                if (typeof Avaliacoes !== 'undefined' && typeof Avaliacoes.closeModal === 'function') {
                    Avaliacoes.closeModal();
                } else if (typeof fecharModalResponderAvaliacao === 'function') {
                    fecharModalResponderAvaliacao();
                }
            },
            'trocarAbaAvaliacao': () => typeof trocarAbaAvaliacao === 'function' && trocarAbaAvaliacao(param),
            'enviarRespostasAvaliacao': () => typeof enviarRespostasAvaliacao === 'function' && enviarRespostasAvaliacao(),
            'fecharModalReabrirAvaliacao': () => typeof fecharModalReabrirAvaliacao === 'function' && fecharModalReabrirAvaliacao(),
            'reabrirAvaliacao': () => typeof reabrirAvaliacao === 'function' && reabrirAvaliacao(),
            'fecharModalEditarPergunta': () => {
                const modal = document.getElementById('editar-pergunta-modal');
                if (modal) modal.classList.add('hidden');
            },
            'adicionarOpcao': () => {
                const container = document.getElementById('opcoes-multipla-escolha');
                if (!container) return;
                const count = container.querySelectorAll('.opcao-item').length + 1;
                const div = document.createElement('div');
                div.className = 'opcao-item';
                div.innerHTML = `
                    <input type="text" class="form-input" placeholder="Opção ${count}" />
                    <button type="button" class="btn btn-danger btn-sm" onclick="this.parentElement.remove()">
                        <i data-lucide="x"></i>
                    </button>
                `;
                container.appendChild(div);
                if (window.lucide) window.lucide.createIcons();
            },
            'salvarPergunta': async () => {
                const templateAtivo = document.querySelector('.btn-template-selector.active');
                const tipo = templateAtivo ? templateAtivo.dataset.template : '45';
                const perguntaId = document.getElementById('pergunta-id-edicao').value;
                
                const dados = {
                    pergunta: document.getElementById('pergunta-texto').value,
                    tipoPergunta: document.getElementById('pergunta-tipo').value,
                    obrigatoria: document.getElementById('pergunta-obrigatoria').checked ? 1 : 0
                };
                
                if (dados.tipoPergunta === 'escala') {
                    dados.escalaMinima = parseInt(document.getElementById('escala-minima').value) || 1;
                    dados.escalaMaxima = parseInt(document.getElementById('escala-maxima').value) || 5;
                    dados.escalaLabelMinima = document.getElementById('escala-label-min').value;
                    dados.escalaLabelMaxima = document.getElementById('escala-label-max').value;
                }
                
                try {
                    if (perguntaId) {
                        await API.put(`/api/avaliacoes/templates/${tipo}/perguntas/${perguntaId}`, dados);
                    } else {
                        await API.post(`/api/avaliacoes/templates/${tipo}/perguntas`, dados);
                    }
                    
                    document.getElementById('editar-pergunta-modal').classList.add('hidden');
                    document.querySelector('[data-action="selecionarTemplateEdicao"][data-param="' + tipo + '"]').click();
                } catch (error) {
                    console.error('Erro ao salvar pergunta:', error);
                    alert('Erro ao salvar pergunta');
                }
            },

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
    
    // Setup drag and drop for questions
    window.setupDragAndDrop = function() {
        const container = document.getElementById('lista-perguntas-edicao');
        if (!container) return;
        
        let draggedElement = null;
        let autoScrollInterval = null;
        
        container.addEventListener('dragstart', (e) => {
            if (e.target.classList.contains('pergunta-item')) {
                draggedElement = e.target;
                e.target.style.opacity = '0.5';
            }
        });
        
        container.addEventListener('dragend', (e) => {
            if (e.target.classList.contains('pergunta-item')) {
                e.target.style.opacity = '1';
            }
            if (autoScrollInterval) {
                clearInterval(autoScrollInterval);
                autoScrollInterval = null;
            }
        });
        
        container.addEventListener('dragover', (e) => {
            e.preventDefault();
            
            const rect = container.getBoundingClientRect();
            const scrollZone = 50;
            const scrollSpeed = 10;
            
            if (autoScrollInterval) {
                clearInterval(autoScrollInterval);
                autoScrollInterval = null;
            }
            
            if (e.clientY < rect.top + scrollZone) {
                autoScrollInterval = setInterval(() => {
                    container.scrollTop -= scrollSpeed;
                }, 50);
            } else if (e.clientY > rect.bottom - scrollZone) {
                autoScrollInterval = setInterval(() => {
                    container.scrollTop += scrollSpeed;
                }, 50);
            }
            
            const afterElement = getDragAfterElement(container, e.clientY);
            if (afterElement == null) {
                container.appendChild(draggedElement);
            } else {
                container.insertBefore(draggedElement, afterElement);
            }
        });
        
        function getDragAfterElement(container, y) {
            const draggableElements = [...container.querySelectorAll('.pergunta-item:not(.dragging)')];
            
            return draggableElements.reduce((closest, child) => {
                if (child === draggedElement) return closest;
                const box = child.getBoundingClientRect();
                const offset = y - box.top - box.height / 2;
                
                if (offset < 0 && offset > closest.offset) {
                    return { offset: offset, element: child };
                } else {
                    return closest;
                }
            }, { offset: Number.NEGATIVE_INFINITY }).element;
        }
    };
});
