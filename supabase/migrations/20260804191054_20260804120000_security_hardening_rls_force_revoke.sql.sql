/*
# Security hardening: enforce RLS, lock down restore_backup, revoke anon grants

## Summary
This migration hardens the database to resolve Supabase Security Advisor warnings
and follow RLS best practices, without changing any application behavior:

1. ENABLE + FORCE Row Level Security on all 10 public tables.
   - RLS is already enabled on all tables; this makes it explicit and idempotent.
   - FORCE RLS ensures even the table owner (postgres) is subject to RLS policies,
     which is Supabase best practice for tables exposed via the Data API.
   - Resolves: policy_exists_rls_disabled_public_user_profiles (permanent guard).

2. REVOKE EXECUTE on public.restore_backup from authenticated and anon.
   - restore_backup is a SECURITY DEFINER function that runs with postgres privileges
     and can modify any table, bypassing all RLS policies.
   - The edge function (restore-backup/index.ts) authenticates the caller and checks
     admin permission BEFORE invoking this function with the service role key.
   - Therefore the function does NOT need to be callable by authenticated/anon directly.
   - Only service_role retains EXECUTE.
   - Resolves: authenticated_security_definer_function_executable.

3. REVOKE all table privileges (SELECT/INSERT/UPDATE/DELETE) from anon on all 10 tables.
   - The app requires authentication; anon has no RLS policies on any table.
   - Removing the raw grants is defense-in-depth: even if an anon-scoped policy were
     accidentally added later, anon would still have no table-level access.
   - Does NOT affect login (login uses the auth-login edge function with the service
     role key, not anon table access).
   - Does NOT affect any authenticated user (their access is governed by the existing
     authenticated RLS policies, which are unchanged).

## What is NOT changed
- No existing RLS policy is modified or dropped.
- No business logic, UI, or frontend code is changed.
- No data is deleted or modified.
- handle_new_user trigger and auth-login edge function are untouched.
- All authenticated CRUD workflows continue to work identically.

## Security
- RLS enabled + forced on all public tables.
- restore_backup executable only by service_role.
- anon has no privileges on any public table.
*/
-- 1. Enable and FORCE Row Level Security on all public tables
ALTER TABLE public.clientes ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.clientes FORCE ROW LEVEL SECURITY;

ALTER TABLE public.configuracoes ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.configuracoes FORCE ROW LEVEL SECURITY;

ALTER TABLE public.equipamentos ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.equipamentos FORCE ROW LEVEL SECURITY;

ALTER TABLE public.ordens_servico ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.ordens_servico FORCE ROW LEVEL SECURITY;

ALTER TABLE public.os_produtos ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.os_produtos FORCE ROW LEVEL SECURITY;

ALTER TABLE public.os_servicos ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.os_servicos FORCE ROW LEVEL SECURITY;

ALTER TABLE public.produtos ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.produtos FORCE ROW LEVEL SECURITY;

ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.profiles FORCE ROW LEVEL SECURITY;

ALTER TABLE public.tecnicos ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.tecnicos FORCE ROW LEVEL SECURITY;

ALTER TABLE public.tipos_equipamento ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.tipos_equipamento FORCE ROW LEVEL SECURITY;

-- 2. Revoke EXECUTE on restore_backup from authenticated and anon (keep service_role)
REVOKE EXECUTE ON FUNCTION public.restore_backup(jsonb) FROM authenticated;
REVOKE EXECUTE ON FUNCTION public.restore_backup(jsonb) FROM anon;

-- 3. Revoke all table privileges from anon on all public tables
REVOKE SELECT, INSERT, UPDATE, DELETE ON public.clientes FROM anon;
REVOKE SELECT, INSERT, UPDATE, DELETE ON public.configuracoes FROM anon;
REVOKE SELECT, INSERT, UPDATE, DELETE ON public.equipamentos FROM anon;
REVOKE SELECT, INSERT, UPDATE, DELETE ON public.ordens_servico FROM anon;
REVOKE SELECT, INSERT, UPDATE, DELETE ON public.os_produtos FROM anon;
REVOKE SELECT, INSERT, UPDATE, DELETE ON public.os_servicos FROM anon;
REVOKE SELECT, INSERT, UPDATE, DELETE ON public.produtos FROM anon;
REVOKE SELECT, INSERT, UPDATE, DELETE ON public.profiles FROM anon;
REVOKE SELECT, INSERT, UPDATE, DELETE ON public.tecnicos FROM anon;
REVOKE SELECT, INSERT, UPDATE, DELETE ON public.tipos_equipamento FROM anon;