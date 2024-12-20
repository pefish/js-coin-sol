import { Connection } from "@solana/web3.js";
import "dotenv";
import { getSwapInstructionsFromJup, parseJupiterSwapTx } from ".";
import { getParsedTransaction } from "../solana-web3/ignore429";

describe("util", () => {
  before(async () => {});

  it("getSwapInstructionsFromJup", async () => {
    return;
    const result = await getSwapInstructionsFromJup(
      "666666iKjytfqJQS8AjVCRfDU7PDFyUYxh7RTmcNnxDW",
      "buy",
      "Avxn1mr2133YnxnyQevCEVGFJNCv55VSWGDn7Rtapump",
      "0.1",
      200
    );
    console.log(result);
  });

  it("parseJupiterSwapTx", async () => {
    return;
    const conn = new Connection("https://api.mainnet-beta.solana.com", {
      commitment: "confirmed",
    });
    const tx = await getParsedTransaction(
      conn,
      "4yqgcr3HrTdY66Z7DEobXQH6k6agonArUmwyiEzS9KVnhDCn9FyMbZGiSbkvoZo2vgstgcjfaW9EcMFh59aEqe4o"
    );
    const result = await parseJupiterSwapTx(tx);
    console.log(result);
  });
});
