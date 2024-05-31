import { Block } from "./block.js";
import { Transaction } from "./transaction.js";
import crypto from "crypto";

export class Blockchain {
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