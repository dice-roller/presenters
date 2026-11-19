# Dice Roller Presenters

Optional TypeScript presenters for [RPG Dice Roller](https://github.com/dice-roller/rpg-dice-roller).

One repository, independently published npm packages. The repository root is private
and is never published. Only the SVG presenter exists so far; it is not yet released.

| Workspace      | npm package                  | Local demo |
| -------------- | ---------------------------- | ---------- |
| `packages/svg` | `@dice-roller/svg-presenter` | `/svg/`    |

See the [SVG presenter guide](packages/svg/README.md) for usage, appearance,
modifier flags, metadata and hover behaviour.

## Local development

Use Node.js 22.12 or newer; `.nvmrc` selects the latest LTS.

```sh
npm ci
npm run dev
```

Open the URL Vite prints. `/` lists the presenters; `/svg/` contains the artwork
gallery and all existing result examples. Each presenter has its own demo page.
The demo is for local development and has no deployment workflow. Its result
examples are real dice roller `Roll` instances created from notation and fixed
RNG seeds, evaluated once and reused for appearance changes. Static artwork/legend samples remain separate from roll examples.

```sh
npm test              # each workspace's tests
npm run check         # TypeScript, formatting and the demo build
npm run build         # each workspace's JavaScript and declarations
npm run pack:check    # inspect each package's publishable files
npm run preview:demo  # serve the built local demo
```

Workspace commands can run independently:

```sh
npm run build --workspace=@dice-roller/svg-presenter
npm test --workspace=@dice-roller/svg-presenter
```

## Repository layout

| Location                      | Purpose                               |
| ----------------------------- | ------------------------------------- |
| `packages/<presenter>/src`    | TypeScript library source             |
| `packages/<presenter>/tests`  | Package tests and fixtures            |
| `packages/<presenter>/dist`   | Generated JavaScript and declarations |
| `demo/<presenter>/index.html` | Presenter demo entry point            |
| `demo/presenters.ts`          | Presenter navigation and index        |
| `tsconfig.base.json`          | Shared strict TypeScript settings     |

The SVG package owns its dice assets, dependencies, exports and version.
Tests and demos consume its workspace API; Vite resolves that API to TypeScript
source during local development so edits update immediately. Vue and Vite are
repository development dependencies, not presenter runtime dependencies.

The core dice roller is a v6 peer dependency and a published-beta development
dependency. The lockfile no longer relies on a temporary Git branch.

## Adding a presenter

1. Create `packages/<presenter>/package.json` with its own package name, version,
   exports, runtime/peer dependencies and `build`, `typecheck`, `test` and
   `prepack` scripts. Keep `0.0.0` until preparing its first release.
2. Extend `../../tsconfig.base.json` from the package's TypeScript config. Build
   only its `src` into its own `dist`, including declaration files. The SVG
   package provides an example.
3. Add `demo/<presenter>/index.html`, its TypeScript entry point and Vue page.
   Vite discovers presenter HTML entry points automatically. Register the page
   in `demo/presenters.ts`, and add its source alias to `vite.demo.config.ts`
   and the corresponding TypeScript path in `demo/tsconfig.json`.
4. Run `npm install` at the root to link the workspace and update the lockfile.
   Run tests, checks and `npm run pack:check` before committing.

Each publishable package should have a README and declare only the dependencies
needed by its own presenter. Do not add `private: true` to a publishable package.

## Releases

The release jobs discover publishable presenters under `packages/*` and call the
organisation's shared workflows. Each package uses its directory name as its tag
prefix: `packages/svg` produces `svg-v` tags, while `packages/terminal` would
produce `terminal-v` tags. No workflow changes are needed when adding a presenter.
Use lowercase letters, numbers and single hyphens for presenter directory names.

Run **Prepare presenter release** on `main`, `next`, or `releases/vN`, entering
the presenter directory name (such as `svg`) and a version increment. It opens a
PR changing that package's version and the root lockfile. Merging creates its
package-specific tag and stages the package on npm for maintainer approval.
Packages are versioned independently; the private root is never staged.

**Stage presenter packages on npm** runs when any presenter manifest changes on a
release branch and selects the changed packages. Run it manually with a presenter
name, or leave the name empty to stage all eligible packages. Private packages
and development version `0.0.0` are skipped; the central workflow skips versions
already published on npm. Prepare each package's first release before staging it.

`main` stages stable versions as `latest`; `next` requires prereleases and uses
`next`; maintenance branches keep their major version and use `release-N`.
Tests, TypeScript checks, formatting and the local demo build run before staging.
Versioning, validation, tag creation and npm staging are maintained centrally;
`select-presenters.yml` only discovers which packages to pass to those workflows.

Configure npm trusted publishing separately for each package, pointing to
`dice-roller/presenters` and `publish.yml`, with staged publishing permitted.
GitHub Actions must be allowed to create pull requests. For protected release
tags, set `RELEASE_APP_ID` and `RELEASE_APP_PRIVATE_KEY` for the release app;
otherwise tagging uses the workflow token. No packages are published by CI checks
or by pushes to feature branches.
