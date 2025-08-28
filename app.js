/*
==============================================
API INTEGRATION SECTION - FOR FUTURE USE
==============================================

// WEBHOOK ENDPOINTS - Add your webhook URLs here
const WEBHOOKS = {
  onUpload: 'https://your-webhook.com/upload',
  onProcess: 'https://your-webhook.com/process', 
  onExport: 'https://your-webhook.com/export'
};

// AI API CONFIGURATIONS - Add your API settings here
const API_CONFIG = {
  openai: {
    apiKey: 'your-openai-key',
    endpoint: 'https://api.openai.com/v1/chat/completions',
    model: 'gpt-4'
  },
  claude: {
    apiKey: 'your-claude-key', 
    endpoint: 'https://api.anthropic.com/v1/messages',
    model: 'claude-3-sonnet-20240229'
  },
  custom: {
    endpoint: 'https://your-custom-api.com/seo-process'
  }
};

// INTEGRATION FUNCTIONS - Implement these later
async function callOpenAI(prompt, data) {
  // OpenAI API integration code here
}

async function callClaude(prompt, data) {
  // Claude API integration code here  
}

async function sendWebhook(endpoint, data) {
  // Webhook sending code here
}

async function processWithAI(csvData) {
  // Main AI processing orchestration here
  // This will replace the mock functions when ready
}

==============================================
*/

// ---------- Utilities ----------
const qs = (sel, ctx = document) => ctx.querySelector(sel);
const qsa = (sel, ctx = document) => Array.from(ctx.querySelectorAll(sel));
const el = (tag, props = {}, children = []) => {
  const n = document.createElement(tag);
  Object.entries(props).forEach(([k, v]) => {
    if (k === 'class') n.className = v;
    else if (k === 'html') n.innerHTML = v;
    else if (k.startsWith('on') && typeof v === 'function') n.addEventListener(k.slice(2).toLowerCase(), v);
    else n.setAttribute(k, v);
  });
  children.forEach(c => n.appendChild(typeof c === 'string' ? document.createTextNode(c) : c));
  return n;
};

function show(node) { node.classList.remove('is-hidden'); }
function hide(node) { node.classList.add('is-hidden'); }
function activate(node) { node.classList.add('is-active'); }
function deactivate(node) { node.classList.remove('is-active'); }

// ---------- State ----------
const state = {
  step: 0, // 0 upload, 1 preview, 2 process, 3 export
  rawData: [], // parsed CSV rows
  filteredData: [],
  selectedRowIdxs: new Set(),
  sortKey: null,
  sortDir: 'asc',
  results: null,
};

// ---------- Mock SEO Processor ----------
const SEOProcessor = {
  analyzeBusinessType(url, keywords) {
    const businessTypes = ['Local Service', 'E-commerce', 'SaaS', 'Content Site', 'Professional Services'];
    return businessTypes[Math.floor(Math.random() * businessTypes.length)];
  },
  generateSEOArchitecture({ url, primaryKeywords, secondaryKeywords, geoAreas }) {
    return {
      homepage: [{
        title: `${primaryKeywords[0] || 'Homepage'} - Professional Services`,
        url: '/',
        type: 'homepage',
        keywords: primaryKeywords.slice(0, 3)
      }],
      servicePages: primaryKeywords.map((keyword, i) => ({
        title: `${keyword} Services`,
        url: `/${(keyword || '').toLowerCase().replace(/\s+/g, '-')}`,
        type: 'service',
        keywords: [keyword, ...((secondaryKeywords.slice(i * 2, i * 2 + 2)) || [])]
      })),
      locationPages: geoAreas.map(area => ({
        title: `${primaryKeywords[0] || 'Services'} in ${area}`,
        url: `/${(area || '').toLowerCase().replace(/\s+/g, '-')}`,
        type: 'location',
        keywords: [primaryKeywords[0] || '', area]
      })),
      blogPages: [
        {
          title: `Ultimate Guide to ${primaryKeywords[0] || 'Your Service'}`,
          url: `/blog/guide-to-${(primaryKeywords[0] || 'service').toLowerCase().replace(/\s+/g, '-')}`,
          type: 'blog',
          keywords: primaryKeywords.slice(0, 3)
        }
      ]
    };
  },
  generateInternalLinks(architecture) {
    const links = [];
    Object.values(architecture).flat().forEach(page => {
      if (page.type !== 'homepage') {
        links.push({
          from: 'Homepage',
          to: page.title,
          anchor: (page.title || '').split(' - ')[0],
          reason: 'Main navigation link'
        });
      }
    });
    return links;
  },
  generateContentOutlines(architecture) {
    const outlines = [];
    Object.entries(architecture).forEach(([category, pages]) => {
      pages.forEach(page => {
        outlines.push({
          page: page.title,
          url: page.url,
          outline: [
            'Introduction and Overview',
            'Key Benefits and Features',
            'Process and Methodology',
            'Frequently Asked Questions',
            'Contact and Next Steps'
          ],
          wordCount: Math.floor(Math.random() * 1000) + 800,
          targetKeywords: page.keywords || []
        });
      });
    });
    return outlines;
  }
};

// ---------- CSV Parsing ----------
function parseCsvFile(file) {
  return new Promise((resolve, reject) => {
    Papa.parse(file, {
      header: true,
      skipEmptyLines: true,
      complete: (res) => resolve(res.data || []),
      error: (err) => reject(err)
    });
  });
}

// Demo data
const DEMO_DATA = [
  {
    url: 'https://example-plumbing.com',
    primary_keywords: 'plumbing, emergency plumber, pipe repair',
    secondary_keywords: 'water heater, drain cleaning, leak detection',
    primary_geo: 'New York City',
    secondary_geo: 'Brooklyn, Queens, Manhattan'
  },
  {
    url: 'https://dentist-example.com',
    primary_keywords: 'dentist, dental care, teeth cleaning',
    secondary_keywords: 'orthodontics, dental implants, whitening',
    primary_geo: 'Los Angeles',
    secondary_geo: 'Beverly Hills, Santa Monica'
  }
];

// ---------- Step & Progress ----------
function setStep(step) {
  state.step = step;
  const steps = [qs('#step-upload'), qs('#step-preview'), qs('#step-process'), qs('#step-export')];
  steps.forEach((s, i) => (i === step ? activate(s) : deactivate(s)));
  updateProgress(step);
}

function updateProgress(step) {
  const stepEls = qsa('.progress__step');
  const bars = qsa('.progress__bar');
  stepEls.forEach((s, i) => {
    if (i <= step) s.classList.add('is-active'); else s.classList.remove('is-active');
  });
  bars.forEach((b, i) => {
    if (i < step) b.classList.add('is-active'); else b.classList.remove('is-active');
  });
}

// ---------- Upload Handlers ----------
function initUpload() {
  const dropzone = qs('#dropzone');
  const fileInput = qs('#file-input');
  const success = qs('#upload-success');
  const rowCount = qs('#row-count');
  const toPreviewBtn = qs('#to-preview');
  const loadDemoBtn = qs('#load-demo');

  const handleFiles = async (files) => {
    const file = files && files[0];
    if (!file) return;
    if (!file.name.toLowerCase().endsWith('.csv')) {
      alert('Please upload a .csv file.');
      return;
    }
    try {
      const data = await parseCsvFile(file);
      onFileUpload(data);
      success && show(success);
      rowCount && (rowCount.textContent = String(state.rawData.length));
    } catch (e) {
      alert('Error parsing CSV: ' + (e && e.message ? e.message : String(e)));
    }
  };

  dropzone.addEventListener('click', () => fileInput.click());
  dropzone.addEventListener('dragover', (e) => { e.preventDefault(); dropzone.classList.add('is-drag'); });
  dropzone.addEventListener('dragleave', (e) => { e.preventDefault(); dropzone.classList.remove('is-drag'); });
  dropzone.addEventListener('drop', (e) => { e.preventDefault(); dropzone.classList.remove('is-drag'); handleFiles(e.dataTransfer.files); });
  fileInput.addEventListener('change', (e) => handleFiles(e.target.files));

  toPreviewBtn.addEventListener('click', () => setStep(1));
  loadDemoBtn.addEventListener('click', () => {
    onFileUpload([...DEMO_DATA]);
    success && show(success);
    rowCount && (rowCount.textContent = String(state.rawData.length));
  });
}

function onFileUpload(data) {
  state.rawData = Array.isArray(data) ? data.filter(Boolean) : [];
  state.filteredData = [...state.rawData];
  state.selectedRowIdxs = new Set(state.filteredData.map((_, i) => i));
  renderPreview();
}

// ---------- Preview (sorting, filtering, selection) ----------
function initPreview() {
  qs('#back-from-preview').addEventListener('click', () => setStep(0));
  qs('#to-process').addEventListener('click', () => {
    // Capture selected rows
    const selected = Array.from(state.selectedRowIdxs).map(i => state.filteredData[i]);
    if (!selected.length) return;
    state.toProcess = selected;
    setStep(2);
    show(qs('#process-ready'));
    hide(qs('#processing'));
    hide(qs('#process-results'));
  });

  qs('#filter-input').addEventListener('input', (e) => {
    const v = (e.target.value || '').toLowerCase();
    state.filteredData = state.rawData.filter(row => {
      const hay = `${row.url || ''} ${row.primary_keywords || ''} ${row.secondary_keywords || ''} ${row.primary_geo || ''} ${row.secondary_geo || ''}`.toLowerCase();
      return hay.includes(v);
    });
    // Reset selection on filter
    state.selectedRowIdxs = new Set(state.filteredData.map((_, i) => i));
    renderPreview();
  });

  qs('#select-all').addEventListener('change', (e) => {
    if (e.target.checked) {
      state.selectedRowIdxs = new Set(state.filteredData.map((_, i) => i));
    } else {
      state.selectedRowIdxs = new Set();
    }
    renderPreviewSelectionOnly();
  });

  // Column sorting buttons
  qsa('th[data-sort] .sort', qs('#preview-table')).forEach(btn => {
    btn.addEventListener('click', () => {
      const th = btn.closest('th');
      const key = th.getAttribute('data-sort');
      if (state.sortKey === key) {
        state.sortDir = state.sortDir === 'asc' ? 'desc' : 'asc';
      } else {
        state.sortKey = key;
        state.sortDir = 'asc';
      }
      sortFiltered(state.sortKey, state.sortDir);
      renderPreview();
    });
  });
}

function sortFiltered(key, dir) {
  const mult = dir === 'asc' ? 1 : -1;
  state.filteredData.sort((a, b) => {
    const av = (a[key] || '').toString().toLowerCase();
    const bv = (b[key] || '').toString().toLowerCase();
    if (av < bv) return -1 * mult; if (av > bv) return 1 * mult; return 0;
  });
}

function renderPreview() {
  const tbody = qs('#preview-tbody');
  tbody.innerHTML = '';
  state.filteredData.forEach((row, idx) => {
    const tr = el('tr', { class: state.selectedRowIdxs.has(idx) ? 'is-selected' : '' });

    const tdSelect = el('td');
    const cb = el('input', { type: 'checkbox' });
    cb.checked = state.selectedRowIdxs.has(idx);
    cb.addEventListener('change', () => {
      if (cb.checked) state.selectedRowIdxs.add(idx); else state.selectedRowIdxs.delete(idx);
      updateSelectedCount();
      qs('#to-process').disabled = state.selectedRowIdxs.size === 0;
      // update select-all checkbox
      const all = qs('#select-all');
      all.checked = state.selectedRowIdxs.size === state.filteredData.length;
    });
    tdSelect.appendChild(cb);

    const tdUrl = el('td', {}, [el('span', { class: 'mono' }, [row.url || ''])]);
    const tdPrim = el('td', {}, [row.primary_keywords || '']);
    const tdGeo = el('td', {}, [row.primary_geo || '']);

    const bt = SEOProcessor.analyzeBusinessType(row.url || '', row.primary_keywords || '');
    const tdType = el('td', {}, [el('span', { class: 'badge' }, [bt])]);

    tr.appendChild(tdSelect);
    tr.appendChild(tdUrl);
    tr.appendChild(tdPrim);
    tr.appendChild(tdGeo);
    tr.appendChild(tdType);

    tbody.appendChild(tr);
  });
  updateSelectedCount();
  qs('#to-process').disabled = state.selectedRowIdxs.size === 0;
  // update select-all checkbox
  const all = qs('#select-all');
  all.checked = state.selectedRowIdxs.size === state.filteredData.length && state.filteredData.length > 0;
}

function renderPreviewSelectionOnly() {
  const tbody = qs('#preview-tbody');
  qsa('tr', tbody).forEach((tr, idx) => {
    const cb = tr.querySelector('input[type="checkbox"]');
    cb.checked = state.selectedRowIdxs.has(idx);
    if (state.selectedRowIdxs.has(idx)) tr.classList.add('is-selected'); else tr.classList.remove('is-selected');
  });
  updateSelectedCount();
  qs('#to-process').disabled = state.selectedRowIdxs.size === 0;
}

function updateSelectedCount() {
  qs('#selected-count').textContent = `${state.selectedRowIdxs.size} of ${state.filteredData.length} rows selected`;
}

// ---------- Processing ----------
function initProcess() {
  qs('#back-from-process').addEventListener('click', () => setStep(1));
  qs('#start-process').addEventListener('click', async () => {
    hide(qs('#process-ready'));
    show(qs('#processing'));
    hide(qs('#process-results'));

    await new Promise(r => setTimeout(r, 1200));

    const results = (state.toProcess || []).map(row => {
      const primaryKeywords = (row.primary_keywords || '').split(',').map(k => k.trim()).filter(Boolean);
      const secondaryKeywords = (row.secondary_keywords || '').split(',').map(k => k.trim()).filter(Boolean);
      const geoAreas = [row.primary_geo, ...(row.secondary_geo || '').split(',').map(g => g.trim()).filter(Boolean)].filter(Boolean);

      const architecture = SEOProcessor.generateSEOArchitecture({ url: row.url, primaryKeywords, secondaryKeywords, geoAreas });
      const internalLinks = SEOProcessor.generateInternalLinks(architecture);
      const contentOutlines = SEOProcessor.generateContentOutlines(architecture);

      return {
        url: row.url,
        businessType: SEOProcessor.analyzeBusinessType(row.url, primaryKeywords[0] || ''),
        architecture,
        internalLinks,
        contentOutlines,
        keywords: { primary: primaryKeywords, secondary: secondaryKeywords },
        geoAreas
      };
    });

    state.results = results;

    hide(qs('#processing'));
    show(qs('#process-results'));
    qs('#processed-count').textContent = String(results.length);
    renderResultsList(results);
  });

  qs('#to-export').addEventListener('click', () => {
    setStep(3);
    populateExportStats();
  });
}

function renderResultsList(results) {
  const list = qs('#results-list');
  list.innerHTML = '';

  results.forEach((result, idx) => {
    const card = el('div', { class: 'result-card' });

    const headerLeft = el('div', {}, [
      el('div', { class: 'result-card__title' }, [result.url || '']),
      el('div', { class: 'small muted' }, [`Business Type: ${result.businessType}`])
    ]);

    const viewBtn = el('button', { class: 'btn btn--primary btn--sm' }, ['View Details']);
    const header = el('div', { class: 'result-card__header' }, [headerLeft, viewBtn]);

    const body = el('div', { class: 'result-card__body' });

    // Top metrics row
    const metrics = el('div', { class: 'grid', style: 'grid-template-columns: repeat(1, minmax(0,1fr)); gap: 12px;' }, [
      el('div', {}, [
        el('div', { class: 'muted small' }, ['Site Architecture']),
        el('div', {}, [String(Object.values(result.architecture).flat().length), ' pages'])
      ]),
      el('div', {}, [
        el('div', { class: 'muted small' }, ['Internal Links']),
        el('div', {}, [String(result.internalLinks.length), ' link recommendations'])
      ]),
      el('div', {}, [
        el('div', { class: 'muted small' }, ['Content Outlines']),
        el('div', {}, [String(result.contentOutlines.length), ' content pieces'])
      ])
    ]);

    body.appendChild(metrics);

    // Expand area
    const expand = el('div', { class: 'is-hidden' });

    // Tabs
    const tabs = el('div', { class: 'tabs' });
    const tabPages = el('button', { class: 'tab is-active' }, ['Pages & Keywords']);
    const tabContent = el('button', { class: 'tab' }, ['Content Outlines']);
    const tabLinks = el('button', { class: 'tab' }, ['Internal Links']);
    tabs.appendChild(tabPages); tabs.appendChild(tabContent); tabs.appendChild(tabLinks);

    const tabPanels = el('div');
    const panelPages = el('div');
    const panelContent = el('div', { class: 'is-hidden' });
    const panelLinks = el('div', { class: 'is-hidden' });

    // Pages & Keywords table
    const allPages = Object.entries(result.architecture).flatMap(([category, pages]) => pages.map(p => ({ ...p, category })));
    panelPages.appendChild(buildTable([
      'Page Title', 'URL', 'Category', 'Target Keywords'
    ], allPages.map(p => [
      p.title,
      p.url,
      (p.category || '').replace('Pages', '').replace('homepage', 'Homepage'),
      (p.keywords || []).slice(0, 3).join(', ') + ((p.keywords || []).length > 3 ? ` (+${(p.keywords || []).length - 3})` : '')
    ])));

    // Content Outlines table
    panelContent.appendChild(buildTable([
      'Content Title', 'URL', 'Word Count', 'Outline Preview'
    ], result.contentOutlines.map(o => [
      o.page,
      o.url,
      `${o.wordCount} words`,
      o.outline.slice(0, 2).join(' • ') + (o.outline.length > 2 ? ` (+${o.outline.length - 2} more)` : '')
    ])));

    // Internal Links table
    panelLinks.appendChild(buildTable([
      'From Page', 'To Page', 'Anchor Text', 'Link Reason'
    ], result.internalLinks.map(l => [l.from, l.to, l.anchor, l.reason])));

    tabPanels.appendChild(panelPages);
    tabPanels.appendChild(panelContent);
    tabPanels.appendChild(panelLinks);

    // Tab events
    const setActiveTab = (tab) => {
      [tabPages, tabContent, tabLinks].forEach(t => t.classList.remove('is-active'));
      [panelPages, panelContent, panelLinks].forEach(p => p.classList.add('is-hidden'));
      tab.classList.add('is-active');
      if (tab === tabPages) panelPages.classList.remove('is-hidden');
      if (tab === tabContent) panelContent.classList.remove('is-hidden');
      if (tab === tabLinks) panelLinks.classList.remove('is-hidden');
    };

    tabPages.addEventListener('click', () => setActiveTab(tabPages));
    tabContent.addEventListener('click', () => setActiveTab(tabContent));
    tabLinks.addEventListener('click', () => setActiveTab(tabLinks));

    expand.appendChild(tabs);
    expand.appendChild(tabPanels);

    viewBtn.addEventListener('click', () => {
      if (expand.classList.contains('is-hidden')) {
        expand.classList.remove('is-hidden');
        viewBtn.textContent = 'Hide Details';
      } else {
        expand.classList.add('is-hidden');
        viewBtn.textContent = 'View Details';
      }
    });

    card.appendChild(header);
    card.appendChild(body);
    card.appendChild(expand);
    list.appendChild(card);
  });
}

function buildTable(headers, rows) {
  const wrap = el('div', { class: 'table-wrap' });
  const table = el('table', { class: 'table' });
  const thead = el('thead');
  const trh = el('tr');
  headers.forEach(h => trh.appendChild(el('th', {}, [h])));
  thead.appendChild(trh);
  const tbody = el('tbody');
  rows.forEach(r => {
    const tr = el('tr');
    r.forEach(cell => tr.appendChild(el('td', {}, [String(cell)])));
    tbody.appendChild(tr);
  });
  table.appendChild(thead);
  table.appendChild(tbody);
  wrap.appendChild(table);
  return wrap;
}

// ---------- Export ----------
function initExport() {
  qs('#back-from-export').addEventListener('click', () => setStep(2));
  qs('#start-over').addEventListener('click', () => startOver());
  qs('#download-json').addEventListener('click', downloadJSON);
  qs('#download-csv').addEventListener('click', downloadCSV);
  qs('#download-md').addEventListener('click', downloadMarkdown);
}

function populateExportStats() {
  const results = state.results || [];
  const totalPages = results.reduce((sum, r) => sum + Object.values(r.architecture).flat().length, 0);
  const totalContent = results.reduce((sum, r) => sum + r.contentOutlines.length, 0);
  qs('#stat-sites').textContent = String(results.length);
  qs('#stat-pages').textContent = String(totalPages);
  qs('#stat-outlines').textContent = String(totalContent);
}

function downloadJSON() {
  const dataStr = JSON.stringify(state.results || [], null, 2);
  downloadBlob(dataStr, 'application/json', 'seo_strategy.json');
}

function downloadCSV() {
  const results = state.results || [];
  const csvData = results.flatMap(result => 
    result.contentOutlines.map(outline => ({
      website: result.url,
      business_type: result.businessType,
      page_title: outline.page,
      page_url: outline.url,
      target_keywords: outline.targetKeywords ? outline.targetKeywords.join(', ') : '',
      word_count: outline.wordCount,
      content_outline: outline.outline.join(' | ')
    }))
  );
  if (!csvData.length) return;
  const headers = Object.keys(csvData[0]);
  const rows = [headers.join(',')].concat(csvData.map(row => headers.map(h => escapeCsv(String(row[h] ?? ''))).join(',')));
  const csv = rows.join('\n');
  downloadBlob(csv, 'text/csv', 'seo_content_plan.csv');
}

function escapeCsv(value) {
  if (/[",\n]/.test(value)) return '"' + value.replace(/"/g, '""') + '"';
  return value;
}

function downloadMarkdown() {
  const results = state.results || [];
  let md = '# SEO Strategy Report\n\n';
  results.forEach(result => {
    md += `## ${result.url}\n`;
    md += `**Business Type:** ${result.businessType}\n\n`;
    md += '### Site Architecture\n';
    Object.entries(result.architecture).forEach(([category, pages]) => {
      const title = category.charAt(0).toUpperCase() + category.slice(1);
      md += `**${title}:**\n`;
      pages.forEach(page => { md += `- ${page.title} (${page.url})\n`; });
      md += '\n';
    });
    md += '### Content Outlines\n';
    result.contentOutlines.forEach(outline => {
      md += `**${outline.page}**\n`;
      md += `- URL: ${outline.url}\n`;
      md += `- Target Keywords: ${outline.targetKeywords ? outline.targetKeywords.join(', ') : 'N/A'}\n`;
      md += `- Word Count: ${outline.wordCount}\n`;
      md += `- Outline:\n`;
      outline.outline.forEach(item => { md += `  - ${item}\n`; });
      md += '\n';
    });
    md += '---\n\n';
  });
  downloadBlob(md, 'text/markdown', 'seo_strategy_report.md');
}

function downloadBlob(content, type, filename) {
  const blob = new Blob([content], { type });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url; a.download = filename; a.click();
  URL.revokeObjectURL(url);
}

function startOver() {
  state.step = 0;
  state.rawData = [];
  state.filteredData = [];
  state.selectedRowIdxs = new Set();
  state.sortKey = null; state.sortDir = 'asc';
  state.results = null; state.toProcess = null;
  qs('#preview-tbody').innerHTML = '';
  qs('#filter-input').value = '';
  qs('#select-all').checked = false;
  setStep(0);
}

// ---------- Init ----------
function initYear() {
  const y = new Date().getFullYear();
  const yearEl = qs('#year');
  if (yearEl) yearEl.textContent = String(y);
}

function init() {
  initYear();
  initUpload();
  initPreview();
  initProcess();
  initExport();
  setStep(0);
}

document.addEventListener('DOMContentLoaded', init); 