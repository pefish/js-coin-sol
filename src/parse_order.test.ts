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
      "61Mcyn2FvC4TgSU8QoQjx3R66Sv3y4ARdYai9Bbq91ESvMGe1fXYzemdsPS9FaRdyqh3wJA1BapaQhxD2oQx7Jkk"
    );
    console.log(order);
  });
});
