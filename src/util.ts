import { bs58 } from "@coral-xyz/anchor/dist/cjs/utils/bytes";
import {
  Metaplex,
  toMetadata,
  toMetadataAccount,
} from "@metaplex-foundation/js";
import HttpUtil from "@pefish/js-http";
import { StringUtil } from "@pefish/js-node-assist";
import {
  ComputeBudgetProgram,
  Connection,
  Keypair,
  ParsedInnerInstruction,
  ParsedInstruction,
  ParsedTransactionWithMeta,
  PartiallyDecodedInstruction,
  PublicKey,
  SystemProgram,
  TransactionInstruction,
  TransactionMessage,
  VersionedTransaction,
} from "@solana/web3.js";
import axios from "axios";
import { inspect } from "util";
import {
  ComputeBudgetAddress,
  Order,
  OrderType,
  RouterType,
  SOL_DECIMALS,
  WSOL_ADDRESS,
} from "./constants";

import { Wallet } from "@coral-xyz/anchor";
import { ILogger } from "@pefish/js-logger";
import TimeUtil from "@pefish/js-util-time";
import { struct, u64, u8 } from "@raydium-io/raydium-sdk-v2";
import {
  createAssociatedTokenAccountIdempotentInstruction,
  createSyncNativeInstruction,
  getAccount,
} from "@solana/spl-token";
import { getSwapInstructionsFromJup } from "./jupiter";
import { parseOrderTransaction } from "./parse_order";
import { getPumpFunSwapInstructions } from "./pumpfun";
import { getRaydiumSwapInstructions, RaydiumSwapKeys } from "./raydium";
import {
  getLatestBlockhash,
  getParsedTransaction,
  getRawAccountInfo,
  getRecentPrioritizationFees,
  getSignaturesForAddress,
  isIgnoreErr,
  sendRawTransaction,
} from "./solana-web3/ignore429";

export function findInnerInstructions(
  transaction: ParsedTransactionWithMeta,
  instructionIndex: number
): (ParsedInstruction | PartiallyDecodedInstruction)[] {
  if (!transaction.meta || !transaction.meta.innerInstructions) {
    return [];
  }
  // 找到内部指令
  let innerInstruction: ParsedInnerInstruction | null = null;
  for (const innerInstruction_ of transaction.meta.innerInstructions) {
    if (innerInstruction_.index == instructionIndex) {
      innerInstruction = innerInstruction_;
      break;
    }
  }
  if (!innerInstruction) {
    throw new Error(
      `<${transaction.transaction.signatures}> 没有找到 swap 的内部指令`
    );
  }
  return innerInstruction.instructions;
}

export async function sendRawTransactionByMultiNode(
  logger: ILogger,
  urls: string[],
  rawTransaction: Buffer | Uint8Array | Array<number>
): Promise<string> {
  const promises = [];
  for (const url of urls) {
    promises.push(
      (async () => {
        const connection = new Connection(url);
        logger.debug(`使用 ${url} 广播`);
        const txid = await sendRawTransaction(connection, rawTransaction, {
          skipPreflight: true,
          maxRetries: 5,
        });
        logger.debug(`${url} 广播成功 ${txid}`);
        return txid;
      })()
    );
  }
  const results = await Promise.allSettled<string>(promises);
  let txid = "";
  let errors = [];
  for (const result of results) {
    if (result.status == "fulfilled") {
      txid = result.value;
      break;
    } else {
      errors.push(result.reason);
    }
  }
  if (txid == "") {
    throw new Error(`交易广播失败 ${errors}`);
  }
  return txid;
}

export function getMetadataAccount(
  connection: Connection,
  tokenAddress: string
): string {
  const metaplex = Metaplex.make(connection);
  const mintAddress = new PublicKey(tokenAddress);
  return metaplex.nfts().pdas().metadata({ mint: mintAddress }).toString();
}

// 获取 Token 的元数据地址
export async function getTokenMetadata(
  connection: Connection,
  tokenAddress: string
): Promise<{
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
}> {
  const metadataAccount = getMetadataAccount(connection, tokenAddress);
  const metadataAccountInfo = await getRawAccountInfo(
    connection,
    new PublicKey(metadataAccount)
  );

  return toMetadata(toMetadataAccount(metadataAccountInfo as any)) as any;
}

export async function getCreateInfoFromMetadataAccount(
  connection: Connection,
  metadataAccount: string
): Promise<{
  creator: string;
  timestamp: number;
}> {
  const signatureInfos = await getSignaturesForAddress(
    connection,
    new PublicKey(metadataAccount),
    {
      limit: 10,
    }
  );
  const createSignatureInfo = signatureInfos[signatureInfos.length - 1];
  const tx = await getParsedTransaction(
    connection,
    createSignatureInfo.signature
  );
  return {
    creator: tx.transaction.message.accountKeys[0].pubkey.toString(),
    timestamp: tx.blockTime ? tx.blockTime * 1000 : 0,
  };
}

export async function getRedditToken(
  clientId: string,
  clientSecret: string
): Promise<{
  access_token: string;
  expires_in: number; // 单位 s
}> {
  const auth = Buffer.from(`${clientId}:${clientSecret}`).toString("base64");
  const data = await HttpUtil.postFormData(
    "https://www.reddit.com/api/v1/access_token",
    {
      params: {
        grant_type: "client_credentials",
      },
      headers: {
        Authorization: `Basic ${auth}`,
        "User-Agent": "pefish_me/1.0.0",
      },
    }
  );

  return data;
}

export async function getRedditScore(
  keyword: string,
  token: string
): Promise<number> {
  const response = await axios.get(`https://oauth.reddit.com/search`, {
    params: {
      q: keyword,
      sort: "top",
      limit: 100,
    },
    headers: {
      Authorization: `Bearer ${token}`,
      "User-Agent": "pefish_me/1.0.0",
    },
  });
  if (!response.data.data) {
    return 0;
  }
  if (!response.data.data.children || response.data.data.children.length == 0) {
    return 0;
  }
  let score = 0;
  for (const child of response.data.data.children) {
    score += child.data.score;
  }

  return score;
}

export async function estimateComputeUnitPriceByHelius(
  heliusUrl: string,
  writableAccounts: string[]
): Promise<number> {
  const {
    result: { priorityFeeEstimate },
  } = await (
    await fetch(heliusUrl, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        jsonrpc: "2.0",
        id: "helius-example",
        method: "getPriorityFeeEstimate",
        params: [
          {
            accountKeys: writableAccounts,
            options: {
              recommended: true,
            },
          },
        ],
      }),
    })
  ).json();
  return priorityFeeEstimate;
}

export async function placeOrder(
  logger: ILogger,
  connection: Connection,
  priv: string,
  type: OrderType,
  amount: string,
  tokenAddress: string,
  routerType: RouterType,
  opts: {
    nodeUrls?: string[];
    slippage?: number;
    raydiumSwapKeys?: RaydiumSwapKeys | null;
    isCloseTokenAccount?: boolean;
    computeUnitLimit?: number;
    accelerationLevel?: number;
  }
): Promise<{
  order: Order;
  extraData: RaydiumSwapKeys | null;
}> {
  const wallet = new Wallet(Keypair.fromSecretKey(bs58.decode(priv)));

  let getSwapInstructionsResult: {
    instructions: TransactionInstruction[];
    computeUnits: number;
  };
  if (routerType == "PumpFun") {
    getSwapInstructionsResult = await getPumpFunSwapInstructions(
      connection,
      wallet.publicKey.toString(),
      type,
      tokenAddress,
      amount,
      opts.slippage || 1000,
      !!opts.isCloseTokenAccount
    );
  } else if (routerType == "Raydium" && opts.raydiumSwapKeys) {
    getSwapInstructionsResult = await getRaydiumSwapInstructions(
      connection,
      wallet.publicKey.toString(),
      type,
      tokenAddress,
      amount,
      opts.slippage || 500,
      opts.raydiumSwapKeys,
      !!opts.isCloseTokenAccount
    );
  } else {
    getSwapInstructionsResult = await getSwapInstructionsFromJup(
      connection,
      wallet.publicKey.toString(),
      type,
      tokenAddress,
      amount,
      opts.slippage || 1000,
      !!opts.isCloseTokenAccount
    );
  }

  // 评估网络费
  let messageV0 = new TransactionMessage({
    payerKey: wallet.publicKey,
    recentBlockhash: "",
    instructions: [
      ComputeBudgetProgram.setComputeUnitLimit({
        units: 100000,
      }),
      ComputeBudgetProgram.setComputeUnitPrice({
        microLamports: 0,
      }),
      ...getSwapInstructionsResult.instructions,
    ],
  }).compileToV0Message();

  let computeUnitPrice = await estimateComputeUnitPrice(
    connection,
    messageV0.staticAccountKeys.map((acc: PublicKey): string => {
      return acc.toString();
    })
  );
  // 价格超过 300 lamports 就不要下单
  if (computeUnitPrice > 300000000) {
    throw new Error(`Compute unit price <${computeUnitPrice}> too high.`);
  }
  if (opts.accelerationLevel) {
    computeUnitPrice = StringUtil.start(computeUnitPrice)
      .multi(opts.accelerationLevel)
      .remainDecimal(0)
      .toNumber();
  }
  // 组装交易
  const latestBlockhashInfo = await getLatestBlockhash(connection);
  messageV0 = new TransactionMessage({
    payerKey: wallet.publicKey,
    recentBlockhash: latestBlockhashInfo.blockhash,
    instructions: [
      ComputeBudgetProgram.setComputeUnitLimit({
        units: opts.computeUnitLimit || getSwapInstructionsResult.computeUnits,
      }),
      ComputeBudgetProgram.setComputeUnitPrice({
        microLamports: computeUnitPrice,
      }),
      ...getSwapInstructionsResult.instructions,
    ],
  }).compileToV0Message();

  const transaction = new VersionedTransaction(messageV0);
  transaction.sign([wallet.payer]);
  const rawTransaction = transaction.serialize();
  let txId;
  if (opts.nodeUrls) {
    txId = await sendRawTransactionByMultiNode(
      logger,
      opts.nodeUrls,
      rawTransaction
    );
  } else {
    txId = await sendRawTransaction(connection, rawTransaction);
  }

  logger.info(`<${txId}> 广播成功`);
  await TimeUtil.sleep(3000);
  const parsedTransaction = await TimeUtil.timeout<ParsedTransactionWithMeta>(
    async () => {
      while (true) {
        try {
          const tx: ParsedTransactionWithMeta | null =
            await connection.getParsedTransaction(txId, {
              commitment: "confirmed",
              maxSupportedTransactionVersion: 0,
            });
          if (!tx) {
            logger.info(`<${txId}> 等待确认...`);
            await TimeUtil.sleep(2000);
            continue;
          }
          return tx;
        } catch (err) {
          if (!isIgnoreErr(err)) {
            throw err;
          }
        }
      }
    },
    30000
  );
  logger.info(`<${txId}> 已确认`);
  if (parsedTransaction.meta && parsedTransaction.meta.err) {
    throw new Error(
      `失败的交易 <${txId}>. ${inspect(parsedTransaction.meta.err)}`
    );
  }
  const parseResult = await parseOrderTransaction(
    logger,
    connection,
    parsedTransaction
  );
  if (!parseResult) {
    throw new Error(`交易确认了，但是 parse 没有成功`);
  }
  return parseResult;
}

export async function getDepositWSOLInstructions(
  connection: Connection,
  fromAddress: string,
  toAddress: string,
  amount: string
): Promise<TransactionInstruction[]> {
  const instructions: TransactionInstruction[] = [];

  const fromPKey = new PublicKey(fromAddress);
  const toPKey = new PublicKey(toAddress);

  try {
    await getAccount(connection, toPKey);
  } catch (e) {
    instructions.push(
      createAssociatedTokenAccountIdempotentInstruction(
        fromPKey,
        toPKey,
        fromPKey,
        new PublicKey(WSOL_ADDRESS)
      )
    );
  }
  // 转账 WSOL 到 WSOL token account
  instructions.push(
    ...[
      SystemProgram.transfer({
        fromPubkey: fromPKey,
        toPubkey: toPKey,
        lamports: BigInt(
          StringUtil.start(amount).shiftedBy(SOL_DECIMALS).toString()
        ),
      }),
      createSyncNativeInstruction(toPKey),
    ]
  );

  return instructions;
}

export async function estimateComputeUnitPrice(
  connection: Connection,
  writableAccounts: string[]
): Promise<number> {
  const writableAccountPKeys = writableAccounts.map(
    (account: string) => new PublicKey(account)
  );
  const feeInfos = await getRecentPrioritizationFees(
    connection,
    writableAccountPKeys
  );
  const fees: number[] = [];
  feeInfos.map((feeInfo) => {
    if (feeInfo.prioritizationFee > 0) {
      fees.push(feeInfo.prioritizationFee);
    }
  });

  return StringUtil.start(fees.reduce((acc, fee) => acc + fee) / fees.length)
    .remainDecimal(0)
    .toNumber();
}

export interface TransactionFeeInfo {
  baseFee: string;
  priorityFee: string;
  totalFee: string;
}

export function getAllFeeOfTx(
  transaction: ParsedTransactionWithMeta
): TransactionFeeInfo {
  if (!transaction.meta) {
    throw new Error(
      `<${transaction.transaction.signatures[0]}> meta not found.`
    );
  }
  const baseFee = StringUtil.start(transaction.meta.fee)
    .unShiftedBy(SOL_DECIMALS)
    .toString();

  let setComputeUnitPriceInstru: PartiallyDecodedInstruction | null = null;
  let setComputeUnitLimitInstru: PartiallyDecodedInstruction | null = null;
  for (const [
    index,
    instruction,
  ] of transaction.transaction.message.instructions.entries()) {
    if (instruction.programId.toString() != ComputeBudgetAddress) {
      continue;
    }
    const instru = instruction as PartiallyDecodedInstruction;
    const methodHex = bs58.decode(instru.data).subarray(0, 1).toString("hex");
    if (methodHex == "03") {
      setComputeUnitPriceInstru = instru;
    } else if (methodHex == "02") {
      setComputeUnitLimitInstru = instru;
    }
  }
  if (!setComputeUnitPriceInstru || !transaction.meta.computeUnitsConsumed) {
    return {
      baseFee: baseFee,
      priorityFee: "0",
      totalFee: baseFee,
    };
  }

  let computeUnitLimit = "200000";
  if (setComputeUnitLimitInstru) {
    const setComputeUnitLimitInstruData = struct([
      u8("discriminator"),
      u64("units"),
    ]).decode(bs58.decode(setComputeUnitLimitInstru.data));
    computeUnitLimit = setComputeUnitLimitInstruData.units.toString();
  }

  const setComputeUnitPriceInstruData = struct([
    u8("discriminator"),
    u64("microLamports"),
  ]).decode(bs58.decode(setComputeUnitPriceInstru.data));
  const priorityFee = StringUtil.start(
    setComputeUnitPriceInstruData.microLamports.toString()
  )
    .multi(computeUnitLimit)
    .unShiftedBy(SOL_DECIMALS + 6)
    .toString();

  return {
    baseFee: baseFee,
    priorityFee: priorityFee,
    totalFee: StringUtil.start(baseFee).add(priorityFee).toString(),
  };
}
