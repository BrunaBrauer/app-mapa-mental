# Mindora — mapas mentais

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

O Site URL do Supabase Auth está configurado como `https://app-mapa-mental.vercel.app`. Os URLs de retorno permitidos são `http://127.0.0.1:5173/auth/callback` e `https://app-mapa-mental.vercel.app/auth/callback`. O login por e-mail usa links mágicos. Google e GitHub ainda exigem credenciais OAuth próprias: configure os respectivos provedores no painel do Supabase e então defina `NEXT_PUBLIC_ENABLE_GOOGLE_AUTH=true` ou `NEXT_PUBLIC_ENABLE_GITHUB_AUTH=true` na Vercel. Os botões aparecem somente depois de habilitados. O callback do provedor é o endereço de Auth mostrado pelo Supabase.

## Vercel

Produção: https://app-mapa-mental.vercel.app. Repositório: https://github.com/BrunaBrauer/app-mapa-mental. O projeto **Next.js** está conectado à branch `main` e cada push inicia um deploy. As seguintes variáveis foram configuradas em Production e Preview:

```text
NEXT_PUBLIC_STORAGE_MODE=cloud
NEXT_PUBLIC_SUPABASE_URL=https://pzhsmwhoefxoedoamdao.supabase.co
NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY=<chave publicável do Supabase>
```

O build não depende de uma conexão direta ao PostgreSQL; as rotas de servidor usam o cliente Supabase com a sessão do usuário em cookies.

## Funcionalidades

- Canvas infinito com zoom, pan, grade, minimapa, conexões e arraste de nós.
- Menu contextual por nó para criar, editar, estilizar, anotar, comentar, anexar imagem/link, configurar tarefas e escolher 14 layouts com miniaturas. Layouts de subnós reorganizam somente o ramo.
- Temas claro/escuro, modelos prontos, atalhos, histórico de desfazer/refazer, recolher ramos e organização automática.
- Salvamento automático, lista de mapas, duplicação, importação JSON e exportação PNG, PDF, Markdown e JSON.
- Compartilhamento público somente leitura por token.
- Integração manual com Google Drive para abrir/salvar cópias JSON e anexar arquivos, mediante credenciais OAuth próprias (`NEXT_PUBLIC_GOOGLE_*`). Não é sincronização automática.

## Regras de edição

- O texto de cada nó é salvo como texto simples para buscas e exportações, acompanhado dos trechos com negrito, itálico, sublinhado, riscado e cor do grifo. No painel direito, selecione uma palavra ou frase antes de usar os botões de formatação parcial. Os controles gerais de fonte, cor e alinhamento atingem o nó inteiro. O sublinhado usa um afastamento visual de 3 px.
- Largura, altura mínima e padding são medidas em pixels, limitadas no painel para evitar caixas ilegíveis. Sem valor explícito, o nó usa o tamanho automático. A borda aceita cor, padrão e espessura de 0 a 20 px.
- “Repetir estilo neste nível” aplica tamanho, formatação ou ambos aos outros filhos do mesmo pai já existentes e registra esse estilo para filhos criados depois. Os filhos de outros pais e descendentes mais profundos não mudam. O estilo padrão do mapa vale para novos nós quando não houver referência de nível. Modelos salvos pertencem ao mapa e aparecem no painel do nó.
- A linha hierárquica é configurada pelo nó filho. “Aplicar esta linha a todo o nível” atualiza os irmãos e os novos filhos do mesmo pai. Uma relação livre conecta dois nós sem alterar a árvore; clicar nessa linha abre seu painel próprio. O limite visual inclui o nó selecionado e seus descendentes visíveis; ramos recolhidos permanecem no grupo, mas não ocupam área no canvas.
- Os comandos de copiar, recortar e colar ramos usam a área de transferência interna do editor. Atalhos: `Ctrl+C`, `Ctrl+X`, `Ctrl+V`, `Ctrl+Shift+C` para copiar formatação, `Ctrl+Alt+V` para colar formatação, `Ctrl+D` para duplicar, `Ctrl+L` para iniciar uma relação, `Tab` para criar filho, `Enter` para irmão e `Delete` para excluir.

## Verificação

```bash
pnpm exec tsc --noEmit
pnpm exec eslint app components lib proxy.ts
pnpm build
```

As fontes importadas pelo usuário ficam no IndexedDB do navegador. O mapa é sincronizado entre dispositivos, mas para exibir uma fonte personalizada em outro aparelho ela precisa ser importada também nele. Imagens anexadas são reduzidas antes de serem incluídas no JSON do mapa.
