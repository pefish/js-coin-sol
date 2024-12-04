import { bs58 } from "@coral-xyz/anchor/dist/cjs/utils/bytes";
import HttpUtil from "@pefish/js-http";
import { StringUtil } from "@pefish/js-node-assist";
import { struct, u64, u8 } from "@raydium-io/raydium-sdk-v2";
import {
  createAssociatedTokenAccountIdempotentInstruction,
  createCloseAccountInstruction,
  createSyncNativeInstruction,
  getAssociatedTokenAddressSync,
  TOKEN_PROGRAM_ID,
} from "@solana/spl-token";
import {
  Connection,
  ParsedAccountData,
  ParsedInstruction,
  ParsedTransactionWithMeta,
  PartiallyDecodedInstruction,
  PublicKey,
  SystemProgram,
  TransactionInstruction,
} from "@solana/web3.js";
import {
  Order,
  OrderType,
  ParsedTransferTokenData,
  RouterNames,
  SOL_DECIMALS,
  WSOL_ADDRESS,
} from "../constants";
import { PUMP_FUN_TOKEN_DECIMALS } from "../pumpfun/contants";
import { bufferFromUInt64 } from "../pumpfun/utils";
import {
  getMultipleParsedAccounts,
  getParsedAccountInfo,
  getParsedTransaction,
  getSignaturesForAddress,
} from "../solana-web3/ignore429";
import { findInnerInstructions, getAllFeeOfTx } from "../util";
import { RaydiumAuthorityV4, RaydiumLiquidityPoolV4 } from "./contants";

// 通过 /pools/info/lps 拿到 pool id。这里有问题，一开始根本请求不到，大概几分钟后才能请求到
// https://api-v3.raydium.io/pools/info/mint?mint1={{token address}}&poolType=all&poolSortField=liquidity&sortType=desc&pageSize=100&page=1
// https://api-v3.raydium.io/pools/info/ids?ids={{pool id}}
// https://api-v3.raydium.io/pools/info/lps?lps={{lp token address}}

interface PoolInfoToken {
  address: string;
  logoURI: string;
  symbol: string;
  name: string;
  decimals: number;
}

interface PriceInfo {
  volume: number;
  volumeQuote: number;
  volumeFee: number;
  apr: number;
  feeApr: number;
  priceMin: number;
  priceMax: number;
  rewardApr: any[];
}

export interface KeysInfo {
  programId: string;
  id: string;
  mintA: {
    chainId: number;
    address: string;
    programId: string;
    logoURI: string;
    symbol: string;
    name: string;
    decimals: number;
    tags: string[];
    extensions: {};
  };
  mintB: {
    chainId: number;
    address: string;
    programId: string;
    logoURI: string;
    symbol: string;
    name: string;
    decimals: number;
    tags: string[];
    extensions: {};
  };
  lookupTableAccount: string;
  openTime: string;
  vault: {
    A: string;
    B: string;
  };
  authority: string;
  openOrders: string;
  targetOrders: string;
  mintLp: {
    chainId: number;
    address: string;
    programId: string;
    logoURI: string;
    symbol: string;
    name: string;
    decimals: number;
    tags: string[];
    extensions: {};
  };
  marketProgramId: string;
  marketId: string;
  marketAuthority: string;
  marketBaseVault: string;
  marketQuoteVault: string;
  marketBids: string;
  marketAsks: string;
  marketEventQueue: string;
}

export interface PoolInfo {
  type: string;
  programId: string;
  id: string; // pool id
  mintA: PoolInfoToken;
  mintB: PoolInfoToken;
  price: number;
  mintAmountA: number;
  mintAmountB: number;
  feeRate: number;
  openTime: string;
  tvl: number;
  day: PriceInfo;
  week: PriceInfo;
  month: PriceInfo;
  pooltype: string[];

  marketId: string; // OpenBookMarket id
  lpMint: PoolInfoToken; // lp address
  lpPrice: number;
  lpAmount: number;
  burnPercent: number;
}

export async function getPoolInfoByLPAddress(
  lpAddress: string
): Promise<PoolInfo> {
  const httpResult: {
    success: boolean;
    data: PoolInfo[];
  } = await HttpUtil.get(
    `https://api-v3.raydium.io/pools/info/lps?lps=${lpAddress}`
  );
  if (!httpResult.success) {
    throw new Error("/pools/info/lps 请求失败");
  }
  return httpResult.data[0];
}

export async function getAllKeysByPoolAddress(
  address: string
): Promise<KeysInfo> {
  const httpResult: {
    success: boolean;
    data: KeysInfo[];
  } = await HttpUtil.get(
    `https://api-v3.raydium.io/pools/key/ids?ids=${address}`
  );
  if (!httpResult.success) {
    throw new Error("/pools/key/ids 请求失败");
  }
  return httpResult.data[0];
}

export async function getPoolInfoByTokenAddress(
  tokenAddress: string
): Promise<PoolInfo> {
  const httpResult: {
    success: boolean;
    data: {
      count: number;
      data: PoolInfo[];
    };
  } = await HttpUtil.get(
    `https://api-v3.raydium.io/pools/info/mint?mint1=${tokenAddress}&poolType=all&poolSortField=liquidity&sortType=desc&pageSize=100&page=1`
  );
  if (!httpResult.success) {
    throw new Error("/pools/info/mint 请求失败");
  }
  return httpResult.data.data[0];
}

export interface RaydiumSwapKeys {
  ammAddress: string;
  ammOpenOrdersAddress?: string;
  ammTargetOrdersAddress?: string;
  poolCoinTokenAccountAddress: string;
  poolPcTokenAccountAddress: string;
  serumProgramAddress?: string;
  serumMarketAddress?: string;
  serumBidsAddress?: string;
  serumAsksAddress?: string;
  serumEventQueueAddress?: string;
  serumCoinVaultAccountAddress?: string;
  serumPcVaultAccountAddress?: string;
  serumVaultSignerAddress?: string;
  coinMintAddress: string;
  pcMintAddress: string;
}

export async function getRaydiumSwapInstructions(
  connection: Connection,
  userAddress: string,
  type: "buy" | "sell",
  tokenAddress: string,
  amount: string, // buy 的话就是 sol 的数量，sell 就是 token 的数量
  slippage: number,
  raydiumPoolInfo: RaydiumSwapKeys,
  isCloseTokenAccount: boolean = false
): Promise<{
  instructions: TransactionInstruction[];
  computeUnits: number;
}> {
  let computeUnits = 30000;
  const instructions: TransactionInstruction[] = [];

  const tokenAddressPKey = new PublicKey(tokenAddress);
  const userPKey = new PublicKey(userAddress);

  const wsolAssociatedAccount = getAssociatedTokenAddressSync(
    new PublicKey(WSOL_ADDRESS),
    userPKey,
    false
  );

  const tokenAssociatedAccount = getAssociatedTokenAddressSync(
    tokenAddressPKey,
    userPKey,
    false
  );

  const [
    wsolAssociatedAccountInfo,
    tokenAssociatedAccountInfo,
    poolCoinTokenAccountInfo,
    poolPcTokenAccountInfo,
  ] = await getMultipleParsedAccounts(connection, [
    wsolAssociatedAccount,
    tokenAssociatedAccount,
    new PublicKey(raydiumPoolInfo.poolCoinTokenAccountAddress),
    new PublicKey(raydiumPoolInfo.poolPcTokenAccountAddress),
  ]);

  if (!poolCoinTokenAccountInfo || !poolPcTokenAccountInfo) {
    throw new Error(
      "poolCoinTokenAccountInfo or poolPcTokenAccountInfo not found"
    );
  }

  const keys = [
    { pubkey: TOKEN_PROGRAM_ID, isSigner: false, isWritable: false },
    {
      pubkey: new PublicKey(raydiumPoolInfo.ammAddress || WSOL_ADDRESS),
      isSigner: false,
      isWritable: true,
    },
    {
      pubkey: new PublicKey(RaydiumAuthorityV4),
      isSigner: false,
      isWritable: false,
    },
    {
      pubkey: new PublicKey(
        raydiumPoolInfo.ammOpenOrdersAddress || WSOL_ADDRESS
      ),
      isSigner: false,
      isWritable: true,
    },
    {
      pubkey: new PublicKey(
        raydiumPoolInfo.ammTargetOrdersAddress || WSOL_ADDRESS
      ),
      isSigner: false,
      isWritable: true,
    },
    {
      pubkey: new PublicKey(
        raydiumPoolInfo.poolCoinTokenAccountAddress || WSOL_ADDRESS
      ),
      isSigner: false,
      isWritable: true,
    },
    {
      pubkey: new PublicKey(
        raydiumPoolInfo.poolPcTokenAccountAddress || WSOL_ADDRESS
      ),
      isSigner: false,
      isWritable: true,
    },
    {
      pubkey: new PublicKey(
        raydiumPoolInfo.serumProgramAddress || WSOL_ADDRESS
      ),
      isSigner: false,
      isWritable: false,
    },
    {
      pubkey: new PublicKey(raydiumPoolInfo.serumMarketAddress || WSOL_ADDRESS),
      isSigner: false,
      isWritable: true,
    },
    {
      pubkey: new PublicKey(raydiumPoolInfo.serumBidsAddress || WSOL_ADDRESS),
      isSigner: false,
      isWritable: true,
    },
    {
      pubkey: new PublicKey(raydiumPoolInfo.serumAsksAddress || WSOL_ADDRESS),
      isSigner: false,
      isWritable: true,
    },
    {
      pubkey: new PublicKey(
        raydiumPoolInfo.serumEventQueueAddress || WSOL_ADDRESS
      ),
      isSigner: false,
      isWritable: true,
    },
    {
      pubkey: new PublicKey(
        raydiumPoolInfo.serumCoinVaultAccountAddress || WSOL_ADDRESS
      ),
      isSigner: false,
      isWritable: true,
    },
    {
      pubkey: new PublicKey(
        raydiumPoolInfo.serumPcVaultAccountAddress || WSOL_ADDRESS
      ),
      isSigner: false,
      isWritable: true,
    },
    {
      pubkey: new PublicKey(
        raydiumPoolInfo.serumVaultSignerAddress || WSOL_ADDRESS
      ),
      isSigner: false,
      isWritable: false,
    },
  ];

  let data: Buffer;
  const coinAccountData = poolCoinTokenAccountInfo.data as ParsedAccountData;
  const pcAccountData = poolPcTokenAccountInfo.data as ParsedAccountData;
  const solReservesWithDecimals =
    coinAccountData.parsed["info"]["tokenAmount"]["amount"];
  const tokenReservesWithDecimals =
    pcAccountData.parsed["info"]["tokenAmount"]["amount"];

  let tokenAmountWithDecimals: string = "0";
  if (type == "buy") {
    keys.push(
      ...[
        { pubkey: wsolAssociatedAccount, isSigner: false, isWritable: true },
        { pubkey: tokenAssociatedAccount, isSigner: false, isWritable: true },
        { pubkey: userPKey, isSigner: true, isWritable: false },
      ]
    );

    const solAmountWithDecimals = StringUtil.start(amount)
      .shiftedBy(SOL_DECIMALS)
      .remainDecimal(0)
      .toString();
    const shouldTokenWithDecimals = StringUtil.start(tokenReservesWithDecimals)
      .multi(solAmountWithDecimals)
      .div(solReservesWithDecimals)
      .toString();
    const minTokenAmountWithDecimals = StringUtil.start(shouldTokenWithDecimals)
      .multi(10000 - slippage)
      .div(10000)
      .remainDecimal(0)
      .toString();
    data = Buffer.concat([
      Buffer.from([9]), // 方法的 discriminator
      bufferFromUInt64(solAmountWithDecimals),
      bufferFromUInt64(minTokenAmountWithDecimals),
    ]);
  } else {
    keys.push(
      ...[
        { pubkey: tokenAssociatedAccount, isSigner: false, isWritable: true },
        { pubkey: wsolAssociatedAccount, isSigner: false, isWritable: true },
        { pubkey: userPKey, isSigner: true, isWritable: false },
      ]
    );
    tokenAmountWithDecimals = StringUtil.start(amount)
      .shiftedBy(PUMP_FUN_TOKEN_DECIMALS)
      .remainDecimal(0)
      .toString();
    const shouldSolWithDecimals = StringUtil.start(solReservesWithDecimals)
      .multi(tokenAmountWithDecimals)
      .div(tokenReservesWithDecimals)
      .toString();
    const minSolReceivedWithDecimals = StringUtil.start(shouldSolWithDecimals)
      .multi(10000 - slippage)
      .div(10000)
      .remainDecimal(0)
      .toString();
    data = Buffer.concat([
      Buffer.from([9]),
      bufferFromUInt64(tokenAmountWithDecimals),
      bufferFromUInt64(minSolReceivedWithDecimals),
    ]);
  }

  // wsol token account 不存在，创建
  if (!wsolAssociatedAccountInfo) {
    instructions.push(
      createAssociatedTokenAccountIdempotentInstruction(
        userPKey,
        wsolAssociatedAccount,
        userPKey,
        new PublicKey(WSOL_ADDRESS)
      )
    );
    computeUnits += 30000;
  }

  // 充值 wsol
  if (type == "buy") {
    instructions.push(
      ...[
        SystemProgram.transfer({
          fromPubkey: userPKey,
          toPubkey: wsolAssociatedAccount,
          lamports: BigInt(
            StringUtil.start(amount).shiftedBy(SOL_DECIMALS).toString()
          ),
        }),
        createSyncNativeInstruction(wsolAssociatedAccount),
      ]
    );
  }

  // token token account 不存在，创建
  if (!tokenAssociatedAccountInfo) {
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

  instructions.push(
    new TransactionInstruction({
      keys: keys,
      programId: new PublicKey(RaydiumLiquidityPoolV4),
      data: data,
    })
  );

  if (type == "sell") {
    // 关闭 wsol token account，买其实不用关闭（下次买可以节省网络费）
    instructions.push(
      createCloseAccountInstruction(wsolAssociatedAccount, userPKey, userPKey)
    );

    if (isCloseTokenAccount) {
      if (!tokenAssociatedAccountInfo) {
        throw new Error(
          "Order is sell, but tokenAssociatedAccountInfo not found."
        );
      }
      const tokenBalance = (
        tokenAssociatedAccountInfo.data as ParsedAccountData
      ).parsed["info"]["tokenAmount"]["amount"];
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

export async function getLPInfoFromLpAddress(
  connection: Connection,
  lpAddress: string
): Promise<{
  tokenAddress: string;
  initTokenAmountInLP: string;
  initSOLAmountInLP: string;
} | null> {
  const signatureInfos = await getSignaturesForAddress(
    connection,
    new PublicKey(lpAddress),
    {
      limit: 5,
    },
    "confirmed"
  );
  for (let i = signatureInfos.length - 1; i > 0; i--) {
    let parsedTx: ParsedTransactionWithMeta = await getParsedTransaction(
      connection,
      signatureInfos[i].signature
    );
    const r = await parseRaydiumAddLPTx(parsedTx);
    if (r == null) {
      continue;
    }
    return r;
  }
  return null;
}

export interface RaydiumPoolKeys {
  ammAddress: string;
  ammOpenOrdersAddress: string;
  lpAddress: string;
  coinMintAddress: string;
  pcMintAddress: string;
  poolCoinTokenAccountAddress: string;
  poolPcTokenAccountAddress: string;
  poolWithdrawQueueAddress: string;
  ammTargetOrdersAddress: string;
  poolTempLpAddress: string;
  serumProgramAddress: string;
  serumMarketAddress: string;
}

export async function parseRaydiumAddLPTx(
  parsedTx: ParsedTransactionWithMeta
): Promise<{
  tokenAddress: string;
  initTokenAmountInLP: string;
  initSOLAmountInLP: string;
  solPoolAddress: string;
  tokenPoolAddress: string;
  raydiumPoolKeys: RaydiumPoolKeys;
} | null> {
  const instructions = parsedTx.transaction.message.instructions;

  // 找到调用 RaydiumLiquidityPoolV4 的指令
  let raydiumLiquidityPoolV4Instru: PartiallyDecodedInstruction | null = null;
  for (const instruction of instructions) {
    if (instruction.programId.toString() != RaydiumLiquidityPoolV4) {
      continue;
    }
    const swapInstruction = instruction as PartiallyDecodedInstruction;
    if (
      bs58.decode(swapInstruction.data).subarray(0, 1).toString("hex") != "01"
    ) {
      continue;
    }
    raydiumLiquidityPoolV4Instru = instruction as PartiallyDecodedInstruction;
    break;
  }
  if (!raydiumLiquidityPoolV4Instru) {
    return null;
  }

  const accounts: PublicKey[] = raydiumLiquidityPoolV4Instru.accounts;
  if (accounts.length < 10) {
    return null;
  }
  const schema = struct([
    u8("discriminator"),
    u8("nonce"),
    u64("openTime"),
    u64("initPcAmount"),
    u64("initCoinAmount"),
  ]);
  const r = schema.decode(bs58.decode(raydiumLiquidityPoolV4Instru.data));
  let tokenAddress: string;
  let tokenAmount: string;
  let solAmount: string;
  let solPoolAddress: string;
  let tokenPoolAddress: string;
  if (accounts[9].toString() == WSOL_ADDRESS) {
    // pc is sol, coin is token
    solPoolAddress = accounts[11].toString();
    tokenPoolAddress = accounts[10].toString();
    tokenAddress = accounts[8].toString();
    tokenAmount = StringUtil.start(r.initCoinAmount)
      .unShiftedBy(PUMP_FUN_TOKEN_DECIMALS)
      .toString();
    solAmount = StringUtil.start(r.initPcAmount)
      .unShiftedBy(SOL_DECIMALS)
      .toString();
  } else {
    solPoolAddress = accounts[10].toString();
    tokenPoolAddress = accounts[11].toString();
    tokenAddress = accounts[9].toString();
    tokenAmount = StringUtil.start(r.initPcAmount)
      .unShiftedBy(PUMP_FUN_TOKEN_DECIMALS)
      .toString();
    solAmount = StringUtil.start(r.initCoinAmount)
      .unShiftedBy(SOL_DECIMALS)
      .toString();
  }
  return {
    tokenAddress: tokenAddress,
    initSOLAmountInLP: solAmount,
    initTokenAmountInLP: tokenAmount,
    tokenPoolAddress,
    solPoolAddress,
    raydiumPoolKeys: {
      ammAddress: accounts[4].toString(),
      ammOpenOrdersAddress: accounts[6].toString(),
      lpAddress: accounts[7].toString(),
      coinMintAddress: accounts[8].toString(),
      pcMintAddress: accounts[9].toString(),
      poolCoinTokenAccountAddress: accounts[10].toString(),
      poolPcTokenAccountAddress: accounts[11].toString(),
      poolWithdrawQueueAddress: accounts[12].toString(),
      ammTargetOrdersAddress: accounts[13].toString(),
      poolTempLpAddress: accounts[14].toString(),
      serumProgramAddress: accounts[15].toString(),
      serumMarketAddress: accounts[16].toString(),
    },
  };
}

export async function parseRaydiumSwapTx(
  connection: Connection,
  transaction: ParsedTransactionWithMeta
): Promise<{
  orderInfo: Order;
  raydiumSwapKeys: RaydiumSwapKeys;
} | null> {
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
    if (instruction.programId.toString() != RaydiumLiquidityPoolV4) {
      continue;
    }
    const swapInstruction = instruction as PartiallyDecodedInstruction;
    if (
      bs58.decode(swapInstruction.data).subarray(0, 1).toString("hex") != "09"
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

  const raydiumSwapInnerInstructions = findInnerInstructions(
    transaction,
    swapInstruIndex
  );
  // logger.info(raydiumSwapInnerInstructions);
  const transferParsedData0: ParsedTransferTokenData = (
    raydiumSwapInnerInstructions[0] as ParsedInstruction
  ).parsed;
  const transferParsedData1: ParsedTransferTokenData = (
    raydiumSwapInnerInstructions[1] as ParsedInstruction
  ).parsed;
  let tokenPoolAddress: string;
  let orderType: OrderType;
  let solAmount: string;
  let tokenAmount: string;

  const poolCoinTokenAccountAddress = swapInstru.accounts[5].toString();
  if (transferParsedData0.info.destination == poolCoinTokenAccountAddress) {
    orderType = "buy";
    solAmount = StringUtil.start(transferParsedData0.info.amount)
      .unShiftedBy(SOL_DECIMALS)
      .toString();
    tokenAmount = StringUtil.start(transferParsedData1.info.amount)
      .unShiftedBy(PUMP_FUN_TOKEN_DECIMALS)
      .toString();
    tokenPoolAddress = transferParsedData1.info.source;
  } else {
    orderType = "sell";
    solAmount = StringUtil.start(transferParsedData1.info.amount)
      .unShiftedBy(SOL_DECIMALS)
      .toString();
    tokenAmount = StringUtil.start(transferParsedData0.info.amount)
      .unShiftedBy(PUMP_FUN_TOKEN_DECIMALS)
      .toString();
    tokenPoolAddress = transferParsedData0.info.destination;
  }

  const parsedAccountInfo = await getParsedAccountInfo(
    connection,
    new PublicKey(tokenPoolAddress)
  );
  const accountData = parsedAccountInfo.data as ParsedAccountData;
  const tokenAddress = accountData.parsed["info"]["mint"];

  const feeInfo = getAllFeeOfTx(transaction);

  return {
    orderInfo: {
      router: RaydiumLiquidityPoolV4,
      router_name: RouterNames[RaydiumLiquidityPoolV4],
      user: transaction.transaction.message.accountKeys[0].pubkey.toString(),
      tx_id: transaction.transaction.signatures[0],
      type: orderType,
      sol_amount: solAmount,
      token_amount: tokenAmount,
      token_address: tokenAddress,
      fee: feeInfo.totalFee,
      timestamp: transaction.blockTime * 1000,
    },
    raydiumSwapKeys: {
      ammAddress: swapInstru.accounts[1].toString(),
      ammOpenOrdersAddress: swapInstru.accounts[3].toString(),
      ammTargetOrdersAddress: swapInstru.accounts[4].toString(),
      poolCoinTokenAccountAddress: poolCoinTokenAccountAddress,
      poolPcTokenAccountAddress: swapInstru.accounts[6].toString(),
      serumProgramAddress: swapInstru.accounts[7].toString(),
      serumMarketAddress: swapInstru.accounts[8].toString(),
      serumBidsAddress: swapInstru.accounts[9].toString(),
      serumAsksAddress: swapInstru.accounts[10].toString(),
      serumEventQueueAddress: swapInstru.accounts[11].toString(),
      serumCoinVaultAccountAddress: swapInstru.accounts[12].toString(),
      serumPcVaultAccountAddress: swapInstru.accounts[13].toString(),
      serumVaultSignerAddress: swapInstru.accounts[14].toString(),
      coinMintAddress: WSOL_ADDRESS,
      pcMintAddress: tokenAddress,
    },
  };
}

export async function getTokenPrice(
  connection: Connection,
  solVaultAddress: string,
  tokenVaultAddress: string
): Promise<string> {
  const parsedAccounts = await getMultipleParsedAccounts(connection, [
    new PublicKey(solVaultAddress),
    new PublicKey(tokenVaultAddress),
  ]);

  if (!parsedAccounts[0]) {
    throw new Error(`SOL vault address <${solVaultAddress}> not found.`);
  }

  if (!parsedAccounts[1]) {
    throw new Error(`Token vault address <${tokenVaultAddress}> not found.`);
  }

  const solAmount = (parsedAccounts[0].data as ParsedAccountData).parsed[
    "info"
  ]["tokenAmount"]["uiAmount"];

  const tokenAmount = (parsedAccounts[1].data as ParsedAccountData).parsed[
    "info"
  ]["tokenAmount"]["uiAmount"];

  return StringUtil.start(solAmount).div(tokenAmount).toString();
}
