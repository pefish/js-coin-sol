import { StringUtil } from "@pefish/js-node-assist";
import { Connection } from "@solana/web3.js";
import "dotenv";
import {
  getPumpFunSwapInstructions,
  parseBondingCurveAddressData,
  parsePumpFunRemoveLiqTx,
  parsePumpFunSwapTx,
} from ".";
import { SOL_DECIMALS } from "../constants";
import { getParsedTransaction } from "../solana-web3/ignore429";

describe("util", () => {
  before(async () => {});

  it("parseBondingCurveAddressData", async () => {
    return;
    const conn = new Connection("https://api.mainnet-beta.solana.com", {
      commitment: "confirmed",
    });
    const bondingCurveInfo = await parseBondingCurveAddressData(
      conn,
      "5HTp1ebDeBcuRaP4J6cG3r4AffbP4dtcrsS7YYT7pump"
    );
    console.log(bondingCurveInfo);
    const solAmountWithDecimals = StringUtil.start("1435.839821")
      .shiftedBy(SOL_DECIMALS)
      .remainDecimal(0)
      .toString();
    const shouldTokenWithDecimals = StringUtil.start(
      bondingCurveInfo.virtualTokenReserves
    )
      .multi(solAmountWithDecimals)
      .div(bondingCurveInfo.virtualSolReserves)
      .toString();
    const tokenAmountWithDecimals = StringUtil.start(shouldTokenWithDecimals)
      .multi(10000 - 1000)
      .div(10000)
      .remainDecimal(0)
      .toString();
    console.log(tokenAmountWithDecimals, solAmountWithDecimals);
  });

  it("getPumpFunSwapInstructions", async () => {
    return;
    const conn = new Connection("https://api.mainnet-beta.solana.com", {
      commitment: "confirmed",
    });
    const pumpFunSwapInstructions = await getPumpFunSwapInstructions(
      conn,
      "666666iKjytfqJQS8AjVCRfDU7PDFyUYxh7RTmcNnxDW",
      "buy",
      "FpTEQdi4gZ1DfoNGnNHKYzwUWsUQHuCa7tEwC1Efpump",
      "0.1",
      800
    );
    console.log(pumpFunSwapInstructions);
  });

  it("parsePumpFunSwapTx", async () => {
    return;
    const conn = new Connection("https://api.mainnet-beta.solana.com", {
      commitment: "confirmed",
    });
    const tx = await getParsedTransaction(
      conn,
      "678Gcg25vuzBfnDgkJtGxWPZbWMreWZ5q9kE5BhBPefKwSLkpd8U1dFHNiq3VHx6hBjumH5iUD2SyH3i6brFBzE4"
    );
    const result = await parsePumpFunSwapTx(tx);
    console.log(result);
  });

  it("parsePumpFunRemoveLiqTx", async () => {
    return;
    const conn = new Connection("https://api.mainnet-beta.solana.com", {
      commitment: "confirmed",
    });
    const tx = await getParsedTransaction(
      conn,
      "5q4r66FuVQYsRH4aNcAPz8Ubc5YpYMwHu4fikBUkXvhC7Pv7JGmWmsRgsCr7yzy379GNfWb7JSqPRjWj1vNa1Kh5"
    );
    const result = await parsePumpFunRemoveLiqTx(conn, tx);
    console.log(result);
  });
});
