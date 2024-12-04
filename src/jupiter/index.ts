import { bs58 } from "@coral-xyz/anchor/dist/cjs/utils/bytes";
import { StringUtil } from "@pefish/js-node-assist";
import { publicKey, struct, u128, u64 } from "@raydium-io/raydium-sdk-v2";
import {
  createCloseAccountInstruction,
  getAccount,
  getAssociatedTokenAddressSync,
} from "@solana/spl-token";
import {
  Connection,
  ParsedTransactionWithMeta,
  PartiallyDecodedInstruction,
  PublicKey,
  TransactionInstruction,
} from "@solana/web3.js";
import fetch from "cross-fetch";
import {
  Order,
  OrderType,
  RouterNames,
  SOL_DECIMALS,
  WSOL_ADDRESS,
} from "../constants";
import { PUMP_FUN_TOKEN_DECIMALS } from "../pumpfun/contants";
import { findInnerInstructions, getAllFeeOfTx } from "../util";
import {
  JupiterAggregatorEventAuthority,
  JupiterAggregatorV6,
} from "./contants";

export interface QuoteResponseType {
  inputMint: string;
  inAmount: string;
  outputMint: string;
  outAmount: string;
  otherAmountThreshold: string;
  swapMode: string;
  slippageBps: number;
  platformFee: string | null;
  priceImpactPct: string;
  routePlan: {
    swapInfo: {
      ammKey: string;
      label: string;
      inputMint: string;
      outputMint: string;
      inAmount: string;
      outAmount: string;
      feeAmount: string;
      feeMint: string;
    };
    percent: number;
  }[];
  contextSlot: number;
  timeTaken: number;
}

// pump fun 上面刚出来的币可能获取不到，需要自己构建交易
export async function getSwapInstructionsFromJup(
  connection: Connection,
  userAddress: string,
  type: "buy" | "sell",
  tokenAddress: string,
  amount: string,
  slippage: number,
  isCloseTokenAccount: boolean = false
): Promise<{
  instructions: TransactionInstruction[];
  computeUnits: number;
}> {
  let computeUnits = 40000;

  const tokenAddressPKey = new PublicKey(tokenAddress);
  const userPKey = new PublicKey(userAddress);

  let url = "";
  if (type == "buy") {
    url = `https://quote-api.jup.ag/v6/quote?inputMint=${WSOL_ADDRESS}&outputMint=${tokenAddress}&amount=${StringUtil.start(
      amount
    )
      .shiftedBy(SOL_DECIMALS)
      .remainDecimal(0)
      .toString()}`;
  } else {
    url = `https://quote-api.jup.ag/v6/quote?inputMint=${tokenAddress}&outputMint=${WSOL_ADDRESS}&amount=${StringUtil.start(
      amount
    )
      .shiftedBy(PUMP_FUN_TOKEN_DECIMALS)
      .remainDecimal(0)
      .toString()}`;
  }

  const quoteResponse: QuoteResponseType = await (await fetch(url)).json();

  const res = await fetch("https://quote-api.jup.ag/v6/swap-instructions", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      quoteResponse,
      userPublicKey: userAddress,
      wrapAndUnwrapSol: true,
      dynamicSlippage: {
        minBps: slippage,
        maxBps: slippage * 10,
      },
      // computeUnitPriceMicroLamports: computeUnitPrice,
      //   prioritizationFeeLamports: "auto",
    }),
  });
  const getInstructionsResult = await res.json();

  if (getInstructionsResult.error) {
    throw new Error(
      "Failed to get swap instructions: " + getInstructionsResult.error
    );
  }

  const { setupInstructions, swapInstruction, cleanupInstruction } =
    getInstructionsResult;

  const deserializeInstruction = (instruction: any) => {
    return new TransactionInstruction({
      programId: new PublicKey(instruction.programId),
      keys: instruction.accounts.map((key: any) => ({
        pubkey: new PublicKey(key.pubkey),
        isSigner: key.isSigner,
        isWritable: key.isWritable,
      })),
      data: Buffer.from(instruction.data, "base64"),
    });
  };

  computeUnits += 40000 * setupInstructions.length;

  const instructions = [
    ...setupInstructions.map(deserializeInstruction),
    deserializeInstruction(swapInstruction),
    deserializeInstruction(cleanupInstruction),
  ];

  if (type == "sell") {
    if (isCloseTokenAccount) {
      const tokenAssociatedAccount = getAssociatedTokenAddressSync(
        tokenAddressPKey,
        userPKey,
        false
      );
      const tokenAssociatedAccountInfo = await getAccount(
        connection,
        tokenAssociatedAccount
      );
      const tokenBalance = tokenAssociatedAccountInfo.amount.toString();
      const tokenAmountWithDecimals = StringUtil.start(amount)
        .shiftedBy(PUMP_FUN_TOKEN_DECIMALS)
        .remainDecimal(0)
        .toString();
      const afterBal = StringUtil.start(tokenBalance)
        .sub(tokenAmountWithDecimals)
        .toNumber();
      if (afterBal > 0) {
        throw new Error(
          `After balance <${afterBal}> not be 0, can not closed.`
        );
      }

      instructions.push(
        createCloseAccountInstruction(
          tokenAssociatedAccount,
          userPKey,
          userPKey
        )
      );
    }
  }

  return {
    instructions,
    computeUnits,
  };
}

export async function parseJupiterSwapTx(
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
    if (instruction.programId.toString() != JupiterAggregatorV6) {
      continue;
    }
    const swapInstruction = instruction as PartiallyDecodedInstruction;
    const methodHex = bs58
      .decode(swapInstruction.data)
      .subarray(0, 8)
      .toString("hex");
    if (methodHex != "e517cb977ae3ad2a" && methodHex != "c1209b3341d69c81") {
      continue;
    }
    swapInstru = instruction as PartiallyDecodedInstruction;
    swapInstruIndex = index;
    break;
  }
  if (!swapInstru) {
    return null;
  }

  const jupiterSwapInnerInstructions = findInnerInstructions(
    transaction,
    swapInstruIndex
  ) as PartiallyDecodedInstruction[];

  // 找到 swap 事件。如果有多个 swap 事件，取第一个，其他暂时不管
  let swapEventInnerInstruction: PartiallyDecodedInstruction | null = null;
  for (const jupiterSwapInnerInstruction of jupiterSwapInnerInstructions) {
    if (
      jupiterSwapInnerInstruction.programId.toString() == JupiterAggregatorV6 &&
      jupiterSwapInnerInstruction.accounts.length == 1 &&
      jupiterSwapInnerInstruction.accounts[0].toString() ==
        JupiterAggregatorEventAuthority
    ) {
      swapEventInnerInstruction = jupiterSwapInnerInstruction;
      break;
    }
  }
  if (!swapEventInnerInstruction) {
    throw new Error(
      `<${transaction.transaction.signatures[0]}> Swap event not be found.`
    );
  }

  const swapEventParsedData = struct([
    u128("id"),
    publicKey("amm"),
    publicKey("inputMint"),
    u64("inputAmount"),
    publicKey("outputMint"),
    u64("outputAmount"),
  ]).decode(bs58.decode(swapEventInnerInstruction.data));

  let orderType: OrderType;
  let solAmount: string;
  let tokenAmount: string;
  let tokenAddress: string;
  if (swapEventParsedData.inputMint.toString() == WSOL_ADDRESS) {
    orderType = "buy";
    solAmount = StringUtil.start(swapEventParsedData.inputAmount)
      .unShiftedBy(SOL_DECIMALS)
      .toString();
    tokenAmount = StringUtil.start(swapEventParsedData.outputAmount)
      .unShiftedBy(PUMP_FUN_TOKEN_DECIMALS)
      .toString();
    tokenAddress = swapEventParsedData.outputMint.toString();
  } else {
    orderType = "sell";
    solAmount = StringUtil.start(swapEventParsedData.outputAmount)
      .unShiftedBy(SOL_DECIMALS)
      .toString();
    tokenAmount = StringUtil.start(swapEventParsedData.inputAmount)
      .unShiftedBy(PUMP_FUN_TOKEN_DECIMALS)
      .toString();
    tokenAddress = swapEventParsedData.inputMint.toString();
  }
  const feeInfo = getAllFeeOfTx(transaction);

  return {
    user: transaction.transaction.message.accountKeys[0].pubkey.toString(),
    tx_id: transaction.transaction.signatures[0],
    router: swapEventParsedData.amm.toString(),
    router_name: RouterNames[swapEventParsedData.amm.toString()] || "Unknown",
    type: orderType,
    sol_amount: solAmount,
    token_amount: tokenAmount,
    token_address: tokenAddress,
    fee: feeInfo.totalFee,
    timestamp: transaction.blockTime * 1000,
  };
}
