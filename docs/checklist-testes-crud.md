# Checklist de Testes de CRUD — por formulário

> Roteiro de testes manuais, organizado por tela/formulário. Marque cada item ao
> validar. Sempre que possível, teste também os "cenários de erro" listados junto
> com cada ação (mensagens de validação devem aparecer, e nenhum registro inválido
> deve ser gravado).

---

## 1. Socioeducandos

### 1.0 Painel Geral (overview)
- [ ] Tabela do painel exibe colunas na ordem: ID, Nome, Status, Internado desde, Idade, Escolaridade, E-mail, Resumo.
- [ ] Coluna **Resumo** mostra pill de cursos com ícone + quantidade de cursos ativos.
- [ ] Ao clicar na pill de cursos, abre modal com os cursos ativos do socioeducando (tipo, curso, local, período e horário).
- [ ] No modal de cursos do overview, não existe ação de edição (modal somente leitura/consulta).
- [ ] Quando houver vínculos de trabalho ativos, a coluna **Resumo** mostra uma pill por empresa empregadora.
- [ ] Ao clicar em uma pill de trabalho, abre modal com os detalhes do vínculo selecionado (tipo, empresa, curso, contrato, início/fim e horário).
- [ ] No modal de trabalho, a ação **Abrir vínculo** abre a edição do trabalho correto (mesmo ID do pill clicado).
- [ ] Quando o socioeducando não tiver nenhuma visita territorial registrada, aparece a pill `SEM VISITA TERRITORIAL` na coluna Resumo.
- [ ] Ao cadastrar a primeira visita territorial de um socioeducando, a pill `SEM VISITA TERRITORIAL` deixa de aparecer no overview após atualizar o painel.
- [ ] Quando o socioeducando não tiver saída cultural realizada, aparece a pill `NÃO FEZ SAÍDA CULTURAL`.
- [ ] Linhas de socioeducandos sem saída cultural realizada aparecem destacadas visualmente.
- [ ] Ao registrar uma saída cultural como realizada (ou com retorno), o alerta de saída cultural deixa de aparecer no overview após atualizar o painel.
- [ ] Filtro **Sem visita territorial** (Todos/Sim/Não) aplica corretamente na tabela de socioeducandos.
- [ ] Filtro **Sem saída cultural** (Todos/Sim/Não) aplica corretamente na tabela de socioeducandos.
- [ ] **Resumo do dia** exibe card/lista de **Aniversariantes** quando houver socioeducandos que façam aniversário na data selecionada.

### 1.1 Importar Socioeducandos (CSV — "Documentos Pessoais" do SUASE)
- [ ] Selecionar CSV válido → pré-visualização mostra corretamente novos vs. já existentes.
- [ ] Desmarcar um socioeducando na pré-visualização → não é importado.
- [ ] Editar a "Data de Nascimento" (opcional) na tabela antes de confirmar → valor é salvo.
- [ ] Confirmar importação → socioeducandos novos aparecem em `Socioeducandos`; admissão é criada automaticamente para quem tem `Data de admissão`.
- [ ] Importar novamente o mesmo arquivo → todos aparecem como "já cadastrados" (nenhum duplicado é criado).
- [ ] Arquivo sem colunas obrigatórias (ID, Nome, Data de admissão) → erro claro, sem gravar nada.
- [ ] Arquivo vazio / nenhum novo registro → mensagem "Nenhum novo socioeducando encontrado".

### 1.2 Atualizar Escolaridade (CSV)
- [ ] Selecionar CSV válido → pré-visualização mostra "Atual" vs "Nova" e marca só quem mudou.
- [ ] Confirmar → `Escolaridade` é atualizada apenas para os selecionados.
- [ ] Desmarcar um item com mudança → não é atualizado.
- [ ] ID do CSV que não existe em `Socioeducandos` → é ignorado/sinalizado, sem erro fatal.

### 1.3 Cadastrar Socioeducando (manual)
- [ ] Preencher ID (SUASE), Nome, Escolaridade, Data de Nascimento (opcional), Data de admissão → salva com sucesso.
- [ ] Nome salvo é convertido automaticamente para **MAIÚSCULAS**, independente de como foi digitado.
- [ ] (Usuário autorizado) Preencher **E-mail profissional** e **Senha profissional** no cadastro → salva com sucesso e a coluna `Senha Profissional (Criptografada)` não armazena texto puro.
- [ ] (Usuário não autorizado) Campos de e-mail/senha não aparecem na UI de cadastro.
- [ ] Não informar "Data de admissão" → erro "Data de admissão é obrigatória." (bloqueado no cliente e no servidor).
- [ ] Informar Data de admissão futura → erro "Data de admissão não pode ser futura." (campo já tem `max` = hoje no calendário).
- [ ] ID que já existe e está **internado (ativo)** → erro bloqueando: "Já existe um socioeducando com o ID ..., atualmente internado.".
- [ ] ID que já existe mas está **desligado** → não cria duplicado; mostra tela "Socioeducando já cadastrado" com os dados atuais e pergunta se deseja registrar uma nova admissão.
  - [ ] Confirmar → cria apenas uma nova linha em `Admissoes` para o socioeducando existente (nenhuma linha nova em `Socioeducandos`).
  - [ ] Cancelar → volta ao formulário de cadastro em branco, sem gravar nada.
- [ ] ID inválido (vazio, não numérico, ≤ 0) → erro de validação.
- [ ] Nome vazio → erro "Nome é obrigatório.".
- [ ] Data de nascimento futura → erro "Data de nascimento não pode ser futura.".
- [ ] Após salvar, `Registrado em` e `Criado por` são preenchidos automaticamente.

### 1.4 Editar Socioeducando
- [ ] Tela de edição mostra o **ID como texto simples** (não como campo de formulário editável).
- [ ] Alterar Nome/Escolaridade/Data de Nascimento → salva e reflete no perfil.
- [ ] Alterar **E-mail profissional** (usuário autorizado) → salva e reflete no perfil/painel geral.
- [ ] Informar nova **Senha profissional** (usuário autorizado) → atualiza o valor criptografado; deixar senha em branco mantém a senha anterior.
- [ ] (Usuário não autorizado) não consegue alterar credenciais (nem por UI, nem por chamada direta ao backend).
- [ ] Nome editado também é convertido para MAIÚSCULAS ao salvar.
- [ ] `Registrado em`/`Criado por` originais são preservados (não sobrescritos).
- [ ] `Atualizado por` passa a refletir o usuário que editou.
- [ ] ID não é editável (não enviado no formulário de edição, apenas exibido).

### 1.5 Visualizar credenciais no perfil
- [ ] (Usuário autorizado) botão **Ver credenciais** aparece no perfil e abre modal com e-mail profissional + senha descriptografada.
- [ ] (Usuário não autorizado) botão **Ver credenciais** não aparece no perfil.
- [ ] Tentativa de chamar `obterCredenciaisSocioeducando` sem permissão retorna erro de autorização.

---

## 2. Admissões

- [ ] Cadastrar admissão manual (sem passar pelo cadastro do socioeducando) → nova linha em `Admissoes`.
- [ ] Data de admissão futura (cadastro ou edição) → erro "Data de admissão não pode ser futura." (campo com `max` = hoje).
- [ ] Tentar criar uma 2ª admissão ativa para o mesmo socioeducando (sem desligar a anterior) → erro bloqueando.
- [ ] Data de desligamento anterior à data de admissão → erro de validação.
- [ ] Editar uma admissão existente (corrigir data digitada errada) → salva; `Atualizado por` é preenchido.
- [ ] **Desligar socioeducando** (registrar desligamento a partir de uma admissão ativa) → `Data Desligamento` preenchida; status do socioeducando muda de "internado" para "desligado".
- [ ] Desligamento com data anterior à admissão → erro de validação.
- [ ] Após desligamento, tentar registrar nova admissão → deve ser permitido (não há mais admissão ativa).
- [ ] Após desligamento, tentar registrar nova admissão com **data anterior à data de desligamento** → erro "A data de admissão não pode ser anterior ao último desligamento registrado (...)".
- [ ] Nova admissão com data igual ou posterior ao último desligamento → permitido normalmente.
- [ ] Mesma validação vale ao **editar** uma admissão existente, considerando o último desligamento de outras admissões do socioeducando (não conta o desligamento da própria admissão sendo editada).
- [ ] Fluxo de **readmissão** (socioeducando desligado → "cadastrar nova admissão" a partir da tela de cadastro) com data anterior ao desligamento → mesmo erro é exibido.

---

## 3. Fugas / Evasões

- [ ] Cadastrar fuga/evasão (Tipo = "Fuga" ou "Evasão", Data de Saída) → nova linha em `Fugas`.
- [ ] Data de retorno anterior à data de saída → erro de validação.
- [ ] Editar um registro existente (tipo, datas, observações) → salva; `Atualizado por` preenchido.
- [ ] **Registrar retorno** de uma fuga em aberto → `Data Retorno` preenchida.
- [ ] Registrar retorno com data anterior à saída → erro de validação.
- [ ] Status do socioeducando reflete "ausente" enquanto a fuga estiver sem retorno.

---

## 4. Cursos / Matrículas em Curso

### 4.1 Cadastro individual (Curso + Matrícula, a partir do perfil)
- [ ] Criar novo curso vinculando um socioeducando → cria linha em `Cursos` **e** em `CursoMatriculas`.
- [ ] Campos obrigatórios (tipo, nome, datas, horários, dias da semana) → erro se algum faltar.
- [ ] Data/horário de término anterior ao início → erro "A data de término não pode ser anterior à data de início.".
- [ ] Editar um curso existente (a partir de uma matrícula) → atualiza `Cursos` e `CursoMatriculas` sem duplicar linhas.
- [ ] Alterar o `Status do vínculo` (Interessado/Matriculado) → cor do select muda de acordo.
- [ ] `Registrado em`/`Criado por` preservados na edição; `Atualizado por` atualizado.

### 4.2 Cadastro em lote (vários socioeducandos no mesmo curso)
- [ ] Selecionar vários socioeducandos, cada um com status próprio (Interessado/Matriculado) → gera 1 `Curso` e N `CursoMatriculas`.
- [ ] Filtro por interesse de curso na lista de seleção → filtra corretamente.
- [ ] Nenhum socioeducando com status definido → curso é criado sem vínculos.
- [ ] Contador de selecionados atualiza corretamente ao marcar/desmarcar.

### 4.3 Registrar/desfazer término de matrícula (conclusão ou desistência)
- [ ] Registrar término como "Concluído" (informar data + certificado) → `Tipo de Término`/`Data de Término`/`Certificado` preenchidos.
- [ ] Registrar término como "Desistente" (informar data) → `Tipo de Término`/`Data de Término` preenchidos, permitindo saber exatamente até quando o socioeducando frequentou o curso.
- [ ] Desfazer término → campos voltam a vazio/false.

### 4.4 Interesses de Curso
- [ ] Adicionar interesse pelo perfil do socioeducando → aparece como chip; grava em `InteressesCurso`.
- [ ] Adicionar interesse duplicado (mesmo texto, case-insensitive) para o mesmo socioeducando → erro bloqueando duplicidade.
- [ ] Remover (excluir) um interesse pelo chip → linha removida (exclusão física).
- [ ] Cadastro de interesse em lote (vários socioeducandos, um texto) → ignora silenciosamente quem já tem o mesmo interesse; conta inseridos/ignorados corretamente.
- [ ] Interesses aparecem corretamente na tela de Curso em Lote (nome + interesses) e no filtro por interesse.

### 4.5 Evento diário do curso (calendário do perfil)
- [ ] No calendário do perfil, clicar em uma ocorrência de curso abre o modal de evento diário.
- [ ] Salvar `Ausente = true` para um dia do curso cria registro em `CursoEventos` com a data correta e o `ID Curso Matrícula` do vínculo exibido no calendário.
- [ ] Salvar observação sem marcar ausente também cria/atualiza o registro diário normalmente.
- [ ] Reabrir o mesmo dia no calendário mostra os dados persistidos (ausente e observações).
- [ ] Curso marcado como ausente é exibido no calendário com cor menos saturada e, quando houver, a observação aparece no evento.
- [ ] Salvar ou excluir o evento diário atualiza somente o calendário, sem recarregar o perfil inteiro.
- [ ] Excluir o evento diário remove a marcação para aquele dia (sem afetar curso/matrícula).
- [ ] Com `Ausente = true` no dia, o motor de conflitos ignora aquela ocorrência de curso para novas verificações no mesmo intervalo.
- [ ] Em uma planilha legada, a migração converte `ID Curso` + `ID Socioeducando` para `ID Curso Matrícula` quando houver uma matrícula correspondente.

### 4.6 Exclusão lógica de curso
- [ ] A ação `Excluir` na página de Cursos pede confirmação.
- [ ] Após confirmar, `Cursos.Deletado em` e `Cursos.Deletado por` são preenchidos e nenhuma linha é removida fisicamente.
- [ ] O curso excluído deixa de aparecer na página de Cursos, no perfil do socioeducando, nos relatórios e nas verificações de conflitos.

---

## 5. Saídas / Vínculos de Saída

### 5.0 Alertas de encerramento no painel geral
- [ ] Curso encerrado com matrícula `Matriculado` sem `Tipo de Término` e/ou `Data de Término` → aparece no topo como alerta.
- [ ] Saída com `Data/Hora Volta` passada e matrícula sem `Retorno` → aparece no topo como alerta agrupado por saída.
- [ ] Oficina encerrada com matrícula sem `Realizada` → aparece no topo como alerta.
- [ ] Navegação dos alertas exibe `Alerta 1 de N` e permite avançar/voltar com as setas.
- [ ] Alerta de curso abre a edição em lote das matrículas do curso.
- [ ] Alerta de oficina abre a edição das matrículas da oficina.
- [ ] Alerta de saída abre modal com todos os socioeducandos pendentes e permite salvar `Retorno` e observações em lote.

### 5.1 Cadastro individual (Saída + Vínculo, a partir do perfil)
- [ ] Criar nova saída vinculando um socioeducando (Local, **Tipo**, Data de saída, Horário de saída, Data de retorno, Horário de retorno, Condução, **Nome do acompanhante**, Status) → cria linha em `Saidas` e `SaidaMatriculas`.
- [ ] Ao informar a data de saída com a data de retorno vazia, a data de retorno é preenchida automaticamente com a mesma data.
- [ ] Data/Hora de volta anterior à ida → erro de validação.
- [ ] Campos obrigatórios (Local, **Tipo**, Data/Hora Ida, **Data/Hora Volta**, Condução, Status) → erro se algum faltar.
- [ ] Editar uma saída existente → atualiza sem duplicar; `Atualizado por` preenchido.
- [ ] Preencher **Observações da saída** (evento, geral) e salvar → persiste em `Saidas.Observações`, distinta da observação por vínculo em `SaidaMatriculas`.
- [ ] **Verificação de conflito de agenda**: socioeducando já tem curso/saída/atendimento no mesmo horário → alerta de conflito (não bloqueia, apenas avisa).
- [ ] **Registrar volta** → `Data/Hora Volta` preenchida; validação contra data de ida.
- [ ] `Retorno` começa nulo no cadastro da matrícula.
- [ ] Informar `Retorno = Sim` ou `Não` antes do horário de saída → erro de validação.
- [ ] Informar `Retorno = Sim` após o horário de saída → salva e o resumo exibe `Retornou`.
- [ ] Informar `Retorno = Não` após o horário de saída → salva e o resumo exibe `Não retornou`.
- [ ] Deixar `Retorno` nulo, mesmo com `Data/Hora Volta` preenchida → o resumo exibe as duas datas/horas, sem afirmar retorno.

### 5.2 Cadastro em lote (vários socioeducandos na mesma saída)
- [ ] Selecionar vários socioeducandos com status individual (Prevista/Realizada/Cancelada) → 1 `Saida` + N `SaidaMatriculas`.
- [ ] Nenhum vínculo com status definido → erro bloqueando.
- [ ] Nome do(a) acompanhante vazio → erro de validação (campo obrigatório).
- [ ] Tipo vazio no formulário em lote → erro de validação (campo obrigatório).
- [ ] Data/Hora de volta vazia no formulário em lote → erro de validação (campo obrigatório).
- [ ] O formulário não oferece “observação individual padrão para todos”; observações de vínculo seguem sendo lançadas individualmente depois.
- [ ] **Verificação de conflito de agenda**: socioeducando já tem curso/saída/atendimento no mesmo horário → alerta de conflito (não bloqueia, apenas avisa).
- [ ] Ao clicar em **Cadastrar saídas** com conflitos, abrir modal detalhado com os conflitos e botões **Revisar horários** e **Cadastrar saídas mesmo assim**.
- [ ] Vínculo com `Status = "Cancelada"` → não conta como conflito de agenda em novas verificações.

---

## 6. Atendimentos

### 6.1 Cadastro (multi-linha, um ou vários socioeducandos)
- [ ] Cadastrar atendimento para 1 socioeducando (tipo, responsável, datas) → nova linha em `Atendimentos`, `Realizado = "Sim"`.
- [ ] Cadastrar em lote para várias linhas/socioeducandos numa mesma submissão → todas as linhas são criadas com IDs sequenciais.
- [ ] Data/hora de término anterior ao início → erro de validação (por linha).
- [ ] Tipo de atendimento / Responsável vazios → erro de validação.
- [ ] Duração é pré-calculada a partir do `TiposAtendimento` selecionado (mas é editável).
- [ ] **Verificação de conflito de agenda** contra cursos/saídas/outros atendimentos do mesmo socioeducando → alerta exibido.

### 6.2 Editar atendimento
- [ ] Alterar tipo/responsável/datas/observações de um atendimento existente → salva; não afeta `Realizado`/`Motivo`/`ID Atendimento Reposição`.
- [ ] `Atualizado por` é preenchido na edição.

### 6.3 Marcar como Não Realizado (gera reposição)
- [ ] Marcar atendimento como não realizado, informando motivo + nova data/hora → (a) atendimento original vira `Realizado = "Não"` com motivo preenchido; (b) novo atendimento de reposição é criado automaticamente, ligado por `ID Atendimento Reposição`.
- [ ] Tentar marcar um atendimento que já está `Realizado = "Não"` novamente → erro "Este atendimento já está marcado como não realizado.".
- [ ] Motivo vazio → erro de validação.
- [ ] Nova data/hora de término anterior ao início → erro de validação.
- [ ] Cadeia de reposições (reposição de uma reposição) permanece rastreável via `ID Atendimento Reposição`.

---

## 7. Trabalhos

### 7.1 Cadastro individual (sem lote)
- [ ] Abrir por **Cadastrar ▾ → Trabalho** e registrar vínculo com: socioeducando, tipo (Trabalho/Aprendizagem), empresa, data de contrato e data de início.
- [ ] Campo `Curso` opcional: deixar vazio e salvar normalmente.
- [ ] Informar apenas horário de início ou apenas horário de fim → erro de validação.
- [ ] Informar horário sem dias da semana → erro de validação.
- [ ] Informar dias da semana sem horários → erro de validação.
- [ ] Data de fim anterior à data de início → erro de validação.
- [ ] Salvar com sucesso → nova linha em `Trabalhos` com `Registrado em` e `Criado por` preenchidos.

### 7.2 Edição
- [ ] Abrir edição pelo perfil (aba Trabalhos, dentro do card único de registros) e alterar empresa/curso/período/horário → salva sem duplicar.
- [ ] `Registrado em`/`Criado por` são preservados na edição.
- [ ] `Atualizado em`/`Atualizado por` são preenchidos na edição.

### 7.3 Perfil
- [ ] A aba "Trabalhos" aparece no card único de registros do perfil, com listagem das relações registradas.
- [ ] Botão **Novo trabalho** cria vínculo já contextualizado ao socioeducando do perfil.
- [ ] Botão **Editar** abre o mesmo vínculo para atualização.

### 7.4 Card único com abas (perfil)
- [ ] No perfil, `Cursos`, `Atendimentos`, `Trabalhos`, `Saídas` e `Fugas/Evasões` aparecem em um único card com abas.
- [ ] Alternar entre abas troca o conteúdo sem recarregar todo o perfil.
- [ ] Contadores de cada aba refletem a quantidade de registros carregados.

### 7.5 Visitas Territoriais
- [ ] No perfil, a aba **Visitas Territoriais** aparece no card único de registros.
- [ ] Cadastrar visita territorial com `Data` e `Tec responsável` obrigatórios → cria linha em `VisitasTerritoriais`.
- [ ] Deixar `Data` vazia → erro de validação.
- [ ] Informar data futura → erro de validação.
- [ ] Deixar `Tec responsável` vazio → erro de validação.
- [ ] Campos `CREAS`, `CAPS` e `Ameaça` persistem corretamente como sim/não.
- [ ] Editar visita territorial existente pelo botão **Editar** → atualiza sem duplicar linha.
- [ ] `Registrado em`/`Criado por` são preservados na edição.
- [ ] `Atualizado em`/`Atualizado por` são preenchidos na edição.
- [ ] Contador da aba **Visitas Territoriais** reflete a quantidade de registros carregados.

---

## 8. Familiares

### 8.1 Cadastro e edição
- [ ] No perfil, clicar em **Adicionar familiar** abre modal de cadastro.
- [ ] Cadastrar familiar com `Nome` obrigatório e demais campos opcionais → cria linha em `Familiares`.
- [ ] Editar familiar existente pelo card → atualiza sem duplicar linha.
- [ ] `Registrado em`/`Criado por` são preservados na edição.
- [ ] `Atualizado em`/`Atualizado por` são preenchidos na edição.

### 8.2 Regra de principal único
- [ ] Marcar um familiar como principal → aparece destacado e em primeiro na lista.
- [ ] Marcar outro familiar como principal no mesmo socioeducando → o principal anterior é desmarcado automaticamente.
- [ ] Em qualquer momento, no máximo 1 familiar ativo permanece com `Principal = true` para o mesmo socioeducando.

### 8.3 Exclusão e atualização parcial
- [ ] Excluir familiar pelo card (com confirmação) → não remove fisicamente a linha; preenche `Deletado em`/`Deletado por`.
- [ ] Após salvar/editar/excluir familiar, apenas a seção de familiares é recarregada (sem recarregar todo o perfil).

---

## 9. Configurações — Tipos de Atendimento

- [ ] Criar novo tipo (nome + duração padrão em minutos) → aparece na lista e nos formulários de atendimento.
- [ ] Nome duplicado (mesmo nome, outro tipo) → erro "Já existe um tipo de atendimento chamado ...".
- [ ] Duração inválida (vazia, zero, negativa) → erro de validação.
- [ ] Editar nome de um tipo já em uso → nome é propagado para todos os `Atendimentos` que usavam o nome antigo.
- [ ] Editar apenas a duração (sem mudar nome) → não afeta atendimentos já registrados (duração é copiada no momento do atendimento, não referenciada dinamicamente).
- [ ] Excluir tipo **sem** atendimentos associados → remove direto.
- [ ] Excluir tipo **com** atendimentos associados (sem forçar) → erro pedindo confirmação com contagem de uso.
- [ ] Confirmar exclusão forçada (`forcar=true`) → remove do catálogo; atendimentos antigos mantêm o nome do tipo (não ficam órfãos/quebrados).

---

## 10. Validações transversais (repetir em pelo menos 2-3 telas)

- [ ] Todo registro criado tem `Registrado em` = data/hora atual e `Criado por` = usuário logado.
- [ ] Todo registro editado tem `Atualizado em` preenchido e `Atualizado por` atualizado, mas `Registrado em`/`Criado por` preservados, exceto nas tabelas `TiposAtendimento` e `InteressesCurso`, que não usam esses campos.
- [ ] Tentar salvar qualquer formulário referenciando um `ID Socioeducando` inexistente (ex.: id removido/forjado) → erro "Socioeducando com ID ... não encontrado." (`validarSocioeducandoExiste`).
- [ ] Coluna de senha em `Socioeducandos` nunca expõe senha em texto puro; valor deve permanecer criptografado na planilha.
- [ ] Com usuário diferente da chave de criptografia original, a descriptografia retorna vazio/falha segura (sem revelar senha).
- [ ] Em `Familiares`, exclusões preenchem `Deletado em`/`Deletado por` (deleção lógica).
- [ ] Nas demais entidades com botão de exclusão, validar o comportamento esperado (físico ou lógico) conforme o fluxo específico.

---

## 11. Fora de escopo nesta rodada (backend existe, sem UI dedicada)

- Edição do **texto** de um interesse de curso já existente (`salvarInteresseCurso` aceita `dados.id`, mas a UI só permite adicionar/remover chips, não editar in-place).
