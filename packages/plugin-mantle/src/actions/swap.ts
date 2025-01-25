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
	tokenAddress: z.string(),
	recipient: z.string(),
	amount: z.string(),
	useAGW: z.boolean(),
	tokenSymbol: z.string(),
});

export type SwapContent = z.infer<typeof SwapSchema> & Content;


export const swapTemplate = `Respond with a JSON markdown block containing only the extracted values. Use null for any values that cannot be determined.

Example response:
\`\`\`json
{
    "tokenAddress": "<TOKEN_ADDRESS>",
    "recipient": "<TOKEN_ADDRESS>",
    "amount": "1000",
    "useAGW": true,
    "tokenSymbol": "USDC"
}
\`\`\`

User message:
"{{currentMessage}}"

Given the message, extract the following information about the requested token transfer:
- Token contract address
- Recipient wallet address
- Amount to transfer
- Whether to use Abstract Global Wallet aka AGW
- The symbol of the token that wants to be transferred. Between 1 to 6 characters usually.

If the user did not specify "global wallet", "AGW", "agw", or "abstract global wallet" in their message, set useAGW to false, otherwise set it to true.
s
Respond with a JSON markdown block containing only the extracted values.`;

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
                chain: content.chain,
                fromToken: content.inputToken,
                toToken: content.outputToken,
                amount: content.amount,
                slippage: content.slippage,
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