# Bugs conhecidos e suas soluções

---

## Flatpickr: calendário com 9 colunas em vez de 7

### Sintoma
O calendário do date picker renderiza com 9 células por linha, desalinhando os números dos dias com os cabeçalhos Dom–Sáb.

### Causa raiz
O `.dayContainer` do flatpickr usa `flex-wrap: wrap` com `flex-basis: 14.2857%` (= 100%/7) em cada `.flatpickr-day`, mais uma restrição de `max-width`. O container tem largura padrão de **307,875 px**.

Quando o CSS customizado reduz `max-width` abaixo de `307,875 / 7 ≈ 44 px`, o flex passa a usar `max-width` como base de quebra de linha em vez de `flex-basis`:

- `max-width: 34px` → `9 × 34 = 306 px < 307,875 px` → **9 células por linha** ❌
- `max-width: 39px` (padrão flatpickr) → `8 × 39 = 312 px > 307,875 px` → **7 células por linha** ✅

### Solução
Sempre que `max-width` de `.flatpickr-day` for customizado, ajustar o container para que **exatamente 7 células caibam por linha**:

```css
/* Tamanho da célula */
.flatpickr-day {
  max-width: 34px;
  width: 34px;
  flex-basis: 34px;
  height: 34px;
  line-height: 34px;
}
/* Container = 7 × tamanho da célula (7 × 34 = 238px) */
.dayContainer       { width: 238px; min-width: 238px; max-width: 238px; }
.flatpickr-days     { width: 238px; }
.flatpickr-weekdays { width: 238px; }
.flatpickr-calendar:not(.hasTime) { width: 252px; }
```

### Regra geral
> **tamanho da célula × 7 deve ser igual à largura do container.**  
> Se mudar um, mudar o outro.

---

## Campos duplicados no formulário

### Sintoma
Um campo aparece mais de uma vez no mesmo formulário (ex.: "Número de vagas" aparecendo 3 vezes).

### Causa raiz
Patches sucessivos de edição adicionaram o mesmo bloco HTML mais de uma vez na string de renderização do formulário em JavaScript.

### Solução
Buscar a string do campo no arquivo (`grep`) e remover as ocorrências duplicadas, mantendo apenas uma.

---

## Painel Geral lento após inclusão de deleção lógica

### Sintoma
O `Painel Geral` passou a demorar muitos segundos para abrir após a introdução das
colunas de deleção lógica e do filtro por registros ativos.

### Causa raiz
O problema principal não estava no `filter()` em si, mas no acoplamento entre leitura e
manutenção estrutural:

- getters de colunas (`get*Cols()`) disparavam garantias de schema (`ensure*`) durante a
  leitura normal;
- o mesmo request relia cabeçalhos, abas e mapeamentos várias vezes;
- `carregarOverview()` esperava `carregarAtividadesDia()` concluir antes de renderizar
  qualquer parte do painel.

### Solução aplicada
- cache por execução para `Sheet`, cabeçalhos, linhas brutas, linhas ativas e mapas de
  colunas;
- desligamento das garantias estruturais no caminho crítico de leitura
  (`EXECUTAR_GARANTIAS_ESTRUTURAIS_EM_LEITURAS = false`);
- carregamento assíncrono do bloco `Resumo do dia` após o primeiro render do painel;
- instrumentação com `console.time()` no frontend e métricas `_perf_overview` /
  `_perf_atividades_dia` no backend para diagnosticar novas regressões.

### Regra prática
> Migração/normalização de schema deve rodar em `inicializarPlanilha()` ou em rotina de
> manutenção explícita. O runtime normal das telas deve priorizar leitura pura.
