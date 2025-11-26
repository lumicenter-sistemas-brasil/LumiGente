Siga uma arquitetura de frontend moderna, escalável e modularizada baseada em Atomic Design.

### Estrutura de Pastas
- Cada aba/tela deve ter seu próprio CSS (ex: dashboard.css, settings.css).
- Elementos globais (sidebar, header, notificações, footer) também devem ter CSS próprio.
- Crie um arquivo `index.css` contendo todas as variáveis globais de cor, espaçamento e tipografia.
- Utilize a seguinte hierarquia dentro de `frontend/src/components`:
    - atoms/
    - molecules/
    - organisms/
    - templates/
    - pages/

### Variáveis e Unidades
- Use **somente variáveis globais** definidas no `index.css` para cores e espaçamentos.
- Utilize **REM** para espaçamento, tamanho de fonte e dimensões — nunca PX.
- Caso uma nova cor ou espaçamento seja necessário, defina-o **apenas no index.css**.
- Nomeie as variáveis de forma padronizada:
    --color-primary, --color-secondary, --color-bg, --space-xs, --space-sm, etc.

### Ícones e Elementos Visuais
- Utilize **somente Lucide Icons**.
- É proibido o uso de **Font Awesome**, **emojis** ou ícones rasterizados.
- Componentize elementos visuais repetitivos (botões, inputs, modais, etc.) para reutilização e padronização.

### Segurança e Boas Práticas
- É **proibido** o uso de estilos inline (`style="..."`) ou scripts inline (`onclick="..."`).
- Todos os estilos devem estar em arquivos `.css` e todos os scripts em `.js` separados.
- Garanta separação de responsabilidades para melhorar segurança e manutenção.

### Responsividade
- Todas as telas e componentes devem ser **totalmente responsivos** para desktop, tablet e mobile.
- Utilize **unidades relativas** (`rem`, `%`, `vw`, `vh`) e **media queries** consistentes.
- Teste layouts em diferentes resoluções antes do commit.

### Organização e Manutenção
- Mantenha os arquivos curtos, claros e bem comentados.
- Prefira nomes de classes consistentes (seguindo BEM ou padrão similar).
- Elimine CSS redundante e remova estilos não utilizados.
- Centralize estilos globais e evite duplicação de regras.