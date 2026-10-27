import type { Metadata } from "next";
import { FAQ } from "@/lib/faq";
import { LEGAL } from "@/lib/legal";

export const metadata: Metadata = {
  title: "Questions fréquentes",
  description: "Tout savoir sur PronoRadar : fonctionnement de l'IA, offre gratuite et Premium, paiement Wave et Orange Money, compte et sécurité.",
  alternates: { canonical: "/faq" },
};

export default function FaqPage() {
  const jsonLd = {
    "@context": "https://schema.org",
    "@type": "FAQPage",
    mainEntity: FAQ.map((f) => ({ "@type": "Question", name: f.q, acceptedAnswer: { "@type": "Answer", text: f.a } })),
  };
  return (
    <>
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }} />
      <h1>Questions fréquentes</h1>
      <p>Une autre question ? Écrivez-nous sur <a href={LEGAL.whatsappLink}>WhatsApp</a>.</p>
      <div className="mt-6 space-y-3">
        {FAQ.map((f) => (
          <details key={f.q} className="group rounded-2xl bg-surface p-4">
            <summary className="cursor-pointer list-none font-semibold text-text">
              <span className="flex items-center justify-between gap-3">
                {f.q}
                <span className="text-muted transition group-open:rotate-45">+</span>
              </span>
            </summary>
            <p>{f.a}</p>
          </details>
        ))}
      </div>
    </>
  );
}
