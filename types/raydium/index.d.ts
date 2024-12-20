import { Connection, ParsedTransactionWithMeta, TransactionInstruction } from "@solana/web3.js";
import { Order } from "../constants";
interface PoolInfoToken {
    address: string;
    logoURI: string;
    symbol: string;
    name: string;
    decimals: number;
}
interface PriceInfo {
    volume: number;
    volumeQuote: number;
    volumeFee: number;
    apr: number;
    feeApr: number;
    priceMin: number;
    priceMax: number;
    rewardApr: any[];
}
export interface KeysInfo {
    programId: string;
    id: string;
    mintA: {
        chainId: number;
        address: string;
        programId: string;
        logoURI: string;
        symbol: string;
        name: string;
        decimals: number;
        tags: string[];
        extensions: {};
    };
    mintB: {
        chainId: number;
        address: string;
        programId: string;
        logoURI: string;
        symbol: string;
        name: string;
        decimals: number;
        tags: string[];
        extensions: {};
    };
    lookupTableAccount: string;
    openTime: string;
    vault: {
        A: string;
        B: string;
    };
    authority: string;
    openOrders: string;
    targetOrders: string;
    mintLp: {
        chainId: number;
        address: string;
        programId: string;
        logoURI: string;
        symbol: string;
        name: string;
        decimals: number;
        tags: string[];
        extensions: {};
    };
    marketProgramId: string;
    marketId: string;
    marketAuthority: string;
    marketBaseVault: string;
    marketQuoteVault: string;
    marketBids: string;
    marketAsks: string;
    marketEventQueue: string;
}
export interface PoolInfo {
    type: string;
    programId: string;
    id: string;
    mintA: PoolInfoToken;
    mintB: PoolInfoToken;
    price: number;
    mintAmountA: number;
    mintAmountB: number;
    feeRate: number;
    openTime: string;
    tvl: number;
    day: PriceInfo;
    week: PriceInfo;
    month: PriceInfo;
    pooltype: string[];
    marketId: string;
    lpMint: PoolInfoToken;
    lpPrice: number;
    lpAmount: number;
    burnPercent: number;
}
export declare function getPoolInfoByLPAddress(lpAddress: string): Promise<PoolInfo>;
export declare function getAllKeysByPoolAddress(address: string): Promise<KeysInfo>;
export declare function getPoolInfoByTokenAddress(tokenAddress: string): Promise<PoolInfo>;
export interface RaydiumSwapKeys {
    ammAddress: string;
    ammOpenOrdersAddress?: string;
    ammTargetOrdersAddress?: string;
    poolCoinTokenAccountAddress: string;
    poolPcTokenAccountAddress: string;
    serumProgramAddress?: string;
    serumMarketAddress?: string;
    serumBidsAddress?: string;
    serumAsksAddress?: string;
    serumEventQueueAddress?: string;
    serumCoinVaultAccountAddress?: string;
    serumPcVaultAccountAddress?: string;
    serumVaultSignerAddress?: string;
}
export declare function getRaydiumSwapInstructions(connection: Connection, userAddress: string, type: "buy" | "sell", tokenAddress: string, amount: string, // buy 的话就是 sol 的数量，sell 就是 token 的数量
slippage: number, raydiumPoolInfo: RaydiumSwapKeys, isCloseTokenAccount?: boolean): Promise<{
    instructions: TransactionInstruction[];
    computeUnits: number;
}>;
export declare function getLPInfoFromLpAddress(connection: Connection, lpAddress: string): Promise<{
    tokenAddress: string;
    initTokenAmountInLP: string;
    initSOLAmountInLP: string;
} | null>;
export interface RaydiumPoolKeys {
    ammAddress: string;
    ammOpenOrdersAddress: string;
    lpAddress: string;
    coinMintAddress: string;
    pcMintAddress: string;
    poolCoinTokenAccountAddress: string;
    poolPcTokenAccountAddress: string;
    poolWithdrawQueueAddress: string;
    ammTargetOrdersAddress: string;
    poolTempLpAddress: string;
    serumProgramAddress: string;
    serumMarketAddress: string;
}
export declare function parseRaydiumAddLPTx(parsedTx: ParsedTransactionWithMeta): Promise<{
    tokenAddress: string;
    initTokenAmountInLP: string;
    initSOLAmountInLP: string;
    solPoolAddress: string;
    tokenPoolAddress: string;
    raydiumPoolKeys: RaydiumPoolKeys;
} | null>;
export declare function parseRaydiumSwapTx(connection: Connection, transaction: ParsedTransactionWithMeta): Promise<{
    orderInfo: Order;
    raydiumSwapKeys: RaydiumSwapKeys;
} | null>;
export declare function getTokenPrice(connection: Connection, solVaultAddress: string, tokenVaultAddress: string): Promise<string>;
export {};
