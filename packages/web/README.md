# 3dsvg — Web Editor

Visual editor for designing 3D objects from SVGs, text, and pixel art. This is the app behind [3dsvg.design](https://3dsvg.design).

## Development

From the **monorepo root**:

```bash
npm install
npm run build:engine   # build the engine first
npm run dev:web        # http://localhost:3000
```

Or from this directory:

```bash
npm run dev
```

The web editor imports the engine as a workspace dependency (`"3dsvg": "file:../engine"`), so changes to the engine require a rebuild to be picked up.

## Features

- **4 input methods** — Text (10 Google Fonts), Pixel Editor, SVG Code, File Upload
- **10 material presets** — Default, Plastic, Metal, Glass, Rubber, Chrome, Gold, Clay, Emissive, Holographic
- **7 animations** — Spin, Float, Pulse, Wobble, Swing, Spin+Float, or static
- **Textures** — 10 procedural presets or upload your own
- **Configurable lighting** — Key light position/intensity, ambient, shadows
- **PNG export** — Transparent or with background, up to 4K resolution
- **Video export** — 60fps capture with iOS-style trim UI, MP4 (via FFmpeg WASM) or WebM
- **3D model export** — Download the scene as GLB (preserves color + materials), STL (for 3D printing), OBJ, or PLY
- **Camera mode** — iPhone-style shutter button, aspect ratio picker, viewfinder overlay
- **Interactive canvas** — Drag rotation with momentum, scroll zoom, cursor-follow orbit
- **Embed code export** — Copy-ready `<SVG3D>` JSX snippet with all props from the current editor state
- **Drag & drop** — Drop SVG files anywhere on the page to load them

## Tech Stack

| Library | Purpose |
|---------|---------|
| [Next.js 16](https://nextjs.org/) | App framework |
| [React Three Fiber](https://docs.pmnd.rs/react-three-fiber) | Declarative Three.js |
| [Framer Motion](https://www.framer.com/motion/) | UI animations |
| [FFmpeg WASM](https://ffmpegwasm.netlify.app/) | Video conversion |
| [shadcn/ui](https://ui.shadcn.com/) | UI components |
| [Tailwind CSS v4](https://tailwindcss.com/) | Styling |

## License

MIT — [Renato Costa](https://renato.works)
