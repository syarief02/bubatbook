# Legacy SQL — do not run

These files are the project's schema history from before `supabase/migrations/`.
They do not match the live database, and several contain policies that later
migrations deliberately removed (for example public read access to profiles and
to the `customer-documents` bucket). Running any of them again would reopen
those holes.

Kept for reference only. All schema changes go in `supabase/migrations/`.
