# Yo-Yo Event Management (hosted)

One small Node server that hosts everything. Nothing runs on the client's computer except a browser.

```
Judges' laptop (Chrome + controllers)  --wss-->  This server  --wss-->  Stream computer (OBS Browser Source)
        /score                                   (Render)                       /overlay/<key>
                                                    ^
Music laptop (music, name, timer)          --wss----+------->  Timer display (stage / judges screen)
        /music                                                       /timer/<key>
```

Clients start at the event page (`/`): they enter the event code once and pick Judging, Music or Timer display. Every page also links to the others in its header.

You manage events from `/admin` (password protected). Each event gets its own scoring code and its own private overlay link.

## Files

| File | Purpose |
|---|---|
| `server.js` | Web server, WebSocket server, event storage, admin API |
| `index.html` | Event page: enter the code once, pick Judging, Music or Timer display |
| `score.html` | Scoring page for the judges' laptop |
| `music.html` | Music page: divisions, running orders, competitor music, the name on the overlay and the performance timer |
| `timer.html` | Big performance timer for a screen the judges, the competitor or the audience can see |
| `score-sw.js` | Keeps the scoring and music pages loadable in the browser while the server is down |
| `cues/` | Default start and end cues (`startnoise.mp3`, `endnoise.mp3`) for the music page |
| `overlay.html` | Overlay page for the OBS Browser Source |
| `admin.html` | Your event management page |
| `package.json` | Dependencies and start command |

All nine files and the `cues` folder go in the **root** of your GitHub repo (same place `package.json` and `relay-server.js` are now). The old `relay-server.js` can stay or be deleted; it is no longer used.

## Deploying on Render

1. Put the files above in the repo and commit. Render redeploys automatically.
2. In Render, open the service, then **Environment**, and add:

| Variable | Required | Meaning |
|---|---|---|
| `ADMIN_PASSWORD` | Yes | Password for `/admin`. Pick something long. Without it, admin is disabled. |
| `MAX_JUDGES` | No | Maximum judges per event. Default 8, up to 16. |
| `DATA_DIR` | No | Folder where `events.json` and `recordings.json` (recorded clicks) are saved. See "Free tier caveat". |
| `RELAY_AUTH_TOKEN` | No | Keeps the **old** bridge/tester protocol working too. Leave unset to turn it off. |

3. **Rotate `RELAY_AUTH_TOKEN`** to a new value if you keep it. The old one appeared in chat and in logs.
4. Start command stays `npm start`. Health check URL stays `/health` (your UptimeRobot monitor keeps working).

### Free tier caveat

Render's free tier has an ephemeral disk. Event records (names, codes, expiry) are lost when the service is redeployed or restarted, so **create events shortly before they are needed and do not redeploy during an event**. Judges are not interrupted by this: the scoring page keeps counting on the laptop. But if the event is gone after a restart, the scoring page says so, and the final scores have to be read off the judges' screens by hand and the event recreated with new codes.

Recorded clicks (`recordings.json`) are lost on a free-tier restart too. The music laptop keeps its own copy for replays, but the admin CSV only has what the server still holds, so download it before the service restarts.

For paying clients, use a paid instance with a persistent disk and set `DATA_DIR` to the disk's mount path (for example `/var/data`).

## Running an event

1. Go to `https://<your-service>.onrender.com/admin` and sign in.
2. Create an event: name, number of judges, how long the codes stay valid.
3. Send the client the links from the event card's **Send to the client** section:
   - the **event page** link: one link that opens Judging, Music and the Timer display (it has the code built in), or the **event code** itself
   - the **overlay URL** for their OBS computer

   Direct links to **Judging**, **Music** and the **Timer display** are there too if someone needs just one.
4. From the admin page you can watch whether their scoring laptops, music laptop, overlay and timer display are connected, download every routine's recorded clicks as a CSV (**Download clicks**: each row has the judge's real seat and the number they appeared as on stream), see live scores, extend the event, reset scores, disable it, or regenerate the codes.

Code expiry applies to **new connections**. Anything already connected keeps working until it disconnects.

## Client instructions (copy/paste to the client)

**On the stream computer (OBS):**
1. Add a **Browser Source**.
2. URL: the overlay URL you were given.
3. Width 1920, Height 1080 (match your canvas size).
4. Click OK. The score bar appears at the bottom once the judges connect.

The look of the bar (font, size, top or bottom, the order of name / timer / judges / average and which of them show) is set live from the music page under **Overlay look**, and that wins over the link options below. Link options still work until the music page sets a look: `?size=120` bigger text, `?pos=top` move to top, `?font=Orbitron` change font, `?avg=0` hide the average, `?label=0` hide the competitor name, `?timer=0` hide the performance timer. `?bg=` and `?color=` always come from the link.

**At the judges' table (laptop with Chrome or Edge):**
1. Plug in or pair the controllers.
2. Open the event page link and choose **Judging** (or go to `<server>/score` and type the code).
3. Every judge slot for the event appears as a card. Click **Join as Judge N** on the card(s) this laptop will score. A card that says "Taken by another device" is already in use elsewhere (its score is shown read-only). Click **Leave** to give a slot back.
4. Press a button on each controller. Each one lights up a row in the Controllers list, which tells identical controllers apart.
5. On each of your judge cards, pick that judge's controller from the dropdown.
6. Keep this browser tab **open and in front**. Browsers pause controller input for tabs in the background or on a minimized window. The page warns you if that happens.

The same code works from several places at once (for example two judges sharing one laptop, a third judge at home). Once every judge slot is taken, nobody else can score. If a laptop drops off, it keeps its slots for 20 seconds so a quick reconnect or page refresh doesn't lose them. In the admin page, **Free judge slots** clears all slots if one gets stuck.

The **Stream overlay preview** on the scoring page shows what viewers see on the stream.

**Randomize** (under the preview) gives each judge a different number on the stream, so spectators can't tell who sits where; each card then says, for example, "Judge 1 · Appears as Judge 3". The numbers stay until someone presses Randomize again. Every score is still recorded against the judge's real seat.

Default controls: POS clicker = RB (+), RT (-), Start (reset). NEG clicker = LB (+), LT (-), Select/Back (reset). Every button can be remapped per judge under "Button mapping" on each card, and mappings are remembered on that laptop. A second button can be added to any action (useful for rapid double taps).

**At the music laptop (Chrome or Edge, audio routed to the stream):**
1. Open the event page link and choose **Music** (or go to `<server>/music` and type the same event code the judges use).
2. Add a division for each one being run (1A Pro, X-Division…), or use **Setup → Import a music folder**: pick a folder with one subfolder per division, and each subfolder becomes a division with its music. The default start and end cues are set automatically; **Setup** lets you choose different ones, remove one to skip it, or go back to the default.
3. In each division, press **Add music files** and pick all its tracks at once. Each file becomes a slot in the running order, in file-name order (number the files, e.g. `01 Kentaro.mp3`, to control it), and can be queued straight away under its file name.
4. Paste the running order (one name per line) and press **Fill in names**: the first name goes to the first slot, and so on. Extra names are added at the end without music. **Edit list** reorders slots, swaps a track or fixes a name.
5. Set the division's **Timer**: count down or count up, and an optional **Time limit** (e.g. `2:00`). With a limit, the music stops at that time and the end cue plays; a shorter track just ends on its own.
6. During the event, press **Queue** on the next competitor: their name goes on the overlay and the timer resets to their time. Press **Start** to play start cue → track → end cue; the timer runs with the track (Pause and seeking move it too). When it ends they're marked done, and **Queue next** calls up the following competitor.
7. **Overlay name shows** picks what's on screen: division and name, name only, division only, or nothing. **Overlay look** changes the font, size, position and order of the whole bar live.
8. Every routine's clicks are recorded while its track plays (not during the cues), with the time of each press. **Recorded routines** lists them. If the live overlay failed and the clicks need to go on an edited video, add the **replay overlay** link shown there as its own OBS source (or record it on its own) and press **Play back**: it replays the scores, name and timer in real time from the start of the track. The live overlay is never touched.

Music files stay on that laptop (saved in the browser), so set up the divisions on the laptop that will play them. If the server goes down, music keeps playing; the name and timer catch up when the connection returns.

**On a screen at the stage or judges' table (any browser):**
1. Open the event page link and choose **Timer display**, or open the timer display link from the organizer.
2. Press **Full screen**. The page keeps the screen awake and shows the timer and who's performing; the last 10 seconds of a countdown turn amber, and zero turns red.

Add `?name=0` to the timer display link to show only the time.

If the connection drops or the server crashes, judges keep scoring: every press still counts and buzzes normally, the numbers are saved on the laptop (even through a page reload), and an amber banner says the stream overlay is paused. When the connection returns, the laptop sends its totals and the overlay catches up. If the server no longer knows the event when it comes back (for example the free tier lost it on a restart), a red banner says so and judges keep scoring locally; take the final scores from their screens by hand.

## Notes

- Up to 4 controllers can be read by one browser at a time (a browser limit). Other USB devices that show up as gamepads (some headset receivers do) use up those slots. For more judges than that, a second laptop can open the same scoring page with the same code; every judge also has on-screen +/- buttons.
- Each controller can only be assigned to one judge. Choosing it for a new judge moves it.
- Only the device holding a judge slot can score for that judge; the server rejects scores for slots a device doesn't hold.
- Each scoring laptop is the source of truth for the judges it holds: presses are counted on the laptop first and its totals are sent to the server. Scores made while offline win over the server's numbers when the laptop reconnects (including a **Reset all scores** pressed during the outage). If another laptop took the judge slot in the meantime, the offline scores are not sent and the page shows them so they can be entered by hand.
- Failed code or password attempts are rate limited per IP address (10 failures, then a 10 minute block). This is best effort.
