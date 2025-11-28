const fs = require('fs');
const assert = require('assert');

// Minimal DOM stubs
class ClassList {
  constructor() { this.set = new Set(); }
  add(...classes) { classes.forEach(c => this.set.add(c)); }
  remove(...classes) { classes.forEach(c => this.set.delete(c)); }
  contains(cls) { return this.set.has(cls); }
}

function createElement(id) {
  return {
    id,
    innerHTML: '',
    classList: new ClassList(),
    style: {},
  };
}

function setupDom({ scope = 'all', selectedCols = ['NOMBRE'] } = {}) {
  const elements = {
    'report-results': createElement('report-results'),
    'report-placeholder': createElement('report-placeholder'),
  };

  const doc = {
    scopeRadio: { value: scope, checked: true },
    checkboxes: selectedCols.map(value => ({ value, checked: true })),
    getElementById(id) { return elements[id]; },
    querySelector(selector) {
      if (selector === 'input[name="report-scope"]:checked') {
        return this.scopeRadio;
      }
      return null;
    },
    querySelectorAll(selector) {
      if (selector === '.col-check:checked') {
        return this.checkboxes.filter(cb => cb.checked);
      }
      return [];
    },
  };

  global.document = doc;
  global.window = { lucide: null };
  global.alert = (msg) => { throw new Error(`Unexpected alert: ${msg}`); };

  return elements;
}

// Helpers and shared globals matching the app
function safeVal(value) {
  if (value === null || value === undefined) return "";
  return String(value).trim();
}

const COLS = {
  COLECCION: 'Coleccion_web',
  SERIE: 'Serie_web',
  TIPOLOGIA: 'Desc._Familia_web',
  EFECTO: 'Efecto_web',
  USO: 'Tipo_de_uso',
  ACABADO_SERIE: 'Acabado_pieza_web',
  VARIACION: 'Variacion_cromatica',
  AREA: 'area',
  ID: 'Id._Articulo',
  IMAGEN: 'Imagen_web',
  NOMBRE: 'Nombre',
  COLOR: 'Color_ok',
  MEDIDA: 'Medida',
  ESPESOR: 'Espesor_mm',
  ACABADO_ART: 'Acabado_pieza_web',
  GRUPO_PRECIO: 'Grupo_Tarifa',
  GRAFICAS: 'Graficas',
  PEI: 'UNE-EN_ISO_10545-7',
  FECHA_ALTA: 'Fecha_de_alta',
  CLASE: 'UNE_41901:2017_EX',
  R: 'Deslizamiento_DIN_51130',
  LETRA: 'DIN_51097',
  PTV: 'PTV_(WET)',
  PZ_CAJA: 'Pz/Caja',
  M2_CAJA: 'M2/Caja',
  KG_CAJA: 'Kg/Caja',
  CJ_PALLET: 'Cj/Pallet',
  M2_PALLET: 'M2/Pallet',
  KG_PALLET: 'Kg/Pallet',
};

global.safeVal = safeVal;
global.COLS = COLS;

global.APP_STATE = {
  data: [],
  currentSerie: null,
  dateFilter: { active: false },
  techFilter: { active: false },
  structFilter: { active: false },
};

global.APP_CONFIG = {};

function loadFunctions() {
  const html = fs.readFileSync('index14.html', 'utf8');
  const genMatch = html.match(/function generateReport\(\) {[\s\S]*?}\n\n        function renderReportTable/);
  if (!genMatch) throw new Error('generateReport not found');
  const renderMatch = html.match(/function renderReportTable\(data, columns, title\) {[\s\S]*?}\n\n        function copyReportToClipboard/);
  if (!renderMatch) throw new Error('renderReportTable not found');

  const genSource = genMatch[0].replace(/\n\n        function renderReportTable[\s\S]*/, '');
  const renderSource = renderMatch[0].replace(/\n\n        function copyReportToClipboard[\s\S]*/, '');

  // eslint-disable-next-line no-eval
  eval(genSource);
  // eslint-disable-next-line no-eval
  eval(renderSource);

  // Expose evaluated functions to the test scope
  global.generateReport = generateReport;
  global.renderReportTable = renderReportTable;
}

loadFunctions();

function resetState() {
  APP_STATE.data = [];
  APP_STATE.currentSerie = null;
  APP_STATE.dateFilter = { active: false };
  APP_STATE.techFilter = { active: false };
  APP_STATE.structFilter = { active: false };
}

// Test 1: Friendly message when no current series
(() => {
  resetState();
  const elements = setupDom({ scope: 'current' });
  generateReport();
  assert(elements['report-results'].innerHTML.includes('Selecciona una serie primero'), 'Should show friendly message');
  assert(elements['report-placeholder'].classList.contains('hidden'), 'Placeholder should be hidden');
})();

// Test 2: Filters applied for full catalog
(() => {
  resetState();
  const elements = setupDom({ scope: 'all', selectedCols: ['NOMBRE', 'MEDIDA'] });
  APP_STATE.data = [
    {
      [COLS.ID]: '1',
      [COLS.COLECCION]: 'Coll A',
      [COLS.SERIE]: 'Serie A',
      [COLS.MEDIDA]: '60x60',
      [COLS.NOMBRE]: 'Item 1',
      [COLS.CLASE]: 'C1',
      [COLS.R]: 'R10',
      [COLS.LETRA]: 'A',
      [COLS.PTV]: 'P',
      [COLS.TIPOLOGIA]: 'Porcelain',
      _dateObj: new Date(2024, 5, 1),
    },
    {
      [COLS.ID]: '2',
      [COLS.COLECCION]: 'Coll B',
      [COLS.SERIE]: 'Serie B',
      [COLS.MEDIDA]: '30x30',
      [COLS.NOMBRE]: 'Item 2',
      [COLS.CLASE]: 'C2',
      [COLS.R]: 'R9',
      [COLS.LETRA]: 'B',
      [COLS.PTV]: 'X',
      [COLS.TIPOLOGIA]: 'Ceramic',
      _dateObj: new Date(2023, 1, 1),
    },
  ];

  APP_STATE.dateFilter = { active: true, mode: 'custom', year: 2024, month: 5 };
  APP_STATE.techFilter = { active: true, cte: 'C1', r: 'R10', din: 'A', ptv: 'P' };
  APP_STATE.structFilter = { active: true, medida: '60x60', tipo: 'Porcelain' };

  generateReport();

  const html = elements['report-results'].innerHTML;
  assert(html.includes('1 SKUs'), 'Should only include one matching SKU');
  assert(html.includes('Item 1'), 'Should include filtered item');
  assert(!html.includes('Item 2'), 'Should exclude non-matching item');
})();

// Test 3: No results path
(() => {
  resetState();
  const elements = setupDom({ scope: 'all', selectedCols: ['NOMBRE'] });
  APP_STATE.data = [
    { [COLS.ID]: '3', [COLS.NOMBRE]: 'Item 3', [COLS.COLECCION]: 'Coll C', [COLS.SERIE]: 'Serie C', [COLS.MEDIDA]: '10x10', _dateObj: new Date(2020, 0, 1) },
  ];
  APP_STATE.dateFilter = { active: true, mode: 'custom', year: 2025, month: 0 };

  generateReport();
  assert(elements['report-results'].innerHTML.includes('No hay resultados'), 'Should show no results message');
})();

console.log('All tests passed');
