// Avaliações - Formatter Module
const AvaliacoesFormatter = {
    formatarResposta(resposta, pergunta) {
        if (!resposta) return '<p style="margin: 0; color: #6b7280;">Não respondida</p>';
        
        switch (pergunta.TipoPergunta) {
            case 'multipla_escolha':
                if (!pergunta.Opcoes || pergunta.Opcoes.length === 0) {
                    return `<p style="margin: 0; color: #111827; font-weight: 500;">${resposta.Resposta}</p>`;
                }
                
                return `
                    <div style="display: flex; flex-direction: column; gap: 8px;">
                        ${pergunta.Opcoes.map(opcao => {
                            const selecionada = opcao.Id === resposta.OpcaoSelecionadaId || opcao.TextoOpcao === resposta.Resposta;
                            return `
                                <div style="padding: 10px 12px; border-radius: 6px; background: ${selecionada ? '#fff' : '#f9fafb'}; border: 2px solid ${selecionada ? '#0d556d' : '#e5e7eb'}; display: flex; align-items: center; gap: 8px;">
                                    ${selecionada ? '<i class="fas fa-check-circle" style="color: #10b981; font-size: 16px;"></i>' : '<i class="far fa-circle" style="color: #d1d5db; font-size: 16px;"></i>'}
                                    <span style="color: ${selecionada ? '#111827' : '#6b7280'}; font-weight: ${selecionada ? '600' : '400'};">${opcao.TextoOpcao}</span>
                                </div>
                            `;
                        }).join('')}
                    </div>
                `;
            
            case 'escala':
                const min = pergunta.EscalaMinima || 1;
                const max = pergunta.EscalaMaxima || 5;
                const valorSelecionado = parseInt(resposta.Resposta);
                const opcoes = [];
                
                for (let i = min; i <= max; i++) {
                    opcoes.push(i);
                }
                
                return `
                    <div style="display: flex; gap: 8px; flex-wrap: wrap;">
                        ${opcoes.map(valor => {
                            const selecionado = valor === valorSelecionado;
                            return `
                                <div style="flex: 1; min-width: 50px; padding: 12px 8px; border-radius: 6px; text-align: center; background: ${selecionado ? '#0d556d' : '#f9fafb'}; border: 2px solid ${selecionado ? '#0d556d' : '#e5e7eb'}; color: ${selecionado ? 'white' : '#6b7280'};">
                                    <div style="font-size: 20px; font-weight: 700; margin-bottom: 4px;">${valor}</div>
                                    ${valor === min && pergunta.EscalaLabelMinima ? 
                                        `<div style="font-size: 10px;">${pergunta.EscalaLabelMinima}</div>` : 
                                        valor === max && pergunta.EscalaLabelMaxima ? 
                                        `<div style="font-size: 10px;">${pergunta.EscalaLabelMaxima}</div>` : 
                                        ''}
                                </div>
                            `;
                        }).join('')}
                    </div>
                `;
            
            case 'sim_nao':
                const valorSimNao = resposta.Resposta;
                return `
                    <div style="display: flex; gap: 12px;">
                        <div style="flex: 1; padding: 12px; border-radius: 6px; text-align: center; background: ${valorSimNao === 'Sim' ? '#d1fae5' : '#f9fafb'}; border: 2px solid ${valorSimNao === 'Sim' ? '#10b981' : '#e5e7eb'}; color: ${valorSimNao === 'Sim' ? '#065f46' : '#6b7280'}; font-weight: 600;">
                            <i class="fas fa-check-circle" style="font-size: 18px; margin-right: 6px;"></i>
                            Sim
                        </div>
                        <div style="flex: 1; padding: 12px; border-radius: 6px; text-align: center; background: ${valorSimNao === 'Não' ? '#fee2e2' : '#f9fafb'}; border: 2px solid ${valorSimNao === 'Não' ? '#ef4444' : '#e5e7eb'}; color: ${valorSimNao === 'Não' ? '#991b1b' : '#6b7280'}; font-weight: 600;">
                            <i class="fas fa-times-circle" style="font-size: 18px; margin-right: 6px;"></i>
                            Não
                        </div>
                    </div>
                `;
            
            case 'texto':
            default:
                return `<p style="margin: 0; color: #111827; white-space: pre-wrap;">${resposta.Resposta}</p>`;
        }
    }
};
