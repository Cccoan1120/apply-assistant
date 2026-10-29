import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { JSDOM } from 'jsdom';
const source = readFileSync(new URL('../extension/engine.js', import.meta.url), 'utf8');
const profile = {
  basic: { name: '测试姓名', phone: '13800000000', email: 'test@example.com', gender: '女', summary: '测试自述' },
  education: [{ school: '甲大学', major: '会计', degree: '硕士' }, { school: '乙大学', major: '财务', degree: '本科' }],
  internship: [{ company: '甲公司', role: '分析实习生', description: '甲工作内容' }, { company: '乙公司', role: '运营实习生', description: '乙工作内容' }],
  project: [{ name: '项目甲', role: '成员', description: '项目描述甲' }],
  modules: [{ id: 'custom_awards', label: '获奖经历', fields: [{ id: 'field_name', label: '奖项名称' }, { id: 'field_year', label: '获奖年份' }], entries: [{ field_name: '测试奖', field_year: '2025' }] }]
};
function setup(html) {
  const dom = new JSDOM(html, { url: 'https://app.mokahr.com/campus_apply/example#/resume', runScripts: 'outside-only' });
  dom.window.HTMLElement.prototype.getClientRects = () => [{ width: 100, height: 30 }];
  dom.window.eval(source);
  return { engine: dom.window.ApplyAssistant, document: dom.window.document, window: dom.window };
}
const field = (label, id, value = '') => `<label>${label}<input id="${id}" value="${value}"></label>`;
const block = (title, content) => `<fieldset><legend>${title}</legend>${content}</fieldset>`;

test('one plan maps all modules and two separate experience records without per-field selection', async () => {
  const { engine, document } = setup(block('个人信息', field('姓名', 'name') + field('邮箱', 'email') + '<label>最高学历<select id="degree"><option value="">请选择</option><option>本科</option><option>硕士</option></select></label>') +
    block('教育背景', '<div>' + field('学校名称', 's1') + field('专业', 'm1') + '</div><div>' + field('学校名称', 's2') + field('专业', 'm2') + '</div>') +
    block('实习经历 1', field('公司名称', 'c1') + field('职位名称', 'r1') + field('工作内容', 'd1')) +
    block('实习经历 2', field('公司名称', 'c2') + field('职位名称', 'r2') + field('工作内容', 'd2')) +
    block('项目经历', field('项目名称', 'p1') + field('项目角色', 'pr1') + field('项目描述', 'pd1')) +
    block('获奖经历', field('奖项名称', 'a1') + field('获奖年份', 'ay1')));
  const plan = engine.plan(profile);
  assert.equal(plan.rows.filter(row => row.reason).length, 0);
  const results = await engine.fill(plan.rows);
  assert.ok(results.every(result => result.ok));
  for (const [id, expected] of Object.entries({ name: '测试姓名', degree: '硕士', s1: '甲大学', s2: '乙大学', m2: '财务', c1: '甲公司', c2: '乙公司', r2: '运营实习生', pd1: '项目描述甲', a1: '测试奖', ay1: '2025' })) assert.equal(document.getElementById(id).value, expected, id);
});
test('existing named records are matched by identity before blank blocks are assigned', async () => {
  const { engine, document } = setup(block('实习经历', '<div>' + field('公司名称', 'c1') + field('职位名称', 'r1') + '</div><div>' + field('公司名称', 'c2', '甲公司') + field('职位名称', 'r2') + '</div>'));
  const rows = engine.plan(profile).rows;
  await engine.fill(rows.filter(row => !row.reason));
  assert.equal(document.getElementById('c1').value, '乙公司');
  assert.equal(document.getElementById('r1').value, '运营实习生');
  assert.equal(document.getElementById('r2').value, '分析实习生');
});
test('unknown identities, ambiguous blocks and unlabeled date fields do not get guessed values', () => {
  const { engine } = setup(block('实习经历', field('公司名称', 'c1', '其他公司') + field('职位名称', 'r1')) +
    block('项目经历', field('开始时间', 'start')) + field('开始时间', 'unknown') + field('工作经验', 'experience'));
  assert.ok(engine.plan(profile).rows.every(row => row.reason));
});
test('semantic dropdown selects only its own unique exact option and never types search text', async () => {
  const { engine, document } = setup(block('个人信息', '<label>性别<div role="combobox" aria-controls="gender-options" aria-expanded="false" tabindex="0"><input id="search"></div></label><div id="gender-options" role="listbox" hidden><div role="option">男</div><div role="option">女</div></div><div role="listbox"><div role="option">女</div></div>'));
  const trigger = document.querySelector('[role=combobox]'), list = document.getElementById('gender-options');
  trigger.onclick = () => { list.hidden = !list.hidden; trigger.setAttribute('aria-expanded', String(!list.hidden)); };
  list.lastElementChild.onclick = () => { const selected = document.createElement('span'); selected.setAttribute('aria-selected', 'true'); selected.textContent = '女'; trigger.append(selected); list.hidden = true; trigger.setAttribute('aria-expanded', 'false'); };
  let inputs = 0; document.getElementById('search').addEventListener('input', () => inputs++);
  const rows = engine.plan(profile).rows.filter(row => !row.reason);
  assert.equal(rows.length, 1); assert.equal(rows[0].choice, true);
  const result = await engine.fill(rows); assert.equal(result[0].ok, true);
  assert.equal(inputs, 0); assert.equal(document.getElementById('search').value, '');
});
test('duplicate dropdown options are left unselected', async () => {
  const { engine, document } = setup(block('个人信息', '<label>性别<div role="combobox" aria-controls="choices" aria-expanded="false"><input></div></label><div id="choices" role="listbox" hidden><div role="option">女</div><div role="option">女</div></div>'));
  const trigger = document.querySelector('[role=combobox]'), list = document.getElementById('choices');
  trigger.onclick = () => { list.hidden = !list.hidden; trigger.setAttribute('aria-expanded', String(!list.hidden)); };
  let clicked = 0; list.onclick = () => clicked++;
  const result = await engine.fill(engine.plan(profile).rows.filter(row => !row.reason));
  assert.equal(result[0].ok, false); assert.match(result[0].reason, /不唯一/); assert.equal(clicked, 0); assert.equal(list.hidden, true);
});
test('stopping and SPA navigation prevent remaining planned fields from being written', async () => {
  for (const action of ['stop', 'navigate']) {
    const { engine, document, window } = setup(field('姓名', 'n') + field('邮箱', 'e'));
    document.getElementById('n').addEventListener('change', () => action === 'stop' ? engine.stop() : window.history.pushState({}, '', '#/another'));
    const results = await engine.fill(engine.plan(profile).rows.filter(row => !row.reason));
    assert.equal(results[0].ok, true); assert.equal(results[1].ok, false); assert.equal(document.getElementById('e').value, '');
  }
});
test('internship data never fills a separate employment-history section', async () => {
  const { engine, document } = setup(block('工作经历', field('公司名称', 'work-company') + field('职位名称', 'work-role')) + block('实习经历', field('公司名称', 'intern-company') + field('职位名称', 'intern-role')));
  await engine.fill(engine.plan(profile).rows.filter(row => !row.reason));
  assert.equal(document.getElementById('work-company').value, '');
  assert.equal(document.getElementById('intern-company').value, '甲公司');
});
test('a selected value beside a combobox search input is preserved', () => {
  const { engine } = setup('<label for="gender">性别</label><div class="ant-select-selector"><span class="ant-select-selection-item">男</span><input id="gender" role="combobox" aria-controls="choices"></div>');
  const row = engine.plan(profile).rows[0]; assert.equal(row.current, '男'); assert.match(row.reason, /已有内容/);
});
test('dropdown opening cannot change identity, value or route and still execute an old selection', async () => {
  for (const change of ['label', 'value', 'route']) {
    const { engine, document, window } = setup('<label for="gender">性别</label><input id="gender" role="combobox" aria-controls="choices"><div id="choices" role="listbox" hidden><div role="option">女</div></div>');
    let clicked = 0;
    const input = document.getElementById('gender');
    input.onclick = () => {
      if (change === 'label') document.querySelector('label').textContent = '紧急联系人性别';
      if (change === 'value') input.value = '男';
      if (change === 'route') window.history.pushState({}, '', '#/other');
      document.getElementById('choices').hidden = false;
    };
    document.querySelector('[role=option]').onclick = () => clicked++;
    const result = await engine.fill(engine.plan(profile).rows.filter(row => !row.reason));
    assert.equal(result[0].ok, false); assert.equal(clicked, 0);
  }
});
