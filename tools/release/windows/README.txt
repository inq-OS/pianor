PIANOR - a piano reading game
=============================

What you need
- A Windows 10 or 11 computer with Microsoft Edge (built in) or Google Chrome.
- The digital piano and a USB cable from its USB TO HOST port (the square "type B" socket) to the computer.
  No driver is needed: Windows knows the piano by itself.
- No internet is needed while playing.

Install (once)
1. Right-click the zip file, choose "Extract All...", and extract it to a folder you keep, for example Documents.
2. Open the extracted folder "pianor-<version>".

Play
1. Switch the piano on and connect the USB cable.
2. Double-click "Start Pianor.cmd" ("Start Pianor (English).cmd" for English text; the game is Estonian by default).
   - If Windows says "Windows protected your PC": click "More info", then "Run anyway". This happens because the
     file is not from a known publisher; it only starts the game on this computer.
3. A small black window opens and the game opens full screen. Keep the black window open while playing;
   close it (and the game window) to stop. Press F11 to leave full screen.
4. If the browser asks to allow MIDI devices, choose Allow. Without it the game cannot hear the piano.

Players and passwords
- The first start asks for the first player's name. Add more players with the "+" on the main menu;
  rename or delete them under Admin (in the gear menu).
- Admin password (for parents): pianor
- Teacher password (the hat button): pianor
  Change both the first time (Admin, and the teacher's screen); they are child locks, not real security.

Saves
- Progress is saved on this computer, in the browser profile %LOCALAPPDATA%\Pianor\browser.
  Do not delete that folder. Admin has Export and Import to copy a player to another computer.
- Saves stay with the game window started from "Start Pianor.cmd"; opening the game in a normal browser tab
  starts with empty saves.

The piano
- The game reads the notes you play on any USB-MIDI keyboard or digital piano.
- When the game plays notes (a piece's preview, the ear trainer), they come out of the piano's own speakers;
  use the piano's volume knob.
- Key lights: some keyboards light their keys. Pianor does not use them yet, so a piano without lights loses nothing.

If something does not work
- The piano is not found: check the cable and that the piano is on, close other music programs, then close
  Pianor and start it again.
- "Edge or Chrome was not found": install Google Chrome, or open http://localhost:4173/ in Edge or Chrome while
  the black window is open.

Licence: the game is MIT licensed (LICENSE.txt). The piano sound is the Salamander Grand Piano by Alexander Holm
(CC BY 3.0). Credits are in the game's menu.
