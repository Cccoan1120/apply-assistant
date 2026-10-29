import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { JSDOM } from 'jsdom';

const code = readFileSync(new URL('../extension/engine.js', import.meta.url), 'utf8');
const profile = { basic: {}, education: [{ school: '测试大学', degree: '硕士', studyType: '统招全日制', start: '2021-09', end: '2025-06' }], internship: [], project: [] };
const udField = (id, label, control) => `<div class="ud-formily-item" id="formily-item-${id}" data-form-field-id="${id}" data-form-field-i18n-name="${label}"><label>${label}</label>${control}</div>`;
const udSelect = '<div class="ud__select__selector"><div class="ud__select__selector__content"><div class="ud__select__selector__search"><input role="combobox" readonly type="search"></div></div></div>';
const udSection = contents => `<div class="applyFormModuleWrapper-windows"><div class="applyFormModuleWrapper-left"><div class="applyFormModuleWrapper-title"><p class="applyFormModuleWrapper-text">教育经历</p></div></div><div class="applyFormModuleWrapper-right">${contents}</div></div>`;
const phoenixField = (name, value = '') => `<div class="form-item form-item--phoenix"><div class="form-item__title"><label class="form-item__text">${name}</label></div><div class="form-item__control"><div class="phoenix-select"><span class="phoenix-select__calcEle">${value}</span><div class="phoenix-select__placeHolder">${value || '请选择'}</div><ul class="phoenix-select__content"><li class="phoenix-select__inputWrapper"><input class="phoenix-select__input" value="${value}"></li><span class="phoenix-select__tipWrapper"><span class="phoenix-select__tipEle">${value}</span></span></ul></div></div></div>`;
function setup(html, phoenix = false) {
  const dom = new JSDOM(html, { url: phoenix ? 'https://campus.boe.com/form' : 'https://test.jobs.feishu.cn/resume/edit', runScripts: 'outside-only' });
  const { window } = dom;
  window.HTMLElement.prototype.getClientRects = () => [{ width: 100, height: 30 }];
  window.SVGElement.prototype.getClientRects = () => [{ width: 16, height: 16 }];
  window.eval(code);
  return { window, document: window.document, api: window.ApplyAssistant };
}
function popup(document, cls, html) {
  const node = document.createElement('div'); node.className = cls; node.innerHTML = html; document.body.append(node); return node;
}
function bindUd(document, input, names, { search = false, commit = true, delay = 0 } = {}) {
  let node, clicks = 0;
  const render = () => {
    node.innerHTML = names.map(name => `<div class="ud__select__list__item"><div class="ud__select__list__item__content">${name}</div></div>`).join('');
    [...node.children].forEach(option => option.onclick = () => {
      clicks++;
      if (!commit) return;
      if (search) input.value = option.textContent;
      else {
        const display = document.createElement('div'); display.className = 'ud__select__selector__selectItem'; display.textContent = option.textContent;
        input.closest('.ud__select__selector__content').prepend(display);
      }
      node.remove();
    });
  };
  input.onclick = () => { node = popup(document, 'ud__select__dropdown', ''); if (!search) setTimeout(render, delay); };
  if (search) input.oninput = () => { if (input.value) setTimeout(render, delay); };
  input.onkeydown = event => { if (event.key === 'Escape') node?.remove(); };
  return { get clicks() { return clicks; } };
}

test('UD readable labels and duplicated field IDs keep education records and range endpoints separate', () => {
  const record = school => `<div class="apply-form-array-card__live"><div class="register-form-group-wrapper">${udField('school', '学校名称', `<input value="${school}">`)}${udField('degree', '学历', udSelect)}${udField('start_end_time', '起止时间', '<div class="throne-biz-date-range-picker-wrapper"><div class="throne-biz-date-range-picker-input"><input></div><div class="throne-biz-date-range-picker-input"><input></div></div>')}</div></div>`;
  const { api } = setup(udSection(record('') + record('第二大学')));
  const plan = api.plan({ ...profile, education: [...profile.education, { school: '第二大学', degree: '本科', start: '2017-09', end: '2021-06' }] });
  assert.deepEqual(Array.from(plan.rows.filter(n => n.key === 'start'), n => [n.entry, n.value, n.reason, n.choice]), [[0, '2021-09', '', true], [1, '2017-09', '', true]]);
  assert.ok(plan.rows.filter(n => n.key === 'end').every(n => !n.reason));
});

test('UD dropdown commits exact delayed options and reads selected display beside empty search input', async () => {
  const { api, document } = setup(udSection(udField('school', '学校名称', '<input value="测试大学">') + udField('degree', '学历', udSelect)));
  const input = document.querySelector('[role=combobox]'); const binding = bindUd(document, input, ['本科', '硕士'], { delay: 130 });
  const row = api.plan(profile).rows.find(n => n.key === 'degree');
  assert.equal(row.reason, ''); assert.equal(row.choice, true);
  assert.equal((await api.fill([row]))[0].ok, true); assert.equal(binding.clicks, 1); assert.equal(input.value, '');
  assert.match(api.plan(profile).rows.find(n => n.key === 'degree').reason, /已有内容/);
});

test('UD school search waits for an exact candidate and restores unaccepted queries', async () => {
  for (const commit of [true, false]) {
    const { api, document, window } = setup(udSection(udField('school', '学校名称', '<div class="ud__select"><input class="ud__native-input"></div>')));
    const input = document.querySelector('input'); const binding = bindUd(document, input, ['测试大学继续教育学院', '测试大学'], { search: true, delay: 130, commit });
    const row = api.plan(profile).rows[0]; assert.equal(row.reason, '');
    const result = await api.fill([row]); assert.equal(result[0].ok, commit); assert.equal(binding.clicks, 1);
    assert.equal(input.value, commit ? '测试大学' : ''); window.close();
  }
});

test('UD never chooses duplicate options or a pre-existing popup', async () => {
  for (const existing of [false, true]) {
    const { api, document } = setup(udField('gender', '性别', udSelect));
    const binding = bindUd(document, document.querySelector('input'), ['男', '男']);
    if (existing) popup(document, 'ud__select__dropdown', '<div>用户打开的弹层</div>');
    const row = api.plan({ ...profile, basic: { gender: '男' } }).rows[0];
    assert.equal((await api.fill([row]))[0].ok, false); assert.equal(binding.clicks, 0);
  }
});

test('UD stops on changed route, label, input or replacement while search results load', async () => {
  for (const action of ['stop', 'route', 'label', 'input', 'replace']) {
    const { api, document, window } = setup(udSection(udField('school', '学校名称', '<div class="ud__select"><input></div>')));
    const input = document.querySelector('input'); const binding = bindUd(document, input, ['测试大学'], { search: true, delay: 130 });
    const row = api.plan(profile).rows[0];
    setTimeout(() => {
      if (action === 'stop') api.stop();
      if (action === 'route') window.history.pushState({}, '', '#other');
      if (action === 'label') input.closest('[data-form-field-id]').setAttribute('data-form-field-i18n-name', '其他');
      if (action === 'input') input.value = '用户内容';
      if (action === 'replace') input.replaceWith(input.cloneNode());
    }, 40);
    assert.equal((await api.fill([row]))[0].ok, false); assert.equal(binding.clicks, 0);
    if (action === 'input') assert.equal(input.value, '用户内容'); window.close();
  }
});

function bindCalendar(document, input, { ud = false, day = false, disabled = false, mutate } = {}) {
  let clicks = 0;
  input.onclick = () => {
    const node = popup(document, ud ? 'ud__picker-date-panel' : 'common-unmodeled-layer', '');
    let year = 2026, month = 9;
    const commit = text => { clicks++; input.value = text; const tip = input.closest('.phoenix-select')?.querySelector('.phoenix-select__tipEle'); if (tip) tip.textContent = text; node.remove(); };
    const render = () => {
      const prefix = day ? 'phoenix-calendar' : 'phoenix-calendar-month-panel';
      node.innerHTML = ud ? `<span class="ud__picker-panel-header-btn">${year}年</span><button><span data-icon="LeftBoldOutlined"></span></button><button><span data-icon="RightBoldOutlined"></span></button>` : `<div class="phoenix-date-picker"><div class="${day ? 'phoenix-calendar' : 'phoenix-calendar-month-calendar'}"><span class="${day ? 'phoenix-calendar-year-select' : 'phoenix-calendar-month-panel-year-select-content'}">${year}</span><a class="${prefix}-prev-year-btn"></a><a class="${prefix}-next-year-btn"></a>${day ? `<span class="phoenix-calendar-month-select">${month}月</span><a class="phoenix-calendar-prev-month-btn"></a><a class="phoenix-calendar-next-month-btn"></a>` : ''}</div></div>`;
      const prev = node.querySelector(ud ? 'button' : `.${prefix}-prev-year-btn`), next = ud ? node.querySelectorAll('button')[1] : node.querySelector(`.${prefix}-next-year-btn`);
      prev.onclick = () => { year--; render(); mutate?.(); }; next.onclick = () => { year++; render(); };
      if (day) { node.querySelector('.phoenix-calendar-prev-month-btn').onclick = () => { month--; render(); }; node.querySelector('.phoenix-calendar-next-month-btn').onclick = () => { month++; render(); }; }
      for (let number = 1; number <= (day ? 31 : 12); number++) {
        const cell = document.createElement('div'); cell.className = ud ? 'ud__picker-month-panel-cell' : '';
        cell.innerHTML = `<a class="${ud ? 'ud__picker__cell-interactive-area' : day ? 'phoenix-calendar-date' : 'phoenix-calendar-month-panel-month'}">${String(number).padStart(2, '0')}${day ? '' : '月'}</a>`;
        if (disabled) cell.setAttribute('aria-disabled', 'true');
        cell.firstChild.onclick = () => commit(`${year}-${String(day ? month : number).padStart(2, '0')}${day ? '-' + String(number).padStart(2, '0') : ''}`);
        node.append(cell);
      }
    };
    render();
  };
  return { get clicks() { return clicks; } };
}

function presentFixture(group = 'project', start = '2025-10', end = '') {
  const label = group === 'project' ? '项目名称' : '公司名称';
  const html = udSection(`<div class="apply-form-array-card__live">${udField('name', label, '<input id="anchor" value="测试经历">')}${udField('range', '起止时间', `<div class="throne-biz-date-range-picker-wrapper"><div class="throne-biz-date-range-picker-input"><input id="start" value="${start}"></div><div class="throne-biz-date-range-picker-input"><input id="end" value="${end}"></div></div>`)}</div>`).replace('教育经历', group === 'project' ? '项目经历' : '实习经历');
  const context = setup(html);
  const data = { basic: {}, education: [], internship: [], project: [], [group]: [{ [group === 'project' ? 'name' : 'company']: '测试经历', start: '2025-10', end: '至今' }] };
  return { ...context, data };
}

function bindPresent(document, input, { mode = 'normal', mutate } = {}) {
  let clicks = 0, node;
  input.onclick = () => {
    node = popup(document, 'ud__picker-date-panel throne-biz-date-range-picker-panel', '<div class="ud__picker-panel-header-btn">2026年</div>');
    setTimeout(() => {
      mutate?.();
      if (mode === 'missing') return;
      const count = mode === 'duplicate' ? 2 : 1;
      for (let i = 0; i < count; i++) {
        const cell = document.createElement('div');
        cell.className = 'ud__picker__cell__inner atsx__ud__picker__cell__inner throne-biz-date-range-picker-cell';
        cell.textContent = '至今';
        if (mode === 'disabled') cell.setAttribute('aria-disabled', 'true');
        cell.onclick = () => {
          clicks++;
          if (mode !== 'no-value') input.value = '至今';
          if (mode !== 'open') node.remove();
          if (mode === 'changed-peer-after') document.querySelector('#start').value = '2024-01';
        };
        node.append(cell);
      }
    }, 100);
  };
  input.onkeydown = event => { if (event.key === 'Escape') node?.remove(); };
  return { get clicks() { return clicks; } };
}

test('UD present footer fills matched project and internship end dates and preserves starts', async () => {
  for (const group of ['project', 'internship']) {
    const { api, document, window, data } = presentFixture(group);
    const binding = bindPresent(document, document.querySelector('#end'));
    const row = api.plan(data).rows.find(row => row.key === 'end');
    assert.equal(row.value, '至今'); assert.equal(row.reason, '');
    assert.equal((await api.fill([row]))[0].ok, true);
    assert.equal(binding.clicks, 1); assert.equal(document.querySelector('#start').value, '2025-10');
    assert.equal(document.querySelector('#end').value, '至今'); window.close();
  }
});

test('UD present requires a unique enabled footer and both committed value and popup closure', async () => {
  for (const mode of ['missing', 'duplicate', 'disabled', 'no-value', 'open', 'changed-peer-after']) {
    const { api, document, window, data } = presentFixture();
    const binding = bindPresent(document, document.querySelector('#end'), { mode });
    const row = api.plan(data).rows.find(row => row.key === 'end');
    assert.equal((await api.fill([row]))[0].ok, false, mode);
    assert.equal(binding.clicks, ['no-value', 'open', 'changed-peer-after'].includes(mode) ? 1 : 0, mode);
    window.close();
  }
});

test('UD present stops if route, identity, peer or stop state changes while footer loads', async () => {
  for (const mode of ['route', 'identity', 'peer', 'replace-peer', 'stop']) {
    const { api, document, window, data } = presentFixture();
    const binding = bindPresent(document, document.querySelector('#end'), { mutate: () => {
      if (mode === 'route') window.history.pushState({}, '', '#other');
      if (mode === 'identity') document.querySelector('#anchor').value = '其他经历';
      if (mode === 'peer') document.querySelector('#start').value = '2024-01';
      if (mode === 'replace-peer') document.querySelector('#start').replaceWith(document.querySelector('#start').cloneNode());
      if (mode === 'stop') api.stop();
    } });
    const row = api.plan(data).rows.find(row => row.key === 'end');
    assert.equal((await api.fill([row]))[0].ok, false, mode); assert.equal(binding.clicks, 0, mode);
    window.close();
  }
});

test('UD present never applies to starts or standalone birth and award dates, or replaces existing ends', async () => {
  const { api, document, window, data } = presentFixture('project', '', '2026-06');
  let clicks = 0; document.querySelectorAll('input').forEach(input => input.onclick = () => clicks++);
  const plan = api.plan(data);
  for (const key of ['start', 'end']) {
    const row = plan.rows.find(row => row.key === key);
    assert.equal((await api.fill([{ ...row, value: '至今' }]))[0].ok, false);
  }
  assert.equal(clicks, 0); window.close();
  for (const label of ['出生日期', '获奖时间']) {
    const ctx = setup(udField('date', label, '<div class="ud__picker"><input placeholder="YYYY-MM"></div>'));
    let opened = 0; ctx.document.querySelector('input').onclick = () => opened++;
    const row = ctx.api.plan({ ...profile, basic: { birthDate: '2002-11' } }).rows[0];
    assert.equal((await ctx.api.fill([{ ...row, value: '至今', choice: true }]))[0].ok, false);
    assert.equal(opened, 0); ctx.window.close();
  }
});

test('UD and Phoenix calendars navigate year/month then commit a unique date', async () => {
  for (const kind of ['ud', 'phoenix-month', 'phoenix-day']) {
    const ud = kind === 'ud', day = kind === 'phoenix-day';
    const { api, document } = setup(ud ? udField('birth', '出生日期', '<div class="ud__picker"><input placeholder="YYYY-MM"></div>') : phoenixField('出生日期'), !ud);
    const binding = bindCalendar(document, document.querySelector('input'), { ud, day });
    const row = api.plan({ ...profile, basic: { birthDate: day || ud ? '2002-11-15' : '2002-11' } }).rows[0];
    assert.equal(row.reason, ''); assert.equal(row.value, day ? '2002-11-15' : '2002-11');
    assert.equal((await api.fill([row]))[0].ok, true); assert.equal(binding.clicks, 1);
  }
});

test('calendars preserve disabled dates, reject missing days, and stop on route changes', async () => {
  for (const mode of ['disabled', 'missing', 'route']) {
    const { api, document, window } = setup(phoenixField('出生日期'), true);
    const binding = bindCalendar(document, document.querySelector('input'), { day: true, disabled: mode === 'disabled', mutate: mode === 'route' ? () => window.history.pushState({}, '', '#other') : undefined });
    const row = api.plan({ ...profile, basic: { birthDate: mode === 'missing' ? '2002-11' : '2002-11-15' } }).rows[0];
    assert.equal((await api.fill([row]))[0].ok, false); assert.equal(binding.clicks, 0); window.close();
  }
});

test('Phoenix searchable single select and staged selector confirm only the field option', async () => {
  for (const staged of [false, true]) {
    const name = staged ? '民族' : '政治面貌', value = staged ? '汉族' : '共青团员';
    const { api, document, window } = setup(phoenixField(name) + '<button>保存</button><button>预览并提交</button>', true);
    const input = document.querySelector('input'); let confirms = 0, submits = 0;
    document.querySelectorAll('button').forEach(n => n.onclick = () => submits++);
    input.onclick = () => {
      const node = popup(document, 'common-unmodeled-layer', staged ? '<div class="constant-main-selector-container"><span class="select-data-num-limit">1</span><div class="select-data-container"><div class="select-data-empty"></div></div><input placeholder="搜索"><div class="options"></div><div class="selector-footer-button"><div class="phoenix-button">取消</div><div class="phoenix-button">确定</div></div></div>' : '<div class="phoenix-selectList"><input placeholder="搜索"><div class="options"></div></div>');
      const commit = () => { confirms++; input.value = value; input.closest('.phoenix-select').querySelector('.phoenix-select__tipEle').textContent = value; node.remove(); };
      if (staged) node.querySelectorAll('.phoenix-button')[1].onclick = commit;
      node.querySelector('input').oninput = () => setTimeout(() => {
        node.querySelector('.options').innerHTML = staged ? `<div class="list-item-container"><span class="icon-container"><svg class="RadioUnchecked" width="16" height="16"></svg></span><span class="item-text-label">${value}</span></div>` : `<li class="phoenix-selectList__listItem"><div class="phoenix-selectList__singleLabel">${value}</div></li>`;
        node.querySelector(staged ? '.icon-container svg' : 'li').onclick = staged ? () => { node.querySelector('.select-data-container').innerHTML = `<div class="select-item-container"><span class="select-text-label">${value}</span></div>`; } : commit;
      }, 120);
    };
    const row = api.plan({ ...profile, basic: { ethnicity: '汉族', politicalStatus: '共青团员' } }).rows[0];
    assert.equal(row.reason, ''); assert.equal((await api.fill([row]))[0].ok, true); assert.equal(confirms, 1); assert.equal(submits, 0);
    assert.match(api.plan(profile).rows[0].reason, /已有内容/); window.close();
  }
});
