import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { JSDOM } from 'jsdom';

const html = readFileSync(new URL('./fixtures/beisen-baic-live.html', import.meta.url), 'utf8');
const engine = readFileSync(new URL('../extension/engine.js', import.meta.url), 'utf8');
const profile = () => ({
  basic: { name: '测试姓名', gender: '男', phone: '13800000000', email: 'test@example.com', birthDate: '2002-11-20' },
  education: [{ school: '测试大学', major: '会计学', degree: '硕士', start: '2022-09', end: '2025-06' }],
  internship: [{ company: '测试实习公司', role: '分析实习生' }],
  project: [{ name: '测试项目', role: '项目成员', description: '测试项目说明', start: '2024-03', end: '2025-06' }],
  modules: []
});
function setup(t, url = 'https://baicgroup.zhiye.com/form?fromPage=editMyResume') {
  const dom = new JSDOM(html, { url, runScripts: 'outside-only' });
  const { window } = dom;
  window.HTMLElement.prototype.getClientRects = () => [{}];
  window.eval(engine);
  t.after(() => window.close());
  const document = window.document;
  const field = name => [...document.querySelectorAll('.form-item')].find(el => el.querySelector('.form-item__text')?.textContent === name);
  return { api: window.ApplyAssistant, document, window, field };
}

test('captured BAIC form maps personal, education, projects and fallback internships', async t => {
  const { api, document, field } = setup(t);
  field('手机号码').querySelector('input').value = '13900000000';
  const plan = api.plan(profile());
  assert.equal(plan.platform, '北森');
  for (const [group, key] of [['basic', 'name'], ['basic', 'email'], ['basic', 'gender'], ['basic', 'birthDate'], ['education', 'school'], ['education', 'major'], ['education', 'degree'], ['education', 'start'], ['education', 'end'], ['project', 'name'], ['project', 'role'], ['project', 'description'], ['project', 'start'], ['project', 'end']]) {
    const row = plan.rows.find(row => row.group === group && row.key === key);
    assert.ok(row, `${group}.${key}`); assert.equal(row.reason, '', `${group}.${key}`);
  }
  assert.equal(plan.rows.find(row => row.key === 'gender').choice, true);
  assert.equal(plan.rows.find(row => row.group === 'internship' && row.key === 'company').value, '测试实习公司');
  const results = await api.fill(plan.rows.filter(row => !row.reason && !row.choice));
  assert.ok(results.every(row => row.ok), JSON.stringify(results));
  assert.equal(field('手机号码').querySelector('input').value, '13900000000');
  assert.equal(field('公司名称').querySelector('input').value, '测试实习公司');
  assert.equal(field('职务').querySelector('input').value, '项目成员');
  assert.equal(field('项目描述').querySelector('textarea').value, '测试项目说明');
  assert.ok([...document.querySelectorAll('input[type="checkbox"]')].every(el => !el.checked));
});

test('BAIC gender commits the unique custom radio and preserves it on later runs', async t => {
  const { api, document } = setup(t);
  const group = document.querySelector('.phoenix-radio-group');
  let clicks = 0;
  for (const option of group.querySelectorAll('.phoenix-radio')) option.onclick = () => { clicks++; option.classList.add('phoenix-radio--checked'); };
  const row = api.plan(profile()).rows.find(row => row.key === 'gender');
  assert.equal((await api.fill([row]))[0].ok, true);
  assert.equal(clicks, 1);
  const data = profile(); data.basic.gender = '女';
  const next = api.plan(data).rows.find(row => row.key === 'gender');
  assert.equal(next.current, '男'); assert.match(next.reason, /已有内容/);
  assert.equal((await api.fill([next]))[0].ok, false); assert.equal(clicks, 1);
});

test('BAIC gender refuses duplicate, disabled, hidden and stale options', async t => {
  for (const mode of ['duplicate', 'disabled', 'hidden', 'selected', 'label', 'moved']) {
    const { api, document, field } = setup(t);
    const group = document.querySelector('.phoenix-radio-group'), male = group.querySelector('.phoenix-radio');
    let clicks = 0; male.onclick = () => clicks++;
    const row = api.plan(profile()).rows.find(row => row.key === 'gender');
    if (mode === 'duplicate') group.append(male.cloneNode(true));
    if (mode === 'disabled') male.classList.add('phoenix-radio--disabled');
    if (mode === 'hidden') male.hidden = true;
    if (mode === 'selected') group.querySelectorAll('.phoenix-radio')[1].classList.add('phoenix-radio--checked');
    if (mode === 'label') field('性别').querySelector('label').textContent = '隐私协议';
    if (mode === 'moved') document.body.append(group);
    assert.equal((await api.fill([row]))[0].ok, false, mode); assert.equal(clicks, 0, mode);
  }
});

test('gender requires selected-state confirmation and stops during a delayed commit', async t => {
  for (const mode of ['uncommitted', 'stop', 'route', 'wrong']) {
    const { api, document, window } = setup(t);
    const options = document.querySelectorAll('.phoenix-radio');
    options[0].onclick = () => {
      if (mode === 'stop') window.setTimeout(() => api.stop(), 20);
      if (mode === 'route') window.history.pushState({}, '', '/other');
      if (mode === 'wrong') options[1].classList.add('phoenix-radio--checked');
    };
    const row = api.plan(profile()).rows.find(row => row.key === 'gender');
    assert.equal((await api.fill([row]))[0].ok, false, mode);
  }
});

test('only the labeled Beisen gender radio group is eligible, never agreement or third-party fields', t => {
  const { api, document } = setup(t);
  const agreement = document.querySelector('.phoenix-radio-group').closest('.form-item').cloneNode(true);
  agreement.querySelector('label').textContent = '隐私协议'; document.body.append(agreement);
  const family = document.createElement('fieldset'); family.innerHTML = '<legend>家庭信息</legend>';
  family.append(document.querySelector('.phoenix-radio-group').closest('.form-item').cloneNode(true)); document.body.append(family);
  const rows = api.plan(profile()).rows;
  assert.equal(rows.filter(row => row.key === 'gender' && !row.reason).length, 1);
  assert.ok(!rows.some(row => row.label === '隐私协议'));
  assert.ok(rows.filter(row => row.group === 'thirdParty').every(row => row.reason));
  const unrelated = setup(t, 'https://zhiye.com.unrelated.example/form');
  const otherPlan = unrelated.api.plan(profile());
  assert.equal(otherPlan.platform, '北森');
  assert.ok(otherPlan.rows.some(row => row.key === 'gender' && !row.reason));
});

test('BAIC repeated education and projects use their own add controls and are not added twice', async t => {
  const { api, document, field } = setup(t);
  let adds = 0;
  for (const label of ['学校名称', '项目名称']) {
    const record = field(label).closest('.ux-standard-form').parentElement.parentElement;
    const button = record.parentElement.querySelector('[id$="_addButton"]');
    assert.ok(button, label);
    button.onclick = () => { adds++; button.before(record.cloneNode(true)); };
  }
  const data = profile();
  data.education.push({ school: '第二大学', major: '金融学' });
  data.project.push({ name: '第二项目', role: '负责人' });
  const prepared = await api.prepare(data);
  assert.equal(prepared.results.find(row => row.group === 'education').added, 1);
  assert.equal(prepared.results.find(row => row.group === 'project').added, 1);
  assert.equal(adds, 2);
  const rows = api.plan(data).rows;
  assert.deepEqual(Array.from(rows.filter(row => row.key === 'school'), row => row.value), ['测试大学', '第二大学']);
  assert.deepEqual(Array.from(rows.filter(row => row.group === 'project' && row.key === 'role'), row => row.value), ['项目成员', '负责人']);
  await api.prepare(data); assert.equal(adds, 2);
});
