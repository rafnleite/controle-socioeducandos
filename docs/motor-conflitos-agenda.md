# Motor de Conflitos de Agenda

Este documento descreve a implementacao atual do motor de conflitos em `Code.gs`, com foco nas regras para cursos e trabalhos (recorrentes por dia da semana e horario).

## 1. Objetivo

Detectar sobreposicoes de agenda por socioeducando ao salvar:
- Atendimentos
- Saidas
- Cursos
- Trabalhos

A funcao de entrada e `verificarConflitosAgenda(payload)`.

## 2. Estrutura de entrada

`payload` esperado:

```js
{
  itens: [
    {
      linha: 1,
      socioeducando_id: "28876",
      // item pontual
      data_hora_inicio: "2026-08-03T08:00",
      data_hora_termino: "2026-08-03T12:00"

      // ou item recorrente
      // recorrencia_tipo: "curso" | "trabalho",
      // data_inicio: "2026-08-03",
      // data_termino: "", // vazio = sem fim
      // horario_inicio: "08:00",
      // horario_termino: "16:00",
      // dias_semana: "1;2;3;4;5"
    }
  ],
  ignorados: {
    saida_matricula_id: "...",
    atendimento_id: "...",
    curso_matricula_id: "...",
    curso_id: "...",
    trabalho_id: "..."
  }
}
```

## 3. Regra base de sobreposicao

A funcao `_intervalosConflitam(aInicio, aFim, bInicio, bFim)` usa intervalo aberto:

- Conflito se: `aInicio < bFim && bInicio < aFim`
- Encostar no limite **nao** conflita.

Exemplo:
- Atividade A termina 10:00, B comeca 10:00 -> sem conflito.

## 4. Fluxo geral

1. `verificarConflitosAgenda` normaliza `ignorados`.
2. Coleta contexto minimo por socioeducando com `_coletarContextoConflitosAgenda`:
   - socioeducandos (nomes)
   - saidas + matriculas
   - atendimentos
   - cursos + matriculas
   - trabalhos
   - mapa de ausencias em `CURSO_EVENTOS` (apenas para checagens pontuais contra curso)
3. Para cada item:
  - Se `recorrencia_tipo` for `"curso"` ou `"trabalho"`: usa `_conflitosItemRecorrente`
  - Senao (item pontual): usa `_listarConflitosAgendaParaItem`
4. Em paralelo, compara tambem itens novos entre si no mesmo `payload` (intra-operacao):
  - pontual x pontual
  - recorrente x pontual
  - recorrente x recorrente

Retorno:

```js
{
  conflitos: [
    {
      linha: 1,
      socioeducando_id: "28876",
      socioeducando_nome: "...",
      conflitos: [
        { tipo, id, descricao, inicio, termino }
      ]
    }
  ],
  total_conflitos: 2
}
```

## 5. Itens pontuais (atendimento/saida)

`_listarConflitosAgendaParaItem` verifica, nessa ordem:
- `_conflitosSaidasParaItem`
- `_conflitosAtendimentosParaItem`
- `_conflitosCursosParaItem`
- `_conflitosTrabalhosParaItem`

### 5.1 Contra saidas e atendimentos

Checagem direta de intervalo x intervalo com `_intervalosConflitam`.

### 5.2 Contra cursos

`_conflitosCursosParaItem` monta a recorrencia do curso e chama `_encontrarConflitoCurso(curso, inicio, termino, ...)`.

Regras:
- So matriculas com `matriculado=true`.
- Se houver termino de vinculo (`tipo_termino` + `data_termino`), o fim efetivo do curso para aquele socioeducando e truncado.
- Ausencia em `CURSO_EVENTOS` com `ausente=true` ignora aquele dia especifico na checagem pontual.

Implementacao atual de `_encontrarConflitoCurso`:
- Intersecta faixa de datas
- Percorre dia a dia **dentro da faixa do item pontual**
- Aplica filtro de dia da semana + horario

Observacao: como itens pontuais costumam ter faixa curta (horas ou poucos dias), esse loop fica limitado.

### 5.3 Contra trabalhos existentes

`_conflitosTrabalhosParaItem` usa a mesma estrategia de `_encontrarConflitoCurso`.

Regras:
- `data_fim` vazio em trabalho existente e tratado como `9999-12-31`.

## 6. Item recorrente (curso ou trabalho)

Quando o frontend envia:

```js
{
  recorrencia_tipo: "trabalho",
  data_inicio,
  data_termino, // pode ser vazio
  horario_inicio,
  horario_termino,
  dias_semana
}
```

entra em `_conflitosItemRecorrente`.

### 6.1 Contra atendimentos e saidas

Usa `_conflitoRecorrenciaComIntervalo(rec, inicio, termino)`.

Nao varre dia a dia nem semana a semana. A logica e:
- Interseccao de vigencia (data_inicio/data_termino da recorrencia x intervalo do evento)
- Para cada dia da semana permitido (maximo 7), monta uma ocorrencia base
- Usa formula de progressao semanal para achar existencia de conflito:
  - `occIni(k) = occIniBase + k * 7dias`
  - `occFim(k) = occFimBase + k * 7dias`
  - existe conflito se existir `k` inteiro com sobreposicao de intervalo aberto
- Retorna a primeira ocorrencia conflitante calculada

### 6.2 Contra cursos e trabalhos

Usa `_conflitoEntreRecorrencias(c1, c2)`.

Tambem sem varredura diaria longa. A logica e:
- Interseccao de vigencia das duas recorrencias
- Interseccao de faixa de horario
- Interseccao de dias da semana
- Calcula a primeira data valida (maximo 7 tentativas para achar o proximo dia da semana compativel)

Quando o comparado recorrente e um curso existente, o motor pode aplicar excecoes de ausencia em `CURSO_EVENTOS`:
- primeiro verifica se existe data candidata no intervalo de sobreposicao
- se existir, testa se aquela data esta marcada como ausencia
- se estiver, avanca para a proxima ocorrencia semanal daquele mesmo dia
- so confirma conflito quando encontra uma ocorrencia nao marcada como excecao

Esse e o trecho que substitui a estrategia ineficiente de iteracao dia a dia em janelas longas/abertas.

## 7. Como sua regra de negocio esta representada

Cenario: novo trabalho `Seg-Sex 08:00-16:00`, inicio `03/08/2026`, sem data fim.

O motor faz:

1. Atendimentos
- Para cada atendimento do socioeducando, verifica se:
  - data/hora do atendimento cruza a vigencia do trabalho (a partir de 03/08/2026)
  - dia da semana do atendimento esta em Seg-Sex
  - horario cruza 08:00-16:00

2. Saidas
- Mesma regra acima, item a item.

3. Cursos
- Para cada curso matriculado ativo:
  - curso nao pode ter terminado antes de 03/08/2026
  - precisa haver interseccao de dias da semana
  - precisa haver interseccao de horario

4. Trabalhos existentes
- Mesma logica de recorrencia x recorrencia (dias + horario + vigencia).

## 8. Complexidade (resumo)

- Recorrencia x recorrencia: O(1) por comparacao (operacoes de data/hora + no maximo busca de 7 dias).
- Recorrencia x pontual: O(k) por comparacao, com `k <= 7` (dias ativos da recorrencia), sem loop proporcional ao numero de semanas.
- Pontual x pontual: O(1) por comparacao.
- Itens do mesmo payload (intra-operacao): O(n^2) no numero de itens enviados na mesma chamada.
- Nao ha mais loop proporcional ao numero de dias em vigencia aberta para esses casos.

## 9. Pontos de atencao para validacao funcional

1. Ausencias de curso (`CURSO_EVENTOS`) hoje sao consideradas em conflito pontual x curso.
- Em conflito recorrente x recorrente contra curso existente, ausencias tambem podem ser consideradas por data da ocorrencia candidata.

2. Horarios sem inicio/fim
- Em algumas funcoes auxiliares, ausencia de horario vira faixa de dia inteiro.
- No caso de `recorrencia_tipo` (`curso` ou `trabalho`), o fluxo atual exige horario e dias para entrar nessa checagem.

3. Virada de dia (overnight)
- O modelo presume janela no mesmo dia (`inicio <= termino` no dia).
- Escalas atravessando meia-noite nao sao tratadas como caso especifico.

## 10. Mapa das funcoes principais

- Entrada:
  - `verificarConflitosAgenda`
- Contexto:
  - `_coletarContextoConflitosAgenda`
- Item pontual:
  - `_listarConflitosAgendaParaItem`
  - `_conflitosSaidasParaItem`
  - `_conflitosAtendimentosParaItem`
  - `_conflitosCursosParaItem`
  - `_conflitosTrabalhosParaItem`
- Recorrencia:
  - `_conflitosItemRecorrente`
  - `_conflitoRecorrenciaComIntervalo`
  - `_conflitoEntreRecorrencias`
- Intra-operacao (itens novos entre si):
  - `_conflitosEntreItensPayload`
  - `_conflitoEntreItensPayload`

---

Se voce quiser, no proximo passo eu acrescento neste mesmo documento uma secao de "casos de teste esperados" (entrada -> conflito esperado) para cada combinacao: trabalho x atendimento, trabalho x saida, trabalho x curso e trabalho x trabalho.
