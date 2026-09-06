# ML Studio — front end

React 19 + Vite + Tailwind CSS v4 single-page app for the ML Studio API.

```bash
npm install
npm run dev      # http://localhost:5173 (proxies /api → http://127.0.0.1:5000)
npm run build    # emits dist/, which the Flask app serves automatically
```

Structure: `src/pages` (routes), `src/components` (layout + UI kit),
`src/context` (auth, toasts), `src/lib` (API client, formatters).
