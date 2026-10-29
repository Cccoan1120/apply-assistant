import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { JSDOM } from 'jsdom';
import { emptyProfile, validateProfile } from '../extension/schema.js';

const code = readFileSync(new URL('../extension/engine.js', import.meta.url), 'utf8');
function setup(t, options = {}) {
  const school = options.school;
  const dom = new JSDOM(`<section class="form-cell"><div class="tit-wrap"><div class="tit"><p>${school ? '教育经历' : '基本信息'}</p></div></div><div class="${options.cascader ? 'cascader-plugins-wrap' : 'record'}"><div class="ant-form-item"><div class="ant-form-item-label"><label>${school ? '学校名称' : '性别'}</label></div><div class="ant-select"><div role="combobox" tabindex="0" aria-expanded="false" class="ant-select-selection ant-select-selection--${options.multiple ? 'multiple' : 'single'}"><div class="ant-select-selection-selected-value">${options.selected || ''}</div><div class="ant-select-search--inline" style="display:none"><input class="ant-select-search__field" value="${options.query || ''}"></div></div></div></div></div></section><button class="submit">提交</button>`, { url: 'https://wecruit.hotjob.cn/SUexample/pb/resumeOperation.html', runScripts: 'outside-only' });
  t.after(() => dom.window.close());
  const { window } = dom, document = window.document;
  window.HTMLElement.prototype.getClientRects = () => [{}];
  const realTimer = window.setTimeout;
  window.setTimeout = (fn, ms) => realTimer(fn, Math.min(ms, 1));
  const node = document.querySelector('[role="combobox"]'), input = node.querySelector('input'), display = node.querySelector('.ant-select-selection-selected-value');
  const stats = { open: 0, selected: 0, submit: 0, searched: [] };
  let popup;
  const close = () => {
    node.setAttribute('aria-expanded', 'false'); node.removeAttribute('aria-controls'); node.removeAttribute('aria-owns');
    node.querySelector('.ant-select-search--inline').style.display = 'none';
    if (popup) popup.style.display = 'none';
  };
  const render = () => {
    const labels = options.labels || [school ? '北京语言大学' : '男'];
    popup.replaceChildren();
    for (const label of labels) {
      const option = document.createElement('li'); option.setAttribute('role', 'option'); option.className = 'ant-select-dropdown-menu-item'; option.textContent = label;
      if (options.disabled) option.setAttribute('aria-disabled', 'true');
      option.onclick = () => { stats.selected++; if (!options.noCommit) display.textContent = options.wrongCommit || label; input.value = ''; if (!options.noClose) close(); };
      popup.append(option);
    }
  };
  node.onclick = () => {
    if (node.getAttribute('aria-expanded') === 'true') return;
    stats.open++; node.setAttribute('aria-expanded', 'true'); node.querySelector('.ant-select-search--inline').style.display = '';
    popup = document.createElement('ul'); popup.id = 'hotjob-options'; popup.className = 'ant-select-dropdown'; popup.setAttribute('role', 'listbox'); document.body.append(popup);
    if (!options.unassociated) node.setAttribute(options.owns ? 'aria-owns' : 'aria-controls', popup.id);
    if (options.secondAssociation) { const other = popup.cloneNode(); other.id = 'other-options'; document.body.append(other); node.setAttribute('aria-owns', other.id); }
    if (!school || options.eager) render();
  };
  node.onkeydown = event => { if (event.key === 'Escape') close(); };
  input.oninput = () => { stats.searched.push(input.value); if (school && input.value) render(); if (options.userChange) input.value = '用户正在输入'; };
  document.querySelector('.submit').onclick = () => stats.submit++;
  window.eval(code);
  const data = validateProfile({ ...emptyProfile(), basic: { gender: '男' }, education: school ? [{ school: '北京语言大学' }] : [] });
  const api = window.ApplyAssistant;
  const row = () => api.plan(data).rows.find(row => row.key === (school ? 'school' : 'gender'));
  return { api, document, node, input, display, stats, row };
}

test('Hotjob Ant3 opens before association, selects exact option and reads committed display', async t => {
  for (const owns of [false, true]) {
    const s = setup(t, { owns });
    const row = s.row(); assert.equal(row.choice, true); assert.equal(row.current, '');
    assert.equal((await s.api.fill([row]))[0].ok, true);
    assert.equal(s.display.textContent, '男'); assert.equal(s.stats.selected, 1); assert.equal(s.stats.submit, 0);
    assert.equal(s.node.getAttribute('aria-expanded'), 'false');
    assert.equal(s.api.scan().rows.length, 1);
    assert.equal(s.row().current, '男');
  }
});

test('Hotjob school search commits exact candidate instead of treating query as selection', async t => {
  const s = setup(t, { school: true });
  assert.equal((await s.api.fill([s.row()]))[0].ok, true);
  assert.deepEqual(s.stats.searched, ['北京语言大学']); assert.equal(s.display.textContent, '北京语言大学'); assert.equal(s.stats.selected, 1);
});

test('Hotjob preserves existing selections and queries, including changes after scan', async t => {
  for (const mode of ['selected', 'query', 'lateQuery']) {
    const s = setup(t, { selected: mode === 'selected' ? '女' : '', query: mode === 'query' ? '用户原查询' : '' });
    const row = s.row(); if (mode === 'lateQuery') s.input.value = '用户新查询';
    assert.equal((await s.api.fill([row]))[0].ok, false, mode);
    assert.equal(s.stats.open, 0, mode); assert.equal(s.stats.selected, 0, mode);
  }
});

test('Hotjob refuses disabled, ambiguous, unrelated and compound choices', async t => {
  for (const options of [{ disabled: true }, { labels: ['男', '男'] }, { unassociated: true }, { secondAssociation: true }, { multiple: true }, { cascader: true }]) {
    const s = setup(t, options);
    assert.equal((await s.api.fill([s.row()]))[0].ok, false, JSON.stringify(options));
    assert.equal(s.stats.selected, 0, JSON.stringify(options)); assert.equal(s.stats.submit, 0);
  }
});

test('Hotjob restores its failed search but does not overwrite a concurrent user query', async t => {
  for (const userChange of [false, true]) {
    const s = setup(t, { school: true, labels: ['其他大学'], userChange });
    assert.equal((await s.api.fill([s.row()]))[0].ok, false);
    assert.equal(s.input.value, userChange ? '用户正在输入' : ''); assert.equal(s.stats.selected, 0);
  }
});

test('Hotjob requires both committed display and popup closure before success', async t => {
  for (const options of [{ noCommit: true }, { noClose: true }, { wrongCommit: '女' }]) {
    const s = setup(t, options);
    assert.equal((await s.api.fill([s.row()]))[0].ok, false); assert.equal(s.stats.selected, 1);
  }
});

test('Hotjob select stops if its education identity changes while options open', async t => {
  const s = setup(t, { school: true, labels: ['会计学'] });
  s.document.querySelector('.ant-form-item-label label').textContent = '专业';
  s.document.querySelector('.record').insertAdjacentHTML('afterbegin', '<div class="ant-form-item"><div class="ant-form-item-label"><label>学校名称</label></div><input id="identity" value="北京语言大学"></div>');
  const rows = s.api.plan(validateProfile({ ...emptyProfile(), education: [{ school: '北京语言大学', major: '会计学' }] })).rows;
  const open = s.node.onclick;
  s.node.onclick = () => { open(); s.document.querySelector('#identity').value = '另一学校'; };
  assert.equal((await s.api.fill([rows.find(row => row.key === 'major')]))[0].ok, false);
  assert.equal(s.stats.selected, 0);
});
