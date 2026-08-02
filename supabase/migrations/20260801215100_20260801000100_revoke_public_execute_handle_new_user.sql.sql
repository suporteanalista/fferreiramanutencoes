/*
  # Revoke PUBLIC execute on handle_new_user

  1. Security
    - The trigger function handle_new_user is SECURITY DEFINER and was still
      callable via the REST API by any role because PUBLIC retained EXECUTE.
    - Revoke EXECUTE FROM PUBLIC so only the postgres superuser (trigger) and
      service_role can invoke it. The trigger on auth.users still fires correctly
      because triggers run with the function owner's privileges.
*/

REVOKE EXECUTE ON FUNCTION public.handle_new_user() FROM PUBLIC;