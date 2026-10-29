import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { JSDOM } from 'jsdom';

const html = readFileSync(new URL('./fixtures/moka-manbang-live.html', import.meta.url), 'utf8');
const source = readFileSync(new URL('../extension/engine.js', import.meta.url), 'utf8');
const profile = { basic: {}, education: [{ school: '测试大学', major: '会计学', start: '2021-09', end: '2025-06' }], internship: [], project: [], modules: [] };

function setup() {
  const dom = new JSDOM(html, { url: 'https://app.mokahr.com/campus-recruitment/test/1#/candidateHome/resume', runScripts: 'outside-only' });
  const { window } = dom;
  window.HTMLElement.prototype.getClientRects = () => [{ width: 100, height: 30 }];
  window.eval(source);
  const section = [...window.document.querySelectorAll('[class*="apply-block-"]')].find(node => node.firstElementChild.textContent.replace(/添加/g, '').trim() === '教育背景');
  const field = name => [...section.querySelectorAll('[class*="apply-field-"]')].find(node => node.firstElementChild.textContent === name);
  return { window, document: window.document, api: window.ApplyAssistant, field };
}

function bind(input, names, { delay = 0, search = false, commit = true, date = false } = {}) {
  const document = input.ownerDocument, dropdown = input.closest('[class*="sd-Dropdown-container-"]');
  const display = dropdown.querySelector('[class*="sd-Input-display-value-"]');
  let clicked = 0, queried = 0, changed = 0, timer;
  const populate = () => {
    dropdown.querySelector('[class*="sd-Select-menu-"]')?.remove();
    const menu = document.createElement('div'); menu.className = 'sd-Select-menu-test';
    for (const name of names) {
      const option = document.createElement('div');
      option.className = date ? 'sd-Menu-container-test' : 'sd-Select-common-item-test';
      const label = document.createElement('span'); label.dataset.key = 'sugar.select.label'; label.textContent = name;
      option.append(label); option.onclick = () => { clicked++; if (commit) { display.textContent = name; input.value = ''; menu.remove(); } };
      menu.append(option);
    }
    dropdown.append(menu);
  };
  input.onclick = () => {
    if (!search) populate();
    else { const menu = document.createElement('div'); menu.className = 'sd-Select-menu-test'; menu.textContent = '暂无选项'; dropdown.append(menu); }
  };
  input.addEventListener('change', () => changed++);
  input.addEventListener('input', () => { queried++; clearTimeout(timer); if (input.value && search) timer = setTimeout(populate, delay); });
  return { get clicked() { return clicked; }, get queried() { return queried; }, get changed() { return changed; }, display };
}

test('Moka school search waits through empty menu and selects exact delayed result, not query text', async () => {
  const { api, field } = setup(), input = field('学校名称').querySelector('input');
  const binding = bind(input, ['测试大学分校', '测试大学', '其他大学'], { search: true, delay: 180 });
  const row = api.plan(profile).rows.find(row => row.group === 'education' && row.key === 'school');
  const results = await api.fill([row]);
  assert.equal(results[0].ok, true); assert.equal(binding.clicked, 1); assert.equal(binding.queried, 1); assert.equal(binding.changed, 0);
  assert.equal(binding.display.textContent, '测试大学'); assert.equal(input.value, '');
  const again = api.plan(profile).rows.find(row => row.group === 'education' && row.key === 'school');
  assert.match(again.reason, /已有内容/);
});

test('Moka school lookup does not accept unmatched, duplicate or uncommitted query values', async () => {
  for (const [names, commit, expected] of [[['其他大学'], true, /未找到/], [['测试大学', '测试大学'], true, /不唯一/], [['测试大学'], false, /未确认/]]) {
    const { api, field, window } = setup(), input = field('学校名称').querySelector('input');
    const binding = bind(input, names, { search: true, delay: 20, commit });
    const row = api.plan(profile).rows.find(row => row.group === 'education' && row.key === 'school');
    const result = await api.fill([row]);
    assert.equal(result[0].ok, false); assert.match(result[0].reason, expected); assert.equal(input.value, ''); assert.equal(binding.display.textContent, '');
    assert.equal(binding.clicked, commit ? 0 : 1); window.close();
  }
});

test('Moka search preserves selected value and unfinished user query', async () => {
  for (const mode of ['selected', 'query']) {
    const { api, field } = setup(), input = field('学校名称').querySelector('input');
    const binding = bind(input, ['测试大学'], { search: true });
    if (mode === 'selected') binding.display.textContent = '原学校'; else input.value = '用户搜索';
    const row = api.plan(profile).rows.find(row => row.group === 'education' && row.key === 'school');
    const result = await api.fill([row]);
    assert.equal(result[0].ok, false); assert.equal(binding.clicked, 0); assert.equal(binding.queried, 0);
    assert.equal(mode === 'selected' ? binding.display.textContent : input.value, mode === 'selected' ? '原学校' : '用户搜索');
  }
});

test('Moka delayed lookup stops on cancellation, route changes and concurrent user input', async () => {
  for (const action of ['stop', 'route', 'input', 'label']) {
    const { api, field, window } = setup(), school = field('学校名称'), input = school.querySelector('input');
    const binding = bind(input, ['测试大学'], { search: true, delay: 150 });
    const row = api.plan(profile).rows.find(row => row.group === 'education' && row.key === 'school');
    setTimeout(() => {
      if (action === 'stop') api.stop();
      if (action === 'route') window.history.pushState({}, '', '#/other');
      if (action === 'input') input.value = '用户的新搜索';
      if (action === 'label') school.firstElementChild.textContent = '其他字段';
    }, 30);
    const result = await api.fill([row]);
    assert.equal(result[0].ok, false); assert.equal(binding.clicked, 0);
    if (action === 'input') assert.equal(input.value, '用户的新搜索');
    window.close();
  }
});

test('Moka four date dropdowns map year/month independently and click actual menu labels', async () => {
  const { api, field } = setup(), inputs = [...field('就读时间').querySelectorAll('input')];
  const bindings = inputs.map((input, index) => bind(input, index % 2 ? ['1月', '06月', '9月', '12月'] : ['2021', '2025', '2026'], { date: true }));
  const rows = api.plan(profile).rows.filter(row => row.group === 'education' && ['start', 'end'].includes(row.key));
  assert.deepEqual(Array.from(rows, row => [row.key, row.part, row.value, row.reason]), [['start', 'year', '2021', ''], ['start', 'month', '9', ''], ['end', 'year', '2025', ''], ['end', 'month', '6', '']]);
  const results = await api.fill(rows); assert.ok(results.every(row => row.ok));
  assert.deepEqual(bindings.map(binding => binding.display.textContent), ['2021', '9月', '2025', '06月']);
  assert.ok(bindings.every(binding => binding.queried === 0 && binding.clicked === 1));
});

test('Moka preserves partially entered date when its existing year disagrees with template', async () => {
  const { api, field } = setup(), inputs = [...field('就读时间').querySelectorAll('input')];
  const bindings = inputs.map(input => bind(input, ['2021', '9'], { date: true }));
  bindings[0].display.textContent = '2020';
  const rows = api.plan(profile).rows.filter(row => row.group === 'education' && row.key === 'start');
  assert.ok(rows.every(row => row.reason));
  const result = await api.fill(rows); assert.ok(result.every(row => !row.ok));
  assert.equal(bindings[1].clicked, 0); assert.equal(bindings[0].display.textContent, '2020');
});

test('Moka same-run January default is replaced by the planned month after year selection clears placeholders', async () => {
  const { api, field } = setup(), inputs = [...field('就读时间').querySelectorAll('input')];
  const bindings = inputs.map((input, index) => bind(input, index % 2 ? ['1', '9'] : ['2021'], { date: true }));
  const originalClick = inputs[0].onclick;
  inputs[0].onclick = () => {
    originalClick();
    const option = inputs[0].closest('[class*="sd-Dropdown-container-"]').querySelector('[data-key="sugar.select.label"]').parentElement;
    const commit = option.onclick;
    option.onclick = () => { commit(); inputs[0].placeholder = ''; inputs[1].placeholder = ''; bindings[1].display.textContent = '1'; };
  };
  const rows = api.plan(profile).rows.filter(row => row.group === 'education' && row.key === 'start');
  const results = await api.fill(rows);
  assert.ok(results.every(row => row.ok), JSON.stringify(results));
  assert.equal(bindings[0].display.textContent, '2021'); assert.equal(bindings[1].display.textContent, '9');
  assert.ok(api.plan(profile).rows.filter(row => row.group === 'education' && row.key === 'start').every(row => /已有内容/.test(row.reason)));
});

test('captured Kingdee year menu selects a label without school-style option wrappers', async () => {
  const captured = readFileSync(new URL('./fixtures/moka-kingdee-education-live.html', import.meta.url), 'utf8');
  const dom = new JSDOM(captured, { url: 'https://app.mokahr.com/campus-recruitment/kingdeehr/166565#/candidateHome/resume', runScripts: 'outside-only' });
  const { window } = dom;
  window.HTMLElement.prototype.getClientRects = () => [{ width: 100, height: 30 }]; window.eval(source);
  const input = window.document.querySelector('input[placeholder="年"]');
  const display = input.closest('[class*="sd-Select-container-"]').querySelector('[class*="sd-Input-display-value-"]');
  const option = [...window.document.querySelectorAll('[data-key="sugar.select.label"]')].find(node => node.textContent === '2025');
  let selected = 0;
  option.parentElement.onclick = () => { selected++; display.textContent = '2025'; option.closest('[class*="sd-Select-menu-"]').remove(); };
  const candidate = { ...profile, education: [{ school: '北京语言大学', start: '2025-09' }] };
  const row = window.ApplyAssistant.plan(candidate).rows.find(row => row.key === 'start' && row.part === 'year');
  assert.equal(row.reason, ''); assert.equal(row.value, '2025');
  const result = await window.ApplyAssistant.fill([row]);
  assert.equal(result[0].ok, true); assert.equal(selected, 1); assert.equal(display.textContent, '2025'); window.close();
});
