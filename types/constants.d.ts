export declare const SOL_DECIMALS = 9;
export declare const WSOL_ADDRESS = "So11111111111111111111111111111111111111112";
export declare const ORCA_ADDRESS = "whirLbMiicVdio4qvUfM5KAg6Ct8VwpYzGff3uctyCc";
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
export type RouterType = "Orca" | "PumpFun" | "Raydium" | "Unknown";
export type OrderType = "buy" | "sell";
export interface Order {
    type: OrderType;
    sol_amount: string;
    token_amount: string;
    tx_id: string;
    router_name: RouterType;
    router: string;
    token_address: string;
    user: string;
}
export declare const routers: {
    [x: string]: RouterType;
};
