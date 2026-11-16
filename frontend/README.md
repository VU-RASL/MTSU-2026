# React + TypeScript + Vite

This template provides a minimal setup to get React working in Vite with HMR and some Oxlint rules.

Currently, two official plugins are available:

- [@vitejs/plugin-react](https://github.com/vitejs/vite-plugin-react/blob/main/packages/plugin-react) uses [Oxc](https://oxc.rs)
- [@vitejs/plugin-react-swc](https://github.com/vitejs/vite-plugin-react/blob/main/packages/plugin-react-swc) uses [SWC](https://swc.rs/)

## Supabase sign-in

The login and registration pages use Supabase email/password authentication.
Registration allows users to choose student or educator; the verified signup
metadata is used by the backend only when it creates the user's first profile.
Public registration cannot grant the admin role. Configure
`VITE_SUPABASE_URL` and `VITE_SUPABASE_PUBLISHABLE_KEY` in the project-level
`.env` file or in the frontend's environment before starting Vite. The frontend
reads the project-level `.env`; only variables prefixed with `VITE_` are
available to browser code. Never use a `VITE_` prefix for the Supabase secret
key.

## UMA/Unity patient avatar

The student voice-conversation page loads the UMA WebGL build from
`frontend/public/unity/UMA/Build/`. `VITE_UMA_MODEL_URL` is the build base path
without a file extension (default `/unity/UMA/Build/UMA`). The React page uses
that base path to load the `.loader.js`, `.data`, `.framework.js`, and `.wasm`
files. It sends the live audio level as a three-decimal string to the Unity
object `ReactBridge`, method `ReceiveFromReact`, and emits a `uma:puppet` browser
event with `{ mouthLevel }` in `detail`.

After sign-in, the shared API helper sends the Supabase access token to the
backend as a bearer token. Supabase persists and refreshes the browser session.

## React Compiler

The React Compiler is not enabled on this template because of its impact on dev & build performances. To add it, see [this documentation](https://react.dev/learn/react-compiler/installation).

## Expanding the Oxlint configuration

If you are developing a production application, we recommend enabling type-aware lint rules by installing `oxlint-tsgolint` and editing `.oxlintrc.json`:

```json
{
  "$schema": "./node_modules/oxlint/configuration_schema.json",
  "plugins": ["react", "typescript", "oxc"],
  "options": {
    "typeAware": true
  },
  "rules": {
    "react/rules-of-hooks": "error",
    "react/only-export-components": ["warn", { "allowConstantExport": true }]
  }
}
```

See the [Oxlint rules documentation](https://oxc.rs/docs/guide/usage/linter/rules) for the full list of rules and categories.
