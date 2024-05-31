const CryptoJS = require("crypto-js");
const crypto = require("crypto");
const express = require("express");

const app = express();
const port = 3000;
app.use(express.json());

const signTransaction = (transaction, privateKey) => {
  const sign = crypto.createSign('SHA256');
  sign.update(transaction.toString()).end();
  const signature = sign.sign(privateKey, 'hex');
  transaction.signature = signature;
};

const verifyTransaction = (transaction) => {
  const verify = crypto.createVerify('SHA256');
  verify.update(transaction.toString());
  return verify.verify(transaction.payer, transaction.signature, 'hex');
};

class Transaction {
  constructor(amount, payer, payee, fee = 5, signature = null) {
    this.amount = amount;
    this.fee = fee;
    this.payer = payer;
    this.payee = payee;
    this.signature = signature
  }


}

class Block {
  constructor(prevHash, transactions) {
    this.timestamp = new Date().getTime();
    this.prevHash = prevHash;
    this.transactions = transactions;
    this.nonce = 0;
    this.hash = this.createHash();
  }

  mine(difficulty) {
    while (true) {
      this.nonce++;

      const hash = this.createHash();

      if (hash.substring(0, difficulty) === Array(difficulty + 1).join("0")) {
        console.log(`Mined ${this.nonce}`);
        return this.transactions.length;
      }
    }
  }

  createHash() {
    let data = `${this.timestamp}${this.prevHash}${JSON.stringify(
      this.transactions
    )}${this.nonce}`;

    const newHash = CryptoJS.SHA256(data).toString(CryptoJS.enc.Hex);

    return newHash;
  }
}

class Blockchain {
  constructor(initVal) {
    this.chain = [];

    this.wallets = [];
    const initialMining = [];
    for (let i = 0; i < initVal / 1000; i++) {
      const transactions = [];
      for (let j = 0; j < 1000 / 5; j++) {
        transactions.push(
          new Transaction(0, crypto.randomUUID(), crypto.randomUUID())
        );
      }
      initialMining.push(new Block(null, transactions));
    }
    this.mining = initialMining;
    this.difficulty = 1;
  }

  getLastBlock() {
    return this.chain[this.chain.length - 1];
  }

  addWallet(wallet) {
    this.wallets.push(wallet);
  }

  getWalletByPublicKey(key) {
    console.log(this.wallets);
    for (let i = 0; i < this.wallets.length; i++) {
      if (this.wallets[i].publicKey === key) {
        return this.wallets[i];
      }
    }
    return null;
  }

  getWalletByUsername(username) {
    for (let i = 0; i < this.wallets.length; i++) {
      if (this.wallets[i].username === username) {
        return this.wallets[i];
      }
    }
    return null;
  }

  adjustDifficulty() {
    const lastBlockTimestamp = this.getLastBlock().timestamp;
    const timeDiff = Date.now() / 1000 - lastBlockTimestamp;
    const targetTimePerBlock = 60;

    if (timeDiff < targetTimePerBlock * 0.5) {
      this.difficulty++;
    } else if (timeDiff > targetTimePerBlock * 2) {
      this.difficulty--;
    }

    this.difficulty = Math.max(this.difficulty, 10);
  }

  mineOne(minerWallet) {
    if (this.mining.length > 0) {
      const totalTransactions = this.mining[this.mining.length - 1].mine(
        this.difficulty
      );

      minerWallet.balance += totalTransactions * 5;

      this.chain.push(this.mining[this.mining.length - 1]);

      this.mining = this.mining.shift();
      return true;
    }
    return false;
  }

  addBlock(transactions) {
    if (!transactions[0]) {
      return;
    }

    const verifiedTransactions = transactions.filter((transaction) => {
      const payerWallet = this.getWalletByPublicKey(transaction.payer);
      const payeeWallet = this.getWalletByPublicKey(transaction.payee);
      if (!payerWallet || !payeeWallet) {
        console.error(
          "One of the parties involved in the transaction does not exist."
        );
        return false;
      }

      if (payerWallet == payeeWallet) {
        console.error("Cannot send create a transaction to yourself.");
        return false;
      }

      if (payerWallet.balance < transaction.amount + transaction.fee) {
        console.error("Insufficient balance in payer's account.");
        return false;
      }

      payerWallet.balance -= transaction.amount;
      payeeWallet.balance += transaction.amount;

      return true;
    });
    if (verifiedTransactions.length > 0) {
      console.log(`Transactions are valid.`);
      this.mining.push(
        new Block(this.getLastBlock().hash, verifiedTransactions)
      );
    }
  }
}

class Wallet {
  constructor(username) {
    const { publicKey, privateKey } = crypto.generateKeyPairSync("rsa", {
      modulusLength: 2048,
      publicKeyEncoding: {
        type: "spki",
        format: "pem",
      },
      privateKeyEncoding: {
        type: "pkcs8",
        format: "pem",
      },
    });

    const cleanedPublicKey = publicKey
      .replace("-----BEGIN PUBLIC KEY-----", "")
      .replace("-----END PUBLIC KEY-----", "");

    this.username = username;
    this.publicKey = "BVC" + cleanedPublicKey;
    this.balance = 0;
    this.privateKey = privateKey;
  }

  addBalance(num) {
    this.balance += num;
  }
}

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
    res
      .status(201)
      .json({ publicKey: chain.getWalletByUsername(username).publicKey });
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
    const result = chain.mineOne(chain.getWalletByPublicKey(miner));
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
    res.status(201).json({ balance: wallet.balance });
  } catch (error) {
    res.status(500).send(error.message);
  }
});

app.listen(port, () => {
  console.log(`Listening at port ${port}`);
});

module.exports = app;
