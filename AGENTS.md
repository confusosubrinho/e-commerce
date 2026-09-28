
- Storefront content/config tables are served from `src/data/contentSnapshot.json` via the fetch interceptor in `src/lib/staticContent.ts` (first import in main.tsx); /admin still reads the DB. Why: site must not depend on the database for displayed content.
