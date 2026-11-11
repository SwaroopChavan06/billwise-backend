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
- Product lookup and server-side product-price snapshots
- Invoices with up to 15 calculated line items
- Downloadable invoice PDFs
- Prisma schema for the planned PostgreSQL data model

The invoice service currently stores drafts and issued invoices **in memory**.
Restarting the API clears the data. Prisma persistence, authentication, and
other modules will be wired in as the workflow is finalized.

## Start the API

From PowerShell:

```powershell
cd "E:\GG\Billing Project\apps\api"
npm install
npm run start:dev
```

The API runs at `http://localhost:3000`.

The current in-memory invoice endpoints do not require Docker, PostgreSQL, or
Redis. PostgreSQL is required when Prisma persistence is connected.

## API routes

| Method | Route | Purpose |
|---|---|---|
| `GET` | `/` | Health/basic NestJS response |
| `GET` | `/api/v1/invoices` | List drafts and issued invoices with calculated totals |
| `POST` | `/api/v1/invoices` | Create and issue an invoice |
| `GET` | `/api/v1/invoices/:id/print` | Open print-ready HTML invoice and use Print / Save as PDF |
| `POST` | `/api/v1/invoices/drafts` | Create a calculated invoice draft |
| `POST` | `/api/v1/invoices/:id/issue` | Validate and issue a draft |
| `GET` | `/api/v1/products` | List products |
| `GET` | `/api/v1/products?search=paper` | Search products by name, SKU, or HSN |
| `GET` | `/api/v1/customers` | List customers |
| `GET` | `/api/v1/customers?search=apex` | Search by customer name, phone, or email |
| `POST` | `/api/v1/customers` | Create a customer |
| `GET` | `/api/v1/invoices?customerId=cust-1` | List invoices for one customer |

Invoice and order item quantities are whole numbers. Fractional invoice
quantities are rejected by the API.

There is currently no authentication required.

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
curl.exe http://localhost:3000/api/v1/customers
curl.exe "http://localhost:3000/api/v1/products?search=cards"
```

### 3. Create and issue an invoice

`customerId` and each line's `productId` let the API fetch the saved customer
contact information and the authoritative product price, HSN, unit, and GST
rate. The API calculates the totals and assigns the invoice number.

```powershell
curl.exe -X POST http://localhost:3000/api/v1/invoices `
  -H "Content-Type: application/json" `
  -d '{\"id\":\"invoice-001\",\"customerId\":\"cust-1\",\"customerName\":\"Apex Architects\",\"customerStateCode\":\"27\",\"branchStateCode\":\"27\",\"lines\":[{\"productId\":\"prod-business-cards\",\"description\":\"Business cards\",\"hsnCode\":\"4911\",\"unit\":\"box\",\"quantity\":2,\"rate\":1000,\"discount\":0,\"gstRate\":18}]}'
```

The response includes the invoice number, customer contact snapshot, each
calculated line total, CGST/SGST or IGST, and the final total. The product
catalog values are used instead of trusting submitted rate/HSN/unit/GST values.

### 4. Print or save invoice as PDF

Open the print view using the invoice `id` from the create response:

```powershell
Start-Process http://localhost:3000/api/v1/invoices/invoice-001/print
```

Select **Print / Save as PDF** in the opened page, then choose **Save as PDF**
as the printer destination.

### 5. List invoices

```powershell
curl.exe http://localhost:3000/api/v1/invoices
```

Expected initial response:

```json
[]
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
`INV/26-27/00001`, calculated tax, total, and amount in words:

```json
{
  "id": "draft-001",
  "status": "ISSUED",
  "invoiceNumber": "INV/26-27/00001",
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

The planned relational model is in
[`prisma/schema.prisma`](./prisma/schema.prisma). Validate and generate the
Prisma client with:

```powershell
npm run db:validate
npm run db:generate
```

Do not run a migration against production until the persistence integration and
business workflow have been reviewed.

## Tests and build

```powershell
npm run build
npm test -- --runInBand
```
