const KEY = 'weightEntries';
const GOAL_KEY = 'weightGoal';

let entries = JSON.parse(localStorage.getItem(KEY) || '[]');
let editingDate = null;

function save() { localStorage.setItem(KEY, JSON.stringify(entries)); }

function weeklyAverages(nWeeks = 8) {
  const weeks = [];
  const now = new Date();
  for (let i = nWeeks - 1; i >= 0; i--) {
    const end = new Date(now);
    end.setDate(now.getDate() - now.getDay() - 7 * i + 7); // Sunday
    const start = new Date(end);
    start.setDate(end.getDate() - 6); // Monday
    const inWeek = entries.filter(x => {
      const d = new Date(x.date + 'T00:00:00');
      return d >= start && d <= end;
    });
    if (inWeek.length) {
      const avg = inWeek.reduce((s, x) => s + x.weight, 0) / inWeek.length;
      weeks.push({ label: `${start.getMonth() + 1}/${start.getDate()}`, value: +avg.toFixed(1) });
    }
  }
  return weeks;
}

function lbsDiff(a, b) {
  const diff = (a - b).toFixed(1);
  return (diff <= 0 ? '' : '+') + diff + ' lbs';
}

// Page-specific code runs only if the page has the right elements
if (document.getElementById('chart'))    initDashboard();
if (document.getElementById('entries'))  initLogPage();

function initDashboard() {
  const goalInput = document.getElementById('goal');
  goalInput.value = localStorage.getItem(GOAL_KEY) || '';
  goalInput.addEventListener('change', () => {
    localStorage.setItem(GOAL_KEY, goalInput.value);
    renderStats();
  });

  function renderStats() {
    if (entries.length < 1) return;
    const start = entries[0].weight;
    const cur = entries[entries.length - 1].weight;
    document.getElementById('startW').textContent = start + ' lbs';
    document.getElementById('curW').textContent = cur + ' lbs';
    document.getElementById('change').textContent =
      (cur - start >= 0 ? '+' : '−') + Math.abs(cur - start).toFixed(1) + ' lbs';

    const goal = parseFloat(goalInput.value);
    const fill = document.getElementById('progressFill');
    const label = document.getElementById('progressLabel');
    if (goal && start !== goal) {
      const total = Math.abs(start - goal);
      const done = Math.max(0, Math.min(total, Math.abs(start - cur)));
      const movingRight = (goal < start && cur <= start) || (goal > start && cur >= start);
      const realPct = movingRight ? (done / total) * 100 : 0;
      fill.style.width = realPct + '%';
      label.textContent = `${realPct.toFixed(0)}% · ${Math.abs(cur - goal).toFixed(1)} lbs to go`;
    } else {
      fill.style.width = '0%';
      label.textContent = '';
    }
  }

  // alias used inside shared render
  window.renderStats = renderStats;
  renderStats();
  renderChart();
  setInterval(() => { renderChart(); }, 60000); // keep chart fresh if tab left open
}

function initLogPage() {
  const form = document.getElementById('form');
  const dateEl = document.getElementById('date');
  const weightEl = document.getElementById('weight');
  const logBtn = document.getElementById('logBtn');

  dateEl.valueAsDate = new Date();

  form.addEventListener('submit', e => {
    e.preventDefault();
    const date = dateEl.value;
    const weight = parseFloat(weightEl.value);
    if (!date || !isFinite(weight)) return;
    entries = entries.filter(x => x.date !== date);
    entries.push({ date, weight });
    entries.sort((a, b) => a.date.localeCompare(b.date));
    save();
    exitEditMode();
    renderList();
  });

  window.startEdit = function (date) {
    const entry = entries.find(x => x.date === date);
    if (!entry) return;
    editingDate = date;
    dateEl.value = entry.date;
    weightEl.value = entry.weight;
    logBtn.textContent = 'Update';
    document.querySelectorAll('.entry-row').forEach(r =>
      r.dataset.date === date
        ? r.setAttribute('data-editing', 'true')
        : r.removeAttribute('data-editing'));
    weightEl.focus();
  };

  window.deleteEntry = function (date) {
    if (!confirm(`Delete the log entry for ${date}?`)) return;
    entries = entries.filter(x => x.date !== date);
    if (editingDate === date) exitEditMode();
    save();
    renderList();
  };

  function exitEditMode() {
    editingDate = null;
    dateEl.valueAsDate = new Date();
    weightEl.value = '';
    logBtn.textContent = 'Log';
    document.querySelectorAll('.entry-row[data-editing="true"]')
      .forEach(r => r.removeAttribute('data-editing'));
  }

  window.exitEditMode = exitEditMode;

  function renderList() {
    const list = document.getElementById('entries');
    list.innerHTML = '';
    [...entries].reverse().forEach((entry) => {
      const row = document.createElement('div');
      row.className = 'entry-row';
      row.dataset.date = entry.date;
      if (editingDate === entry.date) row.setAttribute('data-editing', 'true');

      const dateSpan = document.createElement('span');
      dateSpan.textContent = entry.date;

      const weightSpan = document.createElement('span');
      weightSpan.textContent = `${entry.weight} lbs`;

      const actions = document.createElement('span');
      actions.className = 'entry-actions';

      const editBtn = document.createElement('button');
      editBtn.textContent = '✏️';
      editBtn.title = 'Edit this entry';
      editBtn.addEventListener('click', () => startEdit(entry.date));

      const delBtn = document.createElement('button');
      delBtn.textContent = '🗑️';
      delBtn.title = 'Delete this entry';
      delBtn.addEventListener('click', () => deleteEntry(entry.date));

      const actions = document.createElement('span');
      actions.className = 'entry-actions';
      actions.append(weightSpan, editBtn, delBtn);
      row.append(dateSpan, actions);
      list.append(row);
    });
  }

  window.renderList = renderList;
  renderList();
}
