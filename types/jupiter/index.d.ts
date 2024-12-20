import { ParsedTransactionWithMeta, TransactionInstruction } from "@solana/web3.js";
import { Order } from "../constants";
import { RaydiumSwapKeys } from "../raydium";
export interface QuoteResponseType {
    inputMint: string;
    inAmount: string;
    outputMint: string;
    outAmount: string;
    otherAmountThreshold: string;
    swapMode: string;
    slippageBps: number;
    platformFee: string | null;
    priceImpactPct: string;
    routePlan: {
        swapInfo: {
            ammKey: string;
            label: string;
            inputMint: string;
            outputMint: string;
            inAmount: string;
            outAmount: string;
            feeAmount: string;
            feeMint: string;
        };
        percent: number;
    }[];
    contextSlot: number;
    timeTaken: number;
}
export declare function getSwapInstructionsFromJup(userAddress: string, type: "buy" | "sell", tokenAddress: string, amount: string, slippage: number, isCloseTokenAccount?: boolean): Promise<{
    instructions: TransactionInstruction[];
    computeUnits: number;
}>;
export declare function parseJupiterSwapTx(transaction: ParsedTransactionWithMeta): Promise<{
    orderInfo: Order;
    raydiumSwapKeys: RaydiumSwapKeys | null;
} | null>;
