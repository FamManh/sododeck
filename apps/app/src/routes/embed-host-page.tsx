import {
  createFakeHost,
  frameTransport,
  type EditorMessage,
  type FakeHost,
  type HostMessage,
  type Transport,
} from '@sododeck/host-protocol';
import { serializeDeck } from '@sododeck/model';
import { Button } from '@sododeck/ui/components/button';
import { Checkbox } from '@sododeck/ui/components/checkbox';
import { Input } from '@sododeck/ui/components/input';
import { Textarea } from '@sododeck/ui/components/textarea';
import { useEffect, useEffectEvent, useId, useReducer, useRef, useState } from 'react';

import { EmbedHostLog } from './embed-host-log';

const SAMPLES = Object.entries(
  import.meta.glob<string>('../samples/*.sododeck.json', {
    query: '?raw',
    import: 'default',
    eager: true,
  }),
).map(([path, text]) => ({
  name: /\/([^/]+)\.sododeck\.json$/.exec(path)?.[1] ?? path,
  text,
}));

type PictureAnswer = 'stored' | 'failed' | 'missing';

/** Counts traffic in both directions so the log re-renders; the messages pass through untouched. */
function observe<Out, In>(
  transport: Transport<Out, In>,
  onTraffic: () => void,
): Transport<Out, In> {
  return {
    send: (message) => {
      transport.send(message);
      onTraffic();
    },
    listen: (handler) =>
      transport.listen((message) => {
        handler(message);
        onTraffic();
      }),
  };
}

/** Applies the page's answer settings to the scripted host (its options are meant to be changed). */
function configure(
  host: FakeHost,
  { answering, pictureAnswer }: { answering: boolean; pictureAnswer: PictureAnswer },
) {
  host.options.answerChanges = answering;
  host.options.refusePictures = pictureAnswer === 'failed';
  // "Missing": the host forgets every picture, so `picture-get` is answered "missing".
  if (pictureAnswer === 'missing') host.options.pictures = new Map();
}

/** The first component's title gets " (edited outside)": a change a person made in a text editor. */
function renamedOutside(text: string): string | null {
  try {
    const file = JSON.parse(text) as { nodes?: { title?: string }[] };
    const first = file.nodes?.[0];
    if (first === undefined) return null;
    first.title = `${first.title ?? 'Untitled'} (edited outside)`;
    return serializeDeck(file as Parameters<typeof serializeDeck>[0]);
  } catch {
    return null;
  }
}

/**
 * Dev-only host stand-in (067 US6, `/embed-host`): the embedded editor in an iframe with a scripted
 * host around it. Every protocol flow can be driven by hand and watched in the message log,
 * with no real host program. Registered only when `import.meta.env.DEV`.
 */
export function EmbedHostPage() {
  const frame = useRef<HTMLIFrameElement>(null);
  const [fake, setFake] = useState<FakeHost | null>(null);
  const [, bump] = useReducer((n: number) => n + 1, 0);
  const [run, reload] = useReducer((n: number) => n + 1, 0);
  const [sample, setSample] = useState(SAMPLES[0]?.name ?? '');
  const [text, setText] = useState(SAMPLES[0]?.text ?? '');
  const [dark, setDark] = useState(false);
  const [capabilities, setCapabilities] = useState({
    openLinks: true,
    exportFiles: true,
    pictures: false,
  });
  const [protocolVersion, setProtocolVersion] = useState(1);
  const [answering, setAnswering] = useState(true);
  const [pictureAnswer, setPictureAnswer] = useState<PictureAnswer>('stored');
  const [notice, setNotice] = useState<string | null>(null);
  const ids = { sample: useId(), text: useId(), version: useId(), pictures: useId() };

  // The editor is told these at `init`; "Reload editor" sends them again with a new frame.
  const initialSettings = useEffectEvent(() => ({ text, dark, capabilities, protocolVersion }));

  useEffect(() => {
    const element = frame.current;
    if (element === null) return;
    const transport: Transport<HostMessage, EditorMessage> = observe(
      frameTransport(element, window.location.origin),
      bump,
    );
    const now = initialSettings();
    setFake(
      createFakeHost(transport, {
        text: now.text,
        theme: now.dark ? 'dark' : 'light',
        capabilities: now.capabilities,
        protocolVersion: now.protocolVersion,
      }),
    );
    return () => {
      setFake(null);
    };
  }, [run]);

  useEffect(() => {
    if (fake !== null) configure(fake, { answering, pictureAnswer });
  }, [fake, answering, pictureAnswer]);

  const act = (message: string, action: (h: FakeHost) => void) => {
    if (fake === null) return;
    action(fake);
    setNotice(message);
    bump();
  };

  return (
    <main className="mx-auto flex max-w-7xl flex-col gap-4 p-6 text-ink">
      <header className="flex items-baseline gap-3">
        <h1 className="text-title-md">Embed host</h1>
        <span className="text-caption text-ink-muted">
          Dev only · fake host for the embedded editor
        </span>
      </header>
      <div className="grid gap-4 lg:grid-cols-[360px_minmax(0,1fr)]">
        <section aria-label="Host controls" className="flex flex-col gap-4">
          <div className="flex flex-col gap-1.5">
            <label htmlFor={ids.sample} className="text-body-sm font-medium text-ink-secondary">
              Sample deck
            </label>
            <select
              id={ids.sample}
              value={sample}
              className="h-9 rounded-input border border-border bg-surface px-2 text-body"
              onChange={(event) => {
                const next = SAMPLES.find((s) => s.name === event.target.value);
                setSample(event.target.value);
                if (next !== undefined) setText(next.text);
              }}
            >
              {SAMPLES.map((s) => (
                <option key={s.name} value={s.name}>
                  {s.name}
                </option>
              ))}
            </select>
          </div>
          <div className="flex flex-col gap-1.5">
            <label htmlFor={ids.text} className="text-body-sm font-medium text-ink-secondary">
              Deck file text
            </label>
            <Textarea
              id={ids.text}
              rows={6}
              spellCheck={false}
              value={text}
              onChange={(event) => {
                setText(event.target.value);
              }}
            />
            <div className="flex flex-wrap gap-2">
              <Button
                onClick={() => {
                  act('Sent the text as an outside change.', (h) => {
                    h.sendExternal(text);
                  });
                }}
              >
                Send as outside change
              </Button>
              <Button
                onClick={() => {
                  act('Renamed the first component outside.', (h) => {
                    const next = renamedOutside(h.lastText() ?? text);
                    if (next === null) setNotice('There is no component to rename.');
                    else h.sendExternal(next);
                  });
                }}
              >
                Simulate outside change
              </Button>
            </div>
          </div>
          <fieldset className="flex flex-col gap-2">
            <legend className="mb-1 text-body-sm font-medium text-ink-secondary">
              Host settings
            </legend>
            <Checkbox
              label="Dark scheme"
              checked={dark}
              onCheckedChange={(checked) => {
                const next = checked === true;
                setDark(next);
                act(`Scheme set to ${next ? 'dark' : 'light'}.`, (h) => {
                  h.setTheme(next ? 'dark' : 'light');
                });
              }}
            />
            {(
              [
                ['openLinks', 'Can open links'],
                ['exportFiles', 'Can save exported files'],
                ['pictures', 'Stores pictures'],
              ] as const
            ).map(([key, label]) => (
              <Checkbox
                key={key}
                label={label}
                checked={capabilities[key]}
                onCheckedChange={(checked) => {
                  setCapabilities({ ...capabilities, [key]: checked === true });
                }}
              />
            ))}
            <div className="flex items-center gap-2">
              <label htmlFor={ids.version} className="text-body-sm text-ink-secondary">
                Protocol version
              </label>
              <Input
                id={ids.version}
                type="number"
                min={0}
                className="w-20"
                value={protocolVersion}
                onChange={(event) => {
                  setProtocolVersion(Number(event.target.value));
                }}
              />
            </div>
            <div className="flex items-center gap-2">
              <label htmlFor={ids.pictures} className="text-body-sm text-ink-secondary">
                Picture answers
              </label>
              <select
                id={ids.pictures}
                value={pictureAnswer}
                className="h-9 rounded-input border border-border bg-surface px-2 text-body"
                onChange={(event) => {
                  setPictureAnswer(event.target.value as PictureAnswer);
                }}
              >
                <option value="stored">Stored</option>
                <option value="failed">Store failed</option>
                <option value="missing">Missing</option>
              </select>
            </div>
            <Checkbox
              label="Answer changes"
              checked={answering}
              onCheckedChange={(checked) => {
                setAnswering(checked === true);
              }}
            />
          </fieldset>
          <div className="flex flex-wrap gap-2">
            <Button
              onClick={() => {
                act('The next change will be refused.', (h) => {
                  h.refuseNextChange('Refused by the fake host');
                });
              }}
            >
              Refuse next change
            </Button>
            <Button
              onClick={() => {
                act('Asked the editor to flush.', (h) => {
                  void h.flush().then(() => {
                    setNotice('The editor answered the flush.');
                  });
                });
              }}
            >
              Flush
            </Button>
            <Button variant="primary" onClick={reload}>
              Reload editor
            </Button>
          </div>
          <p role="status" className="min-h-5 text-body-sm text-ink-secondary">
            {notice}
          </p>
        </section>
        <section aria-label="Editor and traffic" className="flex min-w-0 flex-col gap-4">
          <iframe
            // A new key is a new frame: the editor starts over and the host sends `init` again.
            key={run}
            ref={frame}
            title="Embedded editor"
            src="/embed.html"
            className="h-[560px] w-full rounded-card border border-border bg-surface"
          />
          <EmbedHostLog log={fake?.log ?? []} />
        </section>
      </div>
    </main>
  );
}
