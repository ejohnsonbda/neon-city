# SportCal Upcoming Events Widget

A self-contained, embeddable widget that fetches the **top 5 upcoming events** from the SportCal Supabase database and displays them in an auto-scrolling card carousel.

## Live URL

```
https://sportcal-6xjon.ondigitalocean.app/widget/
```

## Features

- Connects directly to the SportCal Supabase database (live data, no build step)
- Filters to `is_published = true`, `archived = false`, `date >= today`
- Shows top 5 upcoming events sorted by date ascending
- Auto-scrolls every 5 seconds with a progress bar
- Dot navigation + touch/swipe support
- Pauses on hover
- Sport-specific fallback images when no event image is uploaded
- Fully responsive (stacks to single column on mobile)

## Embed on Another Site

Drop this `<iframe>` anywhere:

```html
<iframe
  src="https://sportcal-6xjon.ondigitalocean.app/widget/"
  width="600"
  height="260"
  style="border:none;border-radius:13px;"
  title="SportCal Upcoming Events"
  loading="lazy">
</iframe>
```

Adjust `width` and `height` as needed. The widget is fully responsive inside the iframe.

## Configuration

Open `index.html` and edit the two constants at the top of the `<script>` block:

```js
const SUPABASE_URL  = 'https://YOUR_PROJECT.supabase.co';
const SUPABASE_ANON = 'YOUR_ANON_KEY';
```

To change the auto-scroll speed (default 5 seconds):

```js
const SLIDE_DURATION = 5000; // milliseconds
```

## Data Requirements

The widget reads from the `events` table with these columns:

| Column | Type | Notes |
|---|---|---|
| `id` | UUID | — |
| `title` | TEXT | Displayed as card heading |
| `date` | TIMESTAMPTZ | Used for filtering and display |
| `time` | TEXT | Optional, e.g. `"09:00"` |
| `location` | TEXT | Optional |
| `sport` | TEXT | Used for fallback image lookup |
| `organization_name` | TEXT | Displayed below location |
| `image_url` | TEXT | Optional; falls back to sport image |
| `is_published` | BOOLEAN | Must be `true` to appear |
| `archived` | BOOLEAN | Must be `false` to appear |

The `events` table must allow anonymous `SELECT` via Supabase RLS (or be public).
