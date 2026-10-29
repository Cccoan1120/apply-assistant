import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { JSDOM } from 'jsdom';
const code = readFileSync(new URL('../extension/engine.js', import.meta.url), 'utf8');
const profile = { basic: {}, education: [], internship: [], project: [] };
const field = (label, content) => `<div class="apply-field-test"><div class="title-test">${label}</div>${content}</div>`;
const choice = (value = '') => `<div class="sd-Dropdown-container-test"><label class="sd-Select-container-test"><span class="sd-Input-display-value-test">${value}</span><input></label></div>`;
const section = (label, content) => `<div class="apply-block-test"><div class="blockTitle-test">${label}</div>${content}</div>`;
function setup(html) {
  const dom = new JSDOM(html, { url: 'https://app.mokahr.com/campus-recruitment/test/1#/job/test/apply', runScripts: 'outside-only' });
  const { window } = dom; window.HTMLElement.prototype.getClientRects = () => [{}]; window.eval(code);
  return { api: window.ApplyAssistant, document: window.document, window };
}
function bindSelect(input, commit) {
  input.onclick = () => {
    const owner = input.closest('[class*="sd-Dropdown-container-"]'), menu = input.ownerDocument.createElement('div');
    menu.className = 'sd-Select-menu-test'; menu.innerHTML = '<div class="sd-Select-common-item-test"><div class="sd-Menu-container-test"><div class="sd-Menu-content-item-test"><div>是</div></div></div></div>';
    owner.append(menu);
    // Moka's outer common-item has no selection handler. Only the nested menu handles it.
    menu.querySelector('.sd-Menu-container-test').onclick = () => { owner.querySelector('[class*="sd-Input-display-value-"]').textContent = '是'; menu.remove(); commit?.(); };
  };
}
test('Moka selects the inner menu handler and reveals conditional experience blocks before adding', async () => {
  const { api, document } = setup(section('实习经历', '<div class="entries"></div><button type="button">添加</button>'));
  let added = 0;
  const create = () => {
    const block = document.createElement('div'); block.innerHTML = field('是否有实习经历', choice());
    document.querySelector('.entries').append(block);
    bindSelect(block.querySelector('input'), () => { block.insertAdjacentHTML('beforeend', field('公司名称', '<input>') + field('工作职责', '<textarea></textarea>')); });
  };
  create(); document.querySelector('button').onclick = () => { added++; create(); };
  const data = { ...profile, internship: [{ company: '公司A', description: '描述A' }, { company: '公司B', description: '描述B' }] };
  const result = await api.prepare(data); assert.equal(result.results[0].reason, ''); assert.equal(added, 1);
  const rows = api.plan(data).rows.filter(row => !row.reason); assert.equal((await api.fill(rows)).filter(row => row.ok).length, 4);
  assert.deepEqual([...document.querySelectorAll('textarea')].map(n => n.value), ['描述A', '描述B']);
  await api.prepare(data); assert.equal(added, 1);
});
test('Moka does not change an explicit no-experience choice or reveal a module without source records', async () => {
  const { api, document } = setup(section('实习经历', field('是否有实习经历', choice('否')) + '<button type="button">添加</button>'));
  let clicked = 0; document.querySelector('button').onclick = () => clicked++;
  const results = await api.prepare({ ...profile, internship: [{ company: '公司A' }] });
  assert.match(results.results[0].reason, /经历开关/); assert.equal(clicked, 0);
  assert.equal((await api.prepare(profile)).results.length, 0);
});
test('matched experience differences require explicit replacement and can be undone without changing identity', async () => {
  const { api, document } = setup(section('实习经历', field('公司名称', '<input value="公司A">') + field('职位名称', '<input value="旧职位">') + field('工作职责', '<textarea>旧内容</textarea>')) + section('项目经验', field('项目名称', '<input value="其他项目">') + field('项目描述', '<textarea>保留内容</textarea>')));
  const data = { ...profile, internship: [{ company: '公司A', role: '财务职位', description: '财务模板原文' }], project: [{ name: '目标项目', description: '项目原文' }] };
  const rows = api.plan(data).rows; const differences = rows.filter(row => row.canReplace);
  assert.equal(differences.length, 2); assert.equal((await api.fill(differences)).filter(row => row.ok).length, 0);
  assert.equal(document.querySelector('textarea').value, '旧内容');
  assert.ok((await api.replace(differences)).every(row => row.ok));
  assert.equal(document.querySelector('textarea').value, '财务模板原文');
  assert.equal(document.querySelectorAll('textarea')[1].value, '保留内容');
  assert.equal(api.undo().restored, 2); assert.equal(document.querySelector('textarea').value, '旧内容');
});
test('replacement rejects stale identity, changed text, stale previews and altered template values', async () => {
  for (const change of ['identity', 'move-identity', 'text', 'rescan', 'value']) {
    const { api, document } = setup(section('实习经历', field('公司名称', '<input value="公司A">') + field('工作职责', '<textarea>旧内容</textarea>')));
    const row = api.plan({ ...profile, internship: [{ company: '公司A', description: '模板原文' }] }).rows.find(row => row.canReplace);
    if (change === 'identity') document.querySelector('input').value = '公司B';
    if (change === 'move-identity') document.body.append(document.querySelector('input'));
    if (change === 'text') document.querySelector('textarea').value = '用户修改';
    if (change === 'rescan') api.scan('basic');
    if (change === 'value') row.value = '篡改内容';
    assert.equal((await api.replace([row]))[0].ok, false);
  }
});
function regionSetup({ confirm = false, wrong = false, interrupt } = {}) {
  const { api, document, window } = setup(section('个人信息', '<div class="apply-field-test location_info-test"><div class="title-test">籍贯</div><div class="sd-Dropdown-container-test"><input readonly></div></div>'));
  const input = document.querySelector('input'), owner = input.parentElement; let confirmed = 0;
  input.onclick = () => {
    let level = 0, parts = []; const menu = document.createElement('div'); menu.className = 'menu-wrapper-test'; owner.append(menu);
    const render = () => {
      menu.innerHTML = `<div class="sd-Tabs-active-test"><span class="sd-Ellipsis-test">${['省份', '城市', '县区'][level]}</span></div><div class="alphabet-test"><span><div class="sd-Tag-text-test">${['河北', '保定市', wrong ? '莲池区' : '涿州市'][level]}</div></span></div>`;
      menu.querySelector('.sd-Tag-text-test').onclick = () => {
        parts.push(['河北', '保定市', '涿州市'][level]); input.value = parts.join(' ');
        if (level < 2) { level++; render(); interrupt?.(api, input, window); }
        else if (confirm) {
          menu.innerHTML = '<div class="confirm-test"><button type="button">确认</button></div>';
          menu.querySelector('button').onclick = () => { confirmed++; menu.remove(); };
        } else { confirmed++; menu.remove(); }
      };
    }; render();
  };
  return { api, input, window, get confirmed() { return confirmed; } };
}
test('Moka region selector follows province/city/district and accepts only the completed path', async () => {
  for (const confirm of [true, false]) {
    const state = regionSetup({ confirm });
    const row = state.api.plan({ ...profile, basic: { nativePlace: '河北省保定市涿州市' } }).rows[0];
    assert.equal(row.choice, true); assert.equal(row.reason, '');
    assert.equal((await state.api.fill([row]))[0].ok, true); assert.equal(state.confirmed, 1);
    assert.equal(state.input.value, '河北 保定市 涿州市');
  }
});
test('Moka never confirms a missing county, partial template or interrupted region transaction', async () => {
  for (const mode of ['wrong', 'partial', 'stop', 'user', 'route']) {
    const state = regionSetup({ wrong: mode === 'wrong', interrupt: (api, input, window) => {
      if (mode === 'stop') api.stop(); if (mode === 'user') input.value = '用户选择'; if (mode === 'route') window.history.pushState({}, '', '#other');
    } });
    const row = state.api.plan({ ...profile, basic: { nativePlace: mode === 'partial' ? '河北省保定市' : '河北省保定市涿州市' } }).rows[0];
    assert.equal((await state.api.fill([row]))[0].ok, false); assert.equal(state.confirmed, 0);
    if (mode === 'user') assert.equal(state.input.value, '用户选择'); state.window.close();
  }
});
