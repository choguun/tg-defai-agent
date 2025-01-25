import { composeContext, Content, generateObject } from "@elizaos/core";
import { booleanFooter } from "@elizaos/core";
import {
    type Action,
    type ActionExample,
    type IAgentRuntime,
    type Memory,
    ModelClass,
    type State,
} from "@elizaos/core";
import { z } from "zod";


const SwapSchema = z.object({
	srcToken: z.string(),
	destToken: z.string(),
	amount: z.string(),
	useAGW: z.boolean(),
});

const validatedSwapSchema = z.object({
	srcToken: z
		.string(),
	destToken: z
		.string(),
	amount: z.string(),
	useAGW: z.boolean(),
});

export interface SwapContent extends Content {
	srcToken: string;
	destToken: string;
	amount: string | number;
	useAGW: boolean;
}

export const swapTemplate =
    `Based on the conversation so far:

{{recentMessages}}

Should {{agentName}} start following this room, eagerly participating without explicit mentions?
Respond with YES if:
- The user has directly asked {{agentName}} to follow the conversation or participate more actively
- The conversation topic is highly engaging and {{agentName}}'s input would add significant value
- {{agentName}} has unique insights to contribute and the users seem receptive

Otherwise, respond with NO.
` + booleanFooter;

export const swapAction: Action = {
    name: "SWAP_TOKEN",
    similes: [
        "EXECUTE_SWAP",
    ],
    description:
        "Swap tokens on Mantle",
    validate: async (runtime: IAgentRuntime, message: Memory) => true,
    handler: async (runtime: IAgentRuntime, message: Memory) => {
        const state = await runtime.composeState(message);

        const swapContext = composeContext({
            state,
            template: swapTemplate, // Define this template separately
        });

        	// Generate transfer content
		const content = (
			await generateObject({
				runtime,
				context: swapContext,
				modelClass: ModelClass.LARGE,
				schema: SwapSchema,
			})
		).object as SwapContent;


    },
    examples: [
        [
            {
                user: "{{user1}}",
                content: {
                    text: "Swap 1 SOL for USDC"
                }
            },
            {
                user: "{{user1}}",
                content: {
                    srcToken: "SOL",
                    destToken: "USDC",
                    amount: 1,
                },
            },
            {
                user: "{{user2}}",
                content: {
                    text: "Processing swap: 1 SOL -> USDC",
                    action: "EXECUTE_SWAP"
                }
            },
            {
                user: "{{user2}}",
                content: {
                    text: "Swap complete! Transaction: [tx_hash]"
                }
            },
        ]
    ] as ActionExample[][],
} as Action;