const CryptoJS = require("crypto-js");

class Transaction {
  constructor(amount, payer, payee) {
    this.amount = amount;
    this.fee = 5;
    this.payer = payer;
    this.payee = payee;
  }
}

class Block {
  constructor(prevHash, transactions) {
    this.timestamp = new Date().getTime();
    this.prevHash = prevHash;
    this.transactions = transactions;
    this.nonce = 0;
    this.hash = this.createHash();
    this.difficulty = 4;
  }

  mine() {
    while (true) {
      this.nonce++;
      const hash = this.createHash();
      if (
        hash.substring(0, this.difficulty) ===
        Array(this.difficulty + 1).join("0")
      ) {
        console.log(`Mined ${this.nonce}`);
        return true;
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
  constructor() {
    this.chain = [];

    this.wallets = [];
    this.mining = [new Block(null, new Transaction(10, "genisis block", "genisis block 2")),];
  }

  getLastBlock() {
    return this.chain[this.chain.length - 1];
  }

  addWallet(wallet) {
    this.wallets.push(wallet);
  }

  getWalletByPublicKey(key) {
    for (let i = 0; i < this.wallets.length; i++) {
      if (this.wallets[i].publicKey === key) {
        return this.wallets[i];
      }
    }
    return null;
  }

  mineAll(minerKey) {
    const minerWallet = chain.getWalletByPublicKey(minerKey);
    for (let i = this.mining.length; i > 0; i--) {
      this.mining[i-1].mine();
      minerWallet.balance += 5;
      this.chain.push(this.mining[i-1]);
      this.mining.pop();
    }
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
      console.log(
        `Transactions are valid.`
      );
      this.mining.push(
        new Block(this.getLastBlock().hash, verifiedTransactions)
      );
    }
  }
}

class Wallet {
  constructor(publicKey) {
    this.publicKey = publicKey;
    this.balance = 0;
    this.privateKey = CryptoJS.lib.WordArray.random(32).toString(
      CryptoJS.enc.Hex
    );
  }

  addBalance(num){
    this.balance += num;
  }
}

const chain = new Blockchain();
chain.addWallet(new Wallet("Findof"));
chain.getWalletByPublicKey("Findof").addBalance(25)
chain.mineAll("Findof");
chain.addWallet(new Wallet("Mr Hat"));
chain.addBlock([new Transaction(25, "Findof", "Mr Hat")]);
chain.addBlock([new Transaction(20, "Mr Hat", "Findof")]);
console.log(chain);
