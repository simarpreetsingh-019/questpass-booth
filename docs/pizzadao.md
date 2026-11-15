# QuestPass Booth for Pizza DAO

A photo booth and video maker for every Global Pizza Party: pizza frames, mafia names, usernames and profile pictures, a page and QR code per city, all run from a spreadsheet. Guests' photos never leave their phones.

This guide is for Pizza DAO organisers. It covers everything from the first setup to adding your own frames.

**Contents**
1. [Who does what](#1-who-does-what)
2. [One-time setup](#2-one-time-setup-about-15-minutes)
3. [The look: logo, colours, words](#3-the-look-logo-colours-words)
4. [A booth for every city](#4-a-booth-for-every-city-the-spreadsheet)
5. [Mafia names](#5-mafia-names)
6. [Usernames and profile pictures](#6-usernames-and-profile-pictures)
7. [Inside rsv.pizza, Discord and NFTs](#7-inside-rsvpizza-discord-and-nfts)
8. [Your own frames](#8-your-own-frames)
9. [Updates from QuestPass](#9-updates-from-questpass)
10. [Credit](#10-credit)
11. [Questions](#11-questions)

## 1. Who does what

| | Guests (the public) | Organisers (Pizza DAO) |
|---|---|---|
| **See** | Only their city's booth page: take photos, pick a frame, add their name, save, share, make a video. | The setup page, the spreadsheet and the GitHub repository. |
| **Can change** | Their own photo, on their own phone. Nothing on the site. | The look of every booth (the settings file), each city's details (the spreadsheet), the frames. |
| **Need** | A phone and the link or QR code. | Edit access to the spreadsheet, or write access to the GitHub repository. |

The public site has **no setup page**. Organisers design the look on the setup page (hosted by QuestPass, or `npm run setup` on their computer), save it as a file in their repository, and run cities through the spreadsheet. Changes only go live through the repository and the sheet, so access to those is the admin access. Anyone else running the open-source code only gets their own copy, never yours.

## 2. One-time setup (about 15 minutes)

1. **Copy the repository.** On GitHub, open `simarpreetsingh-019/questpass-booth` → **Fork** into the Pizza DAO organisation (for example `pizzadao/booths`).
2. **Choose who can publish.** Settings → Collaborators and teams: give **Write** only to the people who run booths.
3. **Turn on hosting.** Settings → Pages → Source: **GitHub Actions**.
4. **Make the spreadsheet.** Copy the columns from [`examples/booths.csv`](../examples/booths.csv) into a Google Sheet (one row per city), then File → Share → **Publish to web** → that tab → **CSV** → Publish. Copy the link.
5. **Connect the sheet.** Settings → Secrets and variables → Actions → **Variables** → New:
   - `SHEET_URL`: the link from step 4.
   - `NAMES_URL` (optional): a published names sheet; see [section 5](#5-mafia-names).
6. **Publish.** Actions → **pages** → Run workflow.

The booths are now at `https://pizzadao.github.io/booths/booths/<city>/`, with a page listing every booth and its QR code at `…/booths/`. The workflow runs again every hour, so sheet changes go live by themselves; Run workflow does it at once.

Because `SHEET_URL` is set, the public site contains **only the booths**. Two optional variables:
- `BOOTH_LIST` = `false` hides the page listing every booth. Each booth is then reached only through its own link or QR code.
- `PUBLIC_SETUP` = `true` would also publish the setup page. Leave it off.

## 3. The look: logo, colours, words

The look shared by every booth is one settings file, `booth-base.json`, in the repository.

1. Open the setup page, either way:
   - **Nothing to install:** **https://simarpreetsingh-019.github.io/questpass-booth/setup.html**. It runs in your browser and only makes a file on your device; it can't change anyone's booths.
   - **On your computer** (Node.js 18+; this also lets "Fill in from website" read a brand's site):
     ```bash
     git clone https://github.com/pizzadao/booths && cd booths
     npm install && npm run build && npm run setup
     ```
     then open **http://localhost:8787/setup.html**.

   To edit your current look later, open the setup page and load your `booth-base.json` (Settings file → Load a file).
2. On the Settings tab:
   - **Brand:** **Upload logo** (a PNG works best), or on your computer type `pizzadao.org` and tap **Fill in from website**. Check the colours, or tap **Colours from logo**.
   - **The booth:** the title, place and date line. The sheet can override these per city.
   - **Frames:** **Pizza frames** is on. Choose which frames people can pick and which one it opens with.
   - **Text on the frames:** for every text space (the neon sign, the receipt's items, the wanted poster's crime, the card's collection name…), choose **Fixed** (your words), **People write** (guests can change them) or **Off**.
   - **Video, sharing and camera:** the share text, the booth link, the usernames and pictures.
3. Check it on the **Try the booth** tab.
4. Tap **⬇ Save settings file**. You get `booth-base.json`.
5. Put it in the repository: on GitHub, **Add file → Upload files**, drop `booth-base.json` at the top level, and commit. Every booth uses it from the next run.

The logo goes in your file, in your repository. It isn't in QuestPass's public code.

## 4. A booth for every city (the spreadsheet)

One row per city. Only `slug` or `place` is required; everything else falls back to `booth-base.json`.

| Column | Example |
|---|---|
| `slug` | `mumbai` → `…/booths/mumbai/` |
| `place`, `dates`, `title` | Mumbai · 22 May 2027 · Global Pizza Party |
| `default_frame` | `pizza-box`, `pizza-mafia`, `pizza-nft`, `pizza-receipt`, `pizza-whole`, `pizza-table` |
| `accent`, `highlight`, `base`, `text` | `#FF393A` |
| `link` | that city's own page (default: the booth itself) |
| `share_text` | Pizza the Planet from Mumbai {link} |
| `words.<space>` | `words.pizza-mafia.crime` = `edit: FOR EATING THE LAST SLICE` |

Text spaces of the pizza frames:

| Frame | Spaces |
|---|---|
| Pizza box | `pizza-box.top`, `pizza-box.to` |
| Bitcoin Pizza receipt | `pizza-receipt.item1`, `.price1`, `.item2`, `.price2`, `.paid`, `.footer` |
| Pizza Mafia wanted poster | `pizza-mafia.title`, `.crime`, `.reward`, `.stamp` |
| Rare Pizza card | `pizza-nft.collection`, `pizza-nft.rarity` |
| Pizzeria table | `pizza-table.special` |

The other frames have spaces too, such as `neon.sign`, `passport.stamps` and `lanyard.role`; [spreadsheet.md](spreadsheet.md) lists every column.

After each run, the Actions log lists anything the sheet got wrong (a colour that isn't `#RRGGBB`, text too long for its space, an http link) and what was used instead.

## 5. Mafia names

- **Whole names:** frames show the whole name ("Chorizo Corleone"), not just the first word. The fields are labelled "Your mafia name" and "Your line"; the line is printed under the photo.
- **🎲 Give me one:** makes a name from two lists, in `booth-base.json` under `person.suggest.first` and `person.suggest.last`. Edit them in the settings file.
- **Names to pick from:** a second sheet with the columns `name` and `booth` (empty = every booth; or `mumbai, lagos`). Publish it as CSV and set `NAMES_URL`. Names appear as suggestions while guests type. Only list names their owners agreed to show, because anyone who opens the booth can see them.

## 6. Usernames and profile pictures

Guests can add their username (Telegram, X or Instagram). It's shown as a tag on every frame: their picture, the network's mark and @username.

Their picture can be:
- **an upload:** a profile picture, an NFT or a selfie;
- **their public Telegram or X profile picture**, with the "Use my … picture" button. This needs the picture lookup running on a server (`createAvatarHandler`; see [integrations.md](integrations.md)). It isn't available on GitHub Pages alone, so the button is hidden there and guests upload instead.

Turn these on or off in setup, under Video, sharing and camera.

## 7. Inside rsv.pizza, Discord and NFTs

To put the booth inside rsv.pizza's party pages instead of (or as well as) GitHub Pages:

```html
<script type="module" src="https://pizzadao.github.io/booths/dist/questpass-booth.js"></script>
<questpass-booth config-src="/parties/123/booth.json" avatar-endpoint="/api/avatar"></questpass-booth>
```

- **Setup stays private:** `<questpass-booth-editor>` belongs in rsv.pizza's **host dashboard**, behind your login. Save its `change` event to the party's settings; party pages show only `<questpass-booth>`.
- **Discord login:** fill in the member's mafia name, username and picture with `booth.person = { name, line, handle, network, avatar }`.
- **NFTs:** pass the holder's Rare Pizza image as `avatar` (fetched by your server).
- **Party photos:** each finished photo arrives as a `questpass:photo` event. Ask the guest, then send it to your server, which can add it to the party gallery (the sizzle reel picks it up) or post it to Discord. Webhook URLs and bot tokens must stay on the server, never in the page.

Code for each of these is in [integrations.md](integrations.md).

## 8. Your own frames

The six pizza frames are in [`src/packs/pizza.ts`](../src/packs/pizza.ts), and they're the examples for new ones. A frame is a few drawing functions plus a description:

```js
registerFrame("pizza-oven", { label: "🔥 Pizza oven", group: "Pizza", palettes, window, back, front }, { best: "…", ratio: "9:16", pack: "pizza" });
registerWordSlot({ id: "pizza-oven.sign", frame: "pizza-oven", label: "Sign", max: 20, placeholder: "WOOD FIRED", defaultMode: "fixed" });
```

Add it to `src/packs/pizza.ts` in your copy, then run `npm run check` (the tests and a build) and `npm run setup`; the frame gallery at `/gallery.html` shows it. Give `group: "Pizza"` to keep it under **Pizza frames**. To share a frame with every event, send a pull request to QuestPass Booth.

## 9. Updates from QuestPass

New frames, fixes and features land in `simarpreetsingh-019/questpass-booth`. To get them, open your fork on GitHub and choose **Sync fork → Update branch**. The next run publishes them.

Your `booth-base.json`, your sheet and your own frames are kept. Updates within version 1 never break a settings file or the spreadsheet columns ([versioning.md](versioning.md)).

## 10. Credit

Every frame shows a small **"QuestPass · @simarpreet_019"** line, and every video ends with "Made with QuestPass". This is a free, open-source contribution, and that line is its credit, so it has no setting.

The code is Apache-2.0: you can use and change it freely, as long as the `LICENSE` and `NOTICE` files stay with it.

## 11. Questions

- **Can a guest change a booth?** No. Guests only see the booth. Booths change only through `booth-base.json` in the repository and the sheet.
- **Where do photos go?** Nowhere. They're made and kept on the guest's phone until they save or share them. See [PRIVACY.md](../PRIVACY.md).
- **The camera doesn't open.** It needs https (GitHub Pages is) and the guest's permission. "Choose photos" always works, and on phones it usually offers "Take photo" too.
- **A city's row didn't appear.** Open the latest run under Actions → pages: the log names the row and the reason.
- **Do we need a server?** No, GitHub Pages is enough. A server is only needed for "Use my Telegram/X picture" and "Fill in from website" (setup has the latter on your computer anyway).
