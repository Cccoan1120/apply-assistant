import { emptyLibrary, validateLibrary } from './library.js';
const key = 'applyAssistant.library';
const isExtension = !!globalThis.chrome?.storage?.local;
const localPreset = isExtension && chrome.runtime?.id
  ? import('./local-profile-preset.js').then(module => module.default).catch(() => null)
  : Promise.resolve(null);
const locked = action => navigator.locks.request('apply-assistant-library', action);
async function read() {
  if (isExtension) return chrome.storage.local.get(['library', 'profile', 'localPresetMigration', 'localBasicUpdates', 'localProfileUpdates']);
  const text = localStorage.getItem(key);
  if (text !== null) return { library: JSON.parse(text) };
  if (['127.0.0.1','localhost'].includes(location.hostname)) {
    const response = await fetch('/initial-library.json');
    if (response.ok) return { library: validateLibrary(await response.json()) };
  }
  return {};
}
async function write(library) {
  if (isExtension) await chrome.storage.local.set({ library });
  else localStorage.setItem(key, JSON.stringify(library));
}
async function applyBasicUpdates(library, preset, raw) {
  const applied = { ...raw.localBasicUpdates };
  for (const update of preset?.basicUpdates || []) {
    if (Object.hasOwn(applied, update.id)) continue;
    const target = library.profiles.find(profile => profile.id === update.profileId);
    if (!target) continue;
    const before = structuredClone(target.data.basic), filled = [], preserved = [];
    for (const [key, value] of Object.entries(update.values)) {
      if (!Object.hasOwn(before, key) || typeof value !== 'string' || !value.trim()) continue;
      if (before[key].trim()) { if (before[key] !== value) preserved.push(key); continue; }
      target.data.basic[key] = value; filled.push(key);
    }
    library = validateLibrary({ ...library, revision: library.revision + (filled.length ? 1 : 0) });
    applied[update.id] = { profileId: target.id, filled, preserved, appliedAt: new Date().toISOString() };
    const backup = await chrome.storage.local.get('localBasicUpdateBackups');
    // Store the patch receipt and original values in the same write as the updated library.
    await chrome.storage.local.set({ library, localBasicUpdates: applied,
      localBasicUpdateBackups: { ...backup.localBasicUpdateBackups, [update.id]: { profileId: target.id, basic: before } }
    });
  }
  return library;
}
async function applyProfileUpdates(library, preset, raw) {
  library = await applyBasicUpdates(library, preset, raw);
  const applied = { ...raw.localProfileUpdates };
  for (const update of preset?.profileUpdates || []) {
    if (Object.hasOwn(applied, update.id)) continue;
    const target = library.profiles.find(profile => profile.id === update.profileId);
    if (!target) continue;
    const before = structuredClone(target.data), changed = [], skipped = [];
    const patchValues = (record, values, prefix, onlyEmpty = false) => {
      for (const [key, value] of Object.entries(values || {})) {
        if (!Object.hasOwn(record, key) || typeof value !== 'string' || !value.trim()) { skipped.push(`${prefix}.${key}`); continue; }
        if (record[key] === value) continue;
        if (onlyEmpty && record[key].trim()) { skipped.push(`${prefix}.${key}`); continue; }
        record[key] = value; changed.push(`${prefix}.${key}`);
      }
    };
    patchValues(target.data.basic, update.values, 'basic');
    for (const module of update.addModules || []) {
      if (target.data.modules.some(existing => existing.id === module.id || existing.label.trim() === module.label.trim())) { skipped.push(module.id); continue; }
      target.data.modules.push(structuredClone(module));
      changed.push(module.id);
    }
    for (const addition of update.addFields || []) {
      const module = target.data.modules.find(module => module.id === addition.moduleId);
      const field = addition.field;
      if (!module || module.fields.some(existing => existing.id === field.id || existing.label.trim() === field.label.trim())) { skipped.push(`${addition.moduleId}.${field.id}`); continue; }
      module.fields.push(structuredClone(field));
      for (const entry of module.entries) entry[field.id] = '';
      changed.push(`${addition.moduleId}.${field.id}`);
    }
    for (const patch of update.records || []) {
      const module = target.data.modules.find(module => module.id === patch.moduleId);
      const entries = ['education', 'internship', 'project'].includes(patch.moduleId) ? target.data[patch.moduleId] : module?.entries || [];
      const matches = entries.filter(entry => Object.hasOwn(entry, patch.identityField) && entry[patch.identityField] === patch.identityValue);
      if (matches.length !== 1) { skipped.push(`${patch.moduleId}:${patch.identityValue}`); continue; }
      patchValues(matches[0], patch.values, `${patch.moduleId}[${entries.indexOf(matches[0])}]`, patch.onlyEmpty);
    }
    for (const group of ['internship', 'project']) {
      const replacements = update.replaceExperiences?.[group];
      if (!replacements) continue;
      const identity = group === 'internship' ? 'company' : 'name';
      // A user-supplied edition defines order and content; retain supplemental fields on unique matches.
      const entries = replacements.map(replacement => {
        const matches = target.data[group].filter(entry => entry[identity] === replacement.match);
        return { ...(matches.length === 1 ? matches[0] : {}), ...structuredClone(replacement.values) };
      });
      if (JSON.stringify(entries) !== JSON.stringify(target.data[group])) {
        target.data[group] = entries;
        changed.push(group);
      }
    }
    library = validateLibrary({ ...library, revision: library.revision + (changed.length ? 1 : 0) });
    applied[update.id] = { profileId: target.id, changed, skipped, appliedAt: new Date().toISOString() };
    const backup = await chrome.storage.local.get('localProfileUpdateBackups');
    // Explicit local corrections replace only named fields, with backup and receipt in one write.
    await chrome.storage.local.set({ library, localProfileUpdates: applied,
      localProfileUpdateBackups: { ...backup.localProfileUpdateBackups, [update.id]: { profileId: target.id, data: before } }
    });
  }
  return library;
}
export function loadLibrary() {
  return locked(async () => {
    const raw = await read();
    const preset = await localPreset;
    if (preset && raw.localPresetMigration !== preset.id) {
      const current = Object.hasOwn(raw, 'library') ? validateLibrary(raw.library) : emptyLibrary(raw.profile);
      const library = validateLibrary({ ...preset.library, revision: current.revision + 1 });
      // Apply this local setup once, retaining the previous browser data for recovery.
      await chrome.storage.local.set({
        library, localPresetMigration: preset.id,
        localPresetBackup: { library: raw.library ?? null, profile: raw.profile ?? null, savedAt: new Date().toISOString() }
      });
      return applyProfileUpdates(library, preset, raw);
    }
    if (Object.hasOwn(raw,'library')) {
      const library = validateLibrary(raw.library);
      if (!isExtension && localStorage.getItem(key) === null) await write(library);
      return applyProfileUpdates(library, preset, raw);
    }
    const library = emptyLibrary(raw.profile);
    await write(library);
    return applyProfileUpdates(library, preset, raw);
  });
}
export function saveLibrary(next, expectedRevision) {
  return locked(async () => {
    const raw = await read();
    const current = Object.hasOwn(raw,'library') ? validateLibrary(raw.library) : emptyLibrary(raw.profile);
    if (current.revision !== expectedRevision) throw new Error('资料已在另一个窗口更新。请导出未保存的版本，或重新载入最新资料后修改。');
    const library = validateLibrary({ ...next, revision: current.revision + 1 });
    await write(library);
    return library;
  });
}
export function watchLibrary(callback) {
  if (isExtension && chrome.storage.onChanged) {
    const listener = (changes, area) => { if (area === 'local' && changes.library) callback(); };
    chrome.storage.onChanged.addListener(listener);
    return () => chrome.storage.onChanged.removeListener(listener);
  }
  const listener = event => { if (event.key === key) callback(); };
  addEventListener('storage', listener);
  return () => removeEventListener('storage', listener);
}
export const activeProfile = library => library.profiles.find(profile => profile.id === library.activeId);
