import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { JSDOM } from 'jsdom';
const engine = readFileSync(new URL('../extension/engine.js', import.meta.url), 'utf8');
const field = (name, inner = '<input>') => `<div class="apply-field-test"><div class="title-test">${name}</div>${inner}</div>`;
const select = (placeholder = '请选择') => `<div class="sd-Dropdown-container-test"><label class="sd-Select-container-test"><span class="sd-Input-display-value-test"></span><input placeholder="${placeholder}"></label></div>`;
const section = (name, inner) => `<div class="apply-block-test"><div class="blockTitle-test">${name}</div>${inner}</div>`;
const profile = () => ({ basic: {}, education: [{ school: '测试大学' }], internship: [], project: [] });
function setup(t, html) {
  const dom = new JSDOM(html, { url: 'https://app.mokahr.com/campus-recruitment/jomoo/142937#/job/test/apply', runScripts: 'outside-only' });
  dom.window.HTMLElement.prototype.getClientRects = () => [{}];
  dom.window.eval(engine); t.after(() => dom.window.close());
  return { api: dom.window.ApplyAssistant, document: dom.window.document };
}
function bind(input, names) {
  input.onclick = () => {
    const owner = input.closest('.sd-Dropdown-container-test'), menu = input.ownerDocument.createElement('div'); menu.className = 'sd-Select-menu-test';
    for (const name of names) {
      const option = input.ownerDocument.createElement('div'); option.className = 'sd-Select-common-item-test';
      option.innerHTML = `<div class="sd-Menu-container-test">${name}</div>`;
      option.firstChild.onclick = () => { owner.querySelector('span').textContent = name; menu.remove(); };
      menu.append(option);
    }
    owner.append(menu);
  };
}
test('Jomoo shared identity caption separates type dropdown and existing number', async t => {
  const { api, document } = setup(t, section('个人信息', field('证件号码', select('身份证') + '<input value="00000000000000000X">')));
  const data = profile(); data.basic = { identityType: '身份证', identityNumber: '00000000000000000X' };
  bind(document.querySelector('input'), ['身份证', '其他证件']);
  const rows = api.plan(data).rows;
  assert.deepEqual(Array.from(rows, row => row.key), ['identityType', 'identityNumber']);
  assert.equal(rows[0].reason, ''); assert.equal(rows[0].choice, true); assert.match(rows[1].reason, /已有内容/);
  assert.equal((await api.fill(rows.filter(row => !row.reason)))[0].ok, true);
  assert.equal(document.querySelectorAll('input')[1].value, '00000000000000000X');
  assert.equal(document.querySelector('span').textContent, '身份证');
});
test('Jomoo exact education type selects once and never derives full-time from degree', async t => {
  const { api, document } = setup(t, section('教育背景', field('学校名称', '<input value="测试大学">') + field('教育类型', select())));
  const input = document.querySelector('input[placeholder]'); bind(input, ['全日制', '在职', '函授']);
  const data = profile(); data.education[0].degree = '硕士';
  assert.equal(api.plan(data).rows.find(row => row.key === 'studyType').reason, '资料未填写');
  data.education[0].studyType = '全日制';
  const row = api.plan(data).rows.find(row => row.key === 'studyType');
  assert.equal((await api.fill([row]))[0].ok, true);
  assert.equal(document.querySelector('.sd-Input-display-value-test').textContent, '全日制');
});
test('Jomoo addresses, CET scores and class rank use distinct supplied facts', async t => {
  const captions = ['户籍地址', '现居住地址(请详细到省市区/县)', '邮寄地址(请详细到省市区/县)', 'CET4成绩', 'CET6成绩'];
  const { api, document } = setup(t, section('个人信息', captions.map(name => field(name)).join('')) + section('教育背景', field('学校名称', '<input value="测试大学">') + field('班级成绩排名')));
  const data = profile(); data.basic = { hukou: '旧地区信息', address: '旧详细地址', skills: '通过CET-6', hukouAddress: '户籍完整地址', residentialAddress: '居住完整地址', mailingAddress: '邮寄完整地址', cet4Score: '501', cet6Score: '502' };
  data.education[0].classRank = '5/40'; data.education[0].rank = '1/80';
  const rows = api.plan(data).rows.filter(row => !row.reason);
  assert.deepEqual(Array.from(rows, row => row.value), ['户籍完整地址', '居住完整地址', '邮寄完整地址', '501', '502', '5/40']);
  assert.ok((await api.fill(rows)).every(row => row.ok));
  assert.equal(document.querySelectorAll('input')[6].value, '5/40');
});
test('missing personal facts stay blank; existing skills or cities are not converted to scores or addresses', t => {
  const { api } = setup(t, section('个人信息', ['户籍地址', '现居住地址(请详细到省市区/县)', '邮寄地址(请详细到省市区/县)', 'CET4成绩', 'CET6成绩'].map(name => field(name)).join('')) + section('教育背景', field('学校名称', '<input value="测试大学">') + field('班级成绩排名')));
  const data = profile(); data.basic = { hukou: '某省', city: '某市', address: '原详细地址', skills: '通过CET-6' }; data.education[0].rank = '1/80';
  const rows = api.plan(data).rows.filter(row => row.key !== 'school');
  assert.equal(rows.length, 6); assert.ok(rows.every(row => row.key && row.reason === '资料未填写' && !row.value));
});
test('compound identity inference does not apply to unrelated or ambiguous controls', t => {
  for (const caption of ['紧急联系人', '证件号码']) {
    const { api } = setup(t, section('个人信息', field(caption, select() + select() + '<input>')));
    const data = profile(); data.basic = { identityType: '身份证', identityNumber: '00000000000000000X' };
    assert.ok(api.plan(data).rows.every(row => row.reason));
  }
});
