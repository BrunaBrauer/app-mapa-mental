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

A migração `supabase/migrations/20261106_workspace.sql` acrescenta `public.user_workspaces` para projetos, pastas, etiquetas e metadados de arquivos, com RLS por usuário. Os arquivos enviados ficam no bucket privado `workspace-files` (até 25 MB por arquivo), sob o prefixo do ID do usuário. A migração precisa estar aplicada antes de abrir esta versão em produção; o banco de produção do nodum já a recebeu. Em ambiente local, aplique as migrações ao projeto Supabase de teste antes de usar upload. No modo `NEXT_PUBLIC_STORAGE_MODE=local`, projetos e etiquetas ficam só neste navegador e o envio de arquivos é desativado.

Projetos mostram a data de criação e os totais de pastas e arquivos (mapas e uploads). Pastas podem conter subpastas. Excluir uma pasta move seu conteúdo para a pasta acima; excluir um projeto move seu conteúdo para “Sem projeto”. Etiquetas são criadas na aba própria, podem ser aplicadas várias vezes por nó ou por limite, e filtram os mapas que as usam. Limites de seleção múltipla abrangem os nós escolhidos e seus descendentes visíveis, atualizando a área ao recolher ou expandir ramos. A organização e os arquivos são sincronizados pela conta Supabase; uploads consomem a cota de Storage do projeto.

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
- O controle permanente de cada ramo mostra a quantidade de filhos diretos ao expandir; o total de descendentes ocultos aparece na descrição do botão. Recolher um ramo preserva os estados de seus sub-ramos; expandi-lo restaura a visualização anterior. Nos layouts automáticos, os nós visíveis são reorganizados para fechar espaços vazios. No layout livre, as posições manuais são preservadas.
- Os layouts automáticos reservam espaço para subárvores completas e para nós com dimensões personalizadas. Nos layouts em árvore, a distância entre níveis usa a maior dimensão do nível anterior e um intervalo mínimo para as conexões; ao aumentar ou reduzir um nó, os níveis seguintes se afastam ou se aproximam. Os modos de espaçamento compacto e amplo continuam disponíveis. Matriz e raias ajustam suas células à largura e altura do conteúdo; layouts radiais ampliam o espaçamento sem mudar os ângulos. Mapas antigos com sobreposições visíveis são reorganizados ao abrir. Posições bloqueadas e ramos em modo livre continuam sob controle manual.
- A largura escolhida define a quebra de linha, enquanto a altura funciona como medida mínima e cresce para manter o título, imagem e ícones de nota/comentário visíveis. Se a quebra de linha for desligada, o nó amplia sua largura para evitar cortes. O texto das notas e dos comentários permanece no menu aberto pelos ícones. Após alterações de conteúdo ou tamanho, os layouts automáticos reajustam os ramos; a forma sublinhada usa a cor, espessura e padrão da sua linha hierárquica de entrada.
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

- O texto de cada nó é salvo como texto simples para buscas e exportações, acompanhado dos estilos parciais. Ao dar dois cliques no nó, selecione uma palavra ou frase para aplicar somente nela negrito, itálico, sublinhado, riscado, cor, grifo, fonte, tamanho, maiúsculas/minúsculas ou espaçamento. Sem seleção, esses comandos atingem todo o texto. O alinhamento continua sendo uma propriedade do nó inteiro. Os espaçamentos entre linhas e letras têm controles de diminuir, valor numérico e aumentar. O sublinhado usa um afastamento visual de 4 px.
- Cada nó pode ter até 100 notas independentes, abertas pelo ícone de nota. É possível criar, editar e excluir cada uma; mapas antigos com uma nota única continuam compatíveis. As notas são salvas com o mapa e incluídas na exportação Markdown. O limite conjunto é de 200 mil caracteres por nó.
- Novos nós usam fundo branco, contorno preto e nenhum ícone, salvo quando há estilo padrão ou referência de nível definida pelo usuário. O menu rápido separa texto, nó e linha; as quatro cores rápidas podem ser refinadas por código hexadecimal (sem controles RGB). Ícones favoritos ficam salvos no próprio mapa e aparecem em outros dispositivos que abrirem esse mapa.
- Largura, altura mínima e padding são medidas em pixels, limitadas no menu para evitar caixas ilegíveis. Sem valor explícito, o nó usa o tamanho automático. O contorno aceita cor, padrão e espessura de 0 a 20 px.
- “Repetir estilo neste nível” aplica tamanho, formatação ou ambos aos outros filhos do mesmo pai já existentes e registra esse estilo para filhos criados depois. Os filhos de outros pais e descendentes mais profundos não mudam. O estilo padrão do mapa vale para novos nós quando não houver referência de nível. Modelos salvos pertencem ao mapa e aparecem no menu do nó.
- A linha hierárquica é configurada pelo nó filho. “Aplicar esta linha a todo o nível” atualiza os irmãos e os novos filhos do mesmo pai. Arrastar um ponto de conexão de um nó até outro cria uma relação livre sem alterar a árvore; origem e chegada preservam os lados escolhidos. Clicar na relação abre seu menu flutuante. O limite visual inclui o nó selecionado e seus descendentes visíveis; ramos recolhidos permanecem no grupo, mas não ocupam área no canvas.
- Seleção múltipla: Ctrl+clique alterna um nó, Ctrl+arraste ou Shift+arraste a partir do fundo seleciona os nós tocados pelo retângulo e substitui a seleção anterior, Ctrl+A seleciona os nós visíveis e Escape limpa. Edição em lote atinge apenas propriedades compartilháveis; exclusão remove ramos selecionados, preservando o nó central. Alinhamento ativa o layout livre.
- `Ctrl+V` com texto externo cria um filho direto do nó selecionado por linha não vazia, em uma única operação desfeita por `Ctrl+Z`. Uma cópia de ramo feita no editor mantém a hierarquia ao colar; o menu do nó também permite colar o ramo copiado. Cada linha aceita até 1.000 caracteres e o mapa até 2.000 nós.
- Nos layouts automáticos, subárvores irmãs são compactadas com um espaço mínimo de 16 px, respeitando os tamanhos reais dos nós e posições bloqueadas. O layout livre mantém as posições manuais.
- A exportação PDF oferece A4, A3, A2, A1, A0 e medidas personalizadas em milímetros (50–2.000 mm), com orientação automática, retrato ou paisagem. O mapa visível é ajustado em uma única página; mapas extensos podem ter texto pequeno em papéis menores.
- Atalhos: `Ctrl+C` e `Ctrl+X` para copiar ou recortar um ramo, `Ctrl+Shift+C` para copiar todas as propriedades de formatação, `Ctrl+Alt+V` para aplicar o estilo copiado aos nós selecionados, `Ctrl+D` para duplicar, `Ctrl+L` para iniciar uma relação, `Tab` para criar filho, `Enter` para irmão e `Delete` para excluir.
- Na barra inferior e no menu do nó, **Copiar estilo** oferece três opções: **todas as propriedades** (estilo e tamanho), **estilo visual** (somente cores de texto, preenchimento e borda) e **tamanho** (largura, altura, limites e tamanho da letra). **Aplicar estilo** formata todos os nós selecionados em uma ação. Formatação parcial de palavras permanece associada ao texto original e não substitui o conteúdo dos destinos.

As regras de produto e os critérios funcionais e não funcionais estão em [docs/REGRAS_E_REQUISITOS.md](docs/REGRAS_E_REQUISITOS.md).

## Verificação

```bash
pnpm exec tsc --noEmit
pnpm exec eslint app components lib proxy.ts
pnpm build
```

As fontes importadas pelo usuário ficam no IndexedDB do navegador. O mapa é sincronizado entre dispositivos, mas para exibir uma fonte personalizada em outro aparelho ela precisa ser importada também nele. Imagens anexadas são reduzidas antes de serem incluídas no JSON do mapa.

## Importação e Google Drive

- Importar tem botão próprio ao lado de Exportar. Aceita backup JSON do nodum e arquivos Mindomo `.mom`, `.pmom`, `.txt`, `.md` e `.markdown`, inclusive pelo menu Drive. Cada importação cria um mapa privado novo; a cópia do arquivo original não é alterada. O Drive é um fluxo manual de arquivos, não sincronização contínua.
- `.mom`/`.pmom`: aceita XML/JSON hierárquico e pacotes Mindomo com `document.json` e `nodes.json`, inclusive quando `.pmom` contém um `.mom` interno. Converte tópicos e hierarquia para um mapa organizado à direita. Em mapas com mais de 100 tópicos, ramos principais com descendentes começam recolhidos para a visualização inicial ficar legível; todos os tópicos continuam no mapa. Estilos e anexos Mindomo ainda não são convertidos.
- `.txt`: usa a indentação por tabulações (ou pares de espaços) para reconstruir a hierarquia. `.md`/`.markdown`: aceita títulos `#`, `##` e listas com indentação. Recursos fora da estrutura textual podem não ser convertidos. Como exportações do Mindomo variam, use o contador de ideias após importar para conferir o resultado.
- Limites: pacote até 25 MB, texto até 5 MB, 2.000 nós, 100 níveis e 1.000 caracteres por tópico. Arquivos inválidos não substituem mapas existentes. Exportação para Drive continua em JSON até 5 MB.
- OAuth do Drive usa drive.file; a credencial é reutilizada até expirar apenas em memória, sem persistência em localStorage. Fechar a janela ou negar acesso permite nova tentativa. É necessário validar importação/exportação com a conta Google autorizada em produção.
- O menu de nó usa coordenadas da tela e rolagem interna, independente do zoom do canvas. Durante o arraste ele fica oculto e volta ao soltar. Nós parados mantêm suas referências e não reiniciam animações a cada movimento.

Teste do importador: `node scripts/test-import.mjs`.

## Movimentação e organização

O padrão é **Hierárquico**: ao arrastar um nó, todos os seus descendentes acompanham o movimento sem alterar a hierarquia nem o layout escolhido. No controle **Movimentação**, na barra inferior, configure o padrão da conta e uma exceção para o mapa. No menu do nó, em **Movimentação e organização** (também acessível com clique direito), escolha uma exceção individual, bloqueie a posição ou use **Mover ramo inteiro** para o próximo arraste (`Alt+Shift+M`). **Reorganizar ramo** ajusta apenas o ramo selecionado; **Restaurar posicionamento automático** remove o layout próprio do ramo. Um nó bloqueado impede o arraste completo do ramo, com aviso na tela.

Soltar um nó sobre outro muda o pai do ramo arrastado. O destino recebe um contorno verde durante o gesto; a subárvore interna é preservada e o novo pai é expandido se necessário. O nó central não pode ser movido, e o destino não pode ser o próprio ramo nem um de seus descendentes. Nos layouts automáticos, o mapa é reorganizado após a mudança de nível; nos layouts livres, as posições relativas são mantidas. A mudança pode ser desfeita em uma ação.

Ao selecionar vários nós, o botão **Organizar** oferece alinhamento nas seis direções e distribuição horizontal, vertical ou uniforme. Nós bloqueados ficam imóveis. O modo **Automático** reorganiza o ramo após soltar; a opção de evitar sobreposição pode ser configurada na conta, no mapa e no nó. Quando ativada, o destino do arraste é ajustado à posição livre mais próxima, preservando as distâncias internas do conjunto; se não houver espaço, a posição anterior é mantida. As conexões hierárquicas passam automaticamente para os lados voltados um ao outro durante o arraste. Teste da lógica: `node scripts/test-movement.mjs`.

Em **Layout e organização**, selecione o alcance (seleção, irmãos, nível, ramo ou mapa) e alinhe bordas esquerdas, centros ou bordas direitas. Nos alcances nível, ramo e mapa, cada conjunto de irmãos é alinhado separadamente para não fundir ramos. Novos irmãos começam alinhados à esquerda; ao definir centro ou direita para um grupo de irmãos, novos filhos preservam essa escolha. O texto dentro do nó tem alinhamento horizontal e vertical independente.

As dimensões começam automáticas. Em **Nó e caixa de texto → Dimensões e padronização**, ajuste largura, altura e limites mínimos/máximos individuais; no painel **Layout e organização**, aplique valores exatos e limites a uma seleção, irmãos, nível, ramo ou mapa em uma ação. Também é possível arrastar a alça inferior direita, bloquear o tamanho ou manter a proporção. Os comandos coletivos usam o tamanho visível para igualar ao maior, ao menor ou a uma referência. Uma altura configurada funciona como mínimo: o nó cresce se necessário para exibir todo o conteúdo. Em layouts automáticos, as colunas ou linhas são recalculadas conforme as dimensões visíveis e os ramos são separados para evitar sobreposição; no layout livre, as posições permanecem sob controle manual.

Um nó pode fornecer o estilo de todo o seu nível. Alterações posteriores em um nó são guardadas como personalizações e sobrevivem à atualização do estilo herdado; **Restaurar estilo herdado** remove essas exceções no alcance escolhido. Cinco modelos de formatação para o mapa estão disponíveis no mesmo painel e exigem confirmação porque substituem as formatações atuais. O conteúdo e as relações permanecem; em layouts automáticos, um ajuste local de espaçamento pode mover irmãos para evitar sobreposição. Teste da lógica: `node scripts/test-visual-standardization.mjs`.

## Preferências da conta

Tema, grade, barra lateral, exibição automática do menu, modo global de movimentação e prevenção global de sobreposição são gravados em `nodum_preferences` nos metadados do usuário autenticado no Supabase. Não são usados para autorização. A última gravação prevalece; outro dispositivo carrega as preferências ao abrir/recarregar o editor. As gravações são serializadas após 350 ms de inatividade e falhas aparecem no editor. No modo local de testes, as preferências ficam no navegador. Fontes personalizadas continuam armazenadas apenas no navegador onde foram importadas.

Teste das rotas com serviços simulados: `node scripts/test-preferences-ai.mjs`. Uma chamada real Gemini exige sessão autenticada e `GEMINI_API_KEY` na Vercel (sem prefixo público); o deploy deve ser refeito após adicionar a variável. O uso pode consumir a cota/crédito do projeto Google.
