import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { JSDOM } from 'jsdom';

const code = readFileSync(new URL('../extension/engine.js', import.meta.url), 'utf8');
const field = (name, inner) => `<div class="atsx-form-item"><div class="atsx-form-item-label"><label>${name}</label></div><div class="atsx-form-item-control">${inner}</div></div>`;
const section = (name, inner) => `<section><h2>${name}</h2>${inner}</section>`;
const data = () => ({ basic: {}, education: [{ school: '测试大学' }], internship: [{ company: '测试公司', start: '2026-01', end: '2026-03' }], project: [], modules: [{ id: 'awards', label: '获奖经历', fields: [{ id: 'name', label: '奖项名称' }, { id: 'date', label: '获奖年月' }], entries: [{ name: '测试奖', date: '2024-10' }] }] });
const range = () => '<div class="atsx-date-picker atsx-date-picker-period-month"><div class="atsx-date-picker-period-month-label"></div><div class="atsx-date-picker-period-line"></div><div class="atsx-date-picker-period-month-label"></div><input class="atsx-date-picker-period-hidden-input"></div>';
const rangeForm = () => section('实习经历', field('公司名称', '<input value="测试公司">') + field('起止时间', range()));
const schoolForm = () => section('教育经历', field('学校名称', '<div class="atsx-select atsx-select-combobox"><div class="atsx-select-selection" role="combobox" aria-controls="school-options" aria-expanded="false"><input class="atsx-select-search__field"></div></div>'));
function setup(t, html) {
  const dom = new JSDOM(html, { url: 'https://micoworld.jobs.feishu.cn/152087/resume/test/apply', runScripts: 'outside-only' });
  dom.window.HTMLElement.prototype.getClientRects = () => [{}];
  dom.window.eval(code); t.after(() => dom.window.close());
  return { api: dom.window.ApplyAssistant, window: dom.window, document: dom.window.document };
}
function writeEndpoint(el, year = '', month = '') {
  const cls = 'atsx-date-picker-period-month-label-';
  el.innerHTML = year === '至今' ? `<span class="${cls}toToday">至今</span>` : `<span class="${cls}year">${year || 'YYYY'}</span><span class="${cls}separator">-</span><span class="${cls}month">${month || 'MM'}</span>`;
}
function bindRange(document, { existing = ['', ''], mode = '', afterYear } = {}) {
  const endpoints = [...document.querySelectorAll('.atsx-date-picker-period-month-label')];
  const values = existing.map(value => value ? value.split('-') : ['', '']);
  endpoints.forEach((el, index) => writeEndpoint(el, ...values[index]));
  let clicks = 0, popup;
  const open = index => {
    popup?.remove();
    popup = document.createElement('div'); popup.className = 'atsx-date-picker-period-month-panel';
    endpoints.forEach((el, i) => el.classList.toggle('atsx-date-picker-period-month-label-focus', i === index));
    document.body.append(popup);
    for (const [part, options] of [['year', ['2027', '2026', '2025', '2024', ...(index === 1 ? ['至今'] : [])]], ['month', ['01', '02', '03', '10']]]) {
      const list = document.createElement('div'); list.className = 'atsx-date-picker-period-month-panel-list'; popup.append(list);
      if (mode === 'duplicate' && part === 'year') options.push('2026');
      for (const option of options) {
        const item = document.createElement('div'); item.className = 'atsx-date-picker-period-month-panel-list-item'; item.textContent = option;
        if (mode === 'disabled' && option === '2026') item.classList.add('disabled');
        item.onclick = () => {
          clicks++;
          if (mode === 'no-year' && part === 'year') return;
          if (part === 'year') values[index][0] = option;
          else values[index][1] = option;
          writeEndpoint(endpoints[index], ...values[index]);
          if (part === 'year' && option !== '至今') afterYear?.();
          if (part === 'month' || option === '至今') {
            if (mode === 'unclosed') return;
            if (index === 0 && !values[1][0]) open(1);
            else { popup.remove(); endpoints[index].classList.remove('atsx-date-picker-period-month-label-focus'); }
          }
        };
        list.append(item);
      }
    }
  };
  endpoints.forEach((el, index) => el.onclick = () => open(index));
  return { endpoints, open, get clicks() { return clicks; } };
}

test('Mico non-input date labels map two endpoints and exclude the hidden keyboard input', async t => {
  const { api, document } = setup(t, rangeForm()); const binding = bindRange(document);
  const rows = api.plan(data()).rows;
  assert.deepEqual(Array.from(rows, row => [row.key, row.value]), [['company', '测试公司'], ['start', '2026-01'], ['end', '2026-03']]);
  const results = await api.fill(rows.filter(row => !row.reason));
  assert.ok(results.every(row => row.ok), JSON.stringify(results)); assert.equal(binding.clicks, 4);
  assert.deepEqual(Array.from(api.plan(data()).rows.filter(row => ['start', 'end'].includes(row.key)), row => row.current), ['2026-01', '2026-03']);
  assert.equal(document.querySelector('.atsx-date-picker-period-hidden-input').value, '');
});

test('Mico preserves an existing start date while filling the end, including present', async t => {
  for (const end of ['2026-03', '至今']) {
    const { api, document } = setup(t, rangeForm()); const binding = bindRange(document, { existing: ['2026-01', ''] });
    const profile = data(); profile.internship[0].end = end;
    const rows = api.plan(profile).rows.filter(row => !row.reason);
    assert.equal(rows.length, 1); assert.equal(rows[0].key, 'end');
    assert.equal((await api.fill(rows))[0].ok, true);
    assert.equal(binding.endpoints[0].textContent, '2026-01');
    assert.equal(api.plan(profile).rows.find(row => row.key === 'end').current, end);
  }
});

test('Mico rejects partial existing dates, invalid template values and foreign open popups', async t => {
  for (const mode of ['partial', 'invalid', 'open']) {
    const { api, document } = setup(t, rangeForm()); const binding = bindRange(document, { existing: mode === 'partial' ? ['2026-', ''] : ['', ''] });
    const profile = data(); if (mode === 'invalid') profile.internship[0].start = '2026-13';
    if (mode === 'open') binding.open(0);
    const row = api.plan(profile).rows.find(row => row.key === 'start');
    assert.equal((await api.fill([row]))[0].ok, false); assert.equal(binding.clicks, 0);
  }
});

test('Mico date transactions stop on duplicate, disabled, unconfirmed or concurrently changed fields', async t => {
  for (const mode of ['duplicate', 'disabled', 'no-year', 'unclosed', 'stop', 'route', 'identity', 'peer']) {
    const { api, document, window } = setup(t, rangeForm());
    const binding = bindRange(document, { mode, afterYear: () => {
      if (mode === 'stop') api.stop();
      if (mode === 'route') window.history.pushState({}, '', '#changed');
      if (mode === 'identity') document.querySelector('input').value = '其他公司';
      if (mode === 'peer') writeEndpoint(binding.endpoints[1], '2025', '10');
    } });
    const row = api.plan(data()).rows.find(row => row.key === 'start');
    assert.equal((await api.fill([row]))[0].ok, false, mode);
    assert.ok(binding.clicks <= (mode === 'unclosed' ? 2 : 1));
  }
});

function bindSchool(document, { mode = '', mutate } = {}) {
  const input = document.querySelector('input'), control = document.querySelector('[role=combobox]');
  let clicks = 0, popup;
  input.oninput = () => {
    popup?.remove(); if (!input.value) return;
    control.setAttribute('aria-expanded', 'true');
    popup = document.createElement('div'); popup.className = 'atsx-select-dropdown';
    popup.innerHTML = `<ul id="${mode === 'wrong-owner' ? 'other-options' : 'school-options'}" role="listbox"></ul>`;
    document.body.append(popup);
    setTimeout(() => {
      if (!popup.isConnected) return;
      for (const name of mode === 'duplicate' ? ['测试大学', '测试大学'] : ['测试大学继续教育学院', '测试大学']) {
        const option = document.createElement('li'); option.className = 'atsx-select-dropdown-menu-item'; option.textContent = name;
        if (mode === 'disabled' && name === '测试大学') option.classList.add('atsx-select-dropdown-menu-item-disabled');
        option.onclick = () => { clicks++; if (mode === 'uncommitted') return; input.value = name; control.setAttribute('aria-expanded', 'false'); popup.remove(); };
        popup.firstChild.append(option);
      }
      mutate?.();
    }, 120);
  };
  input.onkeydown = event => { if (event.key === 'Escape') popup?.remove(); };
  return { input, get clicks() { return clicks; } };
}

test('Mico school searches before waiting for a popup and confirms a unique candidate', async t => {
  for (const initial of ['', '测试大学']) {
    const { api, document } = setup(t, schoolForm()); const binding = bindSchool(document); binding.input.value = initial;
    const row = api.plan(data()).rows[0]; assert.equal(row.reason, ''); assert.equal(row.choice, true);
    assert.equal((await api.fill([row]))[0].ok, true); assert.equal(binding.clicks, 1); assert.equal(binding.input.value, '测试大学');
  }
});

test('Mico school preserves different names and refuses ambiguous or unconfirmed candidates', async t => {
  for (const mode of ['different', 'duplicate', 'disabled', 'uncommitted', 'wrong-owner', 'user-edit']) {
    const { api, document } = setup(t, schoolForm());
    const binding = bindSchool(document, { mode, mutate: () => { if (mode === 'user-edit') binding.input.value = '用户修改'; } });
    if (mode === 'different') binding.input.value = '其他大学';
    const row = api.plan(data()).rows[0];
    assert.equal((await api.fill([row]))[0].ok, false, mode);
    assert.equal(binding.input.value, mode === 'different' ? '其他大学' : mode === 'user-edit' ? '用户修改' : '');
    assert.equal(binding.clicks, mode === 'uncommitted' ? 1 : 0);
  }
});

test('Mico nine-year award calendar uses inner content clicks and nine-year navigation', async t => {
  for (const initial of [2018, 2027, 2009]) {
    const { api, document } = setup(t, section('获奖', field('获奖名称', '<input value="测试奖">') + field('获奖时间', '<div class="atsx-date-picker"><input placeholder="YYYY" readonly></div>')));
    const input = document.querySelector('input[placeholder]'); let clicks = 0;
    input.onclick = () => {
      const popup = document.createElement('div'); popup.className = 'atsx-date-picker-panel'; document.body.append(popup);
      let start = initial;
      const render = () => {
        popup.innerHTML = `<div class="atsx-date-picker-panel-header"><span data-cy="prev">prev</span><span>${start}-${start + 8}</span><span data-cy="next">next</span></div><div class="atsx-date-picker-panel-body-year"></div>`;
        popup.querySelector('[data-cy=prev]').onclick = () => { start -= 9; render(); };
        popup.querySelector('[data-cy=next]').onclick = () => { start += 9; render(); };
        for (let year = start; year <= start + 8; year++) {
          const cell = document.createElement('div'); cell.className = 'atsx-date-picker-panel-body-cell';
          cell.innerHTML = `<div class="atsx-date-picker-panel-body-cell-content" data-cy="${year}">${year}</div>`;
          cell.firstChild.onclick = () => { clicks++; input.value = String(year); popup.remove(); };
          popup.querySelector('.atsx-date-picker-panel-body-year').append(cell);
        }
      }; render();
    };
    const profile = data(), before = JSON.stringify(profile);
    const row = api.plan(profile).rows.find(row => row.key === 'date');
    assert.equal(row.value, '2024'); assert.equal(row.choice, true);
    assert.equal((await api.fill([row]))[0].ok, true); assert.equal(input.value, '2024'); assert.equal(clicks, 1);
    assert.equal(JSON.stringify(profile), before);
  }
});
