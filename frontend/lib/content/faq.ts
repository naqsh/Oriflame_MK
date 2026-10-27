/**
 * Visitor questions answered on /referral (OR-041). Facts only: no delivery times,
 * discounts, efficacy or attribution promises. Owner review is tracked by
 * CONTENT_REVIEWED in ./review.ts.
 */
export interface FaqItem {
  question: string;
  answer: string;
}

export const REFERRAL_FAQ: readonly FaqItem[] = [
  {
    question: "Is this the official Oriflame website?",
    answer:
      "No. This is an independent storefront for browsing Oriflame Pakistan products, run by an independent Oriflame consultant. Orders are placed on Oriflame's official website.",
  },
  {
    question: "How do I order a product I found here?",
    answer:
      "Add products to your list, then select \"Buy from Oriflame\". You continue on Oriflame's official Pakistan website, find the same products there and place your order with Oriflame.",
  },
  {
    question: "Where do I pay, and who delivers my order?",
    answer:
      "Checkout, payment and delivery all happen on Oriflame's official website, under Oriflame's terms. This site never asks for your address or payment details.",
  },
  {
    question: "What is the consultant code for?",
    answer:
      "When a consultant code is shown, entering it on Oriflame tells Oriflame you came through this store. Whether it applies to your order is decided by Oriflame. When the store uses a link instead, there is no code to enter.",
  },
  {
    question: "Are the prices here exact?",
    answer:
      "Prices are shown in Pakistani rupees (PKR) where available and are indicative. They can change on Oriflame, and the price shown on Oriflame's website when you order is the one that applies.",
  },
  {
    question: "What does \"Availability not confirmed\" mean?",
    answer:
      "This site does not check stock. Every product shows \"Availability not confirmed\", and Oriflame shows whether a product can be ordered when you get there.",
  },
  {
    question: "Will my shopping list be sent to Oriflame?",
    answer:
      "No. Your list stays in your browser. When you continue to Oriflame, we show the items so you can add them there yourself.",
  },
];
