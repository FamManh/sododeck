# Pictures

A deck can hold a picture in two ways. Choose by where the deck will live.

- **Embedded** (`data`, base64): the picture travels inside the deck. This is what the web app
  writes. Use it for a deck you hand to someone or open in the web app.
- **Next to the deck** (`path`): the entry names an image file in the deck's folder tree, and the
  deck stays small. Use it when the deck sits in a repository or a notes vault beside its
  pictures. The web app cannot show such a picture (it never reads files next to a deck); it keeps
  the entry and shows the picture as missing with its path.

An entry has exactly one of `data` and `path`.

## Point at an existing image

Do not work out the size or the id by hand. Run:

```text
node <skill>/scripts/picture.mjs <image-file> --deck <deck.sododeck>
```

It prints the complete entry, keyed by the picture id (the SHA-256 of the file):

```json
{
  "3f9c…": {
    "type": "image/png",
    "bytes": 48213,
    "width": 1280,
    "height": 720,
    "name": "login.png",
    "path": "assets/login.png"
  }
}
```

1. Paste the entry under the deck's `assets` (keep keys in id order).
2. Add an image whose `asset` is that id, with a `position` and a `size` of at least 32 × 32.
3. Run `lint.mjs` as usual.

The deck file need not exist yet: only its folder is used for the relative path.

## Rules for `path`

- Relative to the deck file's folder, with `/` between folders; no `\`, no leading `/`, no `:`
  (so no drive letters or URLs), no empty or `.` folder.
- `..` may only come first (`../../Attachments/x.png`). Use it only for a shared picture folder
  that really sits above the deck, never to reach outside the user's project.
- The script refuses a type that is not PNG, JPEG, WebP, GIF, SVG or AVIF, a file over 5 MiB, and
  a file whose size it cannot read. It prints one line on stderr and nothing on stdout; pick
  another file or embed a smaller copy.

If the picture file changes later, run the script again: the id changes with the file's bytes.
