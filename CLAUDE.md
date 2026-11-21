# CLAUDE.md

@AGENTS.md
@DESIGN.md

## Notes for Claude Code

- The project guide is `AGENTS.md`, imported above. Treat it as the source of truth for commands, structure and conventions.
- Verify visual changes in a browser: run `npm run build && npm run preview` and open `http://127.0.0.1:4321/flutterconf_peru_2026/`. Check desktop and a 390 px wide viewport, and scroll the whole page. Most of the design only shows up while scrolling.
- Before you build, preview or take screenshots, make sure Monchila is installed: `ls brand/fonts/monchila/` must list `Monchila` and `MonchilaSilueta` (`.ttf` and `.woff2`). The files are git-ignored (licensed font), so a fresh clone or a git worktree (`.claude/worktrees/…`) does not have them. Without them `<Neon>` falls back to FlutterChicha, and the page, the screenshots and any PR evidence no longer match production. In a worktree, copy them from the main checkout: `cp <main-checkout>/brand/fonts/monchila/Monchila*.{ttf,woff2} brand/fonts/monchila/`. If you can't find them, say so in the PR instead of posting fallback screenshots.
- The approved prototype is the reference for any visual regression. It lives as the "FlutterConf Perú" landing artifact (option ★ M · Chicha Dash).
- The design system also exists as a claude.ai Design System artifact ("FlutterConf Perú Chicha"). When you change `brand/`, keep that artifact in sync, or note in the PR that it needs a sync.
- Rebuilding FlutterChicha needs the Python tools venv. Follow the steps in `brand/README.md`.
- After verifying a change, use the `pr-evidence` skill (`.claude/skills/pr-evidence/`): screenshots with `npm run evidence`, uploaded with `gh image` into the PR's `## Evidence` section.
- Open PRs against `main` and end PR descriptions with the attribution line the session provides.
