import type { LogEntry } from '@sododeck/host-protocol';

/** Size of a message in bytes, as far as a person needs it: text and picture bytes counted. */
function sizeOf(message: LogEntry['message']): number {
  if ('text' in message) return new TextEncoder().encode(message.text).length;
  if ('bytes' in message) return message.bytes.length;
  return new TextEncoder().encode(JSON.stringify(message)).length;
}

/** The fake host's traffic, one row per message, newest last (067 FR-023). */
export function EmbedHostLog({ log }: { log: readonly LogEntry[] }) {
  return (
    <div className="max-h-80 overflow-auto rounded-input border border-border bg-surface">
      <table aria-label="Message log" className="w-full text-left text-body-sm">
        <thead className="sticky top-0 bg-surface-2 text-ink-secondary">
          <tr>
            <th scope="col" className="px-3 py-1.5 font-medium">
              Direction
            </th>
            <th scope="col" className="px-3 py-1.5 font-medium">
              Type
            </th>
            <th scope="col" className="px-3 py-1.5 text-right font-medium">
              Bytes
            </th>
            <th scope="col" className="px-3 py-1.5 text-right font-medium">
              Since previous
            </th>
          </tr>
        </thead>
        <tbody>
          {log.map((entry, index) => {
            const previous = log[index - 1];
            return (
              <tr key={index} className="border-t border-hairline">
                <td className="px-3 py-1">
                  {entry.dir === 'in' ? 'editor → host' : 'host → editor'}
                </td>
                <td className="px-3 py-1 font-mono">{entry.message.type}</td>
                <td className="px-3 py-1 text-right tabular-nums">{sizeOf(entry.message)}</td>
                <td className="px-3 py-1 text-right tabular-nums">
                  {previous === undefined ? '' : `${String(entry.at - previous.at)} ms`}
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}
