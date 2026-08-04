/*
# Revoke remaining non-data privileges from anon

## Summary
Revokes REFERENCES, TRIGGER, and TRUNCATE privileges from the anon role on all
public tables. These are non-data-access privileges (they cannot read or modify
row data), but removing them gives a clean, least-privilege posture.

## Security
- No impact on authenticated users or the service role.
- No impact on application behavior.
*/
REVOKE REFERENCES, TRIGGER, TRUNCATE ON public.clientes FROM anon;
REVOKE REFERENCES, TRIGGER, TRUNCATE ON public.configuracoes FROM anon;
REVOKE REFERENCES, TRIGGER, TRUNCATE ON public.equipamentos FROM anon;
REVOKE REFERENCES, TRIGGER, TRUNCATE ON public.ordens_servico FROM anon;
REVOKE REFERENCES, TRIGGER, TRUNCATE ON public.os_produtos FROM anon;
REVOKE REFERENCES, TRIGGER, TRUNCATE ON public.os_servicos FROM anon;
REVOKE REFERENCES, TRIGGER, TRUNCATE ON public.produtos FROM anon;
REVOKE REFERENCES, TRIGGER, TRUNCATE ON public.profiles FROM anon;
REVOKE REFERENCES, TRIGGER, TRUNCATE ON public.tecnicos FROM anon;
REVOKE REFERENCES, TRIGGER, TRUNCATE ON public.tipos_equipamento FROM anon;