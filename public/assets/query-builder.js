'use strict';

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
    const keys = [...new Set(hits.flatMap(h => Object.keys(h)))];
    const thead = `<tr>${keys.map(k => `<th>${k}</th>`).join('')}</tr>`;
    const tbody = hits.map(hit =>
      `<tr>${keys.map(k => `<td>${hit[k] ?? ''}</td>`).join('')}</tr>`
    ).join('');
    tablePanel.innerHTML = `<table class="hits-table"><thead>${thead}</thead><tbody>${tbody}</tbody></table>`;
  } else if (!isError) {
    tablePanel.innerHTML = `<p style="color:#5e6c84;font-size:.875rem;margin-top:.5rem">No results found.</p>`;
  } else {
    tablePanel.innerHTML = '';
  }
}
