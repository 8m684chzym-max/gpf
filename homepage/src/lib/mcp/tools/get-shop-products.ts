import { defineTool } from "@lovable.dev/mcp-js";
import { z } from "zod";
import { products } from "@/lib/products";

export default defineTool({
  name: "get_shop_products",
  title: "Get shop products",
  description:
    "List products in the GPF Golf shop. Optionally filter by category (Apparel, Accessories, Equipment).",
  inputSchema: {
    category: z
      .enum(["Apparel", "Accessories", "Equipment"])
      .optional()
      .describe("Optional product category filter."),
  },
  annotations: { readOnlyHint: true, idempotentHint: true, openWorldHint: false },
  handler: ({ category }) => {
    const items = products
      .filter((p) => !category || p.category === category)
      .map(({ id, name, tagline, price, category: c, description }) => ({
        id,
        name,
        tagline,
        priceUSD: price,
        category: c,
        description,
      }));
    return {
      content: [{ type: "text", text: JSON.stringify(items, null, 2) }],
      structuredContent: { products: items },
    };
  },
});
