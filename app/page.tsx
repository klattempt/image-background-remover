import { BackgroundRemover } from "@/components/background-remover";

const faq = [
  {
    question: "Are my images stored?",
    answer:
      "No. Images pass through our Cloudflare worker to remove.bg and return to this tab. We do not save originals or results.",
  },
  {
    question: "What files work best?",
    answer:
      "JPG, PNG, and WebP product photos up to 15 MB. A clear subject and visible contrast produce the cleanest edges.",
  },
  {
    question: "What does the export include?",
    answer:
      "Each result is a 2000 × 2000 JPEG with a clean white background and the product centered at a consistent scale.",
  },
];

export default function Home() {
  const faqSchema = {
    "@context": "https://schema.org",
    "@type": "FAQPage",
    mainEntity: faq.map((item) => ({
      "@type": "Question",
      name: item.question,
      acceptedAnswer: { "@type": "Answer", text: item.answer },
    })),
  };

  return (
    <main>
      <BackgroundRemover />
      <section className="faq-section" id="faq" aria-labelledby="faq-heading">
        <div className="section-kicker">The practical details</div>
        <h2 id="faq-heading">Before the first batch.</h2>
        <div className="faq-grid">
          {faq.map((item, index) => (
            <article className="faq-card" key={item.question}>
              <span>0{index + 1}</span>
              <h3>{item.question}</h3>
              <p>{item.answer}</p>
            </article>
          ))}
        </div>
      </section>
      <footer>
        <div className="wordmark">CUTLINE</div>
        <p>Built for the quiet, repetitive work behind every good catalog.</p>
        <p>Images are processed in transit and are not stored by us.</p>
      </footer>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(faqSchema) }}
      />
    </main>
  );
}
