# nodum — regras de produto e requisitos

Este documento define o comportamento esperado do editor. A experiência toma como referência a edição contextual do Mindomo, com menos painéis permanentes e com operações em lote explícitas.

## Regras de negócio e de uso

1. **Mapa e propriedade.** Cada mapa pertence a uma conta. A versão na nuvem é a fonte principal; o modo local serve para desenvolvimento. Um link compartilhado dá somente leitura a quem possui o token. Google Drive guarda cópias escolhidas pelo usuário e não substitui o banco.
2. **Estrutura.** Um mapa tem um nó central. Nós hierárquicos têm no máximo um pai, e a árvore não pode conter ciclos. O nó central não pode ser excluído ou transformado em filho. Nós flutuantes não têm pai. Relações livres ligam dois nós distintos sem mudar a árvore.
3. **Padrões.** Mapas novos começam organizados à direita. Nós novos começam sem ícone, com fundo branco e contorno preto. Um estilo padrão do mapa pode substituir esses valores; uma referência de nível prevalece sobre o padrão do mapa. Estilos explicitamente escolhidos em mapas existentes são preservados.
4. **Seleção.** Clique seleciona um nó e substitui a seleção anterior. Ctrl+clique alterna a presença de um nó na seleção. Ctrl+arraste (ou Shift+arraste) seleciona os nós tocados pelo retângulo, substituindo a seleção anterior. Ctrl+A seleciona os nós visíveis. Escape ou clique no fundo limpa a seleção. Uma relação selecionada e uma seleção de nós são estados mutuamente exclusivos.
5. **Edição em lote.** Com dois ou mais nós selecionados, o menu oferece somente atributos compartilháveis: tipografia geral, cor, ícone, formato, tamanho, contorno, linha e alinhamento. O valor exibido é o do último nó selecionado; somente o controle alterado é aplicado a todos. Textos, grifos parciais, notas, comentários, links, imagens e tarefas individuais não são sobrescritos em lote. O nó central é ignorado ao editar linhas de entrada.
6. **Posição e exclusão em lote.** Alinhar nós à esquerda, ao centro ou à direita ativa o layout livre e mantém suas posições verticais. Excluir vários nós exclui cada ramo selecionado e as relações que o tocam; o nó central continua protegido. Uma operação em lote produz uma única etapa de desfazer.
7. **Menus.** A lista de mapas continua na lateral esquerda. Propriedades de um único nó ficam no menu contextual do próprio nó, agrupadas em texto, caixa, linha e complementos. Clicar nos indicadores de nota e comentário abre a edição rápida; clicar no indicador de link abre o destino. Relações têm menu flutuante próprio. Os menus devem deixar o nó selecionado visível quando houver espaço na tela.
8. **Persistência e histórico.** Alterações são salvas automaticamente após uma pausa curta. Desfazer/refazer atua sobre alterações da sessão de edição; recarregar a página não mantém o histórico. O mapa salva dados estruturados, não HTML arbitrário. Fontes importadas são instaladas no navegador atual; os favoritos de símbolos ficam no mapa e sincronizam com ele.
9. **IA.** A IA sugere conteúdo, mas o usuário revisa antes de aplicar. Nenhum conteúdo gerado entra no mapa automaticamente. Chaves e limites de uso ficam no servidor.

## Requisitos funcionais

| ID | Requisito | Critério de aceite |
| --- | --- | --- |
| RF-01 | Criar, listar, duplicar, renomear, excluir e compartilhar mapas | Cada ação reflete no mapa correto; o link público permite apenas leitura. |
| RF-02 | Criar, editar, mover, recolher e excluir nós e ramos | As conexões acompanham os nós; excluir um ramo também elimina suas relações livres. |
| RF-03 | Editar texto completo ou trechos | Negrito, itálico, sublinhado, riscado e grifo de cor preservam as partes não selecionadas. |
| RF-04 | Estilizar nó e linha no menu contextual | Cor, fonte, ícone, forma, contorno, tamanho, padding, traçado, padrão e extremidades aparecem com prévia no canvas. |
| RF-05 | Criar relações livres por arraste | Soltar o ponto de um nó sobre outro cria a relação sem trocar pais; os lados escolhidos ficam registrados. |
| RF-06 | Selecionar e editar vários nós | Ctrl+clique alterna, Ctrl+arraste seleciona por área, Ctrl+A seleciona visíveis; uma mudança de estilo atinge o grupo e pode ser desfeita. |
| RF-07 | Organizar mapas e ramos | Layout à direita é o padrão; modos automático e livre não apagam conteúdo. |
| RF-08 | Adicionar notas, comentários, links, imagens e tarefas | O complemento pertence ao nó e é acessível por seu indicador ou menu. |
| RF-09 | Importar e exportar | JSON preserva o mapa; PNG, PDF e Markdown produzem arquivos utilizáveis. |
| RF-10 | Sincronizar entre dispositivos | Usuários autenticados recuperam os mesmos mapas pelo Supabase após a gravação. |
| RF-11 | Integrar IA e Drive de modo explícito | Usuário escolhe o arquivo no Drive e revisa sugestões da IA antes de salvar. |
| RF-12 | Configurar movimentação espacial | Modos individual, hierárquico e automático respeitam a prioridade nó → mapa → conta; arraste de ramo é uma ação de desfazer. |
| RF-13 | Bloquear e organizar posições | Nós bloqueados ficam fixos; alinhamento e distribuição em lote ignoram bloqueios; reorganizar ramo conserva os outros ramos. |

## Requisitos não funcionais e critérios de qualidade

| ID | Requisito | Como verificar |
| --- | --- | --- |
| RNF-01 | Clareza e acessibilidade | Interface em pt-BR, rótulos acessíveis, foco visível, operação por teclado e contraste legível nos temas claro/escuro. |
| RNF-02 | Responsividade | Canvas utilizável em desktop e tablet; no celular, menus cabem na tela e não impedem pan/zoom. |
| RNF-03 | Desempenho | Testar arraste, zoom, seleção e edição em lote em mapas com 100+ nós; nenhuma operação deve bloquear o canvas perceptivelmente. |
| RNF-04 | Integridade | IDs únicos, ausência de ciclos, relações com destinos existentes e proteção contra perda silenciosa ao salvar. |
| RNF-05 | Segurança | Autenticação e RLS para mapas privados, tokens imprevisíveis para leitura pública, entradas limitadas e chaves secretas apenas no servidor. |
| RNF-06 | Portabilidade | Persistência em dados tipados; variáveis de ambiente documentadas; build independente de credenciais privadas no computador de desenvolvimento. |
| RNF-07 | Recuperação | Exibir estado de salvamento/erro, manter exportação JSON e permitir desfazer ações da sessão. |

Antes de publicar alterações no editor, verificar lint, build, fluxos de seleção simples e múltipla, exclusão de ramos, gravação na nuvem e abertura do link público. Metas de desempenho e acessibilidade exigem verificação prática, além da compilação.

## Movimento e publicação

- Durante o arraste, nós e conexões acompanham o ponteiro continuamente. As posições são gravadas e entram no histórico uma vez ao soltar; o layout escolhido não muda.
- O modo de movimentação padrão é hierárquico: mover um pai aplica o mesmo ΔX/ΔY a todos os descendentes, inclusive os recolhidos. Individual move somente o nó. Automático mostra o deslocamento durante o arraste e reorganiza somente o ramo ao soltar.
- A prioridade é nó explícito → pai herdado → mapa explícito → preferência global. Desativar “Aplicar a novos filhos” grava nos novos filhos a decisão de não herdar; filhos antigos continuam com suas configurações.
- Bloqueio de posição impede arraste do nó e cancela integralmente o arraste de um ramo que o contenha. Comandos de layout mantêm nós bloqueados no lugar. O comando temporário “Mover ramo inteiro” vale por um arraste e não muda as preferências.
- Com “Evitar sobreposição” ativado, ao soltar o arraste o editor procura a posição livre mais próxima para o conjunto movimentado, sem alterar as distâncias internas do ramo. Se não houver espaço próximo, mantém a posição anterior e avisa. A reorganização automática também afasta nós desbloqueados. Alinhar/distribuir ignora nós bloqueados. Cada operação de ramo ou grupo é uma entrada única no histórico.
- As linhas hierárquicas escolhem os lados dos nós a partir da posição atual, inclusive durante o arraste. Relações criadas com pontos de conexão explicitamente escolhidos preservam esses lados.
- Irmãos novos começam alinhados pela borda esquerda. Um alinhamento explícito de centro ou direita fica no nó pai e vale para filhos futuros; ao mudar a largura, a borda ou o centro escolhido permanece fixo. Em ações por nível, ramo ou mapa, cada conjunto de irmãos é tratado separadamente.
- Largura e altura são automáticas até receberem valor explícito. O bloqueio de tamanho impede mudanças numéricas, coletivas e pela alça. Alturas fixas mantêm o nó uniforme e permitem rolagem interna quando o conteúdo exceder o espaço.
- Estilos de nível são persistidos no mapa. Propriedades editadas depois são registradas como exceções do nó e não são sobrescritas ao atualizar o estilo do nível; restaurar a herança remove as exceções no alcance escolhido. Modelos de formatação são aplicados ao mapa inteiro somente após confirmação e não alteram conteúdo nem hierarquia.
- O zoom é preservado ao editar, criar ou recolher nós. Ajustar à tela é uma ação explícita, além do enquadramento inicial ao abrir um mapa.
- A elevação visual do nó durante o movimento respeita a preferência do sistema por movimento reduzido.
- O build executa `scripts/verify-editor-css.mjs` para impedir publicação sem os estilos dos menus, seleção e arraste. A validação dos gestos no navegador continua necessária.
