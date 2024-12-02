import { Keypair, PublicKey, Transaction, TransactionInstruction } from "@solana/web3.js";
export declare function getKeyPairFromPrivateKey(key: string): Keypair;
export declare function createTransaction(instructions: TransactionInstruction[], payer: PublicKey, priorityFeeInSol: number | undefined, latestBlockHash: string): Transaction;
export declare function bufferFromUInt64(value: number | string): Buffer;
export declare function decodeBuyParams(b58Data: string): {
    amount: string;
    maxSolCost: string;
};
