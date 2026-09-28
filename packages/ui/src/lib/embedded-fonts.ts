import geistLatin from '@fontsource-variable/geist/files/geist-latin-wght-normal.woff2?inline';
import geistLatinExt from '@fontsource-variable/geist/files/geist-latin-ext-wght-normal.woff2?inline';
import monoLatin from '@fontsource-variable/geist-mono/files/geist-mono-latin-wght-normal.woff2?inline';
import monoLatinExt from '@fontsource-variable/geist-mono/files/geist-mono-latin-ext-wght-normal.woff2?inline';

const latin =
  'U+0000-00FF,U+0131,U+0152-0153,U+02BB-02BC,U+02C6,U+02DA,U+02DC,U+0304,U+0308,U+0329,U+2000-206F,U+20AC,U+2122,U+2191,U+2193,U+2212,U+2215,U+FEFF,U+FFFD';
const latinExt =
  'U+0100-02BA,U+02BD-02C5,U+02C7-02CC,U+02CE-02D7,U+02DD-02FF,U+0304,U+0308,U+0329,U+1D00-1DBF,U+1E00-1E9F,U+1EF2-1EFF,U+2020,U+20A0-20AB,U+20AD-20C0,U+2113,U+2C60-2C7F,U+A720-A7FF';

function face(family: string, src: string, range: string): string {
  return `@font-face{font-family:'${family}';font-style:normal;font-weight:100 900;src:url(${src}) format('woff2');unicode-range:${range}}`;
}

export const EMBEDDED_FONT_CSS = [
  face('Geist Variable', geistLatin, latin),
  face('Geist Variable', geistLatinExt, latinExt),
  face('Geist Mono Variable', monoLatin, latin),
  face('Geist Mono Variable', monoLatinExt, latinExt),
].join('\n');
