# Photographs

Drop the images in **this folder**. Name them exactly as below — the name is
what tells the site which photograph it is.

The `--` stands in for a `/`. A filename cannot contain a slash, and nesting
seventeen files in folders would be worse. `.jpg`, `.png` and `.webp` all work.

## The seventeen

| Filename | Where it appears |
|---|---|
| `wc-001--front.jpg` | Large & small oval waist chain — main shot |
| `wc-001--worn.jpg` | …the same piece, worn |
| `wc-002--front.jpg` | Gold large & small oval — main shot |
| `wc-002--worn.jpg` | …worn |
| `wc-003--front.jpg` | Long oval waist chain — main shot |
| `wc-004--front.jpg` | Gold long oval — main shot |
| `wc-004--worn.jpg` | …worn |
| `wc-005--front.jpg` | Silver moon waist chain — main shot |
| `wc-005--worn.jpg` | …worn |
| `wc-005--detail.jpg` | …the clasp or the charm, close |
| `wc-006--front.jpg` | Golden starfish — main shot |
| `wc-006--detail.jpg` | …close |
| `wc-007--front.jpg` | Golden shell/conch — main shot |
| `wc-007--detail.jpg` | …close |
| `hero--home.jpg` | The home page hero. **Landscape**, and busy on the right — the headline sits over the left third |
| `story--celestial.jpg` | "The moon" tile on the home page and the About page. Square |
| `story--nautical.jpg` | "The sea" tile. Square |

Anything not on this list is ignored, so extra shots can sit here harmlessly.
A missing one shows a designed placeholder rather than a broken image, so the
site is never wrong — just incomplete.

## Framing

Product shots are cropped to **4:5 portrait** and the two story tiles to
**square**, both centred. Leave a little room around the piece so nothing
important sits at an edge.

Shoot as large as the camera gives. The build resizes down to 320/480/640/828/
1080/1440/1920 and never upscales, so a small file cannot be improved later but
a large one costs nothing.

## After adding or replacing a file

Nothing. `npm run dev` and `npm run build` both regenerate the resized copies
first. If a dev server is already running, restart it.

To do it by hand: `npm run images --workspace apps/store`

## Using Cloudinary instead

Optional. This folder is served from Cloudflare's edge on deploy, which is
already a CDN, so Cloudinary buys automatic AVIF/WebP and smart cropping rather
than "having a CDN".

If you do want it, the same filenames work:

```bash
node scripts/cloudinary-upload.mjs apps/store/public/products --dry-run
node scripts/cloudinary-upload.mjs apps/store/public/products
```

Needs `NEXT_PUBLIC_CLOUDINARY_CLOUD_NAME`, `CLOUDINARY_API_KEY` and
`CLOUDINARY_API_SECRET` in `apps/store/.env.local`.

**A local file always wins over Cloudinary** for the same id, so uploading does
not change what the site shows until the local copies are removed. That is
deliberate: the copy in the repo is the one someone deliberately put there.
