# nodum — mapas mentais

Editor de mapas mentais em português, com React, TypeScript, Next.js 16 e React Flow. Os mapas ficam no PostgreSQL do Supabase, separados por usuário com Row Level Security (RLS), e o aplicativo pode ser hospedado na Vercel.

## Rodar localmente

Requer Node.js 22.13+ e pnpm 11. Copie `.env.example` para `.env.local`, preencha a chave publicável do projeto Supabase e execute:

```bash
pnpm install
pnpm dev
```

Abra `http://127.0.0.1:5173`. Para testar sem conta nem banco, altere `NEXT_PUBLIC_STORAGE_MODE=local`; nesse modo, os mapas são mantidos apenas no navegador. Ao entrar na versão com Supabase no mesmo navegador, o aplicativo importa automaticamente os mapas locais que ainda não existem na conta e conserva a cópia local como backup.

## Supabase

Projeto: `pzhsmwhoefxoedoamdao`. As migrações em `supabase/migrations/` criam `public.mind_maps` e políticas RLS: cada usuário autenticado acessa apenas seus mapas. Links de leitura usam um UUID aleatório; a política de leitura anônima exige o token no cabeçalho `x-share-token`, sem permitir listar os demais mapas. A aplicação usa somente a chave **publicável**. Nunca coloque a chave secreta ou `service_role` em variáveis `NEXT_PUBLIC_`.

Em Supabase → Authentication → URL Configuration, defina Site URL como `https://www.nodumapp.site` e inclua `https://www.nodumapp.site/auth/callback`, `https://www.nodumapp.site/auth/recovery`, `http://127.0.0.1:5173/auth/callback`, `http://127.0.0.1:5173/auth/recovery`, `http://localhost:5173/auth/callback` e `http://localhost:5173/auth/recovery` nos Redirect URLs. Mantenha URLs antigos somente se ainda precisar de links já enviados. O cadastro usa e-mail e senha, com confirmação por e-mail; também existem login por link e redefinição de senha. Google e GitHub ainda exigem credenciais OAuth próprias: configure os respectivos provedores no painel do Supabase e então defina `NEXT_PUBLIC_ENABLE_GOOGLE_AUTH=true` ou `NEXT_PUBLIC_ENABLE_GITHUB_AUTH=true` na Vercel. Os botões aparecem somente depois de habilitados. O callback do provedor é o endereço de Auth mostrado pelo Supabase.

## Vercel

Produção: https://www.nodumapp.site/. Repositório: https://github.com/BrunaBrauer/app-mapa-mental. O projeto **Next.js** está conectado à branch `main` e cada push inicia um deploy. As seguintes variáveis foram configuradas em Production e Preview:

```text
NEXT_PUBLIC_STORAGE_MODE=cloud
NEXT_PUBLIC_SUPABASE_URL=https://pzhsmwhoefxoedoamdao.supabase.co
NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY=<chave publicável do Supabase>
```

O build não depende de uma conexão direta ao PostgreSQL; as rotas de servidor usam o cliente Supabase com a sessão do usuário em cookies.

## Funcionalidades

- Canvas infinito com zoom, pan, grade, conexões e arraste de nós. O botão “Ajustar mapa à tela” fica ao lado dos layouts. Arrastar um dos quatro pontos do contorno até outro nó cria uma relação livre sem mudar a hierarquia.
- Menu contextual por nó para criar, editar, estilizar, anotar, comentar, anexar imagem/link, configurar tarefas e escolher 14 layouts com miniaturas. Layouts de subnós reorganizam somente o ramo. A edição de propriedades não usa uma barra lateral permanente.
- Ctrl+clique e Ctrl+arraste selecionam vários nós; o menu de grupo altera estilo e alinhamento em lote sem substituir textos ou notas individuais.
- Temas claro/escuro, modelos prontos, atalhos, histórico de desfazer/refazer, recolher ramos e organização automática.
- Salvamento automático, lista de mapas, duplicação, importação JSON e exportação PNG, PDF, Markdown e JSON.
- Compartilhamento público somente leitura por token.
- Integração manual com Google Drive para abrir/salvar cópias JSON e anexar arquivos, mediante credenciais OAuth próprias (`NEXT_PUBLIC_GOOGLE_*`). Não é sincronização automática.
- Cadastro e login por e-mail/senha, acesso por link e redefinição de senha.
- Sugestões Gemini para ideias, perguntas, resumo e SWOT, com revisão antes de salvar. A chave fica apenas no servidor.

## Ativar Google Drive e Gemini

O Google Drive precisa de um projeto Google Cloud próprio. Ative Google Picker API e Google Drive API, configure a tela de consentimento OAuth e crie um Client ID para aplicativo Web. Nas origens JavaScript autorizadas, adicione `https://www.nodumapp.site` e `http://localhost:5173`. Preencha `NEXT_PUBLIC_GOOGLE_CLIENT_ID` com o Client ID, `NEXT_PUBLIC_GOOGLE_API_KEY` com uma chave de API restrita às origens e APIs necessárias, e `NEXT_PUBLIC_GOOGLE_APP_ID` com o **número** do projeto. Configure essas variáveis na Vercel e no `.env.local` de desenvolvimento, depois faça novo deploy. O escopo usado é `drive.file`; o usuário escolhe cada arquivo pelo seletor e pode salvar uma cópia JSON. O Drive não é o banco de dados do app.

Para a IA, crie uma chave no Google AI Studio e defina `GEMINI_API_KEY` apenas nas variáveis de **servidor** da Vercel e em `.env.local`. Não use o prefixo `NEXT_PUBLIC_` nessa chave. A rota `/api/ai` exige sessão Supabase, limita a entrada, aplica um intervalo mínimo de cinco segundos entre solicitações por usuário e usa `gemini-3.5-flash-lite`. A limitação em memória é apenas uma proteção inicial por instância; antes de grande volume, adote rate limiting compartilhado e cotas de custo no Google Cloud. A IA recebe o título do mapa e o texto do nó selecionado; evite incluir dados confidenciais nesses campos se não quiser enviá-los ao Google.

Confirmação de e-mail e recuperação de senha dependem dos Redirect URLs do Supabase acima. O serviço de e-mail padrão do Supabase tem cotas reduzidas; configure SMTP próprio antes de abrir cadastro para muitos usuários.

## Regras de edição

- O texto de cada nó é salvo como texto simples para buscas e exportações, acompanhado dos trechos com negrito, itálico, sublinhado, riscado e cor do grifo. No menu contextual de texto, selecione uma palavra ou frase antes de usar os botões de formatação parcial. Os controles gerais de fonte, cor e alinhamento atingem o nó inteiro. O sublinhado usa um afastamento visual de 4 px.
- Novos nós usam fundo branco, contorno preto e nenhum ícone, salvo quando há estilo padrão ou referência de nível definida pelo usuário. O menu rápido separa texto, nó e linha; as quatro cores rápidas podem ser refinadas por código hexadecimal (sem controles RGB). Ícones favoritos ficam salvos no próprio mapa e aparecem em outros dispositivos que abrirem esse mapa.
- Largura, altura mínima e padding são medidas em pixels, limitadas no menu para evitar caixas ilegíveis. Sem valor explícito, o nó usa o tamanho automático. O contorno aceita cor, padrão e espessura de 0 a 20 px.
- “Repetir estilo neste nível” aplica tamanho, formatação ou ambos aos outros filhos do mesmo pai já existentes e registra esse estilo para filhos criados depois. Os filhos de outros pais e descendentes mais profundos não mudam. O estilo padrão do mapa vale para novos nós quando não houver referência de nível. Modelos salvos pertencem ao mapa e aparecem no menu do nó.
- A linha hierárquica é configurada pelo nó filho. “Aplicar esta linha a todo o nível” atualiza os irmãos e os novos filhos do mesmo pai. Arrastar um ponto de conexão de um nó até outro cria uma relação livre sem alterar a árvore; origem e chegada preservam os lados escolhidos. Clicar na relação abre seu menu flutuante. O limite visual inclui o nó selecionado e seus descendentes visíveis; ramos recolhidos permanecem no grupo, mas não ocupam área no canvas.
- Seleção múltipla: Ctrl+clique alterna um nó, Ctrl+arraste ou Shift+arraste a partir do fundo seleciona os nós tocados pelo retângulo e substitui a seleção anterior, Ctrl+A seleciona os nós visíveis e Escape limpa. Edição em lote atinge apenas propriedades compartilháveis; exclusão remove ramos selecionados, preservando o nó central. Alinhamento ativa o layout livre.
- Os comandos de copiar, recortar e colar ramos usam a área de transferência interna do editor. Atalhos: `Ctrl+C`, `Ctrl+X`, `Ctrl+V`, `Ctrl+Shift+C` para copiar formatação, `Ctrl+Alt+V` para colar formatação, `Ctrl+D` para duplicar, `Ctrl+L` para iniciar uma relação, `Tab` para criar filho, `Enter` para irmão e `Delete` para excluir.

As regras de produto e os critérios funcionais e não funcionais estão em [docs/REGRAS_E_REQUISITOS.md](docs/REGRAS_E_REQUISITOS.md).

## Verificação

```bash
pnpm exec tsc --noEmit
pnpm exec eslint app components lib proxy.ts
pnpm build
```

As fontes importadas pelo usuário ficam no IndexedDB do navegador. O mapa é sincronizado entre dispositivos, mas para exibir uma fonte personalizada em outro aparelho ela precisa ser importada também nele. Imagens anexadas são reduzidas antes de serem incluídas no JSON do mapa.

## Importação e Google Drive

- Importar JSON ou Mindomo (.mom) está no menu Exportar. No menu Drive, importe .json/.mom ou exporte uma cópia .nodum.json. Cada importação cria um mapa privado novo; cada exportação cria um arquivo novo, sem sobrescrever o original. O Drive é um fluxo manual de arquivos, não sincronização contínua.
- .mom: suporte à estrutura XML Mindomo version-3.6 e JSON com topics/subTopics. Converte texto, hierarquia, notas e links HTTP(S) compatíveis; organiza à direita. Estilos, anexos, tarefas e relações não são convertidos. Pacotes comprimidos/.pmom não são suportados. Validar com arquivos reais antes de prometer fidelidade total.
- Limites: 5 MB por importação/exportação Drive, 2.000 nós, 100 níveis para Mindomo e 1.000 caracteres por tópico. Arquivos inválidos não substituem mapas existentes.
- OAuth do Drive usa drive.file; a credencial é reutilizada até expirar apenas em memória, sem persistência em localStorage. Fechar a janela ou negar acesso permite nova tentativa. É necessário validar importação/exportação com a conta Google autorizada em produção.
- O menu de nó usa coordenadas da tela e rolagem interna, independente do zoom do canvas. Durante o arraste ele fica oculto e volta ao soltar. Nós parados mantêm suas referências e não reiniciam animações a cada movimento.

Teste do importador: `node scripts/test-import.mjs`.

## Preferências da conta

Tema, grade, barra lateral e exibição automática do menu são gravados em `nodum_preferences` nos metadados do usuário autenticado no Supabase. Não são usados para autorização. A última gravação prevalece; outro dispositivo carrega as preferências ao abrir/recarregar o editor. As gravações são serializadas após 350 ms de inatividade e falhas aparecem no editor. No modo local de testes, as preferências ficam no navegador. Fontes personalizadas continuam armazenadas apenas no navegador onde foram importadas.

Teste das rotas com serviços simulados: `node scripts/test-preferences-ai.mjs`. Uma chamada real Gemini exige sessão autenticada e `GEMINI_API_KEY` na Vercel (sem prefixo público); o deploy deve ser refeito após adicionar a variável. O uso pode consumir a cota/crédito do projeto Google.
