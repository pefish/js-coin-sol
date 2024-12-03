import { bs58 } from "@coral-xyz/anchor/dist/cjs/utils/bytes";
import { StringUtil } from "@pefish/js-node-assist";
import {
  bool,
  i64,
  publicKey,
  struct,
  u128,
  u64,
} from "@raydium-io/raydium-sdk-v2";
import {
  Connection,
  ParsedTransactionWithMeta,
  PartiallyDecodedInstruction,
} from "@solana/web3.js";
import { Order, RouterNames, SOL_DECIMALS } from "./constants";

import { ILogger } from "@pefish/js-logger";
import { inspect } from "util";
import { parseJupiterSwapTx } from "./jupiter";
import { JupiterAggregatorV6 } from "./jupiter/contants";
import { parseMeteoraSwapTx } from "./meteora";
import { MeteoraPoolsProgram } from "./meteora/contants";
import { parsePumpFunSwapTx } from "./pumpfun";
import { PUMP_FUN_PROGRAM, PUMP_FUN_TOKEN_DECIMALS } from "./pumpfun/contants";
import { parseRaydiumSwapTx, RaydiumSwapKeys } from "./raydium";
import { RaydiumLiquidityPoolV4 } from "./raydium/contants";
import { getParsedTransaction } from "./solana-web3/ignore429";
import { findInnerInstructions, getAllFeeOfTx } from "./util";

async function parseTx_BSfD(
  transaction: ParsedTransactionWithMeta
): Promise<Order | null> {
  if (!transaction.blockTime) {
    return null;
  }
  // 找到调用 swap 的指令
  let swapInstru: PartiallyDecodedInstruction | null = null;
  let swapInstruIndex: number = 0;
  for (const [
    index,
    instruction,
  ] of transaction.transaction.message.instructions.entries()) {
    if (
      instruction.programId.toString() !=
      "BSfD6SHZigAfDWSjzD5Q41jw8LmKwtmjskPH9XW1mrRW"
    ) {
      continue;
    }
    const swapInstruction = instruction as PartiallyDecodedInstruction;
    const methodHex = bs58
      .decode(swapInstruction.data)
      .subarray(0, 8)
      .toString("hex");
    if (methodHex != "52e177e74e1d2d46" && methodHex != "5d583c225b1256c5") {
      continue;
    }
    swapInstru = instruction as PartiallyDecodedInstruction;
    swapInstruIndex = index;
    break;
  }
  if (!swapInstru) {
    return null;
  }

  const swapInnerInstructions = findInnerInstructions(
    transaction,
    swapInstruIndex
  ) as PartiallyDecodedInstruction[];

  let swapEventInnerInstruction: PartiallyDecodedInstruction | null = null;
  for (const swapInnerInstruction of swapInnerInstructions) {
    if (
      swapInnerInstruction.programId.toString() ==
        PUMP_FUN_PROGRAM.toString() &&
      swapInnerInstruction.accounts.length == 1 &&
      swapInnerInstruction.accounts[0].toString() ==
        "Ce6TQqeHC9p8KetsN6JsjHK7UTZk7nasjjnr7XxXp9F1"
    ) {
      swapEventInnerInstruction = swapInnerInstruction;
      break;
    }
  }
  if (!swapEventInnerInstruction) {
    throw new Error(
      `<${transaction.transaction.signatures[0]}> Swap event not be found.`
    );
  }

  const pumpfunSwapEventParsedData = struct([
    u128("id"),
    publicKey("mint"),
    u64("solAmount"),
    u64("tokenAmount"),
    bool("isBuy"),
    publicKey("user"),
    i64("timestamp"),
    u64("virtualSolReserves"),
    u64("virtualTokenReserves"),
  ]).decode(bs58.decode(swapEventInnerInstruction.data));

  const feeInfo = getAllFeeOfTx(transaction);

  return {
    user: transaction.transaction.message.accountKeys[0].pubkey.toString(),
    tx_id: transaction.transaction.signatures[0],

    router: PUMP_FUN_PROGRAM.toString(),
    router_name: RouterNames[PUMP_FUN_PROGRAM.toString()],
    type: pumpfunSwapEventParsedData.isBuy ? "buy" : "sell",
    sol_amount: StringUtil.start(pumpfunSwapEventParsedData.solAmount)
      .unShiftedBy(SOL_DECIMALS)
      .toString(),
    token_amount: StringUtil.start(pumpfunSwapEventParsedData.tokenAmount)
      .unShiftedBy(PUMP_FUN_TOKEN_DECIMALS)
      .toString(),
    token_address: pumpfunSwapEventParsedData.mint.toString(),
    fee: feeInfo.totalFee,
    timestamp: transaction.blockTime * 1000,
  };
}

export async function parseOrderTransaction(
  logger: ILogger,
  connection: Connection,
  transaction: ParsedTransactionWithMeta
): Promise<{
  order: Order;
  extraData: RaydiumSwapKeys | null;
} | null> {
  const txId = transaction.transaction.signatures[0].toString();
  let result: {
    order: Order;
    extraData: RaydiumSwapKeys | null;
  } | null = null;

  for (const [
    index,
    instruction,
  ] of transaction.transaction.message.instructions.entries()) {
    switch (instruction.programId.toString()) {
      case RaydiumLiquidityPoolV4:
        logger.debug(`<${txId}> is raydium swap`);
        try {
          const parseRaydiumSwapResult = await parseRaydiumSwapTx(
            connection,
            transaction
          );
          if (!parseRaydiumSwapResult) {
            continue;
          }
          result = {
            order: parseRaydiumSwapResult.orderInfo,
            extraData: parseRaydiumSwapResult.raydiumSwapKeys,
          };
        } catch (err) {
          logger.debug(err);
          continue;
        }
        break;
      // case ORCA_ADDRESS:
      //   // https://solscan.io/tx/4NgCWFiKJgUmP1A1DE468AfTBmDeVDLtNkUEVUgBq2Xb93V6qu77DWhg5mAUs9fi2AgK1tLNR4XP5aT8ww2KP5DF
      //   continue;
      case MeteoraPoolsProgram:
        logger.debug(`<${txId}> is meteora swap`);
        try {
          const parseMeteoraSwapResult = await parseMeteoraSwapTx(
            connection,
            transaction
          );
          if (!parseMeteoraSwapResult) {
            continue;
          }
          result = {
            order: parseMeteoraSwapResult,
            extraData: null,
          };
        } catch (err) {
          logger.debug(err);
          continue;
        }
        break;
      case JupiterAggregatorV6:
        logger.debug(`<${txId}> is jupiter swap`);
        try {
          const parseJupiterSwapResult = await parseJupiterSwapTx(transaction);
          if (!parseJupiterSwapResult) {
            continue;
          }
          result = {
            order: parseJupiterSwapResult,
            extraData: null,
          };
        } catch (err) {
          logger.debug(err);
          continue;
        }
        break;
      case "BSfD6SHZigAfDWSjzD5Q41jw8LmKwtmjskPH9XW1mrRW":
        try {
          const parseResult = await parseTx_BSfD(transaction);
          if (!parseResult) {
            continue;
          }
          result = {
            order: parseResult,
            extraData: null,
          };
        } catch (err) {
          logger.debug(err);
          continue;
        }
        break;
      case PUMP_FUN_PROGRAM.toString():
        logger.debug(`<${txId}> is pump fun swap`);
        try {
          const parsePumpFunSwapResult = await parsePumpFunSwapTx(transaction);
          if (!parsePumpFunSwapResult) {
            continue;
          }
          result = {
            order: parsePumpFunSwapResult,
            extraData: null,
          };
        } catch (err) {
          logger.debug(err);
          continue;
        }
        break;
      default:
        continue;
    }
  }

  return result;
}

export async function parseOrderTransactionByTxId(
  logger: ILogger,
  connection: Connection,
  txId: string
): Promise<{
  order: Order;
  extraData: RaydiumSwapKeys | null;
} | null> {
  logger.debug(`parsing <${txId}>...`);
  const transaction = await getParsedTransaction(connection, txId);

  if (transaction.meta && transaction.meta.err) {
    throw new Error(`失败的交易 <${txId}>. ${inspect(transaction.meta.err)}`);
  }

  return await parseOrderTransaction(logger, connection, transaction);
}
