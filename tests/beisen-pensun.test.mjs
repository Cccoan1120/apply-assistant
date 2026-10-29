import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { JSDOM } from 'jsdom';
import { validateProfile, emptyProfile } from '../extension/schema.js';

const code = readFileSync(new URL('../extension/engine.js', import.meta.url), 'utf8');
const field = (name, control = '<input>') => `<div class="form-item"><label class="form-item__text">${name}</label>${control}</div>`;
const block = (name, body) => `<section><h2>${name}</h2><div class="records">${body}</div></section>`;
const radio = values => `<div class="phoenix-radio-group">${values.map(value => `<div class="phoenix-radio"><span class="phoenix-radio__radio-text">${value}</span></div>`).join('')}</div>`;
const data = () => validateProfile({ ...emptyProfile(), basic: { maritalStatus: '未婚', overseasStudy: '否' }, education: [{ school: '测试大学', degree: '硕士', studyType: '全日制', trainingMode: '非定向', combinedDegree: '否' }], internship: [{ company: '测试公司', role: '财务实习生', start: '2025-06', end: '2025-09' }], project: [{ name: '测试项目', role: '成员', description: '项目背景描述', responsibilities: '用户确认的职责', results: '用户确认的成果' }], modules: [
  { id: 'custom_awards', label: '获奖经历', fields: [{ id: 'field_name', label: '奖项名称', type: 'text' }, { id: 'field_year', label: '获奖年份', type: 'text' }], entries: [{ field_name: '测试奖甲', field_year: '2024-10' }, { field_name: '测试奖乙', field_year: '2025-05' }] },
  { id: 'custom_languages', label: '语言能力', fields: [{ id: 'field_language', label: '语言类型', type: 'text' }, { id: 'field_speaking', label: '听说', type: 'text' }, { id: 'field_writing', label: '读写', type: 'text' }], entries: [{ field_language: '英语', field_speaking: '熟练', field_writing: '精通' }] }
] });
function setup(t, html) {
  const dom = new JSDOM(html, { url: 'https://pensun.zhiye.com/form', runScripts: 'outside-only' });
  dom.window.HTMLElement.prototype.getClientRects = () => [{}];
  dom.window.eval(code); t.after(() => dom.window.close());
  return { api: dom.window.ApplyAssistant, document: dom.window.document };
}

test('Pensun separates study format, training mode and academic degree without inferring a degree', async t => {
  const { api, document } = setup(t, block('教育经历', field('学校名称', '<input value="测试大学">') + field('学习形式', '<select><option></option><option>全国普通高等院校全日制</option><option>全国普通高等院校非全日制</option></select>') + field('培养方式', '<select><option></option><option>定向</option><option>非定向</option></select>') + field('学位') + field('是否直博或硕博连读', radio(['是', '否']))));
  document.querySelectorAll('.phoenix-radio').forEach(el => el.onclick = () => el.classList.add('phoenix-radio--checked'));
  const rows = api.plan(data()).rows;
  assert.equal(rows.find(row => row.key === 'academicDegree').value, '');
  assert.ok(rows.filter(row => ['studyType', 'trainingMode', 'combinedDegree'].includes(row.key)).every(row => !row.reason));
  assert.ok((await api.fill(rows.filter(row => !row.reason))).every(row => row.ok));
  assert.deepEqual([...document.querySelectorAll('select')].map(el => el.value), ['全国普通高等院校全日制', '非定向']);
  assert.equal(document.querySelector('.phoenix-radio--checked').textContent, '否');
});

test('Pensun award aliases map names and months to separate records and add only missing awards', async t => {
  const award = () => `<div class="record">${field('获奖项')}${field('获奖时间', '<input type="month">')}</div>`;
  const { api, document } = setup(t, block('获奖情况', award() + '<button type="button">添加获奖情况</button>'));
  let additions = 0;
  document.querySelector('button').onclick = () => { additions++; document.querySelector('button').insertAdjacentHTML('beforebegin', award()); };
  await api.prepare(data());
  const rows = api.plan(data()).rows;
  assert.equal(rows.length, 4); assert.ok(rows.every(row => !row.reason));
  assert.ok((await api.fill(rows)).every(row => row.ok));
  assert.deepEqual([...document.querySelectorAll('input')].map(el => el.value), ['测试奖甲', '2024-10', '测试奖乙', '2025-05']);
  await api.prepare(data()); assert.equal(additions, 1);
});

test('Pensun project description, responsibilities and results no longer collide', async t => {
  const { api, document } = setup(t, block('项目经历', field('项目名称', '<input value="测试项目">') + field('职务') + field('项目描述', '<textarea>网页已有描述</textarea>') + field('项目中职责', '<textarea></textarea>') + field('项目成果', '<textarea></textarea>')));
  const rows = api.plan(data()).rows;
  assert.equal(rows.find(row => row.key === 'description').current, '网页已有描述');
  assert.ok(rows.filter(row => ['responsibilities', 'results'].includes(row.key)).every(row => !row.reason));
  await api.fill(rows.filter(row => !row.reason));
  assert.deepEqual([...document.querySelectorAll('textarea')].map(el => el.value), ['网页已有描述', '用户确认的职责', '用户确认的成果']);
});

test('Pensun confirmed marital, overseas and language fields fill without touching family or agreements', async t => {
  const html = block('个人信息', field('婚否', radio(['未婚', '已婚'])) + field('海外留学经历', radio(['是', '否'])))
    + block('语言能力', field('语言类型') + field('听说') + field('读写'))
    + block('家庭情况', field('婚否', radio(['未婚', '已婚']))) + field('同意协议', radio(['是', '否']));
  const { api, document } = setup(t, html);
  document.querySelectorAll('.phoenix-radio').forEach(el => el.onclick = () => el.classList.add('phoenix-radio--checked'));
  const rows = api.plan(data()).rows;
  assert.ok((await api.fill(rows.filter(row => !row.reason))).every(row => row.ok));
  assert.deepEqual([...document.querySelectorAll('.phoenix-radio--checked')].map(el => el.textContent), ['未婚', '否']);
  assert.deepEqual([...document.querySelectorAll('input')].map(el => el.value), ['英语', '熟练', '精通']);
  const missing = data(); missing.basic.maritalStatus = ''; missing.modules[1].entries[0].field_writing = '';
  const fresh = setup(t, html).api.plan(missing);
  assert.equal(fresh.rows.find(row => row.key === 'field_writing').value, '');
});

test('Pensun work date captions consume internships while salary and leave reasons stay empty', t => {
  const { api } = setup(t, block('工作经历', field('公司名称') + field('职位名称') + field('工作开始时间') + field('工作结束时间') + field('月薪（税前）') + field('离职原因')));
  const rows = api.plan(data()).rows;
  assert.deepEqual(Array.from(rows.slice(0, 4), row => row.value), ['测试公司', '财务实习生', '2025-06', '2025-09']);
  assert.ok(rows.slice(4).every(row => row.reason && !row.value));
});

test('Phoenix present checkbox only applies to its own blank end date', async t => {
  const date = (label, value = '') => `<div class="fields-col">${field(label, `<div class="phoenix-select"><input value="${value}"></div>`)}<div class="phoenix-checkbox"><input type="checkbox"><span class="phoenix-checkbox__text">至今</span></div></div>`;
  for (const mode of ['end', 'start', 'existing']) {
    const { api, document } = setup(t, block('项目经历', field('项目名称', '<input value="测试项目">') + date(mode === 'start' ? '开始时间' : '结束时间', mode === 'existing' ? '2026-06' : '')));
    const checkbox = document.querySelector('[type=checkbox]');
    checkbox.onchange = () => { document.querySelector('.phoenix-select input').disabled = true; };
    const profile = data(); profile.project[0].end = '至今'; profile.project[0].start = '至今';
    const row = api.plan(profile).rows.find(row => row.key === (mode === 'start' ? 'start' : 'end'));
    assert.equal((await api.fill([row]))[0].ok, mode === 'end');
    assert.equal(checkbox.checked, mode === 'end');
  }
});
