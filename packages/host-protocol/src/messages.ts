import { z } from 'zod';

/** The one integer both sides compare for equality at `init` (contracts/host-protocol.md). */
export const PROTOCOL_VERSION = 1;

const REASON_MAX = 300;

const capabilitiesSchema = z.object({
  openLinks: z.boolean().default(false),
  exportFiles: z.boolean().default(false),
  pictures: z.boolean().default(false),
});
export type Capabilities = z.infer<typeof capabilitiesSchema>;

const pictureId = z.string().regex(/^[0-9a-f]{64}$/);
const requestId = z.string().min(1).max(100);
const seq = z.number().int().nonnegative();
const reason = z.string().transform((s) => s.slice(0, REASON_MAX));
const bytes = z.custom<Uint8Array>((v) => v instanceof Uint8Array);
/** Any other string is accepted and read as light by the app. */
const scheme = z.string();

// NOTE: the picture's media type is `mime` (not `type`): `type` is the message discriminator.
export const editorMessageSchema = z.discriminatedUnion('type', [
  z.object({
    type: z.literal('ready'),
    protocolVersion: z.number().int().positive(),
    editorVersion: z.string(),
  }),
  z.object({ type: z.literal('change'), seq, text: z.string() }),
  z.object({ type: z.literal('flushed'), requestId }),
  z.object({
    type: z.literal('picture-put'),
    id: pictureId,
    mime: z.string(),
    name: z.string(),
    bytes,
  }),
  z.object({ type: z.literal('picture-get'), id: pictureId }),
  z.object({ type: z.literal('open-link'), href: z.string() }),
  z.object({ type: z.literal('export-file'), name: z.string(), mime: z.string(), bytes }),
  z.object({
    type: z.literal('fatal'),
    code: z.literal('protocol-version'),
    editorVersion: z.string(),
    protocolVersion: z.number().int().positive(),
  }),
]);
export type EditorMessage = z.infer<typeof editorMessageSchema>;

export const hostMessageSchema = z.discriminatedUnion('type', [
  z.object({
    type: z.literal('init'),
    // Any integer, and missing reads as 0: a host on another version still gets the editor's
    // plain "update" message instead of being ignored (the editor compares for equality).
    protocolVersion: z.number().int().default(0),
    text: z.string(),
    theme: scheme,
    capabilities: capabilitiesSchema,
  }),
  z.object({ type: z.literal('external-change'), text: z.string() }),
  z.object({
    type: z.literal('change-result'),
    seq,
    ok: z.boolean(),
    reason: reason.optional(),
  }),
  z.object({ type: z.literal('flush'), requestId }),
  z.object({ type: z.literal('theme'), scheme }),
  z.object({ type: z.literal('picture-stored'), id: pictureId, path: z.string() }),
  z.object({ type: z.literal('picture-store-failed'), id: pictureId, reason }),
  z.object({ type: z.literal('picture'), id: pictureId, mime: z.string(), bytes }),
  z.object({ type: z.literal('picture-missing'), id: pictureId, reason }),
]);
export type HostMessage = z.infer<typeof hostMessageSchema>;

export type Ready = Extract<EditorMessage, { type: 'ready' }>;
export type Init = Extract<HostMessage, { type: 'init' }>;

/** Narrow unknown input; `null` for anything that is not a valid editor message. */
export function parseEditorMessage(value: unknown): EditorMessage | null {
  const result = editorMessageSchema.safeParse(value);
  return result.success ? result.data : null;
}

/** Narrow unknown input; `null` for anything that is not a valid host message. */
export function parseHostMessage(value: unknown): HostMessage | null {
  const result = hostMessageSchema.safeParse(value);
  return result.success ? result.data : null;
}
