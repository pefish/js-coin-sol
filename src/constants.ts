import { MeteoraPoolsProgram } from "./meteora/contants";
import { PUMP_FUN_PROGRAM } from "./pumpfun/contants";
import {
  RaydiumConcentratedLiquidity,
  RaydiumLiquidityPoolV4,
} from "./raydium/contants";
import { SolFiRouter } from "./sol-fi/contants";

export const SOL_DECIMALS = 9;
export const WSOL_ADDRESS = "So11111111111111111111111111111111111111112";
export const ORCA_ADDRESS = "whirLbMiicVdio4qvUfM5KAg6Ct8VwpYzGff3uctyCc";
export const ComputeBudgetAddress =
  "ComputeBudget111111111111111111111111111111";

export interface ParsedTokenAccountData {
  info: {
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
  };
  type: string;
}

export interface ParsedTransferTokenData {
  info: {
    amount: string;
    authority: string;
    destination: string;
    source: string;
  };
  type: string;
}

export interface GetParsedAccountInfoData {
  program: string;
  parsed: ParsedTokenAccountData;
  space: number;
}

export type RouterType =
  | "Orca"
  | "PumpFun"
  | "Raydium"
  | "Meteora"
  | "SolFi"
  | "Unknown";

export type OrderType = "buy" | "sell";

export interface Order {
  type: OrderType;
  sol_amount: string;
  token_amount: string;
  tx_id: string;
  router_name: RouterType;
  router: string;
  fee: string;
  token_address: string;
  user: string;
  timestamp: number;
}

export const RouterNames: { [x: string]: RouterType } = {
  [ORCA_ADDRESS]: "Orca",
  [PUMP_FUN_PROGRAM.toString()]: "PumpFun",
  [RaydiumLiquidityPoolV4]: "Raydium",
  [RaydiumConcentratedLiquidity]: "Raydium",
  [MeteoraPoolsProgram]: "Meteora",
  [SolFiRouter]: "SolFi",
};
