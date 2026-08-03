// =============================================================
// Sistema de Controle de Unidade Socioeducativa
// Google Apps Script — Code.gs
// =============================================================

var SHEETS = {
  SOCIOEDUCANDOS:   'Socioeducandos',
  CURSOS:           'Cursos',
  CURSO_MATRICULAS: 'CursoMatriculas',
  CURSO_EVENTOS:    'CursoEventos',
  TRABALHOS:        'Trabalhos',
  VISITAS_TERRITORIAIS: 'VisitasTerritoriais',
  FAMILIARES:       'Familiares',
  ADMISSOES: 'Admissoes',
  FUGAS:     'Fugas',
  SAIDAS:    'Saidas',
  SAIDA_MATRICULAS: 'SaidaMatriculas',
  ATENDIMENTOS: 'Atendimentos',
  TIPOS_ATENDIMENTO: 'TiposAtendimento',
  INTERESSES_CURSO: 'InteressesCurso'
};

var TIPOS_ATENDIMENTO_PADRAO = [
  { tipo: 'Psicológico', duracao_minutos: 50 },
  { tipo: 'Pedagogo', duracao_minutos: 50 },
  { tipo: 'Jurídico', duracao_minutos: 60 },
  { tipo: 'Assistência Social', duracao_minutos: 60 },
  { tipo: 'Educação Física', duracao_minutos: 60 },
  { tipo: 'Enfermagem', duracao_minutos: 30 }
];

var TIPOS_SAIDA_PADRAO = ['Cultural', 'Familiar', 'Lazer', 'Esportiva', 'Descida para casa', 'Outros'];
var EMAIL_ADMIN_CREDENCIAIS = 'luizasoarespedagoga@gmail.com';

var _SHEET_CACHE = {};
var _HEADER_CACHE = {};
var _ROWS_CACHE = {};
var _ACTIVE_ROWS_CACHE = {};
var _COLS_CACHE = {};
var EXECUTAR_GARANTIAS_ESTRUTURAIS_EM_LEITURAS = false;

function maybeEnsureOnRead(fn) {
  if (EXECUTAR_GARANTIAS_ESTRUTURAIS_EM_LEITURAS) fn();
}

// ── Menu ──────────────────────────────────────────────────────
function onOpen() {
  SpreadsheetApp.getUi()
    .createMenu('Socioeducativo')
    .addItem('Abrir Sistema', 'abrirSistema')
    .addSeparator()
    .addItem('Inicializar Planilha (primeira vez)', 'inicializarPlanilha')
    .addItem('Proteger abas contra edição direta', 'protegerAbas')
    .addToUi();
}

// ── Web App ───────────────────────────────────────────────────
// Acesse: exec                          → Painel Geral
//         exec?page=perfil&id=12345     → Perfil do socioeducando
//         exec?page=atendimento         → Registrar Atendimento
//         exec?page=atendimento&id=ID   → Atendimento pré-selecionado
//         exec?page=saida               → Saída em lote
//         exec?page=curso               → Curso em lote
//         exec?page=importar            → Importar dados
function doGet(e) {
  var params = (e && e.parameter) ? e.parameter : {};
  var page = String(params.page || 'overview').toLowerCase();
  var id   = String(params.id   || '');

  var template = HtmlService.createTemplateFromFile('Main');
  template.paginaInicial = page;
  template.idInicial     = id;
  template.emailUsuario  = usuarioAtual();
  template.appUrl        = ScriptApp.getService().getUrl();

  return template.evaluate()
    .setTitle('Sistema Socioeducativo')
    .addMetaTag('viewport', 'width=device-width, initial-scale=1')
    .setXFrameOptionsMode(HtmlService.XFrameOptionsMode.ALLOWALL);
}

function abrirSistema() {
  var tpl = HtmlService.createTemplateFromFile('Main');
  tpl.paginaInicial = 'overview';
  tpl.idInicial     = '';
  tpl.emailUsuario  = usuarioAtual();
  tpl.appUrl        = '';
  var html = tpl.evaluate()
    .setTitle('Sistema Socioeducativo')
    .setWidth(1600)
    .setHeight(980);
  SpreadsheetApp.getUi().showModalDialog(html, 'Sistema Socioeducativo');
}

function include(filename) {
  return HtmlService.createHtmlOutputFromFile(filename).getContent();
}

// ── Inicialização ─────────────────────────────────────────────
function inicializarPlanilha() {
  var ss = SpreadsheetApp.getActiveSpreadsheet();

  var configs = [
    {
      nome: SHEETS.SOCIOEDUCANDOS,
      headers: ['ID (SUASE)', 'Nome', 'Data de Nascimento', 'Escolaridade', 'E-mail Profissional', 'Senha Profissional (Criptografada)', 'Registrado em', 'Criado por', 'Atualizado em', 'Atualizado por', 'Deletado em', 'Deletado por'],
      widths:  [100, 280, 130, 200, 220, 260, 130, 180, 130, 180, 130, 180]
    },
    {
      nome: SHEETS.CURSOS,
      headers: ['ID', 'Tipo de Curso', 'Nome do Curso', 'Data Início', 'Horário Início', 'Data Término', 'Horário Término', 'Dias da Semana', 'Instituição', 'Local', 'Vagas', 'Data Limite Inscrição', 'Observações', 'Registrado em', 'Criado por', 'Atualizado em', 'Atualizado por', 'Deletado em', 'Deletado por'],
      widths:  [50, 160, 200, 90, 90, 90, 90, 180, 180, 90, 60, 110, 220, 130, 180, 130, 180, 130, 180]
    },
    {
      nome: SHEETS.CURSO_MATRICULAS,
      headers: ['ID', 'ID Curso', 'ID Socioeducando', 'Matriculado', 'Tipo de Término', 'Data de Término', 'Certificado', 'Observações', 'Registrado em', 'Criado por', 'Atualizado em', 'Atualizado por', 'Deletado em', 'Deletado por'],
      widths:  [50, 70, 70, 90, 110, 110, 80, 220, 130, 180, 130, 180, 130, 180]
    },
    {
      nome: SHEETS.CURSO_EVENTOS,
      headers: ['ID', 'ID Curso Matrícula', 'Data', 'Ausente', 'Observações', 'Registrado em', 'Criado por', 'Atualizado em', 'Atualizado por', 'Deletado em', 'Deletado por'],
      widths:  [50, 110, 110, 80, 260, 130, 180, 130, 180, 130, 180]
    },
    {
      nome: SHEETS.ADMISSOES,
      headers: ['ID', 'ID Socioeducando', 'Data Admissão', 'Data Desligamento', 'Registrado em', 'Criado por', 'Atualizado em', 'Atualizado por', 'Deletado em', 'Deletado por'],
      widths:  [50, 70, 110, 130, 130, 180, 130, 180, 130, 180]
    },
    {
      nome: SHEETS.FUGAS,
      headers: ['ID', 'ID Socioeducando', 'Tipo', 'Data Saída', 'Data Retorno', 'Observações', 'Registrado em', 'Criado por', 'Atualizado em', 'Atualizado por', 'Deletado em', 'Deletado por'],
      widths:  [50, 70, 70, 100, 110, 250, 130, 180, 130, 180, 130, 180]
    },
    {
      nome: SHEETS.SAIDAS,
      headers: ['ID', 'Local', 'Tipo', 'Data/Hora Ida', 'Data/Hora Volta', 'Condução', 'Nome Acompanhante', 'Observações', 'Registrado em', 'Criado por', 'Atualizado em', 'Atualizado por', 'Deletado em', 'Deletado por'],
      widths:  [50, 200, 150, 130, 130, 100, 200, 250, 130, 180, 130, 180, 130, 180]
    },
    {
      nome: SHEETS.SAIDA_MATRICULAS,
      headers: ['ID', 'ID Saída', 'ID Socioeducando', 'Status', 'Observações', 'Registrado em', 'Criado por', 'Atualizado em', 'Atualizado por', 'Deletado em', 'Deletado por'],
      widths:  [50, 70, 70, 100, 250, 130, 180, 130, 180, 130, 180]
    },
    {
      nome: SHEETS.ATENDIMENTOS,
      headers: ['ID', 'ID Socioeducando', 'Tipo de Atendimento', 'Responsável', 'Data/Hora Início', 'Data/Hora Término', 'Observações', 'Registrado em', 'Criado por', 'Atualizado em', 'Atualizado por', 'Realizado', 'Motivo Não Realizado', 'ID Atendimento Reposição', 'Deletado em', 'Deletado por'],
      widths:  [50, 70, 180, 200, 150, 150, 250, 130, 180, 130, 180, 80, 250, 90, 130, 180]
    },
    {
      nome: SHEETS.TRABALHOS,
      headers: ['ID', 'ID Socioeducando', 'Tipo', 'Empresa', 'Curso', 'Data de Contrato', 'Data Início', 'Data Fim', 'Horário Início', 'Horário Fim', 'Dias da Semana', 'Registrado em', 'Criado por', 'Atualizado em', 'Atualizado por', 'Deletado em', 'Deletado por'],
      widths:  [50, 70, 130, 220, 200, 120, 110, 110, 95, 95, 180, 130, 180, 130, 180, 130, 180]
    },
    {
      nome: SHEETS.VISITAS_TERRITORIAIS,
      headers: ['ID', 'ID Socioeducando', 'Data', 'Tec Responsável', 'Atendido por', 'CREAS', 'CAPS', 'Ameaça', 'Observações', 'Registrado em', 'Criado por', 'Atualizado em', 'Atualizado por', 'Deletado em', 'Deletado por'],
      widths:  [50, 70, 110, 190, 190, 80, 80, 85, 260, 130, 180, 130, 180, 130, 180]
    },
    {
      nome: SHEETS.FAMILIARES,
      headers: ['ID', 'ID Socioeducando', 'Nome', 'Telefone', 'Tipo de Vínculo', 'Endereço', 'Principal', 'Registrado em', 'Criado por', 'Atualizado em', 'Atualizado por', 'Deletado em', 'Deletado por'],
      widths:  [50, 70, 220, 160, 170, 260, 90, 130, 180, 130, 180, 130, 180]
    },
    {
      nome: SHEETS.TIPOS_ATENDIMENTO,
      headers: ['Tipo de Atendimento', 'Duração Padrão (minutos)', 'Registrado em', 'Criado por'],
      widths:  [240, 180, 130, 180]
    },
    {
      nome: SHEETS.INTERESSES_CURSO,
      headers: ['ID', 'ID Socioeducando', 'Interesse', 'Registrado em', 'Criado por'],
      widths:  [50, 70, 220, 130, 180]
    }
  ];

  configs.forEach(function(cfg) {
    var sheet = ss.getSheetByName(cfg.nome);
    if (!sheet) sheet = ss.insertSheet(cfg.nome);
    if (sheet.getLastRow() === 0) {
      sheet.appendRow(cfg.headers);
      var hdr = sheet.getRange(1, 1, 1, cfg.headers.length);
      hdr.setFontWeight('bold').setBackground('#3c3c7a').setFontColor('white');
      sheet.setFrozenRows(1);
      cfg.widths.forEach(function(w, i) { sheet.setColumnWidth(i + 1, w); });
    } else {
      ensureSheetEstruturaByConfig(sheet, cfg.headers, cfg.widths);
    }
  });

  // Garante coluna de nascimento mesmo em planilhas antigas.
  ensureSocioeducandosNascimentoColumn();
  // Garante colunas de credenciais profissionais em socioeducandos.
  ensureSocioeducandosCredenciaisColumns();
  // Garante colunas de horário e dias da semana para cursos em planilhas antigas.
  ensureCursosEstrutura();
  // Garante colunas de Vagas/Data Limite Inscrição em Cursos em planilhas antigas.
  ensureCursosNovasColunas();
  // Garante coluna "Local" em Cursos (característica do curso, com migração
  // automática a partir do antigo campo "Matrícula" de CursoMatriculas).
  ensureCursosColunaLocal();
  // Garante coluna Status Vínculo em CursoMatriculas em planilhas antigas.
  ensureCursoMatriculasStatusVinculo();
  // Migra Status Vínculo (Interessado/Matriculado/Concluído/Desistente) para
  // os novos campos Matriculado (booleano) e Tipo de Término, e renomeia
  // Data de Conclusão → Data de Término.
  ensureCursoMatriculasMatriculadoTipoTermino();
  // Migra eventos diários de curso para a referência direta à matrícula.
  ensureCursoEventosCursoMatricula();
  // Garante coluna de observações em atendimentos em planilhas antigas.
  ensureAtendimentosObservacoesColumn();
  // Garante coluna de observações em saídas (evento) em planilhas antigas.
  ensureSaidasObservacoesColumn();
  // Garante coluna Tipo em saídas (evento) em planilhas antigas.
  ensureSaidasTipoColumn();
  // Garante colunas de controle de não realizado em atendimentos.
  ensureAtendimentosColunasNaoRealizado();
  // Garante tabela de tipos de atendimento e duração padrão.
  ensureTiposAtendimentoPadrao();
  // Garante as colunas padrão de auditoria (Registrado em/Criado por/Atualizado
  // por) e de exclusão lógica (Deletado em/Deletado por) em todas as abas.
  Object.keys(SHEETS).forEach(function(key) {
    if (SHEETS[key] === SHEETS.TIPOS_ATENDIMENTO || SHEETS[key] === SHEETS.INTERESSES_CURSO) {
      ensureColunasAuditoriaBasica(SHEETS[key]);
      return;
    }
    ensureColunasPadraoAuditoria(SHEETS[key]);
  });

  // Normaliza a ordem física das colunas em tabelas existentes.
  getSocioeducandosCols();
  getCursosCols();
  getCursoMatriculasCols();
  getCursoEventosCols();
  getAdmissoesCols();
  getFugasCols();
  getSaidasCols();
  getSaidaMatriculasCols();
  getAtendimentosCols();
  getTrabalhosCols();
  getVisitasTerritoriaisCols();
  getFamiliaresCols();
  getTiposAtendimentoCols();
  getInteressesCursoCols();

  Logger.log('Planilha inicializada com sucesso.');
}

/**
 * Garante estrutura de uma aba já existente:
 * - adiciona colunas faltantes do schema atual;
 * - reordena as colunas para a posição esperada;
 * - aplica largura padrão para as colunas conhecidas.
 */
function ensureSheetEstruturaByConfig(sheet, headersEsperados, largurasEsperadas) {
  if (!sheet || sheet.getLastRow() === 0) return;

  function norm(v) { return String(v || '').trim().toLowerCase(); }

  var alterou = false;
  var headersAtuais = sheet.getRange(1, 1, 1, sheet.getLastColumn()).getValues()[0].map(norm);

  // Adiciona colunas faltantes (inicialmente ao final).
  headersEsperados.forEach(function(nomeColuna) {
    if (headersAtuais.indexOf(norm(nomeColuna)) >= 0) return;
    var pos = sheet.getLastColumn() + 1;
    sheet.getRange(1, pos).setValue(nomeColuna);
    sheet.getRange(1, pos).setFontWeight('bold').setBackground('#3c3c7a').setFontColor('white');
    alterou = true;
    headersAtuais.push(norm(nomeColuna));
  });

  // Coloca as colunas oficiais na ordem esperada.
  ensureOrdemColunas(sheet.getName(), headersEsperados);

  // Reaplica formatação e larguras nas posições oficiais.
  headersEsperados.forEach(function(nomeColuna, i) {
    var col = i + 1;
    var cel = sheet.getRange(1, col);
    if (norm(cel.getValue()) === norm(nomeColuna)) {
      cel.setFontWeight('bold').setBackground('#3c3c7a').setFontColor('white');
      if (largurasEsperadas && largurasEsperadas[i]) sheet.setColumnWidth(col, largurasEsperadas[i]);
    }
  });

  sheet.setFrozenRows(1);
  if (alterou) clearSheetCaches(sheet.getName());
}

function ensureFamiliaresSheet() {
  var ss = SpreadsheetApp.getActiveSpreadsheet();
  var nome = SHEETS.FAMILIARES;
  var headers = ['ID', 'ID Socioeducando', 'Nome', 'Telefone', 'Tipo de Vínculo', 'Endereço', 'Principal', 'Registrado em', 'Criado por', 'Atualizado em', 'Atualizado por', 'Deletado em', 'Deletado por'];
  var widths = [50, 70, 220, 160, 170, 260, 90, 130, 180, 130, 180, 130, 180];

  var sheet = ss.getSheetByName(nome);
  if (!sheet) {
    sheet = ss.insertSheet(nome);
    sheet.appendRow(headers);
    var hdr = sheet.getRange(1, 1, 1, headers.length);
    hdr.setFontWeight('bold').setBackground('#3c3c7a').setFontColor('white');
    sheet.setFrozenRows(1);
    widths.forEach(function(w, i) { sheet.setColumnWidth(i + 1, w); });
    clearSheetCaches(nome);
    return;
  }

  if (sheet.getLastRow() === 0) {
    sheet.appendRow(headers);
    var hdrVazio = sheet.getRange(1, 1, 1, headers.length);
    hdrVazio.setFontWeight('bold').setBackground('#3c3c7a').setFontColor('white');
    sheet.setFrozenRows(1);
    widths.forEach(function(w, i) { sheet.setColumnWidth(i + 1, w); });
    clearSheetCaches(nome);
    return;
  }

  ensureSheetEstruturaByConfig(sheet, headers, widths);
}

function ensureVisitasTerritoriaisSheet() {
  var ss = SpreadsheetApp.getActiveSpreadsheet();
  var nome = SHEETS.VISITAS_TERRITORIAIS;
  var headers = ['ID', 'ID Socioeducando', 'Data', 'Tec Responsável', 'Atendido por', 'CREAS', 'CAPS', 'Ameaça', 'Observações', 'Registrado em', 'Criado por', 'Atualizado em', 'Atualizado por', 'Deletado em', 'Deletado por'];
  var widths = [50, 70, 110, 190, 190, 80, 80, 85, 260, 130, 180, 130, 180, 130, 180];

  var sheet = ss.getSheetByName(nome);
  if (!sheet) {
    sheet = ss.insertSheet(nome);
    sheet.appendRow(headers);
    var hdr = sheet.getRange(1, 1, 1, headers.length);
    hdr.setFontWeight('bold').setBackground('#3c3c7a').setFontColor('white');
    sheet.setFrozenRows(1);
    widths.forEach(function(w, i) { sheet.setColumnWidth(i + 1, w); });
    clearSheetCaches(nome);
    return;
  }

  if (sheet.getLastRow() === 0) {
    sheet.appendRow(headers);
    var hdrVazio = sheet.getRange(1, 1, 1, headers.length);
    hdrVazio.setFontWeight('bold').setBackground('#3c3c7a').setFontColor('white');
    sheet.setFrozenRows(1);
    widths.forEach(function(w, i) { sheet.setColumnWidth(i + 1, w); });
    clearSheetCaches(nome);
    return;
  }

  ensureSheetEstruturaByConfig(sheet, headers, widths);
}

// ── Helpers internos ──────────────────────────────────────────
function usuarioAtual() {
  try { return Session.getActiveUser().getEmail() || 'desconhecido'; }
  catch(e) { return 'desconhecido'; }
}

function getSheet(nome) {
  if (_SHEET_CACHE[nome]) return _SHEET_CACHE[nome];
  var sh = SpreadsheetApp.getActiveSpreadsheet().getSheetByName(nome);
  if (!sh) throw new Error('Aba "' + nome + '" não encontrada. Execute Inicializar Planilha primeiro.');
  _SHEET_CACHE[nome] = sh;
  return sh;
}

function getHeadersLower(nome) {
  var sh = getSheet(nome);
  var lastColumn = sh.getLastColumn();
  var cached = _HEADER_CACHE[nome];
  if (cached && cached.lastColumn === lastColumn) return cached.headers;

  var headers = lastColumn > 0
    ? sh.getRange(1, 1, 1, lastColumn).getValues()[0].map(function(h) {
        return String(h || '').trim().toLowerCase();
      })
    : [];

  _HEADER_CACHE[nome] = { lastColumn: lastColumn, headers: headers };
  return headers;
}

function clearSheetCaches(nome) {
  delete _HEADER_CACHE[nome];
  delete _ROWS_CACHE[nome];
  delete _ACTIVE_ROWS_CACHE[nome];
  delete _COLS_CACHE[nome];
}

function getRows(nome) {
  var sh = getSheet(nome);
  if (sh.getLastRow() < 2) return [];

  var lastRow = sh.getLastRow();
  var lastColumn = sh.getLastColumn();
  var cached = _ROWS_CACHE[nome];
  if (cached && cached.lastRow === lastRow && cached.lastColumn === lastColumn) {
    return cached.rows;
  }

  var rows = sh.getRange(2, 1, lastRow - 1, lastColumn).getValues();
  _ROWS_CACHE[nome] = { lastRow: lastRow, lastColumn: lastColumn, rows: rows };
  return rows;
}

function getRowsAtivas(nome) {
  var sh = getSheet(nome);
  var lastRow = sh.getLastRow();
  var lastColumn = sh.getLastColumn();
  var cached = _ACTIVE_ROWS_CACHE[nome];
  if (cached && cached.lastRow === lastRow && cached.lastColumn === lastColumn) {
    return cached.rows;
  }

  var rows = getRows(nome);
  if (!rows.length) {
    _ACTIVE_ROWS_CACHE[nome] = { lastRow: lastRow, lastColumn: lastColumn, rows: rows };
    return rows;
  }

  var headers = getHeadersLower(nome);
  var idxDeletado = headers.indexOf('deletado em');
  if (idxDeletado < 0) {
    _ACTIVE_ROWS_CACHE[nome] = { lastRow: lastRow, lastColumn: lastColumn, rows: rows };
    return rows;
  }

  var activeRows = rows.filter(function(r) {
    return String(r[idxDeletado] || '').trim() === '';
  });
  _ACTIVE_ROWS_CACHE[nome] = { lastRow: lastRow, lastColumn: lastColumn, rows: activeRows };
  return activeRows;
}

function nextId(nome) {
  var rows = getRows(nome);
  if (rows.length === 0) return 1;
  var max = 0;
  rows.forEach(function(r) { if (Number(r[0]) > max) max = Number(r[0]); });
  return max + 1;
}

function fmtDateTime(val) {
  if (!val || val === '') return '';
  var d = val instanceof Date ? val : new Date(val);
  if (isNaN(d.getTime())) return String(val);
  var tz = Session.getScriptTimeZone();
  return Utilities.formatDate(d, tz, 'dd/MM/yyyy HH:mm');
}

function toIsoDateTime(val) {
  if (!val || val === '') return '';
  if (val instanceof Date) {
    return Utilities.formatDate(val, Session.getScriptTimeZone(), "yyyy-MM-dd'T'HH:mm");
  }
  return String(val).substring(0, 16);
}

function isDateTimeEndBeforeStart(inicio, termino) {
  if (!inicio || !termino) return false;

  var dInicio = new Date(inicio);
  var dTermino = new Date(termino);

  if (!isNaN(dInicio.getTime()) && !isNaN(dTermino.getTime())) {
    return dTermino.getTime() < dInicio.getTime();
  }

  // Fallback para strings ISO locais (yyyy-MM-ddTHH:mm).
  return String(termino) < String(inicio);
}

function fmtDate(val) {
  if (!val || val === '') return '';
  var d;
  if (val instanceof Date) {
    d = val;
  } else {
    d = new Date(val);
    if (isNaN(d.getTime())) return String(val);
  }
  var dd = String(d.getDate()).padStart(2, '0');
  var mm = String(d.getMonth() + 1).padStart(2, '0');
  var yyyy = d.getFullYear();
  return dd + '/' + mm + '/' + yyyy;
}

// Formata valores de hora lidos do Sheets.
// Cells do tipo "hora" chegam como Date (Dec 30, 1899 + fração do dia).
function fmtTime(val) {
  if (!val || val === '') return '';
  if (val instanceof Date) {
    return Utilities.formatDate(val, Session.getScriptTimeZone(), 'HH:mm');
  }
  var s = String(val).trim();
  // Já em formato HH:mm ou H:mm
  if (/^\d{1,2}:\d{2}/.test(s)) return s.substring(0, 5);
  return s;
}

function toIso(val) {
  if (!val || val === '') return '';
  if (val instanceof Date) {
    return Utilities.formatDate(val, Session.getScriptTimeZone(), 'yyyy-MM-dd');
  }
  return String(val).substring(0, 10);
}

function boolVal(v) {
  return v === true || v === 'TRUE' || v === 1 || v === 'true' || v === 'SIM';
}

/**
 * Remove acentos/diacríticos de uma string (ex.: "café" -> "cafe"),
 * usado para comparações que devem ignorar acentuação.
 */
function removerAcentos(str) {
  return String(str || '').normalize('NFD').replace(/[\u0300-\u036f]/g, '');
}

function usuarioPodeGerenciarCredenciais(emailUsuario) {
  var email = String(emailUsuario || usuarioAtual() || '').trim().toLowerCase();
  return email === String(EMAIL_ADMIN_CREDENCIAIS).trim().toLowerCase();
}

function _bytesUnsigned(arr) {
  return (arr || []).map(function(b) { return (b + 256) % 256; });
}

function _bytesSigned(arr) {
  return (arr || []).map(function(b) { return b > 127 ? b - 256 : b; });
}

function _utf8ToBytes(str) {
  return _bytesUnsigned(Utilities.newBlob(String(str || ''), 'text/plain').getBytes());
}

function _bytesToUtf8(bytes) {
  return Utilities.newBlob(_bytesSigned(bytes || [])).getDataAsString('UTF-8');
}

function _b64EncodeBytes(bytesUnsigned) {
  return Utilities.base64Encode(_bytesSigned(bytesUnsigned || []));
}

function _b64DecodeBytes(str) {
  return _bytesUnsigned(Utilities.base64Decode(String(str || '')));
}

function _hmacSha256Bytes(texto, chave) {
  return _bytesUnsigned(Utilities.computeHmacSha256Signature(String(texto || ''), String(chave || '')));
}

function _chaveCriptografiaSenha(emailUsuario) {
  return removerAcentos(String(emailUsuario || '')).trim().toLowerCase();
}

function _keystreamBytes(chave, nonce, tamanho) {
  var out = [];
  var counter = 0;
  while (out.length < tamanho) {
    var bloco = _hmacSha256Bytes(String(nonce) + '|' + String(counter), chave);
    out = out.concat(bloco);
    counter++;
  }
  return out.slice(0, tamanho);
}

function _xorBytes(a, b) {
  var out = [];
  for (var i = 0; i < a.length; i++) out.push(a[i] ^ b[i]);
  return out;
}

function _criptoTagPayload(versao, nonceB64, cipherB64, chave) {
  return _hmacSha256Bytes(versao + '|' + nonceB64 + '|' + cipherB64, chave).slice(0, 16);
}

function criptografarSenhaProfissional(senha, emailUsuario) {
  var texto = String(senha || '');
  if (!texto) return '';
  var chave = _chaveCriptografiaSenha(emailUsuario);
  if (!chave) return '';

  var versao = 'v1';
  var nonce = Utilities.getUuid() + '|' + String(new Date().getTime());
  var nonceB64 = Utilities.base64EncodeWebSafe(nonce);

  var plainBytes = _utf8ToBytes(texto);
  var stream = _keystreamBytes(chave, nonce, plainBytes.length);
  var cipherBytes = _xorBytes(plainBytes, stream);
  var cipherB64 = _b64EncodeBytes(cipherBytes);

  var tagBytes = _criptoTagPayload(versao, nonceB64, cipherB64, chave);
  var tagB64 = _b64EncodeBytes(tagBytes);

  return [versao, nonceB64, cipherB64, tagB64].join('.');
}

function descriptografarSenhaProfissional(payload, emailUsuario) {
  var raw = String(payload || '').trim();
  if (!raw) return '';

  var partes = raw.split('.');
  if (partes.length !== 4 || partes[0] !== 'v1') return '';

  var versao = partes[0];
  var nonceB64 = partes[1];
  var cipherB64 = partes[2];
  var tagB64 = partes[3];
  var chave = _chaveCriptografiaSenha(emailUsuario);
  if (!chave) return '';

  try {
    var tagEsperada = _criptoTagPayload(versao, nonceB64, cipherB64, chave);
    var tagAtual = _b64DecodeBytes(tagB64);
    if (tagEsperada.length !== tagAtual.length) return '';
    for (var i = 0; i < tagEsperada.length; i++) {
      if (tagEsperada[i] !== tagAtual[i]) return '';
    }

    var nonce = Utilities.newBlob(Utilities.base64DecodeWebSafe(nonceB64)).getDataAsString();
    var cipherBytes = _b64DecodeBytes(cipherB64);
    var stream = _keystreamBytes(chave, nonce, cipherBytes.length);
    var plainBytes = _xorBytes(cipherBytes, stream);
    return _bytesToUtf8(plainBytes);
  } catch (e) {
    return '';
  }
}

/**
 * Garante que TODA aba possua, ao final, o bloco padrão de colunas de
 * auditoria — "Registrado em", "Criado por", "Atualizado em", "Atualizado
 * por" — e as duas colunas de suporte à futura exclusão lógica — "Deletado
 * em", "Deletado por". Colunas já existentes (por nome, case-insensitive)
 * são preservadas intactas; apenas as que faltam são adicionadas ao final da
 * aba, na ordem abaixo. Também migra o rótulo legado "Cadastrado em"
 * (Socioeducandos) para "Registrado em", sem mover ou apagar dados.
 */
function ensureColunasPadraoAuditoria(nomeAba) {
  var ss = SpreadsheetApp.getActiveSpreadsheet();
  var sh = ss.getSheetByName(nomeAba);
  if (!sh || sh.getLastRow() === 0) return;
  var alterou = false;

  // Migra o rótulo legado "Cadastrado em" → "Registrado em" (apenas o texto
  // do cabeçalho; nenhum dado é movido).
  var headersAtuais = sh.getRange(1, 1, 1, sh.getLastColumn()).getValues()[0];
  headersAtuais.forEach(function(h, i) {
    if (String(h || '').trim().toLowerCase() === 'cadastrado em') {
      sh.getRange(1, i + 1).setValue('Registrado em');
      alterou = true;
    }
  });

  var padrao = [
    { nome: 'Registrado em',  largura: 130 },
    { nome: 'Criado por',     largura: 180 },
    { nome: 'Atualizado em',  largura: 130 },
    { nome: 'Atualizado por', largura: 180 },
    { nome: 'Deletado em',    largura: 130 },
    { nome: 'Deletado por',   largura: 180 }
  ];

  padrao.forEach(function(col) {
    var headers = sh.getRange(1, 1, 1, sh.getLastColumn()).getValues()[0].map(function(h) {
      return String(h || '').trim().toLowerCase();
    });
    var pos = headers.indexOf(col.nome.toLowerCase());
    if (pos < 0) {
      pos = sh.getLastColumn() + 1;
      sh.getRange(1, pos).setValue(col.nome);
      alterou = true;
    } else {
      pos = pos + 1;
      sh.getRange(1, pos).setValue(col.nome);
    }
    sh.getRange(1, pos).setFontWeight('bold').setBackground('#3c3c7a').setFontColor('white');
    sh.setColumnWidth(pos, col.largura);
  });

  if (alterou) clearSheetCaches(nomeAba);
}

function ensureColunasAuditoriaBasica(nomeAba) {
  var ss = SpreadsheetApp.getActiveSpreadsheet();
  var sh = ss.getSheetByName(nomeAba);
  if (!sh || sh.getLastRow() === 0) return;
  var alterou = false;

  var padrao = [
    { nome: 'Registrado em', largura: 130 },
    { nome: 'Criado por', largura: 180 }
  ];

  padrao.forEach(function(col) {
    var headers = sh.getRange(1, 1, 1, sh.getLastColumn()).getValues()[0].map(function(h) {
      return String(h || '').trim().toLowerCase();
    });
    if (headers.indexOf(col.nome.toLowerCase()) >= 0) return;
    var pos = sh.getLastColumn() + 1;
    sh.getRange(1, pos).setValue(col.nome);
    sh.getRange(1, pos).setFontWeight('bold').setBackground('#3c3c7a').setFontColor('white');
    sh.setColumnWidth(pos, col.largura);
    alterou = true;
  });

  if (alterou) clearSheetCaches(nomeAba);
}

function ensureOrdemColunas(nomeAba, ordemEsperada) {
  var ss = SpreadsheetApp.getActiveSpreadsheet();
  var sh = ss.getSheetByName(nomeAba);
  if (!sh || sh.getLastRow() === 0 || !ordemEsperada || !ordemEsperada.length) return;

  var normalize = function(h) { return String(h || '').trim().toLowerCase(); };
  var alterou = false;
  ordemEsperada.forEach(function(nome, targetIndex) {
    var headers = sh.getRange(1, 1, 1, sh.getLastColumn()).getValues()[0].map(normalize);
    var currentIndex = headers.indexOf(normalize(nome));
    if (currentIndex < 0 || currentIndex === targetIndex) return;
    sh.moveColumns(sh.getRange(1, currentIndex + 1, sh.getMaxRows(), 1), targetIndex + 1);
    alterou = true;
  });

  if (alterou) clearSheetCaches(nomeAba);
}

function ensureSocioeducandosNascimentoColumn() {
  var sh = getSheet(SHEETS.SOCIOEDUCANDOS);
  if (sh.getLastRow() === 0) return;

  var headers = sh.getRange(1, 1, 1, sh.getLastColumn()).getValues()[0];
  var idxNasc = headers.findIndex(function(h) { return String(h || '').trim().toLowerCase() === 'data de nascimento'; });
  if (idxNasc >= 0) return;

  var idxNome = headers.findIndex(function(h) { return String(h || '').trim().toLowerCase() === 'nome'; });
  if (idxNome >= 0) {
    sh.insertColumnAfter(idxNome + 1);
    sh.getRange(1, idxNome + 2).setValue('Data de Nascimento');
    sh.setColumnWidth(idxNome + 2, 130);
  } else {
    sh.insertColumnAfter(sh.getLastColumn());
    sh.getRange(1, sh.getLastColumn()).setValue('Data de Nascimento');
    sh.setColumnWidth(sh.getLastColumn(), 130);
  }
}

function ensureSocioeducandosCredenciaisColumns() {
  var sh = getSheet(SHEETS.SOCIOEDUCANDOS);
  if (sh.getLastRow() === 0) return;
  var alterou = false;

  var headers = sh.getRange(1, 1, 1, sh.getLastColumn()).getValues()[0];
  var temEmail = headers.some(function(h) { return String(h || '').trim().toLowerCase() === 'e-mail profissional'; });
  var temSenha = headers.some(function(h) { return String(h || '').trim().toLowerCase() === 'senha profissional (criptografada)'; });

  if (!temEmail) {
    sh.insertColumnAfter(sh.getLastColumn());
    sh.getRange(1, sh.getLastColumn()).setValue('E-mail Profissional');
    sh.getRange(1, sh.getLastColumn()).setFontWeight('bold').setBackground('#3c3c7a').setFontColor('white');
    sh.setColumnWidth(sh.getLastColumn(), 220);
    alterou = true;
  }

  if (!temSenha) {
    sh.insertColumnAfter(sh.getLastColumn());
    sh.getRange(1, sh.getLastColumn()).setValue('Senha Profissional (Criptografada)');
    sh.getRange(1, sh.getLastColumn()).setFontWeight('bold').setBackground('#3c3c7a').setFontColor('white');
    sh.setColumnWidth(sh.getLastColumn(), 260);
    alterou = true;
  }

  if (alterou) clearSheetCaches(SHEETS.SOCIOEDUCANDOS);
}

function ensureAtendimentosObservacoesColumn() {
  var sh = getSheet(SHEETS.ATENDIMENTOS);
  if (sh.getLastRow() === 0) return;

  var headers = sh.getRange(1, 1, 1, sh.getLastColumn()).getValues()[0];
  var idxObs = headers.findIndex(function(h) { return String(h || '').trim().toLowerCase() === 'observações'; });
  if (idxObs >= 0) return;

  var idxTermino = headers.findIndex(function(h) { return String(h || '').trim().toLowerCase() === 'data/hora término'; });
  if (idxTermino >= 0) {
    sh.insertColumnAfter(idxTermino + 1);
    sh.getRange(1, idxTermino + 2).setValue('Observações');
    sh.setColumnWidth(idxTermino + 2, 250);
    return;
  }

  sh.insertColumnAfter(sh.getLastColumn());
  sh.getRange(1, sh.getLastColumn()).setValue('Observações');
  sh.setColumnWidth(sh.getLastColumn(), 250);
}

function ensureSaidasObservacoesColumn() {
  var sh = getSheet(SHEETS.SAIDAS);
  if (sh.getLastRow() === 0) return;

  var headers = sh.getRange(1, 1, 1, sh.getLastColumn()).getValues()[0];
  var idxObs = headers.findIndex(function(h) { return String(h || '').trim().toLowerCase() === 'observações'; });
  if (idxObs >= 0) return;

  var idxAcompanhante = headers.findIndex(function(h) { return String(h || '').trim().toLowerCase() === 'nome acompanhante'; });
  if (idxAcompanhante >= 0) {
    sh.insertColumnAfter(idxAcompanhante + 1);
    sh.getRange(1, idxAcompanhante + 2).setValue('Observações');
    sh.setColumnWidth(idxAcompanhante + 2, 250);
    return;
  }

  sh.insertColumnAfter(sh.getLastColumn());
  sh.getRange(1, sh.getLastColumn()).setValue('Observações');
  sh.setColumnWidth(sh.getLastColumn(), 250);
}

function ensureSaidasTipoColumn() {
  var sh = getSheet(SHEETS.SAIDAS);
  if (sh.getLastRow() === 0) return;

  var headers = sh.getRange(1, 1, 1, sh.getLastColumn()).getValues()[0];
  var idxTipo = headers.findIndex(function(h) { return String(h || '').trim().toLowerCase() === 'tipo'; });
  if (idxTipo >= 0) return;

  var idxLocal = headers.findIndex(function(h) { return String(h || '').trim().toLowerCase() === 'local'; });
  if (idxLocal >= 0) {
    sh.insertColumnAfter(idxLocal + 1);
    sh.getRange(1, idxLocal + 2).setValue('Tipo');
    sh.setColumnWidth(idxLocal + 2, 150);
    return;
  }

  sh.insertColumnAfter(sh.getLastColumn());
  sh.getRange(1, sh.getLastColumn()).setValue('Tipo');
  sh.setColumnWidth(sh.getLastColumn(), 150);
}

function ensureAtendimentosColunasNaoRealizado() {
  var sh = getSheet(SHEETS.ATENDIMENTOS);
  if (sh.getLastRow() === 0) return;

  var headers = sh.getRange(1, 1, 1, sh.getLastColumn()).getValues()[0];
  var normalize = function(h) { return String(h || '').trim().toLowerCase(); };
  var nHeaders = headers.map(normalize);

  var desejaveis = [
    { nome: 'Realizado',                  largura: 80  },
    { nome: 'Motivo Não Realizado',       largura: 250 },
    { nome: 'ID Atendimento Reposição',   largura: 90  }
  ];

  desejaveis.forEach(function(col) {
    if (nHeaders.indexOf(normalize(col.nome)) >= 0) return;
    var pos = sh.getLastColumn() + 1;
    sh.getRange(1, pos).setValue(col.nome);
    sh.setColumnWidth(pos, col.largura);
    // Preenche linhas existentes com valor padrão "Sim" para a coluna Realizado
    if (normalize(col.nome) === 'realizado' && sh.getLastRow() > 1) {
      var nLinhas = sh.getLastRow() - 1;
      var vals = Array.apply(null, Array(nLinhas)).map(function() { return ['Sim']; });
      sh.getRange(2, pos, nLinhas, 1).setValues(vals);
    }
    // Atualiza nHeaders para os próximos
    nHeaders.push(normalize(col.nome));
  });
}

function ensureTiposAtendimentoPadrao() {
  var ss = SpreadsheetApp.getActiveSpreadsheet();
  var sh = ss.getSheetByName(SHEETS.TIPOS_ATENDIMENTO);
  if (!sh) sh = ss.insertSheet(SHEETS.TIPOS_ATENDIMENTO);
  if (sh.getLastRow() === 0) {
    sh.appendRow(['Tipo de Atendimento', 'Duração Padrão (minutos)']);
    var hdr = sh.getRange(1, 1, 1, 2);
    hdr.setFontWeight('bold').setBackground('#3c3c7a').setFontColor('white');
    sh.setFrozenRows(1);
    sh.setColumnWidth(1, 240);
    sh.setColumnWidth(2, 180);
  }

  ensureColunasAuditoriaBasica(SHEETS.TIPOS_ATENDIMENTO);

  if (sh.getLastRow() > 1) return;

  var valores = TIPOS_ATENDIMENTO_PADRAO.map(function(t) {
    return [t.tipo, t.duracao_minutos];
  });
  sh.getRange(2, 1, valores.length, 2).setValues(valores);
}

function getTiposAtendimentoCols() {
  if (_COLS_CACHE[SHEETS.TIPOS_ATENDIMENTO]) return _COLS_CACHE[SHEETS.TIPOS_ATENDIMENTO];
  maybeEnsureOnRead(function() {
    ensureTiposAtendimentoPadrao();
    ensureOrdemColunas(SHEETS.TIPOS_ATENDIMENTO, ['Tipo de Atendimento', 'Duração Padrão (minutos)', 'Registrado em', 'Criado por']);
  });
  var headers = getHeadersLower(SHEETS.TIPOS_ATENDIMENTO);

  function idx(nome, fallback) {
    var i = headers.indexOf(nome);
    return i >= 0 ? i : fallback;
  }

  var cols = {
    tipo:          idx('tipo de atendimento', 0),
    duracao:       idx('duração padrão (minutos)', 1),
    registrado_em: idx('registrado em', 2),
    criadoPor:     idx('criado por', 3)
  };
  _COLS_CACHE[SHEETS.TIPOS_ATENDIMENTO] = cols;
  return cols;
}

function getTiposAtendimento() {
  ensureTiposAtendimentoPadrao();
  return getRowsAtivas(SHEETS.TIPOS_ATENDIMENTO)
    .filter(function(r) {
      return String(r[0] || '').trim() !== '';
    })
    .map(function(r) {
      var dur = Number(r[1]);
      if (!dur || dur <= 0) dur = 60;
      return {
        tipo: String(r[0]).trim(),
        duracao_minutos: dur
      };
    });
}

function getDadosFormAtendimentos() {
  return {
    socioeducandos: getSocioeducandosAtivos(),
    tipos_atendimento: getTiposAtendimento()
  };
}

function getDadosFormTrabalho() {
  return {
    socioeducandos: getSocioeducandosAtivos()
  };
}

// ── Configurações — Tipos de Atendimento (CRUD) ───────────────

function getTiposAtendimentoConfig() {
  var usos = {};
  getRowsAtivas(SHEETS.ATENDIMENTOS).forEach(function(r) {
    var t = String(r[2] || '').trim();
    if (!t) return;
    usos[t] = (usos[t] || 0) + 1;
  });
  return getTiposAtendimento().map(function(t) {
    return { tipo: t.tipo, duracao_minutos: t.duracao_minutos, em_uso: usos[t.tipo] || 0 };
  });
}

function salvarTipoAtendimento(dados) {
  if (!dados || !dados.tipo || String(dados.tipo).trim() === '') throw new Error('Nome do tipo é obrigatório.');
  var novoTipo = String(dados.tipo).trim();
  var duracao = Number(dados.duracao_minutos);
  if (!duracao || duracao <= 0) throw new Error('Duração padrão deve ser um número de minutos maior que zero.');

  ensureTiposAtendimentoPadrao();
  var sh = getSheet(SHEETS.TIPOS_ATENDIMENTO);
  var rows = getRows(SHEETS.TIPOS_ATENDIMENTO);
  var ct = getTiposAtendimentoCols();
  var totalCols = sh.getLastColumn();
  var tipoOriginal = dados.tipo_original ? String(dados.tipo_original).trim() : '';
  var user = usuarioAtual();

  var idxMesmoNome = rows.findIndex(function(r) {
    return String(r[0] || '').trim().toLowerCase() === novoTipo.toLowerCase();
  });

  if (tipoOriginal) {
    var idx = rows.findIndex(function(r) { return String(r[0] || '').trim() === tipoOriginal; });
    if (idx < 0) throw new Error('Tipo de atendimento não encontrado para edição.');
    if (idxMesmoNome >= 0 && idxMesmoNome !== idx) {
      throw new Error('Já existe um tipo de atendimento chamado "' + novoTipo + '".');
    }
    var linhaEdicao = rows[idx].slice();
    while (linhaEdicao.length < totalCols) linhaEdicao.push('');
    linhaEdicao[ct.tipo] = novoTipo;
    linhaEdicao[ct.duracao] = duracao;
    linhaEdicao[ct.registrado_em] = rows[idx][ct.registrado_em] || new Date();
    linhaEdicao[ct.criadoPor] = rows[idx][ct.criadoPor] || user;
    sh.getRange(idx + 2, 1, 1, totalCols).setValues([linhaEdicao]);

    if (novoTipo.toLowerCase() !== tipoOriginal.toLowerCase()) {
      var shAt = getSheet(SHEETS.ATENDIMENTOS);
      getRows(SHEETS.ATENDIMENTOS).forEach(function(r, i) {
        if (String(r[2] || '').trim() === tipoOriginal) {
          shAt.getRange(i + 2, 3).setValue(novoTipo);
        }
      });
    }
  } else {
    if (idxMesmoNome >= 0) throw new Error('Já existe um tipo de atendimento chamado "' + novoTipo + '".');
    var linhaNova = new Array(totalCols).fill('');
    linhaNova[ct.tipo] = novoTipo;
    linhaNova[ct.duracao] = duracao;
    linhaNova[ct.registrado_em] = new Date();
    linhaNova[ct.criadoPor] = user;
    sh.getRange(sh.getLastRow() + 1, 1, 1, totalCols).setValues([linhaNova]);
  }

  return { ok: true };
}

function excluirTipoAtendimento(tipo, forcar) {
  if (!tipo || String(tipo).trim() === '') throw new Error('Tipo de atendimento não informado.');
  var nome = String(tipo).trim();

  ensureTiposAtendimentoPadrao();
  var sh = getSheet(SHEETS.TIPOS_ATENDIMENTO);
  var rows = getRowsAtivas(SHEETS.TIPOS_ATENDIMENTO);
  var idx = rows.findIndex(function(r) { return String(r[0] || '').trim() === nome; });
  if (idx < 0) throw new Error('Tipo de atendimento não encontrado.');

  var emUso = getRowsAtivas(SHEETS.ATENDIMENTOS).filter(function(r) {
    return String(r[2] || '').trim() === nome;
  }).length;

  if (emUso > 0 && !forcar) {
    throw new Error('Este tipo está em uso em ' + emUso + ' atendimento(s) já registrados. Os atendimentos existentes manterão o nome atual; o tipo apenas deixará de aparecer para novos registros. Deseja excluir mesmo assim?');
  }

  sh.deleteRow(idx + 2);
  return { ok: true, atendimentos_afetados: emUso };
}

// ── Interesses de Curso ────────────────────────────────────────
// Tabela n:1 (um socioeducando pode ter vários interesses de curso em texto livre).
function getInteressesCursoCols() {
  if (_COLS_CACHE[SHEETS.INTERESSES_CURSO]) return _COLS_CACHE[SHEETS.INTERESSES_CURSO];
  maybeEnsureOnRead(function() {
    ensureColunasAuditoriaBasica(SHEETS.INTERESSES_CURSO);
    ensureOrdemColunas(SHEETS.INTERESSES_CURSO, ['ID', 'ID Socioeducando', 'Interesse', 'Registrado em', 'Criado por']);
  });
  var headers = getHeadersLower(SHEETS.INTERESSES_CURSO);

  function idx(nome, fallback) {
    var i = headers.indexOf(nome);
    return i >= 0 ? i : fallback;
  }

  var cols = {
    id: idx('id', 0),
    socioeducando_id: idx('id socioeducando', 1),
    interesse: idx('interesse', 2),
    registrado_em: idx('registrado em', 3),
    criadoPor: idx('criado por', 4)
  };
  _COLS_CACHE[SHEETS.INTERESSES_CURSO] = cols;
  return cols;
}

function getAdmissoesCols() {
  if (_COLS_CACHE[SHEETS.ADMISSOES]) return _COLS_CACHE[SHEETS.ADMISSOES];
  maybeEnsureOnRead(function() {
    ensureColunasPadraoAuditoria(SHEETS.ADMISSOES);
    ensureOrdemColunas(SHEETS.ADMISSOES, ['ID', 'ID Socioeducando', 'Data Admissão', 'Data Desligamento', 'Registrado em', 'Criado por', 'Atualizado em', 'Atualizado por', 'Deletado em', 'Deletado por']);
  });
  var headers = getHeadersLower(SHEETS.ADMISSOES);

  function idx(nome, fallback) {
    var i = headers.indexOf(nome);
    return i >= 0 ? i : fallback;
  }

  var cols = {
    id: idx('id', 0),
    socioeducando_id: idx('id socioeducando', 1),
    data_admissao: idx('data admissão', 2),
    data_desligamento: idx('data desligamento', 3),
    registrado_em: idx('registrado em', 4),
    criadoPor: idx('criado por', 5),
    atualizadoEm: idx('atualizado em', 6),
    atualizadoPor: idx('atualizado por', 7),
    deletado_em: idx('deletado em', -1),
    deletado_por: idx('deletado por', -1)
  };
  _COLS_CACHE[SHEETS.ADMISSOES] = cols;
  return cols;
}

function getFugasCols() {
  if (_COLS_CACHE[SHEETS.FUGAS]) return _COLS_CACHE[SHEETS.FUGAS];
  maybeEnsureOnRead(function() {
    ensureColunasPadraoAuditoria(SHEETS.FUGAS);
    ensureOrdemColunas(SHEETS.FUGAS, ['ID', 'ID Socioeducando', 'Tipo', 'Data Saída', 'Data Retorno', 'Observações', 'Registrado em', 'Criado por', 'Atualizado em', 'Atualizado por', 'Deletado em', 'Deletado por']);
  });
  var headers = getHeadersLower(SHEETS.FUGAS);

  function idx(nome, fallback) {
    var i = headers.indexOf(nome);
    return i >= 0 ? i : fallback;
  }

  var cols = {
    id: idx('id', 0),
    socioeducando_id: idx('id socioeducando', 1),
    tipo_saida: idx('tipo', 2),
    data_saida: idx('data saída', 3),
    data_retorno: idx('data retorno', 4),
    observacoes: idx('observações', 5),
    registrado_em: idx('registrado em', 6),
    criadoPor: idx('criado por', 7),
    atualizadoEm: idx('atualizado em', 8),
    atualizadoPor: idx('atualizado por', 9),
    deletado_em: idx('deletado em', -1),
    deletado_por: idx('deletado por', -1)
  };
  _COLS_CACHE[SHEETS.FUGAS] = cols;
  return cols;
}

function getAtendimentosCols() {
  if (_COLS_CACHE[SHEETS.ATENDIMENTOS]) return _COLS_CACHE[SHEETS.ATENDIMENTOS];
  maybeEnsureOnRead(function() {
    ensureAtendimentosObservacoesColumn();
    ensureAtendimentosColunasNaoRealizado();
    ensureColunasPadraoAuditoria(SHEETS.ATENDIMENTOS);
    ensureOrdemColunas(SHEETS.ATENDIMENTOS, ['ID', 'ID Socioeducando', 'Tipo de Atendimento', 'Responsável', 'Data/Hora Início', 'Data/Hora Término', 'Realizado', 'Motivo Não Realizado', 'ID Atendimento Reposição', 'Observações', 'Registrado em', 'Criado por', 'Atualizado em', 'Atualizado por', 'Deletado em', 'Deletado por']);
  });
  var headers = getHeadersLower(SHEETS.ATENDIMENTOS);

  function idx(nome, fallback) {
    var i = headers.indexOf(nome);
    return i >= 0 ? i : fallback;
  }

  var cols = {
    id: idx('id', 0),
    socioeducando_id: idx('id socioeducando', 1),
    tipo_atendimento: idx('tipo de atendimento', 2),
    responsavel: idx('responsável', 3),
    data_hora_inicio: idx('data/hora início', 4),
    data_hora_termino: idx('data/hora término', 5),
    realizado: idx('realizado', 6),
    motivo_nao_realizado: idx('motivo não realizado', 7),
    id_atendimento_reposicao: idx('id atendimento reposição', 8),
    observacoes: idx('observações', 9),
    registrado_em: idx('registrado em', 10),
    criadoPor: idx('criado por', 11),
    atualizadoEm: idx('atualizado em', 12),
    atualizadoPor: idx('atualizado por', 13),
    deletado_em: idx('deletado em', -1),
    deletado_por: idx('deletado por', -1)
  };
  _COLS_CACHE[SHEETS.ATENDIMENTOS] = cols;
  return cols;
}

function getTrabalhosCols() {
  if (_COLS_CACHE[SHEETS.TRABALHOS]) return _COLS_CACHE[SHEETS.TRABALHOS];
  maybeEnsureOnRead(function() {
    ensureColunasPadraoAuditoria(SHEETS.TRABALHOS);
    ensureOrdemColunas(SHEETS.TRABALHOS, ['ID', 'ID Socioeducando', 'Tipo', 'Empresa', 'Curso', 'Data de Contrato', 'Data Início', 'Data Fim', 'Horário Início', 'Horário Fim', 'Dias da Semana', 'Registrado em', 'Criado por', 'Atualizado em', 'Atualizado por', 'Deletado em', 'Deletado por']);
  });
  var headers = getHeadersLower(SHEETS.TRABALHOS);

  function idx(nome, fallback) {
    var i = headers.indexOf(nome);
    return i >= 0 ? i : fallback;
  }

  var cols = {
    id: idx('id', 0),
    socioeducando_id: idx('id socioeducando', 1),
    tipo: idx('tipo', 2),
    empresa: idx('empresa', 3),
    curso: idx('curso', 4),
    data_contrato: idx('data de contrato', 5),
    data_inicio: idx('data início', 6),
    data_fim: idx('data fim', 7),
    horario_inicio: idx('horário início', 8),
    horario_fim: idx('horário fim', 9),
    dias_semana: idx('dias da semana', 10),
    registrado_em: idx('registrado em', 11),
    criadoPor: idx('criado por', 12),
    atualizadoEm: idx('atualizado em', 13),
    atualizadoPor: idx('atualizado por', 14),
    deletado_em: idx('deletado em', -1),
    deletado_por: idx('deletado por', -1)
  };
  _COLS_CACHE[SHEETS.TRABALHOS] = cols;
  return cols;
}

function getVisitasTerritoriaisCols() {
  ensureVisitasTerritoriaisSheet();
  if (_COLS_CACHE[SHEETS.VISITAS_TERRITORIAIS]) return _COLS_CACHE[SHEETS.VISITAS_TERRITORIAIS];
  maybeEnsureOnRead(function() {
    ensureColunasPadraoAuditoria(SHEETS.VISITAS_TERRITORIAIS);
    ensureOrdemColunas(SHEETS.VISITAS_TERRITORIAIS, ['ID', 'ID Socioeducando', 'Data', 'Tec Responsável', 'Atendido por', 'CREAS', 'CAPS', 'Ameaça', 'Observações', 'Registrado em', 'Criado por', 'Atualizado em', 'Atualizado por', 'Deletado em', 'Deletado por']);
  });
  var headers = getHeadersLower(SHEETS.VISITAS_TERRITORIAIS);

  function idx(nome, fallback) {
    var i = headers.indexOf(nome);
    return i >= 0 ? i : fallback;
  }

  var cols = {
    id: idx('id', 0),
    socioeducando_id: idx('id socioeducando', 1),
    data: idx('data', 2),
    tec_responsavel: idx('tec responsável', 3),
    atendido_por: idx('atendido por', 4),
    creas: idx('creas', 5),
    caps: idx('caps', 6),
    ameaca: idx('ameaça', 7),
    observacoes: idx('observações', 8),
    registrado_em: idx('registrado em', 9),
    criadoPor: idx('criado por', 10),
    atualizadoEm: idx('atualizado em', 11),
    atualizadoPor: idx('atualizado por', 12),
    deletado_em: idx('deletado em', -1),
    deletado_por: idx('deletado por', -1)
  };
  _COLS_CACHE[SHEETS.VISITAS_TERRITORIAIS] = cols;
  return cols;
}

function getFamiliaresCols() {
  ensureFamiliaresSheet();
  if (_COLS_CACHE[SHEETS.FAMILIARES]) return _COLS_CACHE[SHEETS.FAMILIARES];
  maybeEnsureOnRead(function() {
    ensureColunasPadraoAuditoria(SHEETS.FAMILIARES);
    ensureOrdemColunas(SHEETS.FAMILIARES, ['ID', 'ID Socioeducando', 'Nome', 'Telefone', 'Tipo de Vínculo', 'Endereço', 'Principal', 'Registrado em', 'Criado por', 'Atualizado em', 'Atualizado por', 'Deletado em', 'Deletado por']);
  });
  var headers = getHeadersLower(SHEETS.FAMILIARES);

  function idx(nome, fallback) {
    var i = headers.indexOf(nome);
    return i >= 0 ? i : fallback;
  }

  var cols = {
    id: idx('id', 0),
    socioeducando_id: idx('id socioeducando', 1),
    nome: idx('nome', 2),
    telefone: idx('telefone', 3),
    tipo_vinculo: idx('tipo de vínculo', 4),
    endereco: idx('endereço', 5),
    principal: idx('principal', 6),
    registrado_em: idx('registrado em', 7),
    criadoPor: idx('criado por', 8),
    atualizadoEm: idx('atualizado em', 9),
    atualizadoPor: idx('atualizado por', 10),
    deletado_em: idx('deletado em', -1),
    deletado_por: idx('deletado por', -1)
  };
  _COLS_CACHE[SHEETS.FAMILIARES] = cols;
  return cols;
}

function getInteressesCursoPorSocioeducando(socioeducandoId) {
  var ci = getInteressesCursoCols();
  return getRowsAtivas(SHEETS.INTERESSES_CURSO)
    .filter(function(r) { return String(r[ci.socioeducando_id]) === String(socioeducandoId); })
    .map(function(r) { return { id: String(r[ci.id]), interesse: String(r[ci.interesse] || '') }; })
    .sort(function(a, b) { return a.interesse.localeCompare(b.interesse, 'pt-BR'); });
}

/**
 * Retorna um resumo de todos os interesses cadastrados: um mapa de
 * socioeducando_id → lista de interesses, e a lista (única, ordenada) de
 * todos os textos de interesse já usados — usado para exibir os interesses
 * junto ao nome na tela de cadastro de curso em lote e para montar o filtro.
 */
function getInteressesCursoResumo() {
  var ci = getInteressesCursoCols();
  var rows = getRowsAtivas(SHEETS.INTERESSES_CURSO);
  var porSocioeducando = {};
  var todosSet = {};

  rows.forEach(function(r) {
    var sid = String(r[ci.socioeducando_id]);
    var interesse = String(r[ci.interesse] || '').trim();
    if (!interesse) return;
    if (!porSocioeducando[sid]) porSocioeducando[sid] = [];
    porSocioeducando[sid].push({ id: String(r[ci.id]), interesse: interesse });
    todosSet[interesse] = true;
  });

  Object.keys(porSocioeducando).forEach(function(sid) {
    porSocioeducando[sid].sort(function(a, b) { return a.interesse.localeCompare(b.interesse, 'pt-BR'); });
  });

  var todosInteresses = Object.keys(todosSet).sort(function(a, b) { return a.localeCompare(b, 'pt-BR'); });

  return { porSocioeducando: porSocioeducando, todosInteresses: todosInteresses };
}

function getDadosFormCursoLote() {
  return { socioeducandos: getSocioeducandosAtivos(), interesses: getInteressesCursoResumo() };
}

function getDadosInteressesLote() {
  return { socioeducandos: getSocioeducandosAtivos(), interesses: getInteressesCursoResumo() };
}

/**
 * Cria ou edita (dados.id presente) um interesse de curso de um socioeducando.
 */
function salvarInteresseCurso(dados) {
  if (!dados || !dados.socioeducando_id) throw new Error('Socioeducando não identificado.');
  validarSocioeducandoExiste(dados.socioeducando_id);
  var interesse = String(dados.interesse || '').trim().toUpperCase();
  if (!interesse) throw new Error('Informe o interesse de curso.');

  var ci = getInteressesCursoCols();
  var sh = getSheet(SHEETS.INTERESSES_CURSO);
  var rows = getRows(SHEETS.INTERESSES_CURSO);
  var user = usuarioAtual();

  if (dados.id) {
    var idx = rows.findIndex(function(r) { return String(r[ci.id]) === String(dados.id); });
    if (idx < 0) throw new Error('Interesse não encontrado para edição.');
    var duplicadoEdicao = rows.some(function(r, i) {
      return i !== idx
        && String(r[ci.socioeducando_id]) === String(dados.socioeducando_id)
        && removerAcentos(String(r[ci.interesse] || '').trim().toLowerCase()) === removerAcentos(interesse.toLowerCase());
    });
    if (duplicadoEdicao) throw new Error('Este socioeducando já possui esse interesse registrado.');
    sh.getRange(idx + 2, ci.interesse + 1).setValue(interesse);
    return { ok: true };
  }

  var jaExiste = rows.some(function(r) {
    return String(r[ci.socioeducando_id]) === String(dados.socioeducando_id)
      && removerAcentos(String(r[ci.interesse] || '').trim().toLowerCase()) === removerAcentos(interesse.toLowerCase());
  });
  if (jaExiste) throw new Error('Este socioeducando já possui esse interesse registrado.');

  sh.appendRow([nextId(SHEETS.INTERESSES_CURSO), Number(dados.socioeducando_id), interesse, new Date(), user]);
  return { ok: true };
}

function excluirInteresseCurso(id) {
  var sh = getSheet(SHEETS.INTERESSES_CURSO);
  var rows = getRows(SHEETS.INTERESSES_CURSO);
  var idx = rows.findIndex(function(r) { return String(r[0]) === String(id); });
  if (idx < 0) throw new Error('Interesse não encontrado.');
  sh.deleteRow(idx + 2);
  return { ok: true };
}

/**
 * Adiciona o mesmo interesse a vários socioeducandos de uma vez
 * (cadastro em lote). Socioeducandos que já possuem esse interesse
 * são silenciosamente ignorados (sem duplicar).
 */
function salvarInteressesLote(socioeducandoIds, interesse) {
  var texto = String(interesse || '').trim().toUpperCase();
  if (!texto) throw new Error('Informe o nome do interesse.');
  var ids = (socioeducandoIds || []).filter(function(id) { return id; });
  if (!ids.length) throw new Error('Selecione ao menos um socioeducando.');
  ids.forEach(function(id) { validarSocioeducandoExiste(id); });

  var sh = getSheet(SHEETS.INTERESSES_CURSO);
  var rows = getRowsAtivas(SHEETS.INTERESSES_CURSO);
  var ci = getInteressesCursoCols();
  var user = usuarioAtual();
  var textoLower = removerAcentos(texto.toLowerCase());

  var existentes = {};
  rows.forEach(function(r) {
    if (removerAcentos(String(r[ci.interesse] || '').trim().toLowerCase()) === textoLower) {
      existentes[String(r[ci.socioeducando_id])] = true;
    }
  });

  var novasLinhas = [];
  var inseridos = 0, ignorados = 0;
  var proximoId = nextId(SHEETS.INTERESSES_CURSO);

  ids.forEach(function(id) {
    if (existentes[String(id)]) { ignorados++; return; }
    novasLinhas.push([proximoId++, Number(id), texto, new Date(), user]);
    existentes[String(id)] = true;
    inseridos++;
  });

  if (novasLinhas.length) {
    sh.getRange(sh.getLastRow() + 1, 1, novasLinhas.length, 5).setValues(novasLinhas);
  }

  return { inseridos: inseridos, ignorados: ignorados };
}

function getSocioeducandosCols() {
  if (_COLS_CACHE[SHEETS.SOCIOEDUCANDOS]) return _COLS_CACHE[SHEETS.SOCIOEDUCANDOS];
  ensureSocioeducandosNascimentoColumn();
  ensureSocioeducandosCredenciaisColumns();
  maybeEnsureOnRead(function() {
    ensureSocioeducandosNascimentoColumn();
    ensureSocioeducandosCredenciaisColumns();
    ensureColunasPadraoAuditoria(SHEETS.SOCIOEDUCANDOS);
    ensureOrdemColunas(SHEETS.SOCIOEDUCANDOS, ['ID (SUASE)', 'Nome', 'Data de Nascimento', 'Escolaridade', 'E-mail Profissional', 'Senha Profissional (Criptografada)', 'Registrado em', 'Criado por', 'Atualizado em', 'Atualizado por', 'Deletado em', 'Deletado por']);
  });
  var headers = getHeadersLower(SHEETS.SOCIOEDUCANDOS);

  function idx(nome, fallback) {
    var i = headers.indexOf(nome);
    return i >= 0 ? i : fallback;
  }

  var cols = {
    id: idx('id (suase)', 0),
    nome: idx('nome', 1),
    email_profissional: idx('e-mail profissional', -1),
    senha_profissional_cripto: idx('senha profissional (criptografada)', -1),
    nascimento: idx('data de nascimento', -1),
    escolaridade: idx('escolaridade', 2),
    registrado_em: idx('registrado em', 3),
    criadoPor: idx('criado por', 4),
    atualizadoEm: idx('atualizado em', 5),
    atualizadoPor: idx('atualizado por', 6),
    deletado_em: idx('deletado em', -1),
    deletado_por: idx('deletado por', -1)
  };
  _COLS_CACHE[SHEETS.SOCIOEDUCANDOS] = cols;
  return cols;
}

/**
 * Valida a existência de um ID de socioeducando antes de gravar qualquer
 * registro que o referencie (Admissoes, Fugas, Atendimentos, CursoMatriculas,
 * SaidaMatriculas). Como o Google Sheets não impõe chaves estrangeiras,
 * essa é a única barreira real contra registros "órfãos" apontando para um
 * socioeducando inexistente.
 */
function existeSocioeducando(id) {
  if (id === undefined || id === null || String(id).trim() === '') return false;
  var cols = getSocioeducandosCols();
  return getRowsAtivas(SHEETS.SOCIOEDUCANDOS).some(function(r) {
    return String(r[cols.id]) === String(id).trim();
  });
}

/** Lança erro se o socioeducando informado não existir. */
function validarSocioeducandoExiste(id) {
  if (!existeSocioeducando(id)) {
    throw new Error('Socioeducando com ID ' + id + ' não encontrado.');
  }
}

function ensureCursosEstrutura() {
  // No-op: new schema defined in inicializarPlanilha.
}

function ensureCursosNovasColunas() {
  var sh = SpreadsheetApp.getActiveSpreadsheet().getSheetByName(SHEETS.CURSOS);
  if (!sh || sh.getLastRow() === 0) return;
  var headers = sh.getRange(1, 1, 1, sh.getLastColumn()).getValues()[0]
    .map(function(h) { return String(h || '').trim().toLowerCase(); });

  // Verificar se possui 'id socioeducando' (estrutura antiga) — não mexer.
  if (headers.indexOf('id socioeducando') >= 0) return;

  var posInst = headers.indexOf('instituição');
  if (posInst < 0) return; // estrutura desconhecida

  var temVagas = headers.indexOf('vagas') >= 0;
  var temLimite = headers.indexOf('data limite inscrição') >= 0;
  if (temVagas && temLimite) return;

  var insertAfter = posInst + 1; // 1-based para insertColumnAfter
  if (!temVagas) {
    sh.insertColumnAfter(insertAfter);
    sh.getRange(1, insertAfter + 1).setValue('Vagas');
    sh.setColumnWidth(insertAfter + 1, 60);
    insertAfter++;
    headers.splice(posInst + 1, 0, 'vagas');
  }
  if (!temLimite) {
    var posVagas = headers.indexOf('vagas');
    sh.insertColumnAfter(posVagas + 1);
    sh.getRange(1, posVagas + 2).setValue('Data Limite Inscrição');
    sh.setColumnWidth(posVagas + 2, 110);
  }
}

function ensureCursosColunaLocal() {
  var ss = SpreadsheetApp.getActiveSpreadsheet();
  var sh = ss.getSheetByName(SHEETS.CURSOS);
  if (!sh || sh.getLastRow() === 0) return;
  var headers = sh.getRange(1, 1, 1, sh.getLastColumn()).getValues()[0];
  var temLocal = headers.some(function(h) { return String(h || '').trim().toLowerCase() === 'local'; });
  if (temLocal) return;

  var pos = sh.getLastColumn() + 1;
  sh.getRange(1, pos).setValue('Local');
  sh.setColumnWidth(pos, 90);

  // Migração: Externo/Interno é uma característica do curso (vale para todos os
  // matriculados), não da matrícula individual. Herda o valor já registrado no
  // antigo campo "Matrícula" (Interna/Externa) de qualquer matrícula do curso.
  if (sh.getLastRow() > 1) {
    var shMat = ss.getSheetByName(SHEETS.CURSO_MATRICULAS);
    if (shMat && shMat.getLastRow() > 1) {
      var headersLower = headers.map(function(h) { return String(h || '').trim().toLowerCase(); });
      var idIdx = headersLower.indexOf('id');
      var headersMat = shMat.getRange(1, 1, 1, shMat.getLastColumn()).getValues()[0]
        .map(function(h) { return String(h || '').trim().toLowerCase(); });
      var matCursoIdIdx = headersMat.indexOf('id curso');
      var matMatriculaIdx = headersMat.indexOf('matrícula');
      if (idIdx >= 0 && matCursoIdIdx >= 0 && matMatriculaIdx >= 0) {
        var localPorCurso = {};
        shMat.getRange(2, 1, shMat.getLastRow() - 1, shMat.getLastColumn()).getValues().forEach(function(r) {
          var cid = String(r[matCursoIdIdx]);
          var valor = String(r[matMatriculaIdx] || '').trim().toLowerCase();
          if (!localPorCurso[cid] && valor) {
            localPorCurso[cid] = (valor === 'interna' || valor === 'interno') ? 'Interno' : 'Externo';
          }
        });
        var idsCursos = sh.getRange(2, idIdx + 1, sh.getLastRow() - 1, 1).getValues();
        var valoresLocal = idsCursos.map(function(r) { return [localPorCurso[String(r[0])] || '']; });
        sh.getRange(2, pos, valoresLocal.length, 1).setValues(valoresLocal);
      }
    }
  }
}

function ensureCursosColunaObservacoes() {
  var sh = SpreadsheetApp.getActiveSpreadsheet().getSheetByName(SHEETS.CURSOS);
  if (!sh || sh.getLastRow() === 0) return;
  var headers = sh.getRange(1, 1, 1, sh.getLastColumn()).getValues()[0];
  var tem = headers.some(function(h) { return String(h || '').trim().toLowerCase() === 'observações'; });
  if (tem) return;

  var pos = sh.getLastColumn() + 1;
  sh.getRange(1, pos).setValue('Observações');
  sh.setColumnWidth(pos, 220);
}

function getCursosCols() {
  if (_COLS_CACHE[SHEETS.CURSOS]) return _COLS_CACHE[SHEETS.CURSOS];
  maybeEnsureOnRead(function() {
    ensureCursosNovasColunas();
    ensureColunasPadraoAuditoria(SHEETS.CURSOS);
    ensureCursosColunaLocal();
    ensureCursosColunaObservacoes();
    ensureOrdemColunas(SHEETS.CURSOS, ['ID', 'Tipo de Curso', 'Nome do Curso', 'Data Início', 'Horário Início', 'Data Término', 'Horário Término', 'Dias da Semana', 'Instituição', 'Local', 'Vagas', 'Data Limite Inscrição', 'Observações', 'Registrado em', 'Criado por', 'Atualizado em', 'Atualizado por', 'Deletado em', 'Deletado por']);
  });
  var headers = getHeadersLower(SHEETS.CURSOS);

  function idx(nome, fallback) {
    var i = headers.indexOf(nome);
    return i >= 0 ? i : fallback;
  }

  var cols = {
    id:                    idx('id', 0),
    tipo_curso:            idx('tipo de curso', 1),
    nome_curso:            idx('nome do curso', 2),
    data_inicio:           idx('data início', 3),
    horario_inicio:        idx('horário início', 4),
    data_termino:          idx('data término', 5),
    horario_termino:       idx('horário término', 6),
    dias_semana:           idx('dias da semana', 7),
    instituicao:           idx('instituição', 8),
    vagas:                 idx('vagas', 9),
    data_limite_inscricao: idx('data limite inscrição', 10),
    local:                 idx('local', -1),
    observacoes:           idx('observações', 12),
    registrado_em:         idx('registrado em', 13),
    criadoPor:             idx('criado por', 14),
    atualizadoEm:          idx('atualizado em', 15),
    atualizadoPor:         idx('atualizado por', 16),
    deletado_em:           idx('deletado em', -1),
    deletado_por:          idx('deletado por', -1)
  };
  _COLS_CACHE[SHEETS.CURSOS] = cols;
  return cols;
}

function ensureCursoMatriculasStatusVinculo() {
  var ss = SpreadsheetApp.getActiveSpreadsheet();
  var sh = ss.getSheetByName(SHEETS.CURSO_MATRICULAS);
  if (!sh || sh.getLastRow() === 0) return;
  var headers = sh.getRange(1, 1, 1, sh.getLastColumn()).getValues()[0];
  var temStatus = headers.some(function(h) { return String(h || '').trim().toLowerCase() === 'status vínculo'; });
  if (temStatus) return;
  var pos = sh.getLastColumn() + 1;
  sh.getRange(1, pos).setValue('Status Vínculo');
  sh.setColumnWidth(pos, 100);
}

function ensureCursoMatriculasNovasColunas() {
  var ss = SpreadsheetApp.getActiveSpreadsheet();
  var sh = ss.getSheetByName(SHEETS.CURSO_MATRICULAS);
  if (!sh || sh.getLastRow() === 0) return;
  var headers = sh.getRange(1, 1, 1, sh.getLastColumn()).getValues()[0];
  headers.forEach(function(h, i) {
    if (String(h || '').trim().toLowerCase() === 'finalizado') {
      sh.getRange(1, i + 1).setValue('Data de Conclusão');
      // Converte valores booleanos legados: TRUE → string vazia (sem data conhecida)
      if (sh.getLastRow() > 1) {
        var col = sh.getRange(2, i + 1, sh.getLastRow() - 1, 1).getValues();
        var conv = col.map(function(r) {
          var v = r[0];
          return (v === true || v === 'TRUE' || v === 'true' || v === 'SIM') ? [''] : [v];
        });
        sh.getRange(2, i + 1, sh.getLastRow() - 1, 1).setValues(conv);
      }
    }
  });
}

/**
 * Migra a antiga coluna "Status Vínculo" (Interessado | Matriculado |
 * Concluído | Desistente) para o novo modelo:
 *  - "Matriculado" (booleano): true = matriculado, false = apenas interessado.
 *  - "Tipo de Término" (string): "Concluído" | "Desistente" | "" — só
 *    preenchido quando o vínculo foi encerrado, sempre acompanhado de uma
 *    "Data de Término" (renomeada a partir da antiga "Data de Conclusão"),
 *    permitindo saber exatamente até quando o socioeducando frequentou o
 *    curso mesmo em caso de desistência.
 * A coluna "Status Vínculo" é mantida na planilha (não removida) apenas como
 * histórico legado; a aplicação não lê mais esse campo.
 */
function ensureCursoMatriculasMatriculadoTipoTermino() {
  var ss = SpreadsheetApp.getActiveSpreadsheet();
  var sh = ss.getSheetByName(SHEETS.CURSO_MATRICULAS);
  if (!sh || sh.getLastRow() === 0) return;

  // Renomeia "Data de Conclusão" → "Data de Término" (mesma coluna, sem migrar dados).
  var headers = sh.getRange(1, 1, 1, sh.getLastColumn()).getValues()[0];
  headers.forEach(function(h, i) {
    if (String(h || '').trim().toLowerCase() === 'data de conclusão') {
      sh.getRange(1, i + 1).setValue('Data de Término');
    }
  });

  headers = sh.getRange(1, 1, 1, sh.getLastColumn()).getValues()[0];
  var norm = headers.map(function(h) { return String(h || '').trim().toLowerCase(); });
  var idxStatus = norm.indexOf('status vínculo');
  var nLinhas = sh.getLastRow() - 1;

  if (norm.indexOf('matriculado') < 0) {
    var posM = sh.getLastColumn() + 1;
    sh.getRange(1, posM).setValue('Matriculado');
    sh.setColumnWidth(posM, 90);
    if (nLinhas > 0 && idxStatus >= 0) {
      var statusVals = sh.getRange(2, idxStatus + 1, nLinhas, 1).getValues();
      var matVals = statusVals.map(function(r) {
        var st = String(r[0] || '').trim();
        return [st === 'Matriculado' || st === 'Concluído' || st === 'Desistente'];
      });
      sh.getRange(2, posM, nLinhas, 1).setValues(matVals);
    }
  }

  headers = sh.getRange(1, 1, 1, sh.getLastColumn()).getValues()[0];
  norm = headers.map(function(h) { return String(h || '').trim().toLowerCase(); });
  idxStatus = norm.indexOf('status vínculo');

  if (norm.indexOf('tipo de término') < 0) {
    var posT = sh.getLastColumn() + 1;
    sh.getRange(1, posT).setValue('Tipo de Término');
    sh.setColumnWidth(posT, 110);
    if (nLinhas > 0 && idxStatus >= 0) {
      var statusVals2 = sh.getRange(2, idxStatus + 1, nLinhas, 1).getValues();
      var tipoVals = statusVals2.map(function(r) {
        var st = String(r[0] || '').trim();
        return [(st === 'Concluído' || st === 'Desistente') ? st : ''];
      });
      sh.getRange(2, posT, nLinhas, 1).setValues(tipoVals);
    }
  }
}

function getCursoMatriculasCols() {
  if (_COLS_CACHE[SHEETS.CURSO_MATRICULAS]) return _COLS_CACHE[SHEETS.CURSO_MATRICULAS];
  maybeEnsureOnRead(function() {
    ensureCursoMatriculasNovasColunas();
    ensureColunasPadraoAuditoria(SHEETS.CURSO_MATRICULAS);
    ensureCursoMatriculasStatusVinculo();
    ensureCursoMatriculasMatriculadoTipoTermino();
    ensureOrdemColunas(SHEETS.CURSO_MATRICULAS, ['ID', 'ID Curso', 'ID Socioeducando', 'Matriculado', 'Tipo de Término', 'Data de Término', 'Certificado', 'Observações', 'Registrado em', 'Criado por', 'Atualizado em', 'Atualizado por', 'Deletado em', 'Deletado por']);
  });
  var headers = getHeadersLower(SHEETS.CURSO_MATRICULAS);

  function idx(nome, fallback) {
    var i = headers.indexOf(nome);
    return i >= 0 ? i : fallback;
  }

  var cols = {
    id:               idx('id', 0),
    curso_id:         idx('id curso', 1),
    socioeducando_id: idx('id socioeducando', 2),
    matriculado:      idx('matriculado', -1),
    tipo_termino:     idx('tipo de término', -1),
    data_termino:     idx('data de término', idx('data de conclusão', 3)),
    certificado:      idx('certificado', 4),
    observacoes:      idx('observações', 6),
    registrado_em:    idx('registrado em', 7),
    criadoPor:        idx('criado por', 8),
    atualizadoEm:     idx('atualizado em', 9),
    atualizadoPor:    idx('atualizado por', 10),
    deletado_em:      idx('deletado em', -1),
    deletado_por:     idx('deletado por', -1)
  };
  _COLS_CACHE[SHEETS.CURSO_MATRICULAS] = cols;
  return cols;
}

function ensureCursoEventosCursoMatricula() {
  var sh = getSheet(SHEETS.CURSO_EVENTOS);
  if (sh.getLastRow() === 0) return;

  var headers = sh.getRange(1, 1, 1, sh.getLastColumn()).getValues()[0];
  var headersLower = headers.map(function(h) { return String(h || '').trim().toLowerCase(); });
  if (headersLower.indexOf('id curso matrícula') >= 0) return;

  var iCurso = headersLower.indexOf('id curso');
  var iSocio = headersLower.indexOf('id socioeducando');
  if (iCurso < 0 || iSocio < 0) {
    throw new Error('A aba CursoEventos não possui a estrutura esperada para migração. Esperadas as colunas ID Curso e ID Socioeducando.');
  }

  var cm = getCursoMatriculasCols();
  var matriculasPorPar = {};
  getRowsAtivas(SHEETS.CURSO_MATRICULAS).forEach(function(m) {
    var chave = String(m[cm.curso_id]) + '|' + String(m[cm.socioeducando_id]);
    (matriculasPorPar[chave] = matriculasPorPar[chave] || []).push(m);
  });

  var valoresAntigos = sh.getLastRow() > 1
    ? sh.getRange(2, 1, sh.getLastRow() - 1, sh.getLastColumn()).getValues()
    : [];
  var colunasNovas = ['ID', 'ID Curso Matrícula', 'Data', 'Ausente', 'Observações', 'Registrado em', 'Criado por', 'Atualizado em', 'Atualizado por', 'Deletado em', 'Deletado por'];
  var indiceAntigo = {};
  headersLower.forEach(function(h, i) { indiceAntigo[h] = i; });
  function valorAntigo(linha, cabecalho) {
    var i = indiceAntigo[cabecalho.toLowerCase()];
    return i === undefined ? '' : linha[i];
  }

  var linhasNovas = valoresAntigos.map(function(linha, indice) {
    var chave = String(linha[iCurso]) + '|' + String(linha[iSocio]);
    var candidatas = matriculasPorPar[chave] || [];
    if (candidatas.length !== 1) {
      throw new Error('Não foi possível migrar CursoEventos na linha ' + (indice + 2) + ': é necessária exatamente uma CursoMatrícula para o curso e socioeducando registrados.');
    }
    return [
      valorAntigo(linha, 'ID'), candidatas[0][cm.id], valorAntigo(linha, 'Data'),
      valorAntigo(linha, 'Ausente'), valorAntigo(linha, 'Observações'),
      valorAntigo(linha, 'Registrado em'), valorAntigo(linha, 'Criado por'),
      valorAntigo(linha, 'Atualizado em'), valorAntigo(linha, 'Atualizado por'),
      valorAntigo(linha, 'Deletado em'), valorAntigo(linha, 'Deletado por')
    ];
  });

  sh.getRange(1, 1, sh.getLastRow(), sh.getLastColumn()).clearContent();
  sh.getRange(1, 1, 1, colunasNovas.length).setValues([colunasNovas]);
  if (linhasNovas.length) sh.getRange(2, 1, linhasNovas.length, colunasNovas.length).setValues(linhasNovas);
  if (sh.getLastColumn() > colunasNovas.length) {
    sh.deleteColumns(colunasNovas.length + 1, sh.getLastColumn() - colunasNovas.length);
  }
  clearSheetCaches(SHEETS.CURSO_EVENTOS);
}

function getCursoEventosCols() {
  if (_COLS_CACHE[SHEETS.CURSO_EVENTOS]) return _COLS_CACHE[SHEETS.CURSO_EVENTOS];
  maybeEnsureOnRead(function() {
    ensureColunasPadraoAuditoria(SHEETS.CURSO_EVENTOS);
    ensureCursoEventosCursoMatricula();
    ensureOrdemColunas(SHEETS.CURSO_EVENTOS, ['ID', 'ID Curso Matrícula', 'Data', 'Ausente', 'Observações', 'Registrado em', 'Criado por', 'Atualizado em', 'Atualizado por', 'Deletado em', 'Deletado por']);
  });
  var headers = getHeadersLower(SHEETS.CURSO_EVENTOS);

  function idx(nome, fallback) {
    var i = headers.indexOf(nome);
    return i >= 0 ? i : fallback;
  }

  var cols = {
    id:                  idx('id', 0),
    curso_matricula_id:  idx('id curso matrícula', 1),
    data:                idx('data', 2),
    ausente:             idx('ausente', 3),
    observacoes:         idx('observações', 4),
    registrado_em:       idx('registrado em', 5),
    criadoPor:           idx('criado por', 6),
    atualizadoEm:        idx('atualizado em', 7),
    atualizadoPor:       idx('atualizado por', 8),
    deletado_em:         idx('deletado em', -1),
    deletado_por:        idx('deletado por', -1)
  };
  _COLS_CACHE[SHEETS.CURSO_EVENTOS] = cols;
  return cols;
}

function cursoDataHoraLocal(data, hora) {
  var d = String(data || '').trim();
  var h = String(hora || '').trim();
  if (!d || !h) return '';
  return d + 'T' + h;
}

function cursoPeriodoInvalido(dados) {
  // Quando não há horário informado, compara apenas as datas (meia-noite como referência).
  var inicio = cursoDataHoraLocal(dados.data_inicio, dados.horario_inicio || '00:00');
  var termino = cursoDataHoraLocal(dados.data_termino, dados.horario_termino || '00:00');
  if (!inicio || !termino) return false;
  return termino < inicio;
}

/**
 * Horário de início/término do curso são opcionais, mas se um for informado
 * o outro também precisa ser (não faz sentido ter só um dos dois).
 */
function validarHorarioCurso(dados) {
  var hi = String(dados.horario_inicio || '').trim();
  var ht = String(dados.horario_termino || '').trim();
  if ((hi && !ht) || (!hi && ht)) {
    throw new Error('Informe o horário de início e término juntos, ou deixe ambos em branco.');
  }
}

function trabalhoPeriodoInvalido(dados) {
  var inicio = cursoDataHoraLocal(dados.data_inicio, dados.horario_inicio || '00:00');
  var termino = cursoDataHoraLocal(dados.data_fim, dados.horario_fim || '00:00');
  if (!inicio || !termino) return false;
  return termino < inicio;
}

function validarHorarioTrabalho(dados) {
  var hi = String(dados.horario_inicio || '').trim();
  var ht = String(dados.horario_fim || '').trim();
  var dias = String(dados.dias_semana || '').trim();
  if ((hi && !ht) || (!hi && ht)) {
    throw new Error('Informe o horário de início e término juntos, ou deixe ambos em branco.');
  }
  if ((hi || ht) && !dias) {
    throw new Error('Selecione os dias da semana do trabalho.');
  }
  if (dias && (!hi || !ht)) {
    throw new Error('Ao informar os dias da semana, preencha também horário de início e fim.');
  }
}

// ── Leitura de dados ──────────────────────────────────────────

function getSaidasCols() {
  if (_COLS_CACHE[SHEETS.SAIDAS]) return _COLS_CACHE[SHEETS.SAIDAS];
  maybeEnsureOnRead(function() {
    ensureColunasPadraoAuditoria(SHEETS.SAIDAS);
    ensureSaidasTipoColumn();
    ensureSaidasObservacoesColumn();
    ensureOrdemColunas(SHEETS.SAIDAS, ['ID', 'Local', 'Tipo', 'Data/Hora Ida', 'Data/Hora Volta', 'Condução', 'Nome Acompanhante', 'Observações', 'Registrado em', 'Criado por', 'Atualizado em', 'Atualizado por', 'Deletado em', 'Deletado por']);
  });
  var headers = getHeadersLower(SHEETS.SAIDAS);

  function idx(nome, fallback) {
    var i = headers.indexOf(nome);
    return i >= 0 ? i : fallback;
  }

  var cols = {
    id:                idx('id', 0),
    local:             idx('local', 1),
    tipo:              idx('tipo', 2),
    data_hora_ida:     idx('data/hora ida', 3),
    data_hora_volta:   idx('data/hora volta', 4),
    conducao:          idx('condução', 5),
    nome_acompanhante: idx('nome acompanhante', 6),
    observacoes:       idx('observações', 7),
    registrado_em:     idx('registrado em', 8),
    criadoPor:         idx('criado por', 9),
    atualizadoEm:      idx('atualizado em', 10),
    atualizadoPor:     idx('atualizado por', 11),
    deletado_em:       idx('deletado em', 12),
    deletado_por:      idx('deletado por', 13)
  };
  _COLS_CACHE[SHEETS.SAIDAS] = cols;
  return cols;
}

function getSaidaMatriculasCols() {
  if (_COLS_CACHE[SHEETS.SAIDA_MATRICULAS]) return _COLS_CACHE[SHEETS.SAIDA_MATRICULAS];
  maybeEnsureOnRead(function() {
    ensureColunasPadraoAuditoria(SHEETS.SAIDA_MATRICULAS);
    ensureOrdemColunas(SHEETS.SAIDA_MATRICULAS, ['ID', 'ID Saída', 'ID Socioeducando', 'Status', 'Observações', 'Registrado em', 'Criado por', 'Atualizado em', 'Atualizado por', 'Deletado em', 'Deletado por']);
  });
  var headers = getHeadersLower(SHEETS.SAIDA_MATRICULAS);

  function idx(nome, fallback) {
    var i = headers.indexOf(nome);
    return i >= 0 ? i : fallback;
  }

  var cols = {
    id:               idx('id', 0),
    saida_id:         idx('id saída', 1),
    socioeducando_id: idx('id socioeducando', 2),
    status:           idx('status', 3),
    observacoes:      idx('observações', 4),
    registrado_em:    idx('registrado em', 5),
    criadoPor:        idx('criado por', 6),
    atualizadoEm:     idx('atualizado em', 7),
    atualizadoPor:    idx('atualizado por', 8),
    deletado_em:      idx('deletado em', -1),
    deletado_por:     idx('deletado por', -1)
  };
  _COLS_CACHE[SHEETS.SAIDA_MATRICULAS] = cols;
  return cols;
}

function getSaidasBySocioeducando(socioeducandoId, incluirDeletados) {
  var cm = getSaidaMatriculasCols();
  var cs = getSaidasCols();

  var matriculas = (incluirDeletados ? getRows(SHEETS.SAIDA_MATRICULAS) : getRowsAtivas(SHEETS.SAIDA_MATRICULAS))
    .filter(function(r) { return String(r[cm.socioeducando_id]) === String(socioeducandoId); });

  var saidasMap = {};
  (incluirDeletados ? getRows(SHEETS.SAIDAS) : getRowsAtivas(SHEETS.SAIDAS)).forEach(function(r) {
    saidasMap[String(r[cs.id])] = r;
  });

  return matriculas.map(function(m) {
    var s = saidasMap[String(m[cm.saida_id])] || [];
    var matriculaDeletada = cm.deletado_em >= 0 ? toIso(m[cm.deletado_em]) : '';
    var saidaDeletada = (s && s.length && cs.deletado_em >= 0) ? toIso(s[cs.deletado_em]) : '';
    return {
      id:                  String(m[cm.id]),
      matricula_id:        String(m[cm.id]),
      saida_id:            String(m[cm.saida_id]),
      socioeducando_id:    String(m[cm.socioeducando_id]),
      local:               String(s[cs.local]              || ''),
      tipo:                String(s[cs.tipo]               || ''),
      data_hora_ida_iso:   toIsoDateTime(s[cs.data_hora_ida]),
      data_hora_ida:       fmtDateTime(s[cs.data_hora_ida]),
      data_hora_volta_iso: toIsoDateTime(s[cs.data_hora_volta]),
      data_hora_volta:     fmtDateTime(s[cs.data_hora_volta]),
      conducao:            String(s[cs.conducao]           || ''),
      nome_acompanhante:   String(s[cs.nome_acompanhante]   || ''),
      observacoes_saida:   String(s[cs.observacoes]         || ''),
      status:              String(m[cm.status]              || ''),
      observacoes:         String(m[cm.observacoes]         || ''),
      created_at:          fmtDate(m[cm.registrado_em]),
      deletado_em:         matriculaDeletada || saidaDeletada,
      ativo:               !(matriculaDeletada || saidaDeletada)
    };
  }).sort(function(a, b) { return b.data_hora_ida_iso.localeCompare(a.data_hora_ida_iso); });
}

function getAtendimentosBySocioeducando(socioeducandoId, incluirDeletados) {
  var ca = getAtendimentosCols();
  ensureAtendimentosObservacoesColumn();
  ensureAtendimentosColunasNaoRealizado();
  var sh = getSheet(SHEETS.ATENDIMENTOS);
  var headers = sh.getLastRow() > 0 ? getHeadersLower(SHEETS.ATENDIMENTOS) : [];
  function col(nome, fallback) {
    var i = headers.indexOf(nome.toLowerCase());
    return i >= 0 ? i : fallback;
  }
  var iRealizado   = ca.realizado >= 0 ? ca.realizado : col('realizado', 6);
  var iMotivo      = ca.motivo_nao_realizado >= 0 ? ca.motivo_nao_realizado : col('motivo não realizado', 7);
  var iReposicao   = ca.id_atendimento_reposicao >= 0 ? ca.id_atendimento_reposicao : col('id atendimento reposição', 8);

  var rows = incluirDeletados ? getRows(SHEETS.ATENDIMENTOS) : getRowsAtivas(SHEETS.ATENDIMENTOS);
  return rows
    .filter(function(r) { return String(r[1]) === String(socioeducandoId); })
    .map(function(r) {
      var realizado = String(r[iRealizado] || '').trim();
      if (realizado === '') realizado = 'Sim';
      var deletadoEm = ca.deletado_em >= 0 ? toIso(r[ca.deletado_em]) : '';
      return {
        id: String(r[0]),
        socioeducando_id: String(r[1]),
        tipo_atendimento: String(r[2] || ''),
        responsavel: String(r[3] || ''),
        data_hora_inicio_iso: toIsoDateTime(r[4]),
        data_hora_inicio: fmtDateTime(r[4]),
        data_hora_termino_iso: toIsoDateTime(r[5]),
        data_hora_termino: fmtDateTime(r[5]),
        realizado: realizado,
        motivo_nao_realizado: String(r[iMotivo] || ''),
        id_atendimento_reposicao: String(r[iReposicao] || ''),
        observacoes: String(r[ca.observacoes] || ''),
        created_at: fmtDate(r[ca.registrado_em]),
        deletado_em: deletadoEm,
        ativo: !deletadoEm,
      };
    })
    .sort(function(a, b) { return b.data_hora_inicio_iso.localeCompare(a.data_hora_inicio_iso); });
}

function getTrabalhosBySocioeducando(socioeducandoId, incluirDeletados) {
  var ct = getTrabalhosCols();
  var rows = incluirDeletados ? getRows(SHEETS.TRABALHOS) : getRowsAtivas(SHEETS.TRABALHOS);
  return rows
    .filter(function(r) { return String(r[ct.socioeducando_id]) === String(socioeducandoId); })
    .map(function(r) {
      var deletadoEm = ct.deletado_em >= 0 ? toIso(r[ct.deletado_em]) : '';
      return {
        id: String(r[ct.id]),
        socioeducando_id: String(r[ct.socioeducando_id]),
        tipo: String(r[ct.tipo] || ''),
        empresa: String(r[ct.empresa] || ''),
        curso: String(r[ct.curso] || ''),
        data_contrato_iso: toIso(r[ct.data_contrato]),
        data_contrato: fmtDate(r[ct.data_contrato]),
        data_inicio_iso: toIso(r[ct.data_inicio]),
        data_inicio: fmtDate(r[ct.data_inicio]),
        data_fim_iso: toIso(r[ct.data_fim]),
        data_fim: fmtDate(r[ct.data_fim]),
        horario_inicio: fmtTime(r[ct.horario_inicio]),
        horario_fim: fmtTime(r[ct.horario_fim]),
        dias_semana: String(r[ct.dias_semana] || ''),
        created_at: fmtDate(r[ct.registrado_em]),
        deletado_em: deletadoEm,
        ativo: !deletadoEm
      };
    })
    .sort(function(a, b) {
      var ai = a.data_inicio_iso || '';
      var bi = b.data_inicio_iso || '';
      return bi.localeCompare(ai);
    });
}

function getVisitasTerritoriaisBySocioeducando(socioeducandoId, incluirDeletados) {
  var cv = getVisitasTerritoriaisCols();
  var rows = incluirDeletados ? getRows(SHEETS.VISITAS_TERRITORIAIS) : getRowsAtivas(SHEETS.VISITAS_TERRITORIAIS);
  return rows
    .filter(function(r) { return String(r[cv.socioeducando_id]) === String(socioeducandoId); })
    .map(function(r) {
      var deletadoEm = cv.deletado_em >= 0 ? toIso(r[cv.deletado_em]) : '';
      return {
        id: String(r[cv.id]),
        socioeducando_id: String(r[cv.socioeducando_id]),
        data_iso: toIso(r[cv.data]),
        data: fmtDate(r[cv.data]),
        tec_responsavel: String(r[cv.tec_responsavel] || ''),
        atendido_por: String(r[cv.atendido_por] || ''),
        creas: boolVal(r[cv.creas]),
        caps: boolVal(r[cv.caps]),
        ameaca: boolVal(r[cv.ameaca]),
        observacoes: String(r[cv.observacoes] || ''),
        created_at: fmtDate(r[cv.registrado_em]),
        deletado_em: deletadoEm,
        ativo: !deletadoEm
      };
    })
    .sort(function(a, b) {
      return String(b.data_iso || '').localeCompare(String(a.data_iso || ''));
    });
}

function getFamiliaresBySocioeducando(socioeducandoId, incluirDeletados) {
  var cf = getFamiliaresCols();
  var rows = incluirDeletados ? getRows(SHEETS.FAMILIARES) : getRowsAtivas(SHEETS.FAMILIARES);
  return rows
    .filter(function(r) { return String(r[cf.socioeducando_id]) === String(socioeducandoId); })
    .map(function(r) {
      var deletadoEm = cf.deletado_em >= 0 ? toIso(r[cf.deletado_em]) : '';
      return {
        id: String(r[cf.id]),
        socioeducando_id: String(r[cf.socioeducando_id]),
        nome: String(r[cf.nome] || ''),
        telefone: String(r[cf.telefone] || ''),
        tipo_vinculo: String(r[cf.tipo_vinculo] || ''),
        endereco: String(r[cf.endereco] || ''),
        principal: boolVal(r[cf.principal]),
        created_at: fmtDate(r[cf.registrado_em]),
        deletado_em: deletadoEm,
        ativo: !deletadoEm
      };
    })
    .sort(function(a, b) {
      if (a.principal !== b.principal) return a.principal ? -1 : 1;
      return a.nome.localeCompare(b.nome, 'pt-BR');
    });
}

function carregarSaidaMatricula(matriculaId) {
  var cm = getSaidaMatriculasCols();
  var cs = getSaidasCols();

  var m = getRowsAtivas(SHEETS.SAIDA_MATRICULAS).find(function(r) { return String(r[cm.id]) === String(matriculaId); });
  if (!m) return null;

  var s = getRowsAtivas(SHEETS.SAIDAS).find(function(r) { return String(r[cs.id]) === String(m[cm.saida_id]); }) || [];

  return {
    matricula_id:        String(m[cm.id]),
    saida_id:            String(m[cm.saida_id]),
    socioeducando_id:    String(m[cm.socioeducando_id]),
    local:               String(s[cs.local]              || ''),
    tipo:                String(s[cs.tipo]               || ''),
    data_hora_ida_iso:   toIsoDateTime(s[cs.data_hora_ida]),
    data_hora_volta_iso: toIsoDateTime(s[cs.data_hora_volta]),
    conducao:            String(s[cs.conducao]           || ''),
    nome_acompanhante:   String(s[cs.nome_acompanhante]   || ''),
    observacoes_saida:   String(s[cs.observacoes]         || ''),
    status:              String(m[cm.status]              || ''),
    observacoes:         String(m[cm.observacoes]         || '')
  };
}

function salvarSaidaComMatricula(dados) {
  var tipoSaida = String(dados.tipo || '').trim();
  if (!dados.socioeducando_id) throw new Error('Socioeducando não identificado.');
  validarSocioeducandoExiste(dados.socioeducando_id);
  if (!dados.local || dados.local.trim() === '') throw new Error('Local é obrigatório.');
  if (!tipoSaida) throw new Error('Tipo é obrigatório.');
  if (TIPOS_SAIDA_PADRAO.indexOf(tipoSaida) < 0) throw new Error('Tipo de saída inválido.');
  if (!dados.data_hora_ida) throw new Error('Data/hora de ida é obrigatória.');
  if (!dados.data_hora_volta) throw new Error('Data/hora de volta é obrigatória.');
  if (isDateTimeEndBeforeStart(dados.data_hora_ida, dados.data_hora_volta)) {
    throw new Error('A data/hora de volta não pode ser anterior à data/hora de ida.');
  }
  if (!dados.conducao) throw new Error('Condução é obrigatória.');
  if (!dados.nome_acompanhante || String(dados.nome_acompanhante).trim() === '') throw new Error('Nome do(a) acompanhante é obrigatório.');
  if (!dados.status) throw new Error('Status é obrigatório.');

  var shSaidas = getSheet(SHEETS.SAIDAS);
  var shMat = getSheet(SHEETS.SAIDA_MATRICULAS);
  var rowsSaidas = getRows(SHEETS.SAIDAS);
  var rowsMat = getRows(SHEETS.SAIDA_MATRICULAS);
  var cs = getSaidasCols();
  var cm = getSaidaMatriculasCols();
  var user = usuarioAtual();

  var saidaLinha = [
    null, dados.local.trim(), tipoSaida, dados.data_hora_ida, dados.data_hora_volta || '',
    dados.conducao, dados.nome_acompanhante || '', dados.observacoes_saida || '', null, null, null, null, null, null
  ];

  var saidaId;
  if (dados.saida_id) {
    var idxS = rowsSaidas.findIndex(function(r) { return String(r[cs.id]) === String(dados.saida_id); });
    if (idxS < 0) throw new Error('Saída não encontrada para edição.');
    saidaId = Number(dados.saida_id);
    saidaLinha[0] = saidaId;
    saidaLinha[cs.registrado_em] = rowsSaidas[idxS][cs.registrado_em] || new Date();
    saidaLinha[cs.criadoPor] = rowsSaidas[idxS][cs.criadoPor] || user;
    saidaLinha[cs.atualizadoEm] = new Date();
    saidaLinha[cs.atualizadoPor] = user;
    shSaidas.getRange(idxS + 2, 1, 1, saidaLinha.length).setValues([saidaLinha]);
  } else {
    saidaId = nextId(SHEETS.SAIDAS);
    saidaLinha[0] = saidaId;
    saidaLinha[cs.registrado_em] = new Date();
    saidaLinha[cs.criadoPor] = user;
    saidaLinha[cs.atualizadoEm] = '';
    saidaLinha[cs.atualizadoPor] = '';
    shSaidas.appendRow(saidaLinha);
  }

  var matLinha = [
    null, saidaId, Number(dados.socioeducando_id),
    dados.status, dados.observacoes || '', null, null, null, null, null, null
  ];

  if (dados.matricula_id) {
    var idxM = rowsMat.findIndex(function(r) { return String(r[cm.id]) === String(dados.matricula_id); });
    if (idxM < 0) throw new Error('Vínculo de saída não encontrado para edição.');
    matLinha[0] = Number(dados.matricula_id);
    matLinha[5] = rowsMat[idxM][cm.registrado_em] || new Date();
    matLinha[6] = rowsMat[idxM][cm.criadoPor] || user;
    matLinha[7] = rowsMat[idxM][cm.atualizadoEm] || new Date();
    matLinha[8] = user;
    shMat.getRange(idxM + 2, 1, 1, matLinha.length).setValues([matLinha]);
  } else {
    matLinha[0] = nextId(SHEETS.SAIDA_MATRICULAS);
    matLinha[5] = new Date();
    matLinha[6] = user;
    matLinha[7] = '';
    matLinha[8] = '';
    shMat.appendRow(matLinha);
  }

  return { ok: true, saida_id: saidaId, matricula_id: matLinha[0] };
}

function registrarVolta(saidaId, dataHoraVolta) {
  if (!dataHoraVolta) throw new Error('Informe a data/hora de volta.');
  var sh = getSheet(SHEETS.SAIDAS);
  var rows = getRows(SHEETS.SAIDAS);
  var cs = getSaidasCols();
  var idx = rows.findIndex(function(r) { return String(r[cs.id]) === String(saidaId); });
  if (idx < 0) throw new Error('Registro não encontrado.');
  var dataHoraIda = toIsoDateTime(rows[idx][cs.data_hora_ida]);
  if (dataHoraIda && isDateTimeEndBeforeStart(dataHoraIda, dataHoraVolta)) {
    throw new Error('A data/hora de volta não pode ser anterior à data/hora de ida.');
  }
  sh.getRange(idx + 2, cs.data_hora_volta + 1).setValue(dataHoraVolta);
  sh.getRange(idx + 2, cs.atualizadoEm + 1).setValue(new Date());
  sh.getRange(idx + 2, cs.atualizadoPor + 1).setValue(usuarioAtual());
  return { ok: true };
}

function salvarSaidaLote(vinculosSocioeducandos, dados) {
  var tipoSaida = String(dados.tipo || '').trim();
  if (!dados.local || dados.local.trim() === '') throw new Error('Local é obrigatório.');
  if (!tipoSaida) throw new Error('Tipo é obrigatório.');
  if (TIPOS_SAIDA_PADRAO.indexOf(tipoSaida) < 0) throw new Error('Tipo de saída inválido.');
  if (!dados.data_hora_ida) throw new Error('Data/hora de ida é obrigatória.');
  if (!dados.data_hora_volta) throw new Error('Data/hora de volta é obrigatória.');
  if (isDateTimeEndBeforeStart(dados.data_hora_ida, dados.data_hora_volta)) {
    throw new Error('A data/hora de volta não pode ser anterior à data/hora de ida.');
  }
  if (!dados.conducao) throw new Error('Condução é obrigatória.');
  if (!dados.nome_acompanhante || String(dados.nome_acompanhante).trim() === '') throw new Error('Nome do(a) acompanhante é obrigatório.');

  var vinculos = (vinculosSocioeducandos || []).filter(function(v) { return v && v.id && v.status; });
  if (!vinculos.length) throw new Error('Defina o status de ao menos um socioeducando.');
  vinculos.forEach(function(v) { validarSocioeducandoExiste(v.id); });

  var shSaidas = getSheet(SHEETS.SAIDAS);
  var shMat = getSheet(SHEETS.SAIDA_MATRICULAS);
  var user = usuarioAtual();
  var agora = new Date();

  var saidaId = nextId(SHEETS.SAIDAS);
  shSaidas.appendRow([
    saidaId, dados.local.trim(), tipoSaida, dados.data_hora_ida, dados.data_hora_volta || '',
    dados.conducao, dados.nome_acompanhante || '', dados.observacoes_saida || '', agora, user, '', '', '', ''
  ]);

  var baseMatId = nextId(SHEETS.SAIDA_MATRICULAS);
  var linhasMat = vinculos.map(function(v, i) {
    return [
      baseMatId + i, saidaId, Number(v.id),
      v.status, v.observacoes || '',
      agora, user, '', '', '', ''
    ];
  });
  shMat.getRange(shMat.getLastRow() + 1, 1, linhasMat.length, 11).setValues(linhasMat);

  return { inseridos: linhasMat.length, saida_id: saidaId };
}

function getSocioeducandos(incluirDeletados) {
  var cols = getSocioeducandosCols();
  var rows = incluirDeletados ? getRows(SHEETS.SOCIOEDUCANDOS) : getRowsAtivas(SHEETS.SOCIOEDUCANDOS);
  return rows
    .filter(function(r) { return r[cols.id] !== '' && r[cols.id] !== null; })
    .map(function(r) {
      var nascimentoRaw = cols.nascimento >= 0 ? r[cols.nascimento] : '';
      var deletadoEm = cols.deletado_em >= 0 ? toIso(r[cols.deletado_em]) : '';
      return {
        id: String(r[cols.id]),
        nome: String(r[cols.nome] || ''),
        email_profissional: cols.email_profissional >= 0 ? String(r[cols.email_profissional] || '') : '',
        data_nascimento_iso: toIso(nascimentoRaw),
        data_nascimento: fmtDate(nascimentoRaw),
        escolaridade: String(r[cols.escolaridade] || ''),
        created_at: fmtDate(r[cols.registrado_em]),
        deletado_em: deletadoEm,
        ativo: !deletadoEm
      };
    })
    .sort(function(a, b) { return a.nome.localeCompare(b.nome, 'pt-BR'); });
}

/**
 * Retorna apenas os socioeducandos "ativos" (não desligados): aqueles com
 * uma admissão sem data de desligamento, ou atualmente em fuga/evasão sem
 * retorno registrado. Usado nas telas de cadastro em lote/geral (curso,
 * atendimento, saída) para não oferecer socioeducandos já desligados.
 */
function getSocioeducandosAtivos() {
  var socioeducandos = getSocioeducandos();
  var ca = getAdmissoesCols();
  var cf = getFugasCols();

  var ativoPorSocioeducando = {};
  getRowsAtivas(SHEETS.ADMISSOES).forEach(function(r) {
    if (toIso(r[ca.data_desligamento])) return;
    ativoPorSocioeducando[String(r[ca.socioeducando_id])] = true;
  });
  getRowsAtivas(SHEETS.FUGAS).forEach(function(r) {
    if (toIso(r[cf.data_retorno])) return;
    ativoPorSocioeducando[String(r[cf.socioeducando_id])] = true;
  });

  return socioeducandos.filter(function(j) { return !!ativoPorSocioeducando[j.id]; });
}

function getCursosBySocioeducando(socioeducandoId, incluirDeletados) {
  var cm = getCursoMatriculasCols();
  var cc = getCursosCols();

  var matriculas = (incluirDeletados ? getRows(SHEETS.CURSO_MATRICULAS) : getRowsAtivas(SHEETS.CURSO_MATRICULAS))
    .filter(function(r) { return String(r[cm.socioeducando_id]) === String(socioeducandoId); });

  var cursosMap = {};
  (incluirDeletados ? getRows(SHEETS.CURSOS) : getRowsAtivas(SHEETS.CURSOS)).forEach(function(r) {
    cursosMap[String(r[cc.id])] = r;
  });

  return matriculas.map(function(m) {
    var c = cursosMap[String(m[cm.curso_id])] || [];
    var matriculaDeletada = cm.deletado_em >= 0 ? toIso(m[cm.deletado_em]) : '';
    var cursoDeletado = (c && c.length && cc.deletado_em >= 0) ? toIso(c[cc.deletado_em]) : '';
    var ativo = !(matriculaDeletada || cursoDeletado);
    return {
      matricula_id:          String(m[cm.id]),
      curso_id:              String(m[cm.curso_id]),
      id:                    String(m[cm.id]),
      socioeducando_id:      String(m[cm.socioeducando_id]),
      tipo_curso:            String(c[cc.tipo_curso]            || ''),
      nome_curso:            String(c[cc.nome_curso]            || ''),
      data_inicio_iso:       toIso(c[cc.data_inicio]),
      data_inicio:           fmtDate(c[cc.data_inicio]),
      horario_inicio:        fmtTime(c[cc.horario_inicio]),
      data_termino_iso:      toIso(c[cc.data_termino]),
      data_termino:          fmtDate(c[cc.data_termino]),
      horario_termino:       fmtTime(c[cc.horario_termino]),
      dias_semana:           String(c[cc.dias_semana]            || ''),
      instituicao:           String(c[cc.instituicao]            || ''),
      vagas:                 c[cc.vagas] !== undefined && c[cc.vagas] !== '' ? Number(c[cc.vagas]) || '' : '',
      data_limite_inscricao: toIso(c[cc.data_limite_inscricao]),
      local:                 String(c[cc.local]                  || ''),
      matricula_data_termino_iso: toIso(m[cm.data_termino]),
      matricula_data_termino:     fmtDate(m[cm.data_termino]),
      finalizado:            !!toIso(m[cm.data_termino]),
      certificado:           boolVal(m[cm.certificado]),
      observacoes:           String(m[cm.observacoes]            || ''),
      matriculado:           boolVal(m[cm.matriculado]),
      tipo_termino:          String(m[cm.tipo_termino]           || ''),
      created_at:            fmtDate(m[cm.registrado_em]),
      deletado_em:           matriculaDeletada || cursoDeletado,
      ativo:                 ativo
    };
  }).sort(function(a, b) { return b.data_inicio_iso.localeCompare(a.data_inicio_iso); });
}

function getAdmissoesBySocioeducando(socioeducandoId, incluirDeletados) {
  var ca = getAdmissoesCols();
  var rows = incluirDeletados ? getRows(SHEETS.ADMISSOES) : getRowsAtivas(SHEETS.ADMISSOES);
  return rows
    .filter(function(r) { return String(r[ca.socioeducando_id]) === String(socioeducandoId); })
    .map(function(r) {
      var deletadoEm = ca.deletado_em >= 0 ? toIso(r[ca.deletado_em]) : '';
      return {
        id: String(r[ca.id]),
        socioeducando_id: String(r[ca.socioeducando_id]),
        data_admissao_iso: toIso(r[ca.data_admissao]),
        data_admissao: fmtDate(r[ca.data_admissao]),
        data_desligamento_iso: toIso(r[ca.data_desligamento]),
        data_desligamento: fmtDate(r[ca.data_desligamento]),
        created_at: fmtDate(r[ca.registrado_em]),
        deletado_em: deletadoEm,
        ativo: !deletadoEm
      };
    })
    .sort(function(a, b) { return b.data_admissao_iso.localeCompare(a.data_admissao_iso); });
}

function getFugasBySocioeducando(socioeducandoId, incluirDeletados) {
  var cf = getFugasCols();
  var rows = incluirDeletados ? getRows(SHEETS.FUGAS) : getRowsAtivas(SHEETS.FUGAS);
  return rows
    .filter(function(r) { return String(r[cf.socioeducando_id]) === String(socioeducandoId); })
    .map(function(r) {
      var deletadoEm = cf.deletado_em >= 0 ? toIso(r[cf.deletado_em]) : '';
      return {
        id: String(r[cf.id]),
        socioeducando_id: String(r[cf.socioeducando_id]),
        tipo_saida: String(r[cf.tipo_saida] || ''),
        data_saida_iso: toIso(r[cf.data_saida]),
        data_saida: fmtDate(r[cf.data_saida]),
        data_retorno_iso: toIso(r[cf.data_retorno]),
        data_retorno: fmtDate(r[cf.data_retorno]),
        observacoes: String(r[cf.observacoes] || ''),
        created_at: fmtDate(r[cf.registrado_em]),
        deletado_em: deletadoEm,
        ativo: !deletadoEm
      };
    })
    .sort(function(a, b) { return b.data_saida_iso.localeCompare(a.data_saida_iso); });
}

// ── Dados para as telas ───────────────────────────────────────

function carregarOverview() {
  var perf = {};
  var t0 = Date.now();
  perf.versao = 'overview-perf-v2';
  perf.preparacao_schema_ms = Date.now() - t0;

  var tLeitura = Date.now();
  var socioeducandos = getSocioeducandos(true);
  var allAdm = getRowsAtivas(SHEETS.ADMISSOES);
  var allFugas = getRowsAtivas(SHEETS.FUGAS);
  var allTrabalhos = getRowsAtivas(SHEETS.TRABALHOS);
  var allVisitasTerritoriais = getRowsAtivas(SHEETS.VISITAS_TERRITORIAIS);
  var allSaidas = getRowsAtivas(SHEETS.SAIDAS);
  var allSaidaMatriculas = getRowsAtivas(SHEETS.SAIDA_MATRICULAS);
  perf.leitura_abas_ms = Date.now() - tLeitura;

  var hoje = new Date();
  var hojeIso = toIso(hoje);
  var trinta = new Date();
  trinta.setDate(hoje.getDate() - 30);

  var tMapeamentos = Date.now();
  var ca = getAdmissoesCols();
  var cf = getFugasCols();
  var ct = getTrabalhosCols();
  var cv = getVisitasTerritoriaisCols();
  var cs = getSaidasCols();
  var csm = getSaidaMatriculasCols();
  var internadosAtivos = allAdm.filter(function(r) { return !toIso(r[3]); }).length;
  var cMat = getCursoMatriculasCols();
  var cc   = getCursosCols();
  var allMatriculas = getRowsAtivas(SHEETS.CURSO_MATRICULAS);
  var rowsCursos    = getRowsAtivas(SHEETS.CURSOS);
  var cursosMap = {};
  rowsCursos.forEach(function(r) { cursosMap[String(r[cc.id])] = r; });

  // Uma matrícula só conta como "ativa" quando o vínculo está Matriculado, sem
  // conclusão registrada e o curso, pelas datas de início/término, está de
  // fato "Em andamento" (não é um curso previsto/futuro nem já encerrado).
  function matriculaAtiva(r) {
    if (r[cMat.matriculado] !== true) return false;
    if (String(r[cMat.tipo_termino] || '')) return false;
    var c = cursosMap[String(r[cMat.curso_id])];
    if (!c) return false;
    var status = calcularStatusCurso(toIso(c[cc.data_inicio]), toIso(c[cc.data_termino]), hojeIso);
    return status === 'Em andamento';
  }

  var cursosAndamentoIds = {};
  allMatriculas.forEach(function(r) {
    if (matriculaAtiva(r)) cursosAndamentoIds[String(r[cMat.curso_id])] = true;
  });
  var cursosAndamento = Object.keys(cursosAndamentoIds).length;

  var admPorSocioeducando = {};
  allAdm.forEach(function(r) {
    var sid = String(r[ca.socioeducando_id]);
    if (!admPorSocioeducando[sid]) admPorSocioeducando[sid] = [];
    admPorSocioeducando[sid].push(r);
  });

  var fugasPorSocioeducando = {};
  allFugas.forEach(function(r) {
    var sid = String(r[cf.socioeducando_id]);
    if (!fugasPorSocioeducando[sid]) fugasPorSocioeducando[sid] = [];
    fugasPorSocioeducando[sid].push(r);
  });

  var matriculasPorSocioeducando = {};
  allMatriculas.forEach(function(r) {
    var sid = String(r[cMat.socioeducando_id]);
    if (!matriculasPorSocioeducando[sid]) matriculasPorSocioeducando[sid] = [];
    matriculasPorSocioeducando[sid].push(r);
  });

  function normalizarTexto(v) {
    return String(v || '')
      .toLowerCase()
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .trim();
  }

  function trabalhoAtivoHoje(row) {
    var inicioIso = toIso(row[ct.data_inicio]);
    var fimIso = toIso(row[ct.data_fim]);
    if (inicioIso && inicioIso > hojeIso) return false;
    if (fimIso && fimIso < hojeIso) return false;
    return true;
  }

  function trabalhoAIniciar(row) {
    var inicioIso = toIso(row[ct.data_inicio]);
    return !!inicioIso && inicioIso > hojeIso;
  }

  var trabalhosPorSocioeducando = {};
  var trabalhosDetalhesPorSocioeducando = {};
  var trabalhosAIniciarDetalhesPorSocioeducando = {};
  var visitasTerritoriaisPorSocioeducando = {};
  allTrabalhos.forEach(function(r) {
    var sid = String(r[ct.socioeducando_id]);
    var empresa = String(r[ct.empresa] || '').trim();
    var detalhe = {
      id: String(r[ct.id]),
      tipo: String(r[ct.tipo] || ''),
      empresa: empresa,
      curso: String(r[ct.curso] || ''),
      data_contrato: fmtDate(r[ct.data_contrato]),
      data_inicio_iso: toIso(r[ct.data_inicio]),
      data_inicio: fmtDate(r[ct.data_inicio]),
      data_fim: fmtDate(r[ct.data_fim]),
      horario_inicio: fmtTime(r[ct.horario_inicio]),
      horario_fim: fmtTime(r[ct.horario_fim]),
      dias_semana: String(r[ct.dias_semana] || '')
    };

    if (trabalhoAtivoHoje(r)) {
      if (!trabalhosPorSocioeducando[sid]) trabalhosPorSocioeducando[sid] = [];
      if (!trabalhosDetalhesPorSocioeducando[sid]) trabalhosDetalhesPorSocioeducando[sid] = [];
      if (empresa) trabalhosPorSocioeducando[sid].push(empresa);
      trabalhosDetalhesPorSocioeducando[sid].push(detalhe);
      return;
    }

    if (trabalhoAIniciar(r)) {
      if (!trabalhosAIniciarDetalhesPorSocioeducando[sid]) trabalhosAIniciarDetalhesPorSocioeducando[sid] = [];
      detalhe.a_iniciar = true;
      trabalhosAIniciarDetalhesPorSocioeducando[sid].push(detalhe);
    }
  });

  allVisitasTerritoriais.forEach(function(r) {
    var sid = String(r[cv.socioeducando_id] || '');
    if (!sid) return;
    visitasTerritoriaisPorSocioeducando[sid] = (visitasTerritoriaisPorSocioeducando[sid] || 0) + 1;
  });

  Object.keys(trabalhosPorSocioeducando).forEach(function(sid) {
    var unicos = {};
    trabalhosPorSocioeducando[sid].forEach(function(emp) { unicos[emp] = true; });
    trabalhosPorSocioeducando[sid] = Object.keys(unicos).sort(function(a, b) {
      return a.localeCompare(b, 'pt-BR');
    });
  });

  Object.keys(trabalhosDetalhesPorSocioeducando).forEach(function(sid) {
    trabalhosDetalhesPorSocioeducando[sid].sort(function(a, b) {
      var ai = String(a.data_inicio || '');
      var bi = String(b.data_inicio || '');
      return bi.localeCompare(ai);
    });
  });

  Object.keys(trabalhosAIniciarDetalhesPorSocioeducando).forEach(function(sid) {
    trabalhosAIniciarDetalhesPorSocioeducando[sid].sort(function(a, b) {
      var ai = String(a.data_inicio_iso || '');
      var bi = String(b.data_inicio_iso || '');
      return ai.localeCompare(bi);
    });
  });

  var saidasMap = {};
  allSaidas.forEach(function(r) {
    saidasMap[String(r[cs.id])] = r;
  });

  var fezSaidaCulturalPorSocioeducando = {};
  allSaidaMatriculas.forEach(function(m) {
    var sid = String(m[csm.socioeducando_id] || '');
    if (!sid) return;

    var s = saidasMap[String(m[csm.saida_id])] || null;
    if (!s) return;

    var tipo = normalizarTexto(s[cs.tipo]);
    if (tipo !== 'cultural') return;

    var status = normalizarTexto(m[csm.status]);
    if (status === 'cancelada') return;

    var houveVolta = !!toIsoDateTime(s[cs.data_hora_volta]);
    var realizada = status === 'realizada' || houveVolta;
    if (realizada) {
      fezSaidaCulturalPorSocioeducando[sid] = true;
    }
  });

  perf.preparacao_indices_ms = Date.now() - tMapeamentos;

  var tResumo = Date.now();
  var fugas30 = allFugas.filter(function(r) {
    var dt = r[3] instanceof Date ? r[3] : new Date(toIso(r[3]));
    return !isNaN(dt) && dt >= trinta;
  }).length;

  var socioeducandosData = socioeducandos.map(function(j) {
    var admSocioeducando   = admPorSocioeducando[j.id] || [];
    var fugasSocioeducando = fugasPorSocioeducando[j.id] || [];
    var matriculasSocioeducando = matriculasPorSocioeducando[j.id] || [];

    var admAtiva     = admSocioeducando.find(function(r) { return !toIso(r[3]); });
    var ausenteAtual = fugasSocioeducando.find(function(r) { return !toIso(r[4]); });
    var cursosAtivos = matriculasSocioeducando.filter(matriculaAtiva).length;
    var cursosAtivosDetalhes = matriculasSocioeducando
      .filter(matriculaAtiva)
      .map(function(m) {
        var c = cursosMap[String(m[cMat.curso_id])] || [];
        return {
          matricula_id: String(m[cMat.id]),
          curso_id: String(m[cMat.curso_id]),
          tipo_curso: String(c[cc.tipo_curso] || ''),
          nome_curso: String(c[cc.nome_curso] || ''),
          instituicao: String(c[cc.instituicao] || ''),
          local: String(c[cc.local] || ''),
          data_inicio: fmtDate(c[cc.data_inicio]),
          data_termino: fmtDate(c[cc.data_termino]),
          horario_inicio: fmtTime(c[cc.horario_inicio]),
          horario_termino: fmtTime(c[cc.horario_termino]),
          dias_semana: String(c[cc.dias_semana] || '')
        };
      })
      .sort(function(a, b) {
        var an = String(a.nome_curso || '');
        var bn = String(b.nome_curso || '');
        return an.localeCompare(bn, 'pt-BR');
      });
    var trabalhosAtivos = trabalhosPorSocioeducando[j.id] || [];
    var trabalhosAtivosDetalhes = trabalhosDetalhesPorSocioeducando[j.id] || [];
    var trabalhosAIniciarDetalhes = trabalhosAIniciarDetalhesPorSocioeducando[j.id] || [];
    var visitasTerritoriaisQtd = Number(visitasTerritoriaisPorSocioeducando[j.id] || 0);
    var fezSaidaCultural = !!fezSaidaCulturalPorSocioeducando[j.id];

    var status = 'desligado';
    if (ausenteAtual) status = 'ausente';
    else if (admAtiva) status = 'internado';

    return {
      id: j.id,
      nome: j.nome,
      email_profissional: j.email_profissional || '',
      data_nascimento_iso: j.data_nascimento_iso,
      escolaridade: j.escolaridade,
      status: status,
      internado_desde: admAtiva ? fmtDate(admAtiva[2]) : '',
      internado_desde_iso: admAtiva ? toIso(admAtiva[2]) : '',
      admissao_ativa_id: admAtiva ? String(admAtiva[0]) : '',
      cursos_ativos: cursosAtivos,
      cursos_ativos_detalhes: cursosAtivosDetalhes,
      trabalhos_empresas_ativas: trabalhosAtivos,
      trabalhos_ativos_detalhes: trabalhosAtivosDetalhes,
      trabalhos_a_iniciar_detalhes: trabalhosAIniciarDetalhes,
      visitas_territoriais_qtd: visitasTerritoriaisQtd,
      nao_possui_visita_territorial: visitasTerritoriaisQtd === 0,
      trabalhando: trabalhosAtivos.length > 0,
      fez_saida_cultural: fezSaidaCultural,
      nao_fez_saida_cultural: !fezSaidaCultural
    };
  });
  perf.resumo_socioeducandos_ms = Date.now() - tResumo;

  perf.atividades_dia_ms = 0;
  perf.total_backend_ms = Date.now() - t0;

  return {
    total_socioeducandos:      socioeducandos.length,
    internados_ativos: internadosAtivos,
    cursos_andamento:  cursosAndamento,
    fugas_30dias:      fugas30,
    socioeducandos:            socioeducandosData,
    atividades_dia:    {
      data_iso: hojeIso,
      atendimentos_hoje: [],
      saidas_hoje: [],
      retornos_hoje: [],
      fugas_hoje: [],
      aniversariantes_hoje: [],
      _deferred: true
    },
    _perf_overview: perf
  };
}

/**
 * Retorna as atividades (atendimentos, saídas, retornos, fugas) de um dia específico.
 * @param {string|null} dataIso  Data no formato 'YYYY-MM-DD'. Se nulo, usa hoje.
 */
function carregarAtividadesDia(dataIso, contexto) {
  var perf = {};
  var t0 = Date.now();
  perf.versao = 'atividades-perf-v2';
  var tz = Session.getScriptTimeZone();
  var dRef = dataIso ? new Date(dataIso + 'T00:00:00') : new Date();
  var diaIso = Utilities.formatDate(dRef, tz, 'yyyy-MM-dd');

  var tBase = Date.now();
  var socioeducandos = (contexto && contexto.socioeducandos) || getSocioeducandos();
  var nomes = {};
  socioeducandos.forEach(function(j) { nomes[j.id] = j.nome; });
  var ca = (contexto && contexto.atendimentosCols) || getAtendimentosCols();
  var cc = (contexto && contexto.cursosCols) || getCursosCols();
  var cm = (contexto && contexto.cursoMatriculasCols) || getCursoMatriculasCols();
  var ct = (contexto && contexto.trabalhosCols) || getTrabalhosCols();
  var atendimentosRows = (contexto && contexto.atendimentosRows) || getRowsAtivas(SHEETS.ATENDIMENTOS);
  var cursosRows = (contexto && contexto.cursosRows) || getRowsAtivas(SHEETS.CURSOS);
  var cursoMatriculasRows = (contexto && contexto.cursoMatriculasRows) || getRowsAtivas(SHEETS.CURSO_MATRICULAS);
  var trabalhosRows = (contexto && contexto.trabalhosRows) || getRowsAtivas(SHEETS.TRABALHOS);
  var saidasRows = (contexto && contexto.saidasRows) || getRowsAtivas(SHEETS.SAIDAS);
  var saidaMatriculasRows = (contexto && contexto.saidaMatriculasRows) || getRowsAtivas(SHEETS.SAIDA_MATRICULAS);
  var fugasRows = (contexto && contexto.fugasRows) || getRowsAtivas(SHEETS.FUGAS);
  perf.base_ms = Date.now() - tBase;

  function parseDiasSemanaNums(valor) {
    return String(valor || '').split(/[;,]/)
      .map(function(v) { return Number(String(v || '').trim()); })
      .filter(function(v) { return !isNaN(v) && v >= 0 && v <= 6; });
  }

  function diaNoIntervalo(dia, inicio, fim) {
    if (!inicio) return false;
    if (dia < inicio) return false;
    if (fim && dia > fim) return false;
    return true;
  }

  var diaSemanaIso = Number(Utilities.formatDate(dRef, tz, 'u')) || 0; // 1..7 (Seg..Dom)
  var diaSemanaJs = diaSemanaIso === 7 ? 0 : diaSemanaIso; // 0..6 (Dom..Sab)

  // Atendimentos do dia
  var tAt = Date.now();
  var atendimentosHoje = atendimentosRows
    .filter(function(r) { return toIsoDateTime(r[4]).substring(0, 10) === diaIso; })
    .map(function(r) {
      return {
        id: String(r[0]),
        socioeducando_id: String(r[1]),
        socioeducando_nome: nomes[String(r[1])] || 'ID ' + r[1],
        tipo: String(r[2] || ''),
        responsavel: String(r[3] || ''),
        hora_inicio: fmtDateTime(r[4]),
        hora_termino: fmtDateTime(r[5]),
        realizado: String(r[ca.realizado] || 'Sim').trim() || 'Sim'
      };
    })
    .sort(function(a, b) { return a.hora_inicio.localeCompare(b.hora_inicio); });
  perf.atendimentos_ms = Date.now() - tAt;

  // Cursos do dia (recorrentes por dia da semana), filtrados por matrícula ativa no período
  var tCursos = Date.now();
  var cursosMap = {};
  cursosRows.forEach(function(r) {
    cursosMap[String(r[cc.id])] = r;
  });

  var cursosHoje = cursoMatriculasRows
    .filter(function(m) {
      if (!boolVal(m[cm.matriculado])) return false;
      var dataTerminoMatriculaIso = toIso(m[cm.data_termino]);
      if (dataTerminoMatriculaIso && dataTerminoMatriculaIso < diaIso) return false;

      var curso = cursosMap[String(m[cm.curso_id])];
      if (!curso) return false;

      var inicioCursoIso = toIso(curso[cc.data_inicio]);
      var fimCursoIso = toIso(curso[cc.data_termino]);
      if (!diaNoIntervalo(diaIso, inicioCursoIso, fimCursoIso)) return false;

      var dias = parseDiasSemanaNums(curso[cc.dias_semana]);
      if (!dias.length || dias.indexOf(diaSemanaJs) < 0) return false;

      return true;
    })
    .map(function(m) {
      var sid = String(m[cm.socioeducando_id]);
      var curso = cursosMap[String(m[cm.curso_id])] || [];
      return {
        curso_id: String(m[cm.curso_id]),
        curso_matricula_id: String(m[cm.id]),
        socioeducando_id: sid,
        socioeducando_nome: nomes[sid] || ('ID ' + sid),
        tipo_curso: String(curso[cc.tipo_curso] || ''),
        nome_curso: String(curso[cc.nome_curso] || ''),
        instituicao: String(curso[cc.instituicao] || ''),
        local: String(curso[cc.local] || ''),
        horario_inicio: fmtTime(curso[cc.horario_inicio]),
        horario_termino: fmtTime(curso[cc.horario_termino])
      };
    })
    .sort(function(a, b) {
      var cn = String(a.nome_curso || '').localeCompare(String(b.nome_curso || ''), 'pt-BR');
      if (cn !== 0) return cn;
      return String(a.socioeducando_nome || '').localeCompare(String(b.socioeducando_nome || ''), 'pt-BR');
    });
  perf.cursos_ms = Date.now() - tCursos;

  // Trabalhos do dia (recorrentes por dia da semana)
  var tTrabalhos = Date.now();
  var trabalhosHoje = trabalhosRows
    .filter(function(t) {
      var inicioIso = toIso(t[ct.data_inicio]);
      var fimIso = toIso(t[ct.data_fim]);
      if (!diaNoIntervalo(diaIso, inicioIso, fimIso)) return false;

      var dias = parseDiasSemanaNums(t[ct.dias_semana]);
      if (!dias.length || dias.indexOf(diaSemanaJs) < 0) return false;

      return true;
    })
    .map(function(t) {
      var sid = String(t[ct.socioeducando_id]);
      return {
        id: String(t[ct.id]),
        socioeducando_id: sid,
        socioeducando_nome: nomes[sid] || ('ID ' + sid),
        tipo: String(t[ct.tipo] || ''),
        empresa: String(t[ct.empresa] || ''),
        curso: String(t[ct.curso] || ''),
        horario_inicio: fmtTime(t[ct.horario_inicio]),
        horario_fim: fmtTime(t[ct.horario_fim])
      };
    })
    .sort(function(a, b) {
      var en = String(a.empresa || '').localeCompare(String(b.empresa || ''), 'pt-BR');
      if (en !== 0) return en;
      return String(a.socioeducando_nome || '').localeCompare(String(b.socioeducando_nome || ''), 'pt-BR');
    });
  perf.trabalhos_ms = Date.now() - tTrabalhos;

  // Saídas do dia (partida neste dia)
  var tSaidas = Date.now();
  var csA = (contexto && contexto.saidasCols) || getSaidasCols();
  var cmA = (contexto && contexto.saidaMatriculasCols) || getSaidaMatriculasCols();
  var saidasMapA = {};
  saidasRows.forEach(function(r) { saidasMapA[String(r[csA.id])] = r; });
  var saidaMatriculasJuntas = saidaMatriculasRows.map(function(r) {
    var s = saidasMapA[String(r[cmA.saida_id])];
    return s ? { m: r, s: s } : null;
  }).filter(function(x) { return !!x; });

  var saidasHoje = saidaMatriculasJuntas
    .filter(function(x) { return toIsoDateTime(x.s[csA.data_hora_ida]).substring(0, 10) === diaIso; })
    .map(function(x) {
      var sid = String(x.m[cmA.socioeducando_id]);
      return {
        id: String(x.m[cmA.id]),
        socioeducando_id: sid,
        socioeducando_nome: nomes[sid] || 'ID ' + sid,
        local: String(x.s[csA.local] || ''),
        hora_ida: fmtDateTime(x.s[csA.data_hora_ida]),
        hora_volta: fmtDateTime(x.s[csA.data_hora_volta]),
        retornou: !!toIsoDateTime(x.s[csA.data_hora_volta]),
        status: String(x.m[cmA.status] || '')
      };
    })
    .sort(function(a, b) { return a.hora_ida.localeCompare(b.hora_ida); });
  perf.saidas_ms = Date.now() - tSaidas;

  // Retornos registrados neste dia (saídas de dias anteriores que voltaram hoje)
  var tRet = Date.now();
  var retornosHoje = saidaMatriculasJuntas
    .filter(function(x) {
      var idaIso   = toIsoDateTime(x.s[csA.data_hora_ida]).substring(0, 10);
      var voltaIso = toIsoDateTime(x.s[csA.data_hora_volta]).substring(0, 10);
      return voltaIso === diaIso && idaIso !== diaIso;
    })
    .map(function(x) {
      var sid = String(x.m[cmA.socioeducando_id]);
      return {
        id: String(x.m[cmA.id]),
        socioeducando_id: sid,
        socioeducando_nome: nomes[sid] || 'ID ' + sid,
        local: String(x.s[csA.local] || ''),
        hora_ida: fmtDateTime(x.s[csA.data_hora_ida]),
        hora_volta: fmtDateTime(x.s[csA.data_hora_volta])
      };
    });
  perf.retornos_ms = Date.now() - tRet;

  // Fugas/evasões do dia
  var tFugas = Date.now();
  var fugasHoje = fugasRows
    .filter(function(r) { return toIso(r[3]) === diaIso; })
    .map(function(r) {
      return {
        id: String(r[0]),
        socioeducando_id: String(r[1]),
        socioeducando_nome: nomes[String(r[1])] || 'ID ' + r[1],
        tipo: String(r[2] || ''),
        data_saida: fmtDate(r[3]),
        retornou: !!toIso(r[4])
      };
    });
  perf.fugas_ms = Date.now() - tFugas;

  // Aniversariantes do dia (mesmo dia/mês da data de referência)
  var tNiver = Date.now();
  var partesDia = String(diaIso || '').split('-');
  var mmdd = partesDia.length >= 3 ? (partesDia[1] + '-' + partesDia[2]) : '';
  var anoRef = Number(partesDia[0] || 0);
  var aniversariantesHoje = socioeducandos
    .filter(function(j) {
      var nascIso = String(j.data_nascimento_iso || '');
      if (!nascIso || nascIso.length < 10) return false;
      return nascIso.substring(5, 10) === mmdd;
    })
    .map(function(j) {
      var nascIso = String(j.data_nascimento_iso || '');
      var anoNasc = Number(nascIso.substring(0, 4) || 0);
      var idade = (anoRef > 0 && anoNasc > 0) ? (anoRef - anoNasc) : null;
      return {
        socioeducando_id: String(j.id),
        socioeducando_nome: String(j.nome || ''),
        data_nascimento: fmtDate(nascIso),
        idade: idade
      };
    })
    .sort(function(a, b) {
      return String(a.socioeducando_nome || '').localeCompare(String(b.socioeducando_nome || ''), 'pt-BR');
    });
  perf.aniversariantes_ms = Date.now() - tNiver;
  perf.total_ms = Date.now() - t0;

  return {
    data_iso:          diaIso,
    atendimentos_hoje: atendimentosHoje,
    cursos_hoje:       cursosHoje,
    trabalhos_hoje:    trabalhosHoje,
    saidas_hoje:       saidasHoje,
    retornos_hoje:     retornosHoje,
    fugas_hoje:        fugasHoje,
    aniversariantes_hoje: aniversariantesHoje,
    _perf_atividades_dia: perf
  };
}

function carregarPerfil(socioeducandoId) {
  var socioeducandos = getSocioeducandos(true);
  var socioeducando = socioeducandos.find(function(j) { return j.id === String(socioeducandoId); });
  if (!socioeducando) return null;

  var admissoes = getAdmissoesBySocioeducando(socioeducandoId, true);
  var cursos    = getCursosBySocioeducando(socioeducandoId, true);
  var fugas     = getFugasBySocioeducando(socioeducandoId, true);
  var saidas    = getSaidasBySocioeducando(socioeducandoId, true);
  var atendimentos = getAtendimentosBySocioeducando(socioeducandoId, true);
  var trabalhos = getTrabalhosBySocioeducando(socioeducandoId, true);
  var visitasTerritoriais = getVisitasTerritoriaisBySocioeducando(socioeducandoId, true);
  var familiares = getFamiliaresBySocioeducando(socioeducandoId, true);
  var interesses = getInteressesCursoPorSocioeducando(socioeducandoId);
  var cursoEventos = getCursoEventosBySocioeducando(socioeducandoId);

  var internadoAtivo = admissoes.find(function(a) { return !a.data_desligamento_iso; }) || null;
  var ausenteAtual   = fugas.find(function(f) { return !f.data_retorno_iso; }) || null;

  var status = 'desligado';
  if (ausenteAtual)   status = 'ausente';
  else if (internadoAtivo) status = 'internado';

  return {
    socioeducando:           socioeducando,
    status:          status,
    internado_ativo: internadoAtivo,
    ausente_atual:   ausenteAtual,
    admissoes:       admissoes,
    cursos:          cursos,
    curso_eventos:   cursoEventos,
    fugas:           fugas,
    saidas:          saidas,
    atendimentos:    atendimentos,
    trabalhos:       trabalhos,
    visitas_territoriais: visitasTerritoriais,
    familiares:      familiares,
    interesses:      interesses
  };
}

/**
 * Retorna apenas os dados essenciais do topo do perfil para permitir
 * renderização inicial rápida; seções pesadas são carregadas separadamente.
 */
function carregarPerfilResumo(socioeducandoId) {
  var socioeducandos = getSocioeducandos(true);
  var socioeducando = socioeducandos.find(function(j) { return j.id === String(socioeducandoId); });
  if (!socioeducando) return null;

  var admissoes = getAdmissoesBySocioeducando(socioeducandoId, true);
  var fugas = getFugasBySocioeducando(socioeducandoId, true);

  var internadoAtivo = admissoes.find(function(a) { return !a.data_desligamento_iso; }) || null;
  var ausenteAtual = fugas.find(function(f) { return !f.data_retorno_iso; }) || null;

  var status = 'desligado';
  if (ausenteAtual) status = 'ausente';
  else if (internadoAtivo) status = 'internado';

  return {
    socioeducando: socioeducando,
    status: status,
    internado_ativo: internadoAtivo,
    ausente_atual: ausenteAtual
  };
}

function getCursoEventosBySocioeducando(socioeducandoId) {
  var cm = getCursoMatriculasCols();
  var ce = getCursoEventosCols();
  var matriculasIds = {};
  getRowsAtivas(SHEETS.CURSO_MATRICULAS).forEach(function(r) {
    if (String(r[cm.socioeducando_id]) === String(socioeducandoId)) {
      matriculasIds[String(r[cm.id])] = true;
    }
  });

  return getRowsAtivas(SHEETS.CURSO_EVENTOS)
    .filter(function(r) { return !!matriculasIds[String(r[ce.curso_matricula_id])]; })
    .map(function(r) {
      return {
        curso_matricula_id: String(r[ce.curso_matricula_id]),
        data_iso: toIso(r[ce.data]),
        ausente: boolVal(r[ce.ausente]),
        observacoes: String(r[ce.observacoes] || '')
      };
    });
}

function carregarEventosCursoAgenda(socioeducandoId) {
  if (!socioeducandoId) throw new Error('Socioeducando não identificado.');
  return getCursoEventosBySocioeducando(socioeducandoId);
}

function carregarMatricula(matriculaId) {
  var cm = getCursoMatriculasCols();
  var cc = getCursosCols();

  var matriculas = getRowsAtivas(SHEETS.CURSO_MATRICULAS);
  var m = matriculas.find(function(r) { return String(r[cm.id]) === String(matriculaId); });
  if (!m) return null;

  var cursos = getRowsAtivas(SHEETS.CURSOS);
  var c = cursos.find(function(r) { return String(r[cc.id]) === String(m[cm.curso_id]); }) || [];

  return {
    matricula_id:          String(m[cm.id]),
    curso_id:              String(m[cm.curso_id]),
    socioeducando_id:      String(m[cm.socioeducando_id]),
    tipo_curso:            String(c[cc.tipo_curso]            || ''),
    nome_curso:            String(c[cc.nome_curso]            || ''),
    data_inicio_iso:       toIso(c[cc.data_inicio]),
    horario_inicio:        fmtTime(c[cc.horario_inicio]),
    data_termino_iso:      toIso(c[cc.data_termino]),
    horario_termino:       fmtTime(c[cc.horario_termino]),
    dias_semana:           String(c[cc.dias_semana]            || ''),
    instituicao:           String(c[cc.instituicao]            || ''),
    vagas:                 c[cc.vagas] !== undefined && c[cc.vagas] !== '' ? Number(c[cc.vagas]) || '' : '',
    data_limite_inscricao: toIso(c[cc.data_limite_inscricao]),
    local:                 String(c[cc.local]                  || ''),
    data_termino_matricula_iso: toIso(m[cm.data_termino]),
    finalizado:            !!toIso(m[cm.data_termino]),
    certificado:           boolVal(m[cm.certificado]),
    observacoes:           String(c[cc.observacoes]            || ''),
    matriculado:           boolVal(m[cm.matriculado]),
    tipo_termino:          String(m[cm.tipo_termino]           || '')
  };
}

function carregarCursoEventoDia(cursoMatriculaId, dataIso) {
  if (!cursoMatriculaId) throw new Error('Matrícula do curso não identificada.');
  if (!dataIso || !/^\d{4}-\d{2}-\d{2}$/.test(String(dataIso))) throw new Error('Data inválida.');

  var ce = getCursoEventosCols();
  var rows = getRowsAtivas(SHEETS.CURSO_EVENTOS);
  var r = rows.find(function(x) {
    return String(x[ce.curso_matricula_id]) === String(cursoMatriculaId)
      && toIso(x[ce.data]) === String(dataIso);
  });

  return {
    id: r ? String(r[ce.id]) : '',
    curso_matricula_id: String(cursoMatriculaId),
    data_iso: String(dataIso),
    ausente: r ? boolVal(r[ce.ausente]) : false,
    observacoes: r ? String(r[ce.observacoes] || '') : ''
  };
}

function salvarCursoEventoDia(dados) {
  if (!dados || !dados.curso_matricula_id) throw new Error('Matrícula do curso não identificada.');
  if (!dados.data_iso || !/^\d{4}-\d{2}-\d{2}$/.test(String(dados.data_iso))) throw new Error('Data inválida.');

  var cm = getCursoMatriculasCols();
  var matriculaExiste = getRowsAtivas(SHEETS.CURSO_MATRICULAS).some(function(r) {
    return String(r[cm.id]) === String(dados.curso_matricula_id);
  });
  if (!matriculaExiste) throw new Error('Matrícula do curso não encontrada.');

  var ce = getCursoEventosCols();
  var sh = getSheet(SHEETS.CURSO_EVENTOS);
  var rows = getRows(SHEETS.CURSO_EVENTOS);
  var user = usuarioAtual();
  var agora = new Date();

  var idx = rows.findIndex(function(r) {
    var deletado = ce.deletado_em >= 0 ? toIso(r[ce.deletado_em]) : '';
    if (deletado) return false;
    return String(r[ce.curso_matricula_id]) === String(dados.curso_matricula_id)
      && toIso(r[ce.data]) === String(dados.data_iso);
  });

  var totalCols = sh.getLastColumn();
  var linha = new Array(totalCols).fill('');
  linha[ce.curso_matricula_id] = Number(dados.curso_matricula_id);
  linha[ce.data] = String(dados.data_iso);
  linha[ce.ausente] = !!dados.ausente;
  linha[ce.observacoes] = String(dados.observacoes || '').trim();

  if (idx >= 0) {
    linha[ce.id] = Number(rows[idx][ce.id]);
    linha[ce.registrado_em] = rows[idx][ce.registrado_em] || agora;
    linha[ce.criadoPor] = rows[idx][ce.criadoPor] || user;
    if (ce.atualizadoEm >= 0) linha[ce.atualizadoEm] = agora;
    if (ce.atualizadoPor >= 0) linha[ce.atualizadoPor] = user;
    sh.getRange(idx + 2, 1, 1, totalCols).setValues([linha]);
    return { ok: true, id: linha[ce.id], atualizado: true };
  }

  linha[ce.id] = nextId(SHEETS.CURSO_EVENTOS);
  linha[ce.registrado_em] = agora;
  linha[ce.criadoPor] = user;
  if (ce.atualizadoEm >= 0) linha[ce.atualizadoEm] = '';
  if (ce.atualizadoPor >= 0) linha[ce.atualizadoPor] = '';
  sh.getRange(sh.getLastRow() + 1, 1, 1, totalCols).setValues([linha]);
  return { ok: true, id: linha[ce.id], atualizado: false };
}

function excluirCursoEventoDia(id) {
  if (!id) throw new Error('Registro não identificado.');
  var ce = getCursoEventosCols();
  var sh = getSheet(SHEETS.CURSO_EVENTOS);
  var rows = getRows(SHEETS.CURSO_EVENTOS);
  var idx = rows.findIndex(function(r) { return String(r[ce.id]) === String(id); });
  if (idx < 0) throw new Error('Registro não encontrado.');
  sh.deleteRow(idx + 2);
  return { ok: true };
}

function carregarAdmissao(admId) {
  var rows = getRowsAtivas(SHEETS.ADMISSOES);
  var r = rows.find(function(r) { return String(r[0]) === String(admId); });
  if (!r) return null;
  return {
    id: String(r[0]), socioeducando_id: String(r[1]),
    data_admissao_iso: toIso(r[2]),
    data_desligamento_iso: toIso(r[3])
  };
}

function carregarFuga(fugaId) {
  var rows = getRowsAtivas(SHEETS.FUGAS);
  var r = rows.find(function(r) { return String(r[0]) === String(fugaId); });
  if (!r) return null;
  return {
    id: String(r[0]), socioeducando_id: String(r[1]),
    tipo_saida: String(r[2] || ''),
    data_saida_iso: toIso(r[3]),
    data_retorno_iso: toIso(r[4]),
    observacoes: String(r[5] || '')
  };
}

function carregarAtendimento(atendimentoId) {
  ensureAtendimentosObservacoesColumn();
  ensureAtendimentosColunasNaoRealizado();

  var rows = getRowsAtivas(SHEETS.ATENDIMENTOS);
  var headers = getHeadersLower(SHEETS.ATENDIMENTOS);
  function col(nome, fallback) {
    var i = headers.indexOf(nome.toLowerCase());
    return i >= 0 ? i : fallback;
  }
  var iRealizado = col('realizado', 10);
  var iMotivo    = col('motivo não realizado', 11);
  var iReposicao = col('id atendimento reposição', 12);

  var r = rows.find(function(r) { return String(r[0]) === String(atendimentoId); });
  if (!r) return null;

  var realizado = String(r[iRealizado] || '').trim();
  if (realizado === '') realizado = 'Sim';

  return {
    id: String(r[0]),
    socioeducando_id: String(r[1]),
    tipo_atendimento: String(r[2] || ''),
    responsavel: String(r[3] || ''),
    data_hora_inicio_iso: toIsoDateTime(r[4]),
    data_hora_termino_iso: toIsoDateTime(r[5]),
    observacoes: String(r[6] || ''),
    realizado: realizado,
    motivo_nao_realizado: String(r[iMotivo] || ''),
    id_atendimento_reposicao: String(r[iReposicao] || '')
  };
}

function carregarTrabalho(trabalhoId) {
  var ct = getTrabalhosCols();
  var rows = getRowsAtivas(SHEETS.TRABALHOS);
  var r = rows.find(function(x) { return String(x[ct.id]) === String(trabalhoId); });
  if (!r) return null;

  return {
    id: String(r[ct.id]),
    socioeducando_id: String(r[ct.socioeducando_id]),
    tipo: String(r[ct.tipo] || ''),
    empresa: String(r[ct.empresa] || ''),
    curso: String(r[ct.curso] || ''),
    data_contrato_iso: toIso(r[ct.data_contrato]),
    data_inicio_iso: toIso(r[ct.data_inicio]),
    data_fim_iso: toIso(r[ct.data_fim]),
    horario_inicio: fmtTime(r[ct.horario_inicio]),
    horario_fim: fmtTime(r[ct.horario_fim]),
    dias_semana: String(r[ct.dias_semana] || '')
  };
}

function carregarVisitaTerritorial(visitaId) {
  var cv = getVisitasTerritoriaisCols();
  var rows = getRowsAtivas(SHEETS.VISITAS_TERRITORIAIS);
  var r = rows.find(function(x) { return String(x[cv.id]) === String(visitaId); });
  if (!r) return null;

  return {
    id: String(r[cv.id]),
    socioeducando_id: String(r[cv.socioeducando_id]),
    data_iso: toIso(r[cv.data]),
    tec_responsavel: String(r[cv.tec_responsavel] || ''),
    atendido_por: String(r[cv.atendido_por] || ''),
    creas: boolVal(r[cv.creas]),
    caps: boolVal(r[cv.caps]),
    ameaca: boolVal(r[cv.ameaca]),
    observacoes: String(r[cv.observacoes] || '')
  };
}

function carregarFamiliar(familiarId) {
  if (!familiarId) throw new Error('Familiar não identificado.');
  var cf = getFamiliaresCols();
  var rows = getRowsAtivas(SHEETS.FAMILIARES);
  var r = rows.find(function(x) { return String(x[cf.id]) === String(familiarId); });
  if (!r) return null;

  return {
    id: String(r[cf.id]),
    socioeducando_id: String(r[cf.socioeducando_id]),
    nome: String(r[cf.nome] || ''),
    telefone: String(r[cf.telefone] || ''),
    tipo_vinculo: String(r[cf.tipo_vinculo] || ''),
    endereco: String(r[cf.endereco] || ''),
    principal: boolVal(r[cf.principal])
  };
}

function salvarTrabalho(dados) {
  if (!dados || !dados.socioeducando_id) throw new Error('Socioeducando não identificado.');
  validarSocioeducandoExiste(dados.socioeducando_id);

  var tipo = String(dados.tipo || '').trim();
  if (!tipo) throw new Error('Tipo é obrigatório.');
  if (tipo !== 'Trabalho' && tipo !== 'Aprendizagem') throw new Error('Tipo de trabalho inválido.');

  var empresa = String(dados.empresa || '').trim();
  if (!empresa) throw new Error('Empresa é obrigatória.');
  if (!dados.data_contrato) throw new Error('Data de contrato é obrigatória.');
  if (!dados.data_inicio) throw new Error('Data de início é obrigatória.');

  validarHorarioTrabalho(dados);
  if (dados.data_fim && trabalhoPeriodoInvalido(dados)) {
    throw new Error('A data de fim não pode ser anterior à data de início.');
  }

  var ct = getTrabalhosCols();
  var sh = getSheet(SHEETS.TRABALHOS);
  var rows = getRows(SHEETS.TRABALHOS);
  var totalCols = sh.getLastColumn();
  var user = usuarioAtual();

  var linha = new Array(totalCols).fill('');
  linha[ct.socioeducando_id] = Number(dados.socioeducando_id);
  linha[ct.tipo] = tipo;
  linha[ct.empresa] = empresa.toUpperCase();
  linha[ct.curso] = String(dados.curso || '').trim().toUpperCase();
  linha[ct.data_contrato] = dados.data_contrato;
  linha[ct.data_inicio] = dados.data_inicio;
  linha[ct.data_fim] = dados.data_fim || '';
  linha[ct.horario_inicio] = String(dados.horario_inicio || '').trim();
  linha[ct.horario_fim] = String(dados.horario_fim || '').trim();
  linha[ct.dias_semana] = String(dados.dias_semana || '').trim();

  if (dados.id) {
    var idx = rows.findIndex(function(r) { return String(r[ct.id]) === String(dados.id); });
    if (idx < 0) throw new Error('Relação de trabalho não encontrada para edição.');
    linha[ct.id] = Number(dados.id);
    linha[ct.registrado_em] = rows[idx][ct.registrado_em] || new Date();
    linha[ct.criadoPor] = rows[idx][ct.criadoPor] || user;
    linha[ct.atualizadoEm] = new Date();
    linha[ct.atualizadoPor] = user;
    sh.getRange(idx + 2, 1, 1, totalCols).setValues([linha]);
    return { ok: true, trabalho_id: linha[ct.id] };
  }

  linha[ct.id] = nextId(SHEETS.TRABALHOS);
  linha[ct.registrado_em] = new Date();
  linha[ct.criadoPor] = user;
  linha[ct.atualizadoEm] = '';
  linha[ct.atualizadoPor] = '';
  sh.getRange(sh.getLastRow() + 1, 1, 1, totalCols).setValues([linha]);
  return { ok: true, trabalho_id: linha[ct.id] };
}

function salvarVisitaTerritorial(dados) {
  if (!dados || !dados.socioeducando_id) throw new Error('Socioeducando não identificado.');
  validarSocioeducandoExiste(dados.socioeducando_id);
  if (!dados.data) throw new Error('Data é obrigatória.');

  var tecResponsavel = String(dados.tec_responsavel || '').trim();
  if (!tecResponsavel) throw new Error('Tec responsável é obrigatório.');

  var cv = getVisitasTerritoriaisCols();
  var sh = getSheet(SHEETS.VISITAS_TERRITORIAIS);
  var rows = getRows(SHEETS.VISITAS_TERRITORIAIS);
  var totalCols = sh.getLastColumn();
  var user = usuarioAtual();

  var linha = new Array(totalCols).fill('');
  linha[cv.socioeducando_id] = Number(dados.socioeducando_id);
  linha[cv.data] = dados.data;
  linha[cv.tec_responsavel] = tecResponsavel.toUpperCase();
  linha[cv.atendido_por] = String(dados.atendido_por || '').trim().toUpperCase();
  linha[cv.creas] = !!dados.creas;
  linha[cv.caps] = !!dados.caps;
  linha[cv.ameaca] = !!dados.ameaca;
  linha[cv.observacoes] = String(dados.observacoes || '').trim();

  if (dados.id) {
    var idx = rows.findIndex(function(r) { return String(r[cv.id]) === String(dados.id); });
    if (idx < 0) throw new Error('Visita territorial não encontrada para edição.');
    linha[cv.id] = Number(dados.id);
    linha[cv.registrado_em] = rows[idx][cv.registrado_em] || new Date();
    linha[cv.criadoPor] = rows[idx][cv.criadoPor] || user;
    linha[cv.atualizadoEm] = new Date();
    linha[cv.atualizadoPor] = user;
    sh.getRange(idx + 2, 1, 1, totalCols).setValues([linha]);
    return { ok: true, visita_territorial_id: linha[cv.id] };
  }

  linha[cv.id] = nextId(SHEETS.VISITAS_TERRITORIAIS);
  linha[cv.registrado_em] = new Date();
  linha[cv.criadoPor] = user;
  linha[cv.atualizadoEm] = '';
  linha[cv.atualizadoPor] = '';
  sh.getRange(sh.getLastRow() + 1, 1, 1, totalCols).setValues([linha]);
  return { ok: true, visita_territorial_id: linha[cv.id] };
}

function salvarFamiliar(dados) {
  if (!dados || !dados.socioeducando_id) throw new Error('Socioeducando não identificado.');
  validarSocioeducandoExiste(dados.socioeducando_id);

  var nome = String(dados.nome || '').trim();
  if (!nome) throw new Error('Nome do familiar é obrigatório.');

  var cf = getFamiliaresCols();
  var sh = getSheet(SHEETS.FAMILIARES);
  var rows = getRows(SHEETS.FAMILIARES);
  var totalCols = sh.getLastColumn();
  var user = usuarioAtual();
  var principal = !!dados.principal;
  var socioeducandoId = String(dados.socioeducando_id);

  var idx = -1;
  if (dados.id) {
    idx = rows.findIndex(function(r) { return String(r[cf.id]) === String(dados.id); });
    if (idx < 0) throw new Error('Familiar não encontrado para edição.');
  }

  var linha = new Array(totalCols).fill('');
  linha[cf.socioeducando_id] = Number(dados.socioeducando_id);
  linha[cf.nome] = nome.toUpperCase();
  linha[cf.telefone] = String(dados.telefone || '').trim();
  linha[cf.tipo_vinculo] = String(dados.tipo_vinculo || '').trim();
  linha[cf.endereco] = String(dados.endereco || '').trim().toUpperCase();
  linha[cf.principal] = principal;

  if (dados.id) {
    linha[cf.id] = Number(dados.id);
    linha[cf.registrado_em] = rows[idx][cf.registrado_em] || new Date();
    linha[cf.criadoPor] = rows[idx][cf.criadoPor] || user;
    linha[cf.atualizadoEm] = new Date();
    linha[cf.atualizadoPor] = user;
    if (cf.deletado_em >= 0) linha[cf.deletado_em] = rows[idx][cf.deletado_em] || '';
    if (cf.deletado_por >= 0) linha[cf.deletado_por] = rows[idx][cf.deletado_por] || '';
    sh.getRange(idx + 2, 1, 1, totalCols).setValues([linha]);
  } else {
    linha[cf.id] = nextId(SHEETS.FAMILIARES);
    linha[cf.registrado_em] = new Date();
    linha[cf.criadoPor] = user;
    linha[cf.atualizadoEm] = '';
    linha[cf.atualizadoPor] = '';
    if (cf.deletado_em >= 0) linha[cf.deletado_em] = '';
    if (cf.deletado_por >= 0) linha[cf.deletado_por] = '';
    sh.getRange(sh.getLastRow() + 1, 1, 1, totalCols).setValues([linha]);
  }

  // Regra de unicidade: apenas um familiar pode permanecer como principal.
  if (principal) {
    var idAtual = dados.id ? String(dados.id) : String(linha[cf.id]);
    rows = getRows(SHEETS.FAMILIARES);
    rows.forEach(function(r, i) {
      if (String(r[cf.id]) === idAtual) return;
      if (String(r[cf.socioeducando_id]) !== socioeducandoId) return;
      if (cf.deletado_em >= 0 && toIso(r[cf.deletado_em])) return;
      if (!boolVal(r[cf.principal])) return;
      sh.getRange(i + 2, cf.principal + 1).setValue(false);
      if (cf.atualizadoEm >= 0) sh.getRange(i + 2, cf.atualizadoEm + 1).setValue(new Date());
      if (cf.atualizadoPor >= 0) sh.getRange(i + 2, cf.atualizadoPor + 1).setValue(user);
    });
  }

  return { ok: true, familiar_id: String(linha[cf.id]) };
}

function excluirFamiliar(familiarId) {
  if (!familiarId) throw new Error('Familiar não identificado.');
  var cf = getFamiliaresCols();
  var sh = getSheet(SHEETS.FAMILIARES);
  var rows = getRows(SHEETS.FAMILIARES);
  var idx = rows.findIndex(function(r) { return String(r[cf.id]) === String(familiarId); });
  if (idx < 0) throw new Error('Familiar não encontrado.');
  if (cf.deletado_em >= 0 && toIso(rows[idx][cf.deletado_em])) {
    throw new Error('Familiar já está excluído.');
  }

  var agora = new Date();
  var user = usuarioAtual();
  if (cf.deletado_em >= 0) sh.getRange(idx + 2, cf.deletado_em + 1).setValue(agora);
  if (cf.deletado_por >= 0) sh.getRange(idx + 2, cf.deletado_por + 1).setValue(user);
  if (cf.atualizadoEm >= 0) sh.getRange(idx + 2, cf.atualizadoEm + 1).setValue(agora);
  if (cf.atualizadoPor >= 0) sh.getRange(idx + 2, cf.atualizadoPor + 1).setValue(user);
  return { ok: true };
}

// ── Salvar dados ──────────────────────────────────────────────

function verificarSocioeducandoExistente(id) {
  var socioeducando = getSocioeducandos().find(function(j) { return j.id === String(id); });
  if (!socioeducando) return { existe: false };

  var ativo = getAdmissoesBySocioeducando(id).some(function(a) { return !a.data_desligamento_iso; });
  return { existe: true, ativo: ativo, socioeducando: socioeducando };
}

function salvarSocioeducando(dados) {
  ensureSocioeducandosNascimentoColumn();
  ensureSocioeducandosCredenciaisColumns();
  var sh = getSheet(SHEETS.SOCIOEDUCANDOS);
  var rows = getRows(SHEETS.SOCIOEDUCANDOS);
  var cols = getSocioeducandosCols();
  var totalCols = sh.getLastColumn();

  if (!dados.id || isNaN(Number(dados.id)) || Number(dados.id) <= 0)
    throw new Error('ID inválido. Informe o número do ID no Portal SUASE.');
  if (!dados.nome || dados.nome.trim() === '')
    throw new Error('Nome é obrigatório.');
  if (!dados.editando && !dados.data_admissao)
    throw new Error('Data de admissão é obrigatória.');
  if (dados.data_admissao) {
    var hojeAdm = new Date();
    hojeAdm.setHours(0, 0, 0, 0);
    if (new Date(dados.data_admissao) > hojeAdm) throw new Error('Data de admissão não pode ser futura.');
  }
  if (dados.data_nascimento) {
    var dn = new Date(dados.data_nascimento);
    if (isNaN(dn.getTime())) throw new Error('Data de nascimento inválida.');
    var hoje = new Date();
    hoje.setHours(0, 0, 0, 0);
    if (dn > hoje) throw new Error('Data de nascimento não pode ser futura.');
  }

  var idx = rows.findIndex(function(r) { return String(r[cols.id]) === String(dados.id); });

  var user = usuarioAtual();
  var podeGerenciarCredenciais = usuarioPodeGerenciarCredenciais(user);
  var emailProfissional = String(dados.email_profissional || '').trim();
  var senhaProfissional = String(dados.senha_profissional || '');
  if (!podeGerenciarCredenciais && (emailProfissional || senhaProfissional)) {
    throw new Error('Sem permissão para alterar credenciais profissionais.');
  }

  if (dados.editando) {
    if (idx < 0) throw new Error('Socioeducando não encontrado para edição.');
    var linhaEdicao = rows[idx].slice();
    while (linhaEdicao.length < totalCols) linhaEdicao.push('');
    linhaEdicao[cols.id] = Number(dados.id);
    linhaEdicao[cols.nome] = dados.nome.trim().toUpperCase();
    if (podeGerenciarCredenciais && cols.email_profissional >= 0) {
      linhaEdicao[cols.email_profissional] = emailProfissional;
    }
    if (podeGerenciarCredenciais && cols.senha_profissional_cripto >= 0 && senhaProfissional.trim() !== '') {
      linhaEdicao[cols.senha_profissional_cripto] = criptografarSenhaProfissional(senhaProfissional, user);
    }
    if (cols.nascimento >= 0) linhaEdicao[cols.nascimento] = dados.data_nascimento || '';
    linhaEdicao[cols.escolaridade] = dados.escolaridade || '';
    linhaEdicao[cols.registrado_em] = rows[idx][cols.registrado_em] || new Date();
    linhaEdicao[cols.criadoPor] = rows[idx][cols.criadoPor] || user;
    linhaEdicao[cols.atualizadoEm] = new Date();
    linhaEdicao[cols.atualizadoPor] = user;
    sh.getRange(idx + 2, 1, 1, totalCols).setValues([linhaEdicao]);
  } else {
    if (idx >= 0) throw new Error('Já existe um socioeducando com o ID ' + dados.id + ' (' + rows[idx][cols.nome] + ').');

    var linhaNova = new Array(totalCols).fill('');
    linhaNova[cols.id] = Number(dados.id);
    linhaNova[cols.nome] = dados.nome.trim().toUpperCase();
    if (podeGerenciarCredenciais && cols.email_profissional >= 0) {
      linhaNova[cols.email_profissional] = emailProfissional;
    }
    if (podeGerenciarCredenciais && cols.senha_profissional_cripto >= 0 && senhaProfissional.trim() !== '') {
      linhaNova[cols.senha_profissional_cripto] = criptografarSenhaProfissional(senhaProfissional, user);
    }
    if (cols.nascimento >= 0) linhaNova[cols.nascimento] = dados.data_nascimento || '';
    linhaNova[cols.escolaridade] = dados.escolaridade || '';
    linhaNova[cols.registrado_em] = new Date();
    linhaNova[cols.criadoPor] = user;
    linhaNova[cols.atualizadoEm] = '';
    linhaNova[cols.atualizadoPor] = '';
    sh.getRange(sh.getLastRow() + 1, 1, 1, totalCols).setValues([linhaNova]);

    // Criar admissão automaticamente se data fornecida
    if (dados.data_admissao) {
      var ca = getAdmissoesCols();
      var shAdm = getSheet(SHEETS.ADMISSOES);
      var linhaAdm = new Array(shAdm.getLastColumn()).fill('');
      linhaAdm[ca.id] = nextId(SHEETS.ADMISSOES);
      linhaAdm[ca.socioeducando_id] = Number(dados.id);
      linhaAdm[ca.data_admissao] = dados.data_admissao;
      linhaAdm[ca.data_desligamento] = '';
      linhaAdm[ca.registrado_em] = new Date();
      linhaAdm[ca.criadoPor] = user;
      linhaAdm[ca.atualizadoEm] = '';
      linhaAdm[ca.atualizadoPor] = '';
      shAdm.getRange(shAdm.getLastRow() + 1, 1, 1, linhaAdm.length).setValues([linhaAdm]);
    }
  }
  return { ok: true };
}

function obterCredenciaisSocioeducando(socioeducandoId) {
  var user = usuarioAtual();
  if (!usuarioPodeGerenciarCredenciais(user)) {
    throw new Error('Sem permissão para visualizar credenciais profissionais.');
  }
  if (!socioeducandoId) throw new Error('Socioeducando não identificado.');

  var cols = getSocioeducandosCols();
  var rows = getRowsAtivas(SHEETS.SOCIOEDUCANDOS);
  var row = rows.find(function(r) { return String(r[cols.id]) === String(socioeducandoId); });
  if (!row) throw new Error('Socioeducando não encontrado.');

  var email = cols.email_profissional >= 0 ? String(row[cols.email_profissional] || '') : '';
  var senhaCripto = cols.senha_profissional_cripto >= 0 ? String(row[cols.senha_profissional_cripto] || '') : '';
  var senha = descriptografarSenhaProfissional(senhaCripto, user);

  return {
    socioeducando_id: String(socioeducandoId),
    email_profissional: email,
    senha_profissional: senha
  };
}

/**
 * Monta a linha de valores de um Curso alinhada dinamicamente às colunas
 * reais da planilha (via índices de getCursosCols()), em vez de assumir uma
 * ordem fixa de colunas — evita gravar valores na coluna errada quando a
 * ordem das colunas muda (ex.: inserção da coluna "Local").
 */
function construirLinhaCurso(cc, totalCols, dados) {
  var linha = new Array(totalCols).fill('');
  linha[cc.tipo_curso] = dados.tipo_curso || '';
  linha[cc.nome_curso] = dados.nome_curso ? dados.nome_curso.trim() : '';
  linha[cc.data_inicio] = dados.data_inicio || '';
  linha[cc.horario_inicio] = dados.horario_inicio || '';
  linha[cc.data_termino] = dados.data_termino || '';
  linha[cc.horario_termino] = dados.horario_termino || '';
  linha[cc.dias_semana] = dados.dias_semana || '';
  linha[cc.instituicao] = dados.instituicao ? dados.instituicao.trim() : '';
  linha[cc.vagas] = (dados.vagas !== undefined && dados.vagas !== null && dados.vagas !== '') ? Number(dados.vagas) : '';
  linha[cc.data_limite_inscricao] = dados.data_limite_inscricao || '';
  if (cc.local >= 0) linha[cc.local] = dados.local || '';
  if (cc.observacoes >= 0) linha[cc.observacoes] = dados.observacoes ? String(dados.observacoes).trim() : '';
  return linha;
}

/**
 * Monta a linha de uma matrícula (CursoMatriculas) usando os índices reais da
 * planilha (via getCursoMatriculasCols()) em vez de uma ordem fixa de colunas
 * — mesmo motivo de construirLinhaCurso: evita gravar valores na coluna errada
 * quando a ordem/existência de colunas muda (ex.: remoção do antigo campo
 * "Matrícula", cujo dado passou a viver em Cursos.Local).
 */
function construirLinhaMatricula(cm, totalCols, dados) {
  var linha = new Array(totalCols).fill('');
  linha[cm.curso_id] = dados.curso_id;
  linha[cm.socioeducando_id] = dados.socioeducando_id;
  linha[cm.matriculado] = dados.matriculado ? true : false;
  linha[cm.tipo_termino] = dados.tipo_termino || '';
  linha[cm.data_termino] = dados.data_termino || '';
  linha[cm.certificado] = dados.certificado ? true : false;
  linha[cm.observacoes] = dados.observacoes || '';
  return linha;
}

/**
 * Cria ou atualiza a linha de um Curso na planilha (sem lidar com matrículas).
 * Retorna o ID do curso gravado. Compartilhado por salvarCursoComMatricula,
 * salvarCursoLote e atualizarCurso.
 */
function gravarLinhaCurso(shCursos, rowsCursos, cc, dados, user) {
  var totalCursoCols = shCursos.getLastColumn();
  var cursoLinha = construirLinhaCurso(cc, totalCursoCols, dados);
  var cursoId;

  if (dados.curso_id) {
    var idxC = rowsCursos.findIndex(function(r) { return String(r[cc.id]) === String(dados.curso_id); });
    if (idxC < 0) throw new Error('Curso não encontrado para edição.');
    cursoId = Number(dados.curso_id);
    cursoLinha[cc.id] = cursoId;
    if (cc.registrado_em >= 0) cursoLinha[cc.registrado_em] = rowsCursos[idxC][cc.registrado_em] || new Date();
    if (cc.criadoPor >= 0)     cursoLinha[cc.criadoPor]     = rowsCursos[idxC][cc.criadoPor]     || user;
    if (cc.atualizadoEm >= 0)  cursoLinha[cc.atualizadoEm]  = new Date();
    if (cc.atualizadoPor >= 0) cursoLinha[cc.atualizadoPor] = user;
    shCursos.getRange(idxC + 2, 1, 1, totalCursoCols).setValues([cursoLinha]);
  } else {
    cursoId = nextId(SHEETS.CURSOS);
    cursoLinha[cc.id] = cursoId;
    if (cc.registrado_em >= 0) cursoLinha[cc.registrado_em] = new Date();
    if (cc.criadoPor >= 0)     cursoLinha[cc.criadoPor]     = user;
    if (cc.atualizadoEm >= 0)  cursoLinha[cc.atualizadoEm]  = '';
    if (cc.atualizadoPor >= 0) cursoLinha[cc.atualizadoPor] = '';
    shCursos.appendRow(cursoLinha);
  }

  return cursoId;
}

/**
 * Edita apenas os dados do Curso (sem tocar em matrículas/socioeducandos) —
 * usado pelo botão "Editar" na página de Cursos.
 */
function atualizarCurso(dados) {
  if (!dados.curso_id) throw new Error('Curso não identificado.');
  if (!dados.tipo_curso) throw new Error('Tipo de curso é obrigatório.');
  if (!dados.nome_curso || dados.nome_curso.trim() === '') throw new Error('Nome do curso é obrigatório.');
  if (!dados.data_inicio) throw new Error('Data de início é obrigatória.');
  if (!dados.data_termino) throw new Error('Data de término é obrigatória.');
  validarHorarioCurso(dados);
  if (cursoPeriodoInvalido(dados)) throw new Error('A data de término não pode ser anterior à data de início.');

  var cc = getCursosCols();
  var shCursos   = getSheet(SHEETS.CURSOS);
  var rowsCursos = getRows(SHEETS.CURSOS);
  var user = usuarioAtual();

  var cursoId = gravarLinhaCurso(shCursos, rowsCursos, cc, dados, user);
  return { ok: true, curso_id: cursoId };
}

/**
 * Edita apenas os dados da Matrícula (status do vínculo e observações do
 * vínculo em si) — usado no modal "Editar vínculo" da página de Cursos.
 * Não altera nenhum dado do Curso.
 */
function atualizarVinculoCurso(dados) {
  if (!dados || !dados.matricula_id) throw new Error('Matrícula não identificada.');

  ensureCursoMatriculasMatriculadoTipoTermino();
  var cm = getCursoMatriculasCols();
  var sh = getSheet(SHEETS.CURSO_MATRICULAS);
  var rows = getRows(SHEETS.CURSO_MATRICULAS);
  var idx = rows.findIndex(function(r) { return String(r[cm.id]) === String(dados.matricula_id); });
  if (idx < 0) throw new Error('Matrícula não encontrada.');
  var user = usuarioAtual();

  sh.getRange(idx + 2, cm.matriculado + 1).setValue(dados.matriculado ? true : false);
  sh.getRange(idx + 2, cm.observacoes + 1).setValue(dados.observacoes ? String(dados.observacoes).trim() : '');
  if (dados.tipo_termino) {
    sh.getRange(idx + 2, cm.tipo_termino + 1).setValue(dados.tipo_termino);
    sh.getRange(idx + 2, cm.data_termino + 1).setValue(dados.data_termino || '');
    sh.getRange(idx + 2, cm.certificado + 1).setValue(dados.certificado ? true : false);
  } else {
    sh.getRange(idx + 2, cm.tipo_termino + 1).setValue('');
    sh.getRange(idx + 2, cm.data_termino + 1).setValue('');
    sh.getRange(idx + 2, cm.certificado + 1).setValue(false);
  }
  if (cm.atualizadoEm >= 0)  sh.getRange(idx + 2, cm.atualizadoEm + 1).setValue(new Date());
  if (cm.atualizadoPor >= 0) sh.getRange(idx + 2, cm.atualizadoPor + 1).setValue(user);

  return { ok: true };
}

/**
 * Edita em lote as matrículas de um curso — usado no modal "Editar
 * matrículas" da tabela "Próximos cursos a encerrar inscrições". Permite,
 * numa única chamada: atualizar status/observações de vínculos existentes,
 * remover (logicamente) vínculos e adicionar novos socioeducandos ao curso.
 *
 * @param {string|number} cursoId
 * @param {Array<{matricula_id:string, matriculado:boolean, observacoes:string, remover:boolean}>} edicoes
 * @param {Array<{socioeducando_id:string, matriculado:boolean, observacoes:string}>} novos
 */
function atualizarMatriculasCursoLote(cursoId, edicoes, novos) {
  if (!cursoId) throw new Error('Curso não identificado.');
  ensureCursoMatriculasMatriculadoTipoTermino();

  var cm = getCursoMatriculasCols();
  var sh = getSheet(SHEETS.CURSO_MATRICULAS);
  var rows = getRows(SHEETS.CURSO_MATRICULAS);
  var user = usuarioAtual();
  var agora = new Date();

  (edicoes || []).forEach(function(e) {
    if (!e || !e.matricula_id) return;
    var idx = rows.findIndex(function(r) { return String(r[cm.id]) === String(e.matricula_id); });
    if (idx < 0) throw new Error('Matrícula ' + e.matricula_id + ' não encontrada.');

    if (e.remover) {
      if (cm.deletado_em >= 0)  sh.getRange(idx + 2, cm.deletado_em + 1).setValue(agora);
      if (cm.deletado_por >= 0) sh.getRange(idx + 2, cm.deletado_por + 1).setValue(user);
      return;
    }

    sh.getRange(idx + 2, cm.matriculado + 1).setValue(e.matriculado ? true : false);
    sh.getRange(idx + 2, cm.observacoes + 1).setValue(e.observacoes ? String(e.observacoes).trim() : '');
    if (e.tipo_termino) {
      sh.getRange(idx + 2, cm.tipo_termino + 1).setValue(e.tipo_termino);
      sh.getRange(idx + 2, cm.data_termino + 1).setValue(e.data_termino || '');
      sh.getRange(idx + 2, cm.certificado  + 1).setValue(e.certificado ? true : false);
    }
    if (cm.atualizadoEm >= 0)  sh.getRange(idx + 2, cm.atualizadoEm + 1).setValue(agora);
    if (cm.atualizadoPor >= 0) sh.getRange(idx + 2, cm.atualizadoPor + 1).setValue(user);
  });

  var rowsAtivas = getRowsAtivas(SHEETS.CURSO_MATRICULAS);
  var jaVinculados = {};
  rowsAtivas.forEach(function(r) {
    if (String(r[cm.curso_id]) === String(cursoId)) jaVinculados[String(r[cm.socioeducando_id])] = true;
  });

  var totalMatCols = sh.getLastColumn();
  var novosValidos = (novos || []).filter(function(n) { return n && n.socioeducando_id; });
  novosValidos.forEach(function(n) {
    validarSocioeducandoExiste(n.socioeducando_id);
    if (jaVinculados[String(n.socioeducando_id)]) {
      throw new Error('Socioeducando ID ' + n.socioeducando_id + ' já está vinculado a este curso.');
    }
    jaVinculados[String(n.socioeducando_id)] = true;
  });

  if (novosValidos.length) {
    var baseId = nextId(SHEETS.CURSO_MATRICULAS);
    var linhasNovas = novosValidos.map(function(n, i) {
      var linha = construirLinhaMatricula(cm, totalMatCols, {
        curso_id: cursoId,
        socioeducando_id: Number(n.socioeducando_id),
        data_termino: n.tipo_termino ? (n.data_termino || '') : '',
        tipo_termino: n.tipo_termino || '',
        certificado: n.tipo_termino ? !!n.certificado : false,
        matriculado: !!n.matriculado,
        observacoes: n.observacoes || ''
      });
      linha[cm.id] = baseId + i;
      if (cm.registrado_em >= 0) linha[cm.registrado_em] = agora;
      if (cm.criadoPor >= 0)     linha[cm.criadoPor]      = user;
      return linha;
    });
    sh.getRange(sh.getLastRow() + 1, 1, linhasNovas.length, totalMatCols).setValues(linhasNovas);
  }

  return { ok: true };
}

function salvarCursoComMatricula(dados) {
  var cc = getCursosCols();
  var cm = getCursoMatriculasCols();

  if (!dados.socioeducando_id) throw new Error('Socioeducando não identificado.');
  validarSocioeducandoExiste(dados.socioeducando_id);
  if (!dados.tipo_curso)       throw new Error('Tipo de curso é obrigatório.');
  if (!dados.nome_curso || dados.nome_curso.trim() === '') throw new Error('Nome do curso é obrigatório.');
  if (!dados.data_inicio)      throw new Error('Data de início é obrigatória.');
  if (!dados.data_termino)     throw new Error('Data de término é obrigatória.');
  validarHorarioCurso(dados);
  if (cursoPeriodoInvalido(dados)) throw new Error('A data de término não pode ser anterior à data de início.');

  var shCursos     = getSheet(SHEETS.CURSOS);
  var shMatriculas = getSheet(SHEETS.CURSO_MATRICULAS);
  var rowsCursos   = getRows(SHEETS.CURSOS);
  var rowsMat      = getRows(SHEETS.CURSO_MATRICULAS);
  var user = usuarioAtual();

  // ── Salvar/atualizar o registro de Curso ──────────────────
  var cursoId = gravarLinhaCurso(shCursos, rowsCursos, cc, dados, user);

  // ── Salvar/atualizar a Matrícula ──────────────────────────
  ensureCursoMatriculasMatriculadoTipoTermino();
  var totalMatCols = shMatriculas.getLastColumn();
  var matLinha = construirLinhaMatricula(cm, totalMatCols, {
    curso_id: cursoId,
    socioeducando_id: Number(dados.socioeducando_id),
    data_termino: '',
    tipo_termino: '',
    certificado: false,
    matriculado: !!dados.matriculado
  });

  if (dados.matricula_id) {
    var idxM = rowsMat.findIndex(function(r) { return String(r[cm.id]) === String(dados.matricula_id); });
    if (idxM < 0) throw new Error('Matrícula não encontrada para edição.');
    matLinha[cm.id] = Number(dados.matricula_id);
    // "Observações" do formulário pertence ao Curso (já gravado acima em gravarLinhaCurso);
    // preserva o valor de observações já existente na Matrícula, sem sobrescrever.
    matLinha[cm.observacoes] = rowsMat[idxM][cm.observacoes] || '';
    // Este formulário não lida com término de vínculo — preserva os valores já gravados.
    matLinha[cm.data_termino] = rowsMat[idxM][cm.data_termino] || '';
    matLinha[cm.tipo_termino] = rowsMat[idxM][cm.tipo_termino] || '';
    matLinha[cm.certificado] = rowsMat[idxM][cm.certificado] || false;
    if (cm.registrado_em >= 0) matLinha[cm.registrado_em] = rowsMat[idxM][cm.registrado_em] || new Date();
    if (cm.criadoPor >= 0)     matLinha[cm.criadoPor]     = rowsMat[idxM][cm.criadoPor]     || user;
    if (cm.atualizadoEm >= 0)  matLinha[cm.atualizadoEm]  = new Date();
    if (cm.atualizadoPor >= 0) matLinha[cm.atualizadoPor] = user;
    shMatriculas.getRange(idxM + 2, 1, 1, totalMatCols).setValues([matLinha]);
  } else {
    matLinha[cm.id] = nextId(SHEETS.CURSO_MATRICULAS);
    if (cm.registrado_em >= 0) matLinha[cm.registrado_em] = new Date();
    if (cm.criadoPor >= 0)     matLinha[cm.criadoPor]     = user;
    if (cm.atualizadoEm >= 0)  matLinha[cm.atualizadoEm]  = '';
    if (cm.atualizadoPor >= 0) matLinha[cm.atualizadoPor] = '';
    shMatriculas.appendRow(matLinha);
  }

  return { ok: true, curso_id: cursoId };
}

function salvarAdmissao(dados) {
  ensureColunasPadraoAuditoria(SHEETS.ADMISSOES);
  ensureOrdemColunas(SHEETS.ADMISSOES, ['ID', 'ID Socioeducando', 'Data Admissão', 'Data Desligamento', 'Registrado em', 'Criado por', 'Atualizado em', 'Atualizado por', 'Deletado em', 'Deletado por']);
  var ca = getAdmissoesCols();
  var sh = getSheet(SHEETS.ADMISSOES);
  var rows = getRows(SHEETS.ADMISSOES);

  if (!dados.socioeducando_id) throw new Error('Socioeducando não identificado.');
  validarSocioeducandoExiste(dados.socioeducando_id);
  if (!dados.data_admissao) throw new Error('Data de admissão é obrigatória.');
  var hojeSalvarAdm = new Date();
  hojeSalvarAdm.setHours(0, 0, 0, 0);
  if (new Date(dados.data_admissao) > hojeSalvarAdm) throw new Error('Data de admissão não pode ser futura.');
  if (dados.data_desligamento && dados.data_desligamento < dados.data_admissao)
    throw new Error('Data de desligamento não pode ser anterior à admissão.');

  // Nenhuma admissão (nova ou editada) pode ter seu período (admissão→desligamento,
  // ou admissão→"em aberto") sobreposto ao período de outra admissão já registrada
  // para o mesmo socioeducando — evita, por exemplo, editar o desligamento de uma
  // admissão antiga para uma data posterior ao início de uma admissão mais recente.
  // Intervalo aberto: uma admissão pode começar no mesmo dia em que outra terminou
  // (ex.: desligar em 16/12 e admitir novamente em 16/12 não é conflito).
  var novoInicio = dados.data_admissao;
  var novoFim = dados.data_desligamento || '9999-12-31';
  var conflito = rows.find(function(r) {
    if (dados.id && String(r[0]) === String(dados.id)) return false;
    if (String(r[ca.socioeducando_id]) !== String(dados.socioeducando_id)) return false;
    var existInicio = toIso(r[ca.data_admissao]);
    var existFim = toIso(r[ca.data_desligamento]) || '9999-12-31';
    return novoInicio < existFim && existInicio < novoFim;
  });
  if (conflito) {
    throw new Error('Este período conflita com outra admissão já registrada (' + fmtDate(conflito[ca.data_admissao]) + ' a ' + (toIso(conflito[ca.data_desligamento]) ? fmtDate(conflito[ca.data_desligamento]) : 'em aberto') + ').');
  }

  var user = usuarioAtual();

  if (dados.id) {
    // Edição de uma admissão já existente (ex.: corrigir data digitada errada).
    var idx = rows.findIndex(function(r) { return String(r[0]) === String(dados.id); });
    if (idx < 0) throw new Error('Admissão não encontrada para edição.');

    var linha = rows[idx].slice();
    while (linha.length < sh.getLastColumn()) linha.push('');
    linha[ca.id] = Number(dados.id);
    linha[ca.socioeducando_id] = Number(dados.socioeducando_id);
    linha[ca.data_admissao] = dados.data_admissao;
    linha[ca.data_desligamento] = dados.data_desligamento || '';
    linha[ca.registrado_em] = rows[idx][ca.registrado_em] || new Date();
    linha[ca.criadoPor] = rows[idx][ca.criadoPor] || user;
    linha[ca.atualizadoEm] = new Date();
    linha[ca.atualizadoPor] = user;
    sh.getRange(idx + 2, 1, 1, linha.length).setValues([linha]);
    return { ok: true };
  }

  sh.appendRow([
    nextId(SHEETS.ADMISSOES), Number(dados.socioeducando_id),
    dados.data_admissao, dados.data_desligamento || '',
    new Date(), user, '', '', '', ''
  ]);
  return { ok: true };
}

function registrarDesligamento(admissaoId, dataDesligamento, socioeducandoId) {
  if (!dataDesligamento) throw new Error('Informe a data de desligamento.');

  ensureColunasPadraoAuditoria(SHEETS.ADMISSOES);
  ensureOrdemColunas(SHEETS.ADMISSOES, ['ID', 'ID Socioeducando', 'Data Admissão', 'Data Desligamento', 'Registrado em', 'Criado por', 'Atualizado em', 'Atualizado por', 'Deletado em', 'Deletado por']);
  var ca = getAdmissoesCols();
  var sh = getSheet(SHEETS.ADMISSOES);
  var rows = getRows(SHEETS.ADMISSOES);
  var idx = rows.findIndex(function(r) { return String(r[0]) === String(admissaoId); });
  if (idx < 0) throw new Error('Admissão não encontrada.');
  if (dataDesligamento < toIso(rows[idx][ca.data_admissao]))
    throw new Error('Data de desligamento não pode ser anterior à admissão (' + fmtDate(rows[idx][ca.data_admissao]) + ').');

  sh.getRange(idx + 2, ca.data_desligamento + 1).setValue(dataDesligamento);
  sh.getRange(idx + 2, ca.atualizadoEm + 1).setValue(new Date());
  sh.getRange(idx + 2, ca.atualizadoPor + 1).setValue(usuarioAtual());
  return { ok: true };
}

function salvarFuga(dados) {
  ensureColunasPadraoAuditoria(SHEETS.FUGAS);
  ensureOrdemColunas(SHEETS.FUGAS, ['ID', 'ID Socioeducando', 'Tipo', 'Data Saída', 'Data Retorno', 'Observações', 'Registrado em', 'Criado por', 'Atualizado em', 'Atualizado por', 'Deletado em', 'Deletado por']);
  var cf = getFugasCols();
  var sh = getSheet(SHEETS.FUGAS);

  if (!dados.socioeducando_id) throw new Error('Socioeducando não identificado.');
  validarSocioeducandoExiste(dados.socioeducando_id);
  if (!dados.tipo_saida) throw new Error('Tipo de saída é obrigatório.');
  if (!dados.data_saida) throw new Error('Data de saída é obrigatória.');
  if (dados.data_retorno && dados.data_retorno < dados.data_saida)
    throw new Error('Data de retorno não pode ser anterior à data de saída.');

  var linha = [
    null, Number(dados.socioeducando_id), dados.tipo_saida,
    dados.data_saida, dados.data_retorno || '',
    dados.observacoes || '', null, null, null, null, null, null
  ];

  var user = usuarioAtual();
  if (dados.id) {
    var rows = getRows(SHEETS.FUGAS);
    var idx = rows.findIndex(function(r) { return String(r[0]) === String(dados.id); });
    if (idx < 0) throw new Error('Registro não encontrado para edição.');
    linha[0] = Number(dados.id);
    linha[cf.registrado_em] = rows[idx][cf.registrado_em] || new Date();
    linha[cf.criadoPor] = rows[idx][cf.criadoPor] || user;
    linha[cf.atualizadoEm] = new Date();
    linha[cf.atualizadoPor] = user;
    sh.getRange(idx + 2, 1, 1, linha.length).setValues([linha]);
  } else {
    linha[0] = nextId(SHEETS.FUGAS);
    linha[cf.registrado_em] = new Date();
    linha[cf.criadoPor] = user;
    linha[cf.atualizadoEm] = '';
    linha[cf.atualizadoPor] = '';
    sh.appendRow(linha);
  }
  return { ok: true };
}

function registrarRetorno(fugaId, dataRetorno) {
  if (!dataRetorno) throw new Error('Informe a data de retorno.');

  var cf = getFugasCols();
  var sh = getSheet(SHEETS.FUGAS);
  var rows = getRows(SHEETS.FUGAS);
  var idx = rows.findIndex(function(r) { return String(r[0]) === String(fugaId); });
  if (idx < 0) throw new Error('Registro não encontrado.');
  if (dataRetorno < toIso(rows[idx][cf.data_saida]))
    throw new Error('Data de retorno não pode ser anterior à data de saída (' + fmtDate(rows[idx][cf.data_saida]) + ').');

  sh.getRange(idx + 2, cf.data_retorno + 1).setValue(dataRetorno);
  sh.getRange(idx + 2, cf.atualizadoEm + 1).setValue(new Date());
  sh.getRange(idx + 2, cf.atualizadoPor + 1).setValue(usuarioAtual());
  return { ok: true };
}

function salvarAtendimentos(dados) {
  if (!dados || typeof dados !== 'object') throw new Error('Dados inválidos para atendimento.');
  if (!dados.tipo_atendimento) throw new Error('Tipo de atendimento é obrigatório.');
  if (!dados.responsavel || String(dados.responsavel).trim() === '') throw new Error('Responsável é obrigatório.');
  if (!dados.linhas || !dados.linhas.length) throw new Error('Adicione ao menos uma linha de atendimento.');

  var ca = getAtendimentosCols();

  var sh = getSheet(SHEETS.ATENDIMENTOS);
  var user = usuarioAtual();
  var agora = new Date();
  var baseId = nextId(SHEETS.ATENDIMENTOS);
  var insercoes = [];

  dados.linhas.forEach(function(l, i) {
    if (!l || !l.socioeducando_id) throw new Error('Selecione o socioeducando na linha ' + (i + 1) + '.');
    if (!existeSocioeducando(l.socioeducando_id)) throw new Error('Socioeducando não encontrado na linha ' + (i + 1) + '.');
    if (!l.data_hora_inicio) throw new Error('Informe a data/hora de início na linha ' + (i + 1) + '.');
    if (!l.data_hora_termino) throw new Error('Informe a data/hora de término na linha ' + (i + 1) + '.');
    if (String(l.data_hora_termino) < String(l.data_hora_inicio)) {
      throw new Error('A data/hora de término não pode ser anterior ao início na linha ' + (i + 1) + '.');
    }

    insercoes.push([
      baseId + i,
      Number(l.socioeducando_id),
      dados.tipo_atendimento,
      String(dados.responsavel).trim(),
      l.data_hora_inicio,
      l.data_hora_termino,
      'Sim',
      '',
      '',
      String(l.observacoes || '').trim(),
      agora,
      user,
      '',
      '',
      '',
      ''
    ]);
  });

  sh.getRange(sh.getLastRow() + 1, 1, insercoes.length, ca.deletado_por + 1).setValues(insercoes);
  return { inseridos: insercoes.length };
}

/**
 * Edita os dados de um atendimento já registrado (tipo, responsável, datas e
 * observações). Não altera os campos de status de realização/reposição — use
 * marcarAtendimentoNaoRealizado() para isso.
 */
function salvarEdicaoAtendimento(dados) {
  if (!dados || !dados.id) throw new Error('Atendimento não identificado.');
  if (!dados.tipo_atendimento) throw new Error('Tipo de atendimento é obrigatório.');
  if (!dados.responsavel || String(dados.responsavel).trim() === '') throw new Error('Responsável é obrigatório.');
  if (!dados.data_hora_inicio) throw new Error('Data/hora de início é obrigatória.');
  if (!dados.data_hora_termino) throw new Error('Data/hora de término é obrigatória.');
  if (String(dados.data_hora_termino) < String(dados.data_hora_inicio)) {
    throw new Error('A data/hora de término não pode ser anterior ao início.');
  }

  var ca = getAtendimentosCols();
  var sh = getSheet(SHEETS.ATENDIMENTOS);
  var rows = getRows(SHEETS.ATENDIMENTOS);

  var idx = rows.findIndex(function(r) { return String(r[0]) === String(dados.id); });
  if (idx < 0) throw new Error('Atendimento não encontrado.');

  sh.getRange(idx + 2, ca.tipo_atendimento + 1).setValue(dados.tipo_atendimento);
  sh.getRange(idx + 2, ca.responsavel + 1).setValue(String(dados.responsavel).trim());
  sh.getRange(idx + 2, ca.data_hora_inicio + 1).setValue(dados.data_hora_inicio);
  sh.getRange(idx + 2, ca.data_hora_termino + 1).setValue(dados.data_hora_termino);
  sh.getRange(idx + 2, ca.observacoes + 1).setValue(String(dados.observacoes || '').trim());
  sh.getRange(idx + 2, ca.atualizadoEm + 1).setValue(new Date());
  sh.getRange(idx + 2, ca.atualizadoPor + 1).setValue(usuarioAtual());

  return { ok: true };
}

function marcarAtendimentoNaoRealizado(dados) {
  if (!dados || !dados.atendimento_id) throw new Error('ID do atendimento não informado.');
  if (!dados.motivo || String(dados.motivo).trim() === '') throw new Error('O motivo é obrigatório.');
  if (!dados.novo_inicio) throw new Error('Data/hora de início do novo atendimento é obrigatória.');
  if (!dados.novo_termino) throw new Error('Data/hora de término do novo atendimento é obrigatória.');
  if (String(dados.novo_termino) < String(dados.novo_inicio)) {
    throw new Error('A data/hora de término não pode ser anterior ao início.');
  }

  var ca = getAtendimentosCols();
  var sh = getSheet(SHEETS.ATENDIMENTOS);
  var rows = getRows(SHEETS.ATENDIMENTOS);

  var idx = rows.findIndex(function(r) { return String(r[0]) === String(dados.atendimento_id); });
  if (idx < 0) throw new Error('Atendimento não encontrado.');

  var linha = rows[idx];
  var realizado = String(linha[ca.realizado] || 'Sim').trim();
  if (realizado === 'Não') throw new Error('Este atendimento já está marcado como não realizado.');

  // Cria o atendimento de reposição com os mesmos tipo, responsável e socioeducando
  var user = usuarioAtual();
  var agora = new Date();
  var novoId = nextId(SHEETS.ATENDIMENTOS);
  var novaLinha = [
    novoId,
    linha[1],                                  // ID Socioeducando
    String(linha[2] || ''),                    // Tipo de Atendimento
    String(linha[3] || ''),                    // Responsável
    dados.novo_inicio,
    dados.novo_termino,
    'Sim',
    '',
    '',
    String(dados.observacoes_reposicao || '').trim(),
    agora,
    user,
    '',
    '',
    '',
    ''
  ];
  sh.getRange(sh.getLastRow() + 1, 1, 1, ca.deletado_por + 1).setValues([novaLinha]);

  // Atualiza o atendimento antigo marcando como Não Realizado
  var nCols = sh.getLastColumn();
  var linhaAtual = sh.getRange(idx + 2, 1, 1, nCols).getValues()[0];
  linhaAtual[ca.realizado]  = 'Não';
  linhaAtual[ca.motivo_nao_realizado] = String(dados.motivo).trim();
  linhaAtual[ca.id_atendimento_reposicao]  = novoId;
  linhaAtual[ca.atualizadoEm] = new Date();
  linhaAtual[ca.atualizadoPor] = user;
  sh.getRange(idx + 2, 1, 1, nCols).setValues([linhaAtual]);

  return { ok: true, novo_atendimento_id: novoId };
}

function _toDateSafe(v) {
  if (!v) return null;
  var d = v instanceof Date ? v : new Date(v);
  return isNaN(d.getTime()) ? null : d;
}

function _intervalosConflitam(aInicio, aFim, bInicio, bFim) {
  // Intervalo aberto: terminar uma atividade às 10:00 e começar outra às 10:00 não é conflito.
  return aInicio < bFim && bInicio < aFim;
}

function _statusSaidaEhCancelada(statusSaida) {
  var st = removerAcentos(String(statusSaida || '')).trim().toLowerCase();
  return st === 'cancelada';
}

function _normalizarDiaSemanaCurso(valor) {
  var dia = String(valor || '').trim().toLowerCase();
  if (!dia) return '';
  var mapa = {
    '0': 'domingo',
    '1': 'segunda',
    '2': 'terca',
    '3': 'quarta',
    '4': 'quinta',
    '5': 'sexta',
    '6': 'sabado',
    domingo: 'domingo', dom: 'domingo',
    segunda: 'segunda', 'segunda-feira': 'segunda', seg: 'segunda',
    terca: 'terca', 'terça': 'terca', 'terça-feira': 'terca', 'terca-feira': 'terca', ter: 'terca',
    quarta: 'quarta', 'quarta-feira': 'quarta', qua: 'quarta',
    quinta: 'quinta', 'quinta-feira': 'quinta', qui: 'quinta',
    sexta: 'sexta', 'sexta-feira': 'sexta', sex: 'sexta',
    sabado: 'sabado', 'sábado': 'sabado', sab: 'sabado'
  };
  return mapa[dia] || dia;
}

function _diaSemanaCursoDate(date) {
  var dias = ['domingo', 'segunda', 'terca', 'quarta', 'quinta', 'sexta', 'sabado'];
  return dias[date.getDay()] || '';
}

function _parseIsoDateLocal(isoDate) {
  var s = String(isoDate || '').trim();
  if (!/^\d{4}-\d{2}-\d{2}$/.test(s)) return null;
  var p = s.split('-');
  var d = new Date(Number(p[0]), Number(p[1]) - 1, Number(p[2]), 0, 0, 0, 0);
  return isNaN(d.getTime()) ? null : d;
}

function _formatIsoDateLocal(date) {
  return date.getFullYear()
    + '-' + String(date.getMonth() + 1).padStart(2, '0')
    + '-' + String(date.getDate()).padStart(2, '0');
}

function _chaveCursoEventoDia(cursoId, socioeducandoId, dataIso) {
  return String(cursoId) + '|' + String(socioeducandoId) + '|' + String(dataIso || '');
}

function _inicioDia(date) {
  return new Date(date.getFullYear(), date.getMonth(), date.getDate(), 0, 0, 0, 0);
}

function _fimDia(date) {
  return new Date(date.getFullYear(), date.getMonth(), date.getDate(), 23, 59, 59, 999);
}

function _minDate(a, b) {
  return a.getTime() <= b.getTime() ? a : b;
}

function _maxDate(a, b) {
  return a.getTime() >= b.getTime() ? a : b;
}

function _cursoFaixaOcorrenciaNoDia(curso, diaDate) {
  var dataIso = _formatIsoDateLocal(diaDate);
  if (curso.diasSet && curso.diasSet.length) {
    var diaSemana = _diaSemanaCursoDate(diaDate);
    if (curso.diasSet.indexOf(diaSemana) < 0) return null;
  }

  if (!curso.horario_inicio || !curso.horario_termino) {
    return {
      inicio: _inicioDia(diaDate),
      termino: _fimDia(diaDate),
      inicioIso: dataIso,
      terminoIso: dataIso
    };
  }

  var inicioIso = cursoDataHoraLocal(dataIso, curso.horario_inicio);
  var terminoIso = cursoDataHoraLocal(dataIso, curso.horario_termino);
  var inicio = _toDateSafe(inicioIso);
  var termino = _toDateSafe(terminoIso);
  if (!inicio || !termino) return null;

  return {
    inicio: inicio,
    termino: termino,
    inicioIso: inicioIso,
    terminoIso: terminoIso
  };
}

function _encontrarConflitoCurso(curso, inicio, termino, deveIgnorarOcorrencia) {
  if (!curso.data_inicio || !curso.data_termino) return null;

  var inicioCurso = _parseIsoDateLocal(curso.data_inicio);
  var terminoCurso = _parseIsoDateLocal(curso.data_termino);
  if (!inicioCurso || !terminoCurso) return null;

  var faixaInicio = _maxDate(_inicioDia(inicioCurso), _inicioDia(inicio));
  var faixaFim = _minDate(_fimDia(terminoCurso), _fimDia(termino));
  if (faixaInicio.getTime() > faixaFim.getTime()) return null;

  for (var cursor = _inicioDia(faixaInicio); cursor.getTime() <= faixaFim.getTime(); cursor = new Date(cursor.getFullYear(), cursor.getMonth(), cursor.getDate() + 1)) {
    var ocorrencia = _cursoFaixaOcorrenciaNoDia(curso, cursor);
    if (!ocorrencia) continue;
    if (_intervalosConflitam(inicio, termino, ocorrencia.inicio, ocorrencia.termino)) {
      if (typeof deveIgnorarOcorrencia === 'function' && deveIgnorarOcorrencia(ocorrencia)) {
        continue;
      }
      return ocorrencia;
    }
  }

  return null;
}

function _sobreposicaoDatasRecorrentes(c1, c2) {
  var ini1 = _parseIsoDateLocal(c1.data_inicio);
  var ini2 = _parseIsoDateLocal(c2.data_inicio);
  if (!ini1 || !ini2) return null;

  var fim1 = c1.data_termino ? _parseIsoDateLocal(c1.data_termino) : null;
  var fim2 = c2.data_termino ? _parseIsoDateLocal(c2.data_termino) : null;

  var ini = _maxDate(_inicioDia(ini1), _inicioDia(ini2));
  var fim = null;
  if (fim1 && fim2) fim = _minDate(_fimDia(fim1), _fimDia(fim2));
  else if (fim1) fim = _fimDia(fim1);
  else if (fim2) fim = _fimDia(fim2);

  if (fim && ini.getTime() > fim.getTime()) return null;
  return { inicio: ini, fim: fim };
}

function _horaParaMinutos(hhmm) {
  var s = String(hhmm || '').trim();
  if (!s) return null;
  var p = s.split(':');
  if (p.length < 2) return null;
  var h = Number(p[0]);
  var m = Number(p[1]);
  if (!isFinite(h) || !isFinite(m) || h < 0 || h > 23 || m < 0 || m > 59) return null;
  return h * 60 + m;
}

function _minutosParaHora(mins) {
  var m = Number(mins || 0);
  if (!isFinite(m)) m = 0;
  if (m < 0) m = 0;
  if (m > 23 * 60 + 59) m = 23 * 60 + 59;
  var hh = String(Math.floor(m / 60)).padStart(2, '0');
  var mm = String(m % 60).padStart(2, '0');
  return hh + ':' + mm;
}

function _faixaHorarioRecorrencia(rec) {
  var ini = _horaParaMinutos(rec.horario_inicio);
  var fim = _horaParaMinutos(rec.horario_termino);
  if (ini === null || fim === null) {
    return { inicio: 0, termino: 24 * 60 - 1 };
  }
  return { inicio: ini, termino: fim };
}

function _diasSemanaRecorrencia(rec) {
  var mapa = { domingo: 0, segunda: 1, terca: 2, quarta: 3, quinta: 4, sexta: 5, sabado: 6 };
  var src = Array.isArray(rec.diasSet) ? rec.diasSet : [];
  if (!src.length) return [0, 1, 2, 3, 4, 5, 6];

  var out = {};
  src.forEach(function(v) {
    var n = mapa[_normalizarDiaSemanaCurso(v)];
    if (n >= 0) out[n] = true;
  });
  return Object.keys(out).map(function(k) { return Number(k); });
}

function _intersecaoDiasSemana(a, b) {
  var setA = {};
  a.forEach(function(v) { setA[v] = true; });
  return b.filter(function(v) { return !!setA[v]; });
}

function _nomeDiaSemanaNumero(n) {
  var nomes = ['domingo', 'segunda-feira', 'terca-feira', 'quarta-feira', 'quinta-feira', 'sexta-feira', 'sabado'];
  var i = Number(n);
  return (i >= 0 && i <= 6) ? nomes[i] : '';
}

function _ultimaDataDiaSemanaNoIntervalo(inicio, fim, diaSemana) {
  if (!fim) return null;
  var base = _inicioDia(fim);
  var alvo = Number(diaSemana);
  if (alvo < 0 || alvo > 6) return null;
  var delta = (base.getDay() - alvo + 7) % 7;
  var cand = new Date(base.getFullYear(), base.getMonth(), base.getDate() - delta, 0, 0, 0, 0);
  return cand.getTime() >= _inicioDia(inicio).getTime() ? cand : null;
}

function _detalheConflitoRecorrente(c1, c2, deveIgnorarDataIso) {
  var faixa = _sobreposicaoDatasRecorrentes(c1, c2);
  if (!faixa) return null;

  var h1 = _faixaHorarioRecorrencia(c1);
  var h2 = _faixaHorarioRecorrencia(c2);
  var iniMin = Math.max(h1.inicio, h2.inicio);
  var fimMin = Math.min(h1.termino, h2.termino);
  if (iniMin >= fimMin) return null;

  var dias1 = _diasSemanaRecorrencia(c1);
  var dias2 = _diasSemanaRecorrencia(c2);
  var diasComuns = _intersecaoDiasSemana(dias1, dias2);
  if (!diasComuns.length) return null;

  var ignorarPorData = typeof deveIgnorarDataIso === 'function';
  var primeiraDataEfetiva = null;
  var ultimaDataEfetiva = null;
  var diasEfetivos = [];

  diasComuns.forEach(function(diaSemana) {
    var primeira = _primeiraDataDiaSemanaNoIntervalo(faixa.inicio, faixa.fim, diaSemana);
    if (!primeira) return;

    if (ignorarPorData) {
      while (primeira && (!faixa.fim || primeira.getTime() <= faixa.fim.getTime()) && deveIgnorarDataIso(_formatIsoDateLocal(primeira))) {
        primeira = new Date(primeira.getFullYear(), primeira.getMonth(), primeira.getDate() + 7, 0, 0, 0, 0);
      }
      if (primeira && faixa.fim && primeira.getTime() > faixa.fim.getTime()) primeira = null;
    }
    if (!primeira) return;

    var ultima = faixa.fim ? _ultimaDataDiaSemanaNoIntervalo(faixa.inicio, faixa.fim, diaSemana) : primeira;
    if (ignorarPorData && ultima) {
      while (ultima && ultima.getTime() >= _inicioDia(faixa.inicio).getTime() && deveIgnorarDataIso(_formatIsoDateLocal(ultima))) {
        ultima = new Date(ultima.getFullYear(), ultima.getMonth(), ultima.getDate() - 7, 0, 0, 0, 0);
      }
      if (ultima && ultima.getTime() < _inicioDia(faixa.inicio).getTime()) ultima = null;
    }
    if (!ultima || ultima.getTime() < primeira.getTime()) return;

    diasEfetivos.push(diaSemana);
    if (!primeiraDataEfetiva || primeira.getTime() < primeiraDataEfetiva.getTime()) primeiraDataEfetiva = primeira;
    if (!ultimaDataEfetiva || ultima.getTime() > ultimaDataEfetiva.getTime()) ultimaDataEfetiva = ultima;
  });

  if (!diasEfetivos.length || !primeiraDataEfetiva) return null;

  var dataInicioIso = _formatIsoDateLocal(primeiraDataEfetiva);
  var dataFimIso = ultimaDataEfetiva ? _formatIsoDateLocal(ultimaDataEfetiva) : '';
  var nomesDias = diasEfetivos.map(_nomeDiaSemanaNumero).filter(function(v) { return !!v; });

  return {
    tipo: 'recorrente',
    data_inicio: dataInicioIso,
    data_fim: dataFimIso,
    dias_semana: nomesDias,
    horario_inicio: _minutosParaHora(iniMin),
    horario_termino: _minutosParaHora(fimMin)
  };
}

function _primeiraDataComDiasSemana(inicio, fim, diasSemana) {
  var base = _inicioDia(inicio);
  if (!diasSemana || !diasSemana.length) return (!fim || base.getTime() <= fim.getTime()) ? base : null;

  var diasPermitidos = {};
  diasSemana.forEach(function(d) { diasPermitidos[Number(d)] = true; });

  for (var i = 0; i < 7; i++) {
    var cand = new Date(base.getFullYear(), base.getMonth(), base.getDate() + i, 0, 0, 0, 0);
    if (!diasPermitidos[cand.getDay()]) continue;
    if (fim && cand.getTime() > fim.getTime()) return null;
    return cand;
  }

  return null;
}

function _primeiraDataDiaSemanaNoIntervalo(inicio, fim, diaSemana) {
  var base = _inicioDia(inicio);
  var alvo = Number(diaSemana);
  if (alvo < 0 || alvo > 6) return null;
  var delta = (alvo - base.getDay() + 7) % 7;
  var cand = new Date(base.getFullYear(), base.getMonth(), base.getDate() + delta, 0, 0, 0, 0);
  return (!fim || cand.getTime() <= fim.getTime()) ? cand : null;
}

function _conflitoRecorrenciaComIntervalo(rec, inicio, termino) {
  if (!inicio || !termino) return null;

  var recIni = _parseIsoDateLocal(rec.data_inicio);
  if (!recIni) return null;
  var recFim = rec.data_termino ? _parseIsoDateLocal(rec.data_termino) : null;

  var faixaInicio = _maxDate(_inicioDia(inicio), _inicioDia(recIni));
  var faixaFim = _fimDia(termino);
  if (recFim) faixaFim = _minDate(faixaFim, _fimDia(recFim));
  if (faixaInicio.getTime() > faixaFim.getTime()) return null;

  var hRec = _faixaHorarioRecorrencia(rec);
  var diasRec = _diasSemanaRecorrencia(rec);
  var melhor = null;
  var semanaMs = 7 * 24 * 60 * 60 * 1000;
  var inicioMs = inicio.getTime();
  var terminoMs = termino.getTime();
  var limiteFimMs = faixaFim.getTime();

  diasRec.forEach(function(diaSemana) {
    var baseDia = _primeiraDataDiaSemanaNoIntervalo(_inicioDia(recIni), faixaFim, diaSemana);
    if (!baseDia) return;

    var dataIsoBase = _formatIsoDateLocal(baseDia);
    var occIniBase = _toDateSafe(cursoDataHoraLocal(dataIsoBase, _minutosParaHora(hRec.inicio)));
    var occFimBase = _toDateSafe(cursoDataHoraLocal(dataIsoBase, _minutosParaHora(hRec.termino)));
    if (!occIniBase || !occFimBase) return;

    var occIniBaseMs = occIniBase.getTime();
    var occFimBaseMs = occFimBase.getTime();
    var kMin = Math.ceil((inicioMs - occFimBaseMs + 1) / semanaMs);
    var kMaxSobreposicao = Math.floor((terminoMs - 1 - occIniBaseMs) / semanaMs);
    var kMaxVigencia = Math.floor((limiteFimMs - occIniBaseMs) / semanaMs);
    var kMax = Math.min(kMaxSobreposicao, kMaxVigencia);
    var kCand = Math.max(0, kMin);

    if (kCand <= kMax) {
      var occIni = new Date(occIniBaseMs + kCand * semanaMs);
      var occFim = new Date(occFimBaseMs + kCand * semanaMs);
      if (_intervalosConflitam(inicio, termino, occIni, occFim)) {
        if (!melhor || occIni.getTime() < melhor.inicio.getTime()) {
          melhor = { inicio: occIni, termino: occFim };
        }
      }
    }
  });

  if (!melhor) return null;
  return {
    inicioIso: toIsoDateTime(melhor.inicio),
    terminoIso: toIsoDateTime(melhor.termino)
  };
}

function _conflitoEntreRecorrencias(c1, c2, deveIgnorarDataIso) {
  var faixa = _sobreposicaoDatasRecorrentes(c1, c2);
  if (!faixa) return null;

  var h1 = _faixaHorarioRecorrencia(c1);
  var h2 = _faixaHorarioRecorrencia(c2);
  var iniMin = Math.max(h1.inicio, h2.inicio);
  var fimMin = Math.min(h1.termino, h2.termino);
  if (iniMin >= fimMin) return null;

  var dias1 = _diasSemanaRecorrencia(c1);
  var dias2 = _diasSemanaRecorrencia(c2);
  var diasComuns = _intersecaoDiasSemana(dias1, dias2);
  if (!diasComuns.length) return null;

  var ignorarPorData = typeof deveIgnorarDataIso === 'function';
  if (ignorarPorData) {
    var melhor = null;
    var fimFaixa = faixa.fim;

    diasComuns.forEach(function(diaSemana) {
      var cand = _primeiraDataDiaSemanaNoIntervalo(faixa.inicio, fimFaixa, diaSemana);
      var tentativas = 0;

      while (cand && (!fimFaixa || cand.getTime() <= fimFaixa.getTime())) {
        var dataIsoCand = _formatIsoDateLocal(cand);
        if (!deveIgnorarDataIso(dataIsoCand)) {
          var inicioCand = _toDateSafe(cursoDataHoraLocal(dataIsoCand, _minutosParaHora(iniMin)));
          var terminoCand = _toDateSafe(cursoDataHoraLocal(dataIsoCand, _minutosParaHora(fimMin)));
          if (inicioCand && terminoCand) {
            if (!melhor || inicioCand.getTime() < melhor.inicio.getTime()) {
              melhor = { inicio: inicioCand, termino: terminoCand };
            }
          }
          break;
        }

        cand = new Date(cand.getFullYear(), cand.getMonth(), cand.getDate() + 7, 0, 0, 0, 0);
        tentativas++;

        // Proteção contra loop infinito em callbacks externos que ignorem toda data.
        if (!fimFaixa && tentativas > 5200) {
          cand = null;
          break;
        }
      }
    });

    if (!melhor) return null;
    return {
      inicioIso: toIsoDateTime(melhor.inicio),
      terminoIso: toIsoDateTime(melhor.termino)
    };
  }

  var diaConflito = _primeiraDataComDiasSemana(faixa.inicio, faixa.fim, diasComuns);
  if (!diaConflito) return null;

  var dataIso = _formatIsoDateLocal(diaConflito);
  var inicio = _toDateSafe(cursoDataHoraLocal(dataIso, _minutosParaHora(iniMin)));
  var termino = _toDateSafe(cursoDataHoraLocal(dataIso, _minutosParaHora(fimMin)));
  if (!inicio || !termino) return null;

  return {
    inicioIso: toIsoDateTime(inicio),
    terminoIso: toIsoDateTime(termino)
  };
}

function _itemPayloadEhRecorrente(item) {
  return !!(item && (item.recorrencia_tipo === 'curso' || item.recorrencia_tipo === 'trabalho'));
}

function _normalizarItemPayloadParaConflito(item, indice) {
  if (!item) return null;

  var sid = String(item.socioeducando_id || '');
  if (!sid) return null;

  var linha = Number(item.linha || 0) || (Number(indice) + 1);

  if (_itemPayloadEhRecorrente(item)) {
    var rec = {
      data_inicio: String(item.data_inicio || '').trim(),
      data_termino: item.data_termino ? String(item.data_termino).trim() : '',
      horario_inicio: fmtTime(item.horario_inicio),
      horario_termino: fmtTime(item.horario_termino),
      diasSet: String(item.dias_semana || '').split(/[;,]/).map(_normalizarDiaSemanaCurso).filter(function(v) { return !!v; })
    };
    if (!rec.data_inicio || !rec.horario_inicio || !rec.horario_termino || !rec.diasSet.length) return null;
    return {
      natureza: 'recorrente',
      tipoRecorrente: String(item.recorrencia_tipo || ''),
      sid: sid,
      linha: linha,
      rec: rec
    };
  }

  var inicio = _toDateSafe(item.data_hora_inicio);
  var termino = _toDateSafe(item.data_hora_termino) || inicio;
  if (!inicio || !termino) return null;

  return {
    natureza: 'pontual',
    sid: sid,
    linha: linha,
    inicio: inicio,
    termino: termino
  };
}

function _conflitoEntreItensPayload(a, b) {
  if (!a || !b || a.sid !== b.sid) return null;

  if (a.natureza === 'pontual' && b.natureza === 'pontual') {
    if (!_intervalosConflitam(a.inicio, a.termino, b.inicio, b.termino)) return null;
    return {
      inicioIso: toIsoDateTime(_maxDate(a.inicio, b.inicio)),
      terminoIso: toIsoDateTime(_minDate(a.termino, b.termino))
    };
  }

  if (a.natureza === 'recorrente' && b.natureza === 'pontual') {
    return _conflitoRecorrenciaComIntervalo(a.rec, b.inicio, b.termino);
  }

  if (a.natureza === 'pontual' && b.natureza === 'recorrente') {
    return _conflitoRecorrenciaComIntervalo(b.rec, a.inicio, a.termino);
  }

  if (a.natureza === 'recorrente' && b.natureza === 'recorrente') {
    return _conflitoEntreRecorrencias(a.rec, b.rec);
  }

  return null;
}

function _conflitosEntreItensPayload(itens) {
  var conflitosPorIndice = {};
  var norm = itens.map(function(it, idx) {
    return _normalizarItemPayloadParaConflito(it, idx);
  });

  for (var i = 0; i < norm.length; i++) {
    var a = norm[i];
    if (!a) continue;
    for (var j = i + 1; j < norm.length; j++) {
      var b = norm[j];
      if (!b) continue;

      var ocorr = _conflitoEntreItensPayload(a, b);
      if (!ocorr) continue;

      if (!conflitosPorIndice[i]) conflitosPorIndice[i] = [];
      if (!conflitosPorIndice[j]) conflitosPorIndice[j] = [];

      var descA = 'Conflito com item da mesma operação (linha ' + b.linha + ')';
      var descB = 'Conflito com item da mesma operação (linha ' + a.linha + ')';

      conflitosPorIndice[i].push({
        tipo: 'Item da operação',
        id: 'linha-' + b.linha,
        descricao: descA,
        inicio: ocorr.inicioIso,
        termino: ocorr.terminoIso
      });

      conflitosPorIndice[j].push({
        tipo: 'Item da operação',
        id: 'linha-' + a.linha,
        descricao: descB,
        inicio: ocorr.inicioIso,
        termino: ocorr.terminoIso
      });
    }
  }

  return conflitosPorIndice;
}

function _conflitosItemRecorrente(item, contexto, ignorados) {
  var conflitos = [];
  var sid = String(item.socioeducando_id || '');
  if (!sid) return conflitos;

  var dataInicio = String(item.data_inicio || '');
  if (!dataInicio) return conflitos;

  var recorrenciaNova = {
    tipo: String(item.recorrencia_tipo || ''),
    empresa: '',
    curso: '',
    data_inicio: dataInicio,
    data_termino: item.data_termino ? String(item.data_termino) : '',
    horario_inicio: fmtTime(item.horario_inicio),
    horario_termino: fmtTime(item.horario_termino),
    diasSet: String(item.dias_semana || '').split(/[;,]/).map(_normalizarDiaSemanaCurso).filter(function(v) { return !!v; })
  };

  if (!recorrenciaNova.horario_inicio || !recorrenciaNova.horario_termino || !recorrenciaNova.diasSet.length) {
    return conflitos;
  }

  var ignorarAtendimentoId = ignorados.atendimento_id || '';
  contexto.atendimentos.forEach(function(r) {
    var atendimentoId = String(r[0]);
    if (ignorarAtendimentoId && atendimentoId === ignorarAtendimentoId) return;
    if (String(r[1]) !== sid) return;
    var aIni = _toDateSafe(r[4]);
    var aFim = _toDateSafe(r[5]) || aIni;
    if (!aIni || !aFim) return;

    var ocorr = _conflitoRecorrenciaComIntervalo(recorrenciaNova, aIni, aFim);
    if (!ocorr) return;

    conflitos.push({
      tipo: 'Atendimento',
      id: atendimentoId,
      descricao: String(r[2] || '') + (r[3] ? ' - ' + String(r[3]) : ''),
      inicio: toIsoDateTime(r[4]),
      termino: toIsoDateTime(r[5]) || toIsoDateTime(r[4])
    });
  });

  var cms = contexto.saidas.matriculaCols;
  var cs = contexto.saidas.cols;
  var ignorarSaidaMatriculaId = ignorados.saida_matricula_id || '';
  contexto.saidas.matriculas.forEach(function(r) {
    var matriculaId = String(r[cms.id]);
    if (ignorarSaidaMatriculaId && matriculaId === ignorarSaidaMatriculaId) return;
    if (String(r[cms.socioeducando_id]) !== sid) return;
    if (_statusSaidaEhCancelada(r[cms.status])) return;

    var evento = contexto.saidas.saidasMap[String(r[cms.saida_id])];
    if (!evento) return;

    var sIni = _toDateSafe(evento[cs.data_hora_ida]);
    var sFim = _toDateSafe(evento[cs.data_hora_volta]) || sIni;
    if (!sIni || !sFim) return;

    var ocorr = _conflitoRecorrenciaComIntervalo(recorrenciaNova, sIni, sFim);
    if (!ocorr) return;

    conflitos.push({
      tipo: 'Saída',
      id: matriculaId,
      descricao: String(evento[cs.local] || '') + (evento[cs.tipo] ? ' - ' + String(evento[cs.tipo]) : ''),
      inicio: toIsoDateTime(evento[cs.data_hora_ida]),
      termino: toIsoDateTime(evento[cs.data_hora_volta]) || toIsoDateTime(evento[cs.data_hora_ida])
    });
  });

  var cm = contexto.cursos.matriculaCols;
  var cc = contexto.cursos.cols;
  var ignorarMatriculaId = ignorados.curso_matricula_id || '';
  var ignorarCursoId = ignorados.curso_id || '';
  contexto.cursos.matriculas.forEach(function(r) {
    var matriculaId = String(r[cm.id]);
    if (ignorarMatriculaId && matriculaId === ignorarMatriculaId) return;
    if (String(r[cm.socioeducando_id]) !== sid) return;
    if (cm.matriculado >= 0 && !r[cm.matriculado]) return;

    var cursoId = String(r[cm.curso_id]);
    if (ignorarCursoId && cursoId === ignorarCursoId) return;
    var cursoRow = contexto.cursos.cursosMap[cursoId];
    if (!cursoRow) return;

    var cursoExistente = {
      nome: String(cursoRow[cc.nome_curso] || ''),
      instituicao: String(cursoRow[cc.instituicao] || ''),
      data_inicio: toIso(cursoRow[cc.data_inicio]),
      data_termino: toIso(cursoRow[cc.data_termino]),
      horario_inicio: fmtTime(cursoRow[cc.horario_inicio]),
      horario_termino: fmtTime(cursoRow[cc.horario_termino]),
      diasSet: String(cursoRow[cc.dias_semana] || '').split(/[;,]/).map(_normalizarDiaSemanaCurso).filter(function(v) { return !!v; })
    };
    if (cm.tipo_termino >= 0 && String(r[cm.tipo_termino] || '').trim()) {
      var dataTerminoVinculo = toIso(r[cm.data_termino]);
      if (dataTerminoVinculo && (!cursoExistente.data_termino || dataTerminoVinculo < cursoExistente.data_termino)) {
        cursoExistente.data_termino = dataTerminoVinculo;
      }
    }

    var ocorr = _conflitoEntreRecorrencias(recorrenciaNova, cursoExistente, function(dataIso) {
      var key = _chaveCursoEventoDia(cursoId, sid, dataIso);
      return !!contexto.cursos.eventosAusenciaMap[key];
    });
    if (!ocorr) return;

    var detalheRecorrenteCurso = _detalheConflitoRecorrente(recorrenciaNova, cursoExistente, function(dataIso) {
      var key = _chaveCursoEventoDia(cursoId, sid, dataIso);
      return !!contexto.cursos.eventosAusenciaMap[key];
    });

    var descricao = cursoExistente.nome || 'Curso';
    if (cursoExistente.instituicao) descricao += ' - ' + cursoExistente.instituicao;

    conflitos.push({
      tipo: 'Curso',
      id: matriculaId,
      descricao: descricao,
      inicio: ocorr.inicioIso,
      termino: ocorr.terminoIso,
      conflito_recorrente: detalheRecorrenteCurso
    });
  });

  var ct = contexto.trabalhos.cols;
  var ignorarTrabalhoId = ignorados.trabalho_id || '';
  contexto.trabalhos.rows.forEach(function(r) {
    var trabalhoId = String(r[ct.id]);
    if (ignorarTrabalhoId && trabalhoId === ignorarTrabalhoId) return;
    if (String(r[ct.socioeducando_id]) !== sid) return;

    var trabalhoExistente = {
      tipo: String(r[ct.tipo] || ''),
      empresa: String(r[ct.empresa] || ''),
      curso: String(r[ct.curso] || ''),
      data_inicio: toIso(r[ct.data_inicio]),
      data_termino: toIso(r[ct.data_fim]) || '',
      horario_inicio: fmtTime(r[ct.horario_inicio]),
      horario_termino: fmtTime(r[ct.horario_fim]),
      diasSet: String(r[ct.dias_semana] || '').split(/[;,]/).map(_normalizarDiaSemanaCurso).filter(function(v) { return !!v; })
    };

    if (!trabalhoExistente.data_inicio || !trabalhoExistente.horario_inicio || !trabalhoExistente.horario_termino || !trabalhoExistente.diasSet.length) return;

    var ocorr = _conflitoEntreRecorrencias(recorrenciaNova, trabalhoExistente);
    if (!ocorr) return;

    var detalheRecorrenteTrabalho = _detalheConflitoRecorrente(recorrenciaNova, trabalhoExistente);

    var descricao = trabalhoExistente.tipo || 'Trabalho';
    if (trabalhoExistente.empresa) descricao += ' - ' + trabalhoExistente.empresa;
    if (trabalhoExistente.curso) descricao += ' (' + trabalhoExistente.curso + ')';

    conflitos.push({
      tipo: 'Trabalho',
      id: trabalhoId,
      descricao: descricao,
      inicio: ocorr.inicioIso,
      termino: ocorr.terminoIso,
      conflito_recorrente: detalheRecorrenteTrabalho
    });
  });

  return conflitos;
}

function _coletarContextoConflitosAgenda(socioIds) {
  var cs = getSaidasCols();
  var cmSaida = getSaidaMatriculasCols();
  var cc = getCursosCols();
  var cmCurso = getCursoMatriculasCols();
  var ceCurso = getCursoEventosCols();
  var ct = getTrabalhosCols();
  var nomes = {};
  var saidasMap = {};
  var cursosMap = {};
  var eventosAusenciaMap = {};

  getSocioeducandos().forEach(function(j) { nomes[j.id] = j.nome; });
  getRowsAtivas(SHEETS.SAIDAS).forEach(function(r) { saidasMap[String(r[cs.id])] = r; });
  getRowsAtivas(SHEETS.CURSOS).forEach(function(r) { cursosMap[String(r[cc.id])] = r; });
  var matriculasCursoMap = {};
  getRowsAtivas(SHEETS.CURSO_MATRICULAS).forEach(function(r) {
    matriculasCursoMap[String(r[cmCurso.id])] = r;
  });
  getRowsAtivas(SHEETS.CURSO_EVENTOS).forEach(function(r) {
    if (!boolVal(r[ceCurso.ausente])) return;
    var matricula = matriculasCursoMap[String(r[ceCurso.curso_matricula_id])];
    if (!matricula) return;
    var socioId = String(matricula[cmCurso.socioeducando_id]);
    if (socioIds.indexOf(socioId) < 0) return;
    var key = _chaveCursoEventoDia(matricula[cmCurso.curso_id], socioId, toIso(r[ceCurso.data]));
    eventosAusenciaMap[key] = true;
  });

  return {
    nomes: nomes,
    saidas: {
      cols: cs,
      matriculaCols: cmSaida,
      saidasMap: saidasMap,
      matriculas: getRowsAtivas(SHEETS.SAIDA_MATRICULAS).filter(function(r) {
        return socioIds.indexOf(String(r[cmSaida.socioeducando_id])) >= 0;
      })
    },
    atendimentos: getRowsAtivas(SHEETS.ATENDIMENTOS).filter(function(r) {
      return socioIds.indexOf(String(r[1])) >= 0;
    }),
    cursos: {
      cols: cc,
      matriculaCols: cmCurso,
      eventoCols: ceCurso,
      eventosAusenciaMap: eventosAusenciaMap,
      cursosMap: cursosMap,
      matriculas: getRowsAtivas(SHEETS.CURSO_MATRICULAS).filter(function(r) {
        return socioIds.indexOf(String(r[cmCurso.socioeducando_id])) >= 0;
      })
    },
    trabalhos: {
      cols: ct,
      rows: getRowsAtivas(SHEETS.TRABALHOS).filter(function(r) {
        return socioIds.indexOf(String(r[ct.socioeducando_id])) >= 0;
      })
    }
  };
}

function _conflitosSaidasParaItem(sid, inicio, termino, contexto, ignorados) {
  var conflitos = [];
  var cm = contexto.saidas.matriculaCols;
  var cs = contexto.saidas.cols;
  var ignorarMatriculaId = ignorados.saida_matricula_id || '';

  contexto.saidas.matriculas.forEach(function(r) {
    var matId = String(r[cm.id]);
    if (ignorarMatriculaId && matId === ignorarMatriculaId) return;
    if (String(r[cm.socioeducando_id]) !== sid) return;
    if (_statusSaidaEhCancelada(r[cm.status])) return;

    var s = contexto.saidas.saidasMap[String(r[cm.saida_id])];
    if (!s) return;

    var sIni = _toDateSafe(s[cs.data_hora_ida]);
    var sFim = _toDateSafe(s[cs.data_hora_volta]) || sIni;
    if (!sIni || !sFim) return;

    if (_intervalosConflitam(inicio, termino, sIni, sFim)) {
      conflitos.push({
        tipo: 'Saída',
        id: matId,
        descricao: String(s[cs.local] || ''),
        inicio: toIsoDateTime(s[cs.data_hora_ida]),
        termino: toIsoDateTime(s[cs.data_hora_volta]) || toIsoDateTime(s[cs.data_hora_ida])
      });
    }
  });

  return conflitos;
}

function _conflitosAtendimentosParaItem(sid, inicio, termino, contexto, ignorados) {
  var conflitos = [];
  var ignorarAtendimentoId = ignorados.atendimento_id || '';

  contexto.atendimentos.forEach(function(r) {
    var atendimentoId = String(r[0]);
    if (ignorarAtendimentoId && atendimentoId === ignorarAtendimentoId) return;
    if (String(r[1]) !== sid) return;

    var aIni = _toDateSafe(r[4]);
    var aFim = _toDateSafe(r[5]) || aIni;
    if (!aIni || !aFim) return;

    if (_intervalosConflitam(inicio, termino, aIni, aFim)) {
      conflitos.push({
        tipo: 'Atendimento',
        id: atendimentoId,
        descricao: String(r[2] || '') + (r[3] ? ' - ' + String(r[3]) : ''),
        inicio: toIsoDateTime(r[4]),
        termino: toIsoDateTime(r[5]) || toIsoDateTime(r[4])
      });
    }
  });

  return conflitos;
}

function _conflitosCursosParaItem(sid, inicio, termino, contexto, ignorados) {
  var conflitos = [];
  var cm = contexto.cursos.matriculaCols;
  var cc = contexto.cursos.cols;
  var ignorarMatriculaId = ignorados.curso_matricula_id || '';
  var ignorarCursoId = ignorados.curso_id || '';

  contexto.cursos.matriculas.forEach(function(r) {
    var matriculaId = String(r[cm.id]);
    if (ignorarMatriculaId && matriculaId === ignorarMatriculaId) return;
    if (String(r[cm.socioeducando_id]) !== sid) return;
    if (cm.matriculado >= 0 && !r[cm.matriculado]) return;

    var cursoId = String(r[cm.curso_id]);
    if (ignorarCursoId && cursoId === ignorarCursoId) return;

    var cursoRow = contexto.cursos.cursosMap[cursoId];
    if (!cursoRow) return;

    var curso = {
      nome: String(cursoRow[cc.nome_curso] || ''),
      instituicao: String(cursoRow[cc.instituicao] || ''),
      data_inicio: toIso(cursoRow[cc.data_inicio]),
      data_termino: toIso(cursoRow[cc.data_termino]),
      horario_inicio: fmtTime(cursoRow[cc.horario_inicio]),
      horario_termino: fmtTime(cursoRow[cc.horario_termino]),
      diasSet: String(cursoRow[cc.dias_semana] || '').split(/[;,]/).map(_normalizarDiaSemanaCurso).filter(function(v) { return !!v; })
    };

    if (cm.tipo_termino >= 0 && String(r[cm.tipo_termino] || '').trim()) {
      var dataTerminoVinculo = toIso(r[cm.data_termino]);
      if (dataTerminoVinculo && (!curso.data_termino || dataTerminoVinculo < curso.data_termino)) {
        curso.data_termino = dataTerminoVinculo;
      }
    }

    var ocorrencia = _encontrarConflitoCurso(curso, inicio, termino, function(oc) {
      var dataOcorrencia = String(oc.inicioIso || '').substring(0, 10);
      if (!dataOcorrencia) return false;
      var key = _chaveCursoEventoDia(cursoId, sid, dataOcorrencia);
      return !!contexto.cursos.eventosAusenciaMap[key];
    });
    if (!ocorrencia) return;

    var descricao = curso.nome || 'Curso';
    if (curso.instituicao) descricao += ' - ' + curso.instituicao;

    conflitos.push({
      tipo: 'Curso',
      id: matriculaId,
      descricao: descricao,
      inicio: ocorrencia.inicioIso,
      termino: ocorrencia.terminoIso
    });
  });

  return conflitos;
}

function _conflitosTrabalhosParaItem(sid, inicio, termino, contexto) {
  var conflitos = [];
  var ct = contexto.trabalhos.cols;
  var ignorarTrabalhoId = (contexto.ignorados && contexto.ignorados.trabalho_id) || '';

  contexto.trabalhos.rows.forEach(function(r) {
    var trabalhoId = String(r[ct.id]);
    if (ignorarTrabalhoId && trabalhoId === ignorarTrabalhoId) return;
    if (String(r[ct.socioeducando_id]) !== sid) return;

    var dataInicio = toIso(r[ct.data_inicio]);
    if (!dataInicio) return;

    var trabalho = {
      tipo: String(r[ct.tipo] || ''),
      empresa: String(r[ct.empresa] || ''),
      curso: String(r[ct.curso] || ''),
      data_inicio: dataInicio,
      data_termino: toIso(r[ct.data_fim]) || '9999-12-31',
      horario_inicio: fmtTime(r[ct.horario_inicio]),
      horario_termino: fmtTime(r[ct.horario_fim]),
      diasSet: String(r[ct.dias_semana] || '').split(/[;,]/).map(_normalizarDiaSemanaCurso).filter(function(v) { return !!v; })
    };

    var ocorrencia = _encontrarConflitoCurso(trabalho, inicio, termino);
    if (!ocorrencia) return;

    var descricao = trabalho.tipo || 'Trabalho';
    if (trabalho.empresa) descricao += ' - ' + trabalho.empresa;
    if (trabalho.curso) descricao += ' (' + trabalho.curso + ')';

    conflitos.push({
      tipo: 'Trabalho',
      id: trabalhoId,
      descricao: descricao,
      inicio: ocorrencia.inicioIso,
      termino: ocorrencia.terminoIso
    });
  });

  return conflitos;
}

function _listarConflitosAgendaParaItem(item, contexto, ignorados) {
  var sid = String(item.socioeducando_id || '');
  var inicio = _toDateSafe(item.data_hora_inicio);
  var termino = _toDateSafe(item.data_hora_termino) || inicio;
  if (!sid || !inicio || !termino) return [];

  return []
    .concat(_conflitosSaidasParaItem(sid, inicio, termino, contexto, ignorados))
    .concat(_conflitosAtendimentosParaItem(sid, inicio, termino, contexto, ignorados))
    .concat(_conflitosCursosParaItem(sid, inicio, termino, contexto, ignorados))
    .concat(_conflitosTrabalhosParaItem(sid, inicio, termino, {
      trabalhos: contexto.trabalhos,
      ignorados: ignorados
    }));
}

function verificarConflitosAgenda(payload) {
  if (!payload || !payload.itens || !payload.itens.length) {
    return { conflitos: [], total_conflitos: 0 };
  }

  var ignorados = {
    saida_matricula_id: payload.ignorar_matricula_id ? String(payload.ignorar_matricula_id) : '',
    atendimento_id: payload.ignorar_atendimento_id ? String(payload.ignorar_atendimento_id) : '',
    curso_matricula_id: payload.ignorar_curso_matricula_id ? String(payload.ignorar_curso_matricula_id) : '',
    curso_id: payload.ignorar_curso_id ? String(payload.ignorar_curso_id) : '',
    trabalho_id: payload.ignorar_trabalho_id ? String(payload.ignorar_trabalho_id) : ''
  };
  if (payload.ignorados) {
    if (payload.ignorados.saida_matricula_id) ignorados.saida_matricula_id = String(payload.ignorados.saida_matricula_id);
    if (payload.ignorados.atendimento_id) ignorados.atendimento_id = String(payload.ignorados.atendimento_id);
    if (payload.ignorados.curso_matricula_id) ignorados.curso_matricula_id = String(payload.ignorados.curso_matricula_id);
    if (payload.ignorados.curso_id) ignorados.curso_id = String(payload.ignorados.curso_id);
    if (payload.ignorados.trabalho_id) ignorados.trabalho_id = String(payload.ignorados.trabalho_id);
  }
  var itens = payload.itens;

  var ids = {};
  itens.forEach(function(it) {
    if (it && it.socioeducando_id) ids[String(it.socioeducando_id)] = true;
  });
  var socioIds = Object.keys(ids);
  if (!socioIds.length) return { conflitos: [], total_conflitos: 0 };

  var contexto = _coletarContextoConflitosAgenda(socioIds);
  var conflitosInternos = _conflitosEntreItensPayload(itens);

  var conflitosPorItem = [];
  var total = 0;

  itens.forEach(function(it, idx) {
    var conflitosBase = _itemPayloadEhRecorrente(it)
      ? _conflitosItemRecorrente(it, contexto, ignorados)
      : _listarConflitosAgendaParaItem(it, contexto, ignorados);
    var conflitos = conflitosBase.concat(conflitosInternos[idx] || []);

    if (conflitos.length) {
      total += conflitos.length;
      conflitosPorItem.push({
        linha: Number(it.linha || 0),
        socioeducando_id: String(it.socioeducando_id || ''),
        socioeducando_nome: contexto.nomes[String(it.socioeducando_id || '')] || '',
        conflitos: conflitos
      });
    }
  });

  return {
    conflitos: conflitosPorItem,
    total_conflitos: total
  };
}

function protegerAbas() {
  var ss = SpreadsheetApp.getActiveSpreadsheet();
  var abas = [SHEETS.SOCIOEDUCANDOS, SHEETS.CURSOS, SHEETS.CURSO_MATRICULAS, SHEETS.ADMISSOES, SHEETS.FUGAS, SHEETS.SAIDAS, SHEETS.SAIDA_MATRICULAS, SHEETS.ATENDIMENTOS, SHEETS.TIPOS_ATENDIMENTO, SHEETS.INTERESSES_CURSO];
  var eu = Session.getEffectiveUser();

  abas.forEach(function(nome) {
    var sheet = ss.getSheetByName(nome);
    if (!sheet) return;

    // Remover proteções existentes desta aba
    sheet.getProtections(SpreadsheetApp.ProtectionType.SHEET).forEach(function(p) { p.remove(); });

    // Criar nova proteção
    var prot = sheet.protect();
    prot.setDescription('Edição apenas via sistema');
    prot.setWarningOnly(false);

    // Só o dono pode editar diretamente
    prot.getEditors().forEach(function(u) {
      if (u.getEmail() !== eu.getEmail()) prot.removeEditor(u);
    });
  });

  Logger.log('Abas protegidas. Apenas o dono pode editar diretamente.');
}

// ── Importadores CSV ──────────────────────────────────────────

function _parseCsvSemicolon(texto) {
  // Normaliza quebras de linha e usa Utilities.parseCsv com ; como delimitador
  var normalizado = texto.replace(/\r\n/g, '\n').replace(/\r/g, '\n');
  return Utilities.parseCsv(normalizado, ';');
}

function _findCol(headers, termos) {
  for (var i = 0; i < headers.length; i++) {
    var h = String(headers[i] || '').toLowerCase().trim();
    for (var t = 0; t < termos.length; t++) {
      if (h.indexOf(termos[t]) >= 0) return i;
    }
  }
  return -1;
}

// ── Importar Socioeducandos ───────────────────────────────────────────

function parsearCsvSocioeducandos(csvText) {
  var rows = _parseCsvSemicolon(csvText);
  if (rows.length < 2) throw new Error('Arquivo vazio ou sem dados.');

  var hdr = rows[0];
  var cId   = _findCol(hdr, ['id do adolescente', 'código', 'codigo', 'id adolescente', 'nº']);
  if (cId < 0) cId = _findCol(hdr, ['id', 'código', 'codigo']);

  // No relatório "Documentos Pessoais", a coluna correta costuma ser "Nome"
  // e "Nome social" pode vir vazia. Por isso priorizamos Nome principal.
  var cNomePrincipal = _findCol(hdr, ['nome completo', 'nome do adolescente']);
  if (cNomePrincipal < 0) {
    for (var h = 0; h < hdr.length; h++) {
      if (String(hdr[h] || '').toLowerCase().trim() === 'nome') {
        cNomePrincipal = h;
        break;
      }
    }
  }
  var cNomeSocial = _findCol(hdr, ['nome social']);

  var cAdm  = _findCol(hdr, [
    'data da admissão', 'data da admissao',
    'data de admissão', 'data de admissao',
    'data admissão', 'data admissao',
    'admissão', 'admissao',
    'data de entrada', 'data entrada'
  ]);

  if (cId < 0)   throw new Error('Coluna de ID não encontrada. Cabeçalhos encontrados: ' + hdr.join(' | '));
  if (cNomePrincipal < 0 && cNomeSocial < 0)
    throw new Error('Coluna de Nome não encontrada. Cabeçalhos encontrados: ' + hdr.join(' | '));

  var existentes = getSocioeducandos();
  var idsExistentes = existentes.map(function(j) { return j.id; });

  var preview = [];
  var idsVistos = [];

  for (var i = 1; i < rows.length; i++) {
    var r = rows[i];
    var idRaw = String(r[cId] || '').trim();
    if (!idRaw || isNaN(Number(idRaw)) || Number(idRaw) <= 0) continue;
    var id = String(Number(idRaw));
    if (idsVistos.indexOf(id) >= 0) continue;
    idsVistos.push(id);

    var nomePrincipal = cNomePrincipal >= 0 ? String(r[cNomePrincipal] || '').trim() : '';
    var nomeSocial = cNomeSocial >= 0 ? String(r[cNomeSocial] || '').trim() : '';
    var nome = String(nomePrincipal || nomeSocial || '').trim().toUpperCase();
    if (!nome) continue;

    var dataAdm = '';
    if (cAdm >= 0 && r[cAdm]) {
      var dtRaw = String(r[cAdm]).trim();
      // Converter DD/MM/AAAA para YYYY-MM-DD
      var m = dtRaw.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})/);
      if (m) dataAdm = m[3] + '-' + m[2].padStart(2,'0') + '-' + m[1].padStart(2,'0');
    }

    preview.push({
      id: id,
      nome: nome,
      data_admissao: dataAdm,
      ja_existe: idsExistentes.indexOf(id) >= 0
    });
  }

  if (preview.length === 0) throw new Error('Nenhuma linha válida encontrada no arquivo.');
  return preview;
}

function confirmarImportarSocioeducandos(linhas) {
  ensureSocioeducandosNascimentoColumn();
  var shSocioeducandos = getSheet(SHEETS.SOCIOEDUCANDOS);
  var shAdm = getSheet(SHEETS.ADMISSOES);
  var rowsSocioeducandos = getRowsAtivas(SHEETS.SOCIOEDUCANDOS);
  var rowsAdm = getRowsAtivas(SHEETS.ADMISSOES);
  var cols = getSocioeducandosCols();
  var totalCols = shSocioeducandos.getLastColumn();

  var inseridos = 0, ignorados = 0, admCriadas = 0;
  var user = usuarioAtual();

  var idsSocioeducandos = {};
  rowsSocioeducandos.forEach(function(r) { idsSocioeducandos[String(r[cols.id])] = true; });

  var temAdmissaoAtiva = {};
  var maxAdmId = 0;
  rowsAdm.forEach(function(r) {
    var admId = Number(r[0]) || 0;
    if (admId > maxAdmId) maxAdmId = admId;
    var sid = String(r[1]);
    if (!toIso(r[3])) temAdmissaoAtiva[sid] = true;
  });

  var novosSocioeducandos = [];
  var novasAdmissoes = [];

  linhas.forEach(function(l) {
    if (!l.selecionado) { ignorados++; return; }
    var id = String(l.id);
    var idNum = Number(id);

    // Inserir socioeducando se não existir
    if (!idsSocioeducandos[id]) {
      var linhaNova = new Array(totalCols).fill('');
      linhaNova[cols.id] = idNum;
      linhaNova[cols.nome] = String(l.nome || '').trim().toUpperCase();
      if (cols.nascimento >= 0) linhaNova[cols.nascimento] = l.data_nascimento || '';
      linhaNova[cols.escolaridade] = '';
      linhaNova[cols.registrado_em] = new Date();
      linhaNova[cols.criadoPor] = user;
      linhaNova[cols.atualizadoEm] = '';
      linhaNova[cols.atualizadoPor] = '';
      novosSocioeducandos.push(linhaNova);
      idsSocioeducandos[id] = true;
      inseridos++;
    } else {
      ignorados++;
    }

    // Criar admissão se tiver data e não existir admissão ativa
    if (l.data_admissao && !temAdmissaoAtiva[id]) {
      maxAdmId++;
      novasAdmissoes.push([maxAdmId, idNum, l.data_admissao, '', new Date(), user, '', '', '', '']);
      temAdmissaoAtiva[id] = true;
      admCriadas++;
    }
  });

  if (novosSocioeducandos.length) {
    shSocioeducandos
      .getRange(shSocioeducandos.getLastRow() + 1, 1, novosSocioeducandos.length, totalCols)
      .setValues(novosSocioeducandos);
  }

  if (novasAdmissoes.length) {
    shAdm
      .getRange(shAdm.getLastRow() + 1, 1, novasAdmissoes.length, 10)
      .setValues(novasAdmissoes);
  }

  return { inseridos: inseridos, ignorados: ignorados, adm_criadas: admCriadas };
}

// ── Importar Escolaridade ─────────────────────────────────────

var MAPA_ESCOLARIDADE = {
  '1º ANO ENSINO FUND':             '1º ANO DO ENSINO FUNDAMENTAL',
  '2º ANO ENSINO FUND':             '2º ANO DO ENSINO FUNDAMENTAL',
  '3º ANO ENSINO FUND':             '3º ANO DO ENSINO FUNDAMENTAL',
  '4º ANO ENSINO FUND':             '4º ANO DO ENSINO FUNDAMENTAL',
  '5º ANO ENSINO FUND':             '5º ANO DO ENSINO FUNDAMENTAL',
  '6º ANO ENSINO FUND':             '6º ANO DO ENSINO FUNDAMENTAL',
  '7º ANO ENSINO FUND':             '7º ANO DO ENSINO FUNDAMENTAL',
  '8º ANO ENSINO FUND':             '8º ANO DO ENSINO FUNDAMENTAL',
  '9º ANO ENSINO FUND':             '9º ANO DO ENSINO FUNDAMENTAL',
  '1º ANO ENSINO MEDIO':            '1º ANO DO ENSINO MÉDIO',
  '2º ANO ENSINO MEDIO':            '2º ANO DO ENSINO MÉDIO',
  '3º ANO ENSINO MEDIO':            '3º ANO DO ENSINO MÉDIO',
  'ENSINO MEDIO COMPLETO':          'CONCLUÍDO',
  'NAO ESTA FREQUENTANDO A ESCOLA': '',
  'NAO SE APLICA':                  ''
};

function _mapEscolaridade(raw) {
  var v = String(raw || '')
    .toUpperCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .trim()
    .replace(/\.$/, '');
  if (MAPA_ESCOLARIDADE.hasOwnProperty(v)) return MAPA_ESCOLARIDADE[v];
  // Tentar match parcial
  for (var k in MAPA_ESCOLARIDADE) {
    if (v.indexOf(k) >= 0) return MAPA_ESCOLARIDADE[k];
  }
  return raw;
}

function parsearCsvEscolaridade(csvText) {
  var rows = _parseCsvSemicolon(csvText);
  if (rows.length < 2) throw new Error('Arquivo vazio ou sem dados.');

  var hdr = rows[0];
  var cId   = _findCol(hdr, ['id do adolescente', 'código', 'codigo', 'id adolescente']);
  if (cId < 0) cId = _findCol(hdr, ['id', 'código', 'codigo']);
  var cEsc  = _findCol(hdr, [
    'ano que o adolescente está matriculado',
    'ano que o adolescente esta matriculado',
    'ano que está cursando',
    'ano que esta cursando',
    'ano que',
    'escolaridade',
    'nível de ensino',
    'nivel de ensino'
  ]);

  if (cId  < 0) throw new Error('Coluna de ID não encontrada. Cabeçalhos: ' + hdr.join(' | '));
  if (cEsc < 0) throw new Error('Coluna de escolaridade não encontrada. Cabeçalhos: ' + hdr.join(' | '));

  var socioeducandos = getSocioeducandos();
  var socioeducandosMapa = {};
  socioeducandos.forEach(function(j) { socioeducandosMapa[j.id] = j; });

  var preview = [];
  var idsVistos = [];

  for (var i = 1; i < rows.length; i++) {
    var r = rows[i];
    var idRaw = String(r[cId] || '').trim();
    if (!idRaw || isNaN(Number(idRaw)) || Number(idRaw) <= 0) continue;
    var id = String(Number(idRaw));
    if (idsVistos.indexOf(id) >= 0) continue;
    idsVistos.push(id);

    if (!socioeducandosMapa[id]) continue; // não cadastrado, ignorar

    var escNova = _mapEscolaridade(r[cEsc] || '');
    var escAtual = socioeducandosMapa[id].escolaridade || '';

    preview.push({
      id: id,
      nome: socioeducandosMapa[id].nome,
      esc_atual: escAtual,
      esc_nova: escNova,
      mudou: escNova !== escAtual
    });
  }

  if (preview.length === 0) throw new Error('Nenhuma linha correspondente a socioeducandos cadastrados encontrada.');
  return preview;
}

function confirmarImportarEscolaridade(linhas) {
  ensureSocioeducandosNascimentoColumn();
  var sh = getSheet(SHEETS.SOCIOEDUCANDOS);
  var rows = getRowsAtivas(SHEETS.SOCIOEDUCANDOS);
  var cols = getSocioeducandosCols();
  var atualizados = 0;

  linhas.forEach(function(l) {
    if (!l.selecionado) return;
    var idx = rows.findIndex(function(r) { return String(r[cols.id]) === String(l.id); });
    if (idx < 0) return;
    sh.getRange(idx + 2, cols.escolaridade + 1).setValue(l.esc_nova);
    sh.getRange(idx + 2, cols.atualizadoPor + 1).setValue(usuarioAtual());
    atualizados++;
  });

  return { atualizados: atualizados };
}

// ── Importar Cursos ───────────────────────────────────────────

function parsearCsvCursos(csvText, tipoCurso) {
  throw new Error('Importador de cursos desativado.');
}

function confirmarImportarCursos(linhas) {
  throw new Error('Importador de cursos desativado.');
}

/**
 * @param {Array<{id:string, status:string}>} vinculosSocioeducandos
 *   Lista de vínculos. Apenas os que possuem status preenchido geram matrícula.
 * @param {Object} dados  Dados do curso.
 */
function salvarCursoLote(vinculosSocioeducandos, dados) {
  if (!dados.tipo_curso)   throw new Error('Tipo de curso é obrigatório.');
  if (!dados.nome_curso || dados.nome_curso.trim() === '') throw new Error('Nome do curso é obrigatório.');
  if (!dados.data_inicio)  throw new Error('Data de início é obrigatória.');
  if (!dados.data_termino) throw new Error('Data de término é obrigatória.');
  validarHorarioCurso(dados);
  if (cursoPeriodoInvalido(dados)) throw new Error('A data de término não pode ser anterior à data de início.');

  // É permitido cadastrar o curso sem nenhum socioeducando vinculado ainda
  // (ex.: cursos futuros, cujos matriculados serão definidos depois).
  var vinculos = (vinculosSocioeducandos || []).filter(function(v) { return v && v.id; });
  vinculos.forEach(function(v) { validarSocioeducandoExiste(v.id); });

  ensureCursoMatriculasMatriculadoTipoTermino();
  var cc = getCursosCols();
  var cm = getCursoMatriculasCols();
  var shCursos     = getSheet(SHEETS.CURSOS);
  var shMatriculas = getSheet(SHEETS.CURSO_MATRICULAS);
  var rowsCursos   = getRows(SHEETS.CURSOS);
  var user = usuarioAtual();
  var agora = new Date();

  // Um único registro de Curso compartilhado por todos
  var cursoId = gravarLinhaCurso(shCursos, rowsCursos, cc, dados, user);

  // Uma matrícula por vínculo com status definido
  var baseMatId = nextId(SHEETS.CURSO_MATRICULAS);
  var totalMatCols = shMatriculas.getLastColumn();
  var linhasMatriculas = vinculos.map(function(v, i) {
    var linha = construirLinhaMatricula(cm, totalMatCols, {
      curso_id: cursoId,
      socioeducando_id: Number(v.id),
      data_termino: '',
      tipo_termino: '',
      certificado: false,
      matriculado: !!v.matriculado
    });
    linha[cm.id] = baseMatId + i;
    if (cm.registrado_em >= 0) linha[cm.registrado_em] = agora;
    if (cm.criadoPor >= 0)     linha[cm.criadoPor]      = user;
    if (cm.atualizadoEm >= 0)  linha[cm.atualizadoEm]   = '';
    if (cm.atualizadoPor >= 0) linha[cm.atualizadoPor]  = '';
    return linha;
  });

  if (linhasMatriculas.length) {
    shMatriculas
      .getRange(shMatriculas.getLastRow() + 1, 1, linhasMatriculas.length, totalMatCols)
      .setValues(linhasMatriculas);
  }

  return { inseridos: linhasMatriculas.length };
}

function calcularStatusCurso(dataInicioIso, dataTerminoIso, hoje) {
  if (dataInicioIso && dataInicioIso > hoje) return 'Previsto';
  if (dataTerminoIso && dataTerminoIso < hoje) return 'Encerrado';
  return 'Em andamento';
}

function carregarPaginaCursos() {
  var cc  = getCursosCols();
  var cm  = getCursoMatriculasCols();
  var hoje = toIso(new Date());

  var rowsCursos    = getRowsAtivas(SHEETS.CURSOS);
  var rowsMatriculas = getRowsAtivas(SHEETS.CURSO_MATRICULAS);
  var rowsAdmissoes  = getRowsAtivas(SHEETS.ADMISSOES);
  var socioeducandos = getSocioeducandos();

  // Mapas rápidos
  var socioMap = {};
  socioeducandos.forEach(function(j) { socioMap[j.id] = j; });

  var cursosMap = {};
  rowsCursos.forEach(function(r) { cursosMap[String(r[cc.id])] = r; });

  // ── 1. Próximos cursos a encerrar inscrições ─────────────────
  var proximosEncerramento = rowsCursos
    .filter(function(r) {
      var limite = toIso(r[cc.data_limite_inscricao]);
      return limite && limite >= hoje;
    })
    .map(function(r) {
      var cursoId = String(r[cc.id]);
      var matriculasCurso = rowsMatriculas.filter(function(m) { return String(m[cm.curso_id]) === cursoId; });
      // Só ocupa vaga quem está efetivamente "Matriculado" — interessados e desistentes não contam.
      var matriculados = matriculasCurso.filter(function(m) {
        return m[cm.matriculado] === true;
      });
      var vagas = r[cc.vagas] !== '' && r[cc.vagas] !== null && r[cc.vagas] !== undefined ? Number(r[cc.vagas]) : null;
      var limiteIso = toIso(r[cc.data_limite_inscricao]);
      var d1 = new Date(hoje), d2 = new Date(limiteIso);
      var diasRestantes = Math.max(0, Math.round((d2 - d1) / 86400000));
      return {
        id: cursoId,
        tipo_curso:              String(r[cc.tipo_curso]      || ''),
        nome_curso:              String(r[cc.nome_curso]      || ''),
        data_inicio:             fmtDate(r[cc.data_inicio]),
        data_inicio_iso:         toIso(r[cc.data_inicio]),
        data_termino:            fmtDate(r[cc.data_termino]),
        data_termino_iso:        toIso(r[cc.data_termino]),
        horario_inicio:          fmtTime(r[cc.horario_inicio]),
        horario_termino:         fmtTime(r[cc.horario_termino]),
        dias_semana:             String(r[cc.dias_semana]     || ''),
        instituicao:             String(r[cc.instituicao]     || ''),
        local:                   String(r[cc.local]           || ''),
        observacoes:             String(r[cc.observacoes]     || ''),
        vagas:                   vagas,
        data_limite_inscricao_iso: limiteIso,
        data_limite_inscricao:   fmtDate(r[cc.data_limite_inscricao]),
        inscritos:               matriculados.length,
        vagas_disponiveis:       vagas !== null ? vagas - matriculados.length : null,
        dias_restantes:          diasRestantes,
        matriculas: matriculasCurso.map(function(m) {
          var sid = String(m[cm.socioeducando_id]);
          var socio = socioMap[sid];
          return {
            id:             sid,
            matricula_id:   String(m[cm.id]),
            nome:           socio ? socio.nome : ('ID ' + sid),
            matriculado:    m[cm.matriculado] === true,
            tipo_termino:   String(m[cm.tipo_termino] || ''),
            data_termino:   fmtDate(m[cm.data_termino]),
            data_termino_iso: toIso(m[cm.data_termino]),
            certificado:    !!m[cm.certificado],
            observacoes:    String(m[cm.observacoes]     || '')
          };
        })
      };
    })
    .sort(function(a, b) { return a.data_limite_inscricao_iso.localeCompare(b.data_limite_inscricao_iso); });

  // ── 1b. Cursos ainda não iniciados (data de início futura) ───
  // Independe do status de inscrição — um curso pode aparecer tanto aqui
  // quanto em "Inscrições Abertas" simultaneamente.
  var naoIniciados = rowsCursos
    .filter(function(r) {
      var inicio = toIso(r[cc.data_inicio]);
      return inicio && inicio > hoje;
    })
    .map(function(r) {
      var cursoId = String(r[cc.id]);
      var matriculasCurso = rowsMatriculas.filter(function(m) { return String(m[cm.curso_id]) === cursoId; });
      var matriculados = matriculasCurso.filter(function(m) {
        return m[cm.matriculado] === true;
      });
      var vagas = r[cc.vagas] !== '' && r[cc.vagas] !== null && r[cc.vagas] !== undefined ? Number(r[cc.vagas]) : null;
      return {
        id:                      cursoId,
        tipo_curso:              String(r[cc.tipo_curso]      || ''),
        nome_curso:              String(r[cc.nome_curso]      || ''),
        data_inicio:             fmtDate(r[cc.data_inicio]),
        data_inicio_iso:         toIso(r[cc.data_inicio]),
        data_termino:            fmtDate(r[cc.data_termino]),
        data_termino_iso:        toIso(r[cc.data_termino]),
        horario_inicio:          fmtTime(r[cc.horario_inicio]),
        horario_termino:         fmtTime(r[cc.horario_termino]),
        dias_semana:             String(r[cc.dias_semana]     || ''),
        instituicao:             String(r[cc.instituicao]     || ''),
        local:                   String(r[cc.local]           || ''),
        observacoes:             String(r[cc.observacoes]     || ''),
        vagas:                   vagas,
        data_limite_inscricao_iso: toIso(r[cc.data_limite_inscricao]),
        data_limite_inscricao:   fmtDate(r[cc.data_limite_inscricao]),
        inscritos:               matriculados.length,
        vagas_disponiveis:       vagas !== null ? vagas - matriculados.length : null,
        matriculas: matriculasCurso.map(function(m) {
          var sid = String(m[cm.socioeducando_id]);
          var socio = socioMap[sid];
          return {
            id:             sid,
            matricula_id:   String(m[cm.id]),
            nome:           socio ? socio.nome : ('ID ' + sid),
            matriculado:    m[cm.matriculado] === true,
            tipo_termino:   String(m[cm.tipo_termino] || ''),
            data_termino:   fmtDate(m[cm.data_termino]),
            data_termino_iso: toIso(m[cm.data_termino]),
            certificado:    !!m[cm.certificado],
            observacoes:    String(m[cm.observacoes]     || '')
          };
        })
      };
    })
    .sort(function(a, b) { return a.data_inicio_iso.localeCompare(b.data_inicio_iso); });

  // ── 2. Socioeducandos sem curso recente ──────────────────────
  // Apenas internados ativos
  var admAtivaPorSocio = {};
  rowsAdmissoes.forEach(function(r) {
    var sid = String(r[1]);
    if (!toIso(r[3])) admAtivaPorSocio[sid] = toIso(r[2]);
  });

  var interessesPorSocio = getInteressesCursoResumo().porSocioeducando;

  var semCursoRecente = [];
  Object.keys(admAtivaPorSocio).forEach(function(sid) {
    var socio = socioMap[sid];
    if (!socio) return;

    var matSocio = rowsMatriculas.filter(function(m) { return String(m[cm.socioeducando_id]) === sid; });
    var finalizadas = matSocio.filter(function(m) { return !!toIso(m[cm.data_termino]); });

    // Última atividade = data de término do último curso finalizado
    // Se não houver, usa a data de admissão
    var ultimaAtividadeIso = admAtivaPorSocio[sid];
    finalizadas.forEach(function(m) {
      var c = cursosMap[String(m[cm.curso_id])] || [];
      var dtTer = toIso(c[cc.data_termino]);
      if (dtTer && dtTer > ultimaAtividadeIso) ultimaAtividadeIso = dtTer;
    });

    var diasSemCurso = Math.max(0, Math.round((new Date(hoje) - new Date(ultimaAtividadeIso)) / 86400000));
    // Só conta como "curso ativo" quem está efetivamente Matriculado (e ainda não com término registrado).
    var cursoAtivo = matSocio.some(function(m) {
      return m[cm.matriculado] === true && !toIso(m[cm.data_termino]);
    });

    semCursoRecente.push({
      id:                   sid,
      nome:                 socio.nome,
      ultima_atividade_iso: ultimaAtividadeIso,
      ultima_atividade:     fmtDate(ultimaAtividadeIso),
      dias_sem_curso:       diasSemCurso,
      total_cursos:         matSocio.length,
      tem_curso_ativo:      cursoAtivo,
      interesses:           (interessesPorSocio[sid] || []).map(function(it) { return it.interesse; })
    });
  });

  semCursoRecente.sort(function(a, b) { return b.dias_sem_curso - a.dias_sem_curso; });

  // ── 3. Cursos em andamento ────────────────────────────────────
  // Um curso só é considerado "em andamento" quando a data atual está entre a
  // data de início e a data de término (calcularStatusCurso). Cursos futuros
  // ("Previsto") ou já encerrados por data não entram nesta seção. Só ocupa
  // vaga quem está efetivamente matriculado (booleano true) e sem término
  // registrado — mas o modal de detalhes deve listar TODOS os vínculos do
  // curso (interessados, desistentes e concluídos inclusive), não só quem
  // está ocupando vaga no momento.
  var andamentoMap = {};
  rowsCursos.forEach(function(c) {
    var dataInicioIso = toIso(c[cc.data_inicio]);
    var dataTerminoIso = toIso(c[cc.data_termino]);
    if (calcularStatusCurso(dataInicioIso, dataTerminoIso, hoje) !== 'Em andamento') return;

    var cursoId = String(c[cc.id]);
    var matriculasCurso = rowsMatriculas.filter(function(m) { return String(m[cm.curso_id]) === cursoId; });
    var matriculados = matriculasCurso.filter(function(m) {
      return m[cm.matriculado] === true && !toIso(m[cm.data_termino]);
    });
    if (!matriculados.length) return;

    andamentoMap[cursoId] = {
      id:              cursoId,
      tipo_curso:      String(c[cc.tipo_curso]      || ''),
      nome_curso:      String(c[cc.nome_curso]      || ''),
      data_inicio_iso: dataInicioIso,
      data_inicio:     fmtDate(c[cc.data_inicio]),
      data_termino_iso:dataTerminoIso,
      data_termino:    fmtDate(c[cc.data_termino]),
      horario_inicio:  fmtTime(c[cc.horario_inicio]),
      horario_termino: fmtTime(c[cc.horario_termino]),
      dias_semana:     String(c[cc.dias_semana]     || ''),
      instituicao:     String(c[cc.instituicao]     || ''),
      local:           String(c[cc.local]           || ''),
      vagas:           c[cc.vagas] !== '' && c[cc.vagas] !== null ? Number(c[cc.vagas]) || null : null,
      status:          'Em andamento',
      matriculados_ativos: matriculados.length,
      inscritos: matriculasCurso.map(function(m) {
        var sid = String(m[cm.socioeducando_id]);
        var socio = socioMap[sid];
        if (!socio) return null;
        return {
          id:             sid,
          nome:           socio.nome,
          matricula_id:   String(m[cm.id]),
          matriculado:    m[cm.matriculado] === true,
          tipo_termino:   String(m[cm.tipo_termino] || ''),
          observacoes:    String(m[cm.observacoes]     || ''),
          data_termino:   fmtDate(m[cm.data_termino]),
          data_termino_iso: toIso(m[cm.data_termino]),
          certificado:    !!m[cm.certificado]
        };
      }).filter(function(i) { return i; })
    };
  });

  var cursosAndamento = Object.keys(andamentoMap).map(function(k) { return andamentoMap[k]; })
    .sort(function(a, b) { return a.data_termino_iso.localeCompare(b.data_termino_iso); });

  return {
    proximos_encerramento: proximosEncerramento,
    nao_iniciados:         naoIniciados,
    sem_curso_recente:     semCursoRecente,
    cursos_andamento:      cursosAndamento
  };
}

/**
 * Registra (ou desfaz) o término do vínculo de um socioeducando com um
 * curso — seja por conclusão ou por desistência. Sempre exige a data exata
 * em que o término ocorreu, permitindo plotar corretamente no calendário até
 * quando o socioeducando de fato frequentou o curso (mesmo em desistências).
 * @param {string|number} matriculaId
 * @param {string} tipoTermino 'Concluído' | 'Desistente' | '' (para desfazer)
 * @param {string} dataTermino data ISO (yyyy-mm-dd)
 * @param {boolean} certificado
 */
function salvarTerminoMatricula(matriculaId, tipoTermino, dataTermino, certificado) {
  var cm = getCursoMatriculasCols();
  var sh = getSheet(SHEETS.CURSO_MATRICULAS);
  var rows = getRows(SHEETS.CURSO_MATRICULAS);
  var idx = rows.findIndex(function(r) { return String(r[cm.id]) === String(matriculaId); });
  if (idx < 0) throw new Error('Matrícula não encontrada.');
  sh.getRange(idx + 2, cm.tipo_termino  + 1).setValue(tipoTermino || '');
  sh.getRange(idx + 2, cm.data_termino  + 1).setValue(dataTermino || '');
  sh.getRange(idx + 2, cm.certificado   + 1).setValue(certificado ? true : false);
  sh.getRange(idx + 2, cm.atualizadoEm  + 1).setValue(new Date());
  sh.getRange(idx + 2, cm.atualizadoPor + 1).setValue(usuarioAtual());
  return { ok: true };
}

function excluirRegistro(tabela, id) {
  var sh = getSheet(tabela);
  var rows = getRows(tabela);
  var idx = rows.findIndex(function(r) { return String(r[0]) === String(id); });
  if (idx < 0) throw new Error('Registro não encontrado.');
  sh.deleteRow(idx + 2);
  return { ok: true };
}
