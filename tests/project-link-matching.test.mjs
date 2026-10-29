import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { JSDOM } from 'jsdom';
import { emptyProfile, validateProfile } from '../extension/schema.js';

const code = readFileSync(new URL('../extension/engine.js', import.meta.url), 'utf8');
const mineUrl = 'https://mine-knowledge-studio.onrender.com/';
const oldName = 'Mine | AI个人知识库与素材输出工作台';
const newName = 'Mine｜AI个人知识库与内容创作工作台';
const oldDescription = `旧版项目正文\n4.项目链接：${mineUrl}`;
const field = (label, control) => `<div class="form-item"><label class="form-item__text">${label}</label>${control}</div>`;
const record = ({ name = '', role = '', description = '', url } = {}) => `<div class="record">${field('项目名称', `<input class="name" value="${name}">`)}${field('职务', `<input class="role" value="${role}">`)}${field('项目描述', `<textarea>${description}</textarea>`)}${url === undefined ? '' : field('项目链接', `<input class="url" value="${url}">`)}</div>`;
function profile() {
  return validateProfile({ ...emptyProfile(), project: [
    { name: newName, role: '个人项目负责人', description: `新版项目正文\n项目链接：${mineUrl}`, url: mineUrl },
    { name: '财务分析项目', role: '研究成员', description: '已确认的财务分析内容', url: 'https://example.com/finance' },
    { name: '案例研究项目', role: '项目成员', description: '已确认的案例研究内容', url: 'https://example.com/case' }
  ] });
}
function setup(t, body, url = 'https://gjzq.zhiye.com/form') {
  const dom = new JSDOM(`<section><h2>项目经历</h2><div class="records">${body}</div><button type="button" class="add">添加项目经历</button></section><section><h2>工作经历</h2>${field('公司名称', '<input value="用户已有工作">')}</section><button class="save">暂存</button><button class="submit">预览并提交</button>`, { url, runScripts: 'outside-only' });
  dom.window.HTMLElement.prototype.getClientRects = () => [{}];
  dom.window.eval(code);
  t.after(() => dom.window.close());
  const document = dom.window.document, events = { add: 0, save: 0, submit: 0 };
  document.querySelector('.add').onclick = () => { events.add++; document.querySelector('.records').insertAdjacentHTML('beforeend', record()); };
  for (const key of ['save', 'submit']) document.querySelector(`.${key}`).onclick = () => events[key]++;
  return { api: dom.window.ApplyAssistant, document, events };
}
const projectRows = (api, data) => api.plan(data).rows.filter(row => row.group === 'project');

test('renamed Phoenix project matches its labelled URL, adds missing records and preserves existing text', async t => {
  const { api, document, events } = setup(t, record({ name: oldName, description: oldDescription }) + record());
  const data = profile();
  const prepared = await api.prepare(data);
  assert.equal(prepared.results.find(item => item.group === 'project').reason, '');
  assert.equal(events.add, 1);
  const rows = projectRows(api, data);
  assert.equal(rows.find(row => row.key === 'role').entry, 0);
  assert.equal(rows.find(row => row.key === 'description').canReplace, true);
  assert.ok((await api.fill(rows.filter(row => !row.reason))).every(row => row.ok));
  assert.deepEqual([...document.querySelectorAll('.name')].map(el => el.value), [oldName, '财务分析项目', '案例研究项目']);
  assert.equal(document.querySelector('.role').value, '个人项目负责人');
  assert.equal(document.querySelector('textarea').value, oldDescription);
  assert.equal(document.querySelector('section:nth-of-type(2) input').value, '用户已有工作');
  assert.equal(events.save, 0); assert.equal(events.submit, 0);
  await api.prepare(data);
  assert.equal(events.add, 1);
  const changes = projectRows(api, data).filter(row => row.canReplace);
  assert.equal(changes.length, 1);
  assert.equal((await api.replace(changes))[0].ok, true);
  assert.equal(document.querySelector('textarea').value, data.project[0].description);
  assert.equal(document.querySelector('.name').value, oldName);
});

test('explicit project URL field identifies a renamed project without consuming the blank record', t => {
  const { api } = setup(t, record({ name: oldName, description: '没有链接的旧正文', url: mineUrl }) + record());
  const rows = projectRows(api, profile());
  assert.equal(rows.find(row => row.key === 'role').value, '个人项目负责人');
  assert.equal(rows.find(row => row.key === 'role').reason, '');
  assert.equal(rows.filter(row => row.key === 'name')[1].value, '财务分析项目');
});

test('ambiguous template URLs and duplicate exact project names do not identify an existing project', async t => {
  for (const mode of ['duplicate-url', 'duplicate-name']) {
    const data = profile();
    if (mode === 'duplicate-url') data.project[1].url = mineUrl;
    else data.project[1].name = newName;
    const { api, events } = setup(t, record({ name: mode === 'duplicate-name' ? newName : oldName, description: oldDescription }));
    const rows = projectRows(api, data);
    assert.ok(rows.every(row => row.reason), mode);
    assert.ok(rows.every(row => !row.canReplace), mode);
    await api.prepare(data);
    assert.equal(events.add, 0, mode);
  }
});

test('unknown, unlabelled and conflicting project links are not used as identity evidence', async t => {
  const cases = [
    { description: '项目链接：https://example.com/unknown' },
    { description: `参考资料：${mineUrl}` },
    { description: `项目链接：${mineUrl}\n作品链接：https://example.com/finance` },
    { description: oldDescription, url: 'https://example.com/finance' },
    { description: '项目链接：javascript:alert(1)' }
  ];
  for (const details of cases) {
    const { api, events } = setup(t, record({ name: oldName, ...details }));
    const rows = projectRows(api, profile());
    assert.ok(rows.every(row => row.reason), JSON.stringify(details));
    assert.ok(rows.every(row => !row.canReplace));
    await api.prepare(profile());
    assert.equal(events.add, 0);
  }
});

test('changing the labelled description or URL after planning blocks both filling and replacing', async t => {
  for (const mode of ['description', 'url']) {
    const details = mode === 'description' ? { description: oldDescription } : { description: '原来的正文', url: mineUrl };
    const { api, document } = setup(t, record({ name: oldName, ...details }));
    const rows = projectRows(api, profile());
    const role = rows.find(row => row.key === 'role');
    const description = rows.find(row => row.key === 'description');
    assert.equal(role.reason, ''); assert.equal(description.canReplace, true);
    if (mode === 'description') document.querySelector('textarea').value = '项目链接：https://example.com/changed';
    else document.querySelector('.url').value = 'https://example.com/changed';
    assert.equal((await api.fill([role]))[0].ok, false);
    assert.equal((await api.replace([description]))[0].ok, false);
    assert.equal(document.querySelector('.role').value, '');
  }
});

test('stopped project fill preserves every blank field', async t => {
  const { api, document, events } = setup(t, record({ name: oldName, description: oldDescription }));
  const rows = projectRows(api, profile());
  const role = rows.find(row => row.key === 'role');
  assert.equal(role.reason, '');
  api.stop();
  assert.equal((await api.fill([role], { continueRun: true }))[0].ok, false);
  assert.equal(document.querySelector('.role').value, '');
  assert.equal(document.querySelector('textarea').value, oldDescription);
  assert.equal(events.save, 0); assert.equal(events.submit, 0);
});

test('Phoenix retains the template link in descriptions without a separate URL field across replacements', async t => {
  const { api, document, events } = setup(t, record({ name: oldName, description: oldDescription }) + record());
  const data = profile();
  data.project[0].description = '不含链接的新版项目正文';
  let rows = projectRows(api, data);
  const replacement = rows.find(row => row.key === 'description' && row.entry === 0);
  assert.equal(replacement.value, `不含链接的新版项目正文\n项目链接：${mineUrl}`);
  assert.equal(replacement.canReplace, true);
  assert.equal((await api.replace([replacement]))[0].ok, true);
  assert.equal(document.querySelector('textarea').value, replacement.value);
  rows = projectRows(api, data);
  assert.equal(rows.find(row => row.key === 'role').entry, 0);
  assert.equal(rows.filter(row => row.key === 'name')[1].value, '财务分析项目');
  assert.equal(rows.find(row => row.key === 'description' && row.entry === 0).canReplace, false);
  await api.prepare(data);
  assert.equal(events.add, 1);
  rows = projectRows(api, data);
  await api.fill(rows.filter(row => !row.reason));
  assert.deepEqual([...document.querySelectorAll('.name')].map(el => el.value), [oldName, '财务分析项目', '案例研究项目']);
  assert.equal(document.querySelector('textarea').value.split(mineUrl).length - 1, 1);
  assert.equal(projectRows(api, data).find(row => row.key === 'description' && row.entry === 0).canReplace, false);
});

test('description link fallback is limited to Phoenix records lacking a separate project URL field', t => {
  const data = profile();
  data.project[0].description = '仅含正文';
  const ownUrl = setup(t, record({ name: newName, url: '' }));
  assert.equal(projectRows(ownUrl.api, data).find(row => row.key === 'description').value, '仅含正文');
  const moka = setup(t, record({ name: newName }), 'https://app.mokahr.com/campus-recruitment/example/1');
  assert.equal(projectRows(moka.api, data).find(row => row.key === 'description').value, '仅含正文');
});
