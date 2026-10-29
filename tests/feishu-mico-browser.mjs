import { chromium } from '@playwright/test';
import assert from 'node:assert/strict';

// ATSX structure and event sequence verified against public 8825.1a2a6d3f.js.
// All network requests are intercepted; no application account is accessed.
const browser = await chromium.launch({ headless: true });
try {
  const context = await browser.newContext();
  await context.route('**/*', route => route.fulfill({ contentType: 'text/html', body: '<body></body>' }));
  const page = await context.newPage();
  await page.goto('https://micoworld.jobs.feishu.cn/152087/resume/test/apply');
  const field = (label, inner) => `<div class="atsx-form-item"><div class="atsx-form-item-label"><label>${label}</label></div><div class="atsx-form-item-control">${inner}</div></div>`;
  const endpoint = '<div class="atsx-date-picker-period-month-label"><span class="atsx-date-picker-period-month-label-year">YYYY</span>-<span class="atsx-date-picker-period-month-label-month">MM</span></div>';
  const range = `<div class="atsx-date-picker atsx-date-picker-period-month">${endpoint}${endpoint}<input class="atsx-date-picker-period-hidden-input"></div>`;
  await page.setContent(`<style>body{font-family:Arial}section{padding:12px}input{width:240px;height:28px}.atsx-date-picker-period-month{display:flex}.atsx-date-picker-period-month-label{width:180px;min-height:30px;border:1px solid #aaa}.atsx-date-picker-period-hidden-input{width:0;height:0;border:0}.atsx-date-picker-period-month-panel{display:flex}.atsx-date-picker-period-month-panel-list{width:80px;height:160px;overflow:auto}.atsx-date-picker-period-month-panel-list-item{height:30px}.atsx-date-picker-panel-body-cell-content{display:inline-block;width:60px;height:30px}.atsx-select-dropdown{min-height:40px}</style>`
    + `<section><h2>教育经历</h2>${field('学校名称', '<div class="atsx-select"><div role="combobox" aria-controls="school-list" aria-expanded="false"><input class="atsx-select-search__field"></div></div>')}</section>`
    + `<section><h2>实习经历</h2>${field('公司名称', '<input value="测试公司">')}${field('起止时间', range)}</section>`
    + `<section><h2>项目经历</h2>${field('项目名称', '<input value="测试项目">')}${field('起止时间', range)}</section>`
    + `<section><h2>获奖</h2>${field('获奖名称', '<input value="测试奖">')}${field('获奖时间', '<div class="atsx-date-picker"><input readonly placeholder="YYYY"></div>')}</section>`
    + '<button id="submit">提交简历</button>');
  await page.evaluate(() => {
    window.submits = 0; window.committed = [];
    document.querySelector('#submit').onclick = () => window.submits++;
    const school = document.querySelector('.atsx-select input');
    school.oninput = () => {
      if (!school.value) return;
      const popup = document.createElement('div'); popup.className = 'atsx-select-dropdown'; popup.innerHTML = '<ul id="school-list"></ul>';
      document.body.append(popup); school.parentElement.setAttribute('aria-expanded', 'true');
      setTimeout(() => {
        const option = document.createElement('li'); option.className = 'atsx-select-dropdown-menu-item'; option.textContent = '测试大学';
        option.onclick = () => { school.value = option.textContent; window.committed.push('school'); school.parentElement.setAttribute('aria-expanded', 'false'); popup.remove(); };
        popup.firstChild.append(option);
      }, 120);
    };
    for (const owner of document.querySelectorAll('.atsx-date-picker-period-month')) {
      const labels = [...owner.querySelectorAll('.atsx-date-picker-period-month-label')];
      const values = [['', ''], ['', '']]; let popup;
      const open = index => {
        popup?.remove(); popup = document.createElement('div'); popup.className = 'atsx-date-picker-period-month-panel'; document.body.append(popup);
        labels.forEach((label, i) => label.classList.toggle('atsx-date-picker-period-month-label-focus', i === index));
        for (const [part, names] of [[0, ['2027', '2026', '2025', '2024', '2023', '2022', ...(index === 1 ? ['至今'] : [])]], [1, ['01', '02', '03', '04', '05', '06', '07', '08', '09', '10', '11', '12']]]) {
          const list = document.createElement('div'); list.className = 'atsx-date-picker-period-month-panel-list'; popup.append(list);
          for (const name of names) {
            const item = document.createElement('div'); item.className = 'atsx-date-picker-period-month-panel-list-item'; item.textContent = name;
            item.onclick = () => setTimeout(() => {
              values[index][part] = name;
              if (name === '至今') labels[index].innerHTML = '<span class="atsx-date-picker-period-month-label-toToday">至今</span>';
              else labels[index].querySelector(part ? '.atsx-date-picker-period-month-label-month' : '.atsx-date-picker-period-month-label-year').textContent = name;
              if (part || name === '至今') {
                window.committed.push(values[index].join('-'));
                if (index === 0 && !values[1][0]) open(1);
                else { popup.remove(); labels[index].classList.remove('atsx-date-picker-period-month-label-focus'); }
              }
            }, 100);
            list.append(item);
          }
        }
      };
      labels.forEach((label, index) => label.onclick = () => open(index));
    }
    const award = document.querySelector('input[placeholder=YYYY]');
    award.onclick = () => {
      const popup = document.createElement('div'); popup.className = 'atsx-date-picker-panel';
      popup.innerHTML = '<div class="atsx-date-picker-panel-body-year"></div>'; document.body.append(popup);
      for (let year = 2018; year <= 2026; year++) {
        const cell = document.createElement('div'); cell.className = 'atsx-date-picker-panel-body-cell-content'; cell.textContent = year;
        cell.onclick = () => { award.value = String(year); window.committed.push('award'); popup.remove(); };
        popup.firstChild.append(cell);
      }
    };
  });
  await page.addScriptTag({ path: 'extension/engine.js' });
  const result = await page.evaluate(async () => {
    const profile = { basic: {}, education: [{ school: '测试大学' }], internship: [{ company: '测试公司', start: '2026-01', end: '2026-03' }], project: [{ name: '测试项目', start: '2025-10', end: '至今' }], modules: [{ id: 'awards', label: '获奖经历', fields: [{ id: 'name', label: '奖项名称' }, { id: 'date', label: '获奖年份' }], entries: [{ name: '测试奖', date: '2024-10' }] }] };
    const rows = ApplyAssistant.plan(profile).rows;
    const results = await ApplyAssistant.fill(rows.filter(row => !row.reason));
    return { results, dates: ApplyAssistant.plan(profile).rows.filter(row => ['start', 'end', 'date'].includes(row.key)).map(row => row.current), commits: window.committed, submits: window.submits };
  });
  assert.equal(result.results.length, 6);
  assert.ok(result.results.every(row => row.ok), JSON.stringify(result));
  assert.deepEqual(result.dates.sort(), ['2024', '2025-10', '2026-01', '2026-03', '至今'].sort());
  assert.equal(result.commits.length, 6); assert.equal(result.submits, 0);
  console.log('PASS offline Chromium Mico: school candidate, internship/project month lists with delayed auto-open end selector, present, award year, no submission.');
} finally { await browser.close(); }
