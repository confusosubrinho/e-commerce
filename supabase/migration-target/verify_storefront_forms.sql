BEGIN;
SET LOCAL ROLE anon;
INSERT INTO public.newsletter_subscribers(email, source) VALUES ('migration-test@example.invalid', 'website');
INSERT INTO public.contact_messages(name, email, subject, message) VALUES ('Migration test', 'migration-test@example.invalid', 'Validation', 'Temporary validation rolled back immediately.');
ROLLBACK;
