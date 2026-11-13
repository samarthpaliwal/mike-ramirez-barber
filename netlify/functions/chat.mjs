/* ==========================================================================
   Chat assistant — Netlify Function
   URL once deployed:  /.netlify/functions/chat

   The browser sends the conversation here; this function calls the Claude API
   and returns the reply. The API key is read from the ANTHROPIC_API_KEY
   environment variable (set it in Netlify, see README.md). It is never sent
   to the browser and must never be pasted into this file.
   ========================================================================== */

import Anthropic from "@anthropic-ai/sdk";

/* ---- Settings you may want to change ---------------------------------- */

// Which Claude model answers. "claude-opus-5-5" gives the best answers.
// "claude-haiku-5-5" is far cheaper and fine for simple FAQs — if you switch
// to it, also delete the two lines marked FALLBACK below (Haiku doesn't
// support them).
const MODEL = "claude-opus-5-5";

const PHONE = "(520) 548-9830";
const FALLBACK_REPLY = `Sorry, I can't help with that right now. Please call or text Mike at ${PHONE}.`;

// EDIT: this is everything the assistant knows. If a price, the address or
// the booking link changes, change it here too. Add shop hours on the HOURS
// line once you have them.
const SYSTEM_PROMPT = `You are the friendly booking assistant on the website of Mike Ramirez, a barber. You chat with clients in a small chat window, mostly on phones.

FACTS — these are the only facts you know. Never add to them or guess.
- Barber: Mike Ramirez, a licensed barber with 15+ years of experience. All ages welcome.
- Shop: Double Edged Barbershop, 1065 E Tucson Marketplace Blvd, Tucson, AZ.
- Phone (call or text): ${PHONE}.
- Instagram: @MikeTheBarber92.
- Online booking link: https://getsqr.co/michael-ramirez-6
- Booking request form on this website: /booking.html#request
- Services and prices:
  - Adult Haircut, $40. A full cut (fade, taper, scissor cut or classic cut) with a consultation, line-up and styling.
  - Adult Haircut and Beard, $45. Everything in the adult haircut plus a beard trim: shaped, blended and edged.
  - Kids Haircut, $35. A patient, friendly cut for children.
- Every appointment goes: consultation, the cut, the finish (edges and clean-up), then styling advice.
- Payment methods: Apple Pay, Cash App and Zelle, all sent to ${PHONE}.
- Cuts Mike does include fades, tapers, buzz cuts, crew cuts, line-ups, beard trims and kids cuts.
- HOURS: not listed here. Available times are shown on the online booking link.

WHAT YOU DO
- Answer questions about prices, location, payment methods and what each service includes.
- Recommend one of the three services based on what the client describes. For example: wants hair and beard done, recommend Adult Haircut and Beard; booking for a child, recommend Kids Haircut. A fade, taper, buzz cut, crew cut or line-up for an adult is the Adult Haircut.
- Walk clients through booking one step at a time: first ask which service (or help them pick), then ask what day and time they have in mind, then hand them off. Hand off by giving the online booking link for an instant confirmed slot, or the booking request form if they would rather have Mike confirm a time. You cannot book, check availability or confirm appointments yourself, so never say an appointment is booked.

RULES
- Keep replies short and friendly: one to three sentences. Ask only one question at a time.
- Write plain text only. No markdown, no bullet symbols, no asterisks. Write links as full URLs, and write the request form exactly as /booking.html#request
- If you are asked something the facts above do not cover (hours, availability on a specific day, parking, other services, discounts, anything else), or you cannot help, say you are not sure and tell the client to call or text ${PHONE}.
- Stay on the topic of Mike's barber services. Politely decline anything unrelated and offer to help with booking instead.
- Do not give medical advice about skin or scalp conditions; suggest they ask Mike directly.`;

/* ---- Limits that keep usage (and cost) under control ------------------- */
const MAX_MESSAGES = 12;      // most recent messages sent to the model
const MAX_CHARS = 600;        // per message

/* ----------------------------------------------------------------------- */

const json = (body, status = 200) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json", "Cache-Control": "no-store" },
  });

// Accept only well-formed { role, content } text messages from the browser.
function cleanMessages(input) {
  if (!Array.isArray(input)) return null;
  const messages = input
    .filter((m) => m && (m.role === "user" || m.role === "assistant") && typeof m.content === "string" && m.content.trim())
    .map((m) => ({ role: m.role, content: m.content.trim().slice(0, MAX_CHARS) }))
    .slice(-MAX_MESSAGES);
  while (messages.length && messages[0].role !== "user") messages.shift();
  if (!messages.length || messages[messages.length - 1].role !== "user") return null;
  return messages;
}

export default async (req) => {
  if (req.method !== "POST") return json({ error: "Method not allowed" }, 405);

  if (!process.env.ANTHROPIC_API_KEY) {
    console.error("ANTHROPIC_API_KEY is not set — add it in Netlify > Site configuration > Environment variables.");
    return json({ reply: FALLBACK_REPLY });
  }

  let body;
  try {
    body = await req.json();
  } catch {
    return json({ error: "Invalid JSON" }, 400);
  }

  const messages = cleanMessages(body?.messages);
  if (!messages) return json({ error: "No message to answer" }, 400);

  // Reads ANTHROPIC_API_KEY from the environment.
  const client = new Anthropic();

  try {
    const response = await client.beta.messages.create({
      model: MODEL,
      max_tokens: 2000,
      output_config: { effort: "low" }, // quick, short answers
      betas: ["server-side-fallback-2026-07-01"], // FALLBACK: if the model declines a message,
      fallbacks: "default",                       // FALLBACK: Anthropic retries it on another model.
      system: SYSTEM_PROMPT,
      messages,
    });

    if (response.stop_reason === "refusal") return json({ reply: FALLBACK_REPLY });

    const reply = response.content
      .filter((block) => block.type === "text")
      .map((block) => block.text)
      .join("")
      .trim();

    return json({ reply: reply || FALLBACK_REPLY });
  } catch (error) {
    if (error instanceof Anthropic.AuthenticationError) {
      console.error("Claude API key was rejected — check ANTHROPIC_API_KEY.");
    } else if (error instanceof Anthropic.RateLimitError) {
      console.error("Claude API rate limit reached.");
    } else if (error instanceof Anthropic.APIError) {
      console.error(`Claude API error ${error.status}: ${error.message}`);
    } else {
      console.error("Chat function error:", error);
    }
    // The client never sees error details — just the call-or-text fallback.
    return json({ reply: FALLBACK_REPLY });
  }
};
