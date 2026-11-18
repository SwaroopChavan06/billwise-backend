# Billwise API

NestJS backend for the Billwise billing application.

## Current backend scope

The current implementation contains:

- GST calculation for same-state sales (CGST + SGST)
- GST calculation for inter-state sales (IGST)
- Invoice draft creation
- Invoice issuing with financial-year numbering
- Invoice totals and amount in words
- Customer lookup with phone, email, address, GSTIN, and state
- Product lookup and server-side product details with editable invoice rates
- Invoices with up to 15 calculated line items
- Downloadable invoice PDFs
- Google sign-in restricted to the configured email allowlist
- PostgreSQL-backed invoices, customers, and products
- Database-controlled pagination for invoice, customer, and product lists

Invoices, customers, and products are persisted in PostgreSQL. Active login
sessions remain in memory and are invalidated when the API restarts. In
development, the API seeds the sample customers and products when their tables
are empty. During invoice creation, the web app creates a missing customer
through `POST /api/v1/customers` before submitting the invoice.

## Start the API

From PowerShell:

```powershell
cd "E:\GG\Billing Project\apps\api"
npm install
npm run start:dev
```

The development start script loads variables from the API's `.env` file. The
API runs at `http://localhost:3000`; restart it after changing `.env`.
The `.env` file must contain a PostgreSQL `DATABASE_URL`. From the repository
root, start the local PostgreSQL service, then create/update the database schema:

```powershell
docker compose up -d postgres
cd "E:\GG\Billing Project\apps\api"
npm run db:migrate
npm run db:generate
npm run start:dev
```

For example, a local development connection string can use
`postgresql://billing:billing_dev@localhost:5432/billing?schema=public`.

Configure the same Google OAuth Web client ID in the frontend and API
environment. In Google Cloud Console, authorize the frontend's JavaScript
origin (for local development, `http://localhost:5173`). Add these settings to
the ignored `apps/api/.env` file:

```text
GOOGLE_CLIENT_ID=your-google-oauth-client-id
GOOGLE_ALLOWED_EMAILS=swaroopch06@gmail.com,ramdas2758@gmail.com
WEB_ORIGINS=http://localhost:5173
GOOGLE_SESSION_SECRET=replace-with-a-random-secret-at-least-32-characters
```

In production, use HTTPS and a unique strong `GOOGLE_SESSION_SECRET`. The API
also accepts the existing `JWT_SECRET` as the session signing secret when
`GOOGLE_SESSION_SECRET` is not set. Never put secrets in frontend variables.

## API routes

| Method | Route | Purpose |
|---|---|---|
| `GET` | `/` | Health/basic NestJS response |
| `GET` | `/api/v1/invoices` | List issued invoices with calculated totals and pagination |
| `POST` | `/api/v1/invoices` | Create and issue an invoice |
| `GET` | `/api/v1/invoices/:id/print` | Open print-ready HTML invoice and use Print / Save as PDF |
| `POST` | `/api/v1/invoices/drafts` | Create a calculated invoice draft |
| `POST` | `/api/v1/invoices/:id/issue` | Validate and issue a draft |
| `GET` | `/api/v1/products` | List products with pagination |
| `GET` | `/api/v1/products?search=paper` | Search products by name, SKU, or HSN with pagination |
| `POST` | `/api/v1/products` | Create a product |
| `PATCH` | `/api/v1/products/:id` | Edit a product and its available quantity |
| `GET` | `/api/v1/customers` | List customers with pagination |
| `GET` | `/api/v1/customers?search=apex` | Search by customer name, phone, or email with pagination |
| `POST` | `/api/v1/customers` | Create a customer |
| `GET` | `/api/v1/invoices?customerId=cust-1` | List invoices for one customer |
| `GET` | `/api/v1/auth/session` | Check the current login session |
| `POST` | `/api/v1/auth/google` | Verify a Google ID token and start a session |
| `POST` | `/api/v1/auth/logout` | End the current session |

Invoice and order item quantities are whole numbers. Fractional invoice
quantities are rejected by the API.

Invoice, customer, and product list endpoints accept `page`, `limit`,
`search`, `sortBy`, and `sortOrder` where applicable. The default page size is
20; limits up to 1000 are supported. Valid sort fields depend on the endpoint.
Invoice lists also accept `customerId`. List responses use this envelope:

```json
{
  "data": [],
  "pagination": {
    "currentPage": 1,
    "pageSize": 20,
    "totalRecords": 0,
    "totalPages": 0
  }
}
```

Invoice, customer, and product routes require an active session. Google ID
tokens are verified by the API, then the verified email must match
`GOOGLE_ALLOWED_EMAILS`. Sessions use an HTTP-only cookie and expire after
eight hours. The root health endpoint and auth session/login/logout routes
remain public.

## curl testing guide

The examples below use `curl.exe`, which avoids PowerShell's `curl` alias.
Run them after starting the API.

### 1. Check the API

```powershell
curl.exe http://localhost:3000
```

Expected response:

```text
Hello World!
```

### 2. Load customers and products

```powershell
curl.exe "http://localhost:3000/api/v1/customers?page=1&limit=20"
curl.exe "http://localhost:3000/api/v1/products?page=1&limit=20&search=cards"
```

Create and edit products with the same product fields. Quantity must be a
non-negative whole number, and SKU values must be unique:

```powershell
curl.exe -X POST http://localhost:3000/api/v1/products `
  -H "Content-Type: application/json" `
  -d '{\"name\":\"Custom folders\",\"sku\":\"CF-001\",\"hsnCode\":\"4820\",\"unit\":\"piece\",\"gstRate\":18,\"sellingPrice\":25,\"quantityAvailable\":4}'

curl.exe -X PATCH http://localhost:3000/api/v1/products/prod-toner `
  -H "Content-Type: application/json" `
  -d '{\"name\":\"Black toner cartridge\",\"sku\":\"BTC-001\",\"hsnCode\":\"8443\",\"unit\":\"piece\",\"gstRate\":18,\"sellingPrice\":2900,\"quantityAvailable\":3}'
```

### 3. Create and issue an invoice

`customerId` and each line's `productId` let the API fetch the saved customer
contact information and the product's description, HSN, unit, and GST rate.
The product's saved price is prefilled in the invoice editor, but the submitted
rate is editable and used for calculation. Discounts must be whole rupees. The
API calculates totals, rounds the final invoice total to a whole rupee, and
assigns the invoice number. Set `includeDateTime` to `true` to print the issue
date and time; it is omitted when the field is absent or false.

```powershell
curl.exe -X POST http://localhost:3000/api/v1/invoices `
  -H "Content-Type: application/json" `
  -d '{\"id\":\"invoice-001\",\"customerId\":\"cust-1\",\"customerName\":\"Apex Architects\",\"customerStateCode\":\"27\",\"branchStateCode\":\"27\",\"includeDateTime\":true,\"lines\":[{\"productId\":\"prod-business-cards\",\"description\":\"Business cards\",\"hsnCode\":\"4911\",\"unit\":\"box\",\"quantity\":2,\"rate\":1000,\"discount\":0,\"gstRate\":18}]}'
```

The response includes the invoice number, customer contact snapshot, each
calculated line total, CGST/SGST or IGST, `roundOff`, and the whole-rupee final
total. Product catalog values supply description, HSN, unit, and GST rate;
the submitted rate is used so an edited price is preserved.

### 4. Print or save invoice as PDF

Open the print view using the invoice `id` from the create response:

```powershell
Start-Process http://localhost:3000/api/v1/invoices/invoice-001/print
```

Select **Print / Save as PDF** in the opened page, then choose **Save as PDF**
as the printer destination.

### 5. List invoices

```powershell
curl.exe "http://localhost:3000/api/v1/invoices?page=1&limit=20"
```

### 6. Create a same-state invoice draft (optional flow)

This example uses Maharashtra state code `27` for both the branch and
customer, so GST is split into CGST and SGST.

```powershell
curl.exe -X POST http://localhost:3000/api/v1/invoices/drafts `
  -H "Content-Type: application/json" `
  -d '{\"id\":\"draft-001\",\"customerName\":\"Apex Architects\",\"customerStateCode\":\"27\",\"branchStateCode\":\"27\",\"lines\":[{\"description\":\"Business cards\",\"hsnCode\":\"4911\",\"unit\":\"box\",\"quantity\":2,\"rate\":1000,\"discount\":0,\"gstRate\":18}]}'
```

The API returns the draft:

```json
{
  "id": "draft-001",
  "customerName": "Apex Architects",
  "customerStateCode": "27",
  "branchStateCode": "27",
  "lines": [
    {
      "description": "Business cards",
      "hsnCode": "4911",
      "unit": "box",
      "quantity": 2,
      "rate": 1000,
      "discount": 0,
      "gstRate": 18
    }
  ]
}
```

### 7. Issue the draft

```powershell
curl.exe -X POST http://localhost:3000/api/v1/invoices/draft-001/issue
```

The response contains a generated invoice number such as
`INV260001` (`INV` + financial-year start `26` + sequence `0001`), calculated
tax, total, and amount in words:

```json
{
  "id": "draft-001",
  "status": "ISSUED",
  "invoiceNumber": "INV260001",
  "subtotal": 2000,
  "taxableValue": 2000,
  "cgst": 180,
  "sgst": 180,
  "igst": 0,
  "total": 2360,
  "amountInWords": "Rupees Two Thousand Three Hundred Sixty Only"
}
```

### 8. List the issued invoice

```powershell
curl.exe http://localhost:3000/api/v1/invoices
```

### 9. Test an inter-state invoice

Use a different customer state code, for example Karnataka `29`, while the
branch remains Maharashtra `27`. The calculated tax appears under `igst`.

```powershell
curl.exe -X POST http://localhost:3000/api/v1/invoices/drafts `
  -H "Content-Type: application/json" `
  -d '{\"id\":\"draft-002\",\"customerName\":\"Bengaluru Retail\",\"customerStateCode\":\"29\",\"branchStateCode\":\"27\",\"lines\":[{\"description\":\"Printed catalogues\",\"hsnCode\":\"4911\",\"unit\":\"pack\",\"quantity\":1,\"rate\":5000,\"gstRate\":18}]}'

curl.exe -X POST http://localhost:3000/api/v1/invoices/draft-002/issue
```

For this example, the expected tax split is:

```text
CGST: 0
SGST: 0
IGST: 900
Total: 5900
```

## Validation errors

The issue endpoint rejects:

- Missing invoice drafts (`404`)
- Empty invoice lines (`400`)
- Missing HSN codes (`400`)
- Zero or negative quantities (`400`)
- Negative rates or GST rates (`400`)
- Issuing the same draft twice (`400`)

## Database schema

The relational model is in [`prisma/schema.prisma`](./prisma/schema.prisma).
The API requires PostgreSQL to be reachable at startup. Set `DATABASE_URL` in
the ignored `.env` file, then apply development migrations and generate the
Prisma client with:

```powershell
npm run db:migrate
npm run db:generate
npm run db:validate
```

## Tests and build

```powershell
npm run build
npm test -- --runInBand
```
