import { Connection, ParsedTransactionWithMeta } from "@solana/web3.js";
import { Order } from "./constants";
import { ILogger } from "@pefish/js-logger";
import { RaydiumSwapKeys } from "./raydium";
export declare function parseOrderTransaction(logger: ILogger, connection: Connection, transaction: ParsedTransactionWithMeta): Promise<{
    order: Order;
    extraData: RaydiumSwapKeys | null;
} | null>;
export declare function parseOrderTransactionByTxId(logger: ILogger, connection: Connection, txId: string): Promise<{
    order: Order;
    extraData: RaydiumSwapKeys | null;
} | null>;
