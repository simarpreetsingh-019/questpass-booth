# Privacy

QuestPass Booth is built so that the people using a booth don't have to trust anyone with their photos.

- **Photos and videos stay on the device.** The camera feed, the shots and the finished photos and videos are made and kept in the browser's memory. Nothing is uploaded, and everything is gone when the page closes. Saving or sharing uses the phone's own download or share sheet.
- **The camera is on only while it's needed.** It stops as soon as a photo is taken, when the page is hidden or left, when the booth is removed from the page, and a set time after it's opened (30 seconds by default), whatever is going on. A "Turn off" button is always shown while it's on.
- **No tracking.** There are no analytics, cookies, accounts, browser storage or third-party requests. The fonts come from the same place as the booth's script.
- **Only what's typed.** A name or caption someone types is drawn onto their own photo and goes nowhere else.

**What the host page can do.** The page the booth is on receives each finished photo and video as an event, so it can offer to add them to its own gallery. That's the host's code and the host's privacy policy, not this package's. Hosts should ask before uploading.

**The picture lookup** (`questpass-booth/server`, optional) runs on the host's server when someone taps "Use my Telegram/X picture". It sends that username, and nothing else, to Telegram (or, if the host switched it on, the fxtwitter.com service for X) to get the public profile picture. It keeps nothing.

**The brand lookup** (`questpass-booth/server`, optional) runs on the host's server. It fetches a brand's public web page and icons when someone setting up a booth asks for it. It stores nothing beyond a one-hour in-memory cache and sends nothing about the people using the booth.
