import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { JSDOM } from 'jsdom';
const engine = readFileSync(new URL('../extension/engine.js', import.meta.url), 'utf8');
const field = (name, input = '<input>') => `<div class="apply-field-test"><div class="title-test">${name}</div>${input}</div>`;
const templates = [
  ['Moka', `<div class="apply-block-test"><div class="blockTitle-test">项目经历</div>${field('项目名称')}${field('项目描述', '<textarea></textarea>')}${field('项目中职责', '<textarea></textarea>')}</div>`],
  ['飞书招聘', '<div class="applyFormModuleWrapper-windows"><div class="applyFormModuleWrapper-text">项目经历</div><div data-form-field-i18n-name="项目名称"><input></div><div data-form-field-i18n-name="描述"><textarea></textarea></div></div>'],
  ['通用表单', '<div class="form-cell"><div class="tit-wrap"><div class="tit"><p>项目经历</p></div></div><div class="form-cell-inner"><div class="ant-form-item"><div class="ant-form-item-label"><label>项目名称</label></div><input></div><div class="ant-form-item"><div class="ant-form-item-label"><label>项目描述</label></div><textarea></textarea></div></div></div>']
];
for (const [platform, html] of templates) test(`custom domain detects ${platform} form after delayed rendering`, async t => {
  const dom = new JSDOM('', { url: 'https://careers.example.org/apply', runScripts: 'outside-only' });
  t.after(() => dom.window.close());
  dom.window.HTMLElement.prototype.getClientRects = () => [{}];
  dom.window.eval(engine);
  dom.window.document.body.innerHTML = html;
  const data = { basic: {}, education: [], internship: [], project: [{ name: '项目甲', description: '完整项目正文。'.repeat(20), responsibilities: '项目实际职责' }], modules: [] };
  const plan = dom.window.ApplyAssistant.plan(data);
  assert.equal(plan.platform, platform);
  assert.ok(plan.rows.every(row => row.group === 'project' && !row.reason));
  assert.ok((await dom.window.ApplyAssistant.fill(plan.rows)).every(result => result.ok));
  assert.equal(dom.window.document.querySelector('textarea').value, data.project[0].description);
});

test('family duty label cannot change the campus organization anchor', t => {
  const dom = new JSDOM('<section><h2>家庭情况</h2><label>职务名称<input></label></section><section><h2>校园经历</h2><label>学校 / 组织<input></label><label>职务<input></label><label>工作内容<textarea></textarea></label></section>', { url: 'https://new.zhiye.com/form', runScripts: 'outside-only' });
  t.after(() => dom.window.close()); dom.window.HTMLElement.prototype.getClientRects = () => [{}]; dom.window.eval(engine);
  const module = { id: 'custom_campus', label: '校园经历', fields: [{ id: 'org', label: '学校 / 组织' }, { id: 'role', label: '职务' }, { id: 'body', label: '工作内容' }], entries: [{ org: '甲学校', role: '班长', body: '校园工作' }] };
  const rows = dom.window.ApplyAssistant.plan({ basic: {}, education: [], internship: [], project: [], modules: [module] }).rows;
  assert.ok(rows.filter(row => row.group === 'custom_campus').every(row => !row.reason));
  assert.ok(rows.filter(row => row.group === 'thirdParty').every(row => row.reason && !row.value));
});
