# dsh-auth

> A **sign-in / sign-up window** plugin for the [DeepSeek Harness](https://github.com/deepseek-ai/deepseek-harness)
> Web UI: a sidebar entry button plus a login/register modal, with a built-in
> demo auth API, an admin account, and an optional proxy mode for your own
> account backend.

![license](https://img.shields.io/badge/license-MIT-blue.svg)
![language](https://img.shields.io/badge/language-TypeScript-3178c6.svg)
![platform](https://img.shields.io/badge/platform-DeepSeek%20Harness-4b8bf5.svg)

> ⚠️ **Toy-plugin disclaimer**
>
> This project is a demo/toy plugin meant for learning and local experiments.
> **It is not recommended for production deployment**: the forced sign-in is
> only a frontend UI gate (it can be bypassed), demo mode stores data in plain
> JSON without rate limiting, and the built-in admin credentials are public in
> this document. For production, use `mode: proxy` with a real auth service
> and put an authenticated reverse proxy in front of `dsh web`.

![Sign-in window](docs/auth-window.png)

## Features

- A "Sign in / Sign up" entry at the bottom of the sidebar; collapses to a
  circular icon with a tooltip.
- A login/register modal with two tabs: form validation, busy states, error
  and success feedback, and Enter-to-submit. The register tab is disabled
  with a notice while an admin has closed registration.
- After signing in the sidebar shows the user name, and the modal becomes a
  "My account" profile view with a sign-out button.
- The session token lives in `localStorage`, so the session survives reloads.
- **Forced sign-in**: while signed out, the login dialog opens automatically
  and cannot be dismissed (no close button; Escape and mask clicks are
  ignored), so the app is unusable until you sign in.
- **Built-in admin account** (demo mode): `admin / admin123`; can toggle
  registration on/off at any time.
- **Account management ("My account")**: after signing in as admin, list
  every account, delete regular accounts, and open/close registration with
  one click inside the "My account" view.
- **Demo mode (default)**: the host ships its own account store (scrypt salted
  hashes + random tokens), persisted to `<profile>/data/dsh-auth/auth.json`.
  Zero external dependencies.
- **Proxy mode**: every `/dsh-auth/*` request is forwarded to your auth
  backend, avoiding CORS entirely.
- Built entirely on the official plugin channels: `dsh.bundle` install layer,
  `dsh.client` client modules, and the slot system (`sidebar.footer.action`
  for the entry, `shell.overlay` for the modal, `settings.general.item` for
  the account-management row).

## Screenshots

| Sign-in window | Signed-in state |
|---|---|
| ![Sign-in window](docs/auth-window.png) | ![Signed in](docs/logged-in.png) |

## Quick start

Requires Node.js ≥ 22.19 and the
[`@deepseek-ai/dsh`](https://www.npmjs.com/package/@deepseek-ai/dsh) CLI
(or a [DeepSeek Harness](https://github.com/deepseek-ai/deepseek-harness)
source checkout).

### Install from a local checkout

```sh
cd dsh-auth
npm install          # or pnpm install (build-time only: tsdown/typescript)
npm run build        # produces lib/index.js + lib/client.js
cd ..
dsh plugin --profile web add ./dsh-auth
dsh --profile web web
```

Open `http://127.0.0.1:3080` and find the "Sign in / Sign up" entry at the
bottom of the sidebar.

> You can also install the packed artifact:
> `dsh plugin --profile web add ./dsh-auth-0.1.0.tgz` (run `npm pack` first).
> Once published to npm: `dsh plugin --profile web add dsh-auth`.

### Install from GitHub

```sh
dsh plugin --profile web add "github:Reyeraz/deepseek-harness-auth"
```

Git installs run the `prepare` build script (which produces `lib/`) at install
time. pnpm refuses to run build scripts for packages that are not allowlisted,
so the first install fails and prints a hint like this:

```text
Add the package to "allowBuilds" in your project's pnpm-workspace.yaml ...
allowBuilds:
  dsh-auth@git+ssh://git@github.com/Reyeraz/deepseek-harness-auth.git#<sha>: true
```

Add the exact line pnpm printed under `allowBuilds` in
`$DSH_HOME/profiles/web/pnpm-workspace.yaml`, then re-run the install command.

For production, pin a commit so a later push cannot silently change what gets
installed:

```sh
dsh plugin --profile web add "github:Reyeraz/deepseek-harness-auth#<commit-sha>"
```

### Default account (demo mode)

| Role | Username | Password |
|---|---|---|
| Admin | `admin` | `admin123` |

After signing in as admin, click the sidebar account entry to open
**My account** and manage accounts: toggle registration, view the account
list, and delete regular accounts. The built-in admin account cannot be
deleted.

### Install from a source checkout (development)

```sh
git clone https://github.com/deepseek-ai/deepseek-harness.git
cd deepseek-harness && pnpm install && pnpm run build
pnpm dsh plugin --profile web add /absolute/path/to/dsh-auth
pnpm dsh --profile web web
```

## Configuration

Configure the plugin in the profile's `cordis.patch.yml` or in the bundle
row. The default is demo mode; no configuration is required:

```yaml
- insert:
    - id: auth-window
      name: dsh-auth
      config:
        mode: demo          # demo | proxy
        apiBaseUrl: ''      # required in proxy mode; forwarding target
        dataDir: ''         # demo data dir; empty = <profile>/data/dsh-auth
        sessionTtlHours: 168
```

## Architecture

The plugin is split into two halves, both mounted through the official plugin
channels:

| Half | Entry | Role |
|---|---|---|
| Host (Node) | [`src/index.ts`](src/index.ts) | Registers `/dsh-auth/*` routes on `ctx.webServer` (same origin, no CORS); demo mode implements the account/session/registration store, proxy mode forwards to an external API |
| Client (browser) | [`src/client/index.ts`](src/client/index.ts) | Loaded through the `dsh.client` client-module mechanism; registers the entry button in `sidebar.footer.action` and the modal in `shell.overlay` (auto-opened and not dismissible while signed out; the signed-in "My account" view embeds the admin account management), sharing one store instance |

`shell.overlay` is the frame-wide floating layer the official docs reserve for
plugins (an additive list slot); the modal is rendered there with the
framework's built-in `Modal` component.

## /dsh-auth API (demo mode)

| Method | Path | Request body | Response |
|---|---|---|---|
| POST | `/dsh-auth/register` | `{ username, password, displayName? }` | `201 { ok, user }`; 409 username taken; 403 registration closed |
| POST | `/dsh-auth/login` | `{ username, password }` | `200 { ok, token, user }`; 401 invalid credentials |
| GET | `/dsh-auth/session` | header `Authorization: Bearer <token>` | `200 { ok, user }`; 401 unauthenticated/expired |
| POST | `/dsh-auth/logout` | same header | `200 { ok }` |
| GET | `/dsh-auth/meta` | - | `200 { ok, mode, registrationOpen }` |
| GET | `/dsh-auth/admin/users` | header (admin) | `200 { ok, users, registrationOpen }`; 403 non-admin |
| POST | `/dsh-auth/admin/registration` | `{ open: boolean }` (admin) | `200 { ok, registrationOpen }` |
| POST | `/dsh-auth/admin/users/remove` | `{ username }` (admin) | `200 { ok, removed }`; built-in admin protected |

Failures share one envelope: `{ ok: false, error: { code, message } }`.

## Security notes

- Again: **this is a toy plugin and not recommended for production** (see the
  disclaimer at the top).
- Demo mode is for local/trusted networks only: plain JSON storage, no login
  rate limiting, single process.
- Passwords are stored as salted scrypt hashes; tokens are stored only as
  SHA-256 digests.
- The default admin password is for local demos only; change it or use proxy
  mode before any real deployment.

## Development and testing

```sh
npm run build       # tsdown build for host + client bundles (no dsh checkout needed)
npm run typecheck   # needs a dsh source checkout (tsconfig paths point at its lib/types)
npm pack            # produce an installable tarball
```

The repository ships a Playwright end-to-end script covering the full user
journey (open modal, register, sign in, session restore after reload, profile
view, sign out, wrong-password error, admin account management, registration
switch), with a screenshot at every step:

```sh
# start dsh web first (default port 3080), then:
node scripts/e2e-test.mjs http://127.0.0.1:3080 ./test-shots
```

## Roadmap

- Password recovery / email verification
- Login rate limiting and lockout
- Migrate the demo storage to the official `ctx.storageDomain` persistence
- Publish to npm and the [dsh-plugin](https://github.com/topics/dsh-plugin)
  topic

## License

[MIT](LICENSE)
