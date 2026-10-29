import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { JSDOM } from 'jsdom';

const code = readFileSync(new URL('../extension/engine.js', import.meta.url), 'utf8');
const field = (label, input = '<input>') => `<div class="form-item"><label class="form-item__text">${label}</label>${input}</div>`;
const section = (label, body) => `<section><h2>${label}</h2>${body}</section>`;
const familyRecord = (name = '', phone = '') => `<div class="record">${field('与本人关系', '<select><option></option><option>父子</option><option>母子</option></select>')}${field('性别', '<select><option></option><option>男</option><option>女</option></select>')}${field('姓名', `<input class="name" value="${name}">`)}${field('联系电话', `<input class="phone" value="${phone}">`)}${field('工作单位')}${field('出生年月', '<input type="month">')}</div>`;
const campusRecord = () => `<div class="record">${field('开始时间', '<input type="month">')}${field('结束时间', '<input type="month">')}${field('社会工作团体')}${field('担任职务')}</div>`;
function family() {
  return { id: 'custom_family', label: '家庭情况', fields: [
    ['field_name', '姓名'], ['field_relation', '与本人关系'], ['field_gender', '性别'], ['field_phone', '联系电话'], ['field_company', '工作单位'], ['field_birth', '出生年月']
  ].map(([id, label]) => ({ id, label, type: 'text' })), entries: [
    { field_name: '测试父亲', field_relation: '父子', field_gender: '男', field_phone: '13800000001', field_company: '测试企业', field_birth: '1970-11' },
    { field_name: '测试母亲', field_relation: '母子', field_gender: '女', field_phone: '13800000002', field_company: '无', field_birth: '1972-11' }
  ] };
}
const profile = modules => ({ basic: { name: '申请人', phone: '13800000003', gender: '男', birthDate: '2000-01-01' }, education: [], internship: [], project: [], modules });
function setup(t, html) {
  const dom = new JSDOM(html + '<button id="save">暂存</button><button id="submit">预览并提交</button>', { url: 'https://jobtaikang.zhiye.com/form', runScripts: 'outside-only' });
  dom.window.HTMLElement.prototype.getClientRects = () => [{}];
  dom.window.eval(code);
  t.after(() => dom.window.close());
  const document = dom.window.document, events = { added: 0, save: 0, submit: 0 };
  for (const key of ['save', 'submit']) document.getElementById(key).onclick = () => events[key]++;
  document.querySelector('#add')?.addEventListener('click', event => { events.added++; event.currentTarget.insertAdjacentHTML('beforebegin', familyRecord()); });
  return { api: dom.window.ApplyAssistant, document, events };
}

test('family data matches by member name and never fills applicant or emergency-contact fields', async t => {
  const { api, document, events } = setup(t, section('个人信息', field('姓名', '<input class="applicant">'))
    + section('家庭情况', familyRecord('测试母亲', '用户保留号码') + familyRecord())
    + section('紧急联系人', field('姓名', '<input class="emergency">') + field('联系电话')));
  const data = profile([family()]), rows = api.plan(data).rows;
  assert.equal(rows.find(row => row.group === 'custom_family' && row.key === 'field_relation').value, '母子');
  assert.ok((await api.fill(rows.filter(row => !row.reason))).every(result => result.ok));
  assert.equal(document.querySelector('.applicant').value, '申请人');
  assert.equal(document.querySelector('.emergency').value, '');
  assert.deepEqual([...document.querySelectorAll('.name')].map(el => el.value), ['测试母亲', '测试父亲']);
  assert.deepEqual([...document.querySelectorAll('.phone')].map(el => el.value), ['用户保留号码', '13800000001']);
  assert.deepEqual([...document.querySelectorAll('[type=month]')].map(el => el.value), ['1972-11', '1970-11']);
  assert.equal(events.save, 0); assert.equal(events.submit, 0);
});

test('family expansion is limited to supplied named members and is idempotent', async t => {
  const { api, document, events } = setup(t, section('家庭成员', familyRecord() + '<button id="add" type="button">添加家庭成员</button>'));
  const data = profile([family()]);
  await api.prepare(data);
  assert.equal(events.added, 1);
  await api.fill(api.plan(data).rows.filter(row => !row.reason));
  await api.prepare(data);
  assert.equal(events.added, 1);
  assert.deepEqual([...document.querySelectorAll('.name')].map(el => el.value), ['测试父亲', '测试母亲']);
});

test('absent, duplicate or nameless family templates cannot borrow applicant information or add members', async t => {
  const duplicate = family(); duplicate.id = 'custom_other_family';
  const nameless = family(); nameless.entries.forEach(entry => entry.field_name = '');
  for (const modules of [[], [family(), duplicate], [nameless]]) {
    const { api, document, events } = setup(t, section('家庭情况', familyRecord() + '<button id="add" type="button">添加家庭情况</button>'));
    const data = profile(modules);
    await api.prepare(data);
    const rows = api.plan(data).rows;
    assert.ok(rows.every(row => row.reason));
    await api.fill(rows.filter(row => !row.reason));
    assert.equal(events.added, 0);
    assert.ok([...document.querySelectorAll('input,select')].every(el => !el.value));
  }
});

test('family identity changes invalidate an already prepared fill', async t => {
  const { api, document } = setup(t, section('家庭情况', familyRecord('测试父亲')));
  const rows = api.plan(profile([family()])).rows.filter(row => !row.reason);
  document.querySelector('.name').value = '另一位成员';
  assert.ok((await api.fill(rows)).every(result => !result.ok));
  assert.equal(document.querySelector('.phone').value, '');
});

test('Taikang campus organization and role map only inside the school-practice section', async t => {
  const campus = { id: 'custom_campus', label: '校园经历', fields: [['field_org', '学校 / 组织'], ['field_role', '职务'], ['field_start', '开始时间'], ['field_end', '结束时间']].map(([id, label]) => ({ id, label, type: 'text' })), entries: [{ field_org: '测试学生会', field_role: '组织委员', field_start: '2024-03', field_end: '2025-06' }] };
  const { api, document } = setup(t, section('在校实践', campusRecord()) + section('家庭情况', field('担任职务')));
  const rows = api.plan(profile([campus])).rows;
  assert.equal(rows.filter(row => row.group === 'custom_campus' && !row.reason).length, 4);
  await api.fill(rows.filter(row => !row.reason));
  assert.deepEqual([...document.querySelectorAll('input')].map(el => el.value), ['2024-03', '2025-06', '测试学生会', '组织委员', '']);
});
