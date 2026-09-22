import { Metadata } from "next";
import { WalletView } from "@/components/wallet/wallet-view";

export const metadata: Metadata = {
  title: "Wallet",
  description: "Manage your ETB balance and transactions.",
};

export default function WalletPage() {
  return <WalletView />;
}
