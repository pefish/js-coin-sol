import { AccountInfo, BlockhashWithExpiryBlockHeight, Commitment, ConfirmedSignatureInfo, Connection, Finality, GetAccountInfoConfig, GetMultipleAccountsConfig, LogsCallback, LogsFilter, ParsedAccountData, ParsedTransactionWithMeta, PublicKey, RecentPrioritizationFees, SendOptions, SignaturesForAddressOptions, TransactionConfirmationStrategy, TransactionSignature } from "@solana/web3.js";
export declare function isIgnoreErr(err: any): boolean;
export declare function getParsedTransaction(connection: Connection, txId: string): Promise<ParsedTransactionWithMeta>;
export declare function getLatestBlockhash(connection: Connection): Promise<BlockhashWithExpiryBlockHeight>;
export declare function getRecentPrioritizationFees(connection: Connection, lockedWritableAccounts: PublicKey[]): Promise<RecentPrioritizationFees[]>;
export declare function confirmTransaction(connection: Connection, strategy: TransactionConfirmationStrategy): Promise<void>;
export declare function onLogs(connection: Connection, filter: LogsFilter, callback: LogsCallback, commitment?: Commitment): Promise<void>;
export declare function getMultipleParsedAccounts(connection: Connection, publicKeys: PublicKey[], rawConfig?: GetMultipleAccountsConfig): Promise<(AccountInfo<Buffer | ParsedAccountData> | null)[]>;
export declare function getMultipleRawAccountsInfo(connection: Connection, publicKeys: PublicKey[], rawConfig?: GetMultipleAccountsConfig): Promise<(AccountInfo<Buffer> | null)[]>;
export declare function getAssociatedTokenAccountInfo(connection: Connection, address: string): Promise<{
    isNative: boolean;
    mint: string;
    owner: string;
    state: string;
    tokenAmount: {
        amount: string;
        decimals: number;
        uiAmount: number;
        uiAmountString: string;
    };
} | null>;
export declare function getRawAccountInfo(connection: Connection, publicKey: PublicKey, commitmentOrConfig?: Commitment | GetAccountInfoConfig): Promise<AccountInfo<Buffer> | null>;
export declare function getParsedAccountInfo(connection: Connection, publicKey: PublicKey, commitmentOrConfig?: Commitment | GetAccountInfoConfig): Promise<AccountInfo<Buffer | ParsedAccountData> | null>;
export declare function getSignaturesForAddress(connection: Connection, address: PublicKey, options?: SignaturesForAddressOptions, commitment?: Finality): Promise<ConfirmedSignatureInfo[]>;
export declare function sendRawTransaction(connection: Connection, rawTransaction: Buffer | Uint8Array | Array<number>, options?: SendOptions): Promise<TransactionSignature>;
