// The page on a first visit: nothing saved, the real graph, ?debug=1 (so the viewer is on
// window). One boot for the whole file; the tests run in order and build on each other.

import { describe, expect, test, vi } from "vitest";
import { $, $$, boot, frame, go, ManualObserver, realGraph, SETTINGS_KEY } from "./test/app-harness.ts";

// Booting the page and drawing it in software WebGL is slow on a busy machine.
vi.setConfig({ testTimeout: 120_000 });

const graph = await realGraph();
const { main, viewer } = await boot({ before: () => { window.IntersectionObserver = ManualObserver as unknown as typeof IntersectionObserver; } });
const saved = () => JSON.parse(localStorage.getItem(SETTINGS_KEY)!);
const thumbs = () => $$(".thumb");
const press = (target: EventTarget, key: string) => target.dispatchEvent(new KeyboardEvent("keydown", { key, bubbles: true, cancelable: true }));
const pointer = (target: Element, type: string, clientX = 0) => target.dispatchEvent(new PointerEvent(type, { clientX, clientY: 0, pointerId: 1, bubbles: true }));
/** A transition whose end has more than one way out. */
const branching = graph.transitions.findIndex((t) => t.to !== null && graph.transitions.filter((u) => u.from === t.to).length > 1);

describe("first visit", () => {
  test("opens the first reviewed technique, with the how-to-use card and no Oss! over it", () => {
    const first = Number(Object.keys(graph.techniques)[0]);
    expect($("#title").textContent).toBe(graph.techniques[first].names["pt-BR"]);
    expect(document.title).toContain("bjj-3d");
    expect($("#kind").textContent).not.toBe("");
    expect($("#ends").textContent).toContain("·");
    expect(thumbs()).toHaveLength(graph.techniques[first].steps.length);
    expect($("#help").hidden).toBe(false);
    expect($("#help-steps").children).toHaveLength(4);
    expect($("#oss").hidden).toBe(true);
    expect(document.documentElement.dataset.theme).toBe("light");
    expect($("#theme").textContent).toBe("☀");
    expect(localStorage.getItem(SETTINGS_KEY)).not.toBeNull();
  });

  test("dismissing the card greets with Oss!, and play skips it", async () => {
    $("#help-ok").click();
    expect($("#help").hidden).toBe(true);
    expect(saved().helpSeen).toBe(true);
    expect($("#oss").hidden).toBe(false);
    expect(viewer.playing).toBe(false);
    $("#play").click();
    expect($("#oss").hidden).toBe(true);
    expect(viewer.playing).toBe(true);
  });

  test("the help comes back from ⚙, and after it Oss! runs its second and the fight starts", () => {
    vi.useFakeTimers({ toFake: ["setTimeout", "clearTimeout"] });
    $("#help-btn").click();
    expect($("#help").hidden).toBe(false);
    $("#help-ok").click();
    expect($("#oss").hidden).toBe(false);
    vi.advanceTimersByTime(1000);
    expect($("#oss").hidden).toBe(false);
    vi.advanceTimersByTime(100);
    vi.useRealTimers();
    expect($("#oss").hidden).toBe(true);
    expect(viewer.playing).toBe(true);
  });

  test("play restarts from the beginning at the end, and pauses", () => {
    viewer.playing = false;
    viewer.time = viewer.last;
    $("#play").click();
    expect(viewer.time).toBe(0);
    expect(viewer.playing).toBe(true);
    $("#play").click();
    expect(viewer.playing).toBe(false);
  });

  test("space plays, the arrows step between the filmstrip's stops, the search box keeps its keys", () => {
    viewer.playing = false;
    viewer.time = 0;
    press(document.body, " ");
    expect(viewer.playing).toBe(true);
    const stops = graph.techniques[Number(Object.keys(graph.techniques)[0])].steps.map((s) => s.frame);
    viewer.time = 0;
    press(document.body, "ArrowRight");
    expect(viewer.playing).toBe(false);
    expect(viewer.time).toBe(stops[1]);
    press(document.body, "ArrowLeft");
    expect(viewer.time).toBe(0);
    press(document.body, "ArrowLeft");
    expect(viewer.time).toBe(0);
    viewer.time = viewer.last;
    press(document.body, "ArrowRight");
    expect(viewer.time).toBe(viewer.last);
    // Typing in the search box is not a shortcut; other inputs (a checkbox) still are.
    viewer.time = 0;
    press($("#search"), "ArrowRight");
    expect(viewer.time).toBe(0);
    press($("#options input"), "ArrowRight");
    expect(viewer.time).toBe(stops[1]);
    press(document.body, "x");
  });

  test("the filmstrip seeks on press and scrubs while dragged", () => {
    const items = thumbs();
    pointer($("#thumbs"), "pointerdown");
    pointer($("#thumbs"), "pointermove", 10);
    pointer(items[2], "pointerdown");
    const stops = graph.techniques[Number(Object.keys(graph.techniques)[0])].steps.map((s) => s.frame);
    expect(viewer.time).toBe(stops[2]);
    const r = items[1].getBoundingClientRect();
    pointer($("#thumbs"), "pointermove", r.left + r.width / 2);
    expect(viewer.time).toBeCloseTo((stops[1] + stops[2]) / 2);
    const last = items[items.length - 1].getBoundingClientRect();
    pointer($("#thumbs"), "pointermove", last.right);
    expect(viewer.time).toBeCloseTo(viewer.last);
    pointer($("#thumbs"), "pointermove", -500);
    expect(viewer.time).toBeCloseTo(viewer.last);
    pointer($("#thumbs"), "pointerup");
    pointer($("#thumbs"), "pointermove", r.left);
    expect(viewer.time).toBeCloseTo(viewer.last);
    pointer(items[0], "pointerdown");
    pointer($("#thumbs"), "pointercancel");
    expect(viewer.time).toBe(0);
  });
});

describe("what each frame shows", () => {
  test("the current thumbnail, its fill, the play button and the step caption", () => {
    const tech = graph.techniques[Number(Object.keys(graph.techniques)[0])];
    viewer.playing = true;
    viewer.onFrame(frame({ time: tech.steps[1].frame + 0.5 }));
    const items = thumbs();
    expect(items[1].classList.contains("now")).toBe(true);
    expect(items[0].querySelector<HTMLElement>(".fill")!.style.width).toBe("100%");
    expect(items[1].querySelector<HTMLElement>(".fill")!.style.width).not.toBe("0px");
    expect(items[3].querySelector<HTMLElement>(".fill")!.style.width).toBe("0px");
    expect($("#play").textContent).toBe("❚❚");
    expect($("#caption").textContent).toBe(`2. ${tech.steps[1].text["pt-BR"]}`);
    expect($$("ol.steps li")[1].classList.contains("now-step")).toBe(true);
    const pic = $<HTMLImageElement>("#now-pic").src;
    expect(pic).toMatch(/^data:image\/jpeg/);
    viewer.playing = false;
    viewer.onFrame(frame({ time: tech.steps[1].frame + 0.5 }));
    expect($<HTMLImageElement>("#now-pic").src).toBe(pic);
    expect($("#play").textContent).toBe("▶");
    // Before the first step there is no step to name: the title is the caption.
    viewer.onFrame(frame({ time: -1 }));
    expect($("#caption").textContent).toBe($("#title").textContent);
  });

  test("on the last stop the fill stays empty (it spans no time)", async () => {
    await go("t/30");
    const items = thumbs();
    viewer.onFrame(frame({ time: viewer.last }));
    expect(items[items.length - 1].classList.contains("now")).toBe(true);
    expect(items[items.length - 1].querySelector<HTMLElement>(".fill")!.style.width).toBe("0px");
  });

  test("a lock in danger: the risk line, the ring on the joint, the degrees, the finishing moment", async () => {
    await go("t/458");
    const reading = { value: 0.8, danger: true, measure: 12 } as never;
    viewer.onFrame(frame({ reading, joint: { x: 120, y: 80 }, impact: 0.9, impactStart: true }));
    expect($("#risk").classList.contains("on")).toBe(true);
    expect($("#risk").textContent).not.toBe("");
    expect($("#attention").classList.contains("on")).toBe(true);
    expect($("#attention").style.left).toBe("120px");
    expect($("#attention").classList.contains("hot")).toBe(true);
    expect($("#angle").classList.contains("on")).toBe(false);
    expect($("#stage").style.getPropertyValue("--impact")).toBe("0.900");
    const pulse = $(".pulse");
    expect(pulse.style.left).toBe("120px");
    pulse.dispatchEvent(new Event("animationend"));
    expect(document.querySelector(".pulse")).toBeNull();
    // With degrees on, the angle sits by the ring.
    const degrees = $$<HTMLInputElement>("#options input")[4];
    degrees.checked = true;
    degrees.dispatchEvent(new Event("change"));
    expect(saved().degrees).toBe(true);
    viewer.onFrame(frame({ reading, joint: { x: 120, y: 80 } }));
    expect($("#angle").classList.contains("on")).toBe(true);
    expect($("#angle").textContent).not.toBe("");
    // An impact without a joint on screen leaves no pulse.
    viewer.onFrame(frame({ reading, impactStart: true }));
    expect(document.querySelector(".pulse")).toBeNull();
    // Without a reading nothing is lit.
    viewer.onFrame(frame());
    expect($("#risk").classList.contains("on")).toBe(false);
    expect($("#attention").classList.contains("on")).toBe(false);
    degrees.checked = false;
    degrees.dispatchEvent(new Event("change"));
  });
});

describe("moving between moves", () => {
  test("the next chip chains without Oss!, and 'more' opens the panel", async () => {
    await go(`t/${branching}`);
    const chip = $<HTMLAnchorElement>("#next-chip");
    expect(chip.hidden).toBe(false);
    const more = chip.querySelector<HTMLElement>(".muted")!;
    expect(more.textContent).toMatch(/\d/);
    const click = new MouseEvent("click", { bubbles: true, cancelable: true });
    more.dispatchEvent(click);
    expect(click.defaultPrevented).toBe(true);
    expect(document.body.classList.contains("open")).toBe(true);
    const target = chip.getAttribute("href")!.slice(1);
    chip.click();
    await new Promise((r) => addEventListener("hashchange", r, { once: true }));
    expect(location.hash).toBe(`#${target}`);
    expect($("#oss").hidden).toBe(true);
    expect(document.body.classList.contains("open")).toBe(false);
  });

  test("a move that ends nowhere has no next chip and says so in the panel", async () => {
    await go("t/30");
    expect($("#next-chip").hidden).toBe(true);
    expect($("#panel-body .empty")).not.toBeNull();
    expect($("#ends").textContent).toContain(" · ");
  });

  test("a move played backwards says so", async () => {
    await go("t/30r");
    expect($("#ends").textContent).toMatch(/\(.+\)$/);
  });

  test("a finish named tap is titled with where it happens", async () => {
    await go("t/90");
    expect($("#title").textContent).toBe(`${graph.positions[graph.transitions[90].from!].name}: ${graph.transitions[90].name}`);
  });

  test("a position: one thumbnail, no Oss!, its next moves chain from the panel", async () => {
    await go(`p/${graph.transitions[0].from}`);
    expect(thumbs()).toHaveLength(1);
    expect($("#oss").hidden).toBe(true);
    expect($("#ends").textContent).not.toBe("");
    const chained = $<HTMLAnchorElement>(".rows.moves a");
    chained.click();
    await new Promise((r) => addEventListener("hashchange", r, { once: true }));
    expect($("#oss").hidden).toBe(true);
  });

  test("a row from the explore list is a new fight: Oss!", async () => {
    $$<HTMLButtonElement>(".tabs button")[2].click();
    const row = $$<HTMLAnchorElement>("#panel-body > .rows:not(.moves) a").find((a) => a.getAttribute("href")!.startsWith("#t/")) ?? null;
    expect(row).toBeNull();
    $$<HTMLButtonElement>(".tabs button")[1].click();
    expect($(".tabs button[aria-selected=true]").textContent).not.toBe("");
    const finish = $$<HTMLAnchorElement>("#panel-body > .rows:not(.moves) a").at(-1)!;
    finish.click();
    await new Promise((r) => addEventListener("hashchange", r, { once: true }));
    expect($("#oss").hidden).toBe(false);
    $$<HTMLButtonElement>(".tabs button")[0].click();
  });

  test("an invalid or unknown address opens the first technique", async () => {
    await go("t/999999");
    expect($("#title").textContent).toBe(graph.techniques[Number(Object.keys(graph.techniques)[0])].names["pt-BR"]);
    await go("nonsense");
    expect($("#title").textContent).toBe(graph.techniques[Number(Object.keys(graph.techniques)[0])].names["pt-BR"]);
    await go("p/999999");
    expect($("#title").textContent).toBe(graph.techniques[Number(Object.keys(graph.techniques)[0])].names["pt-BR"]);
  });
});

describe("the panel", () => {
  test("opens from the menu and closes", () => {
    $("#menu").click();
    expect(document.body.classList.contains("open")).toBe(true);
    $("#menu").click();
    expect(document.body.classList.contains("open")).toBe(false);
    $("#menu").click();
    $("#panel-close").click();
    expect(document.body.classList.contains("open")).toBe(false);
  });

  test("the steps of a technique seek", () => {
    const tech = graph.techniques[Number(Object.keys(graph.techniques)[0])];
    viewer.playing = true;
    $$("ol.steps li")[2].click();
    expect(viewer.time).toBe(tech.steps[2].frame);
    expect(viewer.playing).toBe(false);
  });

  test("search: results, nothing found, and back", () => {
    const search = $<HTMLInputElement>("#search");
    search.value = "kimura";
    search.dispatchEvent(new Event("input"));
    expect($$("#panel-body .rows a").length).toBeGreaterThan(0);
    search.value = "zzzqqqxx";
    search.dispatchEvent(new Event("input"));
    expect($("#panel-body .empty")).not.toBeNull();
    search.value = "";
    search.dispatchEvent(new Event("input"));
    expect($("#panel-body .now")).not.toBeNull();
  });

  test("a tag chip searches for it", async () => {
    await go(`t/${graph.transitions.findIndex((t, i) => i !== 232 && t.tags.length > 0)}`);
    const chip = $<HTMLButtonElement>("details.more .chips button");
    chip.click();
    expect($<HTMLInputElement>("#search").value).toBe(chip.textContent);
    expect($("#panel-body .now")).toBeNull();
    $<HTMLInputElement>("#search").value = "";
    $("#search").dispatchEvent(new Event("input"));
  });

  test("references: a bare link is its own text, other text keeps its words", async () => {
    await go("t/232");
    const refs = $$("details.more .refs p");
    expect(refs[0].querySelector("a")!.textContent).toBe("https://www.youtube.com/watch?v=47g7hWSaKmE");
    expect(refs[1].querySelector("a")).toBeNull();
  });

  test("who moves follows the swapped bodies", async () => {
    await go("t/0");
    const amber = $(".now .mover").textContent;
    viewer.swapped = true;
    $("#search").dispatchEvent(new Event("input"));
    expect($(".now .mover").textContent).not.toBe(amber);
    viewer.swapped = false;
  });

  test("a position lists the moves that lead into it", async () => {
    await go(`p/${graph.transitions[0].to}`);
    expect($$("details.more .rows a").length).toBeGreaterThan(0);
  });

  test("row pictures are drawn as they come into view, once per move", () => {
    const io = ManualObserver.last;
    $$<HTMLButtonElement>(".tabs button")[2].click();
    const imgs = () => $$<HTMLImageElement>("#panel-body > .rows:not(.moves) img");
    const [first, second, third] = imgs();
    expect(io.observed.has(first)).toBe(true);
    io.deliver([second], false);
    expect(second.getAttribute("src")).toBeNull();
    expect(io.observed.has(second)).toBe(true);
    io.deliver([first]);
    expect(first.src).toMatch(/^data:image\/jpeg/);
    expect(io.observed.has(first)).toBe(false);
    // An image whose move cannot be read is left blank.
    third.dataset.snap = "garbage";
    io.deliver([third]);
    expect(third.getAttribute("src")).toBeNull();
    expect(io.observed.has(third)).toBe(false);
    // Drawing the same list again reuses the pictures.
    $$<HTMLButtonElement>(".tabs button")[2].click();
    io.deliver([imgs()[0]]);
    expect(imgs()[0].src).toBe(first.src);
  });
});

describe("settings", () => {
  test("the ⚙ popover opens, stays open for clicks inside, closes on a click outside", () => {
    const btn = $("#settings-btn");
    expect(btn.textContent).toBe("⚙");
    btn.click();
    expect($("#settings").hidden).toBe(false);
    expect(btn.getAttribute("aria-expanded")).toBe("true");
    $("#settings .row").click();
    expect($("#settings").hidden).toBe(false);
    document.body.click();
    expect($("#settings").hidden).toBe(true);
    expect(btn.getAttribute("aria-expanded")).toBe("false");
    document.body.click();
    expect($("#settings").hidden).toBe(true);
  });

  test("look, place, speed: each button applies and is remembered", () => {
    for (const [group, values] of [["#look", ["wood", "hologram", "solid"]], ["#place", ["gym", "studio", "night", "mat"]], ["#speed", ["0.25", "0.5", "1"]]] as const) {
      for (const v of values) {
        $(`${group} [data-value="${v}"]`).click();
        expect($(`${group} [data-value="${v}"]`).getAttribute("aria-pressed")).toBe("true");
      }
    }
    expect(viewer.look).toBe("solid");
    expect(viewer.speed).toBe(1);
    expect(saved().place).toBe("mat");
  });

  test("cameras, the eyes of either fighter, and the chip", () => {
    for (const v of ["free", "side", "top", "directed"]) {
      $(`#camera [data-value="${v}"]`).click();
      expect(viewer.cameraMode).toBe(v);
    }
    $(`#camera [data-value="directed"]`).click();
    $(`#camera [data-value="eyes"]`).click();
    expect(viewer.cameraMode).toBe("eyes1");
    $$<HTMLButtonElement>("#options .seg")[1].querySelector<HTMLElement>('[data-value="0"]')!.click();
    expect(viewer.cameraMode).toBe("eyes0");
    $("#camchip [data-value=\"directed\"]").click();
    expect(viewer.cameraMode).toBe("directed");
    expect($("#camchip [data-value=\"free\"]").getAttribute("aria-pressed")).toBe("false");
  });

  test("grabbing the view hands the directed camera over", () => {
    $("#view").dispatchEvent(new PointerEvent("pointerdown", { bubbles: true }));
    expect(viewer.cameraMode).toBe("free");
    expect($("#camchip [data-value=\"free\"]").getAttribute("aria-pressed")).toBe("true");
    $("#camchip [data-value=\"directed\"]").click();
  });

  test("options: repeat, mirror, who is shown, Oss!, finishing moment", () => {
    const boxes = $$<HTMLInputElement>("#options input");
    for (const box of boxes) { box.checked = !box.checked; box.dispatchEvent(new Event("change")); }
    expect(viewer.loop).toBe(true);
    expect(saved().mirror).toBe(true);
    expect(viewer.impactEffect).toBe(false);
    for (const box of boxes) { box.checked = !box.checked; box.dispatchEvent(new Event("change")); }
    const show = $$("#options .seg")[0];
    show.querySelector<HTMLElement>('[data-value="0"]')!.click();
    expect(viewer.visible).toEqual([true, false]);
    show.querySelector<HTMLElement>('[data-value="1"]')!.click();
    expect(viewer.visible).toEqual([false, true]);
    show.querySelector<HTMLElement>('[data-value="both"]')!.click();
    expect(viewer.visible).toEqual([true, true]);
  });

  test("the theme toggles both ways", () => {
    $("#theme").click();
    expect(document.documentElement.dataset.theme).toBe("dark");
    expect($("#theme").textContent).toBe("☾");
    $("#theme").click();
    expect(document.documentElement.dataset.theme).toBe("light");
  });

  test("a new language is saved and the page reloads", () => {
    const reload = vi.fn();
    main.page.reload = reload;
    const lang = $<HTMLSelectElement>("#lang");
    expect(lang.options).toHaveLength(16);
    lang.value = "en";
    lang.dispatchEvent(new Event("change"));
    expect(saved().lang).toBe("en");
    expect(reload).toHaveBeenCalledOnce();
  });
});

describe("customizing the fighters", () => {
  test("a screen of its own: tabs, thickness, belt, reset, done", () => {
    viewer.playing = true;
    $("#fighters-btn").click();
    expect(document.body.classList.contains("studio")).toBe(true);
    expect($("#customizer").hidden).toBe(false);
    expect(viewer.playing).toBe(false);
    $$<HTMLButtonElement>("#cz-tabs button")[1].click();
    expect($$("#cz-tabs button")[1].getAttribute("aria-selected")).toBe("true");
    const slider = $<HTMLInputElement>("#cz-body input[type=range]");
    slider.dispatchEvent(new PointerEvent("pointerdown"));
    slider.dispatchEvent(new FocusEvent("focus"));
    slider.value = "1.1";
    slider.dispatchEvent(new Event("input"));
    expect(saved().fighters[1].build).toBe(1.1);
    $$<HTMLButtonElement>("#cz-body .choices button")[4].click();
    expect(saved().fighters[1].belt).toBe("black");
    $$<HTMLButtonElement>("#cz-body .cz-actions button")[0].click();
    expect(saved().fighters[1]).toEqual({ build: 1, belt: "white" });
    $("#cz-done").click();
    expect(document.body.classList.contains("studio")).toBe(false);
    expect(viewer.playing).toBe(true);
  });
});
