"use client";

import Link from "next/link";
import { ArrowRight, Check, LockKeyhole, ShieldCheck } from "lucide-react";
import { useState } from "react";

type BillingCycle = "monthly" | "annual";

const plans = [
  {
    name: "Free",
    note: "Try the complete workflow",
    monthlyPrice: 0,
    annualPrice: 0,
    annualTotal: 0,
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
    annualPrice: 17.1,
    annualTotal: 205.2,
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
    annualPrice: 62.1,
    annualTotal: 745.2,
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
  const [billingCycle, setBillingCycle] = useState<BillingCycle>("monthly");

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
          <div className="billing-toggle" aria-label="Billing cycle">
            <button
              type="button"
              aria-pressed={billingCycle === "monthly"}
              onClick={() => setBillingCycle("monthly")}
            >
              Monthly
            </button>
            <button
              type="button"
              aria-pressed={billingCycle === "annual"}
              onClick={() => setBillingCycle("annual")}
            >
              Annual <span>Save 10%</span>
            </button>
          </div>
        </div>
      </header>

      <section className="pricing-grid" aria-label="Pricing plans">
        {plans.map((plan, index) => {
          const displayedPrice = billingCycle === "annual" ? plan.annualPrice : plan.monthlyPrice;

          return (
            <article className={`price-card${plan.featured ? " featured" : ""}`} key={plan.name}>
              <div className="plan-index">0{index + 1}</div>
              {plan.featured ? <div className="popular-tag">Most popular</div> : null}
              <p className="plan-note">{plan.note}</p>
              <h2>{plan.name}</h2>
              <div className="plan-price">
                <span>$</span>
                <strong>{displayedPrice.toFixed(displayedPrice % 1 === 0 ? 0 : 2)}</strong>
                <small>{plan.name === "Free" ? "forever" : "/ month"}</small>
              </div>
              <div className="billing-detail">
                {plan.name === "Free"
                  ? "No card required"
                  : billingCycle === "annual"
                    ? `Billed $${plan.annualTotal.toFixed(2)} yearly`
                    : "Billed monthly"}
              </div>
              <div className="plan-allowance">{plan.allowance}</div>
              <p className="plan-description">{plan.description}</p>
              <ul className="plan-features">
                {plan.features.map((feature) => (
                  <li key={feature}><Check size={15} strokeWidth={2.5} /> {feature}</li>
                ))}
              </ul>
              <Link className="plan-cta" href="/register" prefetch={false}>
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
          <div><span>03</span><h3>Monthly reset</h3><p>Plus and Pro credits refresh each billing month and do not roll over.</p></div>
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
