import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { JSDOM } from 'jsdom';

const source = readFileSync(new URL('../extension/engine.js', import.meta.url), 'utf8');
const field = (label, inner = '<input>') => `<div class="apply-field-test"><div class="title-test">${label}</div>${inner}</div>`;
const date = () => ['年', '月'].map(part => `<div class="sd-Select-container-test"><span class="sd-Input-display-value-test"></span><input placeholder="${part}"></div>`).join('');
const card = () => `<div class="record">${field('是否有院校经历', '<select><option>是</option></select>')}${field('开始时间', date())}${field('结束时间', date())}${field('项目名称')}${field('项目描述', '<textarea></textarea>')}${field('职务')}${field('职务描述', '<textarea></textarea>')}</div>`;
const section = (name, inner) => `<section class="apply-block-test"><div class="blockTitle-test">${name}<button type="button">添加</button></div><div class="records">${inner}</div></section>`;
const profile = () => ({ basic: {}, education: [], internship: [], project: [{ name: '独立项目', description: '独立项目介绍' }], modules: [{
  id: 'custom_campus', label: '校园经历', fields: [
    { id: 'org', label: '学校 / 组织' }, { id: 'role', label: '职务' },
    { id: 'start', label: '开始时间' }, { id: 'end', label: '结束时间' }, { id: 'description', label: '工作内容' }
  ], entries: [{ org: '测试组织甲', role: '组织委员', start: '2025-09', end: '2026-06', description: '甲组织工作内容' }, { org: '测试组织乙', role: '宣传委员', start: '2024-03', end: '2025-06', description: '乙组织工作内容' }]
}] });
function setup(t, html) {
  const dom = new JSDOM(html, { url: 'https://app.mokahr.com/campus-recruitment/example#/apply', runScripts: 'outside-only' });
  dom.window.HTMLElement.prototype.getClientRects = () => [{ width: 100, height: 30 }];
  dom.window.eval(source);
  t.after(() => dom.window.close());
  return { api: dom.window.ApplyAssistant, document: dom.window.document };
}

test('Moka campus aliases remain inside campus sections and dates map separate year/month endpoints', async t => {
  const { api, document } = setup(t, section('院校经历', card() + card()) + section('项目经验', field('项目名称') + field('项目描述', '<textarea></textarea>')));
  const rows = api.plan(profile()).rows;
  for (let entry = 0; entry < 2; entry++) {
    const mapped = rows.filter(row => row.group === 'custom_campus' && row.entry === entry && row.key);
    assert.equal(mapped.length, 7);
    assert.ok(mapped.every(row => !row.reason), JSON.stringify(mapped));
    const dates = mapped.filter(row => row.part);
    assert.deepEqual(Array.from(dates, row => [row.key, row.part, row.value]), entry === 0 ? [['start', 'year', '2025'], ['start', 'month', '9'], ['end', 'year', '2026'], ['end', 'month', '6']] : [['start', 'year', '2024'], ['start', 'month', '3'], ['end', 'year', '2025'], ['end', 'month', '6']]);
  }
  const plain = rows.filter(row => !row.reason && !row.part);
  assert.ok((await api.fill(plain)).every(row => row.ok));
  const descriptions = [...document.querySelectorAll('textarea')].map(el => el.value);
  assert.deepEqual(descriptions, ['', '甲组织工作内容', '', '乙组织工作内容', '独立项目介绍']);
  assert.equal(rows.find(row => row.group === 'project' && row.key === 'name').value, '独立项目');
});

test('campus prepare expands only its section and assigns every template record', async t => {
  const { api, document } = setup(t, section('院校经历', card()) + section('项目经验', field('项目名称')));
  const campus = document.querySelector('section');
  let adds = 0;
  campus.querySelector('button').onclick = () => { adds++; campus.querySelector('.records').insertAdjacentHTML('beforeend', card()); };
  const result = await api.prepare(profile());
  assert.equal(result.results.find(row => row.group === 'custom_campus').added, 1);
  assert.equal(adds, 1);
  assert.deepEqual(Array.from(api.plan(profile()).rows.filter(row => row.group === 'custom_campus' && row.key === 'org'), row => row.value), ['测试组织甲', '测试组织乙']);
  await api.prepare(profile());
  assert.equal(adds, 1);
});

test('Moka ongoing ranges keep start year/month when checked current removes end controls', t => {
  const { api } = setup(t, section('实习经历', field('起止时间', `<div class="month-range-select">${date()}<input type="checkbox" checked>至今</div>`) + field('公司名称')));
  const data = profile(); data.internship = [{ company: '测试公司', start: '2026-07', end: '至今' }];
  const rows = api.plan(data).rows.filter(row => row.part);
  assert.deepEqual(Array.from(rows, row => [row.key, row.part, row.value, row.reason]), [['start', 'year', '2026', ''], ['start', 'month', '7', '']]);
});

test('two matching campus modules remain ambiguous and do not add or fill records', async t => {
  const { api, document } = setup(t, section('院校经历', card()));
  const data = profile(); data.modules.push({ ...data.modules[0], id: 'custom_other' });
  let adds = 0; document.querySelector('button').onclick = () => adds++;
  assert.ok(api.plan(data).rows.every(row => row.reason));
  await api.prepare(data);
  assert.equal(adds, 0);
});

test('captured Kingdee application campus DOM maps the actual title, fields and independent dates', async t => {
  const html = readFileSync(new URL('./fixtures/moka-kingdee-campus-live.html', import.meta.url), 'utf8');
  const { api, document } = setup(t, html);
  const data = profile(); data.modules[0].entries = data.modules[0].entries.slice(0, 1);
  const rows = api.plan(data).rows.filter(row => !row.reason);
  assert.equal(rows.filter(row => row.group === 'custom_campus').length, 7);
  assert.ok((await api.fill(rows.filter(row => !row.part))).every(row => row.ok));
  const values = [...document.querySelectorAll('textarea')].map(node => node.value);
  assert.ok(values.includes('甲组织工作内容'));
  assert.ok(!rows.some(row => row.group === 'project'));
});
