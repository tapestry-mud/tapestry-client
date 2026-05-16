# Contributing to Tapestry Client

## How to contribute

1. Fork the repo and create a branch from `master`.
2. Make your changes. Add or update tests if relevant.
3. Ensure `npm run build` and `npm test` pass.
4. Open a pull request against `master`.

## Development setup

```bash
npm ci
npm run dev
```

Opens the Vite dev server at `localhost:5173`. Enter a server address to connect (e.g. `localhost:4001`).

## Coding standards

- Braces on every block -- no single-line `if` bodies.
- TypeScript strict mode. No `any` types.
- Components use functional React with hooks.
- State management via Zustand stores.

## Reporting bugs

Use the GitHub issue tracker. Include steps to reproduce, browser info, and console output.

## Code of Conduct

This project follows the [Contributor Covenant](CODE_OF_CONDUCT.md).
