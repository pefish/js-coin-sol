import { Connection } from "@solana/web3.js";
import "dotenv";
import {
  getAllKeysByPoolAddress,
  getPoolInfoByLPAddress,
  getPoolInfoByTokenAddress,
  getRaydiumSwapInstructions,
  parseRaydiumAddLPTx,
  parseRaydiumSwapTx,
} from ".";
import { getParsedTransaction } from "../solana-web3/ignore429";

describe("util", () => {
  before(async () => {});

  it("getRaydiumSwapInstructions", async () => {
    return;
    const conn = new Connection("https://api.mainnet-beta.solana.com", {
      commitment: "confirmed",
    });
    // [ 'buy', '0.1', 'Avxn1mr2133YnxnyQevCEVGFJNCv55VSWGDn7Rtapump', 800 ]
    const result = await getRaydiumSwapInstructions(
      conn,
      "666666iKjytfqJQS8AjVCRfDU7PDFyUYxh7RTmcNnxDW",
      "buy",
      "FpTEQdi4gZ1DfoNGnNHKYzwUWsUQHuCa7tEwC1Efpump",
      "0.001",
      800,
      {
        ammAddress: "44z5JA4MF7wGEAPoh1CsfuocPHXMP6PkMbaZS9C792tR",
        ammOpenOrdersAddress: "2nPDw4UTA6iPbjB8qg6M3UiXMUTRAUr1UC8BU6xLNcxT",
        ammTargetOrdersAddress: "44G3TqBKG6jrqDKNPUMw1efxt8taEd8oWvhfJ15iRywF",
        poolCoinTokenAccountAddress:
          "Cvycx8Bm2Q9okx29VKPT1YjpN7mc3k4P8u64gsa4Ntws",
        poolPcTokenAccountAddress:
          "79GMXqFNfHozXTRksF2PkG5v5Fu5HRDQrEb8SQPJCYay",
        serumProgramAddress: "srmqPvymJeFKQ4zGQed1GFppgkRHL9kaELCbyksJtPX",
        serumMarketAddress: "Hu9xY7hThMxiP1iREPYbLdFrWbp25bEihnu9jUpmXGTg",
        coinMintAddress: "So11111111111111111111111111111111111111112",
        pcMintAddress: "H3CGsFk57JG6QvWS52nqX8cRXKrn37heo8VY5Z4fpump",
      }
    );
    console.log(result);
  });

  it("parseRaydiumAddLPTx", async () => {
    return;
    const conn = new Connection("https://api.mainnet-beta.solana.com", {
      commitment: "confirmed",
    });
    const tx = await getParsedTransaction(
      conn,
      "2sfuKXa3xxzeBoc1VizZTpVaqM4ruBN1gjEEQGHnSWCgFF3Vcaw79swzpvDuhnx9kHBzQNJo55Gq5s5NSbCJBxpf"
    );
    const result = await parseRaydiumAddLPTx(tx);
    console.log(result);
  });

  it("getPoolInfoByTokenAddress", async () => {
    return;
    const result = await getPoolInfoByTokenAddress(
      "H3CGsFk57JG6QvWS52nqX8cRXKrn37heo8VY5Z4fpump"
    );
    console.log(result);
  });

  it("getPoolInfoByLPAddress", async () => {
    return;
    const result = await getPoolInfoByLPAddress(
      "Ez1a1ME1AaiMe29gxaD3LnVmuEEKULM6rUNWuXLA9jcG"
    );
    console.log(result);
  });

  it("getAllKeysByPoolAddress", async () => {
    return;
    const result = await getAllKeysByPoolAddress(
      "44z5JA4MF7wGEAPoh1CsfuocPHXMP6PkMbaZS9C792tR"
    );
    console.log(result);
  });

  it("parseSwapTx", async () => {
    return;
    const conn = new Connection("https://api.mainnet-beta.solana.com", {
      commitment: "confirmed",
    });
    const tx = await getParsedTransaction(
      conn,
      "2rvSW1fd75xXYtdRw7VscTcKaq6cGkGEG63dYQfTKxR2GpLmepYyEqFJxtCkQXwUfNgLzqbJ4eMieCWRdjnQtg7h"
    );
    const result = await parseRaydiumSwapTx(conn, tx);
    console.log(result);
  });
});
