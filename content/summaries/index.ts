import { A1 } from "./a1";
import { A2 } from "./a2";
import { A3 } from "./a3";
import { B1 } from "./b1";
import { B2 } from "./b2";
import { B3_INDART } from "./b3-indart";
import { B3_INDART2 } from "./b3-indart2";
import { B3_SOC } from "./b3-soc";
import type { MindMap } from "../../src/prep/summaries/types";

// Display order follows GROUPS in types.ts; within a group, the order of each file.
export const MAPS: MindMap[] = [...A3, ...A1, ...A2, ...B1, ...B2, ...B3_INDART, ...B3_INDART2, ...B3_SOC];
