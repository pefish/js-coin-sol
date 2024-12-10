import { bs58 } from "@coral-xyz/anchor/dist/cjs/utils/bytes";
import { StringUtil } from "@pefish/js-node-assist";
import {
  Connection,
  ParsedAccountData,
  ParsedInstruction,
  ParsedTransactionWithMeta,
  PartiallyDecodedInstruction,
  PublicKey,
} from "@solana/web3.js";
import { Order, OrderType, RouterNames, SOL_DECIMALS } from "../constants";
import { getParsedAccountInfo } from "../solana-web3/ignore429";
import { findInnerInstructions, getAllFeeOfTx } from "../util";
import { MeteoraPoolsProgram, MeteoraSOLVault } from "./contants";

export async function parseMeteoraSwapTx(
  connection: Connection,
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
    if (instruction.programId.toString() != MeteoraPoolsProgram) {
      continue;
    }
    const swapInstruction = instruction as PartiallyDecodedInstruction;
    if (
      bs58.decode(swapInstruction.data).subarray(0, 8).toString("hex") !=
      "f8c69e91e17587c8"
    ) {
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
  );
  // 找到 deposit 和 withdraw 后面的 transfer 指令
  let depositTransferInstru: ParsedInstruction | null = null;
  let withdrawTransferInstru: ParsedInstruction | null = null;
  for (const [
    index,
    swapInnerInstruction_,
  ] of swapInnerInstructions.entries()) {
    const swapInnerInstruction =
      swapInnerInstruction_ as PartiallyDecodedInstruction;
    if (!swapInnerInstruction.data) {
      continue;
    }
    if (
      bs58.decode(swapInnerInstruction.data).subarray(0, 8).toString("hex") ==
      "f223c68952e1f2b6"
    ) {
      depositTransferInstru = swapInnerInstructions[
        index + 1
      ] as ParsedInstruction;
      continue;
    }
    if (
      bs58.decode(swapInnerInstruction.data).subarray(0, 8).toString("hex") ==
      "b712469c946da122"
    ) {
      withdrawTransferInstru = swapInnerInstructions[
        index + 1
      ] as ParsedInstruction;
      continue;
    }
  }
  if (!depositTransferInstru || !withdrawTransferInstru) {
    return null;
  }

  let orderType: OrderType;
  let solAmount: string;
  let tokenAmountWithDecimals: string;
  let tokenVaultAddress: string;
  if (depositTransferInstru.parsed["info"]["destination"] == MeteoraSOLVault) {
    orderType = "buy";
    solAmount = StringUtil.start(depositTransferInstru.parsed["info"]["amount"])
      .unShiftedBy(SOL_DECIMALS)
      .toString();
    tokenAmountWithDecimals = withdrawTransferInstru.parsed["info"]["amount"];
    tokenVaultAddress = withdrawTransferInstru.parsed["info"]["destination"];
  } else {
    orderType = "sell";
    solAmount = StringUtil.start(
      withdrawTransferInstru.parsed["info"]["amount"]
    )
      .unShiftedBy(SOL_DECIMALS)
      .toString();
    tokenAmountWithDecimals = depositTransferInstru.parsed["info"]["amount"];
    tokenVaultAddress = depositTransferInstru.parsed["info"]["destination"];
  }

  const parsedAccountInfo = await getParsedAccountInfo(
    connection,
    new PublicKey(tokenVaultAddress)
  );
  if (!parsedAccountInfo) {
    throw new Error(`tokenVaultAddress <${tokenVaultAddress}> is null.`);
  }
  const accountData = parsedAccountInfo.data as ParsedAccountData;
  const tokenAddress = accountData.parsed["info"]["mint"];
  const tokenDecimals = accountData.parsed["info"]["tokenAmount"][
    "decimals"
  ] as number;

  const feeInfo = getAllFeeOfTx(transaction);

  return {
    router: MeteoraPoolsProgram,
    router_name: RouterNames[MeteoraPoolsProgram],
    user: transaction.transaction.message.accountKeys[0].pubkey.toString(),
    tx_id: transaction.transaction.signatures[0],
    type: orderType,
    sol_amount: solAmount,
    token_amount: StringUtil.start(tokenAmountWithDecimals)
      .unShiftedBy(tokenDecimals)
      .toString(),
    token_address: tokenAddress,
    fee: feeInfo.totalFee,
    timestamp: transaction.blockTime * 1000,
  };
}
