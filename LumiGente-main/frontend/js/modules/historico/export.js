// Histórico - Export Module
const HistoricoExport = {
    escapeCSV(value) {
        if (value === null || value === undefined) return '';
        const str = String(value);
        if (str.includes(',') || str.includes('\n') || str.includes('\r') || str.includes('"')) {
            return '"' + str.replace(/"/g, '""') + '"';
        }
        return str;
    },

    exportarDados(tipoSecao, dadosHistorico, filtrosAtivos) {
        const dados = dadosHistorico[tipoSecao];
        if (!dados) {
            this.mostrarNotificacao('Nenhum dado disponível para exportar', 'warning');
            return;
        }

        const dadosProcessados = dados.dados || dados;
        const metadados = dados.metadados || {};
        
        if (!dadosProcessados || dadosProcessados.length === 0) {
            this.mostrarNotificacao('Nenhum dado disponível para exportar', 'warning');
            return;
        }

        try {
            const dadosFiltrados = HistoricoFilters.filtrarDados(dadosProcessados, tipoSecao, filtrosAtivos);
            const colunas = metadados.colunas || (dadosProcessados.length > 0 ? Object.keys(dadosProcessados[0]) : []);
            
            let csv = '\uFEFF';
            csv += colunas.map(col => this.escapeCSV(col)).join(',') + '\n';
            
            dadosFiltrados.forEach(item => {
                const linha = colunas.map(col => {
                    const valor = item[col] || '';
                    return this.escapeCSV(valor);
                }).join(',');
                csv += linha + '\n';
            });

            const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
            const link = document.createElement('a');
            const url = URL.createObjectURL(blob);
            link.setAttribute('href', url);
            
            const agora = new Date();
            const dataHora = agora.toISOString().replace(/[:.]/g, '-').split('T')[0] + '_' + 
                           agora.toTimeString().split(' ')[0].replace(/:/g, '-');
            link.setAttribute('download', `historico_${tipoSecao}_${dataHora}.csv`);
            
            link.style.visibility = 'hidden';
            document.body.appendChild(link);
            link.click();
            document.body.removeChild(link);
            
            setTimeout(() => URL.revokeObjectURL(url), 100);
            this.mostrarNotificacao(`Dados de ${tipoSecao} exportados com sucesso! (${dadosFiltrados.length} registros)`, 'success');
            
        } catch (error) {
            console.error('Erro ao exportar dados:', error);
            this.mostrarNotificacao('Erro ao exportar dados', 'error');
        }
    },

    mostrarNotificacao(mensagem, tipo = 'info') {
        const notificacaoAnterior = document.querySelector('.historico-notification');
        if (notificacaoAnterior) notificacaoAnterior.remove();

        const notificacao = document.createElement('div');
        notificacao.className = `historico-notification historico-notification-${tipo}`;
        notificacao.innerHTML = `
            <i class="fas fa-${tipo === 'success' ? 'check-circle' : tipo === 'warning' ? 'exclamation-triangle' : tipo === 'error' ? 'times-circle' : 'info-circle'}"></i>
            <span>${mensagem}</span>
        `;

        document.body.appendChild(notificacao);
        setTimeout(() => {
            if (notificacao.parentNode) notificacao.remove();
        }, 3000);
    }
};
