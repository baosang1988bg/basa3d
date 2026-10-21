import type { BuildResult } from './organizer-geometry';
import type { LabelParams, OrganizerParams, WarningKey } from './organizer-params';

/** Type-only contract between the UI and organizer.worker.ts (keeps manifold out of the main bundle). */
export type OrganizerWorkerRequest =
  | { type: 'build'; id: number; params: Partial<OrganizerParams>; label: Partial<LabelParams> | null }
  | { type: 'font'; bytes: ArrayBuffer | null };

export type OrganizerBuildSuccess = { id: number; ok: true; params: OrganizerParams; warnings: WarningKey[] } & BuildResult;
export type OrganizerWorkerResponse = OrganizerBuildSuccess | { id: number; ok: false; error: string };

export const DEFAULT_LABEL_FONT_URL = '/fonts/BeVietnamPro-Bold.ttf';
