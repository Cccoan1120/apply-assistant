import { profileGroups, profileRecords } from './schema.js';
import { loadLibrary, saveLibrary, watchLibrary, activeProfile } from './storage.js';
const $ = selector => document.querySelector(selector);
const el = (tag, text, className) => { const node = document.createElement(tag); if (text) node.textContent = text; if (className) node.className = className; return node; };
let library, profile, groups, scanned = null, rows = [], busy = false, pendingChange = false, mode = 'auto', autoStopped = false;
const icons = () => globalThis.lucide?.createIcons();
function status(message, error = false) { $('#status').textContent = message; $('#status').dataset.error = String(error); }
function options(select, items, selected = '') { select.replaceChildren(...items.map(([value, label]) => { const option = el('option', label); option.value = value; return option; })); if ([...select.options].some(o => o.value === String(selected))) select.value = selected; }
function entries() {
  const group = $('#fill-group').value;
  options($('#fill-entry'), profileRecords(profile, group).map((entry, index) => [index, entry.school || entry.company || entry.name || Object.values(entry).find(Boolean) || `经历 ${index + 1}`]), $('#fill-entry').value);
  $('#entry-label').hidden = group === 'basic';
}
function syncLibrary(next) {
  library = next; profile = activeProfile(library).data; groups = profileGroups(profile);
  options($('#fill-version'), library.profiles.map(item => [item.id, item.name]), library.activeId);
  $('#version-target').textContent = activeProfile(library).target;
  options($('#fill-group'), Object.entries(groups).map(([key, item]) => [key, item.label]), $('#fill-group').value);
  entries(); invalidate();
}
async function activeTab() {
  const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
  if (!tab?.id || !/^https?:\/\//.test(tab.url || '')) throw new Error('请在网申网页中点击浏览器工具栏的网申助手图标，再识别页面。');
  return tab;
}
async function pageCall(method, args = [], pinned = true) {
  const tab = await activeTab();
  if (pinned && (!scanned || scanned.tabId !== tab.id || scanned.url !== tab.url)) throw new Error('当前页面已切换，请重新识别。');
  const result = await chrome.scripting.executeScript({ target: { tabId: tab.id }, func: async (method, args, expectedUrl) => {
    if (location.href !== expectedUrl) throw new Error('页面已跳转，请重新识别。');
    if (!globalThis.ApplyAssistant) throw new Error('页面已刷新，请重新识别。');
    return globalThis.ApplyAssistant[method](...args);
  }, args: [method, args, tab.url] });
  return result[0].result;
}
const pause = milliseconds => new Promise(resolve => setTimeout(resolve, milliseconds));
async function pageScanWithRetry(method, args) {
  let data;
  for (let attempt = 0; attempt < 6; attempt++) {
    data = await pageCall(method, args, false);
    if (data.rows?.length || attempt === 5) return data;
    status('等待网页表单加载...');
    await pause(250);
  }
  return data;
}
function invalidate() { scanned = null; rows = []; $('#rows').replaceChildren(el('p', '待识别当前页面', 'muted')); $('#count').textContent = '0'; $('#select-all').checked = false; updateApply(); }
function selectedRecord() { return profileRecords(profile, $('#fill-group').value)[Number($('#fill-entry').value) || 0] || {}; }
function updateApply() {
  const count = rows.filter(row => row.checked && !row.reason && !row.done).length;
  $('#apply').disabled = busy || count === 0; $('#apply span').textContent = count ? `填入所选 (${count})` : '填入所选';
  const differences = rows.filter(row => row.canReplace && !row.done).length;
  $('#replace-differences').hidden = mode !== 'auto' || !differences;
  $('#replace-differences').disabled = busy;
  $('#replace-differences span').textContent = `按${library ? activeProfile(library).name : '当前模板'}更新 ${differences} 处差异`;
}
async function refreshRow(row) {
  row.value = selectedRecord()[row.key] || '';
  row.reason = row.current.trim() ? '已有内容，保持原值' : !row.key ? '待匹配' : !row.value ? '资料未填写' : '';
  if (!row.reason) { const [result] = await pageCall('preview', [[{ id: row.id, value: row.value }]]); row.reason = result.reason || ''; }
  if (row.reason) row.checked = false;
}
function renderRows() {
  $('#rows').replaceChildren();
  for (const row of rows) row.duplicate = !!row.key && rows.filter(other => other.key === row.key).length > 1;
  for (const row of rows) {
    if (mode === 'auto') {
      const wrap = el('div', '', 'field-row auto-row');
      const content = el('div', '', 'field-content');
      content.append(el('div', row.label, 'field-name'), el('div', row.source || '未匹配资料', 'field-source'));
      if (row.canReplace && !row.done) {
        content.append(el('span', '网页原文', 'field-source'), el('p', row.current, 'field-value'));
        content.append(el('span', `${activeProfile(library).name}模板`, 'field-source'), el('p', row.value, 'field-value template-value'));
      } else content.append(el('p', row.done ? row.value : row.current || row.value || '未填写', 'field-value'));
      content.append(el('span', row.done ? '已填入' : row.reason || '可自动填写', `field-reason${row.done ? ' success' : ''}`));
      const copy = el('button', '', 'icon'); copy.title = '复制资料'; copy.setAttribute('aria-label', `复制${row.label}`); copy.disabled = !row.value;
      const icon = el('i'); icon.dataset.lucide = 'copy'; copy.append(icon); copy.onclick = () => run(async () => { await navigator.clipboard.writeText(row.value); status('已复制。'); });
      wrap.append(content, copy); $('#rows').append(wrap); continue;
    }
    const wrap = el('div', '', 'field-row');
    const checkbox = el('input'); checkbox.type = 'checkbox'; checkbox.checked = row.checked; checkbox.disabled = !!row.reason || row.done; checkbox.setAttribute('aria-label', `填入${row.label}`);
    checkbox.onchange = () => { row.checked = checkbox.checked; updateApply(); };
    const content = el('div', '', 'field-content'); content.append(el('div', row.label, 'field-name'));
    const mapping = el('select'); mapping.setAttribute('aria-label', `${row.label}资料来源`);
    options(mapping, [['', '选择对应资料'], ...Object.entries(groups[$('#fill-group').value].fields)], row.key);
    mapping.disabled = !!row.current.trim() || row.done;
    mapping.onchange = () => run(async () => { row.key = mapping.value; row.checked = false; await refreshRow(row); renderRows(); });
    content.append(mapping, el('p', row.current || row.value || '未填写', 'field-value'));
    content.append(el('span', row.done ? '已填入' : row.reason || (row.duplicate ? '存在同名字段，请核对后勾选' : '可填入'), `field-reason${row.done ? ' success' : ''}`));
    const copy = el('button', '', 'icon'); copy.title = '复制资料'; copy.setAttribute('aria-label', `复制${row.label}`); const icon = el('i'); icon.dataset.lucide = 'copy'; copy.append(icon); copy.disabled = !row.value;
    copy.onclick = () => run(async () => { await navigator.clipboard.writeText(row.value); status('已复制。'); });
    wrap.append(checkbox, content, copy); $('#rows').append(wrap);
  }
  if (!rows.length) $('#rows').append(el('p', '未找到可识别的表单字段。', 'muted'));
  $('#count').textContent = String(rows.length); icons(); updateApply();
}
async function run(action) {
  if (busy) return;
  busy = true; $('#fill-view').inert = true; updateApply();
  try { await action(); } catch (error) { status(error.message || '操作失败，请重试。', true); }
  finally { busy = false; $('#fill-view').inert = false; updateApply(); if (pendingChange) { pendingChange = false; await reload().catch(error => { invalidate(); status(error.message,true); }); } }
}
async function reload() {
  const latest = await loadLibrary();
  if (!library || latest.revision !== library.revision) { syncLibrary(latest); status('资料已更新，请重新识别。'); }
}
async function scanPage() {
  await reload(); status('正在识别页面...'); const tab = await activeTab();
  await chrome.scripting.executeScript({ target: { tabId: tab.id }, files: ['engine.js'] });
  const group = $('#fill-group').value;
  const data = mode === 'auto' ? await pageScanWithRetry('plan', [profile]) : await pageScanWithRetry('scan', [group, group.startsWith('custom_') ? groups[group].fields : null]);
  scanned = { tabId: tab.id, url: data.url, revision: library.revision }; rows = data.rows;
  if (mode === 'manual') for (const row of rows) { await refreshRow(row); row.duplicate = !!row.key && rows.filter(other => other.key === row.key).length > 1; row.checked = !!row.key && !row.reason && !row.duplicate; }
  $('#platform').textContent = data.platform; $('#page').textContent = `${tab.title || '网申页面'} · ${new URL(data.url).hostname}`;
  $('#select-all').checked = false; renderRows(); status(data.frames ? '已识别主页面；内嵌页面中的字段需单独打开后识别。' : `已识别 ${rows.length} 个字段。`);
}
$('#scan').onclick = () => run(scanPage);
$('#replace-differences').onclick = () => run(async () => {
  const latest = await loadLibrary();
  if (!scanned || latest.revision !== scanned.revision) { syncLibrary(latest); throw new Error('资料已更新，请重新预览差异。'); }
  const items = rows.filter(row => row.canReplace && !row.done).map(({ id, value }) => ({ id, value }));
  const results = await pageCall('replace', [items]);
  for (const result of results) { const row = rows.find(row => row.id === result.id); row.done = result.ok; row.reason = result.reason; if (!result.ok) row.canReplace = false; }
  renderRows();
  status(`已按${activeProfile(library).name}更新 ${results.filter(row => row.ok).length} 项，${results.filter(row => !row.ok).length} 项需重新核对。`);
});
$('#auto-fill').onclick = () => run(async () => {
  await scanPage();
  autoStopped = false; $('#stop-auto').hidden = false;
  try {
    const latest = await loadLibrary();
    if (latest.revision !== scanned.revision) { syncLibrary(latest); throw new Error('资料已更新，请重新填写。'); }
    if (autoStopped) return;
    status('正在补齐经历区块...');
    const prepared = await pageCall('prepare', [profile]);
    if (autoStopped || prepared.stopped) { status('已停止填写。已添加的空白经历保留。'); return; }
    const data = await pageCall('plan', [profile]); rows = data.rows; renderRows();
    const current = await loadLibrary();
    if (current.revision !== scanned.revision) { syncLibrary(current); throw new Error('资料已更新，请重新填写。'); }
    if (autoStopped) return;
    const items = rows.filter(row => !row.reason).map(({ id, value, choice }) => ({ id, value, choice }));
    const added = prepared.results.reduce((total, item) => total + item.added, 0);
    const notes = prepared.results.filter(item => item.reason).map(item => `${groups[item.group].label}：${item.reason}`).join('；');
    const extra = `${added ? `已添加 ${added} 条经历。` : ''}${notes ? ` ${notes}。` : ''}`;
    if (!items.length) { status(`没有可自动填写的空白字段，请查看匹配结果。${extra}`); return; }
    status(`正在填写 ${items.length} 项...`);
    const results = await pageCall('fill', [items, { continueRun: true }]);
    for (const result of results) { const row = rows.find(row => row.id === result.id); row.done = result.ok; row.reason = result.reason; }
    renderRows();
    const filled = results.filter(result => result.ok).length;
    const pending = rows.filter(row => !row.done && !row.current.trim()).length;
    status(`${autoStopped ? '已停止。' : ''}已自动填入 ${filled} 项，${pending} 项待处理。${extra}`);
  } finally { $('#stop-auto').hidden = true; }
});
$('#stop-auto').onclick = async () => { autoStopped = true; try { await pageCall('stop'); status('已请求停止填写。'); } catch (error) { status(error.message, true); } };
function setMode(next) {
  if (busy) return;
  mode = next;
  $('#mode-auto').setAttribute('aria-pressed', String(mode === 'auto'));
  $('#mode-manual').setAttribute('aria-pressed', String(mode === 'manual'));
  $('#manual-selectors').hidden = $('#manual-actions').hidden = mode === 'auto';
  $('#auto-fill').hidden = mode !== 'auto';
  $('#scan span').textContent = mode === 'auto' ? '预览整页匹配' : '识别当前页面';
  invalidate();
}
$('#mode-auto').onclick = () => setMode('auto');
$('#mode-manual').onclick = () => setMode('manual');
$('#apply').onclick = () => run(async () => {
  const latest = await loadLibrary();
  if (!scanned || latest.revision !== scanned.revision) { syncLibrary(latest); throw new Error('资料版本已更新，请重新识别后填入。'); }
  const items = rows.filter(row => row.checked && !row.reason && !row.done).map(({ id, value }) => ({ id, value }));
  const results = await pageCall('fill', [items]);
  for (const result of results) { const row = rows.find(row => row.id === result.id); row.done = result.ok; row.reason = result.reason; row.checked = false; }
  renderRows(); const count = results.filter(result => result.ok).length; status(`已填入 ${count} 项，未填入 ${results.length - count} 项。`);
});
$('#undo').onclick = () => run(async () => { const result = await pageCall('undo', [], false); invalidate(); status(`已撤销 ${result.restored} 项，${result.skipped} 项保留或需手动核对。`); });
$('#select-all').onchange = event => { for (const row of rows) row.checked = event.target.checked && !row.reason && !row.done && !row.duplicate; renderRows(); };
$('#fill-group').onchange = () => { entries(); invalidate(); }; $('#fill-entry').onchange = invalidate;
$('#fill-version').onchange = () => run(async () => { const next = { ...library, activeId: $('#fill-version').value }; try { syncLibrary(await saveLibrary(next, library.revision)); status(`已切换至${activeProfile(library).name}。`); } catch(error) { await reload(); throw error; } });
$('#manage').onclick = () => chrome.runtime.openOptionsPage();
watchLibrary(() => { if (busy) pendingChange = true; else void reload().catch(error => { invalidate(); status(error.message, true); }); });
try { syncLibrary(await loadLibrary()); }
catch (error) { $('#fill-view').inert = true; status(`资料读取失败：${error.message}`, true); }
icons();
