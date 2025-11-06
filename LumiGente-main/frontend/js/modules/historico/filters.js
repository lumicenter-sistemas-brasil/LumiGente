// Histórico - Filters Module
const HistoricoFilters = {
    extrairAnosDaData(valorData) {
        const anos = [];
        const matchAnos = valorData.match(/20[0-9]{2}/g);
        if (matchAnos) anos.push(...matchAnos);
        
        const matchDataCompleta = valorData.match(/\d{1,2}[\/\-]\d{1,2}[\/\-](20\d{2})/);
        if (matchDataCompleta) anos.push(matchDataCompleta[1]);
        
        const matchDataISO = valorData.match(/(20\d{2})\-\d{1,2}\-\d{1,2}/);
        if (matchDataISO) anos.push(matchDataISO[1]);
        
        const matchMesAno = valorData.match(/\d{1,2}[\/\-](20\d{2})/);
        if (matchMesAno) anos.push(matchMesAno[1]);
        
        const matchAnoSozinho = valorData.match(/^(20\d{2})$/);
        if (matchAnoSozinho) anos.push(matchAnoSozinho[1]);
        
        const matchAnoTexto = valorData.match(/\b(20\d{2})\b/);
        if (matchAnoTexto) anos.push(matchAnoTexto[1]);
        
        return [...new Set(anos)].filter(ano => {
            const anoNum = parseInt(ano);
            return anoNum >= 2020 && anoNum <= 2030;
        });
    },

    itemContemAno(item, ano) {
        const possiveisColunasData = [
            'Data', 'data', 'Data Admissão', 'Data de Nascimento', 'Data de Cadastro',
            'Último Acesso', 'Data do turnover', 'Data Ínicio', 'Data Final',
            'Data de criação', 'Última atualização', 
            'Período inicial avaliado da última avaliação de desempenho',
            'Período final avaliado da última avaliação de desempenho'
        ];
        
        for (let coluna of possiveisColunasData) {
            if (item[coluna]) {
                const valorData = item[coluna].toString().trim();
                if (valorData && valorData !== '-' && valorData !== 'N/A') {
                    const anosEncontrados = this.extrairAnosDaData(valorData);
                    if (anosEncontrados.includes(ano)) return true;
                }
            }
        }
        return false;
    },

    filtrarDados(dados, tipoSecao, filtrosAtivos) {
        let dadosFiltrados = [...dados];

        if (filtrosAtivos.departamento !== 'todos') {
            dadosFiltrados = dadosFiltrados.filter(item => {
                const possiveisColunasDep = ['Departamento', 'departamento', 'Para Departamento', 'Depto', 'Setor'];
                for (let coluna of possiveisColunasDep) {
                    if (item[coluna]) {
                        const valorDep = item[coluna].toString().toLowerCase();
                        if (valorDep.includes(filtrosAtivos.departamento.toLowerCase())) return true;
                    }
                }
                return false;
            });
        }

        if (filtrosAtivos.periodo !== 'todos') {
            dadosFiltrados = dadosFiltrados.filter(item => this.itemContemAno(item, filtrosAtivos.periodo));
        }

        return dadosFiltrados;
    },

    carregarDepartamentos(dadosHistorico) {
        const select = document.getElementById('historico-departamento');
        if (!select) return;

        const opcoesPadrao = select.querySelector('option[value="todos"]');
        select.innerHTML = '';
        if (opcoesPadrao) {
            select.appendChild(opcoesPadrao);
        } else {
            const optionTodos = document.createElement('option');
            optionTodos.value = 'todos';
            optionTodos.textContent = 'Todos os Departamentos';
            select.appendChild(optionTodos);
        }

        const departamentosSet = new Set();
        Object.values(dadosHistorico).forEach(dadosSecao => {
            const dados = dadosSecao.dados || dadosSecao;
            if (Array.isArray(dados)) {
                dados.forEach(item => {
                    const possiveisColunasDep = ['Departamento', 'departamento', 'Para Departamento', 'Depto', 'Setor'];
                    possiveisColunasDep.forEach(coluna => {
                        if (item[coluna] && item[coluna].toString().trim()) {
                            departamentosSet.add(item[coluna].toString().trim());
                        }
                    });
                });
            }
        });

        Array.from(departamentosSet).sort().forEach(dept => {
            const option = document.createElement('option');
            option.value = dept.toLowerCase();
            option.textContent = dept;
            select.appendChild(option);
        });
    },

    carregarPeriodos(dadosHistorico) {
        const select = document.getElementById('historico-periodo');
        if (!select) return;

        const opcoesPadrao = select.querySelector('option[value="todos"]');
        select.innerHTML = '';
        if (opcoesPadrao) {
            select.appendChild(opcoesPadrao);
        } else {
            const optionTodos = document.createElement('option');
            optionTodos.value = 'todos';
            optionTodos.textContent = 'Todos os Períodos';
            select.appendChild(optionTodos);
        }

        const anosSet = new Set();
        Object.values(dadosHistorico).forEach(dadosSecao => {
            const dados = dadosSecao.dados || dadosSecao;
            if (Array.isArray(dados)) {
                dados.forEach(item => {
                    const possiveisColunasData = [
                        'Data', 'data', 'Data Admissão', 'Data de Nascimento', 'Data de Cadastro',
                        'Último Acesso', 'Data do turnover', 'Data Ínicio', 'Data Final',
                        'Data de criação', 'Última atualização'
                    ];
                    possiveisColunasData.forEach(coluna => {
                        if (item[coluna]) {
                            const valorData = item[coluna].toString().trim();
                            if (valorData && valorData !== '-' && valorData !== 'N/A') {
                                const anosEncontrados = this.extrairAnosDaData(valorData);
                                anosEncontrados.forEach(ano => anosSet.add(ano));
                            }
                        }
                    });
                });
            }
        });

        Array.from(anosSet).sort((a, b) => b - a).forEach(ano => {
            const option = document.createElement('option');
            option.value = ano;
            option.textContent = ano;
            select.appendChild(option);
        });
    }
};
