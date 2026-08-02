/*
  # Revoke PUBLIC execute on handle_new_user

  Ensures the SECURITY DEFINER trigger function cannot be called via REST API.
*/

REVOKE EXECUTE ON FUNCTION public.handle_new_user() FROM PUBLIC;