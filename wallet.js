import crypto from "crypto";

export class Wallet {
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