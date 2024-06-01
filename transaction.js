import crypto from "crypto";

export const signTransaction = (transaction, privateKey) => {
  const sign = crypto.createSign("SHA256");
  sign.update(transaction.toString()).end();
  const signature = sign.sign(privateKey, "hex");
  transaction.signature = signature;
};

export const verifyTransaction = (transaction) => {
  const verify = crypto.createVerify("SHA256");
  verify.update(transaction.toString());
  return verify.verify(transaction.payer, transaction.signature, "hex");
};

export class Transaction {
  constructor(amount, payer, payee, fee = 5, signature = null) {
    this.amount = amount;
    this.fee = fee;
    this.payer = payer;
    this.payee = payee;
    this.signature = signature;
  }
}
