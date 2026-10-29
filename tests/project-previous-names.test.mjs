import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { JSDOM } from 'jsdom';

const code = readFileSync(new URL('../extension/engine.js', import.meta.url), 'utf8');
const field = (label, control) => `<div class="apply-field-test"><div class="title-test">${label}</div>${control}</div>`;
const record = (name = '', description = '', responsibility = '') => `<div class="record">${field('项目名称', `<input class="name" value="${name}">`)}${field('职责', '<input class="role" value="">')}${field('项目描述', `<textarea class="description" maxlength="2000">${description}</textarea>`)}${field('项目中职责', `<textarea class="responsibility" maxlength="2000">${responsibility}</textarea>`)}${field('开始时间', '<input type="month" class="start" value="2025-01">')}</div>`;
function profile() {
  return { basic: {}, education: [], internship: [], project: Array.from({ length: 6 }, (_, i) => ({
    name: `新版项目${i + 1}`, previousNames: `旧版项目${i + 1}\n历史名称${i + 1}`, role: `项目角色${i + 1}`, start: '2026-06',
    description: `项目${i + 1}完整正文：` + '已确认的项目背景、方案与实施内容。'.repeat(30) + '正文结尾。',
    responsibilities: `项目${i + 1}已确认职责：` + '我负责的具体工作。'.repeat(25) + '职责结尾。'
  })), modules: [] };
}
function setup(t, html = record('旧版项目1', '旧版正文1') + record('旧版项目2', '旧版正文2') + record('旧版项目3', '旧版正文3')) {
  const dom = new JSDOM(`<div class="apply-block-test"><div class="blockTitle-test">项目经验</div><div class="records">${html}</div><button class="add" type="button">添加</button></div><button class="save">暂存</button><button class="submit">提交申请</button>`, { url: 'https://app.mokahr.com/campus-recruitment/guming/39377#/job/test/apply', runScripts: 'outside-only' });
  dom.window.HTMLElement.prototype.getClientRects = () => [{}];
  dom.window.eval(code);
  t.after(() => dom.window.close());
  const document = dom.window.document, events = { add: 0, save: 0, submit: 0 };
  document.querySelector('.add').onclick = () => { events.add++; document.querySelector('.records').insertAdjacentHTML('beforeend', record()); };
  for (const key of ['save', 'submit']) document.querySelector(`.${key}`).onclick = () => events[key]++;
  return { api: dom.window.ApplyAssistant, document, events };
}

test('explicit old project names allow six Moka records and full separate descriptions and responsibilities', async t => {
  const { api, document, events } = setup(t), data = profile();
  await api.prepare(data);
  assert.equal(events.add, 3);
  const rows = api.plan(data).rows;
  assert.ok(rows.filter(row => row.key === 'role').every(row => !row.reason));
  assert.ok(rows.filter(row => row.key === 'responsibilities').every(row => !row.reason));
  assert.equal(rows.filter(row => row.canReplace).length, 3);
  assert.ok((await api.fill(rows.filter(row => !row.reason))).every(result => result.ok));
  assert.deepEqual([...document.querySelectorAll('.description')].slice(0, 3).map(el => el.value), ['旧版正文1', '旧版正文2', '旧版正文3']);
  assert.ok((await api.replace(api.plan(data).rows.filter(row => row.canReplace))).every(result => result.ok));
  assert.deepEqual([...document.querySelectorAll('.description')].map(el => el.value), data.project.map(entry => entry.description));
  assert.deepEqual([...document.querySelectorAll('.responsibility')].map(el => el.value), data.project.map(entry => entry.responsibilities));
  assert.deepEqual([...document.querySelectorAll('.role')].map(el => el.value), data.project.map(entry => entry.role));
  assert.deepEqual([...document.querySelectorAll('.name')].map(el => el.value), ['旧版项目1', '旧版项目2', '旧版项目3', '新版项目4', '新版项目5', '新版项目6']);
  assert.ok([...document.querySelectorAll('.start')].every(el => el.value === '2025-01'));
  await api.prepare(data); assert.equal(events.add, 3);
  assert.equal(events.save, 0); assert.equal(events.submit, 0);
});

test('previous names match exactly and ambiguous historical names cannot add or overwrite projects', async t => {
  for (const kind of ['unknown', 'duplicate-alias', 'duplicate-page', 'duplicate-current']) {
    const data = profile();
    if (kind === 'duplicate-alias') data.project[1].previousNames += '\n旧版项目1';
    if (kind === 'duplicate-current') { data.project[0].name = '旧版项目1'; data.project[1].name = '旧版项目1'; }
    const html = record(kind === 'unknown' ? '旧版项目1的其他研究' : '旧版项目1') + (kind === 'duplicate-page' ? record('旧版项目1') : '');
    const { api, document, events } = setup(t, html);
    await api.prepare(data);
    assert.equal(events.add, 0, kind);
    const rows = api.plan(data).rows;
    if (kind !== 'duplicate-page') assert.ok(rows.every(row => row.reason), kind);
    assert.ok(rows.every(row => !row.canReplace), kind);
    assert.ok([...document.querySelectorAll('textarea')].every(el => !el.value));
  }
});

test('current project name takes precedence over another record historical name', t => {
  const data = profile(); data.project[1].previousNames = '新版项目1';
  const { api } = setup(t, record('新版项目1'));
  assert.equal(api.plan(data).rows.find(row => row.key === 'role').value, data.project[0].role);
});

test('old-name matches retain identity guards and permit explicit responsibility updates', async t => {
  const data = profile(), { api, document } = setup(t, record('旧版项目2', '旧正文', '旧职责'));
  const rows = api.plan(data).rows;
  const responsibilities = rows.find(row => row.key === 'responsibilities');
  assert.equal(responsibilities.canReplace, true);
  assert.equal((await api.replace([responsibilities]))[0].ok, true);
  assert.equal(document.querySelector('.responsibility').value, data.project[1].responsibilities);
  const next = api.plan(data).rows.filter(row => row.canReplace);
  document.querySelector('.name').value = '另一项目';
  assert.ok((await api.replace(next)).every(result => !result.ok));
  assert.equal(document.querySelector('.description').value, '旧正文');
});

test('Moka multiline responsibilities are not filled with the short project role', async t => {
  const { api, document } = setup(t, record('旧版项目1'));
  document.querySelector('.role').closest('.apply-field-test').remove();
  document.querySelector('.responsibility').closest('.apply-field-test').querySelector('.title-test').textContent = '职责';
  const data = profile(), row = api.plan(data).rows.find(row => row.key === 'responsibilities');
  assert.equal(row.value, data.project[0].responsibilities);
  assert.equal((await api.fill([row]))[0].ok, true);
});

test('site length limits never silently truncate project descriptions', async t => {
  const { api, document } = setup(t, record('旧版项目1'));
  document.querySelector('.description').maxLength = 20;
  const data = profile(), row = api.plan(data).rows.find(row => row.key === 'description');
  assert.match(row.reason, /超过 20 字限制/);
  assert.equal((await api.fill([row]))[0].ok, false);
  assert.equal(document.querySelector('.description').value, '');
});

test('a synthetic finance template resolves three historical project names and fills all six exact bodies', async t => {
  const { default: preset } = await import('./fixtures/synthetic-profiles.mjs');
  const data = preset.library.profiles.find(item => item.name === '财务岗').data;
  assert.equal(data.project.length, 6);
  const old = data.project.filter(entry => entry.previousNames).slice(0, 3);
  assert.equal(old.length, 3);
  const { api, document, events } = setup(t, old.map(entry => record(entry.previousNames.split('\n')[0], '网页旧版正文')).join(''));
  await api.prepare(data);
  assert.equal(events.add, 3);
  const rows = api.plan(data).rows;
  assert.ok((await api.fill(rows.filter(row => !row.reason))).every(result => result.ok));
  assert.ok((await api.replace(api.plan(data).rows.filter(row => row.canReplace))).every(result => result.ok));
  const actual = [...document.querySelectorAll('.record')].map(node => ({
    name: node.querySelector('.name').value,
    description: node.querySelector('.description').value,
    responsibilities: node.querySelector('.responsibility').value
  }));
  for (const entry of data.project) {
    const matched = actual.filter(item => item.name === entry.name || entry.previousNames.split('\n').includes(item.name));
    assert.equal(matched.length, 1);
    assert.equal(matched[0].description, entry.description);
    assert.equal(matched[0].responsibilities, entry.responsibilities);
  }
  await api.prepare(data); assert.equal(events.add, 3);
  assert.equal(events.save, 0); assert.equal(events.submit, 0);
});
