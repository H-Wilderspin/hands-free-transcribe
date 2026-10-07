import { get, set, del, keys } from 'idb-keyval';
import type { SpeakerProfile } from '../engine/types';

const PROFILE_PREFIX = 'speaker:';

export interface StoredSpeakerProfile extends SpeakerProfile {
  // Plan B: the raw enrollment audio is the voiceprint (embeddings are not
  // available in prebuilt wasm). ~15s of 16k mono f32 = ~960KB per profile.
  referenceSamples: Float32Array | null;
}

export async function saveProfile(p: StoredSpeakerProfile): Promise<void> {
  await set(PROFILE_PREFIX + p.id, p);
}

/** Merge-save: read the stored profile, apply the patch, persist. */
export async function updateProfile(id: string, patch: Partial<Omit<StoredSpeakerProfile, 'id'>>): Promise<void> {
  const existing = await get<StoredSpeakerProfile>(PROFILE_PREFIX + id);
  if (!existing) throw new Error(`no profile ${id} in IndexedDB`);
  await set(PROFILE_PREFIX + id, { ...existing, ...patch, id });
}

export async function loadProfiles(): Promise<StoredSpeakerProfile[]> {
  const allKeys = await keys();
  const profileKeys = allKeys
    .filter((k): k is string => typeof k === 'string' && k.startsWith(PROFILE_PREFIX));
  const profiles = await Promise.all(profileKeys.map((k) => get<StoredSpeakerProfile>(k)));
  return profiles.filter((p): p is StoredSpeakerProfile => p !== undefined);
}

export async function deleteProfile(id: string): Promise<void> {
  await del(PROFILE_PREFIX + id);
}
