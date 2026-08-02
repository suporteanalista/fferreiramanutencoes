/*
  # Fix handle_new_user to persist permissoes_recursos

  1. Modified Functions
    - `handle_new_user()` - Now extracts and saves `permissoes_recursos` from
      user metadata when creating the profile row

  2. Notes
    - Previously only nome, email, and permissao were saved from metadata
    - Now permissoes_recursos (JSONB) is also persisted on profile creation
    - This ensures granular permissions set during user creation are not lost
*/

CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger AS $$
BEGIN
  INSERT INTO public.profiles (id, nome, email, permissao, permissoes_recursos)
  VALUES (
    NEW.id,
    COALESCE(NEW.raw_user_meta_data->>'nome', ''),
    NEW.email,
    COALESCE(NEW.raw_user_meta_data->>'permissao', 'visualizador'),
    CASE
      WHEN NEW.raw_user_meta_data->'permissoes_recursos' IS NOT NULL
      THEN (NEW.raw_user_meta_data->'permissoes_recursos')::jsonb
      ELSE NULL
    END
  );
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
