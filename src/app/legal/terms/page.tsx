import { PolicyViewer, LegalSection } from "@/components/legal/policy-viewer";

export default function TermsOfServicePage() {
  return (
    <PolicyViewer
      title="Terms of Service"
      effectiveDate="November 1, 2026"
      description="The master legal agreement governing your account, gameplay, wallet transactions, match stakes, and dispute resolution on Abay Chess."
    >
      <LegalSection number="1." title="Account Registration & Eligibility">
        <p>
          1.1. You must be at least 18 years of age (or the age of legal majority in your jurisdiction) to participate in staked chess matches or maintain an ETB wallet balance on Abay Chess.
        </p>
        <p>
          1.2. Each player is strictly permitted only one account. Account sharing, multi-accounting, identity spoofing, or operating accounts on behalf of third parties is strictly prohibited and results in permanent account suspension.
        </p>
        <p>
          1.3. All player accounts are authenticated via verified secure identity protocols. You are solely responsible for safeguarding your authentication devices and sessions. Any action conducted under your authenticated credentials is legally presumed to be your own.
        </p>
      </LegalSection>

      <LegalSection number="2." title="Fair Play & Anti-Cheating Regulations">
        <p>
          2.1. Abay Chess enforces a zero-tolerance policy against computer assistance, AI bots, opening books, tablebases, and external advisory during active rated or staked chess matches.
        </p>
        <p>
          2.2. The platform continuously monitors gameplay telemetry, move timing distributions, move accuracy against grandmaster-level chess engine evaluations, and client-side behavioral patterns.
        </p>
        <p>
          2.3. Confirmed engine usage or external consultation results in immediate rating forfeiture, permanent exclusion from staked matches, and confiscation of ill-gotten contest winnings.
        </p>
      </LegalSection>

      <LegalSection number="3." title="Match Stakes, Escrow & Commission Rake">
        <p>
          3.1. When two players agree to enter a staked match, both players&apos; entry stakes are atomically locked in platform escrow (Account 2020) upon the start of the clock.
        </p>
        <p>
          3.2. Upon verified match conclusion:
        </p>
        <ul className="list-disc pl-5 space-y-1.5">
          <li>
            <strong className="text-foreground">Decisive Victory:</strong> The winning player receives 100% of the gross pot minus a 10% platform commission rake. The net winnings are credited directly to the winner&apos;s available balance (Account 2010).
          </li>
          <li>
            <strong className="text-foreground">Organic Draw:</strong> Draws resulting from stalemate, threefold repetition, the 50-move rule, or insufficient material are refunded 100% to each player with 0% platform commission rake.
          </li>
          <li>
            <strong className="text-foreground">Mutual Accepted Draw:</strong> Mutual draw agreements are settled according to the active platform draw settlement policy ratified by governance.
          </li>
        </ul>
        <p>
          3.3. Disconnections and abandons are governed by official time controls. If a player leaves an active match without resigning and fails to reconnect within the abandonment window, the game is forfeited.
        </p>
      </LegalSection>

      <LegalSection number="4." title="Player Balances & Net Withdrawal Guarantee">
        <p>
          4.1. Player deposits represent client liabilities (Account 2010) held in trust and remain the legal property of the player.
        </p>
        <p>
          4.2. <strong className="text-foreground">Zero Platform Markup:</strong> Abay Chess earns zero revenue from deposits or withdrawals. Platform revenue is derived strictly from match commission rake.
        </p>
        <p>
          4.3. <strong className="text-foreground">Net Withdrawal Guarantee:</strong> Players receive 100% of the requested payout amount ($X$ ETB). External payment provider transfer fees are quoted and reserved from the player&apos;s available balance ($X + F$) prior to confirmation.
        </p>
        <p>
          4.4. <strong className="text-foreground">Minimum Withdrawal:</strong> Standard ordinary withdrawals have a minimum threshold of 100.00 ETB (10,000 santims). Players with a legitimate remaining balance under 100.00 ETB may execute an account-closure withdrawal for their full remaining balance.
        </p>
        <p>
          4.5. <strong className="text-foreground">First-Time Withdrawal Eligibility:</strong> Prior to executing their first withdrawal, players must complete at least three (3) legitimate, non-abandoned chess matches. Deposited funds are never confiscated.
        </p>
      </LegalSection>

      <LegalSection number="5." title="Prohibited Activities & Overdrafts">
        <p>
          5.1. Players may not engage in match collusion, intentional rating deflation (sandbagging), fraudulent payment reversals, or credit chargebacks.
        </p>
        <p>
          5.2. If an external deposit is reversed or clawed back after funds have been spent, the resulting deficit is recorded as an accounting receivable (Account 1050 Player Overdrafts Receivable). The account is frozen with a 14-day dispute resolution window.
        </p>
      </LegalSection>

      <LegalSection number="6." title="Governing Law & Dispute Resolution">
        <p>
          6.1. These Terms are governed by and construed in accordance with the substantive laws of the Federal Democratic Republic of Ethiopia.
        </p>
        <p>
          6.2. For payment inquiries or gameplay disputes, players may submit a formal support inquiry through the platform portal. Formal reviews are processed within five (5) business days.
        </p>
      </LegalSection>
    </PolicyViewer>
  );
}
