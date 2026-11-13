# Mike Ramirez, Barber — website

A four-page site (plain HTML, CSS and JavaScript — no framework) with an AI chat
assistant and a booking request form that emails Mike.

```
index.html        Home (about Mike, badges, location, Instagram)
services.html     Services and pricing
gallery.html      Cuts gallery with pop-up technique steps
booking.html      Booking link, request form, payment, policies
css/styles.css    All styling (colours and fonts are at the top)
js/               main.js, chat.js, gallery.js, booking.js
images/           Photos — placeholders for now
netlify/functions chat.mjs (AI assistant), booking.mjs (booking emails)
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
   existing project → GitHub**, then pick the repository. Leave the build
   command empty; the publish directory (`.`) and functions folder are already
   set by `netlify.toml`. Click **Deploy**.

3. **Set the environment variables.** In Netlify open **Project configuration →
   Environment variables → Add a variable** (called *Site configuration* on
   older accounts) and add:

   | Key | Value |
   |---|---|
   | `ANTHROPIC_API_KEY` | Your Claude API key (starts with `sk-ant-`) |
   | `RESEND_API_KEY` | Your Resend API key (starts with `re_`) |
   | `NOTIFY_EMAIL` | The inbox that should receive booking requests |
   | `FROM_EMAIL` | *(optional until a domain is verified)* e.g. `Mike Ramirez, Barber <bookings@yourdomain.com>` |

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

## 5. Three optional upgrades

1. **Reviews section.** Add a strip of client reviews to the home page — typed
   in by hand to start, or pulled live from Google with the Places API.
2. **Google Business Profile integration.** Link the site from Mike's Google
   Business Profile, add real opening hours to the schema markup in each page's
   `<head>`, and add a "Leave a review" button that opens the Google review
   form.
3. **Live Instagram feed.** Replace the four static tiles on the home page with
   Mike's latest posts using a free widget such as Behold or LightWidget, so the
   site updates itself whenever he posts.
