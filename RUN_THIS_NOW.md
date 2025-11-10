# ⚠️ IMPORTANT: Run These Commands Now

Your dev server is running but the database migration hasn't been applied yet.

## Step 1: Stop the dev server
Press `Ctrl+C` in the terminal running `npm run dev`

## Step 2: Apply the migration

Run these commands in order:

```bash
# Add the columns to your database
npx prisma db push --skip-generate

# Mark the migration as applied
npx prisma migrate resolve --applied 20250109000000_add_dataset_tracking_fields

# Regenerate Prisma Client with the new schema
npx prisma generate
```

**OR use the automated script:**

```bash
chmod +x apply-migration.sh
./apply-migration.sh
npx prisma generate
```

## Step 3: Restart the dev server

```bash
npm run dev
```

## Step 4: Test uploads

Now try uploading the formulary again. You should see:
- ✓ Dataset label modal appears
- ✓ Upload succeeds
- ✓ Data appears in Data Management tab

---

## What These Commands Do:

1. **`prisma db push`** - Adds these columns to your database:
   - UploadLog: `datasetLabel`, `planId`
   - FormularyDrug: `uploadLogId`
   - PharmacyClaim: `uploadLogId`

2. **`prisma migrate resolve`** - Marks migration as applied so it won't run again

3. **`prisma generate`** - Updates the TypeScript types so your code recognizes the new columns

---

## If You Get Errors:

**"Database schema is not empty"** - That's expected, the commands above handle this

**"Column already exists"** - Run: `npx prisma migrate resolve --applied 20250109000000_add_dataset_tracking_fields`

**Still getting validation errors** - Make sure you run `npx prisma generate` after the migration
