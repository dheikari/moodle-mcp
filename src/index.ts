#!/usr/bin/env node
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { closeContext } from "./browser.js";
import { createServer } from "./server.js";

/** stdio only: the MCP client owns this process. There is deliberately no network listener. */
const args = process.argv.slice(2);

function flag(name: string): string | undefined {
  const i = args.indexOf(name);
  if (i >= 0 && args[i + 1] && !args[i + 1]!.startsWith("-")) return args[i + 1];
  return args.find((a) => a.startsWith(`${name}=`))?.slice(name.length + 1);
}

const cdp = flag("--cdp");
if (cdp) process.env.MOODLE_MCP_CDP = cdp;

async function shutdown(): Promise<void> {
  await closeContext().catch(() => {}); // leave no orphan Chrome behind
  process.exit(0);
}
for (const signal of ["SIGINT", "SIGTERM"] as const) process.on(signal, () => void shutdown());

await createServer().connect(new StdioServerTransport());
