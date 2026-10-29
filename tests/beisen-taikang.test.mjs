import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { JSDOM } from 'jsdom';

const engine = readFileSync(new URL('../extension/engine.js', import.meta.url), 'utf8');
const field = (label, control = '<input>') => `<div class="form-item form-item--phoenix"><label class="form-item__text">${label}</label>${control}</div>`;
const record = (company = '', description = '') => `<div class="record">${field('单位名称', `<input class="company" value="${company}">`)}${field('工作地点', '<select><option></option><option>北京</option></select>')}${field('开始时间', '<input type="month">')}${field('结束时间', '<input type="month">')}${field('所属行业', '<select><option></option><option>金融</option></select>')}${field('职业类别', '<select><option></option><option>财务</option></select>')}${field('部门')}${field('职位名称', '<input class="role">')}${field('工作职责', `<textarea>${description}</textarea>`)}</div>`;
const section = (id, label, body) => `<section><div id="${id}">${label}</div><div class="ux-standard-form"><div class="form" id="${id}">${body}</div></div></section>`;
const profile = count => ({ basic: {}, education: [], project: [], modules: [], internship: Array.from({ length: count }, (_, i) => ({ company: `测试公司${i + 1}`, role: `财务实习生${i + 1}`, start: '2025-06', end: '2025-09', description: `已确认的实习职责${i + 1}` })) });
function setup(t, { host = 'jobtaikang.zhiye.com', records = record() } = {}) {
  const dom = new JSDOM(section('work', '工作经历', `<div class="records">${records}</div><button type="button" id="add">添加工作经历</button>`)
    + section('family', '家庭情况', field('姓名') + field('工作单位'))
    + '<button id="save">暂存</button><button id="submit">预览并提交</button>', { url: `https://${host}/form`, runScripts: 'outside-only' });
  dom.window.HTMLElement.prototype.getClientRects = () => [{}];
  dom.window.SVGElement.prototype.getClientRects = () => [{}];
  dom.window.eval(engine);
  t.after(() => dom.window.close());
  const document = dom.window.document, events = { added: 0, save: 0, submit: 0 };
  document.querySelector('#add').onclick = () => { events.added++; document.querySelector('.records').insertAdjacentHTML('beforeend', record()); };
  for (const key of ['save', 'submit']) document.getElementById(key).onclick = () => events[key]++;
  return { api: dom.window.ApplyAssistant, document, events };
}

test('Taikang work section expands the selected internship version and preserves internship titles', async t => {
  for (const count of [3, 4]) {
    const { api, document, events } = setup(t), data = profile(count);
    await api.prepare(data);
    assert.equal(events.added, count - 1);
    const rows = api.plan(data).rows;
    assert.equal(rows.filter(row => row.group === 'internship' && !row.reason).length, count * 5);
    assert.ok((await api.fill(rows.filter(row => !row.reason))).every(result => result.ok));
    assert.deepEqual([...document.querySelectorAll('.company')].map(el => el.value), data.internship.map(entry => entry.company));
    assert.deepEqual([...document.querySelectorAll('.role')].map(el => el.value), data.internship.map(entry => entry.role));
    assert.deepEqual([...document.querySelectorAll('textarea')].map(el => el.value), data.internship.map(entry => entry.description));
    assert.ok([...document.querySelectorAll('select,.form#family input')].every(el => el.value === ''));
    assert.ok(rows.filter(row => row.key === 'department').every(row => !row.value && row.reason));
    await api.prepare(data);
    assert.equal(events.added, count - 1);
    assert.equal(events.save, 0); assert.equal(events.submit, 0);
  }
});

test('Taikang keeps existing duties and matches named internships before empty records', async t => {
  const { api, document } = setup(t, { records: record('测试公司2', '网页已有职责') + record() });
  const data = profile(2), rows = api.plan(data).rows;
  assert.equal(rows.find(row => row.key === 'role').value, '财务实习生2');
  await api.fill(rows.filter(row => !row.reason));
  assert.deepEqual([...document.querySelectorAll('.company')].map(el => el.value), ['测试公司2', '测试公司1']);
  assert.equal(document.querySelector('textarea').value, '网页已有职责');
});

test('Taikang unknown existing companies block additions instead of duplicating or guessing internships', async t => {
  const { api, document, events } = setup(t, { records: record('未在模板中的公司') });
  await api.prepare(profile(4));
  assert.equal(events.added, 0);
  const rows = api.plan(profile(4)).rows;
  assert.ok(rows.filter(row => row.group === 'internship').every(row => row.reason));
  await api.fill(rows.filter(row => !row.reason));
  assert.equal(document.querySelector('.role').value, '');
});

test('Work-only structural mapping supports new employers without a tenant allowlist', async t => {
  for (const host of ['other.zhiye.com', 'jobtaikang.zhiye.com.example.org']) {
    const { api, document, events } = setup(t, { host });
    await api.prepare(profile(4));
    const rows = api.plan(profile(4)).rows;
    assert.equal(events.added, 3);
    assert.ok(rows.some(row => row.group === 'internship'));
    await api.fill(rows.filter(row => !row.reason));
    assert.equal(document.querySelector('.company').value, '测试公司1');
  }
});

test('Taikang separates responsibilities and achievements while selecting only known internship fields', async t => {
  const { api, document } = setup(t);
  document.querySelector('.record').insertAdjacentHTML('beforeend', field('工作业绩', '<textarea class="results"></textarea>') + field('工作性质', '<select class="nature"><option></option><option>全职</option><option>实习</option></select>'));
  const data = profile(1); data.internship[0].location = '北京';
  const rows = api.plan(data).rows;
  const duty = rows.find(row => row.key === 'description');
  assert.equal(duty.reason, '');
  assert.equal(rows.find(row => row.key === 'results').reason, '资料未填写');
  assert.ok((await api.fill(rows.filter(row => !row.reason))).every(result => result.ok));
  assert.equal(document.querySelector('textarea').value, data.internship[0].description);
  assert.equal(document.querySelector('.results').value, '');
  assert.equal(document.querySelector('select').value, '北京');
  assert.equal(document.querySelector('.nature').value, '实习');
  const next = profile(1); next.internship[0].results = '用户明确提供的工作业绩';
  const resultRow = api.plan(next).rows.find(row => row.key === 'results');
  assert.equal((await api.fill([resultRow]))[0].ok, true);
  assert.equal(document.querySelector('.results').value, next.internship[0].results);
  assert.equal(document.querySelector('textarea').value, data.internship[0].description);
});

test('Taikang explicitly supplied industry, occupation and work type take precedence over defaults', async t => {
  const { api, document } = setup(t);
  document.querySelector('.record').insertAdjacentHTML('beforeend', field('工作性质', '<select class="nature"><option></option><option>全职</option><option>实习</option></select>'));
  const data = profile(1);
  Object.assign(data.internship[0], { location: '北京', industry: '金融', occupation: '财务', employmentType: '全职' });
  await api.fill(api.plan(data).rows.filter(row => !row.reason));
  assert.deepEqual([...document.querySelectorAll('select')].map(el => el.value), ['北京', '金融', '财务', '全职']);
});

test('Taikang Beijing workplace selects the municipality without guessing a district', async t => {
  for (const mode of ['city', 'district', 'duplicate']) {
    const { api, document } = setup(t);
    document.querySelector('select').outerHTML = '<div class="phoenix-select"><input class="location"><span class="phoenix-select__tipEle"></span></div>';
    const input = document.querySelector('.location');
    let confirmed = 0;
    input.onclick = () => {
      const popup = document.createElement('div'); popup.className = 'common-unmodeled-layer';
      popup.innerHTML = '<div class="area-selector-container"><div class="area-search-input"><input placeholder="搜索"></div><div class="area-data-container"></div><span class="select-data-num-limit">/1</span><div class="select-data-container"><div class="select-data-empty"></div></div><div class="area-footer-button"><button class="phoenix-button">取消</button><button class="phoenix-button">确定</button></div></div>';
      document.body.append(popup);
      popup.querySelector('.area-search-input input').oninput = () => {
        popup.querySelector('.area-data-container').innerHTML = Array.from({ length: mode === 'duplicate' ? 2 : 1 }, () => `<div class="area-item-container"><span class="icon-container"><svg class="area-icon-RadioUnchecked"></svg></span><span class="area-text-label">${mode === 'district' ? '海淀区' : '北京市'}</span><div class="area-item-path">全国${mode === 'district' ? '/北京市' : ''}</div></div>`).join('');
        popup.querySelectorAll('svg').forEach(icon => icon.onclick = () => { popup.querySelector('.select-data-container').innerHTML = '<span class="select-area-text-label">北京市</span>'; });
      };
      popup.querySelectorAll('button')[0].onclick = () => popup.remove();
      popup.querySelectorAll('button')[1].onclick = () => { confirmed++; input.value = '北京市'; document.querySelector('.phoenix-select__tipEle').textContent = '北京市'; popup.remove(); };
    };
    const data = profile(1); data.internship[0].location = '北京';
    const row = api.plan(data).rows.find(row => row.key === 'location');
    const result = (await api.fill([row]))[0];
    assert.equal(result.ok, mode === 'city', `${mode}: ${result.reason}`);
    assert.equal(confirmed, mode === 'city' ? 1 : 0);
    assert.equal(input.value, mode === 'city' ? '北京市' : '');
    assert.equal(data.internship[0].location, '北京');
  }
});
