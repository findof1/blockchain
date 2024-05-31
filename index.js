import express from "express";
import { Transaction, signTransaction, verifyTransaction } from "./transaction.js";
import { Blockchain } from "./blockchain.js";
import { Wallet } from "./wallet.js";

const app = express();
const port = 3000;
app.use(express.json());

//const chain = new Blockchain(50000000);
const chain = new Blockchain(10000);
chain.addWallet(new Wallet("Findof"));

app.post("/addWallet", (req, res) => {
  const username = req.body.username;
  if (!username) {
    return res.status(400).send("Username is required");
  }

  try {
    const newWallet = new Wallet(username);
    chain.addWallet(newWallet);
    res.status(201).json({ message: "Wallet added successfully", privateKey: newWallet.privateKey });
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
    if(!wallet){
      res.status(201).json({ message: "No wallet found" });
    }
    res
      .status(201)
      .json({ publicKey: wallet.publicKey });
  } catch (error) {
    res.status(500).send(error.message);
  }
});

app.post("/createTransaction", (req, res) => {
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

    chain.addBlock([transaction]);
    res.status(201).json({ message: "Transaction created successfully" });
  } catch (error) {
    res.status(500).send(error.message);
  }
});

app.post("/mine/publicKey", (req, res) => {
  const { miner } = req.body;
  if (!miner) {
    return res.status(400).send("Please send all required fields (miner)");
  }

  try {
    const wallet = chain.getWalletByPublicKey(miner);
    if(!wallet){
      res.status(201).json({ message: "No wallet found" });
    }
    const result = chain.mineOne(wallet);
    if (result) {
      res.status(201).json({ message: "Mined block successfully" });
    } else {
      res.status(201).json({ message: "No blocks left to mine" });
    }
  } catch (error) {
    res.status(500).send(error.message);
  }
});

app.post("/mine/username", (req, res) => {
  const { miner } = req.body;
  if (!miner) {
    return res.status(400).send("Please send all required fields (miner)");
  }

  try {
    const wallet = chain.getWalletByUsername(miner);
    if(!wallet){
      res.status(201).json({ message: "No wallet found" });
    }
    const result = chain.mineOne(chain.getWalletByUsername(miner));
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
    if(!wallet){
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
    if(!wallet){
      res.status(201).json({ message: "No wallet found" });
    }
    res.status(201).json({ balance: wallet.balance });
  } catch (error) {
    res.status(500).send(error.message);
  }
});

app.use((req, res) => {
  res.status(404).send('Endpoint not found');
});

app.listen(port, () => {
  console.log(`Listening at port ${port}`);
});

export default app;