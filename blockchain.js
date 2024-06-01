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
    this.mining = mining || this.createInitialBlocks(initVal);
    this.difficulty = difficulty;
  }

  createInitialBlocks(initVal) {
    const initialMining = [];
    let prevHash = null;

    const transactionsPerBlock = 5;
    const transactionFee = 5;
    const totalBlocks = initVal / (transactionsPerBlock * transactionFee);

    for (let i = 0; i < totalBlocks; i++) {
      const transactions = Array.from(
        { length: transactionsPerBlock },
        () => new Transaction(0, crypto.randomUUID(), crypto.randomUUID())
      );
      const block = new Block(prevHash, transactions);
      initialMining.push(block);
      prevHash = block.hash;
    }

    return initialMining;
  }

  getLastBlock() {
    return this.chain[this.chain.length - 1];
  }

  async addWallet(wallet) {
    const existingWallet = this.getWalletByUsername(wallet.username);
    if (existingWallet) {
      console.error(`Wallet with username ${wallet.username} already exists.`);
      return false;
    }

    this.wallets.push(wallet);

    try {
      await client.connect();
      const database = client.db("blockchain");
      const collection = database.collection("BVC");
      await collection.findOneAndUpdate(
        { chainId: this.chainId },
        { $push: { wallets: wallet } }
      );
    } catch (error) {
      console.error("Error updating database:", error);
      return false;
    } finally {
      await client.close();
      return true;
    }
  }

  getWalletByPublicKey(key) {
    return this.wallets.find((wallet) => wallet.publicKey === key) || null;
  }

  getWalletByUsername(username) {
    return this.wallets.find((wallet) => wallet.username === username) || null;
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
    if (this.mining.length === 0) {
      return false;
    }

    const blockToMine = this.mining[0];
    const totalTransactions = blockToMine.mine(this.difficulty);

    minerWallet.balance += totalTransactions * 5;

    try {
      await client.connect();
      const database = client.db("blockchain");
      const collection = database.collection("BVC");

      await collection.findOneAndUpdate(
        { "wallets.publicKey": minerWallet.publicKey },
        { $set: { "wallets.$.balance": minerWallet.balance } }
      );

      await collection.findOneAndUpdate(
        { chainId: this.chainId },
        { $push: { chain: blockToMine } }
      );

      await collection.findOneAndUpdate(
        { chainId: this.chainId },
        { $pop: { mining: -1 } }
      );
    } catch (error) {
      console.error("Error updating database:", error);
    } finally {
      await client.close();
    }

    this.chain.push(blockToMine);
    this.mining.shift();
    return true;
  }

  async addBlock(transactions) {
    if (!transactions.length) return;

    const verifiedTransactions = transactions.filter((transaction) => {
      const payerWallet = this.getWalletByPublicKey(transaction.payer);
      const payeeWallet = this.getWalletByPublicKey(transaction.payee);

      if (!payerWallet || !payeeWallet) {
        console.error(
          "One of the parties involved in the transaction does not exist."
        );
        return false;
      }

      if (payerWallet === payeeWallet) {
        console.error("Cannot create a transaction to yourself.");
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

    if (!verifiedTransactions.length) return;

    console.log("Transactions are valid.");
    this.adjustDifficulty();
    const newBlock = new Block(this.getLastBlock().hash, verifiedTransactions);
    this.mining.push(newBlock);

    try {
      await client.connect();
      const database = client.db("blockchain");
      const collection = database.collection("BVC");

      await collection.findOneAndUpdate(
        { chainId: this.chainId },
        { $push: { mining: newBlock } }
      );
    } catch (error) {
      console.error("Error updating database:", error);
    } finally {
      await client.close();
    }
  }
}
