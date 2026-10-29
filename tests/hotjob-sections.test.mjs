import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { JSDOM } from 'jsdom';

const engine = readFileSync(new URL('../extension/engine.js', import.meta.url), 'utf8');
// Structure from the public Hotjob resumeOperation bundle, build 60993f75573087485a09.
const field = (label, control = '<input>') => `<div class="formItem"><div class="ant-row ant-form-item"><div class="ant-form-item-label"><label><span>${label}</span></label></div><div class="ant-form-item-control-wrapper"><div class="ant-form-item-control"><span class="ant-form-item-children">${control}</span></div></div></div></div>`;
const record = content => `<div class="form-cell-inner">${content}<button type="button" class="save-btn" style="display:none">保存</button></div>`;
const section = (title, content, add = false) => `<div class="form-cell"><div class="tit-wrap"><div class="tit"><p title="${title}">${title}</p><span>必填</span></div><div class="tit-remark"><p>请填写完整经历</p></div></div><div class="form-cell-right">${content}${add ? `<div class="add-more"><div class="add-more-btn"><i></i>添加新的${title}</div></div>` : ''}</div></div>`;
function setup(t, html, host = 'wecruit.hotjob.cn') {
  const dom = new JSDOM(html, { url: `https://${host}/SUtest/pb/resumeOperation.html`, runScripts: 'outside-only' });
  dom.window.HTMLElement.prototype.getClientRects = () => [{}];
  dom.window.eval(engine);
  t.after(() => dom.window.close());
  return { dom, document: dom.window.document, api: dom.window.ApplyAssistant };
}
const data = () => ({ basic: { name: '申请人甲', phone: '13800000000' }, education: [{ school: '甲大学', major: '会计学' }, { school: '乙大学', major: '财务管理' }], internship: [{ company: '甲公司', role: '分析实习生', description: '实习完整职责。' }], project: [{ name: '甲项目', role: '负责人', description: '项目描述。'.repeat(50), responsibilities: '项目中的具体职责。' }, { name: '乙项目', description: '第二个项目完整描述。' }], modules: [] });

test('Hotjob nested titles identify personal and repeated experience records, adding only missing entries', async t => {
  const edu = () => record(field('学校名称') + field('专业'));
  const project = () => record(field('项目名称') + field('项目描述', '<textarea></textarea>') + field('项目中职责', '<textarea></textarea>'));
  const { api, document } = setup(t, section('基本信息', record(field('姓名') + field('手机号码'))) + section('教育经历', edu(), true) + section('实习经历', record(field('公司名称') + field('职位名称') + field('工作职责', '<textarea></textarea>'))) + section('项目经历', project(), true));
  let additions = 0, saves = 0;
  document.querySelectorAll('.save-btn').forEach(node => node.onclick = () => saves++);
  for (const button of document.querySelectorAll('.add-more')) button.onclick = () => {
    additions++;
    button.insertAdjacentHTML('beforebegin', button.textContent.includes('教育') ? edu() : project());
  };
  await api.prepare(data());
  assert.equal(additions, 2);
  const rows = api.plan(data()).rows;
  assert.equal(rows.filter(row => row.group === 'education' && row.key === 'school').length, 2);
  assert.ok(rows.find(row => row.key === 'phone' && row.group === 'basic'));
  const fillable = rows.filter(row => !row.reason);
  assert.ok(fillable.length >= 13);
  assert.ok((await api.fill(fillable)).every(row => row.ok));
  assert.equal(document.querySelectorAll('textarea')[1].value, data().project[0].description);
  assert.equal(document.querySelectorAll('textarea')[3].value, data().project[1].description);
  await api.prepare(data());
  assert.equal(additions, 2);
  assert.equal(saves, 0);
});

test('Hotjob unknown and family sections cannot borrow personal or internship data', t => {
  const { api } = setup(t, section('内部推荐人', record(field('姓名') + field('手机号码'))) + section('家庭情况', record(field('姓名') + field('公司名称'))) + section('工作经历', record(field('公司名称') + field('工作职责', '<textarea></textarea>'))));
  const rows = api.plan(data()).rows;
  assert.ok(rows.length > 0);
  assert.ok(rows.filter(row => row.group !== 'internship').every(row => row.reason && !row.value));
  assert.ok(rows.some(row => row.group === 'internship' && row.key === 'company' && row.value && !row.reason));
});

test('Hotjob hidden code fields do not collide with their visible labels', async t => {
  const { api, document } = setup(t, section('基本信息', record(field('姓名') + '<div style="display:none">' + field('姓名', '<input value="internal-code">') + '</div>')));
  const rows = api.plan(data()).rows;
  assert.equal(rows.length, 1);
  assert.equal(rows[0].value, '申请人甲');
  assert.equal((await api.fill(rows))[0].ok, true);
  assert.equal(document.querySelectorAll('input')[1].value, 'internal-code');
});

test('Hotjob family detection remains active before an async resume form renders', async t => {
  const { api, document } = setup(t, '<main><p>正在加载简历</p></main>', 'crrc.hotjob.cn');
  const before = api.plan(data());
  assert.equal(before.platform, '北森');
  assert.equal(before.rows.length, 0);
  document.body.innerHTML = section('项目经历', record(field('项目名称') + field('项目描述', '<textarea></textarea>')));
  const after = api.plan(data());
  assert.equal(after.platform, '北森');
  assert.ok(after.rows.some(row => row.group === 'project' && row.key === 'name'));
});

test('Hotjob mismatched named records block duplicate additions and preserve old descriptions', async t => {
  const { api, document } = setup(t, section('项目经历', record(field('项目名称', '<input value="用户另一个项目">') + field('项目描述', '<textarea>用户原文</textarea>')), true));
  let clicks = 0;
  document.querySelector('.add-more').onclick = () => clicks++;
  await api.prepare(data());
  assert.equal(clicks, 0);
  assert.ok(api.plan(data()).rows.every(row => row.reason && !row.canReplace));
  assert.equal(document.querySelector('textarea').value, '用户原文');
});
