// The editor saves through two endpoints of the site's dev server (/__editor/additions and
// /__editor/save). Storybook has no such server, so they are answered here, in memory: the
// editor works, and nothing is written to the repository.
import { host } from "@bjj3d/editor";

let additions = "";
let installed = false;

export function inMemoryEditorServer() {
  // After a save the editor reloads the page; here that would reload the catalog.
  host.reload = () => {};
  if (installed) return;
  installed = true;
  const real = window.fetch.bind(window);
  window.fetch = async (input, init) => {
    const url = typeof input === "string" ? input : input instanceof URL ? input.href : input.url;
    if (url.endsWith("/__editor/additions")) return new Response(additions, { headers: { "content-type": "text/plain" } });
    if (url.endsWith("/__editor/save")) {
      additions = String(init?.body ?? "");
      return Response.json({ ok: true, log: "Saved in memory (Storybook): nothing was written and graph.json was not rebuilt." });
    }
    return real(input, init);
  };
}
