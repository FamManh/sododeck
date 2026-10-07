import { describe, expect, it } from 'vitest';

import { checkBundle } from '../scripts/check-bundle';

const clean = {
  'dist/extension.cjs': "const vscode = require('vscode'); module.exports = { activate() {} };",
  'media/embed/embed.html': '<script type="module" src="./assets/a.js"></script>',
  'media/embed/assets/a.js': 'import "./b.js"; const ns = "http://www.w3.org/2000/svg";',
  'media/embed/assets/a.css': '@font-face{src:url(./f.woff2)}',
};

describe('checkBundle', () => {
  it('passes on a clean fixture', () => {
    expect(checkBundle(clean)).toEqual([]);
  });

  it.each(['http', 'https', 'net', 'tls', 'dgram', 'dns'])('fails on a %s import', (name) => {
    for (const spec of [name, `node:${name}`]) {
      const problems = checkBundle({
        ...clean,
        'dist/extension.cjs': `const x = require("${spec}");`,
      });
      expect(problems.join('\n')).toContain(spec);
    }
  });

  it('fails on ES imports of network modules', () => {
    expect(
      checkBundle({ ...clean, 'dist/extension.cjs': 'import h from "node:https";' }),
    ).not.toEqual([]);
  });

  it.each(['fetch(', 'XMLHttpRequest', 'WebSocket', 'createTelemetryLogger'])(
    'fails on %s in the extension',
    (marker) => {
      const problems = checkBundle({ ...clean, 'dist/extension.cjs': `x.${marker}y` });
      expect(problems.join('\n')).toContain(marker);
    },
  );

  it('fails on a remote URL in src, href, url( or import positions', () => {
    const bad: Record<string, string> = {
      'media/embed/embed.html': '<script src="https://cdn.example/x.js"></script>',
      'media/embed/index2.html': '<link href="http://example.com/a.css">',
      'media/embed/assets/b.css': 'a{background:url(https://x.test/a.png)}',
      'media/embed/assets/c.css': 'a{background:url("http://x.test/a.png")}',
      'media/embed/assets/d.js': 'import("https://esm.sh/x")',
      'media/embed/assets/e.js': 'import x from "https://esm.sh/x";',
    };
    for (const [path, text] of Object.entries(bad)) {
      expect(checkBundle({ ...clean, [path]: text }), path).not.toEqual([]);
    }
  });

  it('fails when the generated page is given and has a remote URL', () => {
    expect(
      checkBundle({ ...clean, 'generated/webview.html': '<img src="https://a.test/x.png">' }),
    ).not.toEqual([]);
  });
});
