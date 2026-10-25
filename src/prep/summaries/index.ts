import { A1 } from "./a1";
import { A2 } from "./a2";
import { A3 } from "./a3";
import type { MindMap } from "./types";

// Display order follows GROUPS in types.ts; within a group, the order of each file.
export const MAPS: MindMap[] = [...A3, ...A1, ...A2];
