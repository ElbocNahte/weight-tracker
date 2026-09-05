// ---------- Shared data layer ----------
const KEY = 'weightEntries';
const GOAL_KEY = 'weightGoal';

let entries = JSON.parse(localStorage.getItem(KEY) || '[]');
let editingDate = null;

function save() {
  localStorage.setItem(KEY, JSON.stringify(entries));
}

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
      weeks.push({
        label: `${start.getMonth() + 1}/${start.getDate()}`,
        value: +avg.toFixed(1)
      });
    }
  }
  return weeks;
}

// Route to the right page initializer
if (document.getElementById('chart')) initDashboard();
if (document.getElementById('entries')) initLogPage();

if ('serviceWorker' in navigator) {
  navigator.serviceWorker.register('./sw.js')
    .catch(err => console.warn('SW registration failed:', err));
}

// ---------- Dashboard page (index.html) ----------
function initDashboard() {
  let chart = null;

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
    const diff = (cur - start).toFixed(1);
    document.getElementById('change').textContent =
      (diff <= 0 ? '' : '+') + diff + ' lbs';

    // Goal progress
    const goal = parseFloat(goalInput.value);
    const fill = document.getElementById('progressFill');
    const label = document.getElementById('progressLabel');
    if (goal && start !== goal) {
      const total = Math.abs(start - goal);
      const done = Math.max(0, Math.min(total, Math.abs(start - cur)));
      const pct = (done / total) * 100;
      const movingRight =
        (goal < start && cur <= start) || (goal > start && cur >= start);
      const realPct = movingRight ? pct : 0;
      fill.style.width = realPct + '%';
      label.textContent =
        `${realPct.toFixed(0)}% · ${Math.abs(cur - goal).toFixed(1)} lbs to go`;
    } else {
      fill.style.width = '0%';
      label.textContent = '';
    }
  }

  function renderChart() {
    const ctx = document.getElementById('chart');
    if (chart) { chart.destroy(); chart = null; }

    const weeks = weeklyAverages();
    let labels, data;

    if (weeks.length) {
      labels = weeks.map(w => w.label);
      data = weeks.map(w => w.value);
    } else if (entries.length) {
      labels = entries.map(x => x.date.slice(5));
      data = entries.map(x => x.weight);
    } else {
      return;
    }

    chart = new Chart(ctx, {
      type: 'line',
      data: {
        labels,
        datasets: [{
          label: 'Weight (lbs)',
          data,
          borderColor: '#6d4aff',
          backgroundColor: 'rgba(109,74,255,0.1)',
          fill: true,
          tension: 0.3,
          pointRadius: 3
        }]
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        plugins: { legend: { display: false } },
        scales: { y: { beginAtZero: false } }
      }
    });
  }

  renderStats();
  renderChart();
}

// ---------- Log page (log.html) ----------
function initLogPage() {
  const form = document.getElementById('form');
  const dateEl = document.getElementById('date');
  const weightEl = document.getElementById('weight');
  const logBtn = document.getElementById('logBtn');

  dateEl.valueAsDate = new Date();

  // Log / Update
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

  function startEdit(date) {
    const entry = entries.find(x => x.date === date);
    if (!entry) return;
    editingDate = date;
    dateEl.value = entry.date;
    weightEl.value = entry.weight;
    logBtn.textContent = 'Update';
    document.querySelectorAll('.entry-row').forEach(r => {
      if (r.dataset.date === date) {
        r.setAttribute('data-editing', 'true');
      } else {
        r.removeAttribute('data-editing');
      }
    });
    weightEl.focus();
  }

  function deleteEntry(date) {
    if (!confirm(`Delete the log entry for ${date}?`)) return;
    entries = entries.filter(x => x.date !== date);
    if (editingDate === date) exitEditMode();
    save();
    renderList();
  }

  function exitEditMode() {
    editingDate = null;
    dateEl.valueAsDate = new Date();
    weightEl.value = '';
    logBtn.textContent = 'Log';
    document.querySelectorAll('.entry-row[data-editing="true"]')
      .forEach(r => r.removeAttribute('data-editing'));
  }

  // Export
  document.getElementById('exportBtn').addEventListener('click', () => {
    const blob = new Blob([JSON.stringify(entries, null, 2)], { type: 'application/json' });
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = 'weight-data.json';
    a.click();
  });

  // Import
  document.getElementById('importBtn').addEventListener('click', () =>
    document.getElementById('importFile').click());

  document.getElementById('importFile').addEventListener('change', e => {
    const file = e.target.files[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => {
      try {
        const imported = JSON.parse(reader.result);
        if (!Array.isArray(imported)) throw new Error('bad format');
        const byDate = new Map(entries.map(x => [x.date, x]));
        imported.forEach(x => {
          if (x.date && typeof x.weight === 'number')
            byDate.set(x.date, { date: x.date, weight: x.weight });
        });
        entries = [...byDate.values()].sort((a, b) => a.date.localeCompare(b.date));
        save();
        renderList();
      } catch { alert('Could not read that file.'); }
    };
    reader.readAsText(file);
    e.target.value = '';
  });

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

      const actions = document.createElement('span');
      actions.className = 'entry-actions';

      const weightSpan = document.createElement('span');
      weightSpan.textContent = `${entry.weight} lbs`;

      const editBtn = document.createElement('button');
      editBtn.textContent = '✏️';
      editBtn.className = 'icon-btn';
      editBtn.title = 'Edit this entry';
      editBtn.addEventListener('click', () => startEdit(entry.date));

      const delBtn = document.createElement('button');
      delBtn.textContent = '🗑️';
      delBtn.className = 'icon-btn';
      delBtn.title = 'Delete this entry';
      delBtn.addEventListener('click', () => deleteEntry(entry.date));

      actions.append(weightSpan, editBtn, delBtn);
      row.append(dateSpan, actions);
      list.append(row);
    });
  }

  renderList();
}
