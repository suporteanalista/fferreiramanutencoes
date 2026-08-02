/*
  # Sistema de Ordem de Servico - Schema Completo (idempotent re-apply)

  Re-applies the base schema with DROP POLICY IF EXISTS guards so it is safe
  to run after a partial prior application.
*/

CREATE TABLE IF NOT EXISTS profiles (
  id uuid PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  nome text NOT NULL DEFAULT '',
  email text NOT NULL DEFAULT '',
  permissao text NOT NULL DEFAULT 'visualizador' CHECK (permissao IN ('administrador', 'vendedor', 'visualizador')),
  ativo boolean NOT NULL DEFAULT true,
  criado_em timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE profiles ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Authenticated users can view all profiles" ON profiles;
CREATE POLICY "Authenticated users can view all profiles"
  ON profiles FOR SELECT TO authenticated USING (true);

DROP POLICY IF EXISTS "Admins can insert profiles" ON profiles;
CREATE POLICY "Admins can insert profiles"
  ON profiles FOR INSERT TO authenticated
  WITH CHECK (
    EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND permissao = 'administrador')
    OR id = auth.uid()
  );

DROP POLICY IF EXISTS "Admins can update profiles" ON profiles;
CREATE POLICY "Admins can update profiles"
  ON profiles FOR UPDATE TO authenticated
  USING (
    EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND permissao = 'administrador')
    OR id = auth.uid()
  )
  WITH CHECK (
    EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND permissao = 'administrador')
    OR id = auth.uid()
  );

DROP POLICY IF EXISTS "Admins can delete profiles" ON profiles;
CREATE POLICY "Admins can delete profiles"
  ON profiles FOR DELETE TO authenticated
  USING (EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND permissao = 'administrador'));

CREATE TABLE IF NOT EXISTS clientes (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  nome text NOT NULL,
  cpf_cnpj text DEFAULT '',
  telefone text DEFAULT '',
  celular text DEFAULT '',
  email text DEFAULT '',
  endereco text DEFAULT '',
  bairro text DEFAULT '',
  cidade text DEFAULT '',
  estado text DEFAULT '',
  cep text DEFAULT '',
  observacoes text DEFAULT '',
  criado_em timestamptz NOT NULL DEFAULT now(),
  atualizado_em timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE clientes ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Authenticated users can view clientes" ON clientes;
CREATE POLICY "Authenticated users can view clientes" ON clientes FOR SELECT TO authenticated USING (true);

DROP POLICY IF EXISTS "Admins and vendedores can insert clientes" ON clientes;
CREATE POLICY "Admins and vendedores can insert clientes" ON clientes FOR INSERT TO authenticated
  WITH CHECK (EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND permissao IN ('administrador', 'vendedor')));

DROP POLICY IF EXISTS "Admins and vendedores can update clientes" ON clientes;
CREATE POLICY "Admins and vendedores can update clientes" ON clientes FOR UPDATE TO authenticated
  USING (EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND permissao IN ('administrador', 'vendedor')))
  WITH CHECK (EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND permissao IN ('administrador', 'vendedor')));

DROP POLICY IF EXISTS "Admins can delete clientes" ON clientes;
CREATE POLICY "Admins can delete clientes" ON clientes FOR DELETE TO authenticated
  USING (EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND permissao = 'administrador'));

CREATE TABLE IF NOT EXISTS equipamentos (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  cliente_id uuid NOT NULL REFERENCES clientes(id) ON DELETE CASCADE,
  tipo text NOT NULL DEFAULT 'smartphone',
  marca text DEFAULT '',
  modelo text DEFAULT '',
  numero_serie text DEFAULT '',
  imei text DEFAULT '',
  cor text DEFAULT '',
  condicao_entrada text DEFAULT '',
  acessorios text DEFAULT '',
  observacoes text DEFAULT '',
  criado_em timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE equipamentos ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Authenticated users can view equipamentos" ON equipamentos;
CREATE POLICY "Authenticated users can view equipamentos" ON equipamentos FOR SELECT TO authenticated USING (true);

DROP POLICY IF EXISTS "Admins and vendedores can insert equipamentos" ON equipamentos;
CREATE POLICY "Admins and vendedores can insert equipamentos" ON equipamentos FOR INSERT TO authenticated
  WITH CHECK (EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND permissao IN ('administrador', 'vendedor')));

DROP POLICY IF EXISTS "Admins and vendedores can update equipamentos" ON equipamentos;
CREATE POLICY "Admins and vendedores can update equipamentos" ON equipamentos FOR UPDATE TO authenticated
  USING (EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND permissao IN ('administrador', 'vendedor')))
  WITH CHECK (EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND permissao IN ('administrador', 'vendedor')));

DROP POLICY IF EXISTS "Admins can delete equipamentos" ON equipamentos;
CREATE POLICY "Admins can delete equipamentos" ON equipamentos FOR DELETE TO authenticated
  USING (EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND permissao = 'administrador'));

CREATE TABLE IF NOT EXISTS tecnicos (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  nome text NOT NULL,
  especialidade text DEFAULT '',
  telefone text DEFAULT '',
  email text DEFAULT '',
  ativo boolean NOT NULL DEFAULT true,
  criado_em timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE tecnicos ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Authenticated users can view tecnicos" ON tecnicos;
CREATE POLICY "Authenticated users can view tecnicos" ON tecnicos FOR SELECT TO authenticated USING (true);

DROP POLICY IF EXISTS "Admins and vendedores can insert tecnicos" ON tecnicos;
CREATE POLICY "Admins and vendedores can insert tecnicos" ON tecnicos FOR INSERT TO authenticated
  WITH CHECK (EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND permissao IN ('administrador', 'vendedor')));

DROP POLICY IF EXISTS "Admins and vendedores can update tecnicos" ON tecnicos;
CREATE POLICY "Admins and vendedores can update tecnicos" ON tecnicos FOR UPDATE TO authenticated
  USING (EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND permissao IN ('administrador', 'vendedor')))
  WITH CHECK (EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND permissao IN ('administrador', 'vendedor')));

DROP POLICY IF EXISTS "Admins can delete tecnicos" ON tecnicos;
CREATE POLICY "Admins can delete tecnicos" ON tecnicos FOR DELETE TO authenticated
  USING (EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND permissao = 'administrador'));

CREATE TABLE IF NOT EXISTS produtos (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  nome text NOT NULL,
  descricao text DEFAULT '',
  codigo text DEFAULT '',
  quantidade_estoque integer NOT NULL DEFAULT 0,
  preco_custo numeric(10,2) NOT NULL DEFAULT 0,
  preco_venda numeric(10,2) NOT NULL DEFAULT 0,
  categoria text DEFAULT '',
  criado_em timestamptz NOT NULL DEFAULT now(),
  atualizado_em timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE produtos ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Authenticated users can view produtos" ON produtos;
CREATE POLICY "Authenticated users can view produtos" ON produtos FOR SELECT TO authenticated USING (true);

DROP POLICY IF EXISTS "Admins and vendedores can insert produtos" ON produtos;
CREATE POLICY "Admins and vendedores can insert produtos" ON produtos FOR INSERT TO authenticated
  WITH CHECK (EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND permissao IN ('administrador', 'vendedor')));

DROP POLICY IF EXISTS "Admins and vendedores can update produtos" ON produtos;
CREATE POLICY "Admins and vendedores can update produtos" ON produtos FOR UPDATE TO authenticated
  USING (EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND permissao IN ('administrador', 'vendedor')))
  WITH CHECK (EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND permissao IN ('administrador', 'vendedor')));

DROP POLICY IF EXISTS "Admins can delete produtos" ON produtos;
CREATE POLICY "Admins can delete produtos" ON produtos FOR DELETE TO authenticated
  USING (EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND permissao = 'administrador'));

CREATE SEQUENCE IF NOT EXISTS os_numero_seq START WITH 1001;

CREATE TABLE IF NOT EXISTS ordens_servico (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  numero_os integer NOT NULL DEFAULT nextval('os_numero_seq'),
  cliente_id uuid NOT NULL REFERENCES clientes(id),
  equipamento_id uuid REFERENCES equipamentos(id),
  tecnico_id uuid REFERENCES tecnicos(id),
  status text NOT NULL DEFAULT 'aberta' CHECK (status IN ('aberta', 'em_andamento', 'aguardando_peca', 'concluida', 'entregue')),
  prioridade text NOT NULL DEFAULT 'normal' CHECK (prioridade IN ('baixa', 'normal', 'alta', 'urgente')),
  defeito_relatado text DEFAULT '',
  laudo_tecnico text DEFAULT '',
  servico_executado text DEFAULT '',
  data_entrada timestamptz NOT NULL DEFAULT now(),
  data_previsao timestamptz,
  data_conclusao timestamptz,
  valor_servico numeric(10,2) NOT NULL DEFAULT 0,
  valor_total numeric(10,2) NOT NULL DEFAULT 0,
  observacoes text DEFAULT '',
  criado_por uuid REFERENCES profiles(id),
  criado_em timestamptz NOT NULL DEFAULT now(),
  atualizado_em timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE ordens_servico ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Authenticated users can view ordens_servico" ON ordens_servico;
CREATE POLICY "Authenticated users can view ordens_servico" ON ordens_servico FOR SELECT TO authenticated USING (true);

DROP POLICY IF EXISTS "Admins and vendedores can insert ordens_servico" ON ordens_servico;
CREATE POLICY "Admins and vendedores can insert ordens_servico" ON ordens_servico FOR INSERT TO authenticated
  WITH CHECK (EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND permissao IN ('administrador', 'vendedor')));

DROP POLICY IF EXISTS "Admins and vendedores can update ordens_servico" ON ordens_servico;
CREATE POLICY "Admins and vendedores can update ordens_servico" ON ordens_servico FOR UPDATE TO authenticated
  USING (EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND permissao IN ('administrador', 'vendedor')))
  WITH CHECK (EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND permissao IN ('administrador', 'vendedor')));

DROP POLICY IF EXISTS "Admins can delete ordens_servico" ON ordens_servico;
CREATE POLICY "Admins can delete ordens_servico" ON ordens_servico FOR DELETE TO authenticated
  USING (EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND permissao = 'administrador'));

CREATE TABLE IF NOT EXISTS os_produtos (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  ordem_servico_id uuid NOT NULL REFERENCES ordens_servico(id) ON DELETE CASCADE,
  produto_id uuid NOT NULL REFERENCES produtos(id),
  quantidade integer NOT NULL DEFAULT 1,
  preco_unitario numeric(10,2) NOT NULL DEFAULT 0,
  preco_total numeric(10,2) NOT NULL DEFAULT 0
);

ALTER TABLE os_produtos ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Authenticated users can view os_produtos" ON os_produtos;
CREATE POLICY "Authenticated users can view os_produtos" ON os_produtos FOR SELECT TO authenticated USING (true);

DROP POLICY IF EXISTS "Admins and vendedores can insert os_produtos" ON os_produtos;
CREATE POLICY "Admins and vendedores can insert os_produtos" ON os_produtos FOR INSERT TO authenticated
  WITH CHECK (EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND permissao IN ('administrador', 'vendedor')));

DROP POLICY IF EXISTS "Admins and vendedores can update os_produtos" ON os_produtos;
CREATE POLICY "Admins and vendedores can update os_produtos" ON os_produtos FOR UPDATE TO authenticated
  USING (EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND permissao IN ('administrador', 'vendedor')))
  WITH CHECK (EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND permissao IN ('administrador', 'vendedor')));

DROP POLICY IF EXISTS "Admins can delete os_produtos" ON os_produtos;
CREATE POLICY "Admins can delete os_produtos" ON os_produtos FOR DELETE TO authenticated
  USING (EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND permissao = 'administrador'));

CREATE TABLE IF NOT EXISTS configuracoes (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  nome_empresa text NOT NULL DEFAULT 'Minha Empresa',
  logo_url text DEFAULT '',
  telefone text DEFAULT '',
  endereco text DEFAULT '',
  criado_em timestamptz NOT NULL DEFAULT now(),
  atualizado_em timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE configuracoes ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Authenticated users can view configuracoes" ON configuracoes;
CREATE POLICY "Authenticated users can view configuracoes" ON configuracoes FOR SELECT TO authenticated USING (true);

DROP POLICY IF EXISTS "Admins can insert configuracoes" ON configuracoes;
CREATE POLICY "Admins can insert configuracoes" ON configuracoes FOR INSERT TO authenticated
  WITH CHECK (EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND permissao = 'administrador'));

DROP POLICY IF EXISTS "Admins can update configuracoes" ON configuracoes;
CREATE POLICY "Admins can update configuracoes" ON configuracoes FOR UPDATE TO authenticated
  USING (EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND permissao = 'administrador'))
  WITH CHECK (EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND permissao = 'administrador'));

CREATE INDEX IF NOT EXISTS idx_clientes_nome ON clientes(nome);
CREATE INDEX IF NOT EXISTS idx_clientes_cpf_cnpj ON clientes(cpf_cnpj);
CREATE INDEX IF NOT EXISTS idx_equipamentos_cliente_id ON equipamentos(cliente_id);
CREATE INDEX IF NOT EXISTS idx_ordens_servico_cliente_id ON ordens_servico(cliente_id);
CREATE INDEX IF NOT EXISTS idx_ordens_servico_status ON ordens_servico(status);
CREATE INDEX IF NOT EXISTS idx_ordens_servico_numero_os ON ordens_servico(numero_os);
CREATE INDEX IF NOT EXISTS idx_os_produtos_ordem_servico_id ON os_produtos(ordem_servico_id);
CREATE INDEX IF NOT EXISTS idx_produtos_codigo ON produtos(codigo);

CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger AS $$
BEGIN
  INSERT INTO public.profiles (id, nome, email, permissao)
  VALUES (
    NEW.id,
    COALESCE(NEW.raw_user_meta_data->>'nome', ''),
    NEW.email,
    COALESCE(NEW.raw_user_meta_data->>'permissao', 'visualizador')
  );
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

INSERT INTO configuracoes (nome_empresa, telefone, endereco)
VALUES ('Minha Empresa', '(00) 0000-0000', 'Endereco da empresa')
ON CONFLICT DO NOTHING;