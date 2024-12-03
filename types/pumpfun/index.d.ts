import { Connection, ParsedTransactionWithMeta, TransactionInstruction } from "@solana/web3.js";
import { Order } from "../constants";
export declare function parseBondingCurveAddressData(connection: Connection, bondingCurveAddress: string): Promise<{
    virtualTokenReserves: string;
    virtualSolReserves: string;
    realTokenReserves: string;
    realSolReserves: string;
    tokenTotalSupply: string;
    complete: boolean;
}>;
export declare function getPumpFunSwapInstructions(connection: Connection, userAddress: string, type: "buy" | "sell", tokenAddress: string, amount: string, // buy 的话就是 sol 的数量，sell 就是 token 的数量
slippage: number, isCloseTokenAccount?: boolean): Promise<TransactionInstruction[]>;
export declare function parsePumpFunSwapTx(transaction: ParsedTransactionWithMeta): Promise<Order | null>;
export declare function parsePumpFunRemoveLiqTx(connection: Connection, transaction: ParsedTransactionWithMeta): Promise<{
    destination: string;
    tokenAddress: string;
    associatedSource: string;
    associatedDestination: string;
    user: string;
    fee: string;
} | null>;
