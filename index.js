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
const port = 3000;
app.use(express.json());

const uri =
  "mongodb+srv://findof:OOgZ4o1mEYhMNVmU@bvc.sykvkhs.mongodb.net/?retryWrites=true&w=majority&appName=BVC";
export const client = new MongoClient(uri, {
  serverApi: {
    version: ServerApiVersion.v1,
    strict: true,
    deprecationErrors: true,
  },
});

let chain;

async function start() {
  const res = await getChain();
  if (!res) {
    chain = new Blockchain(10000);

    await createChain();
  }
}

async function createChain() {
  try {
    await client.connect();
    const database = client.db("blockchain");
    const collection = database.collection("BVC");
    const result = await collection.findOne({ chainId: 1 });
    if (!result) {
      await collection.insertOne({ ...chain });
    }
  } catch (error) {
    console.error("Error creating chain:", error);
  } finally {
    await client.close();
  }
}

async function getChain() {
  try {
    await client.connect();
    const database = client.db("blockchain");
    const collection = database.collection("BVC");
    const result = await collection.findOne({ chainId: 1 });

    if (!result) {
      return false;
    }

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
    return true;
  } catch (error) {
    console.error("Error getting chain:", error);
  } finally {
    await client.close();
  }
}

app.post("/addWallet", async (req, res) => {
  const username = req.body.username;
  if (!username) {
    return res.status(400).send("Username is required");
  }

  try {
    const newWallet = new Wallet(username);
    await chain.addWallet(newWallet);
    res.status(201).json({
      message: "Wallet added successfully",
      privateKey: newWallet.privateKey,
    });
  } catch (error) {
    res.status(500).send(error.message);
  }
});

app.get("/getPublicKeyFromUsername", (req, res) => {
  const { username } = req.body;
  if (!username) {
    return res.status(400).send("Please send all required fields (username)");
  }

  try {
    const wallet = chain.getWalletByUsername(username);
    if (!wallet) {
      res.status(201).json({ message: "No wallet found" });
    }
    res.status(201).json({ publicKey: wallet.publicKey });
  } catch (error) {
    res.status(500).send(error.message);
  }
});

app.post("/createTransaction", async (req, res) => {
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
    res.status(201).json({ message: "Transaction created successfully" });
  } catch (error) {
    res.status(500).send(error.message);
  }
});

app.post("/mine/publicKey", async (req, res) => {
  const { miner } = req.body;
  if (!miner) {
    return res.status(400).send("Please send all required fields (miner)");
  }

  try {
    const wallet = chain.getWalletByPublicKey(miner);
    if (!wallet) {
      res.status(201).json({ message: "No wallet found" });
    }
    const result = await chain.mineOne(wallet);
    if (result) {
      res.status(201).json({ message: "Mined block successfully" });
    } else {
      res.status(201).json({ message: "No blocks left to mine" });
    }
  } catch (error) {
    res.status(500).send(error.message);
  }
});

app.post("/mine/username", async (req, res) => {
  const { miner } = req.body;
  if (!miner) {
    return res.status(400).send("Please send all required fields (miner)");
  }

  try {
    const wallet = chain.getWalletByUsername(miner);
    if (!wallet) {
      res.status(201).json({ message: "No wallet found" });
    }
    const result = await chain.mineOne(wallet);
    if (result) {
      res.status(201).json({ message: "Mined block successfully" });
    } else {
      res.status(201).json({ message: "No blocks left to mine" });
    }
  } catch (error) {
    res.status(500).send(error.message);
  }
});

app.get("/checkBalance/publicKey", (req, res) => {
  const { publicKey } = req.body;
  if (!publicKey) {
    return res.status(400).send("Please send all required fields (publicKey)");
  }

  try {
    const wallet = chain.getWalletByPublicKey(publicKey);
    if (!wallet) {
      res.status(201).json({ message: "No wallet found" });
    }
    res.status(201).json({ balance: wallet.balance });
  } catch (error) {
    res.status(500).send(error.message);
  }
});

app.get("/checkBalance/username", (req, res) => {
  const { username } = req.body;
  if (!username) {
    return res.status(400).send("Please send all required fields (publicKey)");
  }

  try {
    const wallet = chain.getWalletByUsername(username);
    if (!wallet) {
      res.status(201).json({ message: "No wallet found" });
    }
    res.status(201).json({ balance: wallet.balance });
  } catch (error) {
    res.status(500).send(error.message);
  }
});

app.use((req, res) => {
  res
    .status(404)
    .send(
      `Endpoint not found, you could also be using the incorrect request type. Currently you are using ${req.method}`
    );
});

app.listen(port, async () => {
  console.log(`Starting...`);
  await start();
  console.log(`Setup Complete!`);
  console.log(`Listening at port ${port}`);
});

export default app;
