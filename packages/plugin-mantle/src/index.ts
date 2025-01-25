import type { Plugin } from "@elizaos/core";

import { swapAction } from "./actions";

export const mantlePlugin: Plugin = {
    name: "Mantle",
    description: "Mantle plugin",
    actions: [swapAction],
    evaluators: [],
    providers: [],
}