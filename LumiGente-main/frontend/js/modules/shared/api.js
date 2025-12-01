// API Module - Centraliza todas as chamadas HTTP
const API = {
    async get(url, params = {}) {
        const queryString = new URLSearchParams(params).toString();
        const fullUrl = queryString ? `${url}?${queryString}` : url;
        const response = await fetch(fullUrl, { credentials: 'include' });
        if (!response.ok) {
            let data = null;
            try { data = await response.json(); } catch (_) { /* ignore */ }
            if (response.status === 401) {
                try { sessionStorage.setItem('lastAuthError', Date.now().toString()); } catch (_) {}
                window.location.href = '/pages/login.html';
                return Promise.reject(new Error('Usuário não autenticado'));
            }
            const error = new Error(data && (data.message || data.error) ? (data.message || data.error) : `HTTP ${response.status}`);
            error.status = response.status;
            error.data = data;
            throw error;
        }
        return response.json();
    },

    async post(url, data) {
        console.log('📤 [API] POST Request:', url, data);
        const response = await fetch(url, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            credentials: 'include',
            body: JSON.stringify(data)
        });
        console.log('📥 [API] POST Response status:', response.status);
        if (!response.ok) {
            let respData = null;
            try { respData = await response.json(); } catch (_) { /* ignore */ }
            if (response.status === 401) {
                try { sessionStorage.setItem('lastAuthError', Date.now().toString()); } catch (_) {}
                window.location.href = '/pages/login.html';
                return Promise.reject(new Error('Usuário não autenticado'));
            }
            const error = new Error(respData && (respData.message || respData.error) ? (respData.message || respData.error) : `HTTP ${response.status}`);
            error.status = response.status;
            error.data = respData;
            throw error;
        }
        return response.json();
    },

    async put(url, data) {
        const response = await fetch(url, {
            method: 'PUT',
            headers: { 'Content-Type': 'application/json' },
            credentials: 'include',
            body: JSON.stringify(data)
        });
        if (!response.ok) {
            let respData = null;
            try { respData = await response.json(); } catch (_) { /* ignore */ }
            if (response.status === 401) {
                try { sessionStorage.setItem('lastAuthError', Date.now().toString()); } catch (_) {}
                window.location.href = '/pages/login.html';
                return Promise.reject(new Error('Usuário não autenticado'));
            }
            const error = new Error(respData && (respData.message || respData.error) ? (respData.message || respData.error) : `HTTP ${response.status}`);
            error.status = response.status;
            error.data = respData;
            throw error;
        }
        return response.json();
    },

    async delete(url) {
        const response = await fetch(url, {
            method: 'DELETE',
            credentials: 'include'
        });
        if (!response.ok) {
            let respData = null;
            try { respData = await response.json(); } catch (_) { /* ignore */ }
            if (response.status === 401) {
                try { sessionStorage.setItem('lastAuthError', Date.now().toString()); } catch (_) {}
                window.location.href = '/pages/login.html';
                return Promise.reject(new Error('Usuário não autenticado'));
            }
            const error = new Error(respData && (respData.message || respData.error) ? (respData.message || respData.error) : `HTTP ${response.status}`);
            error.status = response.status;
            error.data = respData;
            throw error;
        }
        return response.json();
    }
};
