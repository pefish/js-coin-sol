import { Logger } from "@pefish/js-logger";
import { Connection } from "@solana/web3.js";
import "dotenv";
import { getParsedTransaction } from "./solana-web3/ignore429";
import {
  estimateComputeUnitPrice,
  getAllFeeOfTx,
  getTokenMetadata,
  placeOrder,
} from "./util";

describe("util", () => {
  before(async () => {});

  it("getTokenMetadata", async () => {
    return;
    const conn = new Connection("https://api.mainnet-beta.solana.com", {
      commitment: "confirmed",
    });
    const result = await getTokenMetadata(
      conn,
      "LoxQiS7XLhbtZsdYFCSKjjGPfu4En6pdoerRuTzpump"
    );
    console.log(result);
  });

  it("estimateComputeUnitPrice", async () => {
    return;
    const conn = new Connection("https://api.mainnet-beta.solana.com", {
      commitment: "confirmed",
    });
    const result = await estimateComputeUnitPrice(conn, [
      "5BnsHy3CV2SjefwMPQ4pwQPVmigxA8R7gUZypRNsZqxp",
      "8542PR4Dfhj5guFMhFJdGTrY79oSf47CApKdKtovW1X9",
      "3ctawuF6FhF4deLVgr2LGysmY1pctmeZ4vdzX4dW2sMt",
      "44z5JA4MF7wGEAPoh1CsfuocPHXMP6PkMbaZS9C792tR",
      "2nPDw4UTA6iPbjB8qg6M3UiXMUTRAUr1UC8BU6xLNcxT",
      "44G3TqBKG6jrqDKNPUMw1efxt8taEd8oWvhfJ15iRywF",
      "Cvycx8Bm2Q9okx29VKPT1YjpN7mc3k4P8u64gsa4Ntws",
    ]);
    console.log(result);
  });

  it("placeOrder raydium buy", async () => {
    return;
    const conn = new Connection("https://api.mainnet-beta.solana.com", {
      commitment: "confirmed",
    });
    const result = await placeOrder(
      new Logger(),
      conn,
      process.env["PRIV"] || "",
      "buy",
      "0.0001",
      "GvvGuUFnKtsBswuQqeXhTDKB1KXLNHVw522idugTpump",
      "Raydium",
      {
        nodeUrls: ["https://api.mainnet-beta.solana.com"],
        slippage: 200,
        raydiumSwapKeys: {
          ammAddress: "BZePuemCXpAuimM2ahCTYep6cxAaKihQEb8CjJeRSUqY",
          poolCoinTokenAccountAddress:
            "9kKWxwdyuooNYFsEeygdL5LsDuy7WrfBBms7rqazirqG",
          poolPcTokenAccountAddress:
            "6Kww3cBGTpctuye8TJk44ksppRhCvpkqfvKHk9BxWxmi",
          coinMintAddress: "So11111111111111111111111111111111111111112",
          pcMintAddress: "GvvGuUFnKtsBswuQqeXhTDKB1KXLNHVw522idugTpump",
        },
      }
    );
    console.log(result);
  });

  it("placeOrder pumpfun buy", async () => {
    return;
    const conn = new Connection("https://api.mainnet-beta.solana.com", {
      commitment: "confirmed",
    });
    const result = await placeOrder(
      new Logger(),
      conn,
      process.env["PRIV"] || "",
      "buy",
      "0.0001",
      "8xbg3t7kWRxMHGtXZA3De88aScL2zEYoxzfGKicipump",
      "PumpFun",
      {
        nodeUrls: ["https://api.mainnet-beta.solana.com"],
        slippage: 200,
      }
    );
    console.log(result);
  });

  it("placeOrder pumpfun sell", async () => {
    return;
    const conn = new Connection("https://api.mainnet-beta.solana.com", {
      commitment: "confirmed",
    });
    const result = await placeOrder(
      new Logger(),
      conn,
      process.env["PRIV"] || "",
      "sell",
      "3282.642648",
      "8xbg3t7kWRxMHGtXZA3De88aScL2zEYoxzfGKicipump",
      "PumpFun",
      {
        nodeUrls: ["https://api.mainnet-beta.solana.com"],
        slippage: 200,
        isCloseTokenAccount: true,
      }
    );
    console.log(result);
  });

  it("placeOrder raydium sell", async () => {
    return;
    const conn = new Connection("https://api.mainnet-beta.solana.com", {
      commitment: "confirmed",
    });
    const result = await placeOrder(
      new Logger(),
      conn,
      process.env["PRIV"] || "",
      "sell",
      "3117.198955",
      "GvvGuUFnKtsBswuQqeXhTDKB1KXLNHVw522idugTpump",
      "Raydium",
      {
        nodeUrls: ["https://api.mainnet-beta.solana.com"],
        slippage: 200,
        raydiumSwapKeys: {
          ammAddress: "BZePuemCXpAuimM2ahCTYep6cxAaKihQEb8CjJeRSUqY",
          poolCoinTokenAccountAddress:
            "9kKWxwdyuooNYFsEeygdL5LsDuy7WrfBBms7rqazirqG",
          poolPcTokenAccountAddress:
            "6Kww3cBGTpctuye8TJk44ksppRhCvpkqfvKHk9BxWxmi",
          coinMintAddress: "So11111111111111111111111111111111111111112",
          pcMintAddress: "GvvGuUFnKtsBswuQqeXhTDKB1KXLNHVw522idugTpump",
        },
        isCloseTokenAccount: true,
      }
    );
    console.log(result);
  });

  it("getAllFeeOfTx", async () => {
    return;
    const conn = new Connection("https://api.mainnet-beta.solana.com", {
      commitment: "confirmed",
    });
    const tx = await getParsedTransaction(
      conn,
      "5wVS5PuhaJX5VSTZye4uM7kSAUz6DCnhiVSQeHzaKvQZxKxsTaBZLVh9aAtufcT9S2GmPNqQ3TC1oYiDukZWefwQ"
    );
    const result = await getAllFeeOfTx(tx);
    console.log(result);
  });
});
