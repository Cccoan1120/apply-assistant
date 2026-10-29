import { chromium } from '@playwright/test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

const browser = await chromium.launch({ headless: true });
try {
  const context = await browser.newContext();
  const page = await context.newPage();
  // All requests are intercepted. This browser never reaches an application account.
  await context.route('**/*', route => route.fulfill({ contentType: 'text/html; charset=utf-8', body: '<!doctype html><body></body>' }));
  await page.goto('https://test.jobs.feishu.cn/resume/edit');
  await page.setContent(`<style>input{width:220px;height:32px}.ud__select__selector__selectItem{height:24px}.ud__select__list__item{padding:12px}.ud__select__dropdown-hidden{display:none}</style>
    <div data-form-field-i18n-name="性别"><div class="ud__select__selector"><div class="ud__select__selector__content"><input role="combobox" type="search" readonly></div></div></div>
    <button id="submit">保存</button>`);
  await page.evaluate(() => {
    window.submits = 0; document.querySelector('#submit').onclick = () => window.submits++;
    document.querySelector('input').onclick = () => {
      const popup = document.createElement('div'); popup.className = 'ud__select__dropdown'; popup.style.pointerEvents = 'none';
      popup.innerHTML = '<div class="ud__select__list"><div class="ud__select__list__item"><div class="ud__select__list__item__content">男</div></div></div>';
      document.body.append(popup);
      setTimeout(() => { popup.style.pointerEvents = 'auto'; }, 180);
      popup.querySelector('.ud__select__list__item').onclick = () => {
        const value = document.createElement('div'); value.className = 'ud__select__selector__selectItem'; value.textContent = '男';
        document.querySelector('.ud__select__selector__content').prepend(value); popup.classList.add('ud__select__dropdown-hidden');
      };
    };
  });
  await page.addScriptTag({ path: 'extension/engine.js' });
  const ud = await page.evaluate(async () => {
    const rows = ApplyAssistant.plan({ basic: { gender: '男' }, education: [], internship: [], project: [] }).rows;
    return ApplyAssistant.fill(rows.filter(row => !row.reason));
  });
  assert.equal(ud.length, 1); assert.equal(ud[0].ok, true);
  assert.equal(await page.locator('.ud__select__selector__selectItem').textContent(), '男');
  assert.equal(await page.evaluate(() => window.submits), 0);

  await page.goto('https://duxiaoman.jobs.feishu.cn/051736/resume/test/apply');
  await page.setContent(`<style>input{width:220px;height:32px}.throne-biz-date-range-picker-cell{padding:12px;cursor:pointer}.ud__picker-date-panel{width:280px;padding:12px}.months{display:grid;grid-template-columns:repeat(3,1fr);gap:16px}</style>
    <div class="applyFormModuleWrapper-windows"><p class="applyFormModuleWrapper-text">项目经历</p><div class="apply-form-array-card__live">
      <div data-form-field-i18n-name="项目名称"><input id="name" value="测试项目"></div>
      <div data-form-field-i18n-name="起止时间"><div class="throne-biz-date-range-picker-wrapper">
        <div class="throne-biz-date-range-picker-input"><input id="start" value="2025-10"></div>
        <div class="throne-biz-date-range-picker-input"><input id="end"></div>
      </div></div></div></div><button id="submit">提交申请</button>`);
  await page.evaluate(() => {
    window.submits = 0; document.querySelector('#submit').onclick = () => window.submits++;
    const input = document.querySelector('#end');
    input.onclick = () => {
      const popup = document.createElement('div'); popup.className = 'ud__picker-date-panel throne-biz-date-range-picker-panel';
      popup.innerHTML = '<div class="ud__picker-panel-header-btn">2026年</div><div class="months">' + Array.from({ length: 12 }, (_, i) => `<span>${i + 1}月</span>`).join('') + '</div>';
      document.body.append(popup);
      setTimeout(() => {
        const cell = document.createElement('div'); cell.className = 'ud__picker__cell__inner atsx__ud__picker__cell__inner throne-biz-date-range-picker-cell'; cell.textContent = '至今';
        cell.onclick = () => setTimeout(() => {
          input.value = '至今'; input.dispatchEvent(new Event('input', { bubbles: true })); popup.remove();
        }, 120);
        popup.append(cell);
      }, 120);
    };
  });
  await page.addScriptTag({ path: 'extension/engine.js' });
  const present = await page.evaluate(async () => {
    const plan = ApplyAssistant.plan({ basic: {}, education: [], internship: [], project: [{ name: '测试项目', start: '2025-10', end: '至今' }] });
    return ApplyAssistant.fill(plan.rows.filter(row => !row.reason));
  });
  assert.equal(present.length, 1); assert.equal(present[0].ok, true, JSON.stringify(present));
  assert.equal(await page.locator('#start').inputValue(), '2025-10');
  assert.equal(await page.locator('#end').inputValue(), '至今');
  assert.equal(await page.locator('.ud__picker-date-panel').count(), 0);
  assert.equal(await page.evaluate(() => window.submits), 0);
  await page.screenshot({ path: 'test-results/duxiaoman-present.png', fullPage: true });
  console.log('PASS isolated Duxiaoman UD present footer: delayed option and commit, preserved start, no submission.');

  // Constructed from screenshot captions and existing UD controls, not a live Anker DOM capture.
  await page.goto('https://anker-in.jobs.feishu.cn/campushirecn/resume/test/apply');
  const ankerField = (id, label, control) => `<div data-form-field-id="${id}" data-form-field-i18n-name="${label}"><label>${label}</label>${control}</div>`;
  const ankerSection = (label, content) => `<div class="applyFormModuleWrapper-windows"><p class="applyFormModuleWrapper-text">${label}</p><div>${content}</div></div>`;
  const experience = (prefix, label, name) => `<div class="apply-form-array-card__live">${ankerField(`${prefix}-name`, label, `<input id="${prefix}-name" value="${name}">`)}${ankerField(`${prefix}-description`, '描述', `<textarea id="${prefix}-description"></textarea>`)}</div>`;
  const award = (prefix, yearStart) => `<div class="apply-form-array-card__live">${ankerField(`${prefix}-name`, '获奖名称', `<input id="${prefix}-name">`)}${ankerField(`${prefix}-date`, '获奖时间', `<div class="ud__picker"><input id="${prefix}-date" placeholder="YYYY" readonly data-year-start="${yearStart}"></div>`)}${ankerField(`${prefix}-description`, '描述', `<textarea id="${prefix}-description"></textarea>`)}</div>`;
  await page.setContent(`<style>input,textarea{width:220px;min-height:32px}.ud__picker-date-panel{padding:12px}.ud__picker__cell-interactive-area,button{display:inline-block;min-width:40px;min-height:28px}</style>`
    + ankerSection('实习经历', experience('intern-b', '公司名称', '测试乙公司') + experience('intern-a', '公司名称', '测试甲公司'))
    + ankerSection('项目经历', experience('project-b', '项目名称', '测试乙项目') + experience('project-a', '项目名称', '测试甲项目'))
    + ankerSection('获奖', award('award-a', 2030) + award('award-b', 2010))
    + ankerSection('其他信息', ankerField('other', '描述', '<textarea id="other"></textarea>'))
    + '<button id="submit">提交申请</button>');
  await page.evaluate(() => {
    window.submits = 0; window.yearNavigation = [];
    document.querySelector('#submit').onclick = () => window.submits++;
    for (const field of document.querySelectorAll('[data-year-start]')) field.onclick = () => {
      const popup = document.createElement('div'); popup.className = 'ud__picker-date-panel';
      document.body.append(popup);
      let firstYear = Number(field.dataset.yearStart);
      const render = () => {
        popup.innerHTML = '<button type="button"><span data-icon="LeftBoldOutlined"></span></button><button type="button"><span data-icon="RightBoldOutlined"></span></button>';
        for (const [index, direction] of [-1, 1].entries()) popup.querySelectorAll('button')[index].onclick = () => {
          window.yearNavigation.push(direction);
          setTimeout(() => { firstYear += direction * 10; render(); }, 120);
        };
        for (let year = firstYear; year < firstYear + 10; year++) {
          const cell = document.createElement('div'); cell.className = 'ud__picker__cell-interactive-area'; cell.textContent = String(year);
          cell.onclick = () => {
            field.value = String(year);
            field.dispatchEvent(new Event('input', { bubbles: true }));
            field.dispatchEvent(new Event('change', { bubbles: true }));
            popup.remove();
          };
          popup.append(cell);
        }
      };
      render();
    };
  });
  await page.addScriptTag({ path: 'extension/engine.js' });
  const anker = await page.evaluate(async () => {
    const profile = {
      basic: {}, education: [],
      internship: [{ company: '测试甲公司', description: '甲公司财务分析内容' }, { company: '测试乙公司', description: '乙公司审计内容' }],
      project: [{ name: '测试甲项目', description: '甲项目预算内容' }, { name: '测试乙项目', description: '乙项目测算内容' }],
      modules: [{ id: 'custom_awards', label: '获奖经历', fields: [{ id: 'field_name', label: '奖项名称' }, { id: 'field_year', label: '获奖年份' }, { id: 'field_description', label: '获奖说明' }], entries: [{ field_name: '测试奖项甲', field_year: '2024-10', field_description: '测试奖项甲说明' }, { field_name: '测试奖项乙', field_year: '2026-06', field_description: '测试奖项乙说明' }] }]
    };
    const original = JSON.stringify(profile);
    const plan = ApplyAssistant.plan(profile);
    const results = await ApplyAssistant.fill(plan.rows.filter(row => !row.reason));
    const next = ApplyAssistant.plan(profile);
    return { platform: plan.platform, results, unchanged: original === JSON.stringify(profile), pending: next.rows.filter(row => !row.reason), other: next.rows.find(row => row.group === 'unmapped'), navigation: window.yearNavigation };
  });
  assert.equal(anker.platform, '飞书招聘'); assert.equal(anker.results.length, 10);
  assert.ok(anker.results.every(row => row.ok), JSON.stringify(anker.results));
  for (const [id, expected] of Object.entries({ 'intern-a-description': '甲公司财务分析内容', 'intern-b-description': '乙公司审计内容', 'project-a-description': '甲项目预算内容', 'project-b-description': '乙项目测算内容', 'award-a-name': '测试奖项甲', 'award-a-date': '2024', 'award-a-description': '测试奖项甲说明', 'award-b-name': '测试奖项乙', 'award-b-date': '2026', 'award-b-description': '测试奖项乙说明' })) {
    assert.equal(await page.locator(`#${id}`).inputValue(), expected, id);
  }
  assert.equal(anker.unchanged, true); assert.equal(anker.pending.length, 0);
  assert.deepEqual(anker.navigation, [-1, 1]); assert.match(anker.other.reason, /未可靠识别/);
  assert.equal(await page.locator('#other').inputValue(), '');
  assert.equal(await page.locator('#intern-b-name').inputValue(), '测试乙公司');
  assert.equal(await page.evaluate(() => window.submits), 0);

  await page.goto('https://campus.boe.com/form');
  await page.setContent(`<style>input{width:220px;height:32px}.common-unmodeled-layer{padding:10px}.list-item-container,.phoenix-button{min-height:30px;min-width:40px}.icon-container{display:inline-block;width:20px;height:20px}</style>
    <div class="form-item"><label class="form-item__text">民族</label><div class="phoenix-select"><input><span class="phoenix-select__tipEle"></span></div></div><button id="submit">预览并提交</button>`);
  await page.evaluate(() => {
    window.submits = 0; document.querySelector('#submit').onclick = () => window.submits++;
    const field = document.querySelector('.phoenix-select input');
    field.onclick = () => {
      const popup = document.createElement('div'); popup.className = 'common-unmodeled-layer';
      popup.innerHTML = '<div class="constant-main-selector-container"><span class="select-data-num-limit">1</span><input placeholder="搜索"><div class="options"></div><div class="select-data-container"><div class="select-data-empty">请在左侧选择内容</div></div><div class="selector-footer-button"><div class="phoenix-button">取消</div><div class="phoenix-button">确定</div></div></div>';
      document.body.append(popup);
      popup.querySelector('input').oninput = () => setTimeout(() => {
        popup.querySelector('.options').innerHTML = '<div class="list-item-container"><span class="icon-container"></span><span class="item-text-label">汉族</span></div>';
        popup.querySelector('.icon-container').onclick = () => { popup.querySelector('.select-data-container').innerHTML = '<div class="select-item-container"><span class="select-text-label">汉族</span></div>'; };
      }, 150);
      popup.querySelectorAll('.phoenix-button')[1].onclick = () => { field.value = '汉族'; document.querySelector('.phoenix-select__tipEle').textContent = '汉族'; popup.remove(); };
    };
  });
  await page.addScriptTag({ path: 'extension/engine.js' });
  const phoenix = await page.evaluate(async () => {
    const rows = ApplyAssistant.plan({ basic: { ethnicity: '汉族' }, education: [], internship: [], project: [] }).rows;
    return ApplyAssistant.fill(rows.filter(row => !row.reason));
  });
  assert.equal(phoenix.length, 1); assert.equal(phoenix[0].ok, true);
  assert.equal(await page.locator('.phoenix-select input').inputValue(), '汉族');
  assert.equal(await page.evaluate(() => window.submits), 0);
  await page.goto('https://baicgroup.zhiye.com/form?fromPage=editMyResume');
  await page.setContent('<style>input{width:220px;height:32px}.phoenix-radio{display:inline-block;padding:8px}.form-item{margin:12px}</style>' + await readFile('tests/fixtures/beisen-baic-live.html', 'utf8') + '<button id="save">保存</button>');
  await page.evaluate(() => {
    window.saves = 0; document.querySelector('#save').onclick = () => window.saves++;
    for (const option of document.querySelectorAll('.phoenix-radio')) option.onclick = () => {
      for (const peer of option.closest('.phoenix-radio-group').querySelectorAll('.phoenix-radio')) peer.classList.toggle('phoenix-radio--checked', peer === option);
    };
  });
  await page.addScriptTag({ path: 'extension/engine.js' });
  const baic = await page.evaluate(async () => {
    const data = { basic: { name: '测试姓名', gender: '男', email: 'test@example.com' }, education: [{ school: '测试大学', major: '会计学' }], internship: [{ company: '测试实习公司' }], project: [{ name: '测试项目', role: '项目成员', description: '测试项目介绍' }] };
    const planned = ApplyAssistant.plan(data);
    const results = await ApplyAssistant.fill(planned.rows.filter(row => !row.reason));
    data.basic.gender = '女';
    return { platform: planned.platform, results, gender: ApplyAssistant.plan(data).rows.find(row => row.key === 'gender'), role: [...document.querySelectorAll('.form-item')].find(node => node.querySelector('label')?.textContent === '职务').querySelector('input').value };
  });
  assert.equal(baic.platform, '北森'); assert.equal(baic.results.length, 8);
  assert.ok(baic.results.every(row => row.ok), JSON.stringify(baic.results));
  assert.equal(baic.gender.current, '男'); assert.match(baic.gender.reason, /已有内容/);
  assert.equal(baic.role, '项目成员'); assert.equal(await page.evaluate(() => window.saves), 0);
  console.log('PASS Chromium platform controls: UD/Phoenix dropdowns; constructed Anker sections, identity-matched descriptions and bidirectional year picker; BAIC captured form mapping and custom gender selected-state readback; existing values preserved; no application submission. Anker live DOM remains unverified.');
} finally { await browser.close(); }
