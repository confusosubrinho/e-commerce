-- Allow service role / edge functions to insert into order_events for idempotency tracking
CREATE POLICY "Service can insert order events"
ON public.order_events
FOR INSERT
WITH CHECK (true);