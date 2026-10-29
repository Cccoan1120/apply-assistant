import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { JSDOM } from 'jsdom';
const html = readFileSync(new URL('./fixtures/moka-manbang-live.html', import.meta.url), 'utf8');
const engine = readFileSync(new URL('../extension/engine.js', import.meta.url), 'utf8');
const profile = { basic: { name: '测试姓名', gender: '女', city: '北京', summary: '测试自我描述' }, education: [{ school: '测试大学', major: '会计学', degree: '硕士' }], internship: [{ company: '测试公司', role: '分析实习生', description: '实习工作描述' }], project: [{ name: '测试项目', role: '项目成员', description: '项目详细描述' }], modules: [{ id: 'custom_awards', label: '获奖经历', fields: [{ id: 'field_name', label: '奖项名称' }], entries: [{ field_name: '测试奖项' }] }] };
function setup() {
  const dom = new JSDOM(html, { url: 'https://app.mokahr.com/campus_apply/manbang/94191#/candidateHome/resume', runScripts: 'outside-only' });
  dom.window.HTMLElement.prototype.getClientRects = () => [{ width: 100, height: 30 }];
  dom.window.eval(engine);
  return { api: dom.window.ApplyAssistant, document: dom.window.document };
}
test('captured Moka DOM identifies real captions, separates field titles from section headings and maps modules', () => {
  const { api } = setup(); const { rows } = api.plan(profile);
  assert.ok(rows.length > 30);
  assert.equal(rows.filter(row => row.label === '请选择').length, 0);
  assert.equal(rows.find(row => row.label === '性别').key, 'gender');
  assert.equal(rows.find(row => row.label === '最高学历').key, 'highestDegree');
  assert.equal(rows.find(row => row.label === '工作经验').group, 'basic');
  for (const [group, key, value] of [['education', 'school', '测试大学'], ['internship', 'company', '测试公司'], ['project', 'name', '测试项目'], ['basic', 'summary', '测试自我描述'], ['custom_awards', 'field_name', '测试奖项']]) {
    const row = rows.find(row => row.group === group && row.key === key);
    assert.ok(row, `${group}.${key}`); assert.equal(row.value, value); assert.equal(row.reason, '', `${row.label}: ${row.reason}`);
  }
  assert.ok(rows.filter(row => row.group === 'work').every(row => row.reason));
  assert.equal(rows.find(row => /证件号码/.test(row.label)).key, 'identityNumber');
});
test('captured Moka plain fields fill actual input nodes without touching custom select search inputs', async () => {
  const { api, document } = setup(); const rows = api.plan(profile).rows;
  const writable = rows.filter(row => !row.reason && !row.choice);
  assert.ok(writable.length >= 6);
  const results = await api.fill(writable); assert.ok(results.every(row => row.ok));
  assert.equal(document.querySelector('input[placeholder="所在地"]').value, '北京');
  assert.equal(document.querySelector('input[placeholder="项目名称"]').value, '测试项目');
  assert.ok([...document.querySelectorAll('[class*="sd-Select-container-"] input')].every(input => input.value === ''));
});
test('Moka component adapter selects only options nested in its own dropdown and reads display value', async () => {
  const { api, document } = setup();
  const field = [...document.querySelectorAll('[class*="apply-field-"]')].find(node => node.firstElementChild.textContent === '性别');
  const input = field.querySelector('input'), dropdown = field.querySelector('[class*="sd-Dropdown-container-"]'), display = field.querySelector('[class*="sd-Input-display-value-"]');
  // Structure is captured from the live component; this local handler replaces its React event binding.
  input.onclick = () => {
    const menu = document.createElement('div'); menu.className = 'sd-Select-menu-36GwS';
    for (const label of ['男', '女']) { const option = document.createElement('div'); option.className = 'sd-Select-common-item-3YCIH'; option.textContent = label; option.onclick = () => { display.textContent = label; menu.remove(); }; menu.append(option); }
    dropdown.lastElementChild.append(menu);
  };
  const row = api.plan(profile).rows.find(row => row.label === '性别');
  assert.equal(row.reason, ''); assert.equal(row.choice, true);
  const result = await api.fill([row]); assert.equal(result[0].ok, true); assert.equal(display.textContent, '女'); assert.equal(input.value, '');
  const preserved = api.plan(profile).rows.find(row => row.label === '性别'); assert.equal(preserved.current, '女'); assert.match(preserved.reason, /已有内容/);
});
