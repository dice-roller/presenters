# Dice Roller Presenters

Official result presenters for [RPG Dice Roller](https://github.com/dice-roller/rpg-dice-roller).

This repository is the starting point for a shared TypeScript package of optional
presenters. The first planned presenter generates SVG dice tray images. No
presenters have been implemented or published yet.

## Development

Use Node.js 22.12 or newer.

```sh
npm install
npm run dev
```

Open the local URL printed by Vite. The Vue demo currently contains a preview
placeholder, ready to connect to the SVG presenter during implementation.

```sh
npm run typecheck
npm run build
npm run check
```

`build` emits the library's JavaScript and TypeScript declarations into `dist/`.
`build:demo` creates a separate local demo build in `demo-dist/`.
Vue and Vite are development dependencies; neither is included in the library.

## Branches

- `main`: stable branch.
- `develop`: integration branch.
- `feature/svg-presenter`: SVG presenter development and local playground.

## Presenter implementation

The v6 contract is `Presenter<T>` with a `present(target: Presentable): T` method.
An SVG presenter can return a string containing SVG markup. Use the existing
evaluated result tree; presenting must not roll again or change any results.

The planned package will offer named exports and individual entry points such as
`@dice-roller/presenters/svg`. Add those exports alongside the implementations.
When integrating with v6, add the dice roller as a peer dependency and use a built
local v6 checkout for development until a compatible release is available.

Ideas under consideration: SVG, terminal, HTML, spoken descriptions and musical
output. The package remains marked private to prevent accidental npm publication
while its first implementation is being built.
