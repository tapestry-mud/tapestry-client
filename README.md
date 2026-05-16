# Tapestry Client

React web client for [Tapestry](https://github.com/tapestry-mud/tapestry) MUD servers.

Connects to any Tapestry server via WebSocket + GMCP protocol. When hosted on the same domain as the server, auto-connects. Otherwise presents a server address input.

## Development

```bash
npm ci
npm run dev       # Vite dev server at localhost:5173
npm test          # Run tests
npm run build     # Production build to dist/
```

## Deployment

Pushing to `master` triggers GitHub Actions:
1. Runs tests
2. Builds the Vite app
3. SCP deploys `dist/` to the droplet

The built files are served by Caddy as a static SPA.

## License

[AGPL-3.0](LICENSE)
