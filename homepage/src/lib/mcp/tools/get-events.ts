import { defineTool } from "@lovable.dev/mcp-js";
import { z } from "zod";
import { events } from "../events";

export default defineTool({
  name: "get_events",
  title: "Get club events",
  description:
    "List upcoming GPF Golf events (tournaments, member matches, and open events). Optionally filter by kind.",
  inputSchema: {
    kind: z
      .enum(["Members", "Open"])
      .optional()
      .describe("Filter by 'Members' (member-only) or 'Open' (public)."),
  },
  annotations: { readOnlyHint: true, idempotentHint: true, openWorldHint: false },
  handler: ({ kind }) => {
    const items = events.filter((e) => !kind || e.kind === kind);
    return {
      content: [{ type: "text", text: JSON.stringify(items, null, 2) }],
      structuredContent: { events: items },
    };
  },
});
