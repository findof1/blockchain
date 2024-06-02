import express from "express";
import {
  Transaction,
  signTransaction,
  verifyTransaction,
} from "./transaction.js";
import { Blockchain } from "./blockchain.js";
import { Wallet } from "./wallet.js";
import { MongoClient, ServerApiVersion } from "mongodb";
import { Block } from "./block.js";

const app = express();
app.use(express.json());

const uri = "mongodb+srv://findof:OOgZ4o1mEYhMNVmU@bvc.sykvkhs.mongodb.net/?retryWrites=true&w=majority&appName=BVC";
export let client;
let chain;
let initialized = false;

async function connectToMongoDB() {
  if (!client) {
    console.log("Connecting to MongoDB...");
    client = new MongoClient(uri, {
      serverApi: {
        version: ServerApiVersion.v1,
        strict: true,
        deprecationErrors: true,
      },
    });
    await client.connect();
    console.log("Connected to MongoDB");
  }
}

async function initializeBlockchain() {
  if (initialized) return;
  console.log("Initializing blockchain...");

  try {
    const database = client.db("blockchain");
    const collection = database.collection("BVC");

    const result = await collection.findOne({ chainId: 1 });
    if (result) {
      console.log("Blockchain data found, reconstructing blockchain...");
      const mining = result.mining.map((block) => {
        const transactions = block.transactions.map(
          (tx) =>
            new Transaction(tx.amount, tx.payer, tx.payee, tx.fee, tx.signature)
        );
        return new Block(
          block.prevHash,
          transactions,
          block.hash,
          block.timestamp,
          block.nonce
        );
      });

      const chainArr = result.chain.map((block) => {
        const transactions = block.transactions.map(
          (tx) =>
            new Transaction(tx.amount, tx.payer, tx.payee, tx.fee, tx.signature)
        );
        return new Block(
          block.prevHash,
          transactions,
          block.hash,
          block.timestamp,
          block.nonce
        );
      });

      const walletArr = result.wallets.map(
        (wallet) =>
          new Wallet(
            wallet.username,
            wallet.publicKey,
            wallet.privateKey,
            wallet.balance
          )
      );

      chain = new Blockchain(
        null,
        chainArr,
        walletArr,
        mining,
        result.difficulty
      );
      console.log("Blockchain reconstructed.");
    } else {
      console.log("No blockchain data found, creating new blockchain...");
      chain = new Blockchain(10000);
      await collection.insertOne({ ...chain });
      console.log("New blockchain created and saved.");
    }

    initialized = true;
  } catch (error) {
    console.error("Error initializing blockchain:", error);
  }
}

app.post("/addWallet", async (req, res) => {
  await connectToMongoDB();
  await initializeBlockchain();
  const username = req.body.username;
  if (!username) {
    return res.status(400).send("Username is required");
  }

  try {
    const newWallet = new Wallet(username);
    const result = await chain.addWallet(newWallet);

    if (!result) {
      return res.status(500).json({
        message: "A wallet with that username already exists",
      });
    }

    return res.status(201).json({
      message: "Wallet added successfully",
      privateKey: newWallet.privateKey,
    });
  } catch (error) {
    return res.status(500).send(error.message);
  }
});

app.get("/getPublicKeyFromUsername", async (req, res) => {
  await connectToMongoDB();
  await initializeBlockchain();
  const { username } = req.body;
  if (!username) {
    return res.status(400).send("Please send all required fields (username)");
  }

  try {
    const wallet = chain.getWalletByUsername(username);

    if (!wallet) {
      return res.status(201).json({ message: "No wallet found" });
    }

    return res.status(201).json({ publicKey: wallet.publicKey });
  } catch (error) {
    return res.status(500).send(error.message);
  }
});

app.post("/createTransaction", async (req, res) => {
  await connectToMongoDB();
  await initializeBlockchain();
  const { amount, payer, payee, privateKey } = req.body;
  if (!amount || !payer || !payee) {
    return res
      .status(400)
      .send("Please send all required fields (amount, payer, payee)");
  }

  try {
    const transaction = new Transaction(amount, payer, payee);
    signTransaction(transaction, privateKey);

    if (!verifyTransaction(transaction)) {
      return res.status(400).send("Invalid transaction signature");
    }

    await chain.addBlock([transaction]);
    return res.status(201).json({ message: "Transaction created successfully" });
  } catch (error) {
    return res.status(500).send(error.message);
  }
});

app.post("/mine/publicKey", async (req, res) => {
  await connectToMongoDB();
  await initializeBlockchain();
  const { miner } = req.body;
  if (!miner) {
    return res.status(400).send("Please send all required fields (miner)");
  }

  try {
    const wallet = chain.getWalletByPublicKey(miner);
    if (!wallet) {
      return res.status(201).json({ message: "No wallet found" });
    }
    const result = await chain.mineOne(wallet);
    if (result) {
      return res.status(201).json({ message: "Mined block successfully" });
    } else {
      return res.status(201).json({ message: "No blocks left to mine" });
    }
  } catch (error) {
    return res.status(500).send(error.message);
  }
});

app.post("/mine/username", async (req, res) => {
  await connectToMongoDB();
  await initializeBlockchain();
  const { miner } = req.body;
  if (!miner) {
    return res.status(400).send("Please send all required fields (miner)");
  }

  try {
    const wallet = chain.getWalletByUsername(miner);
    if (!wallet) {
      return res.status(201).json({ message: "No wallet found" });
    }
    const result = await chain.mineOne(wallet);
    if (result) {
      return res.status(201).json({ message: "Mined block successfully" });
    } else {
      return res.status(201).json({ message: "No blocks left to mine" });
    }
  } catch (error) {
    return res.status(500).send(error.message);
  }
});

app.get("/checkBalance/publicKey", async (req, res) => {
  await connectToMongoDB();
  await initializeBlockchain();
  const { publicKey } = req.body;
  if (!publicKey) {
    return res.status(400).send("Please send all required fields (publicKey)");
  }

  try {
    const wallet = chain.getWalletByPublicKey(publicKey);
    if (!wallet) {
      return res.status(201).json({ message: "No wallet found" });
    }
    return res.status(201).json({ balance: wallet.balance });
  } catch (error) {
    return res.status(500).send(error.message);
  }
});

app.get("/checkBalance/username", async (req, res) => {
  await connectToMongoDB();
  await initializeBlockchain();
  const { username } = req.body;
  if (!username) {
    return res.status(400).send("Please send all required fields (publicKey)");
  }

  try {
    const wallet = chain.getWalletByUsername(username);
    if (!wallet) {
      return res.status(201).json({ message: "No wallet found" });
    }
    return res.status(201).json({ balance: wallet.balance });
  } catch (error) {
    return res.status(500).send(error.message);
  }
});

app.use((req, res) => {
  return res
    .status(404)
    .send(
      `Endpoint not found, you could also be using the incorrect request type. Currently you are using ${req.method}`
    );
});

const port = 3000;
app.listen(port, () => {
  console.log(`Server is running on http://localhost:${port}`);
});

export default app;