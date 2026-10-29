import { chromium } from '@playwright/test';
import assert from 'node:assert/strict';

const browser = await chromium.launch({ headless: true });
try {
  const context = await browser.newContext();
  await context.route('**/*', route => route.fulfill({ contentType: 'text/html; charset=utf-8', body: '<!doctype html><body></body>' }));
  const page = await context.newPage();
  const errors = [];
  page.on('pageerror', error => errors.push(error.message));
  await page.goto('https://jobtaikang.zhiye.com/form');
  const field = (label, key, kind = '') => `<div class="form-item"><label class="form-item__text">${label}</label>${kind === 'textarea' ? `<textarea data-key="${key}"></textarea>` : `<div class="${kind ? 'phoenix-select' : 'phoenix-input'}"><input data-key="${key}" data-kind="${kind}">${kind ? '<span class="phoenix-select__tipEle"></span>' : ''}</div>`}</div>`;
  const section = (title, id, body) => `<section id="${id}"><h2>${title}</h2><div class="records"><div class="record">${body}</div><button type="button" data-add="${id}">添加${title}</button></div></section>`;
  await page.setContent('<style>body{font-family:Arial;width:900px;margin:24px}.form-item{display:flex;gap:16px;margin:12px}label{width:120px}input,textarea{width:380px;min-height:28px}.phoenix-selectList__listItem{padding:10px;cursor:pointer}.common-unmodeled-layer{background:white;border:1px solid #aaa;padding:12px}</style>'
    + '<section id="basic"><h2>个人信息</h2>' + field('姓名', 'applicant') + field('性别', 'gender', 'gender') + '</section>'
    + section('工作经历', 'work', field('单位名称', 'company') + field('开始时间', 'start', 'month') + field('结束时间', 'end', 'month') + field('部门', 'department') + field('职务', 'role') + field('工作性质', 'nature', 'nature') + field('工作职责', 'description', 'textarea') + field('工作业绩', 'results', 'textarea'))
    + section('在校实践', 'campus', field('开始时间', 'start', 'month') + field('结束时间', 'end', 'month') + field('社会工作团体', 'organization') + field('担任职务', 'role'))
    + section('家庭情况', 'family', field('与本人关系', 'relation', 'relation') + field('性别', 'gender', 'gender') + field('姓名', 'name') + field('联系电话', 'phone') + field('工作单位', 'company') + field('出生年月', 'birth', 'month'))
    + '<button id="save">暂存</button><button id="submit">预览并提交</button>');
  await page.evaluate(() => {
    window.saves = 0;
    window.submits = 0;
    window.additions = { work: 0, campus: 0, family: 0 };
    document.querySelector('#save').onclick = () => window.saves++;
    document.querySelector('#submit').onclick = () => window.submits++;
    const bind = input => input.onclick = () => {
      const kind = input.dataset.kind;
      if (!kind) return;
      document.querySelectorAll('.common-unmodeled-layer').forEach(node => node.remove());
      const popup = document.createElement('div');
      popup.className = 'common-unmodeled-layer';
      document.body.append(popup);
      const commit = value => { input.value = value; input.nextElementSibling.textContent = value; popup.remove(); };
      setTimeout(() => {
        if (kind === 'month') {
          let year = 2026;
          const render = () => {
            popup.innerHTML = `<div class="phoenix-date-picker"><div class="phoenix-calendar-month-calendar"><a class="phoenix-calendar-month-panel-prev-year-btn">前一年</a><span class="phoenix-calendar-month-panel-year-select-content">${year}</span><a class="phoenix-calendar-month-panel-next-year-btn">后一年</a><table><tbody><tr>${Array.from({ length: 12 }, (_, index) => `<td><a class="phoenix-calendar-month-panel-month">${index + 1}月</a></td>`).join('')}</tr></tbody></table></div></div>`;
            popup.querySelector('.phoenix-calendar-month-panel-prev-year-btn').onclick = () => { year--; render(); };
            popup.querySelector('.phoenix-calendar-month-panel-next-year-btn').onclick = () => { year++; render(); };
            popup.querySelectorAll('td').forEach((td, index) => td.onclick = () => commit(`${year}-${String(index + 1).padStart(2, '0')}`));
          };
          render();
          return;
        }
        const options = { nature: ['全职', '兼职', '实习'], gender: ['男', '女'], relation: ['父亲', '母亲', '兄弟姐妹'] }[kind];
        popup.innerHTML = `<div class="phoenix-selectList">${options.map(name => `<div class="phoenix-selectList__listItem"><span class="phoenix-selectList__singleLabel">${name}</span></div>`).join('')}</div>`;
        popup.querySelectorAll('.phoenix-selectList__listItem').forEach(option => option.onclick = () => commit(option.textContent));
      }, 60);
    };
    document.querySelectorAll('input').forEach(bind);
    document.querySelectorAll('[data-add]').forEach(button => {
      button.onclick = () => {
        window.additions[button.dataset.add]++;
        const copy = button.parentElement.querySelector('.record').cloneNode(true);
        copy.querySelectorAll('input,textarea').forEach(input => {
          input.value = '';
          if (input.nextElementSibling?.matches('.phoenix-select__tipEle')) input.nextElementSibling.textContent = '';
          if (input.tagName === 'INPUT') bind(input);
        });
        button.before(copy);
      };
    });
  });
  await page.addScriptTag({ path: 'extension/engine.js' });
  const result = await page.evaluate(async () => {
    const fields = values => values.map(([id, label]) => ({ id, label, type: 'text' }));
    const profile = {
      basic: { name: '虚构应聘者', gender: '女' }, education: [], project: [],
      internship: [
        { company: '虚构甲公司', role: '财务实习生', department: '财务部', start: '2025-05', end: '2025-08', description: '核对测试台账并整理凭证。', results: '' },
        { company: '虚构乙公司', role: '运营实习生', department: '运营部', start: '2026-04', end: '2026-06', employmentType: '兼职', description: '整理测试运营数据并记录反馈。', results: '' }
      ],
      modules: [
        { id: 'custom_campus', label: '校园经历', fields: fields([['organization', '学校 / 组织'], ['role', '职务'], ['start', '开始时间'], ['end', '结束时间']]), entries: [
          { organization: '虚构大学学生会', role: '干事', start: '2024-09', end: '2025-06' },
          { organization: '虚构大学读书社', role: '社长', start: '2025-09', end: '2026-06' },
          { organization: '虚构大学志愿服务队', role: '队员', start: '2026-04', end: '2026-05' }
        ] },
        { id: 'custom_family', label: '家庭情况', fields: fields([['relation', '与本人关系'], ['gender', '性别'], ['name', '姓名'], ['phone', '联系电话'], ['company', '工作单位'], ['birth', '出生年月']]), entries: [
          { name: '虚构父亲甲', relation: '父亲', gender: '男', phone: '13800000001', company: '虚构交通公司', birth: '1968-02' },
          { name: '虚构母亲乙', relation: '母亲', gender: '女', phone: '13800000002', company: '无', birth: '1970-08' }
        ] }
      ]
    };
    const prepared = await ApplyAssistant.prepare(profile);
    const rows = ApplyAssistant.plan(profile).rows;
    const filled = await ApplyAssistant.fill(rows.filter(row => !row.reason));
    const secondPrepare = await ApplyAssistant.prepare(profile);
    return { prepared, secondPrepare, filled, diagnostics: rows.map(row => ({ group: row.group, key: row.key, value: row.value, reason: row.reason })) };
  });
  assert.ok(result.filled.length > 30, JSON.stringify(result));
  assert.ok(result.filled.every(row => row.ok), JSON.stringify(result));
  const readRecords = id => page.locator(`#${id} .record`).evaluateAll(records => records.map(record => Object.fromEntries(Array.from(record.querySelectorAll('[data-key]'), input => [input.dataset.key, input.value]))));
  assert.deepEqual(await readRecords('work'), [
    { company: '虚构甲公司', start: '2025-05', end: '2025-08', department: '财务部', role: '财务实习生', nature: '实习', description: '核对测试台账并整理凭证。', results: '' },
    { company: '虚构乙公司', start: '2026-04', end: '2026-06', department: '运营部', role: '运营实习生', nature: '兼职', description: '整理测试运营数据并记录反馈。', results: '' }
  ]);
  assert.deepEqual(await readRecords('campus'), [
    { start: '2024-09', end: '2025-06', organization: '虚构大学学生会', role: '干事' },
    { start: '2025-09', end: '2026-06', organization: '虚构大学读书社', role: '社长' },
    { start: '2026-04', end: '2026-05', organization: '虚构大学志愿服务队', role: '队员' }
  ]);
  assert.deepEqual(await readRecords('family'), [
    { relation: '父亲', gender: '男', name: '虚构父亲甲', phone: '13800000001', company: '虚构交通公司', birth: '1968-02' },
    { relation: '母亲', gender: '女', name: '虚构母亲乙', phone: '13800000002', company: '无', birth: '1970-08' }
  ]);
  assert.equal(await page.locator('#basic [data-key="applicant"]').inputValue(), '虚构应聘者');
  assert.deepEqual(await page.evaluate(() => ({ saves: window.saves, submits: window.submits, additions: window.additions })), { saves: 0, submits: 0, additions: { work: 1, campus: 2, family: 1 } });
  assert.deepEqual(errors, []);
  console.log('PASS isolated Taikang: internship duties, separate empty achievements, Phoenix default and explicit employment nature, three campus records, two explicitly sourced family records, no duplicate additions, no save or submit.');
} finally {
  await browser.close();
}
