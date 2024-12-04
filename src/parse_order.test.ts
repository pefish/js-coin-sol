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
      "2ztcxgSRtiQHT2gfUyQiHk7UTW8ti1Bbov9nXecBYGKREPXUEgrzV2XMKkiSYRsymLW4kwmf1n6P8sT9byZ4pNVt"
    );
    console.log(order);
  });
});
