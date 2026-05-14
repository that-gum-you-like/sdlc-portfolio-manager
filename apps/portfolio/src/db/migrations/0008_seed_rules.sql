-- 0008_seed_rules: no schema changes — this migration is a no-op marker for the
-- code-side seeding of cursor-templates/rules/. Bumping the migration list so
-- existing dev databases get a clean "migrations are up to date" signal after
-- the rules seed files land in cursor-templates/.
SELECT 1;
