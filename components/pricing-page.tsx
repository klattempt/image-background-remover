"use client";

import Link from "next/link";
import { ArrowRight, Check, LockKeyhole, ShieldCheck } from "lucide-react";
import { useEffect, useState } from "react";

const plans = [
  {
    name: "Free",
    note: "Try the complete workflow",
    monthlyPrice: 0,
    allowance: "3 images once",
    description: "A no-cost first batch to see how Cutline fits your product workflow.",
    features: ["Up to 20 images per batch", "White JPG export", "Individual and ZIP downloads"],
    cta: "Start for free",
    featured: false,
  },
  {
    name: "Plus",
    note: "For growing stores",
    monthlyPrice: 19,
    allowance: "40 images / month",
    description: "Reliable background removal for regular product launches and catalog updates.",
    features: ["Everything in Free", "40 successful outputs monthly", "Retry failed images at no charge"],
    cta: "Choose Plus",
    featured: false,
  },
  {
    name: "Pro",
    note: "For active catalogs",
    monthlyPrice: 69,
    allowance: "200 images / month",
    description: "More monthly capacity for teams processing product photography at scale.",
    features: ["Everything in Plus", "200 successful outputs monthly", "Up to 20 images per batch"],
    cta: "Choose Pro",
    featured: true,
  },
] as const;

const comparisonRows = [
  ["Image credits", "3 once", "40 / month", "200 / month"],
  ["Images per batch", "20", "20", "20"],
  ["Background removal", true, true, true],
  ["2000 × 2000 white JPG", true, true, true],
  ["Individual + ZIP download", true, true, true],
  ["Failed attempts charged", "No", "No", "No"],
  ["Image storage", "None", "None", "None"],
] as const;

export function PricingPage() {
  const [cancelled, setCancelled] = useState(false);

  useEffect(() => {
    const timer = window.setTimeout(() => {
      setCancelled(new URLSearchParams(window.location.search).get("payment") === "cancelled");
    }, 0);
    return () => window.clearTimeout(timer);
  }, []);

  return (
    <main className="pricing-page">
      <nav className="pricing-nav" aria-label="Pricing navigation">
        <Link className="brand" href="/" aria-label="Cutline home" prefetch={false}>
          <span className="brand-mark"><span /></span>
          CUTLINE
        </Link>
        <div className="pricing-nav-actions">
          <Link href="/" prefetch={false}>Studio</Link>
          <Link className="login-link" href="/register#login" prefetch={false}>Sign in</Link>
        </div>
      </nav>

      {cancelled ? (
        <div className="payment-banner" role="status">
          Payment cancelled. No charge was made. You can choose a plan whenever you are ready.
        </div>
      ) : null}

      <header className="pricing-hero">
        <div>
          <div className="eyebrow"><span>02</span> Simple pricing</div>
          <h1>Pay for clean<br /><em>product shots.</em></h1>
        </div>
        <div className="pricing-hero-copy">
          <p>
            Every credit is one successfully processed image. Failed attempts cost nothing,
            and your files are processed in transit—never stored.
          </p>
          <div className="one-time-note"><strong>One-time purchase</strong><span>30 days of image credits. No automatic renewal.</span></div>
        </div>
      </header>

      <section className="pricing-grid" aria-label="Pricing plans">
        {plans.map((plan, index) => {
          return (
            <article className={`price-card${plan.featured ? " featured" : ""}`} key={plan.name}>
              <div className="plan-index">0{index + 1}</div>
              {plan.featured ? <div className="popular-tag">Most popular</div> : null}
              <p className="plan-note">{plan.note}</p>
              <h2>{plan.name}</h2>
              <div className="plan-price">
                <span>$</span>
                <strong>{plan.monthlyPrice.toFixed(0)}</strong>
                <small>{plan.name === "Free" ? "forever" : "one time"}</small>
              </div>
              <div className="billing-detail">
                {plan.name === "Free" ? "No card required" : "Credits valid for 30 days"}
              </div>
              <div className="plan-allowance">{plan.allowance}</div>
              <p className="plan-description">{plan.description}</p>
              <ul className="plan-features">
                {plan.features.map((feature) => (
                  <li key={feature}><Check size={15} strokeWidth={2.5} /> {feature}</li>
                ))}
              </ul>
              <Link
                className="plan-cta"
                href={plan.name === "Free" ? "/register" : `/checkout?plan=${plan.name.toLowerCase()}`}
                prefetch={false}
              >
                {plan.cta} <ArrowRight size={17} />
              </Link>
            </article>
          );
        })}
      </section>

      <section className="pricing-trust" aria-label="Service assurances">
        <div><ShieldCheck size={22} /><span><strong>Only successful outputs count</strong>Failed processing never uses a credit.</span></div>
        <div><LockKeyhole size={22} /><span><strong>Processed in transit</strong>Your uploaded images are never stored.</span></div>
        <div><span className="trust-number">20</span><span><strong>Built for batches</strong>Process up to 20 images in one run.</span></div>
      </section>

      <section className="comparison-section">
        <div className="comparison-heading">
          <div>
            <div className="section-kicker">Plan comparison</div>
            <h2>Same workflow.<br />More capacity.</h2>
          </div>
          <p>All three plans include the complete Cutline production workflow. Choose based on how many finished images you need.</p>
        </div>
        <div className="comparison-scroll">
          <table className="pricing-table">
            <thead>
              <tr><th>Included</th><th>Free</th><th>Plus</th><th>Pro</th></tr>
            </thead>
            <tbody>
              {comparisonRows.map(([label, ...values]) => (
                <tr key={label}>
                  <th scope="row">{label}</th>
                  {values.map((value, index) => (
                    <td key={`${label}-${index}`}>
                      {value === true ? <Check size={16} aria-label="Included" /> : value}
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>

      <section className="credit-rules">
        <div className="section-kicker">Credit rules / plain and simple</div>
        <div className="rule-grid">
          <div><span>01</span><h3>Success uses one</h3><p>A credit is deducted only when a finished background-removed image is delivered.</p></div>
          <div><span>02</span><h3>Failures are free</h3><p>If processing fails, retry the image without losing a credit.</p></div>
          <div><span>03</span><h3>Valid for 30 days</h3><p>Plus and Pro are one-time purchases. Credits expire 30 days after payment.</p></div>
          <div><span>04</span><h3>Free means once</h3><p>The three Free credits are available once for each registered account.</p></div>
        </div>
      </section>

      <section className="pricing-final">
        <div>
          <div className="section-kicker">Ready when you are</div>
          <h2>Turn the next batch<br />into a clean catalog.</h2>
        </div>
        <div>
          <p>Start with three images. Upgrade when your catalog is ready for more.</p>
          <Link className="plan-cta" href="/register" prefetch={false}>Create free account <ArrowRight size={18} /></Link>
        </div>
      </section>

      <footer className="pricing-footer">
        <div className="wordmark">CUTLINE</div>
        <p>Batch product photography, production ready.</p>
        <p>Simple credits. No image storage. No charge for failed outputs.</p>
      </footer>
    </main>
  );
}
