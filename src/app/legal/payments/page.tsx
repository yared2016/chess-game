import { PolicyViewer, LegalSection } from "@/components/legal/policy-viewer";

export default function PaymentPolicyPage() {
  return (
    <PolicyViewer
      title="Payment & Payout Policy"
      effectiveDate="November 1, 2026"
      description="Official disclosure of Ethiopian payment channels, pass-through fee schedules, the 100% Net Withdrawal Guarantee, and withdrawal requirements."
    >
      <LegalSection number="1." title="Zero Platform Markup Principle">
        <p>
          1.1. <strong className="text-foreground">Zero Deposit Markup:</strong> Abay Chess levies **0.00 ETB** on all incoming player deposits.
        </p>
        <p>
          1.2. <strong className="text-foreground">Zero Withdrawal Markup:</strong> Abay Chess levies **0.00 ETB** internal markup on player payouts.
        </p>
        <p>
          1.3. Platform operating revenue is generated exclusively through a 10% commission rake on decisive winning match pots.
        </p>
      </LegalSection>

      <LegalSection number="2." title="The 100% Net Withdrawal Guarantee">
        <p>
          2.1. When you request a withdrawal of <span className="font-mono font-bold text-foreground">X ETB</span>, you will receive exactly <span className="font-mono font-bold text-foreground">X ETB</span> in your bank account or Telebirr mobile wallet.
        </p>
        <p>
          2.2. Verified provider network transfer fees (<span className="font-mono font-bold text-foreground">F</span>) are transparently quoted and reserved from your available wallet balance (<span className="font-mono font-bold text-foreground">X + F</span>) at the time of request.
        </p>
        <p>
          2.3. <strong className="text-foreground">Bank Fee Variances:</strong>
        </p>
        <ul className="list-disc pl-5 space-y-1.5">
          <li>
            <strong className="text-foreground">Under-Collection:</strong> If the bank debits an actual transfer fee higher than the quoted fee (<span className="font-mono text-xs">f &gt; F</span>), Abay Chess absorbs the discrepancy into Account 5010 (Provider Fee Expense). Your net payout <span className="font-mono font-bold text-foreground">X</span> is never deducted or impaired.
          </li>
          <li>
            <strong className="text-foreground">Over-Collection:</strong> If the bank charges less than the quoted fee (<span className="font-mono text-xs">f &lt; F</span>), the difference (<span className="font-mono text-xs">F - f</span>) is immediately credited back to your wallet balance (Account 2010).
          </li>
        </ul>
      </LegalSection>

      <LegalSection number="3." title="Official Channel Tariffs & Schedules">
        <p>
          All tariffs reflect published schedules and verified pass-through rates:
        </p>

        <div className="space-y-4 pt-2">
          <div className="rounded-2xl border border-border/80 bg-muted/10 p-4">
            <h3 className="font-bold text-foreground text-sm flex items-center justify-between">
              <span>Telebirr (Ethio Telecom Peer-to-Peer Transfer)</span>
              <span className="text-[11px] font-mono text-primary">Active Channel</span>
            </h3>
            <div className="mt-3 overflow-x-auto">
              <table className="w-full text-left text-xs">
                <thead>
                  <tr className="border-b border-border/60 text-muted-foreground">
                    <th className="pb-2 font-semibold">Amount Band</th>
                    <th className="pb-2 font-semibold text-right">Provider Fee</th>
                    <th className="pb-2 font-semibold text-right">Status</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border/40 font-mono">
                  <tr>
                    <td className="py-2">101.00 – 500.00 ETB</td>
                    <td className="py-2 text-right">1.00 ETB</td>
                    <td className="py-2 text-right text-emerald-400">Verified</td>
                  </tr>
                  <tr>
                    <td className="py-2">501.00 – 1,000.00 ETB</td>
                    <td className="py-2 text-right">2.00 ETB</td>
                    <td className="py-2 text-right text-emerald-400">Verified</td>
                  </tr>
                  <tr>
                    <td className="py-2">1,001.00 – 2,000.00 ETB</td>
                    <td className="py-2 text-right">4.00 ETB</td>
                    <td className="py-2 text-right text-emerald-400">Verified</td>
                  </tr>
                  <tr>
                    <td className="py-2">2,001.00 – 5,000.00 ETB</td>
                    <td className="py-2 text-right">6.00 ETB</td>
                    <td className="py-2 text-right text-emerald-400">Verified</td>
                  </tr>
                  <tr>
                    <td className="py-2">5,001.00 – 10,000.00 ETB</td>
                    <td className="py-2 text-right">8.00 ETB</td>
                    <td className="py-2 text-right text-emerald-400">Verified</td>
                  </tr>
                  <tr>
                    <td className="py-2">10,001.00 – 25,000.00 ETB</td>
                    <td className="py-2 text-right">10.00 ETB</td>
                    <td className="py-2 text-right text-emerald-400">Verified</td>
                  </tr>
                </tbody>
              </table>
            </div>
          </div>

          <div className="rounded-2xl border border-border/80 bg-muted/10 p-4">
            <h3 className="font-bold text-foreground text-sm flex items-center justify-between">
              <span>Commercial Bank of Ethiopia (CBE Account-to-Account)</span>
              <span className="text-[11px] font-mono text-primary">Active Channel</span>
            </h3>
            <div className="mt-3 overflow-x-auto">
              <table className="w-full text-left text-xs">
                <thead>
                  <tr className="border-b border-border/60 text-muted-foreground">
                    <th className="pb-2 font-semibold">Amount Band</th>
                    <th className="pb-2 font-semibold text-right">Provider Fee (incl. 15% VAT)</th>
                    <th className="pb-2 font-semibold text-right">Status</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border/40 font-mono">
                  <tr>
                    <td className="py-2">1,001.00 – 5,000.00 ETB</td>
                    <td className="py-2 text-right">1.15 ETB (115 santims)</td>
                    <td className="py-2 text-right text-emerald-400">Verified</td>
                  </tr>
                  <tr>
                    <td className="py-2">5,001.00 – 10,000.00 ETB</td>
                    <td className="py-2 text-right">2.30 ETB (230 santims)</td>
                    <td className="py-2 text-right text-emerald-400">Verified</td>
                  </tr>
                  <tr>
                    <td className="py-2">10,001.00 – 50,000.00 ETB</td>
                    <td className="py-2 text-right">3.45 ETB (345 santims)</td>
                    <td className="py-2 text-right text-emerald-400">Verified</td>
                  </tr>
                  <tr>
                    <td className="py-2">50,001.00 – 100,000.00 ETB</td>
                    <td className="py-2 text-right">5.75 ETB (575 santims)</td>
                    <td className="py-2 text-right text-emerald-400">Verified</td>
                  </tr>
                </tbody>
              </table>
            </div>
          </div>
        </div>
      </LegalSection>

      <LegalSection number="4." title="Withdrawal Minimums & First-Time Player Eligibility">
        <p>
          4.1. <strong className="text-foreground">Minimum Withdrawal Limit:</strong> Standard ordinary withdrawals require a minimum requested amount of **100.00 ETB (10,000 santims)**.
        </p>
        <p>
          4.2. <strong className="text-foreground">Account Closure Exception:</strong> If your total legitimate wallet balance is below 100.00 ETB, you may execute an account closure withdrawal for your entire remaining balance.
        </p>
        <p>
          4.3. <strong className="text-foreground">First-Time Withdrawal Rule:</strong> To prevent money laundering and collusive cashout abuse, players must successfully complete at least **three (3) legitimate, non-abandoned chess matches** prior to their first withdrawal. Your deposited funds remain 100% safe and are never forfeited.
        </p>
        <p>
          4.4. <strong className="text-foreground">High-Value Withdrawals (&gt; 2,000 ETB):</strong> Withdrawals exceeding 2,000.00 ETB trigger mandatory operational review with an SLA of up to 6 hours during daytime (08:00–20:00 EAT) and up to 12 hours overnight. Standard withdrawals are processed in 1–2 hours.
        </p>
      </LegalSection>
    </PolicyViewer>
  );
}
