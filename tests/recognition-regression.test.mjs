import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { JSDOM } from 'jsdom';

const code = readFileSync(new URL('../extension/engine.js', import.meta.url), 'utf8');

// Constructed fixtures reproduce the visible field layout, not a captured website DOM.
function setup(html) {
  const dom = new JSDOM(html, {
    url: 'https://app.mokahr.com/campus_apply/example/123#/candidateHome/resume',
    runScripts: 'outside-only'
  });
  dom.window.HTMLElement.prototype.getClientRects = function () {
    return [{ width: 100, height: 30 }];
  };
  dom.window.eval(code);
  return { document: dom.window.document, engine: dom.window.ApplyAssistant };
}

test('Moka editable select search inputs reject phone and email as plain text', async () => {
  const { document, engine } = setup(`
    <div><div>工作经验</div><div class="atsx-select"><input placeholder="请选择"></div></div>
    <div><div>最高学历</div><div class="atsx-select"><input placeholder="请选择"></div></div>
  `);
  const values = ['13800000000', 'candidate@example.com'];
  const fields = [...document.querySelectorAll('input')];
  for (const [index, field] of fields.entries()) {
    assert.ok(engine.targetValue(field, values[index]).reason,
      'A select search box must not accept arbitrary resume text');
  }
  const rows = engine.scan('basic').rows;
  const results = await engine.fill(rows.map((row, index) => ({ id: row.id, value: values[index] })));
  assert.equal(results.filter(result => result.ok).length, 0);
  assert.deepEqual(fields.map(field => field.value), ['', '']);
});

test('sibling div captions identify each field without borrowing a broad wrapper label', () => {
  const { engine } = setup(`
    <div class="form-item">
      <label>姓名</label>
      <div><div>姓名</div><input placeholder="请输入"></div>
      <div><div>手机号码</div><input placeholder="请输入"></div>
      <div><div>最高学历</div><div class="atsx-select"><input placeholder="请选择"></div></div>
    </div>
  `);
  const rows = engine.scan('basic').rows;
  assert.equal(rows[0].label, '姓名');
  assert.equal(rows[0].key, 'name');
  assert.equal(rows[1].label, '手机号码');
  assert.equal(rows[1].key, 'phone');
  assert.equal(rows[2].label, '最高学历');
  assert.ok(!['name', 'phone', 'email'].includes(rows[2].key));
});

test('a work-experience caption outranks a misleading phone name and generic placeholder', () => {
  const { engine } = setup(`
    <div><div>工作经验</div><div class="atsx-select"><input name="phone" placeholder="请选择"></div></div>
  `);
  const [row] = engine.scan('basic').rows;
  assert.equal(row.label, '工作经验');
  assert.equal(row.key, '');
});

test('custom date pickers never accept names or email addresses as date text', async () => {
  const { document, engine } = setup(`
    <div><div>出生日期（年龄）</div><div class="atsx-date-picker"><input placeholder="出生日期（年龄）"></div></div>
    <div><div>入学时间</div><div class="atsx-picker"><input placeholder="请选择"></div></div>
  `);
  const fields = [...document.querySelectorAll('input')];
  const values = ['测试姓名', 'candidate@example.com'];
  for (const field of fields) {
    for (const value of values) assert.ok(engine.targetValue(field, value).reason);
  }
  const rows = engine.scan('basic').rows;
  const results = await engine.fill(rows.map((row, index) => ({ id: row.id, value: values[index] })));
  assert.equal(results.filter(result => result.ok).length, 0);
  assert.deepEqual(fields.map(field => field.value), ['', '']);
});

test('a reused input moved to another experience rejects the previous fill plan', async () => {
  const { document, engine } = setup(`
    <section><h2>实习经历</h2>
      <div class="experience-item" id="first"><h3>实习经历 1</h3><label>公司名称<input></label></div>
      <div class="experience-item" id="second"><h3>实习经历 2</h3></div>
    </section>
  `);
  const [row] = engine.scan('internship').rows;
  const field = document.querySelector('input');
  document.querySelector('#second').append(document.querySelector('#first label'));
  const [result] = await engine.fill([{ id: row.id, value: '第一段经历公司' }]);
  assert.equal(result.ok, false);
  assert.equal(field.value, '');
});
