# Your Product List (CSV Import)

Put your products on the store by filling in a spreadsheet. The store reads it every time a catalogue sync runs: from **Admin → Catalogue sync → Run sync now**, or from the command line.

This is your own list. Use your own descriptions and photos. Do not copy text, photos or reviews from Oriflame's website: your Brand Partner terms (clauses 7.5 and 7.6) say Oriflame's trademarks, databases and materials are Oriflame's property. Product names, codes, prices and the link to the official product page are facts you can list.

## 1. Fill in the template

Start from [`templates/catalogue-template.csv`](templates/catalogue-template.csv) in Excel or Google Sheets. One row per product. Keep the header row exactly as it is.

| Column | Required | What to put in it |
|---|---|---|
| `product_code` | Yes | Oriflame's product code, e.g. `42637`. Letters, digits, `-` or `_`, up to 40. Each code once. The store uses it to recognise the product on the next sync, so do not change it. |
| `name` | Yes | The product name as customers know it. |
| `product_url` | Yes | The product's page on **https://pk.oriflame.com**. "Buy on Oriflame" sends customers there. Links to any other site are refused. |
| `price_pkr` | No | Price in rupees: `1499`, `1,499`, `Rs 1,499` or `1499.50` all work. Leave it blank if you are not sure; the store then says the price is not available rather than guessing. Never `0`. |
| `category` | No | Where it belongs, with `>` between levels: `Skincare > Face Care`. Categories are created for you. |
| `description` | No | Your own words about the product. |
| `image_url` | No | A link to **your own** photo. Photos only appear once the site that hosts them is allowed in the store's settings (`AUTHORISED_IMAGE_HOSTS`); until then the store shows "No image". |
| `image_alt` | No | A short description of the photo for screen readers. Defaults to the product name. |

Example (two rows, made-up codes):

| product_code | name | product_url | price_pkr | category |
|---|---|---|---|---|
| 10001 | Example Night Cream | https://pk.oriflame.com/... | 1,499 | Skincare > Face Care |
| 10002 | Example Lipstick | https://pk.oriflame.com/... | | Make-up > Lips |

## 2. Save it as CSV

- **Excel:** File → Save As → **CSV UTF-8 (Comma delimited)**. Semicolon-separated files also work.
- **Google Sheets:** File → Download → **Comma-separated values (.csv)**.

Save it as `data/catalogue.csv` inside the project folder. The `data/` folder is never uploaded to GitHub.

## 3. Point the store at it (once)

In `.env`:

```
CATALOGUE_SOURCE=csv
CATALOGUE_CSV_PATH=data/catalogue.csv
```

Restart the API after changing `.env`.

## 4. Remove the placeholder products (once)

The store refuses to mix the 12 development placeholder products with real ones. Before your first import, delete them:

```bash
uv run python -m backend.app.cli remove-fixtures --yes
```

This deletes only the placeholders (`dev_fixture` products and their `dev-cat-` categories) and cannot be undone. Your own products are never touched.

## 5. Import

```bash
uv run python -m backend.app.cli sync
```

Or press **Run sync now** in the admin. The result lists how many products were created, updated or unchanged, and any problems by row number.

## What happens when something is wrong

| Problem | Result |
|---|---|
| A misspelled or extra column, a missing required column, a file that is not UTF-8, over 5 MB or over 5,000 products | Nothing changes. The message says what to fix. |
| One bad row (wrong link, price that is not a number, duplicate code) | That row is skipped and reported, e.g. `row 7: price_pkr is not a number`. If the product was already on the store, its last good version stays visible. The run shows as **partial**. |
| Every row is bad | The run fails and nothing changes, so a broken file can never empty the store. |
| A product is no longer in your list | It leaves the storefront (it is not deleted). Put it back in the list and it returns, with your hide or feature choice as you left it. |

To hide or feature products, use **Admin → Products**; you do not need to edit the file for that.

## For developers

- Source: `backend/app/integrations/oriflame/csv_source.py` (`CsvCatalogueSource`, source name `owner_csv`). It reads the local file only and makes no network requests.
- Settings: `CATALOGUE_SOURCE=csv` requires `CATALOGUE_CSV_PATH` (startup fails otherwise); relative paths resolve from the repository root.
- Bad rows become `InvalidRecord`s that keep the product code, so `CatalogueSyncService` keeps those products listed. A run with no valid products still fails (`catalogue.py`, `_sync`).
- Tests: `backend/tests/unit/test_csv_source.py`, `backend/tests/integration/test_csv_catalogue.py`.
