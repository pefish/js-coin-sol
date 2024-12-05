import { Connection } from "@solana/web3.js";
import "dotenv";
import { inspect } from "util";
import { getAssociatedTokenAccountInfo } from "../solana-web3/ignore429";

describe("util", () => {
  before(async () => {});

  it("getAssociatedAccountInfo", async () => {
    return;
    const conn = new Connection("https://api.mainnet-beta.solana.com", {
      commitment: "confirmed",
    });
    const result = await getAssociatedTokenAccountInfo(
      conn,
      "E5nyntnCVRYknAYyW65rQoDyVv8B9M5HZdjYs3ozAMq8"
    );
    console.log(inspect(result));
  });
});
