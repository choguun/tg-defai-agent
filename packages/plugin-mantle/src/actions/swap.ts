import { composeContext, Content, elizaLogger, generateObject, generateObjectDeprecated } from "@elizaos/core";
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
    "srcToken": "<TOKEN_ADDRESS>",
    "destToken": "<TOKEN_ADDRESS>",
    "amount": "1000",
}
\`\`\`

User message:
"{{currentMessage}}"

Given the message, extract the following information about the requested token transfer:
- srcToken
- destToken
- Amount to swap

Respond with a JSON markdown block containing only the extracted values.`;

const TOKEN_ADDRESSES = {
    "MNT": "0x3c499c542cef5e3811e1192ce70d8cc03d5c3359",
    "USDC": "0x09bc4e0d864854c6afb6eb9a9cdf58ac190d0df9",
};

const TOKEN_DECIMALS = {
    "MNT": 18,
};

export const swapAction: Action = {
    name: "SWAP_TOKEN",
    similes: [
        "EXECUTE_SWAP",
    ],
    description:
        "Swap tokens on Mantle",
    validate: async (runtime: IAgentRuntime, message: Memory) => true,
    handler: async (runtime: IAgentRuntime, message: Memory, state: State) => {
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

            const swapOptions = {
                srcToken: content.srcToken,
                destToken: content.destToken,
                amount: content.amount,
            };
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