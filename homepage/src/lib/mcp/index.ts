import { auth, defineMcp } from "@lovable.dev/mcp-js";
import getShopProducts from "./tools/get-shop-products";
import getEvents from "./tools/get-events";
import getMyProfile from "./tools/get-my-profile";

// The OAuth issuer must be the direct Supabase host, not the .lovable.cloud proxy.
const projectRef = import.meta.env.VITE_SUPABASE_PROJECT_ID ?? "project-ref-unset";

export default defineMcp({
  name: "gpf-golf-mcp",
  title: "GPF Golf",
  version: "0.1.0",
  instructions:
    "Tools for GPF Golf (Golf p'la Fresquinha). Browse shop products, list club events, and read the signed-in member's profile.",
  auth: auth.oauth.issuer({
    issuer: `https://${projectRef}.supabase.co/auth/v1`,
    acceptedAudiences: "authenticated",
  }),
  tools: [getShopProducts, getEvents, getMyProfile],
});
