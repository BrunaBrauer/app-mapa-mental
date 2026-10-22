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

## Verificação

```bash
pnpm exec tsc --noEmit
pnpm exec eslint app components lib proxy.ts
pnpm build
```

As fontes importadas pelo usuário ficam no IndexedDB do navegador. O mapa é sincronizado entre dispositivos, mas para exibir uma fonte personalizada em outro aparelho ela precisa ser importada também nele. Imagens anexadas são reduzidas antes de serem incluídas no JSON do mapa.
