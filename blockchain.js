import { Block } from "./block.js";
import { client } from "./index.js";
import { Transaction } from "./transaction.js";
import crypto from "crypto";

export class Blockchain {
  constructor(
    initVal,
    chain = [],
    wallets = [],
    mining = null,
    difficulty = 1
  ) {
    this.chainId = 1;
    this.chain = chain;

    this.wallets = wallets;
    const initialMining = [];
    if (!mining) {
      let prevHash = null;
      for (let i = 0; i < initVal / 1000; i++) {
        const transactions = [];

        for (let j = 0; j < 1000 / 5; j++) {
          const transaction = new Transaction(
            0,
            crypto.randomUUID(),
            crypto.randomUUID()
          );
          transactions.push(transaction);
        }
        const block = new Block(prevHash, transactions);
        initialMining.push(block);
        prevHash = block.hash;
      }
    }
    this.mining = mining || initialMining;
    this.difficulty = difficulty;
  }

  getLastBlock() {
    return this.chain[this.chain.length - 1];
  }

  async addWallet(wallet) {
    this.wallets.push(wallet);
    client.connect();
    const database = client.db("blockchain");
    const collection = database.collection("BVC");
    await collection.findOneAndUpdate(
      { chainId: 1 },
      { $push: { wallets: wallet } }
    );
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

  async mineOne(minerWallet) {
    if (this.mining.length > 0) {
      const totalTransactions = this.mining[this.mining.length - 1].mine(
        this.difficulty
      );

      minerWallet.balance += totalTransactions * 5;

      this.chain.push(this.mining[this.mining.length - 1]);

      client.connect();
      const database = client.db("blockchain");
      const collection = database.collection("BVC");
      await collection.findOneAndUpdate(
        { chainId: 1 },
        { $push: { chain: this.mining[this.mining.length - 1] } }
      );
      const dbChain = await collection.findOne({ chainId: 1 });
      dbChain.wallets.shift();
      await collection.findOneAndUpdate(
        { chainId: 1 },
        { $set: { wallets: dbChain.wallets } }
      );
      this.mining = this.mining.shift();
      return true;
    }
    return false;
  }

  async addBlock(transactions) {
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
      client.connect();
      const database = client.db("blockchain");
      const collection = database.collection("BVC");
      await collection.findOneAndUpdate(
        { chainId: 1 },
        {
          $push: {
            mining: new Block(this.getLastBlock().hash, verifiedTransactions),
          },
        }
      );
    }
  }
}
