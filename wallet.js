import crypto from "crypto";

export class Wallet {
  constructor(username, publicKey = null, privateKey = null, balance = 0) {
      const res = crypto.generateKeyPairSync("rsa", {
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

    publicKey = publicKey ? publicKey :res.publicKey
    privateKey = privateKey ? privateKey :res.privateKey
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