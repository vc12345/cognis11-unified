/* ── COGNIS 11+ · PROGRESS TRACKER ── */

const TYPES = [
  { code:'A1',  name:'Start Unknown',            domain:'A', slug:'a1-start-unknown' },
  { code:'A2',  name:'Direct Operation',          domain:'A', slug:'a2-direct-operation' },
  { code:'A3',  name:'Two-Step Sequential',       domain:'A', slug:'a3-two-step' },
  { code:'A4',  name:'Hidden Comparison',         domain:'A', slug:'a4-hidden-comparison' },
  { code:'A5',  name:'Ratio and Scaling',         domain:'A', slug:'a5-ratio-scaling' },
  { code:'A6',  name:'Simultaneous Constraint',   domain:'A', slug:'a6-simultaneous-constraint' },
  { code:'A7',  name:'Multi-Step with Distractor',domain:'A', slug:'a7-multi-step-distractor' },
  { code:'A8',  name:'Rate and Speed',            domain:'A', slug:'a8-rate-speed' },
  { code:'A9',  name:'Fraction of a Quantity',    domain:'A', slug:'a9-fraction-quantity' },
  { code:'A10', name:'Missing Operator',          domain:'A', slug:'a10-missing-operator' },
  { code:'A11', name:'Sharing and Division',      domain:'A', slug:'a11-sharing-division' },
  { code:'A12', name:'Change Over Time',          domain:'A', slug:'a12-change-over-time' },
  { code:'A13', name:'Perimeter and Area',        domain:'A', slug:'a13-perimeter-area' },
  { code:'A14', name:'Money and Change',          domain:'A', slug:'a14-money-change' },
  { code:'A15', name:'Age Problems',              domain:'A', slug:'a15-age-problems' },
  { code:'A16', name:'Capacity and Measurement',  domain:'A', slug:'a16-capacity-measurement' },
  { code:'A17', name:'Probability',               domain:'A', slug:'a17-probability' },
  { code:'A18', name:'Number Series',             domain:'A', slug:'a18-number-series' },
  { code:'B1',  name:'Synonyms',                  domain:'B', slug:'b1-synonyms' },
  { code:'B2',  name:'Antonyms',                  domain:'B', slug:'b2-antonyms' },
  { code:'B3',  name:'Word Analogies',            domain:'B', slug:'b3-word-analogies' },
  { code:'B4',  name:'Word Association',          domain:'B', slug:'b4-word-association' },
  { code:'B5',  name:'Hidden Words',              domain:'B', slug:'b5-hidden-words' },
  { code:'B6',  name:'Letter Series',             domain:'B', slug:'b6-letter-series' },
  { code:'B7',  name:'Number Series (Verbal)',    domain:'B', slug:'b7-number-series-verbal' },
  { code:'B8',  name:'Letter Codes',              domain:'B', slug:'b8-letter-codes' },
  { code:'B9',  name:'Number Codes',              domain:'B', slug:'b9-number-codes' },
  { code:'B10', name:'Missing Letters',           domain:'B', slug:'b10-missing-letters' },
  { code:'B11', name:'Word Building',             domain:'B', slug:'b11-word-building' },
  { code:'B12', name:'Move a Letter',             domain:'B', slug:'b12-move-letter' },
  { code:'B13', name:'Change a Letter',           domain:'B', slug:'b13-change-letter' },
  { code:'B14', name:'Shuffled Sentences',        domain:'B', slug:'b14-shuffled-sentences' },
  { code:'B15', name:'Cloze / Reading Gap',       domain:'B', slug:'b15-cloze' },
  { code:'B16', name:'Verbal Classification',     domain:'B', slug:'b16-verbal-classification' },
  { code:'B17', name:'Proverbs and Expressions',  domain:'B', slug:'b17-proverbs' },
  { code:'B18', name:'Related Numbers',           domain:'B', slug:'b18-related-numbers' },
  { code:'B19', name:'Word-Number Codes',         domain:'B', slug:'b19-word-number-codes' },
  { code:'B20', name:'Logical Deduction',         domain:'B', slug:'b20-logical-deduction' },
  { code:'C1',  name:'Matrix Completion',         domain:'C', slug:'c1-matrix-completion' },
  { code:'C2',  name:'Series Completion',         domain:'C', slug:'c2-series-completion' },
  { code:'C3',  name:'Odd One Out',               domain:'C', slug:'c3-odd-one-out' },
  { code:'C4',  name:'Analogies',                 domain:'C', slug:'c4-analogies' },
  { code:'C5',  name:'Rotation',                  domain:'C', slug:'c5-rotation' },
  { code:'C6',  name:'Reflection',                domain:'C', slug:'c6-reflection' },
  { code:'C7',  name:'Nets and Folding',          domain:'C', slug:'c7-nets-folding' },
  { code:'C8',  name:'Hidden Figures',            domain:'C', slug:'c8-hidden-figures' },
  { code:'C9',  name:'Cubes and 3D Reasoning',    domain:'C', slug:'c9-cubes-3d' },
  { code:'C10', name:'Codes',                     domain:'C', slug:'c10-codes' },
  { code:'C11', name:'Spatial Combinations',      domain:'C', slug:'c11-spatial-combinations' },
  { code:'C12', name:'Pattern Completion',        domain:'C', slug:'c12-pattern-completion' },
  { code:'C13', name:'Connection Pairs',          domain:'C', slug:'c13-connection-pairs' },
  { code:'C14', name:'Paper Folding',             domain:'C', slug:'c14-paper-folding' },
];

const DOMAINS = [
  { key:'A', label:'Domain A · Numerical Word Problems' },
  { key:'B', label:'Domain B · Verbal Reasoning' },
  { key:'C', label:'Domain C · Non-Verbal Reasoning' },
];

/* ── MARK DONE (toggle) ── */
function markDone(code) {
  const isDone = localStorage.getItem('done_' + code) === 'true';
  if (isDone) {
    localStorage.removeItem('done_' + code);
    _setDoneUI(false);
  } else {
    localStorage.setItem('done_' + code, 'true');
    _setDoneUI(true);
  }
}

function _setDoneUI(done) {
  const btn    = document.getElementById('doneBtn');
  const banner = document.getElementById('doneBanner');
  if (!btn) return;
  btn.textContent = done ? '✓ Marked done' : 'Mark as done';
  btn.classList.toggle('done', done);
  if (banner) banner.classList.toggle('show', done);
}

/* Call this on every content page to restore saved state */
function restoreDoneState(code) {
  _setDoneUI(localStorage.getItem('done_' + code) === 'true');
}

/* ── RENDER INDEX PAGE ── */
function renderIndex() {
  const container = document.getElementById('typeGrid');
  if (!container) return;

  const done = TYPES.filter(t => localStorage.getItem('done_' + t.code) === 'true').length;
  const pct  = Math.round((done / TYPES.length) * 100);

  const fill  = document.getElementById('progressFill');
  const label = document.getElementById('progressLabel');
  if (fill)  fill.style.width = pct + '%';
  if (label) label.textContent = done + ' of ' + TYPES.length + ' question types completed';

  DOMAINS.forEach(function(domain) {
    const section = document.createElement('div');
    section.className = 'domain-section';

    const title = document.createElement('div');
    title.className = 'domain-title';
    title.textContent = domain.label;
    section.appendChild(title);

    const grid = document.createElement('div');
    grid.className = 'type-grid';

    TYPES.filter(function(t) { return t.domain === domain.key; }).forEach(function(t) {
      const isDone = localStorage.getItem('done_' + t.code) === 'true';
      const card   = document.createElement('a');
      card.href      = '/members/' + t.slug + '.html';
      card.className = 'type-card' + (isDone ? ' done' : '');
      card.innerHTML =
        '<div class="type-badge">' + t.code + '</div>' +
        '<div class="type-name">'  + t.name + '</div>' +
        (isDone ? '<div class="type-tick">✓</div>' : '');
      grid.appendChild(card);
    });

    section.appendChild(grid);
    container.appendChild(section);
  });
}
