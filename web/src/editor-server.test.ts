import { EventEmitter } from "node:events";
import { mkdtempSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import type { IncomingMessage, ServerResponse } from "node:http";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { test } from "vitest";
import assert from "node:assert/strict";
import { buildData, editorHandlers, editorServer } from "./editor-server.ts";

/** A request that sends its body once the handler is listening. */
function request(method: string, body = "") {
  const req = Object.assign(new EventEmitter(), { method }) as unknown as IncomingMessage;
  setTimeout(() => { if (body) req.emit("data", Buffer.from(body)); req.emit("end"); });
  return req;
}

/** A response that records what was sent and resolves when it ends. */
function response() {
  const out = { statusCode: 200, headers: {} as Record<string, string>, body: "" };
  let done!: () => void;
  const ended = new Promise<void>((r) => (done = r));
  const res = {
    get statusCode() { return out.statusCode; },
    set statusCode(v: number) { out.statusCode = v; },
    setHeader: (k: string, v: string) => { out.headers[k] = v; },
    end: (b = "") => { out.body = b; done(); },
  } as unknown as ServerResponse;
  return { res, out, ended };
}

const scratch = () => mkdtempSync(join(tmpdir(), "bjj-3d-editor-"));

test("reading the additions returns the file, or nothing when there is none yet", async () => {
  const dir = scratch();
  const additions = join(dir, "bjj-3d.txt");
  const read = editorHandlers({ additions, rebuild: () => {} })["/__editor/additions"];
  let r = response();
  read(request("GET"), r.res);
  await r.ended;
  assert.deepEqual([r.out.statusCode, r.out.body, r.out.headers["content-type"]], [200, "", "text/plain; charset=utf-8"]);
  writeFileSync(additions, "my move\n");
  r = response();
  read(request("GET"), r.res);
  await r.ended;
  assert.equal(r.out.body, "my move\n");
});

test("saving writes the body, rebuilds and reports the build", async () => {
  const additions = join(scratch(), "bjj-3d.txt");
  const calls: string[] = [];
  const save = editorHandlers({ additions, rebuild: (done) => { calls.push(readFileSync(additions, "utf8")); done(true, "graph.json: 1 position"); } })["/__editor/save"];
  const r = response();
  save(request("POST", "new block\n"), r.res);
  await r.ended;
  assert.deepEqual(calls, ["new block\n"]);
  assert.equal(r.out.headers["content-type"], "application/json");
  assert.deepEqual(JSON.parse(r.out.body), { ok: true, log: "graph.json: 1 position" });
});

test("a failed build is reported, not hidden", async () => {
  const save = editorHandlers({ additions: join(scratch(), "a.txt"), rebuild: (done) => done(false, "boom") })["/__editor/save"];
  const r = response();
  save(request("POST"), r.res);
  await r.ended;
  assert.deepEqual(JSON.parse(r.out.body), { ok: false, log: "boom" });
});

test("each endpoint answers only its own method", async () => {
  const h = editorHandlers({ additions: join(scratch(), "a.txt"), rebuild: () => assert.fail("must not rebuild") });
  for (const [path, method] of [["/__editor/additions", "POST"], ["/__editor/save", "GET"]]) {
    const r = response();
    h[path](request(method), r.res);
    await r.ended;
    assert.deepEqual([r.out.statusCode, r.out.body], [405, ""], path);
  }
});

test("the default rebuild runs the data build in the given folder and passes its output on", async () => {
  const dir = scratch();
  mkdirSync(join(dir, "scripts"));
  writeFileSync(join(dir, "scripts/build-data.ts"), "console.log('built', process.env.BJJ3D_PROBE); console.error('warned');\n");
  const result = await new Promise<[boolean, string]>((r) => buildData(dir, { ...process.env, BJJ3D_PROBE: "here" })((ok, log) => r([ok, log])));
  assert.deepEqual(result, [true, "built here\nwarned"]);
  writeFileSync(join(dir, "scripts/build-data.ts"), "process.exit(3);\n");
  const failed = await new Promise<boolean>((r) => buildData(dir)((ok) => r(ok)));
  assert.equal(failed, false);
});

test("without a rebuild of its own, saving runs the data build in cwd", async () => {
  const dir = scratch();
  mkdirSync(join(dir, "scripts"));
  writeFileSync(join(dir, "scripts/build-data.ts"), "console.log('ok');\n");
  const r = response();
  editorHandlers({ additions: join(dir, "a.txt"), cwd: dir })["/__editor/save"](request("POST", "x"), r.res);
  await r.ended;
  assert.deepEqual(JSON.parse(r.out.body), { ok: true, log: "ok" });
});

test("without a folder either, it runs in the process's working directory", () => {
  // Only checks the handlers are built; running the real build is the end-to-end tests' job.
  const h = editorHandlers({ additions: join(scratch(), "a.txt") });
  assert.deepEqual(Object.keys(h), ["/__editor/additions", "/__editor/save"]);
});

test("the plugin adds both endpoints to the dev server only", () => {
  const plugin = editorServer({ additions: join(scratch(), "a.txt"), rebuild: () => {} });
  assert.equal(plugin.apply, "serve");
  const used: string[] = [];
  const server = { middlewares: { use: (path: string, h: unknown) => { assert.equal(typeof h, "function"); used.push(path); } } };
  (plugin.configureServer as (s: unknown) => void)(server);
  assert.deepEqual(used, ["/__editor/additions", "/__editor/save"]);
});
