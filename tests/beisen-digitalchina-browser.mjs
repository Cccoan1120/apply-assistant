import { chromium } from '@playwright/test';
import assert from 'node:assert/strict';

const browser = await chromium.launch({ headless: true });
try {
  const context = await browser.newContext();
  // Only constructed fixtures are served. No account or application is contacted.
  await context.route('**/*', route => route.fulfill({ contentType: 'text/html; charset=utf-8', body: '<!doctype html><body></body>' }));
  const page = await context.newPage();
  const errors = []; page.on('pageerror', error => errors.push(error.message));
  await page.goto('https://digitalchina.zhiye.com/form');
  const field = (label, id, value = '', kind = '') => `<div class="form-item"><label class="form-item__text">${label}</label><div class="${kind ? 'phoenix-select' : 'phoenix-input'}"><input id="${id}" value="${value}" data-kind="${kind}">${kind ? `<span class="phoenix-select__tipEle">${value}</span>` : ''}</div></div>`;
  const section = (id, label, html, extra = '') => `<section><div id="${id}">${label}</div><div class="records"><div class="ux-standard-form"><div class="form" id="${id}" name="${id}">${html}</div></div></div>${extra}</section>`;
  await page.setContent(`<style>body{font-family:Arial;max-width:920px;margin:24px}section{margin:24px 0}.form-item{display:flex;gap:16px;margin:12px}label{width:100px}input{width:300px;min-height:28px}.phoenix-button{display:inline-block;padding:12px}.common-unmodeled-layer{padding:16px;border:1px solid #aaa}.icon-container svg{width:16px;height:16px}</style>`
    + section('basic', '个人信息', field('姓名', 'name') + field('民族', 'ethnicity', '', 'constant') + field('现居住地', 'region', '北京市', 'area'))
    + section('edu', '教育经历', field('学校名称', 'school', '测试大学') + field('开始时间', 'edu-start', '', 'month') + field('结束时间', 'edu-end', '', 'month'))
    + section('work', '工作经历', field('单位名称', 'company') + field('职位名称', 'role') + field('开始时间', 'work-start', '', 'month') + field('结束时间', 'work-end', '', 'month') + field('证明人姓名', 'witness'), '<button id="add" type="button">添加工作经历</button>')
    + section('family', '家庭情况', field('姓名', 'family-name') + field('工作单位', 'family-company'))
    + '<button id="save">暂存</button><button id="submit">预览并提交</button>');
  await page.evaluate(() => {
    window.commands = 0; window.additions = 0;
    document.querySelector('#save').onclick = document.querySelector('#submit').onclick = () => window.commands++;
    const bind = input => input.onclick = () => {
      if (!input.dataset.kind) return;
      const popup = document.createElement('div'); popup.className = 'common-unmodeled-layer'; document.body.append(popup);
      const commit = value => { input.value = value; input.nextElementSibling.textContent = value; popup.remove(); };
      setTimeout(() => {
        if (input.dataset.kind === 'month') {
          let year = 2026;
          const render = () => {
            popup.innerHTML = `<div class="phoenix-date-picker"><div class="phoenix-calendar-month-calendar"><a class="phoenix-calendar-month-panel-prev-year-btn">前一年</a><span class="phoenix-calendar-month-panel-year-select-content">${year}</span><a class="phoenix-calendar-month-panel-next-year-btn">后一年</a><table><tbody><tr>${Array.from({ length: 12 }, (_, i) => `<td><a class="phoenix-calendar-month-panel-month">${i + 1}月</a></td>`).join('')}</tr></tbody></table></div></div>`;
            popup.querySelector('.phoenix-calendar-month-panel-prev-year-btn').onclick = () => { year--; render(); };
            popup.querySelector('.phoenix-calendar-month-panel-next-year-btn').onclick = () => { year++; render(); };
            popup.querySelectorAll('td').forEach((td, i) => td.onclick = () => commit(`${year}/${String(i + 1).padStart(2, '0')}`));
          }; render(); return;
        }
        const area = input.dataset.kind === 'area';
        let selected = area ? '北京市' : '';
        popup.innerHTML = `<div class="${area ? 'area-selector-container' : 'constant-main-selector-container'}"><div class="area-search-input"><input placeholder="搜索"></div><span class="select-data-num-limit">${area ? '/1' : '1'}</span><div class="options"></div><div class="select-data-container">${area ? '<span class="select-area-text-label">北京市</span>' : '<div class="select-data-empty"></div>'}</div><div class="${area ? 'area' : 'selector'}-footer-button"><div class="phoenix-button">取消</div><div class="phoenix-button">确定</div></div></div>`;
        popup.querySelector('input').oninput = () => setTimeout(() => {
          popup.querySelector('.options').innerHTML = area
            ? '<div class="area-item-container"><span class="icon-container"><svg class="area-icon-RadioUnchecked"></svg></span><span class="area-text-label">海淀区</span><div class="area-item-path">全国/北京市/北京市</div></div>'
            : '<div class="list-item-container"><span class="icon-container"><svg class="RadioUnchecked"></svg></span><span class="item-text-label">汉族</span></div>';
          popup.querySelector('svg').onclick = () => {
            selected = area ? '海淀区' : '汉族';
            popup.querySelector('.select-data-container').innerHTML = `<span class="${area ? 'select-area-text-label' : 'select-text-label'}">${selected}</span>`;
          };
        }, 220);
        popup.querySelectorAll('.phoenix-button')[0].onclick = () => popup.remove();
        popup.querySelectorAll('.phoenix-button')[1].onclick = () => commit(selected);
      }, 120);
    };
    document.querySelectorAll('input[data-kind]').forEach(bind);
    document.querySelector('#add').onclick = () => {
      window.additions++;
      const records = document.querySelector('#add').closest('section').querySelector('.records');
      const copy = records.firstElementChild.cloneNode(true);
      copy.querySelectorAll('input').forEach(input => { input.id += '-2'; bind(input); });
      records.append(copy);
    };
  });
  await page.addScriptTag({ path: 'extension/engine.js' });
  const result = await page.evaluate(async () => {
    const profile = { basic: { name: '测试姓名', ethnicity: '汉族', residentialAddress: '北京市海淀区学院路15号测试大学' }, education: [{ school: '测试大学', start: '2024-09', end: '2027-06' }], internship: [
      { company: '测试甲公司', role: '分析实习生', start: '2025-06', end: '2025-09' },
      { company: '测试乙公司', role: '审计实习生', start: '2024-07', end: '2024-08' }
    ], project: [], modules: [] };
    const prepared = await ApplyAssistant.prepare(profile);
    const rows = ApplyAssistant.plan(profile).rows;
    const filled = await ApplyAssistant.fill(rows.filter(row => !row.reason));
    return { prepared, filled, repeat: await ApplyAssistant.prepare(profile) };
  });
  assert.equal(result.filled.length, 13, JSON.stringify(result));
  assert.ok(result.filled.every(row => row.ok), JSON.stringify(result));
  assert.equal(await page.locator('#name').inputValue(), '测试姓名');
  assert.equal(await page.locator('#ethnicity').inputValue(), '汉族');
  assert.equal(await page.locator('#region').inputValue(), '海淀区');
  assert.equal(await page.locator('#edu-start').inputValue(), '2024/09');
  assert.equal(await page.locator('#edu-end').inputValue(), '2027/06');
  assert.equal(await page.locator('#role').inputValue(), '分析实习生');
  assert.equal(await page.locator('#role-2').inputValue(), '审计实习生');
  for (const id of ['family-name', 'family-company', 'witness', 'witness-2']) assert.equal(await page.locator(`#${id}`).inputValue(), '');
  assert.equal(await page.evaluate(() => window.additions), 1);
  assert.equal(await page.evaluate(() => window.commands), 0);
  assert.deepEqual(errors, []);
  await page.screenshot({ path: 'test-results/digitalchina-offline-fill.png', fullPage: true });
  console.log('PASS isolated Digitalchina: personal/family boundaries, nested SVG selection, full region ancestry/refinement, delayed month picker, two internships with original titles and dates, no duplicate additions, no submission.');
} finally { await browser.close(); }
