import test from 'node:test';
import assert from 'node:assert/strict';
import { emptyProfile, validateProfile } from '../extension/schema.js';
import { emptyLibrary, validateLibrary } from '../extension/library.js';

const basicFields = ['birthDate', 'identityType', 'identityNumber', 'nationality', 'ethnicity', 'politicalStatus', 'nativePlace', 'hukou', 'address', 'postalCode', 'hukouAddress', 'residentialAddress', 'mailingAddress', 'cet4Score', 'cet6Score'];
const educationFields = ['college', 'studyType', 'graduationStatus', 'rank', 'classRank', 'gpa'];

test('older profiles acquire empty optional fields without deriving personal facts', () => {
  const input = emptyProfile();
  input.basic = { name: 'Synthetic applicant', birthMonth: '2000-06', city: 'Test city' };
  input.education = [{ school: 'Test university', major: 'Accounting', degree: 'Bachelor', start: '2020-09' }];
  const before = structuredClone(input);
  const clean = validateProfile(input);
  assert.deepEqual(input, before);
  for (const key of basicFields) assert.equal(clean.basic[key], '', key);
  for (const key of educationFields) assert.equal(clean.education[0][key], '', key);
  for (const [key, value] of Object.entries(before.basic)) assert.equal(clean.basic[key], value);
  for (const [key, value] of Object.entries(before.education[0])) assert.equal(clean.education[0][key], value);
});

test('new personal and education fields survive library export and reimport as exact text', () => {
  const input = emptyProfile();
  input.basic = Object.fromEntries(basicFields.map(key => [key, `test ${key}`]));
  input.basic.birthDate = '2000-06-03';
  input.basic.identityNumber = '00123456789012345X';
  input.basic.postalCode = '001234';
  input.education = [{ school: 'Test university', college: 'Test college', studyType: 'Test study type', graduationStatus: '未毕业', rank: 'Top 10%', classRank: '5/40', gpa: '3.80/4.00' }];
  const library = emptyLibrary(input);
  const clean = validateLibrary(JSON.parse(JSON.stringify(library))).profiles[0].data;
  for (const key of basicFields) assert.equal(clean.basic[key], input.basic[key], key);
  for (const key of educationFields) assert.equal(clean.education[0][key], input.education[0][key], key);
  assert.deepEqual(validateProfile(clean), clean);
});

test('identity numbers cannot silently lose digits through numeric imports', () => {
  const input = emptyProfile();
  input.basic.identityNumber = 123456789012345678;
  assert.throws(() => validateProfile(input), /需要文本/);
});
