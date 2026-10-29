import { emptyProfile, validateProfile } from "./schema.js";

const profileId = /^profile_[a-zA-Z0-9][a-zA-Z0-9_-]{0,99}$/;
const isRecord = value => !!value && typeof value === "object" && !Array.isArray(value) && (Object.getPrototypeOf(value) === Object.prototype || Object.getPrototypeOf(value) === null);

export function emptyLibrary(profile = emptyProfile()) {
  const id = `profile_${crypto.randomUUID()}`;
  return { version: 2, revision: 0, activeId: id, profiles: [{ id, name: "默认版本", target: "", data: validateProfile(profile) }] };
}

export function validateLibrary(value) {
  if (!isRecord(value) || value.version !== 2 || !Number.isSafeInteger(value.revision) || value.revision < 0 || value.revision >= Number.MAX_SAFE_INTEGER) throw new Error("资料库格式不正确，需要 version 2 的资料库文件。");
  if (!Array.isArray(value.profiles) || value.profiles.length < 1 || value.profiles.length > 50) throw new Error("资料库需要 1 到 50 个版本。");
  const ids = new Set();
  const profiles = value.profiles.map(profile => {
    if (!isRecord(profile) || typeof profile.id !== "string" || !profileId.test(profile.id) || ids.has(profile.id)) throw new Error("资料版本 ID 无效或重复。");
    ids.add(profile.id);
    if (typeof profile.name !== "string" || !profile.name.trim() || profile.name.length > 20000) throw new Error("版本名称不能为空，且不超过 20000 字。");
    if (typeof profile.target !== "string" || profile.target.length > 20000) throw new Error("目标岗位需要文本，且不超过 20000 字。");
    return { id: profile.id, name: profile.name, target: profile.target, data: validateProfile(profile.data) };
  });
  if (typeof value.activeId !== "string" || !ids.has(value.activeId)) throw new Error("当前版本不存在。");
  return { version: 2, revision: value.revision, activeId: value.activeId, profiles };
}
