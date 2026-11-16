# Moodle MCP (hardened fork)

Read-only Moodle access for an MCP client: courses, activities, deadlines, grades, forums, notifications, search and file downloads.

This is a fork of [ink-waffle/moodle-mcp](https://github.com/ink-waffle/moodle-mcp) 0.2.0 (commit `55b4941`), reviewed and tightened for use with a personal university account. The network, file, process, login and token code was read in full; the display and formatting code was searched for network, file and process calls but not read line by line. **Only the `hardened` branch is meant to be built.** Upstream `main` has newer code that can submit assignments, start quiz attempts and post to forums; that code has not been reviewed here. Do not merge or build it wholesale; pick features one at a time after reading them.

## What this fork changes

- **The token only goes to your Moodle.** `moodle_download` signs a URL with your token only if it is on the connected site's own origin (same scheme, host and port). Anything else is refused (`src/ws.ts`).
- **Downloads stay in one folder.** `dest` must be inside the downloads folder (`~/.moodle-mcp/files`, or `MOODLE_MCP_DOWNLOADS`). Paths outside it are refused (`src/config.ts`, `confineToDownloads`).
- **`moodle_connect` only talks to hosts you list.** Set `MOODLE_MCP_ALLOWED_HOSTS` (comma-separated, e.g. `moodle.example.fi`). If it is unset, connecting is disabled.
- **Removed:** the private-messages tool, the generic `moodle_call` / `moodle_functions` tools, and the local HTTP server mode. The server speaks stdio only and opens no network port.
- **Guard tests.** `npm test` fails if a tool is registered that is not on the reviewed list, or if the code names a Moodle function that is not a `_get_` read function. Merging unreviewed upstream code is therefore noisy, not silent.

## Build and test

```bash
npm ci --ignore-scripts   # exact pinned dependencies, no install scripts
npm test                  # compiles to dist/ and runs the safety tests
```

## Use with Claude Code

```bash
claude mcp add --transport stdio --scope user --env MOODLE_MCP_ALLOWED_HOSTS=moodle.example.fi moodle -- node /path/to/moodle-mcp/dist/index.js
```

Then ask the agent to run `moodle_connect` with your Moodle host. On SSO sites a browser tab opens: log in there yourself, then call `moodle_connect` again. The program receives a web-service token, never your SSO password. (Plain username/password login exists for sites that use it; do not type an SSO password into `moodle_connect`.)

## Tools

| tool | use it for |
|---|---|
| `moodle_connect`, `moodle_status`, `moodle_disconnect` | connect and manage sites |
| `moodle_courses`, `moodle_outline`, `moodle_activity` | inspect courses and activities |
| `moodle_deadlines`, `moodle_grades` | see due work and grades |
| `moodle_notifications`, `moodle_whatsnew` | see recent changes |
| `moodle_search` | search cached course content |
| `moodle_forum` | read course forums and announcements |
| `moodle_download` | download course files (rules above) |

## Shared browser

When a login needs a browser, the sibling `@ink-waffle/study-browser` package starts Chrome or Edge with an isolated profile and a local debugging port on `127.0.0.1`:

```text
~/.chrome-profiles-mcp/study-automation-profile
```

The profile keeps your login session and the debugging port has no password, so any program on your computer can drive that browser while it is open. Close it when you are done. To use your own Chrome instead, run with `--cdp http://127.0.0.1:9222` or set `MOODLE_MCP_CDP`; the MCP then never starts or closes that browser.

## Local data

Tokens and cached data live in `~/.moodle-mcp/`. Treat `config.json` as a password file (the file mode setting does nothing on Windows; your user profile permissions are the protection). `moodle_disconnect` removes the local copy only; the token stays valid on the Moodle server until it expires or is reset there.

## Provenance and known limits

- `package-lock.json` pins `@ink-waffle/study-browser@0.1.0` to the sha512 of the tarball that registry.npmjs.org serves and that was reviewed in full. The lockfile as inherited from upstream carried a different hash for that package, for a tarball no longer retrievable, so `npm ci` failed its integrity check. That one entry was re-pinned; all other entries are as inherited.
- `npm audit` reported 7 findings (checked 2026-10-26) in transitive dependencies, mostly in the MCP SDK's HTTP and OAuth code and web-server helpers. None has been updated or assessed against this stdio-only server yet.
- Anything the tools can read is visible to the AI client, including text written by other people (forum posts, course pages). A hostile text can try to instruct the AI. This fork limits what that can reach; it cannot stop the AI from being misled, so avoid running it in a session that also has tools able to send data out.
- Symlinks or junctions already inside the downloads folder are followed.
- Compatibility was developed against Moodle 4.5; newer sites may lack some web-service functions (`moodle_connect` prints which).
- Licence: MIT, as upstream.
