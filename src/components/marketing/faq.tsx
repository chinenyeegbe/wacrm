import { ChevronDown } from "lucide-react";

/**
 * FAQ section for the landing pages. Objection-handling is conversion work:
 * the questions are the doubts that stop someone signing up, answered in
 * plain words.
 *
 * Zero client JS, native <details>/<summary> give an accessible accordion
 * that works on the cheapest phone. Also emits FAQPage structured data so
 * the answers can show up directly in search results.
 */

export interface FaqItem {
  q: string;
  a: string;
}

export function Faq({ title, items }: { title: string; items: FaqItem[] }) {
  const jsonLd = {
    "@context": "https://schema.org",
    "@type": "FAQPage",
    mainEntity: items.map((item) => ({
      "@type": "Question",
      name: item.q,
      acceptedAnswer: { "@type": "Answer", text: item.a },
    })),
  };

  return (
    <section className="mx-auto w-full max-w-3xl px-4 py-14 sm:px-6">
      <h2 className="text-center text-2xl font-bold sm:text-3xl">{title}</h2>
      <div className="mt-8 flex flex-col gap-3">
        {items.map((item) => (
          <details
            key={item.q}
            className="group rounded-xl border border-border bg-card p-5 [&_summary::-webkit-details-marker]:hidden"
          >
            <summary className="flex cursor-pointer list-none items-center justify-between gap-4 font-medium text-foreground">
              {item.q}
              <ChevronDown className="h-4 w-4 shrink-0 text-muted-foreground transition-transform group-open:rotate-180" />
            </summary>
            <p className="mt-3 text-sm text-muted-foreground">{item.a}</p>
          </details>
        ))}
      </div>

      {/* FAQ structured data for search engines. */}
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }}
      />
    </section>
  );
}
