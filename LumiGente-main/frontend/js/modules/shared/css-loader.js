// Load non-critical CSS
const nonCriticalCSS = [
    '../styles/feedbacks.css',
    '../styles/recognitions.css',
    '../styles/team.css',
    '../styles/analytics.css',
    '../styles/humor.css',
    '../styles/objetivos.css',
    '../styles/pesquisas.css',
    '../styles/avaliacoes.css',
    '../styles/historico.css',
    '../styles/configuracoes.css',
    '../styles/feedback-chat.css',
    '../styles/responsive.css',
    '../styles/index.css'
];

nonCriticalCSS.forEach(href => {
    const link = document.createElement('link');
    link.rel = 'stylesheet';
    link.href = href;
    document.head.appendChild(link);
});
