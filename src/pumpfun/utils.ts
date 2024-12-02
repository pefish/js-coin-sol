import { bs58 } from "@coral-xyz/anchor/dist/cjs/utils/bytes";
import { struct, u64 } from "@raydium-io/raydium-sdk-v2";
import {
  ComputeBudgetProgram,
  Keypair,
  PublicKey,
  Transaction,
  TransactionInstruction,
} from "@solana/web3.js";

export function getKeyPairFromPrivateKey(key: string) {
  return Keypair.fromSecretKey(new Uint8Array(bs58.decode(key)));
}

export function createTransaction(
  instructions: TransactionInstruction[],
  payer: PublicKey,
  priorityFeeInSol: number = 0,
  latestBlockHash: string
): Transaction {
  const modifyComputeUnits = ComputeBudgetProgram.setComputeUnitLimit({
    units: 1400000,
  });

  const transaction = new Transaction().add(modifyComputeUnits);

  if (priorityFeeInSol > 0) {
    const microLamports = priorityFeeInSol * 1_000_000_000; // convert SOL to microLamports
    const addPriorityFee = ComputeBudgetProgram.setComputeUnitPrice({
      microLamports,
    });
    transaction.add(addPriorityFee);
  }

  transaction.add(...instructions);

  transaction.feePayer = payer;
  transaction.recentBlockhash = latestBlockHash;
  return transaction;
}

export function bufferFromUInt64(value: number | string) {
  let buffer = Buffer.alloc(8);
  buffer.writeBigUInt64LE(BigInt(value));
  return buffer;
}

export function decodeBuyParams(b58Data: string): {
  amount: string;
  maxSolCost: string;
} {
  const schema = struct([u64("padding"), u64("amount"), u64("maxSolCost")]);
  const r = schema.decode(bs58.decode(b58Data));
  return {
    amount: r.amount.toString(),
    maxSolCost: r.maxSolCost.toString(),
  };
}

interface PumpFunPoolInfo {
  mint: string;
  name: string;
  symbol: string;
  description: string;
  image_uri: string;
  video_uri: string;
  metadata_uri: string;
  twitter: string;
  telegram: string | null;
  bonding_curve: string;
  associated_bonding_curve: string;
  creator: string;
  created_timestamp: number;
  raydium_pool: string; // pair address
  complete: boolean;
  virtual_sol_reserves: number;
  virtual_token_reserves: number;
  hidden: boolean | null;
  total_supply: number;
  website: string | null;
  show_name: boolean;
  last_trade_timestamp: number;
  king_of_the_hill_timestamp: number;
  market_cap: number;
  reply_count: number;
  last_reply: number;
  nsfw: boolean;
  market_id: string; // OpenBook 的 PDA 数据账户
  inverted: boolean;
  is_currently_live: boolean;
  username: string;
  profile_image: string | null;
  usd_market_cap: number;
}

// export async function getPumpFunPoolInfo(
//   tokenAddress: string
// ): Promise<PumpFunPoolInfo> {
//   const httpResult: PumpFunPoolInfo[] = await HttpUtil.get(
//     `https://frontend-api.pump.fun/coins?offset=0&limit=1&sort=market_cap&order=DESC&includeNsfw=false&searchTerm=${tokenAddress}`
//   );
//   if (!httpResult || httpResult.length == 0) {
//     return null;
//   }
//   return httpResult[0];
// }
