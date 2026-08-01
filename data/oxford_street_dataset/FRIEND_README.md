# Oxford Street labeler — for helpers

Thanks for helping categorize shop-window outfits for Dripn.

## What to do

1. Unzip this folder.
2. On a computer, open Terminal / PowerShell in this folder and run:

```bash
npx --yes serve . -p 4173
```

3. Open **http://localhost:4173/labeler.html** in Chrome or Edge.
4. It should load `dataset.json` automatically. Tap chips for style / top / bottom / shoes / colour, then **Accept**.
5. Skip junk (reflections, empty windows, magazines). Use **Discard** for those.
6. When finished (or pausing), click **Download labels.json**.
7. Send that file back (e.g. WhatsApp / Drive) — name it with your initials if useful, like `oxford_label_edits_sam.json`.

## Phone?

Possible in Safari/Chrome **if** someone hosts this folder on a URL, or you stay on the same Wi‑Fi as a laptop running `npx serve` and open `http://<laptop-ip>:4173/labeler.html`.

It is **not** inside the Dripn app.

## Tips

- Prefer the main mannequin / person in the window.
- Dresses → top = dress, bottom = none.
- Confidence ~0.85 if you’re sure; lower if unsure (we’ll re-check).
- Don’t worry about gold rows already labeled — editing them is fine if they’re wrong.
