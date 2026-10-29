import { chromium } from '@playwright/test';
import assert from 'node:assert/strict';

const browser = await chromium.launch({ headless: true });
try {
  const context = await browser.newContext();
  await context.route('**/*', route => route.fulfill({ contentType: 'text/html; charset=utf-8', body: '<!doctype html><body></body>' }));
  const page = await context.newPage();
  const errors = []; page.on('pageerror', error => errors.push(error.message));
  await page.goto('https://pensun.zhiye.com/form');
  const field = (label, id, kind = '', value = '') => `<div class="form-item"><label class="form-item__text">${label}</label>${kind === 'textarea' ? `<textarea id="${id}">${value}</textarea>` : `<div class="${kind ? 'phoenix-select' : 'phoenix-input'}"><input id="${id}" value="${value}" data-kind="${kind}">${kind ? `<span class="phoenix-select__tipEle">${value}</span>` : ''}</div>`}</div>`;
  const section = (title, body) => `<section><h2>${title}</h2><div class="records">${body}</div></section>`;
  const award = (id = '') => `<div class="record">${field('获奖项', 'award-name' + id)}${field('获奖时间', 'award-date' + id, 'month')}</div>`;
  await page.setContent(`<style>body{font-family:Arial;max-width:1000px;margin:24px}.form-item{margin:12px;display:flex;gap:16px}label{width:120px}input,textarea{width:340px;min-height:30px}.phoenix-selectList__listItem{padding:12px;cursor:pointer}.common-unmodeled-layer{border:1px solid #aaa;padding:12px}</style>`
    + section('教育经历', field('学校名称', 'school', '', '测试大学') + field('学习形式', 'study', 'study') + field('培养方式', 'training', 'training') + field('学位', 'academic-degree'))
    + section('获奖情况', award() + '<button id="add-award" type="button">添加获奖情况</button>')
    + section('语言能力', field('语言类型', 'language', 'language') + field('听说', 'speaking', 'level') + field('读写', 'writing', 'level'))
    + section('工作经历', field('公司名称', 'company') + field('职位名称', 'role') + field('工作开始时间', 'work-start', 'month') + field('工作结束时间', 'work-end', 'month'))
    + section('项目经历', field('项目名称', 'project', '', '测试项目') + field('项目描述', 'description', 'textarea', '网页已有描述') + field('职务', 'project-role') + field('项目中职责', 'responsibilities', 'textarea') + field('项目成果', 'results', 'textarea'))
    + '<button id="submit">预览并提交</button>');
  await page.evaluate(() => {
    window.submits = 0; window.additions = 0;
    document.querySelector('#submit').onclick = () => window.submits++;
    const bind = input => input.onclick = () => {
      const kind = input.dataset.kind;
      if (!kind) return;
      const popup = document.createElement('div'); popup.className = 'common-unmodeled-layer'; document.body.append(popup);
      const commit = value => { input.value = value; input.nextElementSibling.textContent = value; popup.remove(); };
      setTimeout(() => {
        if (kind === 'month') {
          let year = 2026;
          const render = () => {
            popup.innerHTML = `<div class="phoenix-date-picker"><div class="phoenix-calendar-month-calendar"><a class="phoenix-calendar-month-panel-prev-year-btn">前一年</a><span class="phoenix-calendar-month-panel-year-select-content">${year}</span><a class="phoenix-calendar-month-panel-next-year-btn">后一年</a><table><tbody><tr>${Array.from({ length: 12 }, (_, i) => `<td><a class="phoenix-calendar-month-panel-month">${i + 1}月</a></td>`).join('')}</tr></tbody></table></div></div>`;
            popup.querySelector('.phoenix-calendar-month-panel-prev-year-btn').onclick = () => { year--; render(); };
            popup.querySelector('.phoenix-calendar-month-panel-next-year-btn').onclick = () => { year++; render(); };
            popup.querySelectorAll('td').forEach((td, i) => td.onclick = () => commit(`${year}-${String(i + 1).padStart(2, '0')}`));
          }; render(); return;
        }
        const names = { study: ['全国普通高等院校全日制', '全国普通高等院校非全日制'], training: ['定向', '非定向'], language: ['中文', '英语'], level: ['一般', '熟练', '精通'] }[kind];
        popup.innerHTML = `<div class="phoenix-selectList"><input placeholder="搜索">${names.map(name => `<div class="phoenix-selectList__listItem"><span class="phoenix-selectList__singleLabel">${name}</span></div>`).join('')}</div>`;
        popup.querySelectorAll('.phoenix-selectList__listItem').forEach(option => option.onclick = () => commit(option.textContent));
      }, 120);
    };
    document.querySelectorAll('input').forEach(bind);
    document.querySelector('#add-award').onclick = () => {
      window.additions++;
      const copy = document.querySelector('#add-award').previousElementSibling.cloneNode(true);
      copy.querySelectorAll('input').forEach(input => { input.id += '-2'; bind(input); });
      document.querySelector('#add-award').before(copy);
    };
  });
  await page.addScriptTag({ path: 'extension/engine.js' });
  const result = await page.evaluate(async () => {
    const profile = { basic: {}, education: [{ school: '测试大学', degree: '硕士', studyType: '全日制', trainingMode: '非定向' }], internship: [{ company: '测试公司', role: '财务实习生', start: '2025-06', end: '2025-09' }], project: [{ name: '测试项目', role: '项目成员', description: '模板中的描述', responsibilities: '原文中的职责', results: '原文中的成果' }], modules: [
      { id: 'custom_awards', label: '获奖经历', fields: [{ id: 'field_name', label: '奖项名称' }, { id: 'field_year', label: '获奖年份' }], entries: [{ field_name: '测试奖甲', field_year: '2024-10' }, { field_name: '测试奖乙', field_year: '2025-05' }] },
      { id: 'custom_languages', label: '语言能力', fields: [{ id: 'field_language', label: '语言类型' }, { id: 'field_speaking', label: '听说' }, { id: 'field_writing', label: '读写' }], entries: [{ field_language: '英语', field_speaking: '熟练', field_writing: '精通' }] }
    ] };
    const prepared = await ApplyAssistant.prepare(profile);
    const rows = ApplyAssistant.plan(profile).rows;
    const filled = await ApplyAssistant.fill(rows.filter(row => !row.reason));
    await ApplyAssistant.prepare(profile);
    return { prepared, filled };
  });
  assert.equal(result.filled.length, 16, JSON.stringify(result));
  assert.ok(result.filled.every(row => row.ok), JSON.stringify(result));
  for (const [id, value] of Object.entries({ study: '全国普通高等院校全日制', training: '非定向', 'academic-degree': '', language: '英语', speaking: '熟练', writing: '精通', 'award-name': '测试奖甲', 'award-date': '2024-10', 'award-name-2': '测试奖乙', 'award-date-2': '2025-05', role: '财务实习生', 'work-start': '2025-06', 'work-end': '2025-09', description: '网页已有描述', responsibilities: '原文中的职责', results: '原文中的成果' })) assert.equal(await page.locator(`#${id}`).inputValue(), value, id);
  assert.equal(await page.evaluate(() => window.additions), 1);
  assert.equal(await page.evaluate(() => window.submits), 0);
  assert.deepEqual(errors, []);
  await page.screenshot({ path: 'test-results/pensun-offline-fill.png', fullPage: true });
  console.log('PASS isolated Pensun: separate education dropdowns, award names/months/addition, language levels, internship work dates, project responsibilities/results, preserved existing descriptions and empty academic degree, no submission.');
} finally { await browser.close(); }
