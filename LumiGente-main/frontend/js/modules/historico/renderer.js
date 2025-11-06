// Histórico - Renderer Module
const HistoricoRenderer = {
    renderizarTabela(tipoSecao, dados, container, paginacao, filtrosAtivos) {
        const dadosProcessados = dados.dados || dados;
        const metadados = dados.metadados || {};
        const colunas = metadados.colunas || (dadosProcessados.length > 0 ? Object.keys(dadosProcessados[0]) : []);
        
        const dadosFiltrados = HistoricoFilters.filtrarDados(dadosProcessados, tipoSecao, filtrosAtivos);
        
        if (dadosFiltrados.length === 0) {
            container.innerHTML = `
                <div class="historico-empty">
                    <i class="fas fa-inbox"></i>
                    <h4>Nenhum dado encontrado</h4>
                    <p>Não há dados para exibir com os filtros selecionados.</p>
                </div>
            `;
            return;
        }

        const dadosPaginados = this.paginarDados(dadosFiltrados, paginacao);
        const precisaScroll = colunas.length > 6;
        const classeScroll = precisaScroll ? 'table-scroll-horizontal' : '';

        let html = `
            <div class="table-wrapper ${classeScroll}">
                <table class="historico-table">
                    <thead>
                        <tr>
                            ${colunas.map(col => `<th>${col}</th>`).join('')}
                        </tr>
                    </thead>
                    <tbody>
        `;

        dadosPaginados.forEach(item => {
            html += '<tr>';
            colunas.forEach(col => {
                const valor = item[col] || '';
                html += `<td>${valor}</td>`;
            });
            html += '</tr>';
        });

        html += `
                    </tbody>
                </table>
            </div>
        `;

        html += this.renderizarPaginacao(dadosFiltrados.length, tipoSecao, paginacao);
        container.innerHTML = html;
    },

    paginarDados(dados, paginacao) {
        const inicio = (paginacao.paginaAtual - 1) * paginacao.itensPorPagina;
        const fim = inicio + paginacao.itensPorPagina;
        return dados.slice(inicio, fim);
    },

    renderizarPaginacao(totalItens, tipoSecao, paginacao) {
        const totalPaginas = Math.ceil(totalItens / paginacao.itensPorPagina);
        if (totalPaginas <= 1) return '';

        const paginaAtual = paginacao.paginaAtual;
        const inicio = (paginaAtual - 1) * paginacao.itensPorPagina + 1;
        const fim = Math.min(paginaAtual * paginacao.itensPorPagina, totalItens);

        let html = `
            <div class="pagination-container">
                <div class="pagination-info">
                    Mostrando ${inicio}-${fim} de ${totalItens} registros
                </div>
                <div class="pagination-controls">
        `;

        if (paginaAtual > 1) {
            html += `<button class="pagination-btn" onclick="irParaPagina('${tipoSecao}', ${paginaAtual - 1})">
                <i class="fas fa-chevron-left"></i> Anterior
            </button>`;
        }

        const inicioPagina = Math.max(1, paginaAtual - 2);
        const fimPagina = Math.min(totalPaginas, paginaAtual + 2);

        if (inicioPagina > 1) {
            html += `<button class="pagination-btn" onclick="irParaPagina('${tipoSecao}', 1)">1</button>`;
            if (inicioPagina > 2) html += `<span class="pagination-ellipsis">...</span>`;
        }

        for (let i = inicioPagina; i <= fimPagina; i++) {
            const classeAtiva = i === paginaAtual ? 'active' : '';
            html += `<button class="pagination-btn ${classeAtiva}" onclick="irParaPagina('${tipoSecao}', ${i})">${i}</button>`;
        }

        if (fimPagina < totalPaginas) {
            if (fimPagina < totalPaginas - 1) html += `<span class="pagination-ellipsis">...</span>`;
            html += `<button class="pagination-btn" onclick="irParaPagina('${tipoSecao}', ${totalPaginas})">${totalPaginas}</button>`;
        }

        if (paginaAtual < totalPaginas) {
            html += `<button class="pagination-btn" onclick="irParaPagina('${tipoSecao}', ${paginaAtual + 1})">
                Próximo <i class="fas fa-chevron-right"></i>
            </button>`;
        }

        html += `
                </div>
            </div>
        `;

        return html;
    }
};
