# Yoyo Scoring System (v2, hosted)

One small Node server that hosts everything. Nothing runs on the client's computer except a browser.

```
Judges' laptop (Chrome + controllers)  --wss-->  This server  --wss-->  Stream computer (OBS Browser Source)
        /score                                   (Render)                       /overlay/<key>
```

You manage events from `/admin` (password protected). Each event gets its own scoring code and its own private overlay link.

## Files

| File | Purpose |
|---|---|
| `server.js` | Web server, WebSocket server, event storage, admin API |
| `score.html` | Scoring page for the judges' laptop |
| `overlay.html` | Overlay page for the OBS Browser Source |
| `admin.html` | Your event management page |
| `package.json` | Dependencies and start command |

All five files go in the **root** of your GitHub repo (same place `package.json` and `relay-server.js` are now). The old `relay-server.js` can stay or be deleted; it is no longer used.

## Deploying on Render

1. Put the files above in the repo and commit. Render redeploys automatically.
2. In Render, open the service, then **Environment**, and add:

| Variable | Required | Meaning |
|---|---|---|
| `ADMIN_PASSWORD` | Yes | Password for `/admin`. Pick something long. Without it, admin is disabled. |
| `MAX_JUDGES` | No | Maximum judges per event. Default 8, up to 16. |
| `DATA_DIR` | No | Folder where `events.json` is saved. See "Free tier caveat". |
| `RELAY_AUTH_TOKEN` | No | Keeps the **old** bridge/tester protocol working too. Leave unset to turn it off. |

3. **Rotate `RELAY_AUTH_TOKEN`** to a new value if you keep it. The old one appeared in chat and in logs.
4. Start command stays `npm start`. Health check URL stays `/health` (your UptimeRobot monitor keeps working).

### Free tier caveat

Render's free tier has an ephemeral disk. Event records (names, codes, expiry) are lost when the service is redeployed or restarted, so **create events shortly before they are needed and do not redeploy during an event**. Live scores are not affected by this (the scoring page restores them if the server restarts), but the event itself would need to be recreated with new codes.

For paying clients, use a paid instance with a persistent disk and set `DATA_DIR` to the disk's mount path (for example `/var/data`).

## Running an event

1. Go to `https://<your-service>.onrender.com/admin` and sign in.
2. Create an event: name, number of judges, how long the codes stay valid.
3. Send the client two things from the event card:
   - the **scoring code** (or the scoring link, which has the code built in)
   - the **overlay URL**
4. From the admin page you can watch whether their scoring laptop and overlay are connected, see live scores, extend the event, reset scores, disable it, or regenerate the codes.

Code expiry applies to **new connections**. Anything already connected keeps working until it disconnects.

## Client instructions (copy/paste to the client)

**On the stream computer (OBS):**
1. Add a **Browser Source**.
2. URL: the overlay URL you were given.
3. Width 1920, Height 1080 (match your canvas size).
4. Click OK. The score bar appears at the bottom once the judges connect.

Optional URL add-ons (put after the URL): `?size=120` bigger text, `?pos=top` move to top, `?font=Orbitron` change font, `?avg=0` hide the average, `?label=0` hide the competitor name.

**At the judges' table (laptop with Chrome or Edge):**
1. Plug in or pair the controllers.
2. Open the scoring link (or go to `<server>/score` and type the code).
3. Press a button on each controller. Each one lights up a row in the Controllers list, which tells identical controllers apart.
4. For each judge, pick that judge's controller from the dropdown on their card.
5. Keep this browser tab **open and in front**. Browsers pause controller input for tabs in the background or on a minimized window. The page warns you if that happens.

Default controls: POS clicker = RB (+), RT (-), Start (reset). NEG clicker = LB (+), LT (-), Select/Back (reset). Every button can be remapped per judge under "Button mapping" on each card, and mappings are remembered on that laptop. A second button can be added to any action (useful for rapid double taps).

If a button press can't be recorded (connection down), the controller gives one long buzz and a red banner appears.

## Notes

- Up to 4 controllers can be read by one browser at a time (a browser limit). Other USB devices that show up as gamepads (some headset receivers do) use up those slots. For more judges than that, a second laptop can open the same scoring page with the same code; every judge also has on-screen +/- buttons.
- Each controller can only be assigned to one judge. Choosing it for a new judge moves it.
- The server keeps the scores. If a scoring laptop reconnects, it simply picks up where it was.
- Failed code or password attempts are rate limited per IP address (10 failures, then a 10 minute block). This is best effort.
