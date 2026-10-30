# Change the look and sound

## Appearance

Chess by Chaos has one design, **Classic**: graphite ink on warm paper, white surfaces and a brass accent for "on" and "here" states. Open **Settings → Appearance** to choose **Light**, **Dark** or **System**. Older Material 3 Expressive or Liquid Glass choices open as Classic automatically. Changing it preserves the current game.

## Haptics

Open **Settings → Sound & feel → Haptics** and choose **Off**, **Subtle** or **Standard**, then tap **Test**. The line under the control says what this device can really do:

- **Android (Chrome and most browsers):** full vibration patterns, different for a move, a capture, check, an illegal move and the result.
- **iPhone (Safari 18+):** a light tap on your own taps and moves. Safari doesn't let websites vibrate, so this uses the tap iOS plays for a switch. It is best effort and stays silent where iOS doesn't allow it.
- **Anything else:** no haptics; sound and visuals still give feedback.

Subtle shortens pulses and skips the opponent's quiet moves. Off stops feedback immediately. The strength is saved per device.

## Navigation

On phones, five tabs sit above the home indicator: **Play**, **Bots**, **Learn**, **Review** and **More** (Timed games, Play a friend, Friends, Profile, Progress, Settings, help and your account). Each tab remembers the last page you had open; tap it again to go back to its start. Game screens are full screen with **Options · Hint · Back · Forward** at the bottom; **Options → Go to** leaves the game. On a computer the same destinations are in the left sidebar.

**Hints** work like chess.com: tap **Hint** once to light up the piece to move, again to see the move, again to clear it. Hints are always in English; only Sherine's and Maya's chat follows the language you choose.

## Live background and board themes

- **Live background:** Settings → Background → **Live background**, or **Options → Live background** during a game. Drifting characters appear behind games only; move the mouse to stir them and tap empty space for a ripple (every third makes a heart). It pauses in hidden tabs and stays still with reduced motion. Renderer: [Claude Code Background Lab](https://github.com/Henry-fan88/claude-code-background) (MIT).
- **Board themes:** Settings → Board → **Theme** (or **Options → Board theme**). Each theme sets board colours and pieces together and is saved on this device.
- **Chess.com sounds:** Settings → Sound & feel → **Chess.com sounds**. Your browser loads them from chess.com; nothing is stored in the app.

## Choose event sounds

1. Open **Gameplay sound packs** and choose a pack.
2. Preview **Move**, **Capture**, **Check**, or **Checkmate**. Use A/B comparison to hear two packs.
3. Adjust master, gameplay, notification, and Sherine banter levels. Disable event categories for quieter play.
4. Expand advanced controls for per-event overrides. Restore pack defaults to remove overrides.

All packs are brief original synthesized event cues. There is no background music. Mute and Silent prevent playback; previewing still respects master mute. [Sound provenance](SOUND-LEDGER.md)

Preferences save on the device. Appearance, background, and audio settings sync after sign-in when the updated backend is deployed. Coaching and banter preferences remain labeled as device preferences.

## Offline play

Open Chess by Chaos once with internet. **Settings → Offline** shows *Preparing offline play* with real file progress, then **Offline ready**. From then on it opens and plays in Airplane Mode, including from the Home Screen icon.

- **Works offline:** Sherine and every bot (Stockfish runs on the device), hints, evaluation, Time Machine, lessons, themes, sounds, the live background and your saved games (stored on this device).
- **Needs internet:** online games, friends and challenges, account sync and Chess.com sounds. These screens say so instead of spinning.
- Updates download in the background and wait; **Update ready · Restart now** appears in Settings, so a game is never interrupted.
- Browsers can still clear site data under storage pressure; the app asks the browser to keep it, but export important games.

## Premoves

While the opponent is thinking, drag or tap a move to queue a premove. Tap either of its squares, or any square that doesn't start a new move, to cancel it (right-click or Escape also cancel).
