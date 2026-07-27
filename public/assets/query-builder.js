'use strict';

const DOMAIN_HOSTS = {
  local: 'http://localhost:4502',
  sit1:  'https://author-p93552-e850488.adobeaemcloud.com',
};

const form        = document.getElementById('queryForm');
const preview     = document.getElementById('preview');
const spinner     = document.getElementById('spinner');
const submitBtn   = document.getElementById('submitBtn');
const clearBtn    = document.getElementById('clearBtn');
const resultsCard = document.getElementById('resultsCard');
const statusEl    = document.getElementById('status');
const tablePanel  = document.getElementById('tab-table');
const rawJson     = document.getElementById('rawJson');
const pagination  = document.getElementById('pagination');
const prevBtn     = document.getElementById('prevBtn');
const nextBtn     = document.getElementById('nextBtn');
const pageInfo    = document.getElementById('pageInfo');

// Pagination state
let lastParams  = null;
let currentOffset = 0;
let currentLimit  = 100;
let totalResults  = 0;

form.addEventListener('input', updatePreview);

const MAX_HISTORY = 20;

function loadHistory(key) {
  try { return JSON.parse(localStorage.getItem(key)) || []; }
  catch { return []; }
}

function saveToHistory(key, value) {
  if (!value.trim()) return;
  const history = [value, ...loadHistory(key).filter(v => v !== value)].slice(0, MAX_HISTORY);
  localStorage.setItem(key, JSON.stringify(history));
  renderDatalist(key, history);
}

function renderDatalist(key, history) {
  const datalistId = { qb_path_history: 'path-history', qb_property_value_history: 'property-value-history' }[key];
  const dl = document.getElementById(datalistId);
  if (!dl) return;
  dl.innerHTML = history.map(v => `<option value="${v.replace(/"/g, '&quot;')}"></option>`).join('');
}

renderDatalist('qb_path_history', loadHistory('qb_path_history'));
renderDatalist('qb_property_value_history', loadHistory('qb_property_value_history'));

document.getElementById('f-property-value').addEventListener('input', function () {
  const pos = this.selectionStart;
  this.value = this.value.replace(/\\/g, '/');
  this.setSelectionRange(pos, pos);
});

function buildParams() {
  const data = new FormData(form);
  const params = new URLSearchParams();
  for (const [k, v] of data.entries()) {
    if (v.trim() !== '') params.set(k, v.trim());
  }
  return params;
}

function updatePreview() {
  const params = buildParams();
  const qs = params.toString();
  preview.innerHTML = qs
    ? `<strong>Query:</strong> /bin/querybuilder.json?${decodeURIComponent(qs)}`
    : '';
}

updatePreview();

document.querySelectorAll('.tab').forEach(tab => {
  tab.addEventListener('click', () => {
    document.querySelectorAll('.tab').forEach(t => t.classList.remove('active'));
    document.querySelectorAll('.tab-panel').forEach(p => p.classList.remove('active'));
    tab.classList.add('active');
    document.getElementById(`tab-${tab.dataset.tab}`).classList.add('active');
  });
});

clearBtn.addEventListener('click', () => {
  form.reset();
  updatePreview();
  resultsCard.style.display = 'none';
  pagination.style.display = 'none';
  lastParams = null;
});

form.addEventListener('submit', (e) => {
  e.preventDefault();
  const params = buildParams();
  if (!params.toString()) return;
  const pathValue = document.getElementById('f-path').value.trim();
  if (pathValue) saveToHistory('qb_path_history', pathValue);
  const propValue = document.getElementById('f-property-value').value.trim();
  if (propValue) saveToHistory('qb_property_value_history', propValue);
  lastParams = params;
  executeQuery(params, 0);
});

prevBtn.addEventListener('click', () => {
  if (!lastParams || currentOffset === 0) return;
  executeQuery(lastParams, Math.max(0, currentOffset - currentLimit));
});

nextBtn.addEventListener('click', () => {
  if (!lastParams) return;
  executeQuery(lastParams, currentOffset + currentLimit);
});

async function executeQuery(params, offset) {
  spinner.style.display = 'block';
  submitBtn.disabled = true;
  resultsCard.style.display = 'none';
  pagination.style.display = 'none';

  const limit = parseInt(params.get('p.limit') || '100', 10);

  // Build the request params with offset and guessTotal
  const reqParams = new URLSearchParams(params);
  reqParams.set('p.offset', offset);
  reqParams.set('p.guessTotal', 'true');

  try {
    const res = await fetch(`/query?${reqParams.toString()}`);
    const data = await res.json();

    currentOffset = offset;
    currentLimit  = limit;
    totalResults  = data.total ?? 0;

    resultsCard.style.display = 'block';
    renderResults(res.status, data);
    renderPagination();
  } catch (err) {
    resultsCard.style.display = 'block';
    statusEl.innerHTML = `<span class="badge badge-error">Error</span> ${err.message}`;
    tablePanel.innerHTML = '';
    rawJson.textContent = '';
  } finally {
    spinner.style.display = 'none';
    submitBtn.disabled = false;
  }
}

function renderPagination() {
  const limit = currentLimit > 0 ? currentLimit : totalResults;
  if (totalResults <= limit) {
    pagination.style.display = 'none';
    return;
  }

  const totalPages  = Math.ceil(totalResults / limit);
  const currentPage = Math.floor(currentOffset / limit) + 1;

  pageInfo.textContent = `Page ${currentPage} of ${totalPages} (${totalResults.toLocaleString()} total)`;
  prevBtn.disabled = currentPage <= 1;
  nextBtn.disabled = currentPage >= totalPages;
  pagination.style.display = 'flex';
}

function renderResults(httpStatus, data) {
  const isError = data.error || httpStatus >= 400;
  const total   = data.total ?? '—';
  const hits    = Array.isArray(data.hits) ? data.hits : [];

  statusEl.innerHTML = isError
    ? `<span class="badge badge-error">Error ${httpStatus}</span> ${data.error ?? 'Unexpected response'}`
    : `<span class="badge badge-success">${httpStatus} OK</span>
       <span class="badge badge-info">${hits.length} / ${total} results</span>`;

  rawJson.textContent = JSON.stringify(data, null, 2);

  if (!isError && hits.length > 0) {
    const allKeys = [...new Set(hits.flatMap(h => Object.keys(h)))];
    const pathIdx = allKeys.indexOf('path');
    const keys = pathIdx >= 0
      ? [...allKeys.slice(0, pathIdx + 1), '__sitesUrl', ...allKeys.slice(pathIdx + 1)]
      : [...allKeys, '__sitesUrl'];
    const domainKey = document.getElementById('f-domain').value;
    const host = DOMAIN_HOSTS[domainKey] || DOMAIN_HOSTS.local;
    const thead = `<tr>${keys.map(k => `<th>${k === '__sitesUrl' ? 'Sites URL' : k}</th>`).join('')}</tr>`;
    const tbody = hits.map(hit => {
      const cells = keys.map(k => {
        if (k === '__sitesUrl') {
          const pagePath = hit.path ? hit.path.replace(/\/jcr:content.*$/, '') : '';
          const url = pagePath ? `${host}/editor.html${pagePath}.html` : '';
          return url
            ? `<td><a href="${url}" target="_blank" rel="noopener">${url}</a></td>`
            : `<td></td>`;
        }
        return `<td>${hit[k] ?? ''}</td>`;
      }).join('');
      return `<tr>${cells}</tr>`;
    }).join('');
    tablePanel.innerHTML = `<table class="hits-table"><thead>${thead}</thead><tbody>${tbody}</tbody></table>`;
  } else if (!isError) {
    tablePanel.innerHTML = `<p style="color:#5e6c84;font-size:.875rem;margin-top:.5rem">No results found.</p>`;
  } else {
    tablePanel.innerHTML = '';
  }
}
