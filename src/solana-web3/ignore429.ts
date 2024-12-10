import TimeUtil from "@pefish/js-util-time";
import {
  AccountInfo,
  BlockhashWithExpiryBlockHeight,
  Commitment,
  ConfirmedSignatureInfo,
  Connection,
  Finality,
  GetAccountInfoConfig,
  GetMultipleAccountsConfig,
  LogsCallback,
  LogsFilter,
  ParsedAccountData,
  ParsedTransactionWithMeta,
  PublicKey,
  RecentPrioritizationFees,
  SendOptions,
  SignaturesForAddressOptions,
  TransactionConfirmationStrategy,
  TransactionSignature,
} from "@solana/web3.js";
import { inspect } from "util";

export function isIgnoreErr(err: any): boolean {
  const errStr = inspect(err);
  return (
    errStr.includes("429 Too Many Requests") ||
    errStr.includes("Too many requests") ||
    errStr.includes("Connect Timeout") ||
    errStr.includes("read ECONNRESET") ||
    errStr.includes("try again")
  );
}

export async function getParsedTransaction(
  connection: Connection,
  txId: string
): Promise<ParsedTransactionWithMeta> {
  while (true) {
    try {
      const tx: ParsedTransactionWithMeta | null =
        await connection.getParsedTransaction(txId, {
          commitment: "confirmed",
          maxSupportedTransactionVersion: 0,
        });
      if (tx) {
        return tx;
      }
    } catch (err) {
      if (!isIgnoreErr(err)) {
        throw err;
      }
    }
    await TimeUtil.sleep(1000);
  }
}

export async function getLatestBlockhash(
  connection: Connection
): Promise<BlockhashWithExpiryBlockHeight> {
  while (true) {
    try {
      return await connection.getLatestBlockhash();
    } catch (err) {
      if (!isIgnoreErr(err)) {
        throw err;
      }
    }
    await TimeUtil.sleep(1000);
  }
}

export async function getRecentPrioritizationFees(
  connection: Connection,
  lockedWritableAccounts: PublicKey[]
): Promise<RecentPrioritizationFees[]> {
  while (true) {
    try {
      return await connection.getRecentPrioritizationFees({
        lockedWritableAccounts,
      });
    } catch (err) {
      if (!isIgnoreErr(err)) {
        throw err;
      }
    }
    await TimeUtil.sleep(1000);
  }
}

export async function confirmTransaction(
  connection: Connection,
  strategy: TransactionConfirmationStrategy
): Promise<void> {
  while (true) {
    try {
      await connection.confirmTransaction(strategy);
    } catch (err) {
      if (!isIgnoreErr(err)) {
        throw err;
      }
    }
    await TimeUtil.sleep(1000);
  }
}

export async function onLogs(
  connection: Connection,
  filter: LogsFilter,
  callback: LogsCallback,
  commitment?: Commitment
): Promise<void> {
  while (true) {
    try {
      connection.onLogs(filter, callback, commitment);
    } catch (err) {
      if (!isIgnoreErr(err)) {
        throw err;
      }
    }
    await TimeUtil.sleep(1000);
  }
}

export async function getMultipleParsedAccounts(
  connection: Connection,
  publicKeys: PublicKey[],
  rawConfig?: GetMultipleAccountsConfig
): Promise<(AccountInfo<Buffer | ParsedAccountData> | null)[]> {
  while (true) {
    try {
      const result = await connection.getMultipleParsedAccounts(
        publicKeys,
        rawConfig
      );
      return result.value;
    } catch (err) {
      if (!isIgnoreErr(err)) {
        throw err;
      }
    }
    await TimeUtil.sleep(1000);
  }
}

export async function getMultipleRawAccountsInfo(
  connection: Connection,
  publicKeys: PublicKey[],
  rawConfig?: GetMultipleAccountsConfig
): Promise<(AccountInfo<Buffer> | null)[]> {
  while (true) {
    try {
      const result = await connection.getMultipleAccountsInfo(
        publicKeys,
        rawConfig
      );
      return result;
    } catch (err) {
      if (!isIgnoreErr(err)) {
        throw err;
      }
    }
    await TimeUtil.sleep(1000);
  }
}

// 获取 token account 账户的数据信息
export async function getAssociatedTokenAccountInfo(
  connection: Connection,
  address: string
): Promise<{
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
} | null> {
  const accountInfo = await getParsedAccountInfo(
    connection,
    new PublicKey(address)
  );
  if (!accountInfo) {
    return null;
  }
  const accountInfoData = accountInfo.data as ParsedAccountData;

  return accountInfoData.parsed["info"];
}

export async function getRawAccountInfo(
  connection: Connection,
  publicKey: PublicKey,
  commitmentOrConfig?: Commitment | GetAccountInfoConfig
): Promise<AccountInfo<Buffer> | null> {
  let result: AccountInfo<Buffer> | null = null;
  while (true) {
    try {
      result = await connection.getAccountInfo(publicKey, commitmentOrConfig);
      return result;
    } catch (err) {
      if (!isIgnoreErr(err)) {
        throw err;
      }
    }
    await TimeUtil.sleep(1000);
  }
}

export async function getParsedAccountInfo(
  connection: Connection,
  publicKey: PublicKey,
  commitmentOrConfig?: Commitment | GetAccountInfoConfig
): Promise<AccountInfo<Buffer | ParsedAccountData> | null> {
  while (true) {
    try {
      const result = await connection.getParsedAccountInfo(
        publicKey,
        commitmentOrConfig
      );
      if (result) {
        return result.value;
      }
    } catch (err) {
      if (!isIgnoreErr(err)) {
        throw err;
      }
    }
    await TimeUtil.sleep(1000);
  }
}

export async function getSignaturesForAddress(
  connection: Connection,
  address: PublicKey,
  options?: SignaturesForAddressOptions,
  commitment?: Finality
): Promise<ConfirmedSignatureInfo[]> {
  let result = null;
  while (true) {
    try {
      result = await connection.getSignaturesForAddress(
        address,
        options,
        commitment
      );
      if (result) {
        return result;
      }
    } catch (err) {
      if (!isIgnoreErr(err)) {
        throw err;
      }
    }
    await TimeUtil.sleep(1000);
  }
}

export async function sendRawTransaction(
  connection: Connection,
  rawTransaction: Buffer | Uint8Array | Array<number>,
  options?: SendOptions
): Promise<TransactionSignature> {
  let result = null;
  while (true) {
    try {
      result = await connection.sendRawTransaction(rawTransaction, options);
      if (result) {
        return result;
      }
    } catch (err) {
      if (!isIgnoreErr(err)) {
        throw err;
      }
    }
    await TimeUtil.sleep(1000);
  }
}
