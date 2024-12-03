import { Connection, ParsedTransactionWithMeta } from "@solana/web3.js";
import { Order } from "../constants";
export declare function parseMeteoraSwapTx(connection: Connection, transaction: ParsedTransactionWithMeta): Promise<Order | null>;
