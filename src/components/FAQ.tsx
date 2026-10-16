"use client";

import { dictionary, Language } from "@/lib/dictionary";

interface FAQProps {
  lang: Language;
}

export function FAQ({ lang }: FAQProps) {
  const t = dictionary[lang];

  const faqs = [
    { q: t.faq_q1, a: t.faq_a1 },
    { q: t.faq_q2, a: t.faq_a2 },
    { q: t.faq_q3, a: t.faq_a3 },
    { q: t.faq_q4, a: t.faq_a4 },
  ];

  return (
    <section
      id="faq"
      className="w-full pt-16 pb-12 md:pt-20 md:pb-16 bg-muted/30 border-t border-muted/20"
    >
      <div className="mx-auto max-w-3xl px-6">
        <div className="text-center mb-8 md:mb-10">
          <h2 className="text-3xl font-bold tracking-tight sm:text-4xl mb-2">
            {t.faq_title_full}
          </h2>
        </div>

        <div className="space-y-8">
          {faqs.map((item, index) => (
            <div key={index} className="border-b pb-6 last:border-0">
              <h3 className="text-lg font-semibold mb-3">{item.q}</h3>
              <p className="text-muted-foreground leading-relaxed">{item.a}</p>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
