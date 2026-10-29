import { emptyProfile, validateProfile, profileGroups, profileRecords } from './schema.js';
import { validateLibrary } from './library.js';
import { loadLibrary, saveLibrary, watchLibrary, activeProfile } from './storage.js';
const $ = selector => document.querySelector(selector);
const node = (tag, text = '', className = '') => { const el = document.createElement(tag); el.textContent = text; if (className) el.className = className; return el; };
const uid = prefix => `${prefix}_${crypto.randomUUID()}`;
const icons = () => globalThis.lucide?.createIcons();
let library, draft, selectedGroup = 'basic', dirty = false, busy = false, dialogAction;
function status(text, error = false) { $('#status').textContent = text; $('#status').dataset.error = String(error); }
function markDirty() { dirty = true; status('有未保存的修改'); $('#save-data').disabled = false; }
function adopt(next) { library = next; draft = structuredClone(activeProfile(library)); dirty = false; $('#conflict').hidden = true; render(); }
function button(icon, title, action) {
  const el = node('button', '', 'icon'); el.type = 'button'; el.title = title; el.setAttribute('aria-label', title);
  const image = node('i'); image.dataset.lucide = icon; el.append(image); el.onclick = action; return el;
}
async function task(action) {
  if (busy) return;
  busy = true; $('.sidebar').inert = true; $('.workspace').inert = true;
  try { await action(); } catch (error) { status(error.message || '操作失败，请重试。', true); }
  finally { busy = false; $('.sidebar').inert = false; $('.workspace').inert = false; }
}
async function commit(next, message) { adopt(await saveLibrary(next, library.revision)); status(message); }
async function saveCurrent() {
  const next = structuredClone(library);
  next.profiles[next.profiles.findIndex(item => item.id === draft.id)] = structuredClone(draft);
  await commit(next, '版本已保存');
}
async function flush() { if (dirty) await saveCurrent(); }
function customModule() { return draft.data.modules.find(module => module.id === selectedGroup); }
function renderNavigation() {
  $('#version-list').replaceChildren();
  for (const version of library.profiles) {
    const current = version.id === draft.id ? draft : version;
    const item = node('button', '', version.id === draft.id ? 'active' : ''); item.type = 'button'; item.dataset.version = version.id; item.setAttribute('aria-pressed', String(version.id === draft.id));
    const icon = node('i'); icon.dataset.lucide = 'files'; const copy = node('span', '', 'version-copy'); copy.append(node('strong', current.name)); if (current.target) copy.append(node('small', current.target)); item.append(icon, copy);
    item.onclick = () => task(async () => { if (version.id === draft.id) return; await flush(); await commit({ ...library, activeId: version.id }, '已切换投递版本'); });
    $('#version-list').append(item);
  }
  const groups = profileGroups(draft.data);
  if (!groups[selectedGroup]) selectedGroup = 'basic';
  $('#module-list').replaceChildren();
  const symbols = {basic:'user-round',education:'graduation-cap',internship:'briefcase-business',project:'folder-open'};
  for (const [key, group] of Object.entries(groups)) {
    const item = node('button', '', key === selectedGroup ? 'active' : ''); item.type = 'button'; item.dataset.group = key; item.setAttribute('aria-pressed', String(key === selectedGroup));
    const icon = node('i'); icon.dataset.lucide = symbols[key] || 'layout-list'; item.append(icon, node('span', group.label));
    if (key !== 'basic') item.append(node('small', String(profileRecords(draft.data, key).length)));
    item.onclick = () => { selectedGroup = key; render(); };
    $('#module-list').append(item);
  }
}
function render() {
  renderNavigation();
  $('#version-title').textContent = draft.name;
  $('#version-target').textContent = draft.target;
  $('#delete-version').disabled = library.profiles.length === 1;
  const group = profileGroups(draft.data)[selectedGroup], custom = customModule();
  const records = profileRecords(draft.data, selectedGroup);
  $('#module-title').textContent = group.label;
  $('#module-count').textContent = selectedGroup === 'basic' ? `${Object.keys(group.fields).length} 个字段` : `${records.length} 条经历`;
  for (const id of ['#edit-module','#delete-module','#add-field']) $(id).hidden = !custom;
  $('#add-entry').hidden = selectedGroup === 'basic';
  $('#entry-list').replaceChildren();
  if (!records.length) { const empty = node('div', '', 'empty'); const icon = node('i'); icon.dataset.lucide = 'file-plus-2'; empty.append(icon, node('h3', `暂无${group.label}`)); $('#entry-list').append(empty); }
  records.forEach((record, index) => {
    const section = node('section', '', 'record'); section.dataset.entry = index;
    if (selectedGroup !== 'basic') {
      const header = node('div', '', 'record-header');
      const title = node('h3', record.school || record.company || record.name || Object.values(record).find(Boolean) || `${group.label} ${index + 1}`);
      const tools = node('div', '', 'tools');
      const up = button('arrow-up','上移经历',() => { [records[index - 1],records[index]] = [records[index],records[index - 1]]; markDirty(); render(); }); up.disabled = index === 0;
      const down = button('arrow-down','下移经历',() => { [records[index + 1],records[index]] = [records[index],records[index + 1]]; markDirty(); render(); }); down.disabled = index === records.length - 1;
      tools.append(up,down,button('copy','复制经历',() => { if(records.length >= 100) return status('每个模块最多 100 条经历。',true); records.splice(index + 1,0,structuredClone(record)); markDirty(); render(); }),button('trash-2','删除经历',() => { if(confirm('删除这条经历？保存版本后生效。')) { records.splice(index,1); markDirty(); render(); } }));
      header.append(title,tools); section.append(header);
    }
    const fields = node('div', '', 'record-fields');
    for (const [key, labelText] of Object.entries(group.fields)) {
      const type = group.types?.[key] || (['description','summary','skills','responsibilities','results','leaveReason','previousNames'].includes(key) ? 'textarea' : 'text');
      const label = node('label', '', type === 'textarea' ? 'long' : ''); const heading = node('span', '', 'field-heading'); heading.append(node('span',labelText));
      const input = node(type === 'textarea' ? 'textarea' : 'input'); input.dataset.field = key; input.setAttribute('aria-label',labelText); input.maxLength = 20000;
      if (type !== 'textarea') input.type = type === 'month' ? 'text' : type;
      if (type === 'month' || ['start','end','birthMonth'].includes(key)) input.placeholder = key === 'end' ? 'YYYY-MM 或 至今' : 'YYYY-MM';
      if (selectedGroup === 'basic' && key === 'birthDate') input.placeholder = 'YYYY-MM-DD';
      if (selectedGroup === 'basic' && ['height','weight'].includes(key)) { input.type = 'number'; input.min = '0'; input.step = 'any'; }
      input.value = record[key] || '';
      input.oninput = () => { record[key] = input.value; markDirty(); };
      label.append(heading,input); fields.append(label);
      if (custom && index === 0) {
        const tools = node('span', '', 'tools');
        const edit = button('pencil',`编辑字段${labelText}`,event => { event.preventDefault(); editField(custom.fields.find(field => field.id === key)); });
        const remove = button('x',`删除字段${labelText}`,event => { event.preventDefault(); if(confirm(`删除「${labelText}」及本版本中该字段的内容？`)) { custom.fields = custom.fields.filter(field => field.id !== key); custom.entries.forEach(entry => delete entry[key]); markDirty(); render(); } });
        remove.disabled = custom.fields.length === 1; tools.append(edit,remove); heading.append(tools);
      }
    }
    section.append(fields); $('#entry-list').append(section);
  });
  $('#save-data').disabled = !dirty; icons();
}
function openDialog(title, fields, action) {
  $('#dialog-title').textContent = title; $('#dialog-error').textContent = ''; $('#dialog-fields').replaceChildren(); dialogAction = action;
  for (const spec of fields) {
    const label = node('label',spec.label); const input = node(spec.options ? 'select' : 'input'); input.name = spec.name; input.required = !!spec.required; input.maxLength = spec.maxLength || 200;
    if (spec.options) for (const [value,text] of spec.options) { const option = node('option',text); option.value = value; input.append(option); }
    input.value = spec.value || ''; label.append(input); $('#dialog-fields').append(label);
  }
  $('#edit-dialog').showModal();
}
$('#dialog-form').onsubmit = async event => {
  event.preventDefault(); const values = Object.fromEntries(new FormData(event.currentTarget));
  const submit = event.currentTarget.querySelector('[type=submit]'); submit.disabled = true;
  try { await dialogAction(values); $('#edit-dialog').close(); }
  catch(error) { $('#dialog-error').textContent = error.message; }
  finally { submit.disabled = false; }
};
for (const id of ['#dialog-close','#dialog-cancel']) $(id).onclick = () => $('#edit-dialog').close();
function versionFields(name = '',target = '') { return [{name:'name',label:'版本名称',value:name,required:true},{name:'target',label:'目标岗位',value:target}]; }
function createVersion(copy) {
  openDialog(copy ? '复制为新版本' : '新增投递版本',versionFields(copy ? `${draft.name} · 副本` : '',copy ? draft.target : ''),async values => {
    if (!values.name.trim()) throw new Error('请输入版本名称。');
    if(library.profiles.length >= 50) throw new Error('最多保存 50 个版本。');
    await flush();
    const version = {id:uid('profile'),name:values.name.trim(),target:values.target.trim(),data:copy ? structuredClone(draft.data) : emptyProfile()};
    await commit({...library,activeId:version.id,profiles:[...library.profiles,version]},'新版本已创建');
  });
}
$('#new-version').onclick = () => createVersion(false);
$('#duplicate-version').onclick = () => createVersion(true);
$('#edit-version').onclick = () => openDialog('版本名称与岗位',versionFields(draft.name,draft.target),values => { if(!values.name.trim()) throw new Error('请输入版本名称。'); draft.name = values.name.trim(); draft.target = values.target.trim(); markDirty(); render(); });
$('#delete-version').onclick = () => task(async () => { if(library.profiles.length <= 1) return; if(!confirm(`删除「${draft.name}」及其中全部资料？`)) return; const profiles = library.profiles.filter(item => item.id !== draft.id); await commit({...library,profiles,activeId:profiles[0].id},'版本已删除'); });
$('#add-module').onclick = () => openDialog('新增资料模块',[{name:'label',label:'模块名称',required:true}],values => {
  if(!values.label.trim()) throw new Error('请输入模块名称。'); if(draft.data.modules.length >= 32) throw new Error('最多添加 32 个模块。');
  if(Object.values(profileGroups(draft.data)).some(group => group.label === values.label.trim())) throw new Error('已有同名模块。');
  const module = {id:uid('custom'),label:values.label.trim(),fields:[{id:uid('field'),label:'名称',type:'text'},{id:uid('field'),label:'内容描述',type:'textarea'}],entries:[{}]};
  draft.data.modules.push(module); selectedGroup = module.id; markDirty(); render();
});
$('#edit-module').onclick = () => openDialog('重命名模块',[{name:'label',label:'模块名称',value:customModule().label,required:true}],values => { const label=values.label.trim(); if(!label) throw new Error('请输入模块名称。'); if(Object.entries(profileGroups(draft.data)).some(([id,group]) => id!==selectedGroup && group.label===label)) throw new Error('已有同名模块。'); customModule().label=label; markDirty(); render(); });
$('#delete-module').onclick = () => { if(confirm(`删除「${customModule().label}」模块及其中内容？保存版本后生效。`)) { draft.data.modules=draft.data.modules.filter(module => module.id!==selectedGroup); selectedGroup='basic'; markDirty(); render(); } };
function editField(field) {
  openDialog(field ? '编辑字段' : '添加字段',[{name:'label',label:'字段名称',value:field?.label,required:true},{name:'type',label:'内容类型',value:field?.type || 'text',options:[['text','短文本'],['textarea','长文本'],['month','年月'],['email','电子邮箱'],['url','网址']]}],values => {
    const module=customModule(), label=values.label.trim(); if(!label) throw new Error('请输入字段名称。');
    if(module.fields.some(item => item.id!==field?.id && item.label===label)) throw new Error('已有同名字段。');
    if(field) Object.assign(field,{label,type:values.type});
    else { if(module.fields.length>=40) throw new Error('每个模块最多 40 个字段。'); module.fields.push({id:uid('field'),label,type:values.type}); }
    markDirty(); render();
  });
}
$('#add-field').onclick = () => editField();
$('#add-entry').onclick = () => { const records=profileRecords(draft.data,selectedGroup); if(records.length>=100) return status('每个模块最多 100 条经历。',true); records.push({}); markDirty(); render(); $('#entry-list .record:last-child input, #entry-list .record:last-child textarea')?.focus(); };
$('#save-data').onclick = () => task(saveCurrent);
function download(data,name) { const url=URL.createObjectURL(new Blob([JSON.stringify(data,null,2)],{type:'application/json'})); const link=node('a'); link.href=url; link.download=name.replace(/[<>:"/\\|?*]/g,'_'); link.click(); setTimeout(()=>URL.revokeObjectURL(url),1000); }
$('#export-data').onclick = () => { try { download({format:'apply-assistant-version',version:1,name:draft.name,target:draft.target,data:validateProfile(draft.data)},`${draft.name}.json`); status('当前版本已导出'); } catch(error) { status(error.message,true); } };
$('#export-all').onclick = () => { try { const next=structuredClone(library); next.profiles[next.profiles.findIndex(item=>item.id===draft.id)]=structuredClone(draft); download(validateLibrary(next),'网申资料库备份.json'); status('全部版本已备份'); } catch(error) { status(error.message,true); } };
$('#import-data').onclick = () => $('#import-file').click();
$('#import-file').onchange = event => { const file=event.target.files[0]; event.target.value=''; if(!file) return; void task(async()=>{
  if(file.size>20_000_000) throw new Error('文件不能超过 20 MB。'); const value=JSON.parse(await file.text());
  let imported;
  if(value.version===2) imported=validateLibrary(value).profiles;
  else if(value.format==='apply-assistant-version') imported=[{name:value.name,target:value.target,data:validateProfile(value.data)}];
  else imported=[{name:file.name.replace(/\.json$/i,''),target:'',data:validateProfile(value)}];
  await flush();
  imported=imported.map(item=>({...item,id:uid('profile')}));
  await commit({...library,activeId:imported[0].id,profiles:[...library.profiles,...imported]},`已导入 ${imported.length} 个版本`);
}); };
$('#reload-data').onclick = () => task(async()=>{ if(dirty && !confirm('放弃当前未保存的修改，载入最新资料？')) return; adopt(await loadLibrary()); status('已载入最新资料'); });
watchLibrary(()=>{ if(busy) return; void loadLibrary().then(next=>{ if(!library || next.revision===library.revision) return; if(dirty || $('#edit-dialog').open) $('#conflict').hidden=false; else { adopt(next); status('资料已同步'); } }).catch(error=>status(error.message,true)); });
addEventListener('beforeunload',event=>{ if(dirty) { event.preventDefault(); event.returnValue=''; } });
if(!globalThis.chrome?.storage?.local) {
  $('#storage-label').textContent='网页资料 · 未同步';
  $('#preview-notice').hidden=false;
  document.title='网页预览（未同步插件） · 网申助手';
  $('#save-data').lastChild.textContent='保存到网页';
} else $('#storage-label').textContent='插件资料';
try { adopt(await loadLibrary()); status('已保存到本地'); }
catch(error) { status(`资料读取失败：${error.message}`,true); $('.sidebar').inert=true; $('.workspace-header').inert=true; $('#save-data').disabled=true; }
