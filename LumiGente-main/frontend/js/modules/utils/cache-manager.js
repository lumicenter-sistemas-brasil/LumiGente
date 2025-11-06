// Cache Manager - movido de cache-manager.js
class CacheManager {
    constructor() {
        this.cache = {};
        this.ttl = 5 * 60 * 1000; // 5 minutos
    }

    obterDadosHistorico(tipo, filtros) {
        const chave = `historico_${tipo}_${JSON.stringify(filtros)}`;
        const item = this.cache[chave];
        
        if (!item) return null;
        if (Date.now() > item.expira) {
            delete this.cache[chave];
            return null;
        }
        
        return item.dados;
    }

    armazenarDadosHistorico(tipo, dados, filtros) {
        const chave = `historico_${tipo}_${JSON.stringify(filtros)}`;
        this.cache[chave] = {
            dados: dados,
            expira: Date.now() + this.ttl
        };
    }

    limpar() {
        this.cache = {};
    }
}

window.CacheManager = CacheManager;
