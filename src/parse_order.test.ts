import { Logger } from "@pefish/js-logger";
import { Connection } from "@solana/web3.js";
import { parseOrderTransactionByTxId } from "./parse_order";

describe("util", () => {
  before(async () => {});

  it("parseOrderTransactionByTxId", async () => {
    return;
    const order = await parseOrderTransactionByTxId(
      new Logger(),
      new Connection("https://api.mainnet-beta.solana.com", {
        commitment: "confirmed",
      }),
      "2nrp1xwcXjf3mxb82urtt362DKL8brQrDnTXyqTxjC1fL1hDnruNWtX9b11uro33gvVms3X3ELBRGhYq5FBzgiJ2"
    );
    console.log(order);
  });
});
