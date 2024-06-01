import CryptoJS from "crypto-js";

export class Block {
  constructor(prevHash, transactions, hash = null, timestamp = new Date().getTime(), nonce = 0) {
    this.timestamp = timestamp;
    this.prevHash = prevHash;
    this.transactions = transactions;
    this.nonce = nonce;
    this.hash = hash ? hash : this.createHash();
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