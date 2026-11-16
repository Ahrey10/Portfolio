# Rey Mar Britania — Portfolio
React 18 + TypeScript (strict) + Vite + Three.js. No UI framework.

    npm install
    npm run dev       # local dev
    npm run build     # production build in dist/

Content lives in `src/data.ts`. Project images go in `public/systems/` and are referenced by `image` in the data file. A project without an image, or with a broken one, shows `public/systems/default.svg`.

## Contact form (EmailJS, no mail client opens)
1. Create an account at emailjs.com and add your Gmail under Email Services.
2. Create a template using `{{from_name}}`, `{{reply_to}}` and `{{message}}`; set To Email to your Gmail.
3. Copy `.env.example` to `.env` and fill `VITE_EMAILJS_SERVICE_ID`, `VITE_EMAILJS_TEMPLATE_ID`, `VITE_EMAILJS_PUBLIC_KEY`.
4. In the EmailJS dashboard, restrict the public key to your site's domain.

## Checklist before publishing
- [ ] `.env` keys set, and one real test message received in Gmail
- [ ] Review every screenshot in `public/systems/` for leftover sensitive data
- [ ] Check the 3D background on a phone (lower `N` in `Background.tsx` if it stutters)
