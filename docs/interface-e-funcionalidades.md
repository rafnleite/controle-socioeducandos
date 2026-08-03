# Documentação da Interface e Funcionalidades

> Sistema de Controle de Unidade Socioeducativa — avaliação funcional e roadmap sugerido

## Índice

- [Arquitetura da interface](#arquitetura-da-interface)
- [Navegação e páginas](#navegação-e-páginas)
- [Funcionalidades por módulo](#funcionalidades-por-módulo)
- [Matriz de CRUD por entidade](#matriz-de-crud-por-entidade)
- [Pontos fortes da implementação atual](#pontos-fortes-da-implementação-atual)
- [Lacunas e comandos de CRUD faltando](#lacunas-e-comandos-de-crud-faltando)
- [Funcionalidades incompletas / código morto encontrado](#funcionalidades-incompletas--código-morto-encontrado)
- [Sugestões de melhoria e roadmap](#sugestões-de-melhoria-e-roadmap)

---

## Arquitetura da interface

A aplicação é uma **SPA (Single Page Application)** renderizada inteiramente no
servidor Apps Script e entregue como um único `HtmlService` (`doGet` → `Main.html`).
Não há roteador client-side "de verdade": a "navegação" troca o `innerHTML` do
`<div id="content">` chamando `setContent(html)` a partir de funções `mostrar*()` em
`PartialMainScripts.html`, que por sua vez chamam `google.script.run.<funçãoDoServidor>`
para buscar/gravar dados.

- **`Main.html`** — casco HTML, barra de navegação superior, `<script>` de bootstrap
  (`PAGINA_INICIAL`, `ID_INICIAL`) e includes de bibliotecas (Bootstrap 5,
  Bootstrap-Select, FontAwesome, FullCalendar, Flatpickr, jQuery).
- **`PartialMainScripts.html`** — **todo** o JavaScript client-side (renderização de
  telas, formulários, validação, chamadas RPC). Arquivo único e extenso (~3000 linhas),
  sem módulos/bundling.
- **`PartialMainStyles.html`** — todo o CSS.
- **`Code.gs`** — backend: schema das planilhas, funções RPC expostas a
  `google.script.run`, validações de negócio, importadores CSV, migrações de estrutura.

Não existe framework de componentes (React/Vue/etc.) — toda tela é montada via
concatenação de strings HTML no JavaScript. Isso é simples de entender, mas custoso de
manter à medida que a aplicação cresce (ver seção de melhorias).

---

## Navegação e páginas

Barra superior (`Main.html`):

| Botão | Ação |
|---|---|
| **Painel Geral** | `mostrarOverview()` — dashboard com indicadores e resumo do dia. |
| **Cursos** | `mostrarPaginaCursos()` — página dedicada com cursos próximos do encerramento de inscrição e socioeducandos sem curso recente. |
| **Importar dados** | `mostrarMenuImportar()` — menu de importação de CSV. |
| **Cadastrar ▾** | menu suspenso: Socioeducandos, Atendimentos, Cursos, Trabalho, Interesses de Curso, Saídas. |
| **Configurações ▾** | menu suspenso: Tipos de Atendimento — CRUD (`mostrarConfigTiposAtendimento()`) do catálogo de tipos e duração padrão. Separado do menu "Cadastrar" por um divisor na barra. |
| **Busca (topo)** | campo de busca *live* por nome/ID que abre um menu de resultados navegando direto para `mostrarPerfil(id)`. |

A aplicação também aceita parâmetros de URL (`doGet`) para abrir direto em uma tela
específica: `?page=perfil&id=...`, `?page=atendimento[&id=...]`, `?page=saida`,
`?page=curso`, `?page=importar`.

---

## Funcionalidades por módulo

### Painel Geral (Overview)

- Cartões de indicadores: total de socioeducandos, internados ativos, cursos em
  andamento, fugas nos últimos 30 dias.
- **Resumo do dia**: lista de atendimentos, saídas, retornos e fugas/evasões do dia,
  aniversariantes e navegação entre dias (setas ◀▶, seletor de data, botão "Hoje").
- Listagem de socioeducandos com status (internado/ausente/desligado) e atalho para o
  perfil.
- A tabela também exibe o atributo **E-mail profissional** e permite ordenação por
  essa coluna.
- A grade principal do painel segue a ordem: **ID**, **Nome**, **Status**,
  **Internado desde**, **Idade**, **Escolaridade**, **E-mail** e **Resumo**.
- Filtros da tabela de socioeducandos (além da busca): status, em cursos,
  trabalhando, **sem visita territorial** e **sem saída cultural**.
- A coluna **Resumo** consolida indicadores em pills:
  - curso: ícone + quantidade de cursos ativos;
  - trabalho: ícone + empresa (uma pill por vínculo ativo);
  - visita territorial: alerta `SEM VISITA TERRITORIAL` quando não houver nenhum
    registro de visita para o socioeducando;
  - alerta: pill `NÃO FEZ SAÍDA CULTURAL` para quem ainda não realizou saída cultural.
- **Drill-down por clique nos pills**:
  - ao clicar na pill de cursos, abre modal com os cursos ativos do socioeducando
    (tipo, curso, local, período e horário), em modo consulta;
  - ao clicar em uma pill de trabalho, abre modal com os detalhes do vínculo
    selecionado (tipo, empresa, curso, contrato, início/fim e horário), com
    atalho para abrir a edição do trabalho.
- Socioeducandos sem saída cultural realizada também recebem destaque visual na linha
  da tabela para facilitar priorização.
- Regra do alerta cultural no overview: considera que o socioeducando **fez saída
  cultural** quando existe vínculo em saída do tipo `Cultural`, não cancelado, com
  status `Realizada` ou com retorno registrado no evento.

**Ajuste recente de desempenho:** o Painel Geral passou a carregar em duas etapas.
Primeiro renderiza cartões, filtros e tabela principal; depois busca o bloco
`Resumo do dia` de forma assíncrona. Isso reduz o tempo percebido de abertura do
painel e evita que a leitura de `Atendimentos`, `Saidas` e `SaidaMatriculas` bloqueie
o primeiro paint da tela.

### Perfil do Socioeducando

- Cabeçalho com dados pessoais, idade, status atual e botão **Editar**.
- Quando houver dado cadastrado, o cabeçalho também exibe **E-mail profissional**.
- Para o usuário autorizado (`luizasoarespedagoga@gmail.com`), o perfil mostra o
  botão **Ver credenciais**, que abre modal com e-mail e senha profissional
  descriptografada.
- **Agenda visual (FullCalendar)** dos últimos/próximos 14 dias, combinando saídas,
  atendimentos e ocorrências recorrentes de cursos e trabalhos (por dia da semana). O clique em
  uma ocorrência de curso abre formulário diário para marcar ausência (`Ausente`) e
  registrar observações daquele dia.
- **Familiares (card dedicado)**: seção em cards posicionada abaixo da agenda e acima
  do card único de registros, com listagem dos contatos do socioeducando.
- **Principal em destaque**: o familiar marcado como principal aparece sempre primeiro
  e com destaque visual.
- **Ações por card**: cada familiar possui ações de editar e excluir.
- **Card "Adicionar familiar"**: aparece ao final da lista e abre modal para
  cadastro/edição (nome, telefone, tipo de vínculo, endereço e marcador de principal).
- **Atualização parcial**: após criar/editar/excluir familiar, somente a seção de
  familiares é atualizada, sem recarregar o perfil inteiro.
- **Admissões**: histórico de internações, com ação de desligamento (🚪), mantido em
  card próprio.
- **Card único de registros com abas**: as seções `Cursos`, `Atendimentos`,
  `Trabalhos`, `Visitas Territoriais`, `Saídas` e `Fugas/Evasões` ficam reunidas em
  um único card com abas, no padrão de seleção segmentada (similar ao painel de
  cursos).
- **Cursos (aba)**: tabela com tipo, nome, status do vínculo, local
  (interno/externo), instituição, período, dias da semana e situação de conclusão.
  Ações: editar vínculo (✏️), marcar conclusão (✔/📜).
- **Atendimentos (aba)**: tabela com tipo, responsável, período, observações e status
  (realizado/não realizado, com motivo e link de reposição). Ação: marcar como não
  realizado (gera reposição automaticamente).
- **Trabalhos (aba)**: tabela com tipo, empresa, curso (opcional), contrato,
  início/fim e horário semanal. Ações: novo trabalho e editar vínculo existente.
- **Visitas Territoriais (aba)**: tabela com data, técnico responsável,
  atendido por, sinalizadores `CREAS`, `CAPS` e `Ameaça` (sim/não),
  além de observações. Ações: nova visita e editar registro.
- **Saídas (aba)**: tabela com local, tipo, ida/volta, condução, acompanhante,
  observações do evento, situação (retornou?) e status do vínculo
  (Prevista/Realizada/Cancelada). Ações: registrar volta (↩️), editar vínculo (✏️).
- **Fugas/Evasões (aba)**: histórico com ação de registrar retorno (↩️) e editar (✏️).

### Cadastro de Socioeducando

- Formulário único de criação/edição. Na edição, o `ID` é exibido apenas como texto
  (não como campo editável).
- Foram adicionados os atributos **E-mail profissional** e **Senha profissional**.
- Esses dois campos são exibidos no formulário **somente** para o usuário autorizado
  (`luizasoarespedagoga@gmail.com`).
- Na edição, deixar a senha em branco mantém a senha criptografada já existente.
- O **Nome** é sempre normalizado para maiúsculas antes de gravar (cadastro, edição e
  importação via CSV).
- Na criação, a **Data de admissão é obrigatória** e não pode ser futura (assim como a
  Data de Nascimento) — gera automaticamente a primeira linha em `Admissoes`.
- **Readmissão**: se o `ID` informado já pertencer a um socioeducando cadastrado e
  **desligado**, o sistema não cria um novo cadastro — mostra os dados já existentes e
  pergunta se deseja registrar uma **nova admissão** para ele. Se o socioeducando
  existente estiver **ativo** (internado), o cadastro é bloqueado como duplicidade.
- **Nenhuma admissão (nova ou editada) pode ter data anterior ao último desligamento**
  já registrado para aquele socioeducando — vale tanto no cadastro/edição pelo
  formulário de Admissões quanto no fluxo de readmissão acima.

### Cursos

- Cadastro individual vinculado a um socioeducando (`mostrarFormCurso`), com status do
  vínculo (Interessado/Matriculado, com o `<select>` colorido de acordo com o status
  escolhido), local (interno/externo), instituição, vagas, datas/horários e dias da
  semana recorrentes.
- Cadastro **em lote** (`mostrarFormCursoLote`): define, para uma lista buscável de
  todos os socioeducandos, o status de vínculo individual de cada um — apenas
  Interessado ou Matriculado (ou "sem vínculo"), com botões de atalho ("Todos:
  Interessado", "Todos: Matriculado", "Limpar todos") e cria um único curso + N
  matrículas. A lista exibe, ao lado do nome de cada socioeducando, sua escolaridade e
  os interesses de curso já registrados (separados por vírgula), com um filtro
  dedicado por interesse (além da busca por nome/ID).
- **Registrar término de vínculo** (`mostrarFormTermino`, a partir do perfil do
  socioeducando): para um vínculo já matriculado, permite marcar o `Tipo de Término`
  como "Concluído" ou "Desistente", sempre exigindo a `Data de Término` (e, se
  concluído, se foi emitido certificado) — essa data é o que aparece plotado no
  calendário do perfil como o último dia de frequência do socioeducando no curso,
  mesmo em caso de desistência.
- Página "Cursos" dedicada: cursos com inscrição prestes a encerrar (com contagem de
  vagas ocupadas/disponíveis) e socioeducandos internados sem curso recente.
- **Evento diário do curso** (a partir do calendário do perfil): para cada dia de
  ocorrência do curso e socioeducando, o sistema permite CRUD de observação e flag
  `Ausente` em um modal (create/read/update/delete do registro diário).

### Interesses de Curso

- Tabela auxiliar `InteressesCurso` (texto livre por socioeducando, N interesses por
  aluno), usada para planejar novas turmas antes mesmo de o curso existir.
- No **perfil do socioeducando**, dentro do card "Cursos": chips com os interesses
  atuais (cada um com botão de remover) e um campo para adicionar um novo interesse
  daquele aluno específico (`salvarInteresseCurso`/`excluirInteresseCurso`).
- Cadastro **em lote** (`mostrarFormInteressesLote`, acessível por Cadastrar ▾ →
  Interesses de Curso): permite digitar/selecionar um interesse e marcar vários
  socioeducandos de uma vez (checkboxes com busca por nome/ID) para adicionar esse
  mesmo interesse a todos os selecionados — quem já tiver o interesse é ignorado
  silenciosamente (sem duplicar).

### Saídas

- Cadastro individual vinculado a um socioeducando (`mostrarFormSaida`), com status
  (Prevista/Realizada/Cancelada), local, **tipo de saída** (Cultural, Familiar,
  Lazer, Esportiva, Descida para casa, Outros), **Data de saída**, **Horário de saída**,
  **Data de retorno** e **Horário de retorno** (todos obrigatórios), condução, **nome do(a)
  acompanhante obrigatório**,
  observações do evento (geral, compartilhada por todos os vinculados) e observações
  do vínculo (específica daquele socioeducando).
- Cadastro **em lote** (`mostrarFormSaidaLote`): mesmo padrão do lote de Cursos — cria
  uma única saída (evento) e N vínculos, cada um com seu próprio status. A tela **não**
  oferece um campo de observação individual “padrão para todos”; observações de vínculo
  continuam sendo lançadas individualmente depois, no histórico do socioeducando. O
  tipo da saída também é obrigatório no lote.
- A data e o horário são exibidos em campos separados, mas cada par é armazenado junto
  em `Saidas` (`Data/Hora Ida` e `Data/Hora Volta`). Ao preencher a data de saída com
  a data de retorno vazia, a data de retorno é preenchida automaticamente com a mesma data.
- Registro de volta (`mostrarFormVolta`) — atualiza a data/hora de volta do evento
  (compartilhada por todos os vinculados àquela saída).
- **Verificação de conflitos de agenda** (`verificarConflitosAgenda`): ao preencher
  datas em formulários de saída (individual ou lote), o sistema consulta em tempo real
  se o(s) socioeducando(s) já tem curso, outra saída ou atendimento no mesmo intervalo,
  e exibe um alerta com os conflitos antes de salvar. No lote, ao clicar em
  "Cadastrar saídas", o sistema abre um **modal de confirmação detalhado** com
  os conflitos e as ações "Revisar horários" ou "Cadastrar saídas mesmo assim".
  Vínculos com status cancelada não entram no cálculo de conflito.

### Atendimentos

- Cadastro **em lote multi-linha** (`mostrarFormAtendimentos`): permite adicionar várias
  linhas de atendimento (um por socioeducando, tipo e responsável configuráveis por
  linha) em uma única tela, com botão de remover linha e cálculo automático do horário
  de término (com base na duração padrão do tipo).
- **Marcar como não realizado**: modal que exige motivo e nova data/hora, criando
  automaticamente um atendimento de reposição encadeado ao original.

### Trabalhos

- Cadastro individual (`mostrarFormTrabalho`): registra vínculo de `Trabalho` ou
  `Aprendizagem` para um socioeducando, com empresa, curso opcional, data de
  contrato, início/fim e horário semanal (dias da semana + hora início/fim).
- Acesso pelo menu **Cadastrar** e também pelo **perfil** do socioeducando.
- No perfil, aparece na aba **Trabalhos** dentro do card único de registros, com
  listagem e ações de **Novo trabalho** e **Editar** vínculo existente.
- Não possui cadastro em lote: o fluxo é sempre 1 registro por vez.

### Visitas Territoriais

- Cadastro individual por socioeducando (`mostrarFormVisitaTerritorial`), com os
  campos: data, técnico responsável, atendido por, indicadores de encaminhamento
  (`CREAS`, `CAPS`) e indicador de risco (`Ameaça`), além de observações.
- Acesso principal pela aba **Visitas Territoriais** no perfil do socioeducando.
- Relação **1 socioeducando : N visitas territoriais** (não possui cadastro em lote).
- O overview sinaliza automaticamente com pill de alerta os socioeducandos sem
  nenhum registro de visita territorial.

### Familiares

- Relação **1 socioeducando : N familiares** (`Familiares`), sem cadastro em lote.
- CRUD via modal no perfil: nome, telefone, tipo de vínculo, endereço e marcador de
  principal.
- Regra de negócio: apenas **1 familiar ativo** pode ser principal por socioeducando;
  ao marcar um principal, os demais são desmarcados automaticamente.
- Exclusão disponível no card de cada familiar (deleção lógica).

### Importação de dados (CSV)

- **Importar Socioeducandos**: a partir do relatório "Documentos Pessoais" do Portal
  SUASE (separador `;`), cria socioeducandos novos e suas admissões.
- **Atualizar Escolaridade**: a partir de relatório de escola, atualiza a escolaridade
  de socioeducandos já cadastrados.

---

## Matriz de CRUD por entidade

Legenda: ✅ completo pela UI · ⚠️ parcial/indireto · ❌ inexistente na UI (ainda que
exista no backend).

| Entidade | Create | Read | Update | Delete |
|---|---|---|---|---|
| Socioeducandos | ✅ formulário (nome/data de nascimento/admissão validados; readmissão de desligados oferece nova admissão em vez de duplicar; credenciais com permissão restrita) | ✅ perfil/listagem/busca (e-mail visível; senha só por modal restrito) | ✅ formulário (exceto ID, exibido como texto; credenciais apenas por usuário autorizado) | ❌ |
| Admissões | ✅ formulário próprio (`mostrarFormAdmissao`) + automático no cadastro do socioeducando + readmissão de socioeducando desligado | ✅ histórico no perfil | ✅ formulário de edição (`Data Admissão`/`Data Desligamento`) + "desligar" | ❌ |
| Fugas/Evasões | ✅ formulário | ✅ histórico no perfil | ✅ formulário + registrar retorno | ❌ |
| Cursos (evento) | ✅ individual e em lote | ✅ perfil + página "Cursos" | ✅ (via edição do vínculo, que reescreve o evento) | ❌ |
| CursoMatriculas (vínculo) | ✅ individual e em lote | ✅ perfil | ✅ status, conclusão, certificado | ❌ |
| CursoEventos (dia de uma matrícula de curso) | ✅ modal no calendário do perfil | ✅ clique na ocorrência do curso no calendário | ✅ modal no calendário do perfil | ✅ modal no calendário do perfil |
| Saídas (evento) | ✅ individual e em lote | ✅ perfil | ✅ (via edição do vínculo) | ❌ |
| SaidaMatriculas (vínculo) | ✅ individual e em lote | ✅ perfil | ✅ status, observações, volta | ❌ |
| Atendimentos | ✅ em lote | ✅ perfil | ✅ formulário de edição (tipo, responsável, horários, observações) + "marcar não realizado" | ❌ |
| Trabalhos | ✅ individual | ✅ perfil | ✅ formulário de edição | ❌ |
| Familiares | ✅ individual (modal no perfil) | ✅ perfil (cards) | ✅ edição por modal | ✅ exclusão lógica (card) |
| TiposAtendimento | ✅ tela de Configurações | ✅ tela de Configurações + lista de seleção | ✅ tela de Configurações | ✅ tela de Configurações (bloqueia/confirma se houver atendimentos vinculados) |
| InteressesCurso | ✅ perfil (individual) e em lote (`mostrarFormInteressesLote`) | ✅ perfil + lista de cadastro de curso em lote (com filtro) | ✅ (remover + recriar, sem tela de edição de texto dedicada) | ✅ perfil (chip ✕) |

---

## Pontos fortes da implementação atual

- Modelagem N:N consistente e bem padronizada entre `Cursos` e `Saidas` (mesma
  convenção de nomes, mesma estratégia de migração aditiva/não destrutiva).
- Verificação de conflitos de agenda centralizada num único motor, cruzando cursos,
  saídas e atendimentos, com UX de
  confirmação explícita em vez de bloqueio rígido.
- Ajuste fino de conflitos para cursos: ausências diárias registradas em eventos de
  curso (`CursoEventos`, vinculados a `CursoMatriculas`) retiram aquela ocorrência específica do cálculo de conflito.
- No calendário do perfil, uma ocorrência de curso marcada como ausente é exibida em
  uma variação menos saturada da cor do curso; observações do evento também aparecem
  no título e ao passar o cursor sobre a ocorrência. Salvar ou excluir esse evento
  atualiza somente o calendário.
- Fluxo de "atendimento não realizado → reposição automática" é elegante e mantém
  rastreabilidade.
- Cadastro em lote (Cursos/Saídas/Atendimentos) reduz drasticamente o trabalho manual
  quando o mesmo evento envolve vários socioeducandos.
- O carregamento do Painel Geral foi otimizado com cache por execução no Apps Script
  (abas, cabeçalhos, linhas e mapeamentos de coluna) e com o `Resumo do dia`
  carregado separadamente, reduzindo bastante o tempo percebido de abertura da tela.
- Auditoria básica (`Registrado em`/`Criado por`/`Atualizado em`/`Atualizado por`)
  presente na maioria das tabelas, sempre como os últimos atributos "principais".
  `TiposAtendimento` e `InteressesCurso` usam apenas `Registrado em`/`Criado por`.
  A maioria das tabelas também reserva, como últimas colunas, `Deletado em`/
  `Deletado por` para exclusão lógica. Esse padrão já está ativo em `Familiares`;
  nas demais rotinas de exclusão, o comportamento predominante ainda é exclusão
  física. As mesmas duas tabelas são a exceção e não reservam essas colunas.
- **Ícones consistentes**: toda a interface usa ícones Font Awesome (`fa-solid`) em vez
  de emojis, inclusive nas mensagens de alerta/erro exibidas diretamente via
  `innerHTML` (que não passam pela conversão automática de `iconifyHtml()`).
- Migrações de estrutura (`migrarSaidasParaNovaEstrutura`, `migrarCursosParaNovaEstrutura`
  — ambas já cumpriram seu papel e foram removidas do código) eram não destrutivas
  (preservavam dados antigos em abas "Legado").

---

## Lacunas e comandos de CRUD faltando

1. **Exclusão (Delete) ainda é limitada na UI.** Hoje há exclusão apenas em alguns
  fluxos específicos (ex.: interesses de curso e familiares). Ainda não existe um
  padrão amplo de exclusão para a maioria das entidades principais (admissões, fugas,
  cursos, saídas, atendimentos, trabalhos).
2. **Sem exclusão em cascata / verificação de dependências**: mesmo que a exclusão seja
   implementada, apagar um `Curso`/`Saida` deixaria matrículas "órfãs" em
   `CursoMatriculas`/`SaidaMatriculas` se não houver tratamento explícito.

> **Nota de design — `Vagas` de curso é apenas informativo**: o número de vagas de um
> curso não bloqueia a matrícula quando excedido. Isso é intencional (ver
> `docs/banco-de-dados.md`), e não uma lacuna a ser corrigida.

---

## Funcionalidades incompletas / código morto encontrado

- **Importador de Cursos via CSV parcialmente implementado e não conectado**: as
  funções `parsearCsvCursos(csvText, tipoCurso)` e `confirmarImportarCursos(linhas)`
  existem em `Code.gs`, mas **não são chamadas por nenhum botão da interface** — o menu
  "Importar dados" só oferece Socioeducandos e Escolaridade. Os arquivos de exemplo
  `exemplos/cursoPreQualificacao.csv` e `exemplos/cursosProfissionalizantes.csv`
  sugerem que esse importador foi planejado, porém a etapa de UI nunca foi finalizada.
- **Sem importador para Fugas/Evasões**, apesar de existir `exemplos/fugas.csv` e
  `exemplos/evasoes.csv` no repositório (mesmo formato de relatório do Portal SUASE).
- **Sem importador para oficinas/atendimentos coletivos**: `exemplos/fbtOficinas.csv`
  não corresponde a nenhuma função de importação existente.
- **Abas legadas (`CursosLegado`, `SaidasLegado`) não documentadas na interface**: depois
  de migradas, ficam na planilha sem qualquer indicação visual ou aviso ao usuário do
  sistema web, podendo confundir quem acessa a planilha diretamente.

---

## Sugestões de melhoria e roadmap

### Prioridade alta

1. **Implementar exclusão na interface**, reaproveitando `excluirRegistro`, com:
   - confirmação explícita (modal), especialmente por se tratar de dados sensíveis de
     adolescentes;
   - verificação de dependências antes de excluir (ex.: bloquear ou avisar ao excluir
     um Curso/Saída que ainda possua matrículas vinculadas, ou excluir em cascata de
     forma explícita e auditada);
   - preferir **exclusão lógica** (`Ativo = Sim/Não` ou coluna `Excluído em`) a uma
     exclusão física, para manter histórico e permitir auditoria/recuperação.
2. **Controle de acesso global**: já existe controle de acesso pontual para
  credenciais profissionais de socioeducandos (campo e endpoint restritos ao e-mail
  autorizado). Porém, o restante do sistema ainda não possui uma camada completa de
  perfis/papéis em `doGet` e em todas as RPCs. Dado que o sistema trata dados
  sensíveis de adolescentes em medida socioeducativa, é recomendável:
   - restringir o deploy a "somente pessoas da organização" (configuração de
     implantação do Apps Script) e/ou
   - validar `Session.getActiveUser().getEmail()` contra uma lista de usuários
     autorizados/perfis (leitura vs. edição) antes de executar operações de escrita.

### Prioridade média

3. **Concluir ou remover o importador de Cursos**: ou finalizar a tela de importação
   (reaproveitando `parsearCsvCursos`/`confirmarImportarCursos`) ou remover o código
   morto para reduzir superfície de manutenção.
4. **Novos importadores** para Fugas/Evasões e Oficinas, já que os exemplos de CSV já
   existem no repositório e sugerem um caso de uso real do Portal SUASE.
6. **Estender a verificação de conflitos de agenda** para considerar também os
    horários de `Cursos` (hoje só cruza Saídas × Atendimentos), evitando que um
    socioeducando fique escalado para uma saída no mesmo horário de uma aula.
7. **Indicar visualmente as abas legadas** (ex.: página de administração dentro do
    próprio Web App listando abas legadas e permitindo exportar/arquivar).

### Prioridade baixa / técnica

8. **Modularizar o frontend**: `PartialMainScripts.html` está em um único arquivo com
    milhares de linhas; separar por domínio (ex.: `Scripts.Socioeducando.html`,
    `Scripts.Cursos.html`, `Scripts.Saidas.html`) incluídos via `include()` facilitaria
    manutenção e revisão de código.
9. **Testes automatizados**: não há suíte de testes. Funções puras de `Code.gs`
    (formatação de datas, cálculo de conflitos, parsers de CSV) são boas candidatas
    para testes unitários usando `clasp` + um runner local (Jest/Vitest) simulando os
    objetos globais do Apps Script.
10. **Histórico de alterações (audit log)**: hoje só se sabe *quem editou por último*;
    considerar uma aba de log (ação, tabela, ID, usuário, timestamp, diff) para
    rastreabilidade completa, especialmente relevante em contexto de dados protegidos
    de menores.
11. **Notificações/lembretes**: nenhuma automação de e-mail/agenda avisa sobre saídas
    do dia, atendimentos não realizados pendentes de reposição ou cursos com inscrição
    prestes a encerrar — hoje isso depende de o usuário abrir o Painel Geral/página de
    Cursos manualmente.
12. **Paginação/filtros nas tabelas do perfil**: socioeducandos com histórico extenso
    (muitos atendimentos/saídas/cursos) terão tabelas longas sem paginação, busca ou
    ordenação dentro do próprio perfil.
