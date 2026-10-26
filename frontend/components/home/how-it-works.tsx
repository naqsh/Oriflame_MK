import Link from "next/link";

const STEPS = [
  {
    title: "Browse and shortlist",
    text: "Find products here and keep a shopping list in your browser. No account needed.",
  },
  {
    title: "Continue to Oriflame",
    text: "Open the product on Oriflame's official Pakistan website.",
  },
  {
    title: "Order and pay on Oriflame",
    text: "Checkout, payment and delivery are handled by Oriflame, not by this site.",
  },
] as const;

export function HowItWorks() {
  return (
    <section aria-labelledby="how-it-works" className="space-y-4 rounded-lg border p-6">
      <h2 id="how-it-works" className="font-heading text-2xl font-semibold">
        How it works
      </h2>
      <ol className="grid gap-4 sm:grid-cols-3">
        {STEPS.map((step, index) => (
          <li key={step.title} className="space-y-1">
            <p className="font-medium">
              {index + 1}. {step.title}
            </p>
            <p className="text-sm text-muted-foreground">{step.text}</p>
          </li>
        ))}
      </ol>
      <Link href="/referral" className="inline-block text-sm font-medium underline">
        More about buying through Oriflame
      </Link>
    </section>
  );
}
