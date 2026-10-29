import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { JSDOM } from 'jsdom';
import { emptyProfile, validateProfile } from '../extension/schema.js';

const code = readFileSync(new URL('../extension/engine.js', import.meta.url), 'utf8');
function setup(html) {
  const dom = new JSDOM(html, { url: 'https://app.mokahr.com/apply', runScripts: 'outside-only' });
  dom.window.HTMLElement.prototype.getClientRects = function () { return [{ width: 100, height: 30 }]; };
  dom.window.eval(code);
  return { window: dom.window, document: dom.window.document, api: dom.window.ApplyAssistant };
}

test('height and weight preserve string values and remain compatible with older profiles', () => {
  const old = emptyProfile(); old.basic.name = 'Test applicant';
  const clean = validateProfile(old);
  assert.equal(clean.basic.height, ''); assert.equal(clean.basic.weight, '');
  assert.equal(clean.basic.name, old.basic.name);
  old.basic.height = '175.5'; old.basic.weight = '65.5';
  assert.equal(validateProfile(old).basic.height, '175.5');
  assert.equal(validateProfile(old).basic.weight, '65.5');
});

test('body measurements match only recognized units and preserve existing webpage values', async () => {
  const { api, document, window } = setup('<h2>个人信息</h2><label>身高(cm)*<input type="number"></label><label>体重(kg)*<input type="number" value="64"></label>');
  for (const label of ['身高(cm)', '身高（厘米）', '身高（公分）']) assert.equal(api.classify([label], 'basic'), 'height');
  for (const label of ['体重(kg)', '体重（公斤）', '体重（千克）']) assert.equal(api.classify([label], 'basic'), 'weight');
  for (const label of ['身高(m)', '身高（米）', '体重（斤）', '体重(lb)']) assert.equal(api.classify([label], 'basic'), '');
  const data = emptyProfile(); data.basic.height = '175.5'; data.basic.weight = '65.5';
  const rows = api.plan(data).rows;
  assert.equal(rows.find(row => row.key === 'height').value, '175.5');
  assert.match(rows.find(row => row.key === 'weight').reason, /已有内容/);
  const result = await api.fill(rows);
  assert.equal(result.filter(row => row.ok).length, 1);
  assert.equal(document.querySelectorAll('input')[0].value, '175.5');
  assert.equal(document.querySelectorAll('input')[1].value, '64'); window.close();
});

test('party member aliases are scoped to political status and exclude probationary membership', () => {
  const { api, document, window } = setup('<label>政治面貌<select><option value=""></option><option value="full">中共党员</option><option value="probation">中共预备党员</option></select></label><label>其他信息<select><option value="full">中共党员</option></select></label>');
  const [status, other] = document.querySelectorAll('select');
  assert.equal(api.targetValue(status, '党员').value, 'full');
  assert.ok(api.targetValue(other, '党员').reason);
  status.options[1].textContent = '党员';
  assert.equal(api.targetValue(status, '中共党员').value, 'full');
  status.options[1].remove();
  assert.ok(api.targetValue(status, '党员').reason); window.close();
});

test('Moka political dropdown accepts full membership synonym without selecting probationary membership', async () => {
  const { api, document, window } = setup('<div class="apply-block-test"><div class="blockTitle-test">个人信息</div><div class="apply-field-test"><div class="title-test">政治面貌</div><div class="sd-Dropdown-container-test"><label class="sd-Select-container-test"><span class="sd-Input-display-value-test"></span><input placeholder="请选择"></label><div class="sd-Select-menu-test"><div class="sd-Select-common-item-test"><div class="sd-Menu-container-test">中共预备党员</div></div><div class="sd-Select-common-item-test"><div class="sd-Menu-container-test">中共党员</div></div></div></div></div></div>');
  let chosen = '';
  document.querySelectorAll('.sd-Menu-container-test').forEach(option => { option.onclick = () => { chosen = option.textContent; document.querySelector('.sd-Input-display-value-test').textContent = chosen; }; });
  const data = emptyProfile(); data.basic.politicalStatus = '党员';
  const result = await api.fill(api.plan(data).rows);
  assert.equal(result.filter(row => row.ok).length, 1);
  assert.equal(chosen, '中共党员'); window.close();
});
