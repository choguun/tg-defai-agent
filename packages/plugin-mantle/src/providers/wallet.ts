import {
    createPublicClient,
    createTestClient,
    createWalletClient,
    formatUnits,
    http,
    publicActions,
    walletActions,
} from "viem";
import { privateKeyToAccount } from "viem/accounts";
import {
    type IAgentRuntime,
    type Provider,
    type Memory,
    type State,
    elizaLogger,
} from "@elizaos/core";
import type {
    Address,
    WalletClient,
    PublicClient,
    Chain,
    HttpTransport,
    Account,
    PrivateKeyAccount,
    TestClient,
} from "viem";
import * as viemChains from "viem/chains";

import type { SupportedChain } from "../types/index";

import swapAbi from "../abi/swap";

export class WalletProvider {
    private currentChain: SupportedChain = "mantle";
    chains: Record<string, Chain> = { ...viemChains };
    account: PrivateKeyAccount;

    constructor(
        accountOrPrivateKey: PrivateKeyAccount | `0x${string}`,
        chains?: Record<string, Chain>
    ) {
        this.setAccount(accountOrPrivateKey);
        this.setChains(chains);

        if (chains && Object.keys(chains).length > 0) {
            this.setCurrentChain(Object.keys(chains)[0] as SupportedChain);
        }
    }

    getAddress(): Address {
        return this.account.address;
    }

    getCurrentChain(): Chain {
        return this.chains[this.currentChain];
    }

    getPublicClient(
        chainName: SupportedChain
    ): PublicClient<HttpTransport, Chain, Account | undefined> {
        const transport = this.createHttpTransport(chainName);

        const publicClient = createPublicClient({
            chain: this.chains[chainName],
            transport,
        });
        return publicClient;
    }

    getWalletClient(chainName: SupportedChain): WalletClient {
        const transport = this.createHttpTransport(chainName);

        const walletClient = createWalletClient({
            chain: this.chains[chainName],
            transport,
            account: this.account,
        });

        return walletClient;
    }

    getTestClient(): TestClient {
        return createTestClient({
            chain: viemChains.hardhat,
            mode: "hardhat",
            transport: http(),
        })
            .extend(publicActions)
            .extend(walletActions);
    }

    getChainConfigs(chainName: SupportedChain): Chain {
        const chain = viemChains[chainName];

        if (!chain?.id) {
            throw new Error("Invalid chain name");
        }

        return chain;
    }

    async getWalletBalance(): Promise<string | null> {
        try {
            const client = this.getPublicClient(this.currentChain);
            const balance = await client.getBalance({
                address: this.account.address,
            });

            const balanceFormatted = formatUnits(balance, 18);
            elizaLogger.log(
                "Wallet balance cached for chain: ",
                this.currentChain
            );
            return balanceFormatted;
        } catch (error) {
            console.error("Error getting wallet balance:", error);
            return null;
        }
    }

    async getWalletBalanceForChain(
        chainName: SupportedChain
    ): Promise<string | null> {
        try {
            const client = this.getPublicClient(chainName);
            const balance = await client.getBalance({
                address: this.account.address,
            });
            return formatUnits(balance, 18);
        } catch (error) {
            console.error("Error getting wallet balance:", error);
            return null;
        }
    }

    private setAccount = (
        accountOrPrivateKey: PrivateKeyAccount | `0x${string}`
    ) => {
        if (typeof accountOrPrivateKey === "string") {
            this.account = privateKeyToAccount(accountOrPrivateKey);
        } else {
            this.account = accountOrPrivateKey;
        }
    };

    private setChains = (chains?: Record<string, Chain>) => {
        if (!chains) {
            return;
        }
        Object.keys(chains).forEach((chain: string) => {
            this.chains[chain] = chains[chain];
        });
    };

    private setCurrentChain = (chain: SupportedChain) => {
        this.currentChain = chain;
    };

    private createHttpTransport = (chainName: SupportedChain) => {
        const chain = this.chains[chainName];

        if (chain.rpcUrls.custom) {
            return http(chain.rpcUrls.custom.http[0]);
        }
        return http(chain.rpcUrls.default.http[0]);
    };

    private async waitForTransaction(hash: `0x${string}`) {
        const publicClient = this.getPublicClient(this.currentChain);
        let retries = 20;
        while (retries > 0) {
            try {
                const receipt = await publicClient.getTransactionReceipt({ hash });
                if (receipt.status === 'success') return true;
                return false;
            } catch (e) {
                await new Promise(r => setTimeout(r, 1000));
                retries--;
            }
        }
        throw new Error('Transaction confirmation timeout');
    }

    async swap(swapOptions: any): Promise<any> {
        const client = this.getWalletClient(this.currentChain);
        try {
            // Approve tokens first
            const approveHash = await client.writeContract({
                address: swapOptions.srcToken as `0x${string}`,
                abi: [{
                    name: 'approve',
                    type: 'function',
                    stateMutability: 'nonpayable',
                    inputs: [{ name: 'spender', type: 'address' }, { name: 'amount', type: 'uint256' }],
                    outputs: [{ name: '', type: 'bool' }]
                }],
                functionName: 'approve',
                args: [
                    `0x2D6Fb41bA373da1a05B211D6C306d4684E6acD55` as `0x${string}`,
                    BigInt(swapOptions.amount)
                ],
                account: this.account,
                chain: this.chains[this.currentChain]
            });

            await this.waitForTransaction(approveHash);

            // Execute swap with updated router address
            const hash = await client.writeContract({
                address: `0x2D6Fb41bA373da1a05B211D6C306d4684E6acD55` as `0x${string}`,
                abi: swapAbi,
                functionName: "swapExactInputSingle",
                args: [
                    swapOptions.srcToken as `0x${string}`,
                    swapOptions.destToken as `0x${string}`, 
                    BigInt(swapOptions.amount)
                ],
                chain: this.chains[this.currentChain],
                account: this.account
            });
            
            return { success: true, hash };
        } catch (error: any) {
            elizaLogger.error("Swap error:", error.message || error);
            throw new Error(error.message || "Swap failed");
        }
    }
}

export const initWalletProvider = async (runtime: IAgentRuntime) => {
    const providerUrl = runtime.getSetting("EVM_PROVIDER_URL") as string;

    const chains: Record<string, Chain> = {
        "mantle": {
            id: 5000,
            name: "mantle",
            rpcUrls: {
                default: { http: [providerUrl] },
            },
            nativeCurrency: {
                name: "Mantle",
                symbol: "MANTLE",
                decimals: 18,
            },
        },
    };

    const privateKey = runtime.getSetting(
        "EVM_PRIVATE_KEY"
    ) as `0x${string}`;
    if (!privateKey) {
        throw new Error("EVM_PRIVATE_KEY is missing");
    }
    return new WalletProvider(privateKey, chains);
};

export const evmWalletProvider: Provider = {
    async get(
        runtime: IAgentRuntime,
        _message: Memory,
        state?: State
    ): Promise<string | null> {
        try {
            const walletProvider = await initWalletProvider(runtime);
            const address = walletProvider.getAddress();
            const balance = await walletProvider.getWalletBalance();
            const chain = walletProvider.getCurrentChain();
            const agentName = state?.agentName || "The agent";
            return `${agentName}'s EVM Wallet Address: ${address}\nBalance: ${balance} ${chain.nativeCurrency.symbol}\nChain ID: ${chain.id}, Name: ${chain.name}`;
        } catch (error) {
            console.error("Error in EVM wallet provider:", error);
            return null;
        }
    },
};