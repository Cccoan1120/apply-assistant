import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { JSDOM } from 'jsdom';
const source = readFileSync(new URL('../extension/engine.js', import.meta.url), 'utf8');
const profile = { basic: { identityNumber: 'TEST-ID-000X', birthMonth: '2000-01' }, education: [{ school: 'Test school', start: '2020-09', end: '2024-06', rank: '前10%', studyType: '全日制' }], internship: [], project: [] };
function setup(t, html) {
  const dom = new JSDOM(html, { url: 'https://example.jobs.feishu.cn/resume/apply', runScripts: 'outside-only' });
  dom.window.HTMLElement.prototype.getClientRects = () => [{}];
  dom.window.eval(source); t.after(() => dom.window.close());
  return { engine: dom.window.ApplyAssistant, document: dom.window.document };
}

test('rank examples and education type match; shared native month range has separate endpoints', async t => {
  const {engine,document} = setup(t, `<section><h2>教育经历</h2><label>学校名称<input></label>
    <div class="atsx-form-item"><label>起止时间 *</label><div><input type="month"><span>-</span><input type="month"></div></div>
    <label>成绩排名（例：前10%） *<input></label><label>学历类型<select><option value="">请选择</option><option>全日制</option></select></label></section>`);
  const rows = engine.plan(profile).rows;
  assert.deepEqual(Array.from(rows, row => row.key), ['school','start','end','rank','studyType']);
  assert.ok(rows.every(row => !row.reason));
  assert.ok((await engine.fill(rows)).every(row => row.ok));
  assert.deepEqual(Array.from(document.querySelectorAll('input[type=month]'), el=>el.value), ['2020-09','2024-06']);
});

test('identity is explicitly matched while other-person identity and login secrets stay untouched', async t => {
  const {engine,document} = setup(t, '<label>身份证号<input id="id"></label><label>紧急联系人身份证号码<input id="other"></label><label>验证码<input id="otp"></label><label>出生日期<input type="date" id="birth"></label>');
  const rows = engine.plan(profile).rows;
  assert.equal(rows.length, 3);
  assert.match(rows.find(row=>row.key==='birthDate').reason, /资料未填写/);
  await engine.fill(rows.filter(row=>!row.reason));
  assert.equal(document.getElementById('id').value,'TEST-ID-000X');
  for (const id of ['other','otp','birth']) assert.equal(document.getElementById(id).value,'');
});

// Reproduces the ATS dropdown structure observed on Feishu's public login UI.
test('ATS hidden search does not hide the combobox; aria-controls may name a listbox wrapper', async t => {
  const {engine,document} = setup(t, `<section><h2>教育经历</h2><label>学校名称<input></label><label>学历类型</label>
    <div class="atsx-select"><div class="atsx-select-selection" role="combobox" aria-controls="owned" aria-expanded="false" tabindex="0"><div class="atsx-select-search" style="display:none"><input></div></div></div></section>
    <div id="owned" hidden><ul role="listbox"><li role="option">全日制</li></ul></div><div role="listbox"><div role="option">全日制</div></div>`);
  const combo = document.querySelector('[role=combobox]'), menu=document.getElementById('owned');
  combo.onclick = () => { menu.hidden=false; combo.setAttribute('aria-expanded','true'); };
  menu.querySelector('[role=option]').onclick=()=>{ const selected=document.createElement('div'); selected.className='atsx-select-selection-selected-value'; selected.textContent='全日制'; combo.append(selected); menu.hidden=true; combo.setAttribute('aria-expanded','false'); };
  const rows=engine.plan(profile).rows;
  assert.equal(rows.length,2); assert.equal(rows[1].choice,true,JSON.stringify(rows));
  assert.equal((await engine.fill(rows))[1].ok,true);
  assert.equal(engine.plan(profile).rows[1].current,'全日制');
});
