import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { JSDOM } from 'jsdom';
import { emptyProfile, validateProfile } from '../extension/schema.js';

const code = readFileSync(new URL('../extension/engine.js', import.meta.url), 'utf8');
const field = (name, control = '<input>') => `<div class="form-item"><label class="form-item__text">${name}</label>${control}</div>`;
const section = (id, label, body, add = false) => `<section><div id="${id}">${label}</div><div class="ux-standard-form"><div class="form" id="${id}"><div class="records">${body}</div>${add ? `<button type="button" class="add">添加${label}</button>` : ''}</div></div></section>`;
const award = (name = '', level = '') => `<div class="record">${field('级别', `<input value="${level}">`)}${field('名称', `<input class="award-name" value="${name}">`)}${field('获取时间', '<input type="month">')}</div>`;
const campus = (name = '', duty = '') => `<div class="record">${field('开始时间', '<input type="month">')}${field('结束时间', '<input type="month">')}${field('社团名称', `<input class="campus-name" value="${name}">`)}${field('社团职务')}${field('工作职责', `<input class="duty" value="${duty}">`)}</div>`;
function profile() {
  return validateProfile({ ...emptyProfile(), modules: [
    { id: 'custom_awards', label: '获奖经历', fields: [
      { id: 'field_name', label: '奖项名称', type: 'text' },
      { id: 'field_level', label: '奖项级别', type: 'text' },
      { id: 'field_date', label: '获奖年份', type: 'month' }
    ], entries: Array.from({ length: 9 }, (_, index) => ({ field_name: `测试奖项${index + 1}`, field_level: index % 2 ? '校级' : '省级', field_date: `2025-${String(index + 1).padStart(2, '0')}` })) },
    { id: 'custom_campus', label: '校园经历', fields: [
      { id: 'field_name', label: '学校 / 组织', type: 'text' },
      { id: 'field_role', label: '职务', type: 'text' },
      { id: 'field_start', label: '开始时间', type: 'month' },
      { id: 'field_end', label: '结束时间', type: 'month' },
      { id: 'field_duty', label: '工作内容', type: 'textarea' }
    ], entries: [
      { field_name: '测试学生会', field_role: '部门成员', field_start: '2022-09', field_end: '2023-06', field_duty: '协调活动报名，整理活动记录。' },
      { field_name: '测试社团', field_role: '社团成员', field_start: '2023-09', field_end: '2024-06', field_duty: '整理资料并参与社团活动。' }
    ] }
  ] });
}
function setup(t, body, url = 'https://gjzq.zhiye.com/form') {
  const dom = new JSDOM(body + '<button class="save">暂存</button><button class="submit">预览并提交</button>', { url, runScripts: 'outside-only' });
  dom.window.HTMLElement.prototype.getClientRects = () => [{}];
  dom.window.eval(code);
  t.after(() => dom.window.close());
  const document = dom.window.document, events = { awards: 0, campus: 0, save: 0, submit: 0 };
  for (const [id, create] of [['awards', award], ['campus', campus]]) {
    const form = document.querySelector(`.form#${id}`), button = form?.querySelector('.add');
    if (button) button.onclick = () => { events[id]++; form.querySelector('.records').insertAdjacentHTML('beforeend', create()); };
  }
  for (const key of ['save', 'submit']) document.querySelector(`.${key}`).onclick = () => events[key]++;
  return { api: dom.window.ApplyAssistant, document, events };
}

test('Gjzq expands nine awards and two campus records and maps its local field captions', async t => {
  const { api, document, events } = setup(t, section('awards', '荣誉奖项', award(), true) + section('campus', '学生会&社团活动经历', campus(), true));
  const data = profile(), prepared = await api.prepare(data);
  assert.ok(prepared.results.every(item => !item.reason));
  assert.equal(events.awards, 8); assert.equal(events.campus, 1);
  const rows = api.plan(data).rows;
  const awards = rows.filter(row => row.group === 'custom_awards'), activities = rows.filter(row => row.group === 'custom_campus');
  assert.equal(awards.length, 27); assert.equal(activities.length, 10);
  assert.ok([...awards, ...activities].every(row => !row.reason));
  assert.ok((await api.fill([...awards, ...activities])).every(result => result.ok));
  assert.deepEqual([...document.querySelectorAll('.award-name')].map(el => el.value), data.modules[0].entries.map(entry => entry.field_name));
  assert.deepEqual([...document.querySelectorAll('.form#awards input[type="month"]')].map(el => el.value), data.modules[0].entries.map(entry => entry.field_date));
  assert.deepEqual([...document.querySelectorAll('.campus-name')].map(el => el.value), ['测试学生会', '测试社团']);
  assert.deepEqual([...document.querySelectorAll('.duty')].map(el => el.value), data.modules[1].entries.map(entry => entry.field_duty));
  assert.ok([...document.querySelectorAll('.duty')].every(el => el.tagName === 'INPUT'));
  assert.deepEqual([...document.querySelectorAll('.form#campus input[type="month"]')].map(el => el.value), ['2022-09', '2023-06', '2023-09', '2024-06']);
  await api.prepare(data);
  assert.equal(events.awards, 8); assert.equal(events.campus, 1);
  assert.equal(events.save, 0); assert.equal(events.submit, 0);
});

test('Gjzq matches already named awards first and preserves manually edited values', async t => {
  const { api, document } = setup(t, section('awards', '荣誉奖项', award() + award('测试奖项9', '用户已核实级别'), true) + section('campus', '学生会&社团活动经历', campus('测试社团', '用户补充的活动职责') + campus(), true));
  const data = profile();
  await api.prepare(data);
  const rows = api.plan(data).rows;
  const awardNames = rows.filter(row => row.group === 'custom_awards' && row.key === 'field_name');
  assert.equal(awardNames[0].value, '测试奖项1'); assert.equal(awardNames[1].entry, 8);
  const campusNames = rows.filter(row => row.group === 'custom_campus' && row.key === 'field_name');
  assert.equal(campusNames[0].entry, 1); assert.equal(campusNames[1].value, '测试学生会');
  assert.ok((await api.fill(rows.filter(row => !row.reason))).every(result => result.ok));
  assert.equal(document.querySelectorAll('.form#awards .record')[1].querySelector('input').value, '用户已核实级别');
  assert.equal(document.querySelector('.duty').value, '用户补充的活动职责');
  assert.ok(rows.filter(row => row.current).every(row => !row.canReplace));
});

test('Gjzq award and campus aliases do not fill family or qualification certificate fields', async t => {
  const other = field('名称') + field('级别') + field('获取时间', '<input type="month">') + field('社团名称') + field('社团职务') + field('工作职责');
  const { api, document, events } = setup(t, section('awards', '荣誉奖项', award()) + section('campus', '学生会&社团活动经历', campus()) + section('family', '家庭情况', other) + section('certificate', '资质证书', other));
  const rows = api.plan(profile()).rows;
  assert.equal(rows.filter(row => !row.reason).length, 8);
  await api.fill(rows.filter(row => !row.reason));
  assert.ok([...document.querySelectorAll('.form#family input,.form#certificate input')].every(el => el.value === ''));
  assert.equal(events.save, 0); assert.equal(events.submit, 0);
});

test('duplicate award or campus modules leave ambiguous sections and additions untouched', async t => {
  for (const kind of ['awards', 'campus']) {
    const data = profile();
    const duplicate = structuredClone(data.modules[kind === 'awards' ? 0 : 1]);
    duplicate.id = `custom_duplicate_${kind}`;
    duplicate.label = kind === 'awards' ? '荣誉奖项' : '学生会&社团活动经历';
    data.modules.push(duplicate);
    const { api, document, events } = setup(t, section(kind, kind === 'awards' ? '荣誉奖项' : '学生会&社团活动经历', kind === 'awards' ? award() : campus(), true));
    assert.ok(api.plan(data).rows.every(row => row.reason));
    await api.prepare(data);
    assert.equal(events[kind], 0);
    assert.ok([...document.querySelectorAll('input')].every(el => el.value === ''));
  }
});

function dateCalendar(document, input, monthly, selectedDay = 1) {
  let selections = 0;
  input.onclick = () => {
    const popup = document.createElement('div');
    popup.className = 'common-unmodeled-layer';
    popup.innerHTML = monthly
      ? '<div class="phoenix-date-picker"><div class="phoenix-calendar-month-calendar"><span class="phoenix-calendar-month-panel-year-select-content">2025</span><a class="phoenix-calendar-month-panel-month">03月</a></div></div>'
      : `<div class="phoenix-date-picker"><div class="phoenix-calendar"><span class="phoenix-calendar-year-select">2025</span><span class="phoenix-calendar-month-select">3月</span><a class="phoenix-calendar-date">${selectedDay}</a></div></div>`;
    document.body.append(popup);
    popup.querySelector('a').onclick = () => {
      selections++;
      input.value = monthly ? '2025-03' : `2025-03-${String(selectedDay).padStart(2, '0')}`;
      popup.remove();
    };
  };
  return { get selections() { return selections; } };
}
const dateField = label => field(label, '<div class="phoenix-select"><input class="calendar-input" readonly></div>');

test('Gjzq project month sources use the confirmed first day only when the Phoenix calendar requires a day', async t => {
  for (const monthly of [false, true]) {
    const data = validateProfile({ ...emptyProfile(), project: [{ name: '测试项目', start: '2025-03', end: '2025-03' }] });
    const before = JSON.stringify(data);
    const { api, document } = setup(t, section('project', '项目经历', field('项目名称', '<input value="测试项目">') + dateField('开始时间') + dateField('结束时间')));
    const inputs = [...document.querySelectorAll('.calendar-input')];
    const calendars = inputs.map(input => dateCalendar(document, input, monthly));
    const rows = api.plan(data).rows.filter(row => row.group === 'project' && ['start', 'end'].includes(row.key));
    assert.equal(rows.length, 2);
    assert.ok(rows.every(row => !row.reason && row.value === '2025-03'));
    assert.ok((await api.fill(rows)).every(result => result.ok));
    assert.deepEqual(inputs.map(input => input.value), [monthly ? '2025-03' : '2025-03-01', monthly ? '2025-03' : '2025-03-01']);
    assert.ok(calendars.every(calendar => calendar.selections === 1));
    assert.equal(JSON.stringify(data), before);
  }
});

test('Gjzq project complete dates retain their actual day', async t => {
  const data = validateProfile({ ...emptyProfile(), project: [{ name: '测试项目', start: '2025-03-18' }] });
  const { api, document } = setup(t, section('project', '项目经历', field('项目名称', '<input value="测试项目">') + dateField('开始时间')));
  const input = document.querySelector('.calendar-input');
  dateCalendar(document, input, false, 18);
  const row = api.plan(data).rows.find(row => row.key === 'start');
  assert.equal((await api.fill([row]))[0].ok, true);
  assert.equal(input.value, '2025-03-18');
});

test('month-to-first-day reporting never applies to other sites or other date fields', async t => {
  const cases = [
    { id: 'project', heading: '项目经历', anchor: '项目名称', name: '测试项目', caption: '开始时间', key: 'start', host: 'pensun.zhiye.com' },
    { id: 'basic', heading: '个人信息', caption: '出生日期', key: 'birthDate' },
    { id: 'education', heading: '教育经历', anchor: '学校名称', name: '测试学校', caption: '开始时间', key: 'start' },
    { id: 'internship', heading: '实习经历', anchor: '公司名称', name: '测试公司', caption: '结束时间', key: 'end' },
    { id: 'awards', heading: '荣誉奖项', anchor: '名称', name: '测试奖项3', caption: '获取时间', key: 'field_date' },
    { id: 'campus', heading: '学生会&社团活动经历', anchor: '社团名称', name: '测试学生会', caption: '开始时间', key: 'field_start', host: 'pensun.zhiye.com' }
  ];
  for (const item of cases) {
    const data = profile();
    data.basic.birthDate = '2025-03';
    data.project = [{ name: '测试项目', start: '2025-03' }];
    data.education = [{ school: '测试学校', start: '2025-03' }];
    data.internship = [{ company: '测试公司', end: '2025-03' }];
    data.modules[1].entries[0].field_start = '2025-03';
    const body = (item.anchor ? field(item.anchor, `<input value="${item.name}">`) : '') + dateField(item.caption);
    const { api, document } = setup(t, section(item.id, item.heading, body), `https://${item.host || 'gjzq.zhiye.com'}/form`);
    const input = document.querySelector('.calendar-input'), calendar = dateCalendar(document, input, false);
    const row = api.plan(data).rows.find(row => row.key === item.key);
    assert.ok(row && !row.reason, item.id);
    const result = (await api.fill([row]))[0];
    assert.equal(result.ok, false, item.id);
    assert.equal(result.reason, '此日历需要完整日期，不能推测日期', item.id);
    assert.equal(input.value, ''); assert.equal(calendar.selections, 0);
  }
});

test('Gjzq campus dates use the confirmed first day only for day calendars, leaving unavailable present empty', async t => {
  for (const monthly of [false, true]) {
    const data = profile();
    data.modules[1].entries[0].field_start = '2025-03';
    data.modules[1].entries[0].field_end = '2025-03';
    const before = JSON.stringify(data);
    const { api, document } = setup(t, section('campus', '学生会&社团活动经历', field('社团名称', '<input value="测试学生会">') + dateField('开始时间') + dateField('结束时间')));
    const inputs = [...document.querySelectorAll('.calendar-input')];
    inputs.forEach(input => dateCalendar(document, input, monthly));
    const rows = api.plan(data).rows.filter(row => ['field_start', 'field_end'].includes(row.key));
    assert.ok((await api.fill(rows)).every(result => result.ok));
    assert.deepEqual(inputs.map(input => input.value), [monthly ? '2025-03' : '2025-03-01', monthly ? '2025-03' : '2025-03-01']);
    assert.equal(JSON.stringify(data), before);
  }
  const data = profile(); data.modules[1].entries[0].field_end = '至今';
  const { api, document } = setup(t, section('campus', '学生会&社团活动经历', field('社团名称', '<input value="测试学生会">') + dateField('结束时间')));
  const input = document.querySelector('.calendar-input'), calendar = dateCalendar(document, input, false);
  const row = api.plan(data).rows.find(row => row.key === 'field_end');
  assert.equal((await api.fill([row]))[0].ok, false);
  assert.equal(input.value, ''); assert.equal(calendar.selections, 0);
  assert.equal(data.modules[1].entries[0].field_end, '至今');
});

function levelDropdown(document, input, options, disabled = []) {
  const selected = [];
  input.onclick = () => {
    const popup = document.createElement('div'); popup.className = 'common-unmodeled-layer';
    for (const option of options) {
      const item = document.createElement('div'); item.className = 'phoenix-selectList__listItem';
      if (disabled.includes(option)) item.setAttribute('aria-disabled', 'true');
      item.innerHTML = `<span class="phoenix-selectList__singleLabel">${option}</span>`;
      item.onclick = () => { selected.push(option); input.value = option; popup.remove(); };
      popup.append(item);
    }
    document.body.append(popup);
  };
  return selected;
}

test('Gjzq award levels fall back from province or city to the combined option without changing source facts', async t => {
  for (const level of ['省级', '市级']) {
    const data = profile(); data.modules[0].entries[0].field_level = level;
    const { api, document } = setup(t, section('awards', '荣誉奖项', field('名称', '<input value="测试奖项1">') + dateField('级别')));
    const input = document.querySelector('.calendar-input');
    const selected = levelDropdown(document, input, ['国家级', '省市级', '校级']);
    const row = api.plan(data).rows.find(row => row.key === 'field_level');
    assert.equal(row.value, level);
    assert.equal((await api.fill([row]))[0].ok, true);
    assert.deepEqual(selected, ['省市级']); assert.equal(input.value, '省市级');
    assert.equal(data.modules[0].entries[0].field_level, level);
  }
});

test('Gjzq award levels prefer exact options and reject duplicate exact or duplicate merged choices', async t => {
  for (const options of [['省市级', '省级'], ['省市级', '省级', '省级'], ['省市级', '省市级']]) {
    const { api, document } = setup(t, section('awards', '荣誉奖项', field('名称', '<input value="测试奖项1">') + dateField('级别')));
    const input = document.querySelector('.calendar-input'), selected = levelDropdown(document, input, options);
    const row = api.plan(profile()).rows.find(row => row.key === 'field_level');
    const result = (await api.fill([row]))[0];
    assert.equal(result.ok, options.length === 2 && options[1] === '省级');
    assert.deepEqual(selected, result.ok ? ['省级'] : []);
  }
});

test('combined award-level fallback supports other sites but not non-award modules', async t => {
  for (const outside of ['host', 'module']) {
    const data = profile();
    const module = outside === 'host' ? data.modules[0] : { id: 'custom_qualification', label: '资质证书', fields: [{ id: 'field_name', label: '名称', type: 'text' }, { id: 'field_level', label: '级别', type: 'text' }], entries: [{ field_name: '测试证书', field_level: '省级' }] };
    if (outside === 'module') data.modules.push(module);
    const heading = outside === 'host' ? '荣誉奖项' : '资质证书';
    const name = module.entries[0].field_name;
    const { api, document } = setup(t, section('levels', heading, field('名称', `<input value="${name}">`) + dateField('级别')), `https://${outside === 'host' ? 'pensun' : 'gjzq'}.zhiye.com/form`);
    const input = document.querySelector('.calendar-input'), selected = levelDropdown(document, input, ['国家级', '省市级', '校级']);
    const row = api.plan(data).rows.find(row => row.key === 'field_level');
    assert.ok(row && !row.reason);
    assert.equal((await api.fill([row]))[0].ok, outside === 'host');
    assert.equal(input.value, outside === 'host' ? '省市级' : ''); assert.deepEqual(selected, outside === 'host' ? ['省市级'] : []);
  }
});

test('a disabled exact award level does not permit downgrading to the combined choice', async t => {
  const { api, document } = setup(t, section('awards', '荣誉奖项', field('名称', '<input value="测试奖项1">') + dateField('级别')));
  const input = document.querySelector('.calendar-input');
  const selected = levelDropdown(document, input, ['省级', '省市级'], ['省级']);
  const row = api.plan(profile()).rows.find(row => row.key === 'field_level');
  const result = (await api.fill([row]))[0];
  assert.equal(result.ok, false);
  assert.equal(result.reason, '精确级别选项不可选，请核对');
  assert.equal(input.value, ''); assert.deepEqual(selected, []);
});
