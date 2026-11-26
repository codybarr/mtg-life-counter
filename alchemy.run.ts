import * as Cloudflare from "@alchemy.run/cloudflare";
import * as Alchemy from "alchemy";
import * as Effect from "effect/Effect";

const PRODUCTION_STAGE = "prod";
const PRODUCTION_DOMAIN = "mtg-life.codybarr.dev";

// Cloudflare `_headers` rules, applied by the asset layer. Passed inline so
// they override any `_headers` file in `dist/`. Cloudflare merges every
// matching rule, so the no-cache and immutable patterns must not overlap.
const headers = `
/
  Cache-Control: no-cache
/index.html
  Cache-Control: no-cache
/sw.js
  Cache-Control: no-cache
  Service-Worker-Allowed: /
/manifest.webmanifest
  Cache-Control: no-cache
/assets/*
  Cache-Control: public, max-age=31536000, immutable
`.trimStart();

export default Alchemy.Stack(
  "mtg-life-counter",
  {
    providers: Cloudflare.providers(),
    state: Cloudflare.state(),
  },
  Effect.gen(function* () {
    const stage = yield* Alchemy.Stage;

    // Builds the project's vite.config.ts (client-only Foldkit app) and
    // serves dist/ with single-page-application fallback.
    const site = yield* Cloudflare.Website.Foldkit("Website", {
      domain: stage === PRODUCTION_STAGE ? PRODUCTION_DOMAIN : undefined,
      assets: { notFoundHandling: "single-page-application", headers },
    });

    return {
      url: site.url,
    };
  }),
);
