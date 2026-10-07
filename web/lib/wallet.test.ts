import test from "node:test";
import assert from "node:assert/strict";
import { connectWallet, isWalletSigner, walletSigner, walletAddress, type Eip1193 } from "./wallet.ts";

const ADDR = "0x1111111111111111111111111111111111111111";

function mock(chain: string, calls: string[]): Eip1193 {
  return {
    async request({ method }) {
      calls.push(method);
      if (method === "eth_requestAccounts") return [ADDR];
      if (method === "eth_chainId") return chain;
      return null;
    },
  };
}

test("signer encoding round-trips", () => {
  assert.ok(isWalletSigner(walletSigner(ADDR)));
  assert.equal(walletAddress(walletSigner(ADDR)), ADDR);
  assert.ok(!isWalletSigner("0x" + "a".repeat(64)));
});

test("connect adds and switches the chain when the wallet is elsewhere", async () => {
  const calls: string[] = [];
  assert.equal(await connectWallet(mock("0x1", calls)), ADDR);
  assert.deepEqual(calls, ["eth_requestAccounts", "eth_chainId", "wallet_addEthereumChain", "wallet_switchEthereumChain"]);
});

test("connect does not switch when already on Studionet (61999 = 0xf22f)", async () => {
  const calls: string[] = [];
  await connectWallet(mock("0xf22f", calls));
  assert.deepEqual(calls, ["eth_requestAccounts", "eth_chainId"]);
});

test("connect fails clearly without a wallet", async () => {
  await assert.rejects(() => connectWallet(undefined), /No browser wallet/);
});
