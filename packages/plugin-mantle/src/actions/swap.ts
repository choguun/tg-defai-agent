import { composeContext, Content, elizaLogger, generateObject, generateObjectDeprecated, HandlerCallback } from "@elizaos/core";
import { booleanFooter } from "@elizaos/core";
import {
    type Action,
    type ActionExample,
    type IAgentRuntime,
    type Memory,
    ModelClass,
    type State,
} from "@elizaos/core";
import { initWalletProvider } from "../providers/wallet";
import { z } from "zod";

const SwapSchema = z.object({
	amount: z.string(),
	srcToken: z.string(),
	destToken: z.string(),
});

export type SwapContent = z.infer<typeof SwapSchema> & Content;

export const swapTemplate = `Respond with a JSON markdown block containing only the extracted values. Use null for any values that cannot be determined.

Example response:
\`\`\`json
{
    "srcToken": "0xeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeee",
    "destToken": "0x833589fcd6edb6e08f4c7c32d4f71b54bda02913",
    "amount": "1"
}
\`\`\`

{{recentMessages}}

Given the recent messages and wallet information below:

{{walletInfo}}

Extract the following information about the requested token swap:
- srcToken (the token being sold)
- destToken (the token being bought)
- amount (the amount of the token being sold)

Respond with a JSON markdown block containing only the extracted values. Use null for any values that cannot be determined. The result should be a valid JSON object with the following schema:
\`\`\`json
{
    "srcToken": string | null,
    "destToken": string | null,
    "amount":  number | string | null
}
\`\`\``;

const TOKEN_ADDRESSES = {
    "MNT": "0xdeaddeaddeaddeaddeaddeaddeaddeaddead0000",
    "USDC": "0x09bc4e0d864854c6afb6eb9a9cdf58ac190d0df9",
};

const TOKEN_DECIMALS = {
    "MNT": 18,
    "USDC": 6,
};

export const swapAction: Action = {
    name: "SWAP_TOKEN",
    similes: [
        "EXECUTE_SWAP",
    ],
    description:
        "Swap tokens on Mantle",
    validate: async (runtime: IAgentRuntime, message: Memory) => true,
    handler: async ( runtime: IAgentRuntime,
        message: Memory,
        state: State | undefined,
        _options: { [key: string]: unknown; } | undefined,
        callback?: HandlerCallback) => {
        elizaLogger.log("Starting Mantle SWAP handler...");
        const walletProvider = await initWalletProvider(runtime);
        // const action = new SwapAction(walletProvider);

        if (!state) {
            state = (await runtime.composeState(message)) as State;
        } else {
            state = await runtime.updateRecentMessageState(state);
        }

        try {
            elizaLogger.log("Composing swap context...");
            // Compose swap context
            const swapContext = composeContext({
                state,
                template: swapTemplate,
            });
            const content = await generateObjectDeprecated({
                runtime,
                context: swapContext,
                modelClass: ModelClass.LARGE,
            });

            const srcToken = TOKEN_ADDRESSES[content.srcToken as keyof typeof TOKEN_ADDRESSES];
            const destToken = TOKEN_ADDRESSES[content.destToken as keyof typeof TOKEN_ADDRESSES];
            const amount = String(parseFloat(content.amount) * 10 ** TOKEN_DECIMALS[content.srcToken as keyof typeof TOKEN_DECIMALS]);

            const swapOptions = {
                srcToken,
                destToken,
                amount,
            };

            console.log("Swap options:", swapOptions);

            const swap = await walletProvider.swap(swapOptions);

            elizaLogger.success("Swap executed successfully:", swap);

            callback?.({
                text: "Swap executed successfully"
            });

            return true;
        } catch (error) {
            elizaLogger.error("Error generating swap content:", error);
        }


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