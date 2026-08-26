-- Reanudación automática de las esperas de los workflows.
-- Sustituye SECRETO por el valor de CRON_SECRET antes de ejecutar.
create extension if not exists pg_cron;
create extension if not exists pg_net with schema extensions;

select cron.unschedule(jobid) from cron.job where jobname = 'aurum_workflows';

select cron.schedule(
  'aurum_workflows',
  '* * * * *',
  $$
  select net.http_post(
    url     := 'https://crm-david-538.netlify.app/api/cron/workflows',
    headers := jsonb_build_object('Content-Type','application/json','x-cron-secret','SECRETO'),
    body    := '{}'::jsonb
  );
  $$
);
