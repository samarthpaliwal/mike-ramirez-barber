# Mike Ramirez, Barber — website

A website in plain HTML, CSS and JavaScript (no framework) with an AI chat
assistant, a booking request form that emails Mike, and password-free sign-in
with Face ID / Touch ID for clients and for Mike.

```
index.html        Home (about Mike, badges, location, Instagram)
services.html     Services and pricing
gallery.html      Cuts gallery with pop-up technique steps
booking.html      Booking link, request form, payment, policies
login.html        Sign in with Face ID / Touch ID (passkeys)
account.html      A client's own booking requests (signed-in only)
owner.html        Mike's page: every booking request (owner only)
css/styles.css    All styling (colours and fonts are at the top)
js/               main.js, chat.js, gallery.js, booking.js, auth.js, account.js
images/           Photos — placeholders for now
netlify/functions chat.mjs (AI assistant), booking.mjs (booking emails),
                  auth.mjs (sign-in), account.mjs (account data)
netlify/lib       Code shared by the functions (email, sessions, storage)
netlify.toml      Netlify settings
```

Every place you need to change is marked in the code with `EDIT:` or `PHOTO:`.
Search the project for those two words to find them all.

---

## 1. Checklist: what to replace

- [ ] **Photos.** Drop real photos into `/images` using the *same filenames* —
      no code changes needed.
      - `mike-hero.jpg` — wide photo for the home page (about 2000 × 1300)
      - `mike-portrait.jpg` — portrait of Mike (about 1000 × 1250)
      - `fade.jpg`, `taper.jpg`, `buzz-cut.jpg`, `crew-cut.jpg`, `line-up.jpg`,
        `beard-trim.jpg`, `kids-cuts.jpg` — portrait shots (about 1000 × 1250)
      - Keep each file under ~300 KB so the site stays fast (squoosh.app is a
        free tool for this).
- [ ] **Notification email address.** Set `NOTIFY_EMAIL` in Netlify (step 3
      below). This is where booking requests are sent.
- [ ] **API keys.** Set `ANTHROPIC_API_KEY` (chat assistant) and
      `RESEND_API_KEY` (booking emails) in Netlify. Never paste keys into the
      code.
- [ ] **Sign-in settings.** Set `SESSION_SECRET` in Netlify (step 3). The
      owner page opens for `OWNER_EMAIL`, or `NOTIFY_EMAIL` if that isn't set.
- [ ] **Shop hours.** Replace "By appointment" in three places: the footer of
      each page, the location block on `index.html` and `booking.html`, and the
      `HOURS:` line in `netlify/functions/chat.mjs` so the assistant can answer.
- [ ] **Website address.** Once the site is live, find-and-replace
      `YOUR-SITE.netlify.app` with the real address in all four HTML files
      (used for social sharing previews and Google).
- [ ] **Bio and policies.** The bio on `index.html` and the arrival and
      cancellation notes on `booking.html` are starter text — edit to taste.
- [ ] **Prices.** If a price changes, update it in `services.html`,
      `booking.html` (the dropdown) and `netlify/functions/chat.mjs`.

---

## 2. Accounts you need (all have free tiers)

| Service | What it does | Where |
|---|---|---|
| Netlify | Hosts the site and runs the two functions | netlify.com |
| GitHub | Holds the files so Netlify can deploy them | github.com |
| Anthropic | The Claude API key for the chat assistant (pay-as-you-go, needs a small credit balance) | console.anthropic.com |
| Resend | Sends the booking emails | resend.com |

**About Resend:** to send the automatic confirmation to clients, Resend
requires you to verify a domain you own (Resend → Domains → Add domain). Until
you do, its test sender only delivers to the email address you signed up
with — so Mike's notifications work if `NOTIFY_EMAIL` is that address, but
client confirmations will not go out. After verifying a domain, set
`FROM_EMAIL` to something like `Mike Ramirez, Barber <bookings@yourdomain.com>`.

---

## 3. Deploy for free on Netlify

The chat assistant and booking form are serverless functions, so deploy from
GitHub (drag-and-drop uploads do not build functions).

1. **Put this folder in its own GitHub repository.**
   Move the `mike-ramirez-barber` folder somewhere on its own, then in a
   terminal inside it:

   ```bash
   git init && git add . && git commit -m "Mike Ramirez barber site"
   ```

   Create a new empty repository on github.com and follow its "push an existing
   repository" instructions.

2. **Create the Netlify site.** In Netlify: **Add new project → Import an
   existing project → GitHub**, then pick the repository. Leave every build
   setting as it is — `netlify.toml` already sets them. Click **Deploy**.

3. **Set the environment variables.** In Netlify open **Project configuration →
   Environment variables → Add a variable** (called *Site configuration* on
   older accounts) and add:

   | Key | Value |
   |---|---|
   | `ANTHROPIC_API_KEY` | Your Claude API key (starts with `sk-ant-`) |
   | `RESEND_API_KEY` | Your Resend API key (starts with `re_`) |
   | `NOTIFY_EMAIL` | The inbox that should receive booking requests |
   | `FROM_EMAIL` | *(optional until a domain is verified)* e.g. `Mike Ramirez, Barber <bookings@yourdomain.com>` |
   | `SESSION_SECRET` | A long random secret for sign-in. Generate one by running `openssl rand -hex 32` in a terminal and pasting the result. Keep it private. |
   | `OWNER_EMAIL` | *(optional)* The email that gets the owner page. Defaults to `NOTIFY_EMAIL`. |

4. **Redeploy** so the functions pick up the variables: **Deploys → Trigger
   deploy → Deploy project**.

5. **Test it.** Open the site, ask the chat bubble "How much is a haircut?",
   and submit the booking form with your own email. If something fails, look at
   **Logs → Functions** in Netlify — both functions log a plain-English reason.

6. **Rename the site** (optional): **Project configuration → Change project
   name** gives you `your-name.netlify.app`. You can also connect a custom
   domain under **Domain management**. Then do the `YOUR-SITE.netlify.app`
   find-and-replace from the checklist and push the change.

### Previewing on your own computer

Opening the HTML files directly shows the pages, but the chat and form need the
functions. To run everything locally:

```bash
npm install && npm install -g netlify-cli
```

Copy `.env.example` to `.env`, fill in the keys, then:

```bash
netlify dev
```

---

## 4. About the chat assistant

- Its entire knowledge is the `SYSTEM_PROMPT` in `netlify/functions/chat.mjs`.
  It is told to send anything else to (520) 548-9830.
- It runs on Claude Opus 5.5 (`MODEL` at the top of that file). For lower
  cost, change it to `claude-haiku-5-5` and delete the two lines marked
  `FALLBACK`.
- A refusal fallback is switched on: if the model declines a message,
  Anthropic automatically retries on another model. Those two `FALLBACK` lines
  can be removed if you don't want that.
- It costs a small amount per conversation. Set a monthly spend limit in the
  Anthropic console so there are no surprises.

---

## 5. Sign-in with Face ID / Touch ID

The site uses **passkeys**, the standard behind "Sign in with Face ID". There
are no passwords at all.

**How it works for a person**

1. On `login.html` they enter their name and email. The site emails a 6-digit
   code to prove the address is theirs.
2. They type the code, and their phone or computer asks for Face ID / Touch ID
   and saves a passkey to its keychain (iCloud Keychain on Apple devices, so it
   syncs to their other Apple devices).
3. From then on, **Sign in with Face ID / Touch ID** is one tap.
4. New phone that doesn't have the passkey? They repeat steps 1–2 on it.

**Who sees what**

- **Clients** land on `account.html` and see only the booking requests sent
  with their own email address.
- **Mike** lands on `owner.html` and sees every request, with tap-to-call and
  a "Mark as handled" button. He is whoever can receive email at `OWNER_EMAIL`
  — set that up first, then have Mike do steps 1–2 on his phone.

**What keeps it secure**

- Only the public half of each passkey is stored. Faces and fingerprints never
  leave the device.
- Every sign-in requires Face ID / Touch ID (or the device passcode).
- The session is a signed, HttpOnly, Secure cookie that lasts 7 days.
- All access rules are enforced in the functions, not in the page.
- Accounts and requests are stored in Netlify Blobs (built in — nothing to set
  up).

**Things to know**

- Sign-up needs the emailed code, so it only works for clients once a domain
  is verified in Resend (section 2). Before that, only the address you signed
  up to Resend with can receive a code.
- Passkeys are tied to the website's address. If you later move from
  `something.netlify.app` to your own domain, everyone sets up their device
  once more on the new address. Decide on the final domain early if you can.
- Booking requests are saved from the moment this version is deployed.
  Requests made before that only exist as emails.
- It needs HTTPS (Netlify provides it) or `localhost`.

---

## 6. Three optional upgrades

1. **Reviews section.** Add a strip of client reviews to the home page — typed
   in by hand to start, or pulled live from Google with the Places API.
2. **Google Business Profile integration.** Link the site from Mike's Google
   Business Profile, add real opening hours to the schema markup in each page's
   `<head>`, and add a "Leave a review" button that opens the Google review
   form.
3. **Live Instagram feed.** Replace the four static tiles on the home page with
   Mike's latest posts using a free widget such as Behold or LightWidget, so the
   site updates itself whenever he posts.
