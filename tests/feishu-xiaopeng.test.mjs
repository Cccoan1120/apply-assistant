import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { JSDOM } from 'jsdom';

const source = readFileSync(new URL('../extension/engine.js', import.meta.url), 'utf8');
const field = (name, html = '<input>') => `<div data-form-field-i18n-name="${name}">${html}</div>`;
const section = (name, html) => `<div class="applyFormModuleWrapper-windows"><p class="applyFormModuleWrapper-text">${name}</p><div>${html}</div></div>`;
const range = `<div class="throne-biz-date-range-picker-wrapper"><div class="throne-biz-date-range-picker-input"><input id="start" value="2026-07"></div><div class="throne-biz-date-range-picker-input"><input id="end"></div></div>`;
const profile = () => ({ basic: { summary: '测试自我评价' }, education: [], internship: [{ company: '测试公司', start: '2026-07', end: '至今' }], project: [], modules: [] });
function setup(t, html) {
  const dom = new JSDOM(html, { url: 'https://xiaopeng.jobs.feishu.cn/398875/resume/test/apply', runScripts: 'outside-only' });
  dom.window.HTMLElement.prototype.getClientRects = () => [{}];
  dom.window.SVGElement.prototype.getClientRects = () => [{}];
  dom.window.eval(source);
  t.after(() => dom.window.close());
  return { api: dom.window.ApplyAssistant, document: dom.window.document, window: dom.window };
}

// Public UD DatePanel renders the footer outside its inner calendar, not inside it.
test('Xiaopeng present footer belongs to the outer popup and preserves the start and no-work choice', async t => {
  const { api, document, window } = setup(t, section('工作经历', '<input id="no-work" type="checkbox" checked>没有工作经历') + section('实习经历', field('公司名称', '<input value="测试公司">') + field('起止时间', range)));
  const end = document.querySelector('#end');
  end.onclick = () => {
    const popup = document.createElement('div'); popup.className = 'throne-biz-date-range-picker-panel';
    popup.innerHTML = '<div><div class="ud__picker-date-panel"><div class="ud__picker-panel-header-btn">2026年</div></div></div>';
    document.body.append(popup);
    window.setTimeout(() => {
      const footer = document.createElement('div'); footer.className = 'throne-biz-date-range-picker-cell'; footer.textContent = '至今';
      footer.onclick = () => { end.value = '至今'; popup.remove(); };
      popup.append(footer);
    }, 120);
  };
  const rows = api.plan(profile()).rows.filter(row => !row.reason);
  assert.equal(rows.length, 1);
  assert.equal((await api.fill(rows))[0].ok, true);
  assert.equal(end.value, '至今');
  assert.equal(document.querySelector('#start').value, '2026-07');
  assert.equal(document.querySelector('#no-work').checked, true);
});

test('outer date popup refuses unrelated popups, changed peers and duplicate or disabled present options', async t => {
  for (const mode of ['unrelated', 'peer', 'duplicate', 'disabled', 'start']) {
    const { api, document } = setup(t, section('实习经历', field('公司名称', '<input value="测试公司">') + field('起止时间', range)));
    const end = document.querySelector('#end'); let clicks = 0;
    end.onclick = () => {
      const popup = document.createElement('div'); popup.className = 'throne-biz-date-range-picker-panel';
      popup.innerHTML = '<div><div class="ud__picker-date-panel"></div></div>' + `<div class="throne-biz-date-range-picker-cell" ${mode === 'disabled' ? 'aria-disabled="true"' : ''}>至今</div>`.repeat(mode === 'duplicate' ? 2 : 1);
      popup.querySelectorAll('.throne-biz-date-range-picker-cell').forEach(cell => cell.onclick = () => clicks++);
      document.body.append(popup);
      if (mode === 'unrelated') document.body.insertAdjacentHTML('beforeend', '<div class="ud__picker-date-panel"><div class="throne-biz-date-range-picker-cell">至今</div></div>');
      if (mode === 'peer') document.querySelector('#start').value = '2025-01';
    };
    if (mode === 'start') document.querySelector('#start').value = '';
    const row = api.plan(profile()).rows.find(row => row.key === (mode === 'start' ? 'start' : 'end'));
    assert.equal((await api.fill([{ ...row, value: '至今' }]))[0].ok, false, mode);
    assert.equal(clicks, 0, mode);
    assert.equal(end.value, '');
  }
});

test('award years wait for a delayed 20-year grid and navigate from the displayed range', async t => {
  for (const initial of [2020, 2040, 2000]) {
    const { api, document, window } = setup(t, section('获奖', field('获奖名称', '<input value="测试奖项">') + field('获奖时间', '<div class="ud__picker"><div class="ud__picker-dateInput ud__picker-inputWrapper"><input class="ud__picker-input" id="year" readonly placeholder="YYYY"></div></div>')));
    const input = document.querySelector('#year');
    input.parentElement.onmouseup = () => {
      const popup = document.createElement('div'); popup.className = 'ud__picker-date-panel'; document.body.append(popup);
      let start = initial;
      const render = () => {
        popup.innerHTML = '<button><span data-icon="LeftBoldOutlined"></span></button><button><span data-icon="RightBoldOutlined"></span></button>';
        [...popup.querySelectorAll('button')].forEach((button, index) => button.onclick = () => { start += index ? 20 : -20; render(); });
        for (let year = start; year < start + 20; year++) {
          const cell = document.createElement('div'); cell.className = 'ud__picker__cell-interactive-area'; cell.textContent = String(year);
          cell.onclick = () => { input.value = String(year); popup.remove(); };
          popup.append(cell);
        }
      };
      window.setTimeout(render, 160);
    };
    const data = profile();
    data.modules = [{ id: 'awards', label: '获奖经历', fields: [{ id: 'name', label: '奖项名称' }, { id: 'date', label: '获奖年月' }], entries: [{ name: '测试奖项', date: '2026-06' }] }];
    const rows = api.plan(data).rows.filter(row => !row.reason);
    assert.equal(rows[0].value, '2026');
    assert.equal((await api.fill(rows))[0].ok, true);
    assert.equal(input.value, '2026');
    assert.equal(data.modules[0].entries[0].date, '2026-06');
  }
});

test('collapsed self-evaluation is added once, filled from summary and preserves unrelated sections', async t => {
  const { api, document, window } = setup(t, section('自我评价', '<button id="add" type="button">+添加</button>') + section('社交账号', '<button id="social" type="button">+添加</button>') + section('工作经历', '<input id="no-work" type="checkbox" checked>没有工作经历'));
  let added = 0, social = 0;
  document.querySelector('#social').onclick = () => social++;
  document.querySelector('#add').onclick = () => {
    added++;
    window.setTimeout(() => document.querySelector('#add').insertAdjacentHTML('beforebegin', field('自我评价', '<textarea></textarea>')), 120);
  };
  const result = await api.prepare(profile());
  assert.equal(result.results.find(row => row.group === 'basic').added, 1);
  assert.equal((await api.fill(api.plan(profile()).rows.filter(row => !row.reason)))[0].ok, true);
  assert.equal(document.querySelector('textarea').value, profile().basic.summary);
  await api.prepare(profile());
  assert.equal(added, 1); assert.equal(social, 0);
  assert.equal(document.querySelector('#no-work').checked, true);
});

test('summary add respects empty source, existing text and duplicate add sections', async t => {
  for (const mode of ['empty', 'existing', 'duplicate']) {
    const block = section('自我评价', `${mode === 'existing' ? field('自我评价', '<textarea>用户原文</textarea>') : ''}<button type="button">添加</button>`);
    const { api, document } = setup(t, block.repeat(mode === 'duplicate' ? 2 : 1));
    let clicks = 0; document.querySelectorAll('button').forEach(button => button.onclick = () => clicks++);
    const data = profile(); if (mode === 'empty') data.basic.summary = '';
    await api.prepare(data);
    await api.fill(api.plan(data).rows.filter(row => !row.reason));
    assert.equal(clicks, 0, mode);
    if (mode === 'existing') assert.equal(document.querySelector('textarea').value, '用户原文');
  }
});

test('language and separate exact proficiency map without inferring from speaking and writing', async t => {
  const { api, document } = setup(t, section('语言能力', field('语言', '<select><option></option><option>英语</option></select>') + field('精通程度', '<select><option></option><option>商务会话</option><option>无障碍沟通</option></select>')));
  const data = profile();
  const module = { id: 'languages', label: '语言能力', fields: [{ id: 'language', label: '语言类型' }, { id: 'speaking', label: '听说' }, { id: 'proficiency', label: '精通程度' }], entries: [{ language: '英语', speaking: '熟练' }] };
  data.modules = [module];
  assert.equal(api.plan(data).rows.find(row => row.key === 'proficiency').reason, '资料未填写');
  module.entries[0].proficiency = '商务会话';
  const rows = api.plan(data).rows.filter(row => !row.reason);
  assert.equal(rows.length, 2);
  assert.ok((await api.fill(rows)).every(row => row.ok));
  assert.deepEqual([...document.querySelectorAll('select')].map(el => el.value), ['英语', '商务会话']);
});
