/**
 * Owner-approved contact details come from server-side settings, never from source:
 * CONTACT_EMAIL and CONTACT_WHATSAPP (international format, digits only, e.g. 923001234567).
 * Unset values are simply not shown.
 */
export interface ContactDetails {
  email: string | null;
  whatsapp: string | null;
}

const EMAIL = /^[^\s@<>"']+@[^\s@<>"']+\.[^\s@<>"']+$/;
const WHATSAPP = /^\d{10,15}$/;

export function getContactDetails(): ContactDetails {
  const email = process.env.CONTACT_EMAIL?.trim() ?? "";
  const whatsapp = process.env.CONTACT_WHATSAPP?.trim().replace(/^\+/, "") ?? "";
  return {
    email: EMAIL.test(email) ? email : null,
    whatsapp: WHATSAPP.test(whatsapp) ? whatsapp : null,
  };
}
