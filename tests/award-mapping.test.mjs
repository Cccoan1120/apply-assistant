import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { JSDOM } from 'jsdom';

const source = readFileSync(new URL('../extension/engine.js', import.meta.url), 'utf8');
const field = (label, inner = '<input>') => `<div class="apply-field-test"><div class="title-test">${label}</div>${inner}</div>`;
const select = (placeholder = '请选择', value = '') => `<div class="sd-Dropdown-container-test"><label class="sd-Select-container-test"><span class="sd-Input-display-value-test">${value}</span><input placeholder="${placeholder}"></label></div>`;
const details = () => field('获奖时间', select('年') + select('月')) + field('奖项名称');
const card = () => `<div class="record">${field('是否有获奖经历', select('请选择', '是'))}${details()}</div>`;
const section = (inner, title = '获奖经历') => `<section class="apply-block-test"><div class="blockTitle-test">${title}<button type="button">添加</button></div><div class="records">${inner}</div></section>`;
const profile = (dates = ['2024-11', '2025-06']) => ({ basic: {}, education: [], internship: [], project: [], modules: [{
  id: 'custom_awards', label: '获奖情况', fields: [
    { id: 'year', label: '获奖年份' }, { id: 'name', label: '奖项名称' }, { id: 'level', label: '奖项级别' }, { id: 'description', label: '获奖说明' }
  ], entries: dates.map((year, i) => ({ name: `测试奖项${i + 1}`, year, level: '校级', description: `说明${i + 1}` }))
}] });
function setup(t, html) {
  const dom = new JSDOM(html, { url: 'https://app.mokahr.com/campus-recruitment/test/1#/job/test/apply', runScripts: 'outside-only' });
  dom.window.HTMLElement.prototype.getClientRects = () => [{}];
  dom.window.eval(source); t.after(() => dom.window.close());
  return { api: dom.window.ApplyAssistant, document: dom.window.document };
}
function bindSelect(input, options, commit) {
  input.onclick = () => {
    const owner = input.closest('.sd-Dropdown-container-test');
    const menu = input.ownerDocument.createElement('div'); menu.className = 'sd-Select-menu-test';
    for (const label of options) {
      const option = input.ownerDocument.createElement('div'); option.className = 'sd-Select-common-item-test';
      option.innerHTML = `<div class="sd-Menu-container-test"><div>${label}</div></div>`;
      option.firstElementChild.onclick = () => {
        owner.querySelector('span').textContent = label; input.placeholder = ''; menu.remove(); commit?.(label);
      };
      menu.append(option);
    }
    owner.append(menu);
  };
}
function bindDates(document) {
  for (const record of document.querySelectorAll('.record')) {
    const year = record.querySelector('input[placeholder="年"]'), month = record.querySelector('input[placeholder="月"]');
    bindSelect(year, ['2024', '2025'], () => {
      if (!month.parentElement.querySelector('span').textContent) {
        month.parentElement.querySelector('span').textContent = '1'; month.placeholder = '';
      }
    });
    bindSelect(month, ['1', '6', '11']);
  }
}

test('award names anchor reordered custom fields and match separate year/month dropdowns', async t => {
  const { api, document } = setup(t, section(card() + card()));
  bindDates(document);
  const rows = api.plan(profile()).rows.filter(row => !row.reason);
  assert.deepEqual(Array.from(rows, row => [row.key, row.part, row.value]), [
    ['year', 'year', '2024'], ['year', 'month', '11'], ['name', '', '测试奖项1'],
    ['year', 'year', '2025'], ['year', 'month', '6'], ['name', '', '测试奖项2']
  ]);
  const results = await api.fill(rows);
  assert.ok(results.every(row => row.ok), JSON.stringify(results));
  assert.deepEqual([...document.querySelectorAll('.record')].map(record => [...record.querySelectorAll('.sd-Input-display-value-test')].map(el => el.textContent)), [['是', '2024', '11'], ['是', '2025', '6']]);
});

test('award gates expand existing and new records without extra additions on repeat', async t => {
  const { api, document } = setup(t, section('') + section(field('项目名称'), '项目经验') + '<button id="submit">预览并提交</button><input type="checkbox">');
  let adds = 0, submits = 0;
  document.querySelector('#submit').onclick = () => submits++;
  const create = () => {
    const record = document.createElement('div'); record.className = 'record';
    record.innerHTML = field('是否有获奖经历', select()); document.querySelector('.records').append(record);
    bindSelect(record.querySelector('input'), ['是', '否'], () => record.insertAdjacentHTML('beforeend', details()));
  };
  create(); create(); // A user may already have added empty, gated records.
  document.querySelector('button').onclick = () => { adds++; create(); };
  const data = profile(['2024', '2025', '']);
  const result = await api.prepare(data);
  assert.equal(result.results[0].reason, ''); assert.equal(result.results[0].added, 1);
  const rows = api.plan(data).rows.filter(row => !row.reason);
  assert.equal(rows.length, 3); assert.ok((await api.fill(rows)).every(row => row.ok));
  assert.deepEqual([...document.querySelectorAll('.record input:not([placeholder])')].map(el => el.value), ['测试奖项1', '测试奖项2', '测试奖项3']);
  await api.prepare(data); assert.equal(adds, 1);
  assert.equal(submits, 0); assert.equal(document.querySelector('input[type="checkbox"]').checked, false);
});

test('year-only and missing award dates never generate January or prevent name filling', async t => {
  const { api, document } = setup(t, section(card() + card()));
  let dateClicks = 0;
  for (const input of document.querySelectorAll('input[placeholder="年"],input[placeholder="月"]')) input.onclick = () => dateClicks++;
  const rows = api.plan(profile(['2024', ''])).rows;
  assert.ok(rows.filter(row => row.entry === 0 && row.part).every(row => /补充月份/.test(row.reason) && !row.value));
  assert.ok(rows.filter(row => row.entry === 1 && row.part).every(row => row.reason === '资料未填写'));
  assert.ok((await api.fill(rows.filter(row => !row.reason))).every(row => row.ok));
  assert.equal(dateClicks, 0);
  assert.equal(document.querySelector('.record input:not([placeholder])').value, '测试奖项1');
});

test('named award records take priority over blank records and keep existing dates', async t => {
  const { api, document } = setup(t, section(card() + card()));
  const records = document.querySelectorAll('.record');
  records[1].querySelector('input:not([placeholder])').value = '测试奖项1';
  records[1].querySelector('input[placeholder="年"]').parentElement.querySelector('span').textContent = '2023';
  const rows = api.plan(profile()).rows;
  assert.deepEqual(Array.from(rows.filter(row => row.key === 'name'), row => row.value), ['测试奖项2', '测试奖项1']);
  assert.ok(rows.filter(row => row.entry === 0 && row.part).every(row => row.reason));
  assert.match(rows.find(row => row.entry === 0 && row.part === 'month').reason, /已有日期/);
});

test('explicit no, empty templates and unnamed award entries cannot expand awards', async t => {
  for (const mode of ['no', 'empty', 'unnamed']) {
    const { api, document } = setup(t, section(`<div class="record">${field('是否有获奖经历', select('请选择', mode === 'no' ? '否' : ''))}</div>`));
    let clicks = 0; document.querySelector('button').onclick = () => clicks++; document.querySelector('input').onclick = () => clicks++;
    const data = profile();
    if (mode === 'empty') data.modules[0].entries = [];
    if (mode === 'unnamed') data.modules[0].entries.forEach(entry => { entry.name = ''; });
    const result = await api.prepare(data);
    if (mode === 'no') assert.match(result.results[0].reason, /经历开关/);
    else assert.equal(result.results.length, 0);
    assert.equal(clicks, 0);
  }
});

test('duplicate modules or name fields and unknown existing awards remain unresolved', async t => {
  for (const mode of ['modules', 'fields', 'unknown', 'duplicate-records']) {
    const { api, document } = setup(t, section(card()));
    const data = profile();
    if (mode === 'modules') data.modules.push({ ...data.modules[0], id: 'other_awards' });
    if (mode === 'fields') data.modules[0].fields.push({ id: 'other_name', label: '获奖名称' });
    if (mode === 'unknown') document.querySelector('input:not([placeholder])').value = '其他奖项';
    if (mode === 'duplicate-records') {
      data.modules[0].entries[1].name = '测试奖项1';
      document.querySelector('input:not([placeholder])').value = '测试奖项1';
    }
    assert.ok(api.plan(data).rows.every(row => row.reason), mode);
    if (mode !== 'duplicate-records') {
      let adds = 0; document.querySelector('button').onclick = () => adds++;
      await api.prepare(data); assert.equal(adds, 0);
    }
  }
});

test('award aliases do not match project fields and ignore nameless source entries', t => {
  const { api } = setup(t, section(card()) + section(field('获奖时间', select('年') + select('月')), '项目经验'));
  const data = profile(); data.modules[0].entries.unshift({ year: '2026-01' });
  const rows = api.plan(data).rows;
  assert.equal(rows.find(row => row.key === 'name').value, '测试奖项1');
  assert.ok(rows.filter(row => row.group === 'project').every(row => !row.key && row.reason));
});
