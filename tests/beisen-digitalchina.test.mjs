import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { JSDOM } from 'jsdom';

const engine = readFileSync(new URL('../extension/engine.js', import.meta.url), 'utf8');
export const field = (id, label, value = '') => `<div class="form-item form-item--phoenix"><div class="form-item__title"><label class="form-item__text">${label}</label></div><div class="form-item__control"><div class="phoenix-input"><input id="${id}" value="${value}" placeholder="请输入"></div></div></div>`;
export const section = (id, label, contents) => `<div><div id="${id}">${label}</div><div><div class="ux-standard-form"><div class="form" id="${id}" name="${id}">${contents}</div></div></div></div>`;
export const data = { basic: { name: '测试姓名', phone: '13800000000', birthDate: '2002-11-20', nationality: '中国' }, education: [{ school: '测试大学', major: '会计学', start: '2024-09', end: '2027-06' }], internship: [{ company: '测试实习公司', role: '分析实习生', start: '2025-06', end: '2025-09' }], project: [], modules: [] };
export const fixture = section('basic', '个人信息', field('name', '姓名') + field('nationality', '国籍'))
  + section('education', '教育经历', field('school', '学校名称', '测试大学') + field('major', '专业名称') + field('start', '开始时间') + field('end', '结束时间'))
  + section('work', '工作经历', field('company', '单位名称') + field('role', '职位名称'))
  + section('family', '家庭情况', field('relation', '与本人关系') + field('family-name', '姓名') + field('family-birth', '出生日期') + field('family-company', '工作单位') + field('family-phone', '联系电话'))
  + section('training', '培训经历', field('training-start', '开始时间'))
  + section('extra', '附加问题', field('extra-name', '姓名'));
function setup(t, html = fixture) {
  const dom = new JSDOM(html, { url: 'https://digitalchina.zhiye.com/form', runScripts: 'outside-only' });
  dom.window.HTMLElement.prototype.getClientRects = () => [{}];
  dom.window.SVGElement.prototype.getClientRects = () => [{}];
  dom.window.eval(engine);
  t.after(() => dom.window.close());
  return { api: dom.window.ApplyAssistant, document: dom.window.document, window: dom.window };
}

test('Digitalchina family fields never consume personal or internship data, leaving personal name fillable', async t => {
  const { api, document } = setup(t);
  const plan = api.plan(data);
  const name = plan.rows.find(row => row.group === 'basic' && row.key === 'name');
  assert.equal(name.reason, '');
  const family = plan.rows.filter(row => row.group === 'thirdParty');
  assert.equal(family.length, 5);
  assert.ok(family.every(row => !row.value && row.reason));
  assert.ok(plan.rows.filter(row => row.group === 'unmapped').every(row => !row.value && row.reason));
  const results = await api.fill(plan.rows.filter(row => !row.reason));
  assert.ok(results.every(row => row.ok));
  assert.equal(document.querySelector('#name').value, '测试姓名');
  assert.equal(document.querySelector('#major').value, '会计学');
  for (const id of ['family-name', 'family-company', 'family-birth', 'family-phone']) assert.equal(document.getElementById(id).value, '');
});

const select = (id, label, value = '') => `<div class="form-item form-item--phoenix"><label class="form-item__text">${label}</label><div class="phoenix-select"><input id="${id}" class="phoenix-select__input" value="${value}"><span class="phoenix-select__tipEle">${value}</span></div></div>`;
function bindArea(document, { initial = '', mode = 'normal', mutate } = {}) {
  const input = document.querySelector('#region');
  let clicks = 0, confirms = 0, cancels = 0;
  input.onclick = () => {
    const popup = document.createElement('div'); popup.className = 'common-unmodeled-layer';
    popup.innerHTML = `<div class="area-selector-container"><div class="area-search-input"><input placeholder="搜索"></div><div class="area-data-container"></div><span class="select-data-num-limit">${mode === 'multi' ? '/2' : '/1'}</span><div class="select-data-container">${initial ? `<span class="select-area-text-label">${initial}</span>` : '<div class="select-data-empty"></div>'}</div><div class="area-footer-button"><div class="phoenix-button">取消</div><div class="phoenix-button">确定</div></div></div>`;
    document.body.append(popup);
    popup.querySelector('.area-search-input input').oninput = () => setTimeout(() => {
      mutate?.();
      const name = mode === 'hukou' ? '涿州市' : '海淀区';
      const path = mode === 'hukou' ? '全国/河北省/保定市' : mode === 'wrong-path' ? '全国/天津市' : '全国/北京市/北京市';
      popup.querySelector('.area-data-container').innerHTML = Array.from({ length: mode === 'duplicate' ? 2 : 1 }, () => `<div class="area-item-container"><span class="icon-container"><svg class="area-icon-RadioUnchecked${mode === 'disabled' ? '-disabled' : ''}"></svg></span><span class="area-text-label">${name}</span><div class="area-item-path">${path}</div></div>`).join('');
      popup.querySelectorAll('svg').forEach(icon => icon.onclick = () => {
        clicks++;
        popup.querySelector('.select-data-container').innerHTML = `<span class="select-area-text-label">${name}</span>`;
      });
    }, 220);
    popup.querySelectorAll('.phoenix-button')[0].onclick = () => { cancels++; popup.remove(); };
    popup.querySelectorAll('.phoenix-button')[1].onclick = () => {
      confirms++;
      if (mode === 'no-commit') return;
      input.value = popup.querySelector('.select-area-text-label').textContent;
      document.querySelector('.phoenix-select__tipEle').textContent = input.value;
      popup.remove();
    };
  };
  return { get clicks() { return clicks; }, get confirms() { return confirms; }, get cancels() { return cancels; } };
}

test('Phoenix area searches the terminal region and verifies full ancestry before confirming', async t => {
  for (const mode of ['normal', 'hukou', 'refine']) {
    const initial = mode === 'refine' ? '北京市' : '';
    const { api, document } = setup(t, section('basic', '个人信息', select('region', mode === 'hukou' ? '户口所在地' : '现居住地', initial)));
    const binding = bindArea(document, { initial, mode });
    const profile = { ...data, basic: { city: '北京', residentialAddress: '北京市海淀区演示路99号测试大学', hukouAddress: '河北省保定市涿州市演示街88号' } };
    const row = api.plan(profile).rows[0];
    assert.equal(row.reason, '', mode);
    assert.equal((await api.fill([row]))[0].ok, true, mode);
    assert.equal(binding.clicks, 1); assert.equal(binding.confirms, 1);
    assert.equal(document.querySelector('#region').value, mode === 'hukou' ? '涿州市' : '海淀区');
    assert.match(api.plan(profile).rows[0].reason, /已有内容/);
  }
});

test('Phoenix area rejects incomplete or ambiguous paths, disabled and multi-select options, and unconfirmed commits', async t => {
  for (const mode of ['wrong-path', 'duplicate', 'disabled', 'multi', 'no-commit']) {
    const { api, document } = setup(t, section('basic', '个人信息', select('region', '现居住地')));
    const binding = bindArea(document, { mode });
    const row = api.plan({ ...data, basic: { residentialAddress: '北京市海淀区学院路15号' } }).rows[0];
    assert.equal((await api.fill([row]))[0].ok, false, mode);
    assert.equal(binding.confirms, mode === 'no-commit' ? 1 : 0, mode);
    assert.equal(document.querySelector('#region').value, '');
  }
});

test('Phoenix area stops on user edits or navigation and preserves unrelated selected cities', async t => {
  for (const mode of ['stop', 'route', 'input', 'selected']) {
    const initial = mode === 'selected' ? '上海市' : '';
    const { api, document, window } = setup(t, section('basic', '个人信息', select('region', '现居住地', initial)));
    const binding = bindArea(document, { initial, mutate: () => {
      if (mode === 'stop') api.stop();
      if (mode === 'route') window.history.pushState({}, '', '#other');
      if (mode === 'input') document.querySelector('.area-search-input input').value = '用户搜索';
    } });
    const row = api.plan({ ...data, basic: { residentialAddress: '北京市海淀区学院路15号' } }).rows[0];
    assert.equal((await api.fill([row]))[0].ok, false, mode);
    assert.equal(binding.clicks, 0); assert.equal(binding.confirms, 0);
    assert.equal(document.querySelector('#region').value, initial);
  }
});

test('Phoenix monthly calendar waits for its delayed body and confirms formatted month and closed popup', async t => {
  const { api, document } = setup(t, section('edu', '教育经历', field('school', '学校名称', '测试大学') + select('month', '开始时间')));
  const input = document.querySelector('#month');
  input.onclick = () => {
    const popup = document.createElement('div'); popup.className = 'common-unmodeled-layer'; document.body.append(popup);
    setTimeout(() => {
      popup.innerHTML = '<div class="phoenix-date-picker"><div class="phoenix-calendar-month-calendar"><span class="phoenix-calendar-month-panel-year-select-content">2024</span><table><tbody><tr><td><a class="phoenix-calendar-month-panel-month">9月</a></td></tr></tbody></table></div></div>';
      popup.querySelector('td').onclick = () => { input.value = '2024/09'; document.querySelector('.phoenix-select__tipEle').textContent = input.value; popup.remove(); };
    }, 160);
  };
  const row = api.plan(data).rows.find(row => row.key === 'start');
  assert.equal((await api.fill([row]))[0].ok, true);
  assert.equal(input.value, '2024/09');
});

test('Unknown Phoenix section headings block label fallback even beside known personal sections', t => {
  const { api } = setup(t, fixture + section('unknown', '其他人员资料', field('unknown-name', '姓名') + field('unknown-company', '工作单位')));
  const plan = api.plan(data);
  assert.equal(plan.rows.filter(row => row.group === 'basic' && row.key === 'name').length, 1);
  const unknown = plan.rows.slice(-2);
  assert.ok(unknown.every(row => row.group === 'unmapped' && !row.value && row.reason));
});

test('Digitalchina work section uses authorized internship records while preserving internship titles', async t => {
  const { api, document } = setup(t);
  const plan = api.plan(data);
  const work = plan.rows.filter(row => row.group === 'internship');
  assert.equal(work.length, 2); assert.ok(work.every(row => !row.reason));
  assert.ok((await api.fill(work)).every(row => row.ok));
  assert.equal(document.querySelector('#company').value, '测试实习公司');
  assert.equal(document.querySelector('#role').value, '分析实习生');
  assert.equal(document.querySelector('#family-company').value, '');
});
