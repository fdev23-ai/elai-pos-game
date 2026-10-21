# Elai POS – Rush Hour Challenge

A gamified landing page for Elai POS. Visitors play cashier at a busy restaurant for 90 seconds, handling dine-in, takeaway and delivery orders.

## Run locally

```bash
python3 -m http.server 5190
```

Then open http://localhost:5190.

## Customise

Edit `CONFIG` and `MENU` at the top of `game.js` to change the restaurant name, contact email, game length or menu items.

## Deploy

Static files only (`index.html`, `style.css`, `game.js`), so it works on GitHub Pages, Netlify or any static host.
