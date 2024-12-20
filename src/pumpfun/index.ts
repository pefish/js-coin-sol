import { bs58 } from "@coral-xyz/anchor/dist/cjs/utils/bytes";
import HttpUtil from "@pefish/js-http";
import { StringUtil } from "@pefish/js-node-assist";
import {
  bool,
  i64,
  publicKey,
  str,
  struct,
  SYSTEM_PROGRAM_ID,
  u128,
  u64,
} from "@raydium-io/raydium-sdk-v2";
import {
  createAssociatedTokenAccountIdempotentInstruction,
  createCloseAccountInstruction,
  getAccount,
  getAssociatedTokenAddressSync,
  TOKEN_PROGRAM_ID,
} from "@solana/spl-token";
import {
  Connection,
  ParsedTransactionWithMeta,
  PartiallyDecodedInstruction,
  PublicKey,
  TransactionInstruction,
} from "@solana/web3.js";
import { Order, RouterNames, SOL_DECIMALS } from "../constants";
import { getSwapInstructionsFromJup } from "../jupiter";
import {
  getAssociatedTokenAccountInfo,
  getRawAccountInfo,
} from "../solana-web3/ignore429";
import { findInnerInstructions, getAllFeeOfTx } from "../util";
import {
  ASSOC_TOKEN_ACC_PROG,
  FEE_RECIPIENT,
  GLOBAL,
  PUMP_FUN_ACCOUNT,
  PUMP_FUN_PROGRAM,
  PUMP_FUN_TOKEN_DECIMALS,
  RENT,
} from "./contants";
import { bufferFromUInt64 } from "./utils";

export async function parseBondingCurveAddressData(
  connection: Connection,
  bondingCurveAddress: string
): Promise<{
  virtualTokenReserves: string;
  virtualSolReserves: string;
  realTokenReserves: string;
  realSolReserves: string;
  tokenTotalSupply: string;
  complete: boolean;
}> {
  const parsedAccount = await getRawAccountInfo(
    connection,
    new PublicKey(bondingCurveAddress)
  );
  if (!parsedAccount) {
    throw new Error(`bondingCurve <${bondingCurveAddress}> is null.`);
  }
  const schema = struct([
    u64("discriminator"),
    u64("virtualTokenReserves"),
    u64("virtualSolReserves"),
    u64("realTokenReserves"),
    u64("realSolReserves"),
    u64("tokenTotalSupply"),
    bool("complete"),
  ]);
  const r = schema.decode(parsedAccount.data);
  return {
    virtualTokenReserves: r.virtualTokenReserves.toString(),
    virtualSolReserves: r.virtualSolReserves.toString(),
    realTokenReserves: r.realTokenReserves.toString(),
    realSolReserves: r.realSolReserves.toString(),
    tokenTotalSupply: r.tokenTotalSupply.toString(),
    complete: r.complete,
  };
}

export async function getPumpFunSwapInstructions(
  connection: Connection,
  userAddress: string,
  type: "buy" | "sell",
  tokenAddress: string,
  amount: string, // buy 的话就是 sol 的数量，sell 就是 token 的数量
  slippage: number,
  isCloseTokenAccount: boolean = false
): Promise<{
  instructions: TransactionInstruction[];
  computeUnits: number;
}> {
  const instructions: TransactionInstruction[] = [];
  let computeUnits = 40000;

  const tokenAddressPKey = new PublicKey(tokenAddress);
  const userPKey = new PublicKey(userAddress);

  const tokenAssociatedAccount = getAssociatedTokenAddressSync(
    tokenAddressPKey,
    userPKey,
    false
  );

  const bondingCurvePKey = PublicKey.findProgramAddressSync(
    [Buffer.from("bonding-curve"), tokenAddressPKey.toBuffer()],
    new PublicKey(PUMP_FUN_PROGRAM)
  )[0];

  const associatedBondingCurve = getAssociatedTokenAddressSync(
    tokenAddressPKey,
    bondingCurvePKey,
    true
  );

  const keys = [
    { pubkey: GLOBAL, isSigner: false, isWritable: false },
    { pubkey: FEE_RECIPIENT, isSigner: false, isWritable: true },
    { pubkey: tokenAddressPKey, isSigner: false, isWritable: false },
    { pubkey: bondingCurvePKey, isSigner: false, isWritable: true },
    { pubkey: associatedBondingCurve, isSigner: false, isWritable: true },
    { pubkey: tokenAssociatedAccount, isSigner: false, isWritable: true },
    { pubkey: userPKey, isSigner: false, isWritable: true },
    { pubkey: SYSTEM_PROGRAM_ID, isSigner: false, isWritable: false },
  ];

  const bondingCurveInfo = await parseBondingCurveAddressData(
    connection,
    bondingCurvePKey.toString()
  );
  if (bondingCurveInfo.virtualTokenReserves == "0") {
    // 代表这个币已经上岸了，需要使用 raydium
    return await getSwapInstructionsFromJup(
      userAddress,
      type,
      tokenAddress,
      amount,
      slippage
    );
  }

  let data: Buffer;
  let tokenAmountWithDecimals: string;
  if (type == "buy") {
    keys.push(
      ...[
        { pubkey: TOKEN_PROGRAM_ID, isSigner: false, isWritable: false },
        { pubkey: RENT, isSigner: false, isWritable: false },
        { pubkey: PUMP_FUN_ACCOUNT, isSigner: false, isWritable: false },
        { pubkey: PUMP_FUN_PROGRAM, isSigner: false, isWritable: false },
      ]
    );
    const maxSolAmountWithDecimals = StringUtil.start(amount)
      .shiftedBy(SOL_DECIMALS)
      .remainDecimal(0)
      .toString();
    const shouldTokenWithDecimals = StringUtil.start(
      bondingCurveInfo.virtualTokenReserves
    )
      .multi(maxSolAmountWithDecimals)
      .div(bondingCurveInfo.virtualSolReserves)
      .toString();
    tokenAmountWithDecimals = StringUtil.start(shouldTokenWithDecimals)
      .multi(10000 - slippage)
      .div(10000)
      .remainDecimal(0)
      .toString();
    data = Buffer.concat([
      Buffer.from([102, 6, 61, 18, 1, 218, 235, 234]), // 方法的 discriminator
      bufferFromUInt64(tokenAmountWithDecimals),
      bufferFromUInt64(maxSolAmountWithDecimals),
    ]);
  } else {
    keys.push(
      ...[
        { pubkey: ASSOC_TOKEN_ACC_PROG, isSigner: false, isWritable: false },
        { pubkey: TOKEN_PROGRAM_ID, isSigner: false, isWritable: false },
        { pubkey: PUMP_FUN_ACCOUNT, isSigner: false, isWritable: false },
        { pubkey: PUMP_FUN_PROGRAM, isSigner: false, isWritable: false },
      ]
    );
    tokenAmountWithDecimals = StringUtil.start(amount)
      .shiftedBy(PUMP_FUN_TOKEN_DECIMALS)
      .remainDecimal(0)
      .toString();
    const shouldSolWithDecimals = StringUtil.start(
      bondingCurveInfo.virtualSolReserves
    )
      .multi(tokenAmountWithDecimals)
      .div(bondingCurveInfo.virtualTokenReserves)
      .toString();
    const minSolReceivedWithDecimals = StringUtil.start(shouldSolWithDecimals)
      .multi(10000 - slippage)
      .div(10000)
      .remainDecimal(0)
      .toString();
    data = Buffer.concat([
      Buffer.from([51, 230, 133, 164, 1, 127, 131, 173]),
      bufferFromUInt64(tokenAmountWithDecimals),
      bufferFromUInt64(minSolReceivedWithDecimals),
    ]);
  }

  const instruction = new TransactionInstruction({
    keys: keys,
    programId: PUMP_FUN_PROGRAM,
    data: data,
  });

  try {
    await getAccount(connection, tokenAssociatedAccount);
  } catch (e) {
    instructions.push(
      createAssociatedTokenAccountIdempotentInstruction(
        userPKey,
        tokenAssociatedAccount,
        userPKey,
        tokenAddressPKey
      )
    );
    computeUnits += 30000;
  }
  instructions.push(instruction);

  if (type == "sell" && isCloseTokenAccount) {
    instructions.push(
      createCloseAccountInstruction(tokenAssociatedAccount, userPKey, userPKey)
    );
  }

  return {
    instructions,
    computeUnits,
  };
}

export async function parsePumpFunSwapTx(
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
    if (instruction.programId.toString() != PUMP_FUN_PROGRAM.toString()) {
      continue;
    }
    const swapInstruction = instruction as PartiallyDecodedInstruction;
    const methodHex = bs58
      .decode(swapInstruction.data)
      .subarray(0, 8)
      .toString("hex");
    if (methodHex != "66063d1201daebea" && methodHex != "33e685a4017f83ad") {
      continue;
    }
    swapInstru = instruction as PartiallyDecodedInstruction;
    swapInstruIndex = index;
    break;
  }
  if (!swapInstru) {
    return null;
  }

  const pumpfunSwapInnerInstructions = findInnerInstructions(
    transaction,
    swapInstruIndex
  );
  // logger.info(pumpfunSwapInnerInstructions);
  const pumpfunLogInstruction = pumpfunSwapInnerInstructions[
    pumpfunSwapInnerInstructions.length - 1
  ] as PartiallyDecodedInstruction;
  // logger.info(pumpfunLogInstruction);
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
  ]).decode(bs58.decode(pumpfunLogInstruction.data));

  const feeInfo = getAllFeeOfTx(transaction);

  return {
    router: PUMP_FUN_PROGRAM.toString(),
    router_name: RouterNames[PUMP_FUN_PROGRAM.toString()],
    user: transaction.transaction.message.accountKeys[0].pubkey.toString(),
    tx_id: transaction.transaction.signatures[0],
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

export async function parsePumpFunRemoveLiqTx(
  connection: Connection,
  transaction: ParsedTransactionWithMeta
): Promise<{
  destination: string;
  tokenAddress: string;
  associatedSource: string; // bondingCurveAddress
  associatedDestination: string;
  user: string;
  fee: string;
} | null> {
  // 找到调用 withdraw 的指令
  let withdrawInstru: PartiallyDecodedInstruction | null = null;
  for (const [
    index,
    instruction,
  ] of transaction.transaction.message.instructions.entries()) {
    if (instruction.programId.toString() != PUMP_FUN_PROGRAM.toString()) {
      continue;
    }
    const swapInstruction = instruction as PartiallyDecodedInstruction;
    const methodHex = bs58
      .decode(swapInstruction.data)
      .subarray(0, 8)
      .toString("hex");
    if (methodHex != "b712469c946da122") {
      continue;
    }
    withdrawInstru = instruction as PartiallyDecodedInstruction;
    break;
  }
  if (!withdrawInstru) {
    return null;
  }

  const feeInfo = getAllFeeOfTx(transaction);

  const destinationTokenAccount = withdrawInstru.accounts[5].toString();
  const associatedDestinationInfo = await getAssociatedTokenAccountInfo(
    connection,
    destinationTokenAccount
  );
  if (!associatedDestinationInfo) {
    throw new Error(
      `destinationTokenAccount <${destinationTokenAccount}> is null.`
    );
  }

  return {
    associatedSource: withdrawInstru.accounts[4].toString(),
    associatedDestination: withdrawInstru.accounts[5].toString(),
    destination: associatedDestinationInfo.owner.toString(),
    tokenAddress: associatedDestinationInfo.mint.toString(),
    user: transaction.transaction.message.accountKeys[0].pubkey.toString(),
    fee: feeInfo.totalFee,
  };
}

export interface TokenMetadata {
  name: string;
  symbol: string;
  description: string;
  image: string;
  showName: boolean;
  createdOn: string;
  twitter: string;
  telegram: string;
  website: string;
}

export async function parsePumpFunCreateTx(
  parsedTx: ParsedTransactionWithMeta
): Promise<{
  symbol: string;
  name: string;
  uri: string;
  tokenAddress: string;
  bondingCurve: string;
  creator: string;
  metadata: TokenMetadata;
} | null> {
  const instructions = parsedTx.transaction.message.instructions;
  // 找到调用 create 的指令
  let createInstru: PartiallyDecodedInstruction | null = null;
  let createInstruIndex = 0;
  for (const [index, instruction] of instructions.entries()) {
    const instru = instruction as PartiallyDecodedInstruction;
    if (
      instru.data &&
      instruction.programId.toString() == PUMP_FUN_PROGRAM.toString() &&
      bs58.decode(instru.data).subarray(0, 8).toString("hex") ==
        "181ec828051c0777"
    ) {
      createInstru = instru;
      createInstruIndex = index;
      // const createEventParsedData = struct([
      //   u64("id"),
      //   str("name"),
      //   str("symbol"),
      //   str("uri"),
      // ]).decode(bs58.decode(instru.data));
      // console.log(createEventParsedData);

      break;
    }
  }
  if (!createInstru) {
    return null;
  }

  // 找到创建成功后的事件
  const createInnerInstructions = findInnerInstructions(
    parsedTx,
    createInstruIndex
  ) as PartiallyDecodedInstruction[];

  let createEventInnerInstruction: PartiallyDecodedInstruction | null = null;
  for (const createInnerInstruction of createInnerInstructions) {
    if (
      createInnerInstruction.programId.toString() ==
        PUMP_FUN_PROGRAM.toString() &&
      createInnerInstruction.accounts.length == 1 &&
      createInnerInstruction.accounts[0].toString() ==
        "Ce6TQqeHC9p8KetsN6JsjHK7UTZk7nasjjnr7XxXp9F1"
    ) {
      createEventInnerInstruction = createInnerInstruction;
      break;
    }
  }
  if (!createEventInnerInstruction) {
    return null;
  }

  const createEventParsedData = struct([
    u128("id"),
    str("name"),
    str("symbol"),
    str("uri"),
    publicKey("mint"),
    publicKey("bondingCurve"),
    publicKey("user"),
  ]).decode(bs58.decode(createEventInnerInstruction.data));

  const metadata = await HttpUtil.get(createEventParsedData.uri);

  return {
    symbol: createEventParsedData.symbol,
    name: createEventParsedData.name,
    uri: createEventParsedData.uri,
    tokenAddress: createEventParsedData.mint.toString(),
    bondingCurve: createEventParsedData.bondingCurve.toString(),
    creator: createEventParsedData.user.toString(),
    metadata: metadata,
  };
}
