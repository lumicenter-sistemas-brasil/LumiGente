// Load XLSX library lazily
const xlsxScript = document.createElement('script');
xlsxScript.src = 'https://cdnjs.cloudflare.com/ajax/libs/xlsx/0.18.5/xlsx.full.min.js';
xlsxScript.defer = true;
requestIdleCallback(() => document.head.appendChild(xlsxScript), { timeout: 3000 });
