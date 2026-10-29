import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { JSDOM } from 'jsdom';

const source = readFileSync(new URL('../extension/engine.js', import.meta.url), 'utf8');
const field = (label, inner = '<input>') => `<div data-form-field-i18n-name="${label}"><label>${label}</label>${inner}</div>`;
const section = (label, inner) => `<div class="applyFormModuleWrapper-windows"><p class="applyFormModuleWrapper-text">${label}</p><div class="records">${inner}</div></div>`;
const record = (label, name = '', description = '') => `<div class="apply-form-array-card__live">${field(label, `<input value="${name}">`)}${field('描述', `<textarea>${description}</textarea>`)}</div>`;
const award = () => `<div class="apply-form-array-card__live">${field('获奖名称')}${field('获奖时间', '<div class="ud__picker"><input readonly placeholder="YYYY"></div>')}${field('描述', '<textarea></textarea>')}${field('获奖附件', '<input type="file">')}</div>`;
const profile = () => ({ basic: {}, education: [],
  internship: [{ company: '公司甲', description: '财务实习甲正文' }, { company: '公司乙', description: '财务实习乙正文' }],
  project: [{ name: '项目甲', description: '财务项目甲正文' }, { name: '项目乙', description: '财务项目乙正文' }],
  modules: [{ id: 'custom_awards', label: '获奖经历', fields: [
    { id: 'field_name', label: '奖项名称' }, { id: 'field_year', label: '获奖年份' }, { id: 'field_description', label: '获奖说明' }
  ], entries: [{ field_name: '测试奖项甲', field_year: '2024-10', field_description: '甲获奖说明' }, { field_name: '测试奖项乙', field_year: '2025-05', field_description: '乙获奖说明' }] }]
});
function setup(t, html, url = 'https://anker-in.jobs.feishu.cn/campushirecn/resume/test/apply') {
  const dom = new JSDOM(html, { url, runScripts: 'outside-only' });
  dom.window.HTMLElement.prototype.getClientRects = () => [{}];
  dom.window.eval(source); t.after(() => dom.window.close());
  return { api: dom.window.ApplyAssistant, document: dom.window.document, window: dom.window };
}

test('Feishu plain descriptions follow named internship/project identities before assigning blank cards', async t => {
  const { api, document } = setup(t,
    section('实习经历', record('公司名称') + record('公司名称', '公司甲')) +
    section('项目经历', record('项目名称', '项目乙') + record('项目名称', '项目甲')));
  const rows = api.plan(profile()).rows;
  assert.deepEqual(Array.from(rows.filter(row => row.key === 'description'), row => [row.group, row.entry, row.value]), [
    ['internship', 1, '财务实习乙正文'], ['internship', 0, '财务实习甲正文'],
    ['project', 1, '财务项目乙正文'], ['project', 0, '财务项目甲正文']
  ]);
  assert.ok((await api.fill(rows.filter(row => !row.reason))).every(row => row.ok));
  assert.deepEqual([...document.querySelectorAll('textarea')].map(el => el.value), ['财务实习乙正文', '财务实习甲正文', '财务项目乙正文', '财务项目甲正文']);
});

test('Feishu existing descriptions require explicit template update and support undo', async t => {
  const { api, document } = setup(t, section('实习经历', record('公司名称', '公司甲', '网页旧正文')));
  const rows = api.plan(profile()).rows.filter(row => row.canReplace);
  assert.equal(rows.length, 1);
  assert.equal((await api.fill(rows))[0].ok, false);
  assert.equal(document.querySelector('textarea').value, '网页旧正文');
  assert.equal((await api.replace(rows))[0].ok, true);
  assert.equal(document.querySelector('textarea').value, '财务实习甲正文');
  assert.equal(api.undo().restored, 1);
  assert.equal(document.querySelector('textarea').value, '网页旧正文');
});

test('Feishu unknown and duplicate identities never receive another experience description', t => {
  for (const duplicate of [false, true]) {
    const { api } = setup(t, section('项目经历', record('项目名称', duplicate ? '项目甲' : '未知项目')));
    const data = profile(); if (duplicate) data.project.push({ ...data.project[0] });
    assert.ok(api.plan(data).rows.every(row => row.reason));
  }
});

test('Feishu blank description filling rejects an identity edited after preview', async t => {
  const { api, document } = setup(t, section('实习经历', record('公司名称', '公司甲')));
  const row = api.plan(profile()).rows.find(row => row.key === 'description');
  document.querySelector('input').value = '公司乙';
  const result = (await api.fill([row]))[0];
  assert.equal(result.ok, false); assert.match(result.reason, /经历已变化/);
  assert.equal(document.querySelector('textarea').value, '');
});

test('plain descriptions outside known Feishu experience sections are not guessed', t => {
  const { api } = setup(t, section('其他资料', field('描述', '<textarea></textarea>')) + section('家庭成员', field('描述', '<textarea></textarea>')) + field('描述', '<textarea></textarea>'));
  assert.ok(api.plan(profile()).rows.every(row => !row.key && row.reason));
  const other = setup(t, section('项目经历', record('项目名称', '项目甲')), 'https://example.com/form');
  const descriptions = other.api.plan(profile()).rows.filter(row => row.label === '描述');
  assert.ok(descriptions.length > 0);
  assert.ok(descriptions.every(row => row.key === 'description' && !row.reason));
});

test('Feishu awards map the short section title and reduce valid months to years without changing source data', t => {
  for (const date of ['2024-10', '2024', '2024-13', '2024-1', 'unknown', '']) {
    const { api } = setup(t, section('获奖', award()));
    const data = profile(); data.modules[0].entries[0].field_year = date;
    const before = JSON.stringify(data);
    const rows = api.plan(data).rows;
    assert.equal(rows.length, 3);
    const year = rows.find(row => row.key === 'field_year');
    assert.equal(year.group, 'custom_awards');
    if (['2024-10', '2024'].includes(date)) { assert.equal(year.value, '2024'); assert.equal(year.reason, ''); assert.equal(year.choice, true); }
    else { assert.ok(year.reason); assert.equal(year.value, ''); }
    assert.equal(rows.find(row => row.key === 'field_description').value, '甲获奖说明');
    assert.equal(JSON.stringify(data), before);
  }
});

test('Feishu awards add only missing cards and preserve upload, consent and submit controls', async t => {
  const { api, document } = setup(t, section('获奖', award() + '<button type="button" id="add">添加</button>') + '<button id="submit">提交</button><input type="checkbox">');
  let added = 0, submitted = 0;
  document.querySelector('#add').onclick = () => { added++; document.querySelector('#add').insertAdjacentHTML('beforebegin', award()); };
  document.querySelector('#submit').onclick = () => submitted++;
  const data = profile();
  const result = await api.prepare(data);
  assert.equal(result.results.find(row => row.group === 'custom_awards')?.reason, '');
  assert.equal(added, 1);
  const rows = api.plan(data).rows.filter(row => !row.reason && !row.choice);
  assert.equal(rows.length, 4);
  assert.ok((await api.fill(rows)).every(row => row.ok));
  await api.prepare(data); assert.equal(added, 1);
  assert.deepEqual([...document.querySelectorAll('textarea')].map(el => el.value), ['甲获奖说明', '乙获奖说明']);
  assert.equal(submitted, 0); assert.equal(document.querySelector('input[type=checkbox]').checked, false);
  assert.ok([...document.querySelectorAll('input[type=file]')].every(el => !el.value));
});

function bindYear(document, { initial = 2020, mode = 'commit', mutate } = {}) {
  const input = document.querySelector('input[placeholder=YYYY]');
  let selected = 0, navigated = 0;
  input.onclick = () => {
    const popup = document.createElement('div'); popup.className = 'ud__picker-date-panel'; document.body.append(popup);
    let start = initial;
    const render = () => {
      popup.innerHTML = '<button><span data-icon="LeftBoldOutlined"></span></button><button><span data-icon="RightBoldOutlined"></span></button>';
      [...popup.querySelectorAll('button')].forEach((button, index) => button.onclick = () => {
        navigated++; if (mode !== 'noop') { start += index ? 10 : -10; render(); } mutate?.();
      });
      const years = Array.from({ length: 10 }, (_, index) => start + index).filter(year => !(mode === 'missing' && year === 2024));
      if (mode === 'duplicate') years.push(2024);
      for (const year of years) {
        const cell = document.createElement('div');
        cell.innerHTML = `<a class="ud__picker__cell-interactive-area">${year}</a>`;
        if (mode === 'disabled' && year === 2024) cell.setAttribute('aria-disabled', 'true');
        cell.firstChild.onclick = () => {
          selected++; if (mode === 'uncommitted') return;
          input.value = String(year); if (mode !== 'open') popup.remove();
        };
        popup.append(cell);
      }
    };
    render();
  };
  input.onkeydown = event => { if (event.key === 'Escape') document.querySelector('.ud__picker-date-panel')?.remove(); };
  return { input, get selected() { return selected; }, get navigated() { return navigated; } };
}

test('Feishu year calendars select directly or navigate decade pages in either direction', async t => {
  for (const initial of [2020, 2000, 2040]) {
    const { api, document } = setup(t, section('获奖', award()));
    const binding = bindYear(document, { initial });
    const row = api.plan(profile()).rows.find(row => row.key === 'field_year');
    const result = (await api.fill([row]))[0];
    assert.equal(result.ok, true, JSON.stringify(result)); assert.equal(binding.input.value, '2024');
    assert.equal(binding.selected, 1); assert.equal(binding.navigated, initial === 2020 ? 0 : 2);
  }
});

test('Feishu year calendars reject missing, disabled, duplicate and unconfirmed years or stuck navigation', async t => {
  for (const mode of ['missing', 'disabled', 'duplicate', 'uncommitted', 'open', 'noop']) {
    const { api, document } = setup(t, section('获奖', award()));
    const binding = bindYear(document, { mode, initial: mode === 'noop' ? 2030 : 2020 });
    const row = api.plan(profile()).rows.find(row => row.key === 'field_year');
    assert.equal((await api.fill([row]))[0].ok, false, mode);
    assert.equal(binding.selected, ['uncommitted', 'open'].includes(mode) ? 1 : 0);
  }
});

test('Feishu year filling stops on route change or stop and preserves existing dates', async t => {
  for (const mode of ['route', 'stop', 'existing']) {
    const { api, document, window } = setup(t, section('获奖', award()));
    const binding = bindYear(document, { initial: 2030, mutate: () => {
      if (mode === 'route') window.history.pushState({}, '', '#changed');
      if (mode === 'stop') api.stop();
    } });
    if (mode === 'existing') binding.input.value = '2023';
    const row = api.plan(profile()).rows.find(row => row.key === 'field_year');
    assert.equal((await api.fill([row]))[0].ok, false); assert.equal(binding.selected, 0);
    if (mode === 'existing') { assert.equal(binding.input.value, '2023'); assert.equal(binding.navigated, 0); }
  }
});
