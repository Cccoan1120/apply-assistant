import test from 'node:test';
import assert from 'node:assert/strict';
import { emptyProfile, validateProfile, profileGroups, profileRecords } from '../extension/schema.js';
import { emptyLibrary, validateLibrary } from '../extension/library.js';

function customProfile() {
  const profile = emptyProfile();
  profile.basic.name = '测试';
  profile.modules = [{ id: 'custom_awards', label: '获奖经历', fields: [{ id: 'field_title', label: '奖项名称', type: 'text' }, { id: 'field_month', label: '获奖时间', type: 'month' }], entries: [{ field_title: '校级奖学金', field_month: '2025-09' }] }];
  return profile;
}

test('legacy profiles normalize without losing built-in data', () => {
  const old = emptyProfile();
  delete old.modules;
  old.education.push({ school: '测试大学' });
  const profile = validateProfile(old);
  assert.deepEqual(profile.modules, []);
  assert.equal(profile.education[0].school, '测试大学');
  assert.equal(profile.education[0].major, '');
});

test('custom modules roundtrip and expose dynamic field groups', () => {
  const profile = validateProfile(customProfile());
  assert.deepEqual(validateProfile(JSON.parse(JSON.stringify(profile))), profile);
  assert.equal(profileGroups(profile).custom_awards.fields.field_title, '奖项名称');
  assert.equal(profileGroups(profile).custom_awards.types.field_month, 'month');
  assert.deepEqual(profileRecords(profile, 'custom_awards'), profile.modules[0].entries);
  assert.deepEqual(profileRecords(profile, 'basic'), [profile.basic]);
  assert.deepEqual(profileRecords(profile, 'missing'), []);
});

test('custom module validation rejects duplicates, unsafe IDs and malformed fields', () => {
  const mutations = [
    p => p.modules.push(structuredClone(p.modules[0])),
    p => p.modules[0].id = '__proto__',
    p => p.modules[0].fields[0].id = 'constructor',
    p => p.modules[0].fields.push(structuredClone(p.modules[0].fields[0])),
    p => p.modules[0].fields[1].label = ' 奖项名称 ',
    p => p.modules[0].fields[0].type = 'script',
    p => p.modules[0].fields = [],
    p => p.modules[0].entries = {},
    p => p.modules[0].entries[0].field_title = 3,
    p => p.modules[0].label = ' ',
    p => p.basic.name = 'x'.repeat(20001),
    p => p.modules[0].entries[0].field_title = 'x'.repeat(20001),
    p => p.modules[0].entries = Array.from({ length: 101 }, () => ({})),
    p => p.modules = null
  ];
  for (const mutate of mutations) {
    const profile = customProfile();
    mutate(profile);
    assert.throws(() => validateProfile(profile));
  }
});

test('custom limits accept boundaries and reject overflows', () => {
  const profile = customProfile();
  profile.modules[0].fields = Array.from({ length: 40 }, (_, i) => ({ id: `field_${i}`, label: `字段${i}`, type: 'text' }));
  profile.modules[0].entries = Array.from({ length: 100 }, () => ({}));
  profile.modules = Array.from({ length: 32 }, (_, i) => ({ ...structuredClone(profile.modules[0]), id: `custom_${i}` }));
  assert.equal(validateProfile(profile).modules.length, 32);
  profile.modules.push({ ...structuredClone(profile.modules[0]), id: 'custom_33' });
  assert.throws(() => validateProfile(profile));
  profile.modules.pop();
  profile.modules[0].fields.push({ id: 'field_41', label: '字段41', type: 'text' });
  assert.throws(() => validateProfile(profile));
});

test('imported prototype keys are discarded and cannot pollute output', () => {
  const profile = customProfile();
  profile.modules[0].entries[0] = JSON.parse('{"field_title":"奖项","__proto__":{"polluted":true},"constructor":"bad"}');
  const clean = validateProfile(profile);
  assert.equal(Object.hasOwn(clean.modules[0].entries[0], '__proto__'), false);
  assert.equal(Object.hasOwn(clean.modules[0].entries[0], 'constructor'), false);
  assert.equal({}.polluted, undefined);
  assert.throws(() => validateProfile({ ...profile, basic: Object.create({ name: 'inherited' }) }));
});

test('libraries preserve independent versions, active selection and metadata', () => {
  const library = emptyLibrary(customProfile());
  const copy = structuredClone(library.profiles[0]);
  copy.id = 'profile_product'; copy.name = '产品经理'; copy.target = '产品经理校招'; copy.data.basic.summary = '产品方向';
  library.profiles.push(copy); library.activeId = copy.id; library.revision = 4;
  const clean = validateLibrary(JSON.parse(JSON.stringify(library)));
  assert.equal(clean.activeId, copy.id);
  assert.equal(clean.revision, 4);
  assert.equal(clean.profiles[1].data.basic.summary, '产品方向');
  assert.equal(clean.profiles[0].data.basic.summary, '');
  assert.deepEqual(validateLibrary(clean), clean);
});

test('library validation rejects invalid active IDs, duplicate IDs and invalid metadata', () => {
  const mutations = [
    l => l.activeId = 'profile_missing',
    l => l.profiles.push(structuredClone(l.profiles[0])),
    l => l.profiles = [],
    l => l.profiles[0].id = '__proto__',
    l => l.profiles[0].name = ' ',
    l => l.profiles[0].target = 1,
    l => l.revision = -1,
    l => l.revision = 1.5,
    l => l.revision = Number.MAX_SAFE_INTEGER,
    l => l.profiles[0].data.modules = false,
    l => l.profiles = Array.from({ length: 51 }, (_, i) => ({ ...structuredClone(l.profiles[0]), id: `profile_${i}` }))
  ];
  for (const mutate of mutations) {
    const library = emptyLibrary(); mutate(library);
    assert.throws(() => validateLibrary(library));
  }
});
