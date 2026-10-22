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

Configure no Supabase Auth os URLs permitidos de redirecionamento: `http://127.0.0.1:5173/auth/callback` e `https://SEU-DOMINIO-VERCEL/auth/callback`. O login por e-mail funciona com links mágicos. Para ativar Google e GitHub, configure os respectivos provedores OAuth no painel do Supabase; os botões já usam o fluxo PKCE. O endereço de callback a cadastrar nesses provedores é o callback de Auth mostrado pelo Supabase.

## Vercel

Importe o repositório GitHub como projeto **Next.js**. Use `pnpm install` e `pnpm build` (ou os padrões detectados pela Vercel). Configure estas variáveis em Production e Preview:

```text
NEXT_PUBLIC_STORAGE_MODE=cloud
NEXT_PUBLIC_SUPABASE_URL=https://pzhsmwhoefxoedoamdao.supabase.co
NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY=<chave publicável do Supabase>
```

Após o primeiro deploy, inclua o domínio final nos URLs de redirecionamento do Supabase Auth. O domínio deve usar HTTPS. O build não depende de uma conexão direta ao PostgreSQL; as rotas de servidor usam o cliente Supabase com a sessão do usuário em cookies.

## Funcionalidades

- Canvas infinito com zoom, pan, grade, minimapa, conexões e arraste de nós.
- Menu contextual por nó para criar, editar, estilizar, anotar, comentar, anexar imagem/link, configurar tarefas e escolher 14 layouts com miniaturas. Layouts de subnós reorganizam somente o ramo.
- Temas claro/escuro, modelos prontos, atalhos, histórico de desfazer/refazer, recolher ramos e organização automática.
- Salvamento automático, lista de mapas, duplicação, importação JSON e exportação PNG, PDF, Markdown e JSON.
- Compartilhamento público somente leitura por token.
- Integração manual com Google Drive para abrir/salvar cópias JSON e anexar arquivos, mediante credenciais OAuth próprias (`NEXT_PUBLIC_GOOGLE_*`). Não é sincronização automática.

## Verificação

```bash
pnpm exec tsc --noEmit
pnpm exec eslint app components lib proxy.ts
pnpm build
```

As fontes importadas pelo usuário ficam no IndexedDB do navegador. O mapa é sincronizado entre dispositivos, mas para exibir uma fonte personalizada em outro aparelho ela precisa ser importada também nele. Imagens anexadas são reduzidas antes de serem incluídas no JSON do mapa.
