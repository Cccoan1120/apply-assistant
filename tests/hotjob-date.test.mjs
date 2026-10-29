import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { JSDOM } from 'jsdom';
const engine = readFileSync(new URL('../extension/engine.js', import.meta.url), 'utf8');
function setup(t, { label = '结束时间', disabled = false, footer = true, accept = true, initial = '', onNavigate } = {}) {
  const field = (label, html) => `<div class="ant-form-item"><div class="ant-form-item-label"><label>${label}</label></div><div class="ant-form-item-children">${html}</div></div>`;
  const html = `<div class="form-cell"><div class="tit-wrap"><div class="tit"><p>项目经历</p><span>必填</span></div></div><div class="form-cell-right"><div class="form-cell-inner">${field('项目名称', '<input value="项目甲" id="name">')}${field(label, `<span class="ant-calendar-picker"><input readonly class="ant-calendar-picker-input" value="${initial}"></span>`)}</div></div></div>`;
  const dom = new JSDOM(html, { url: 'https://wecruit.hotjob.cn/SUtest/pb/resumeOperation.html', runScripts: 'outside-only' });
  dom.window.HTMLElement.prototype.getClientRects = () => [{}];
  dom.window.eval(engine);
  t.after(() => dom.window.close());
  const document = dom.window.document, input = document.querySelector('.ant-calendar-picker-input'), api = dom.window.ApplyAssistant;
  let year = 2026, month = 9, clicks = 0, opens = 0;
  function open() {
    opens++;
    const popup = document.createElement('div'); popup.className = 'ant-calendar-picker-container'; document.body.append(popup);
    const commit = value => {
      clicks++;
      if (accept) {
        if (value === '至今') input.closest('.ant-form-item-children').insertAdjacentHTML('beforeend', '<div style="position:absolute">至今</div>');
        else input.value = value;
      }
      popup.remove();
    };
    const render = () => {
      popup.innerHTML = `<div class="ant-calendar">${['prev-year', 'next-year', 'prev-month', 'next-month'].map(name => `<a class="ant-calendar-${name}-btn"></a>`).join('')}<table><tbody>${Array.from({ length: new Date(year, month, 0).getDate() }, (_, i) => `<tr><td class="ant-calendar-cell${disabled ? ' ant-calendar-disabled-cell' : ''}" title="${year}-${month}-${i + 1}"><div aria-disabled="${disabled}">${i + 1}</div></td></tr>`).join('')}</tbody></table>${footer ? '<div class="ant-calendar-footer-extra"><div>至今</div></div>' : ''}</div>`;
      for (const direction of ['prev-year', 'next-year', 'prev-month', 'next-month']) popup.querySelector(`.ant-calendar-${direction}-btn`).onclick = () => {
        const date = new Date(year, month - 1, 1);
        if (direction.endsWith('year')) date.setFullYear(year + (direction.startsWith('prev') ? -1 : 1));
        else date.setMonth(month - 1 + (direction.startsWith('prev') ? -1 : 1));
        year = date.getFullYear(); month = date.getMonth() + 1;
        render(); onNavigate?.({ api, document, input });
      };
      popup.querySelectorAll('td').forEach(cell => cell.onclick = () => { if (!disabled) commit(`${year}-${String(month).padStart(2, '0')}-${cell.textContent.padStart(2, '0')}`); });
      const present = popup.querySelector('.ant-calendar-footer-extra > div'); if (present) present.onclick = () => commit('至今');
    };
    render();
  }
  input.onclick = open;
  const plan = value => api.plan({ basic: {}, education: [], internship: [], project: [{ name: '项目甲', start: value, end: value }], modules: [] }).rows.find(row => row.key === (label === '开始时间' ? 'start' : 'end'));
  return { api, document, input, plan, counters: () => ({ clicks, opens }) };
}
test('Hotjob readonly calendar navigates to an exact supplied date and commits via its date cell', async t => {
  const { api, input, plan, counters } = setup(t);
  const row = plan('2024-03-12');
  assert.equal(row.choice, true);
  assert.equal((await api.fill([row]))[0].ok, true);
  assert.equal(input.value, '2024-03-12');
  assert.deepEqual(counters(), { clicks: 1, opens: 1 });
});
test('Hotjob present selects the footer and reads the real overlay instead of writing sentinel dates', async t => {
  const { api, input, plan, counters } = setup(t);
  assert.equal((await api.fill([plan('至今')]))[0].ok, true);
  assert.equal(input.value, '');
  assert.equal(plan('至今').current, '至今');
  await api.fill([plan('至今')]);
  assert.deepEqual(counters(), { clicks: 1, opens: 1 });
});
test('Hotjob invalid, partial and start-present dates never open a calendar or invent a day', async t => {
  for (const value of ['2026-02-30', '2026-09', '2026']) {
    const { api, plan, counters } = setup(t);
    assert.equal((await api.fill([plan(value)]))[0].ok, false);
    assert.equal(counters().opens, 0);
  }
  const { api, plan, counters } = setup(t, { label: '开始时间' });
  assert.equal((await api.fill([plan('至今')]))[0].ok, false);
  assert.equal(counters().opens, 0);
});
test('Hotjob dates reject disabled cells, missing present footer and unaccepted commits', async t => {
  for (const options of [{ disabled: true }, { footer: false }, { accept: false }]) {
    const { api, input, plan } = setup(t, options);
    assert.equal((await api.fill([plan(options.footer === false ? '至今' : '2026-09-01')]))[0].ok, false);
    assert.equal(input.value, '');
  }
});
test('Hotjob calendar stops after identity edits and preserves existing values and foreign popups', async t => {
  const changed = setup(t, { onNavigate: ({ document }) => { document.querySelector('#name').value = '另一项目'; } });
  assert.equal((await changed.api.fill([changed.plan('2024-03-12')]))[0].ok, false);
  assert.equal(changed.counters().clicks, 0);
  const existing = setup(t, { initial: '2025-05-05' });
  assert.equal((await existing.api.fill([existing.plan('2024-03-12')]))[0].ok, false);
  assert.equal(existing.counters().opens, 0);
  const foreign = setup(t);
  foreign.document.body.insertAdjacentHTML('beforeend', '<div class="ant-calendar-picker-container">其他日期</div>');
  assert.equal((await foreign.api.fill([foreign.plan('2024-03-12')]))[0].ok, false);
  assert.equal(foreign.counters().opens, 0);
});
