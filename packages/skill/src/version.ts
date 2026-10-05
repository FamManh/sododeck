/**
 * The skill's version stamp (027 research R6). Until the format revision of 025 exists, the
 * skill names the schema it was built from by a fingerprint: the first 12 hex characters of the
 * SHA-256 of `schema/v1.json`. It changes exactly when the file format changes.
 */
import { createHash } from 'node:crypto';

import { FORMAT_VERSION, SCHEMA_URL } from '@sododeck/schema';

/** The base version of the skill's instructions and scripts; bumped by hand on releases. */
export const SKILL_BASE_VERSION = '1.0.0';

export interface VersionStamp {
  skill: string;
  formatVersion: number;
  fingerprint: string;
  schema: string;
}

export function schemaFingerprint(schemaText: string): string {
  return createHash('sha256').update(schemaText).digest('hex').slice(0, 12);
}

export function versionStamp(schemaText: string): VersionStamp {
  const fingerprint = schemaFingerprint(schemaText);
  return {
    skill: `${SKILL_BASE_VERSION}+${fingerprint}`,
    formatVersion: FORMAT_VERSION,
    fingerprint,
    schema: SCHEMA_URL,
  };
}
