import data from "./lp-test-data.json";
import { fontsReady, type Block } from "./src/prep/plans/planDoc";
import { blocksToDocx } from "./src/prep/plans/planDocx";
import "./src/prep/plans/plans.css";
(async () => {
  await fontsReady();
  (window as any).makeDocx = async (f: string) => {
    const d = (data as Record<string, { preview: Block[]; locked: Block[] }>)[f];
    const t0 = performance.now();
    const b = await blocksToDocx([...d.preview, ...d.locked], { teacher: "นายทดสอบ ระบบดี", term: "2", year: "2569" },
      { title: "t", author: "นายทดสอบ ระบบดี", description: "SOBPREP dl-9", keywords: "SOBPREP dl-9" });
    const buf = new Uint8Array(await b.arrayBuffer());
    let bin = ""; for (let i = 0; i < buf.length; i += 0x8000) bin += String.fromCharCode(...buf.subarray(i, i + 0x8000));
    return { b64: btoa(bin), ms: performance.now() - t0 };
  };
  document.title = "ready";
})();