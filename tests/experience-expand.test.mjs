import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { JSDOM } from 'jsdom';

const source = readFileSync(new URL('../extension/engine.js', import.meta.url), 'utf8');
const labels = { education: ['教育经历', '学校名称'], internship: ['实习经历', '公司名称'], project: ['项目经历', '项目名称'] };
const field = (label, value = '') => `<div class="entry"><label>${label}<input value="${value}"></label></div>`;
const section = (group, initial = 0, buttons = '<button type="button">添加</button>') => `<fieldset id="${group}"><legend>${labels[group][0]}</legend><div class="entries">${field(labels[group][1]).repeat(initial)}</div>${buttons}</fieldset>`;
const profile = () => ({ basic: {}, education: [{ school: 'Test school A' }, { school: 'Test school B' }], internship: [], project: [], modules: [] });

function setup(t, html) {
  const dom = new JSDOM(html, { url: 'https://example.jobs.feishu.cn/resume/apply', runScripts: 'outside-only' });
  dom.window.HTMLElement.prototype.getClientRects = () => [{ width: 100, height: 30 }];
  dom.window.eval(source);
  t.after(() => dom.window.close());
  return { engine: dom.window.ApplyAssistant, document: dom.window.document, window: dom.window };
}

function attachAdd(document, group, delay = 0) {
  const block = document.getElementById(group);
  let count = 0;
  block.querySelector('button').onclick = () => {
    count++;
    const append = () => block.querySelector('.entries').insertAdjacentHTML('beforeend', field(labels[group][1]));
    if (delay) document.defaultView.setTimeout(append, delay);
    else append();
  };
  return () => count;
}

test('prepare expands zero or one initial education row and ignores blank source records', async t => {
  for (const initial of [0, 1]) {
    const { engine, document } = setup(t, section('education', initial));
    const clicks = attachAdd(document, 'education');
    const data = profile();
    data.education.push({ school: ' ', major: 'Does not identify a record' });
    const result = await engine.prepare(data);
    assert.equal(result.stopped, false);
    assert.equal(result.results[0].added, 2 - initial);
    assert.equal(result.results[0].reason, '');
    assert.equal(clicks(), 2 - initial);
    assert.equal(document.querySelectorAll('#education input').length, 2);
    const again = await engine.prepare(data);
    assert.equal(again.results[0].added, 0);
    assert.equal(clicks(), 2 - initial, 'repeat invocation must not add duplicates');
  }
});

test('prepare expands each supported module then all records can be filled', async t => {
  const { engine, document } = setup(t, section('education', 1) + section('internship') + section('project', 1));
  const data = profile();
  data.internship = [{ company: 'Test company A' }, { company: 'Test company B' }];
  data.project = [{ name: 'Test project A' }, { name: 'Test project B' }, { name: 'Test project C' }];
  const clicks = Object.fromEntries(Object.keys(labels).map(group => [group, attachAdd(document, group)]));
  const result = await engine.prepare(data);
  assert.deepEqual(Array.from(result.results, item => [item.group, item.added, item.reason]), [['education', 1, ''], ['internship', 2, ''], ['project', 2, '']]);
  const rows = engine.plan(data).rows;
  assert.ok(rows.every(row => !row.reason));
  const filled = await engine.fill(rows, { continueRun: true });
  assert.ok(filled.every(row => row.ok));
  for (const group of Object.keys(labels)) {
    const key = { education: 'school', internship: 'company', project: 'name' }[group];
    assert.deepEqual(Array.from(document.querySelectorAll(`#${group} input`), el => el.value), data[group].map(item => item[key]));
  }
  await engine.prepare(data);
  assert.deepEqual(Object.values(clicks).map(get => get()), [1, 2, 2]);
});

test('prepare waits for delayed row rendering before clicking again', async t => {
  const { engine, document } = setup(t, section('education'));
  const clicks = attachAdd(document, 'education', 120);
  const result = await engine.prepare(profile());
  assert.equal(result.results[0].added, 2);
  assert.equal(result.results[0].reason, '');
  assert.equal(clicks(), 2);
  assert.equal(document.querySelectorAll('input').length, 2);
});

test('no-growth add is clicked once and is not retried on a second invocation', async t => {
  const { engine, document } = setup(t, section('education', 1));
  let clicks = 0;
  document.querySelector('button').onclick = () => clicks++;
  const first = await engine.prepare(profile());
  assert.equal(first.results[0].added, 0);
  assert.match(first.results[0].reason, /未出现/);
  const second = await engine.prepare(profile());
  assert.match(second.results[0].reason, /上次添加尚未出现/);
  assert.equal(clicks, 1);
});

test('stop during prepare blocks later modules and continuation fill, while a new prepare resets stop', async t => {
  const { engine, document } = setup(t, '<label>姓名<input id="person"></label>' + section('education', 1) + section('internship'));
  const data = profile();
  data.basic.name = 'Test person';
  data.internship = [{ company: 'Test company' }];
  let educationClicks = 0;
  const internshipClicks = attachAdd(document, 'internship');
  document.querySelector('#education button').onclick = () => {
    educationClicks++;
    document.querySelector('#education .entries').insertAdjacentHTML('beforeend', field('学校名称'));
    engine.stop();
  };
  const result = await engine.prepare(data);
  assert.equal(result.stopped, true);
  assert.equal(educationClicks, 1);
  assert.equal(internshipClicks(), 0);
  const fill = await engine.fill(engine.plan(data).rows.filter(row => !row.reason), { continueRun: true });
  assert.ok(fill.length > 0);
  assert.ok(fill.every(row => !row.ok && /停止/.test(row.reason)));
  assert.equal(document.getElementById('person').value, '');
  const resumed = await engine.prepare(data);
  assert.equal(resumed.stopped, false);
  assert.equal(educationClicks, 1);
  assert.equal(internshipClicks(), 1);
});

test('prepare never clicks submit, next, save or explicitly configured work-history controls', async t => {
  const commands = '<button type="submit">添加</button><button type="button">下一步</button><button type="button">保存</button>';
  const work = '<fieldset><legend>工作经历</legend><button type="button">添加</button></fieldset>';
  const { engine, document } = setup(t, '<form>' + section('education', 0, commands) + work + '</form>');
  let clicks = 0, submits = 0;
  for (const button of document.querySelectorAll('button')) button.onclick = () => clicks++;
  document.querySelector('form').onsubmit = event => { event.preventDefault(); submits++; };
  const data = profile();
  data.internship = [{ company: 'Test internship' }];
  data.modules = [{ id: 'work_explicit', label: '工作经历', fields: [], entries: [] }];
  const result = await engine.prepare(data);
  assert.ok(result.results.every(item => item.added === 0 && item.reason));
  assert.equal(clicks, 0);
  assert.equal(submits, 0);
});

test('multiple add buttons in one module remain untouched', async t => {
  const { engine, document } = setup(t, section('education', 0, '<button type="button">添加</button><button type="button">新增</button>'));
  let clicks = 0;
  for (const button of document.querySelectorAll('button')) button.onclick = () => clicks++;
  const result = await engine.prepare(profile());
  assert.match(result.results[0].reason, /不唯一/);
  assert.equal(clicks, 0);
});

test('disabled command descendants cannot become enabled add targets', async t => {
  const {engine,document} = setup(t, section('education',0,'<button type="button" disabled><span>添加</span></button>'));
  let clicks=0; document.querySelector('span').onclick=()=>clicks++;
  await engine.prepare(profile()); assert.equal(clicks,0);
});

test('unknown existing company prevents expansion and its fields remain unchanged', async t => {
  const html = section('internship', 0).replace('<div class="entries"></div>', '<div class="entries"><div class="entry"><label>公司名称<input value="Unrelated company"></label><label>职位名称<input></label></div></div>');
  const { engine, document } = setup(t, html);
  const data = profile();
  data.education = [];
  data.internship = [{ company: 'Test company A', role: 'Analyst' }, { company: 'Test company B', role: 'Intern' }];
  const clicks = attachAdd(document, 'internship');
  const result = await engine.prepare(data);
  assert.match(result.results[0].reason, /不属于当前版本/);
  assert.equal(clicks(), 0);
  await engine.fill(engine.plan(data).rows.filter(row => !row.reason), { continueRun: true });
  assert.deepEqual(Array.from(document.querySelectorAll('input'), el => el.value), ['Unrelated company', '']);
});
