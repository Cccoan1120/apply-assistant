import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { JSDOM } from 'jsdom';
import { validateProfile, emptyProfile } from '../extension/schema.js';
const code = readFileSync(new URL('../extension/engine.js', import.meta.url), 'utf8');
function setup(html, url = 'https://jobs.mokahr.com/apply') {
  const dom = new JSDOM(html, { url, runScripts: 'outside-only' });
  dom.window.HTMLElement.prototype.getClientRects = function () { return [{ width: 100, height: 30 }]; };
  dom.window.eval(code);
  return { window: dom.window, document: dom.window.document, engine: dom.window.ApplyAssistant };
}
test('classifies exact labels and refuses conflicting or unrelated names', () => {
  const { engine } = setup('');
  assert.equal(engine.classify(['请输入手机号码 *'], 'basic'), 'phone');
  assert.equal(engine.classify(['姓名', 'email'], 'basic'), '');
  assert.equal(engine.classify(['紧急联系人姓名'], 'basic'), '');
  assert.equal(engine.classify(['出生日期'], 'basic'), 'birthDate');
  assert.equal(engine.classify(['学位'], 'education'), 'academicDegree');
  assert.equal(engine.classify(['学历', '学位'], 'education'), '');
});
test('recognizes platform wrappers; omits sensitive, hidden, disabled and consent fields', () => {
  for (const [url, platform] of [['https://a.mokahr.com/x', 'Moka'], ['https://a.hotjob.cn/x', '北森'], ['https://a.feishu.cn/x', '飞书招聘']]) {
    const { engine } = setup('<div class="ant-form-item"><div class="ant-form-item-label">姓名</div><input></div><label>验证码<input></label><input type="password"><input type="checkbox"><input hidden><input disabled><input style="display:none">', url);
    const result = engine.scan('basic'); assert.equal(result.platform, platform); assert.equal(result.rows.length, 1); assert.equal(result.rows[0].key, 'name');
  }
});
test('readable labels take priority over misleading technical IDs', () => {
  const { engine } = setup('<label for="name">紧急联系人姓名</label><input id="name"><label for="email">项目名称</label><input id="email">');
  assert.ok(engine.scan('basic').rows.every(row => !row.key));
});
test('select option text does not contaminate an enclosing label', () => {
  const { engine } = setup('<label>性别<select><option>请选择</option><option>男</option></select></label>');
  assert.equal(engine.scan('basic').rows[0].key, 'gender');
});
test('native setters emit framework events, preserve existing values, undo preserves later edits', async () => {
  const { engine, document } = setup('<label>姓名<input></label><label>手机<input value="original"></label><label>邮箱<input></label>');
  const rows = engine.scan('basic').rows; let inputs = 0; document.addEventListener('input', () => inputs++);
  const results = await engine.fill(rows.map((row, i) => ({ id: row.id, value: ['测试', '123', 'test@example.com'][i] })));
  assert.equal(results.filter(row => row.ok).length, 2); assert.equal(inputs, 2);
  document.querySelector('input').value = 'edited';
  const undo = engine.undo(); assert.equal(undo.restored, 1); assert.equal(undo.skipped, 1);
  assert.equal(document.querySelectorAll('input')[0].value, 'edited'); assert.equal(document.querySelectorAll('input')[1].value, 'original'); assert.equal(document.querySelectorAll('input')[2].value, '');
});
test('changed, replaced and newly populated controls are never filled from stale preview', async () => {
  const { engine, document } = setup('<label>姓名<input></label><label>邮箱<input></label><label>手机<input></label>');
  const rows = engine.scan('basic').rows;
  const controls = document.querySelectorAll('input'); controls[0].setAttribute('aria-label', '其他字段'); controls[1].remove(); controls[2].value = 'manual';
  const results = await engine.fill(rows.map(row => ({ id: row.id, value: 'test' }))); assert.equal(results.filter(row => row.ok).length, 0);
});
test('custom widgets, length limits, dates and ambiguous selects require manual handling', async () => {
  const { engine, document } = setup('<input readonly><input maxlength="2"><input type="date"><input type="month"><select><option>请选择</option><option value="m">男</option></select><select><option>本科</option><option>本科</option></select>');
  const fields = document.querySelectorAll('input,select');
  assert.ok(engine.targetValue(fields[0], '北京').reason); assert.ok(engine.targetValue(fields[1], 'abc').reason); assert.ok(engine.targetValue(fields[2], '2025-09').reason);
  assert.equal(engine.targetValue(fields[3], '2025-09').value, '2025-09'); assert.equal(engine.targetValue(fields[4], '男').value, 'm'); assert.ok(engine.targetValue(fields[5], '本科').reason);
});
test('schema rejects invalid imports and strips unknown keys', () => {
  const profile = emptyProfile(); profile.basic.name = '测试'; profile.basic.unknown = 'discard'; assert.equal(validateProfile(profile).basic.unknown, undefined);
  profile.internship = 'bad'; assert.throws(() => validateProfile(profile)); assert.throws(() => validateProfile({ version: 1, basic: [] }));
});
