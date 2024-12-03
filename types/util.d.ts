import { Connection, ParsedInstruction, ParsedTransactionWithMeta, PartiallyDecodedInstruction, PublicKey, TransactionInstruction } from "@solana/web3.js";
import { Order, OrderType, RouterType } from "./constants";
import { ILogger } from "@pefish/js-logger";
import { RaydiumSwapKeys } from "./raydium";
export declare function findInnerInstructions(transaction: ParsedTransactionWithMeta, instructionIndex: number): (ParsedInstruction | PartiallyDecodedInstruction)[];
export declare function sendRawTransactionByMultiNode(logger: ILogger, urls: string[], rawTransaction: Buffer | Uint8Array | Array<number>): Promise<string>;
export declare function getMetadataAccount(connection: Connection, tokenAddress: string): string;
export declare function getTokenMetadata(connection: Connection, tokenAddress: string): Promise<{
    model: string;
    address: PublicKey;
    mintAddress: PublicKey;
    updateAuthorityAddress: PublicKey;
    json: any | null;
    jsonLoaded: boolean;
    name: string;
    symbol: string;
    uri: string;
    isMutable: boolean;
    primarySaleHappened: boolean;
    sellerFeeBasisPoints: number;
    editionNonce: number;
    creators: PublicKey[];
    tokenStandard: number;
    collection: any | null;
    collectionDetails: any | null;
    uses: any | null;
    programmableConfig: any | null;
}>;
export declare function getCreateInfoFromMetadataAccount(connection: Connection, metadataAccount: string): Promise<{
    creator: string;
    timestamp: number;
}>;
export declare function getRedditToken(clientId: string, clientSecret: string): Promise<{
    access_token: string;
    expires_in: number;
}>;
export declare function getRedditScore(keyword: string, token: string): Promise<number>;
export declare function estimateComputeUnitPriceByHelius(heliusUrl: string, writableAccounts: string[]): Promise<number>;
export declare function placeOrder(logger: ILogger, connection: Connection, priv: string, type: OrderType, amount: string, tokenAddress: string, routerType: RouterType, opts: {
    nodeUrls?: string[];
    slippage?: number;
    raydiumSwapKeys?: RaydiumSwapKeys;
    isCloseTokenAccount?: boolean;
    computeUnitLimit?: number;
    accelerationLevel?: number;
}): Promise<{
    order: Order;
    extraData: RaydiumSwapKeys | null;
}>;
export declare function getDepositWSOLInstructions(connection: Connection, fromAddress: string, toAddress: string, amount: string): Promise<TransactionInstruction[]>;
export declare function estimateComputeUnitPrice(connection: Connection, writableAccounts: string[]): Promise<number>;
export interface TransactionFeeInfo {
    baseFee: string;
    priorityFee: string;
    totalFee: string;
}
export declare function getAllFeeOfTx(transaction: ParsedTransactionWithMeta): TransactionFeeInfo;
