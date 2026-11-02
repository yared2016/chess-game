import { PolicyViewer, LegalSection } from "@/components/legal/policy-viewer";

export default function PrivacyPolicyPage() {
  return (
    <PolicyViewer
      title="Privacy Policy"
      effectiveDate="November 1, 2026"
      description="How Abay Chess collects, protects, isolates, and audits player identification and financial information in compliance with Ethiopian privacy and data safeguarding directives."
    >
      <LegalSection number="1." title="Information We Collect">
        <p>
          1.1. <strong className="text-foreground">Authentication Data:</strong> We utilize secure industry-standard identity authentication protocols. We receive your unique verified user ID, email address, profile avatar, and verified identity tokens.
        </p>
        <p>
          1.2. <strong className="text-foreground">Player Profile:</strong> Public username, chosen display name, rating history, and chess match records.
        </p>
        <p>
          1.3. <strong className="text-foreground">Payment Identification:</strong> Ethiopian mobile phone number (Telebirr) and Commercial Bank of Ethiopia (CBE) account number and holder name.
        </p>
        <p>
          1.4. <strong className="text-foreground">Security &amp; Device Telemetry:</strong> Move timestamps, browser User-Agent strings, and IP addresses, collected strictly for session verification, cheat detection, and forensic anti-collusion audits.
        </p>
      </LegalSection>

      <LegalSection number="2." title="Payment Data Protection &amp; Masking">
        <p>
          2.1. Abay Chess does not store bank account passwords, PIN codes, or debit card numbers.
        </p>
        <p>
          2.2. Player banking details are encrypted at rest and permanently masked in regular staff interfaces (e.g., displaying only the last 4 digits).
        </p>
        <p>
          2.3. Unmasking full payment details is restricted exclusively to authorized operational supervisors with cryptographic access control, and triggers an immutable append-only audit record detailing the staff ID, player ID, timestamp, and justification prompt.
        </p>
      </LegalSection>

      <LegalSection number="3." title="Use of Information">
        <p>
          3.1. To administer real-time 3D multiplayer chess matchmaking, ratings, and leaderboards.
        </p>
        <p>
          3.2. To process verified deposits and execute secure withdrawals to your personal bank account or mobile wallet.
        </p>
        <p>
          3.3. To enforce platform fair play, maintain double-entry accounting integrity, and comply with regulatory directives issued by the National Bank of Ethiopia.
        </p>
      </LegalSection>

      <LegalSection number="4." title="Data Sharing &amp; Third Parties">
        <p>
          4.1. We do not sell, rent, commercialize, or share your personal information with marketing advertisers.
        </p>
        <p>
          4.2. Transaction data is transmitted solely to licensed financial institutions (Ethio Telecom / Telebirr, Commercial Bank of Ethiopia) and certified payment gateway providers solely to execute financial transfers initiated by you.
        </p>
      </LegalSection>

      <LegalSection number="5." title="Data Retention &amp; Security">
        <p>
          5.1. General ledger journals and match records are permanently archived in immutable records to satisfy financial solvency and auditability requirements.
        </p>
        <p>
          5.2. All communication between your client device and Abay Chess servers occurs over encrypted HTTPS/WSS (TLS 1.3).
        </p>
      </LegalSection>
    </PolicyViewer>
  );
}
