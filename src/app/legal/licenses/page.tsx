import { PolicyViewer, LegalSection } from "@/components/legal/policy-viewer";
import Link from "next/link";
import { PIECE_MODEL_CREDIT } from "@/lib/constants";

const HDRI_ATTRIBUTIONS = [
  { room: "Classic Study", asset: "combination_room", author: "Sergej Majboroda", source: "Poly Haven (CC0)" },
  { room: "Space Nebula", asset: "qwantani_night_puresky", author: "Greg Zaal, Jarod Guest", source: "Poly Haven (CC0)" },
  { room: "Park Meadow", asset: "meadow_2", author: "Sergej Majboroda", source: "Poly Haven (CC0)" },
  { room: "Neon Arcade", asset: "white_studio_06", author: "Grzegorz Wronkowski", source: "Poly Haven (CC0)" },
  { room: "Minimal White", asset: "white_studio_06", author: "Grzegorz Wronkowski", source: "Poly Haven (CC0)" },
];

export default function LicensesPage() {
  return (
    <PolicyViewer
      title="Open Source Licenses & Legal Attributions"
      version="4.2.7-PROD"
      effectiveDate="November 1, 2026"
      description="Authoritative permanent register of creative commons assets, open-source software licenses, and third-party attributions used within Abay Chess."
    >
      <LegalSection number="1." title="3D Chess Piece Models (Creative Commons CC BY 3.0)">
        <p>
          The 3D chess piece models rendered on the virtual board are created by{" "}
          <strong className="text-foreground">Jarlan Perez</strong> and distributed via{" "}
          <a
            href={PIECE_MODEL_CREDIT.authorUrl}
            target="_blank"
            rel="noreferrer noopener"
            className="text-primary underline underline-offset-4 hover:text-foreground font-semibold"
          >
            Poly Pizza
          </a>
          .
        </p>
        <p>
          These assets are licensed under the{" "}
          <a
            href={PIECE_MODEL_CREDIT.licenseUrl}
            target="_blank"
            rel="noreferrer noopener"
            className="text-primary underline underline-offset-4 hover:text-foreground font-semibold"
          >
            Creative Commons Attribution 3.0 Unported (CC BY 3.0) License
          </a>
          . The original models have been optimized, retopologized for real-time WebGL rendering, and mapped with custom PBR textures.
        </p>
        <div className="rounded-2xl border border-border/80 bg-muted/20 p-4 font-mono text-xs text-muted-foreground space-y-1">
          <p><strong className="text-foreground font-sans">Full Attribution Notice:</strong> {PIECE_MODEL_CREDIT.text}</p>
          <p><strong className="text-foreground font-sans">License URL:</strong> {PIECE_MODEL_CREDIT.licenseUrl}</p>
          <p><strong className="text-foreground font-sans">Reference:</strong> public/models/ATTRIBUTION.md</p>
        </div>
      </LegalSection>

      <LegalSection number="2." title="Stockfish Chess Engine (GNU General Public License v3)">
        <p>
          Abay Chess incorporates the official{" "}
          <strong className="text-foreground">Stockfish</strong> chess engine (versions 11 and 18) for client-side position evaluation, computer opponent commentary, and fair-play move analysis.
        </p>
        <p>
          Stockfish is free software licensed under the{" "}
          <a
            href="https://www.gnu.org/licenses/gpl-3.0.html"
            target="_blank"
            rel="noreferrer noopener"
            className="text-primary underline underline-offset-4 hover:text-foreground font-semibold"
          >
            GNU General Public License, version 3 (GPL v3)
          </a>
          . Stockfish runs locally within your web browser via Web Workers and WebAssembly.
        </p>
        <div className="rounded-2xl border border-border/80 bg-muted/20 p-4 font-mono text-xs text-muted-foreground space-y-1.5">
          <p><strong className="text-foreground font-sans">Official Stockfish Repository:</strong> https://github.com/official-stockfish/Stockfish</p>
          <p><strong className="text-foreground font-sans">Stockfish Project Website:</strong> https://stockfishchess.org</p>
          <p><strong className="text-foreground font-sans">Local Shipped License Texts:</strong></p>
          <ul className="list-disc pl-5 space-y-1 text-foreground">
            <li><a href="/stockfish/sf11/LICENSE-GPL-3.0.txt" target="_blank" className="underline">/stockfish/sf11/LICENSE-GPL-3.0.txt</a></li>
            <li><a href="/stockfish/sf18/LICENSE-GPL-3.0.txt" target="_blank" className="underline">/stockfish/sf18/LICENSE-GPL-3.0.txt</a></li>
          </ul>
        </div>
      </LegalSection>

      <LegalSection number="3." title="Room Environments & HDR Lighting (Creative Commons CC0)">
        <p>
          The room lighting panoramas and environment reflections are provided by{" "}
          <a
            href="https://polyhaven.com"
            target="_blank"
            rel="noreferrer noopener"
            className="text-primary underline underline-offset-4 hover:text-foreground font-semibold"
          >
            Poly Haven
          </a>{" "}
          under the Creative Commons CC0 1.0 Universal (CC0) Public Domain Dedication. Attribution is provided here as courtesy recognition:
        </p>
        <div className="mt-3 overflow-x-auto rounded-2xl border border-border/80 bg-muted/10 p-4">
          <table className="w-full text-left text-xs">
            <thead>
              <tr className="border-b border-border/60 text-muted-foreground">
                <th className="pb-2 font-semibold">Environment</th>
                <th className="pb-2 font-semibold">Asset Name</th>
                <th className="pb-2 font-semibold">Photographer / Artist</th>
                <th className="pb-2 font-semibold text-right">License</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border/40 font-mono">
              {HDRI_ATTRIBUTIONS.map((item) => (
                <tr key={item.room}>
                  <td className="py-2 font-sans font-medium text-foreground">{item.room}</td>
                  <td className="py-2 text-muted-foreground">{item.asset}</td>
                  <td className="py-2 text-muted-foreground">{item.author}</td>
                  <td className="py-2 text-right text-emerald-400 font-sans font-semibold">CC0 Public Domain</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </LegalSection>

      <LegalSection number="4." title="Software Libraries & Web Standards">
        <p>
          Abay Chess incorporates foundational open-source web technologies under permissive MIT and Apache 2.0 licenses:
        </p>
        <ul className="list-disc pl-5 space-y-1">
          <li><strong className="text-foreground">Next.js &amp; React:</strong> MIT License &copy; Vercel, Inc. &amp; Meta Platforms, Inc.</li>
          <li><strong className="text-foreground">Three.js &amp; React Three Fiber:</strong> MIT License &copy; Mr.doob and pmndrs</li>
          <li><strong className="text-foreground">chess.js:</strong> BSD-2-Clause License &copy; Jeff Hlywa</li>
          <li><strong className="text-foreground">Tailwind CSS:</strong> MIT License &copy; Tailwind Labs, Inc.</li>
          <li><strong className="text-foreground">Lucide Icons:</strong> ISC License &copy; Lucide Contributors</li>
        </ul>
      </LegalSection>
    </PolicyViewer>
  );
}
