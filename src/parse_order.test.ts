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
      "2eNwUjKhfoWJ1X5cJM4CxGgWkcKToqzwmYe2uXxdXAoemZt9K19m5dtDD3tX2uuzQD1aS9GL2AaHj5pqhLBVGS79"
    );
    console.log(order);
  });
});
