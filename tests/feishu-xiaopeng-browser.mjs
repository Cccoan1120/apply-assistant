import { chromium } from '@playwright/test';
import assert from 'node:assert/strict';

const browser = await chromium.launch({ headless: true });
try {
  const context = await browser.newContext();
  // Synthetic component reproduction only. No requests reach a candidate account.
  await context.route('**/*', route => route.fulfill({ contentType: 'text/html; charset=utf-8', body: '<!doctype html><body></body>' }));
  const page = await context.newPage();
  await page.goto('https://xiaopeng.jobs.feishu.cn/398875/resume/test/apply');
  const field = (name, html) => `<div data-form-field-i18n-name="${name}"><label>${name}</label>${html}</div>`;
  const section = (name, html) => `<section class="applyFormModuleWrapper-windows"><h2 class="applyFormModuleWrapper-text">${name}</h2><div>${html}</div></section>`;
  const select = id => `<div class="ud__select__selector"><div class="ud__select__selector__content"><input id="${id}" role="combobox" readonly></div></div>`;
  await page.setContent(`<style>body{font:16px Arial;margin:24px;max-width:920px;color:#222}section{border-bottom:1px solid #ddd;padding:16px 0}label{display:block;margin-top:8px}input,textarea{box-sizing:border-box;width:100%;min-height:36px}textarea{height:88px}.throne-biz-date-range-picker-wrapper{display:flex;gap:16px}.throne-biz-date-range-picker-input{flex:1}input[type=checkbox]{width:20px;min-height:20px}button{padding:8px}.ud__picker-date-panel,.throne-biz-date-range-picker-panel,.ud__select__dropdown{padding:16px;background:#fafafa}.ud__picker__cell-interactive-area,.throne-biz-date-range-picker-cell,.ud__select__list__item{display:inline-block;padding:12px}.ud__picker-panel-body{display:grid;grid-template-columns:repeat(4,1fr)}</style>`
    + section('工作经历', '<input id="no-work" type="checkbox" checked>没有工作经历')
    + section('实习经历', field('公司名称', '<input value="测试公司">') + field('起止时间', '<div class="throne-biz-date-range-picker-wrapper"><div class="throne-biz-date-range-picker-input"><input id="start" value="2026-07"></div><div class="throne-biz-date-range-picker-input"><input id="end"></div></div>'))
    + section('获奖', field('获奖名称', '<input value="测试奖项">') + field('获奖时间', '<div class="ud__picker"><div class="ud__picker-dateInput ud__picker-inputWrapper"><input id="year" class="ud__picker-input" readonly placeholder="YYYY"></div></div>'))
    + section('语言能力', field('语言', select('language')) + field('精通程度', select('proficiency')))
    + section('自我评价', '<button id="add" type="button">+添加</button>')
    + '<button id="submit">提交申请</button>');
  await page.evaluate(() => {
    window.submitted = 0; window.added = 0;
    document.querySelector('#submit').onclick = () => window.submitted++;
    document.querySelector('#add').onclick = () => {
      window.added++;
      setTimeout(() => document.querySelector('#add').insertAdjacentHTML('beforebegin', '<div data-form-field-i18n-name="自我评价"><textarea></textarea></div>'), 100);
    };
    const end = document.querySelector('#end');
    end.onclick = () => {
      const popup = document.createElement('div'); popup.className = 'throne-biz-date-range-picker-panel';
      popup.innerHTML = '<div><div class="ud__picker-date-panel"><div class="ud__picker-panel-header-btn">2026年</div></div></div><div class="ud__picker-footer"><div class="throne-biz-date-range-picker-cell">至今</div></div>';
      document.body.append(popup);
      popup.querySelector('.throne-biz-date-range-picker-cell').onclick = () => { end.value = '至今'; popup.remove(); };
    };
    const year = document.querySelector('#year');
    year.parentElement.onmouseup = () => {
      const popup = document.createElement('div'); popup.className = 'ud__picker-date-panel'; document.body.append(popup);
      setTimeout(() => {
        popup.innerHTML = '<div>2020 - 2039年</div><div class="ud__picker-panel-body">' + Array.from({ length: 20 }, (_, i) => `<div class="ud__picker-year-panel-cell"><div class="ud__picker__cell-interactive-area">${2020 + i}</div></div>`).join('') + '</div>';
        popup.querySelectorAll('.ud__picker__cell-interactive-area').forEach(cell => cell.onclick = () => { year.value = cell.textContent; popup.remove(); });
      }, 150);
    };
    for (const [id, options] of [['language', ['英语', '日语']], ['proficiency', ['入门', '日常会话', '商务会话', '无障碍沟通', '母语']]]) {
      const input = document.getElementById(id);
      input.onclick = () => {
        const popup = document.createElement('div'); popup.className = 'ud__select__dropdown';
        popup.innerHTML = options.map(name => `<div class="ud__select__list__item"><div class="ud__select__list__item__content">${name}</div></div>`).join(''); document.body.append(popup);
        popup.querySelectorAll('.ud__select__list__item').forEach(cell => cell.onclick = () => {
          const selected = document.createElement('div'); selected.className = 'ud__select__selector__selectItem'; selected.textContent = cell.textContent;
          input.parentElement.prepend(selected); popup.remove();
        });
      };
    }
  });
  await page.addScriptTag({ path: 'extension/engine.js' });
  const result = await page.evaluate(async () => {
    const data = { basic: { summary: '测试自我评价，仅用于验证。' }, education: [], internship: [{ company: '测试公司', start: '2026-07', end: '至今' }], project: [], modules: [
      { id: 'awards', label: '获奖经历', fields: [{ id: 'name', label: '奖项名称' }, { id: 'date', label: '获奖年月' }], entries: [{ name: '测试奖项', date: '2026-06' }] },
      { id: 'languages', label: '语言能力', fields: [{ id: 'language', label: '语言类型' }, { id: 'proficiency', label: '精通程度' }], entries: [{ language: '英语', proficiency: '商务会话' }] }
    ] };
    await ApplyAssistant.prepare(data);
    const rows = ApplyAssistant.plan(data).rows.filter(row => !row.reason);
    const filled = await ApplyAssistant.fill(rows);
    await ApplyAssistant.prepare(data);
    return { filled, second: ApplyAssistant.plan(data).rows.filter(row => !row.reason), added: window.added, submitted: window.submitted };
  });
  assert.equal(result.filled.length, 5);
  assert.ok(result.filled.every(row => row.ok), JSON.stringify(result));
  assert.equal(result.second.length, 0);
  assert.equal(result.added, 1); assert.equal(result.submitted, 0);
  assert.equal(await page.locator('#start').inputValue(), '2026-07');
  assert.equal(await page.locator('#end').inputValue(), '至今');
  assert.equal(await page.locator('#year').inputValue(), '2026');
  assert.equal(await page.locator('#no-work').isChecked(), true);
  assert.deepEqual(await page.locator('.ud__select__selector__selectItem').allTextContents(), ['英语', '商务会话']);
  assert.equal(await page.locator('textarea').inputValue(), '测试自我评价，仅用于验证。');
  await page.screenshot({ path: 'test-results/xiaopeng-fields.png', fullPage: true });
  console.log('PASS isolated Xiaopeng controls: external present footer, mouseup year opener, language dropdowns, summary expansion, no-work preserved, no submission.');
} finally {
  await browser.close();
}
