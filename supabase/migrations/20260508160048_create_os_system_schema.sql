/*
  # Sistema de Ordem de Servico - Schema Completo

  1. New Tables
    - `profiles` - Perfis de usuario vinculados ao auth.users
      - `id` (uuid, PK, referencia auth.users)
      - `nome` (text) - Nome completo
      - `email` (text) - Email
      - `permissao` (text) - administrador, vendedor, visualizador
      - `ativo` (boolean) - Se o usuario esta ativo
      - `criado_em` (timestamptz)
    - `clientes` - Carteira de clientes
      - `id` (uuid, PK)
      - `nome` (text) - Nome/Razao social
      - `cpf_cnpj` (text) - Documento
      - `telefone` (text)
      - `celular` (text)
      - `email` (text)
      - `endereco` (text)
      - `bairro` (text)
      - `cidade` (text)
      - `estado` (text)
      - `cep` (text)
      - `observacoes` (text)
      - `criado_em` (timestamptz)
      - `atualizado_em` (timestamptz)
    - `equipamentos` - Equipamentos dos clientes
      - `id` (uuid, PK)
      - `cliente_id` (uuid, FK clientes)
      - `tipo` (text) - smartphone, notebook, impressora, etc.
      - `marca` (text)
      - `modelo` (text)
      - `numero_serie` (text)
      - `imei` (text)
      - `cor` (text)
      - `condicao_entrada` (text)
      - `acessorios` (text)
      - `observacoes` (text)
      - `criado_em` (timestamptz)
    - `tecnicos` - Tecnicos da equipe
      - `id` (uuid, PK)
      - `nome` (text)
      - `especialidade` (text)
      - `telefone` (text)
      - `email` (text)
      - `ativo` (boolean)
      - `criado_em` (timestamptz)
    - `produtos` - Pecas e produtos para OS
      - `id` (uuid, PK)
      - `nome` (text)
      - `descricao` (text)
      - `codigo` (text)
      - `quantidade_estoque` (integer)
      - `preco_custo` (numeric)
      - `preco_venda` (numeric)
      - `categoria` (text)
      - `criado_em` (timestamptz)
      - `atualizado_em` (timestamptz)
    - `ordens_servico` - Ordens de servico
      - `id` (uuid, PK)
      - `numero_os` (serial)
      - `cliente_id` (uuid, FK)
      - `equipamento_id` (uuid, FK)
      - `tecnico_id` (uuid, FK)
      - `status` (text) - aberta, em_andamento, aguardando_peca, concluida, entregue
      - `prioridade` (text) - baixa, normal, alta, urgente
      - `defeito_relatado` (text)
      - `laudo_tecnico` (text)
      - `servico_executado` (text)
      - `data_entrada` (timestamptz)
      - `data_previsao` (timestamptz)
      - `data_conclusao` (timestamptz)
      - `valor_servico` (numeric)
      - `valor_total` (numeric)
      - `observacoes` (text)
      - `criado_por` (uuid, FK profiles)
      - `criado_em` (timestamptz)
      - `atualizado_em` (timestamptz)
    - `os_produtos` - Produtos usados em cada OS
      - `id` (uuid, PK)
      - `ordem_servico_id` (uuid, FK)
      - `produto_id` (uuid, FK)
      - `quantidade` (integer)
      - `preco_unitario` (numeric)
      - `preco_total` (numeric)
    - `configuracoes` - Configuracoes do sistema (logo, nome empresa)
      - `id` (uuid, PK)
      - `nome_empresa` (text)
      - `logo_url` (text)
      - `telefone` (text)
      - `endereco` (text)
      - `criado_em` (timestamptz)
      - `atualizado_em` (timestamptz)

  2. Security
    - RLS habilitado em todas as tabelas
    - Policies baseadas em autenticacao
    - Administradores tem acesso total
    - Vendedores podem criar/editar (exceto usuarios)
    - Visualizadores somente leitura
*/

-- Profiles table (linked to auth.users)
CREATE TABLE IF NOT EXISTS profiles (
  id uuid PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  nome text NOT NULL DEFAULT '',
  email text NOT NULL DEFAULT '',
  permissao text NOT NULL DEFAULT 'visualizador' CHECK (permissao IN ('administrador', 'vendedor', 'visualizador')),
  ativo boolean NOT NULL DEFAULT true,
  criado_em timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE profiles ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated users can view all profiles"
  ON profiles FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "Admins can insert profiles"
  ON profiles FOR INSERT
  TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM profiles WHERE id = auth.uid() AND permissao = 'administrador'
    )
    OR id = auth.uid()
  );

CREATE POLICY "Admins can update profiles"
  ON profiles FOR UPDATE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM profiles WHERE id = auth.uid() AND permissao = 'administrador'
    )
    OR id = auth.uid()
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM profiles WHERE id = auth.uid() AND permissao = 'administrador'
    )
    OR id = auth.uid()
  );

CREATE POLICY "Admins can delete profiles"
  ON profiles FOR DELETE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM profiles WHERE id = auth.uid() AND permissao = 'administrador'
    )
  );

-- Clientes table
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

CREATE POLICY "Authenticated users can view clientes"
  ON clientes FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "Admins and vendedores can insert clientes"
  ON clientes FOR INSERT
  TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM profiles WHERE id = auth.uid() AND permissao IN ('administrador', 'vendedor')
    )
  );

CREATE POLICY "Admins and vendedores can update clientes"
  ON clientes FOR UPDATE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM profiles WHERE id = auth.uid() AND permissao IN ('administrador', 'vendedor')
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM profiles WHERE id = auth.uid() AND permissao IN ('administrador', 'vendedor')
    )
  );

CREATE POLICY "Admins can delete clientes"
  ON clientes FOR DELETE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM profiles WHERE id = auth.uid() AND permissao = 'administrador'
    )
  );

-- Equipamentos table
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

CREATE POLICY "Authenticated users can view equipamentos"
  ON equipamentos FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "Admins and vendedores can insert equipamentos"
  ON equipamentos FOR INSERT
  TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM profiles WHERE id = auth.uid() AND permissao IN ('administrador', 'vendedor')
    )
  );

CREATE POLICY "Admins and vendedores can update equipamentos"
  ON equipamentos FOR UPDATE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM profiles WHERE id = auth.uid() AND permissao IN ('administrador', 'vendedor')
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM profiles WHERE id = auth.uid() AND permissao IN ('administrador', 'vendedor')
    )
  );

CREATE POLICY "Admins can delete equipamentos"
  ON equipamentos FOR DELETE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM profiles WHERE id = auth.uid() AND permissao = 'administrador'
    )
  );

-- Tecnicos table
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

CREATE POLICY "Authenticated users can view tecnicos"
  ON tecnicos FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "Admins and vendedores can insert tecnicos"
  ON tecnicos FOR INSERT
  TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM profiles WHERE id = auth.uid() AND permissao IN ('administrador', 'vendedor')
    )
  );

CREATE POLICY "Admins and vendedores can update tecnicos"
  ON tecnicos FOR UPDATE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM profiles WHERE id = auth.uid() AND permissao IN ('administrador', 'vendedor')
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM profiles WHERE id = auth.uid() AND permissao IN ('administrador', 'vendedor')
    )
  );

CREATE POLICY "Admins can delete tecnicos"
  ON tecnicos FOR DELETE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM profiles WHERE id = auth.uid() AND permissao = 'administrador'
    )
  );

-- Produtos table
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

CREATE POLICY "Authenticated users can view produtos"
  ON produtos FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "Admins and vendedores can insert produtos"
  ON produtos FOR INSERT
  TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM profiles WHERE id = auth.uid() AND permissao IN ('administrador', 'vendedor')
    )
  );

CREATE POLICY "Admins and vendedores can update produtos"
  ON produtos FOR UPDATE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM profiles WHERE id = auth.uid() AND permissao IN ('administrador', 'vendedor')
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM profiles WHERE id = auth.uid() AND permissao IN ('administrador', 'vendedor')
    )
  );

CREATE POLICY "Admins can delete produtos"
  ON produtos FOR DELETE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM profiles WHERE id = auth.uid() AND permissao = 'administrador'
    )
  );

-- Ordens de servico table
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

CREATE POLICY "Authenticated users can view ordens_servico"
  ON ordens_servico FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "Admins and vendedores can insert ordens_servico"
  ON ordens_servico FOR INSERT
  TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM profiles WHERE id = auth.uid() AND permissao IN ('administrador', 'vendedor')
    )
  );

CREATE POLICY "Admins and vendedores can update ordens_servico"
  ON ordens_servico FOR UPDATE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM profiles WHERE id = auth.uid() AND permissao IN ('administrador', 'vendedor')
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM profiles WHERE id = auth.uid() AND permissao IN ('administrador', 'vendedor')
    )
  );

CREATE POLICY "Admins can delete ordens_servico"
  ON ordens_servico FOR DELETE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM profiles WHERE id = auth.uid() AND permissao = 'administrador'
    )
  );

-- OS Produtos (itens de cada OS)
CREATE TABLE IF NOT EXISTS os_produtos (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  ordem_servico_id uuid NOT NULL REFERENCES ordens_servico(id) ON DELETE CASCADE,
  produto_id uuid NOT NULL REFERENCES produtos(id),
  quantidade integer NOT NULL DEFAULT 1,
  preco_unitario numeric(10,2) NOT NULL DEFAULT 0,
  preco_total numeric(10,2) NOT NULL DEFAULT 0
);

ALTER TABLE os_produtos ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated users can view os_produtos"
  ON os_produtos FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "Admins and vendedores can insert os_produtos"
  ON os_produtos FOR INSERT
  TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM profiles WHERE id = auth.uid() AND permissao IN ('administrador', 'vendedor')
    )
  );

CREATE POLICY "Admins and vendedores can update os_produtos"
  ON os_produtos FOR UPDATE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM profiles WHERE id = auth.uid() AND permissao IN ('administrador', 'vendedor')
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM profiles WHERE id = auth.uid() AND permissao IN ('administrador', 'vendedor')
    )
  );

CREATE POLICY "Admins can delete os_produtos"
  ON os_produtos FOR DELETE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM profiles WHERE id = auth.uid() AND permissao = 'administrador'
    )
  );

-- Configuracoes do sistema
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

CREATE POLICY "Authenticated users can view configuracoes"
  ON configuracoes FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "Admins can insert configuracoes"
  ON configuracoes FOR INSERT
  TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM profiles WHERE id = auth.uid() AND permissao = 'administrador'
    )
  );

CREATE POLICY "Admins can update configuracoes"
  ON configuracoes FOR UPDATE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM profiles WHERE id = auth.uid() AND permissao = 'administrador'
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM profiles WHERE id = auth.uid() AND permissao = 'administrador'
    )
  );

-- Indexes for performance
CREATE INDEX IF NOT EXISTS idx_clientes_nome ON clientes(nome);
CREATE INDEX IF NOT EXISTS idx_clientes_cpf_cnpj ON clientes(cpf_cnpj);
CREATE INDEX IF NOT EXISTS idx_equipamentos_cliente_id ON equipamentos(cliente_id);
CREATE INDEX IF NOT EXISTS idx_ordens_servico_cliente_id ON ordens_servico(cliente_id);
CREATE INDEX IF NOT EXISTS idx_ordens_servico_status ON ordens_servico(status);
CREATE INDEX IF NOT EXISTS idx_ordens_servico_numero_os ON ordens_servico(numero_os);
CREATE INDEX IF NOT EXISTS idx_os_produtos_ordem_servico_id ON os_produtos(ordem_servico_id);
CREATE INDEX IF NOT EXISTS idx_produtos_codigo ON produtos(codigo);

-- Function to auto-create profile on signup
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

-- Trigger for auto-creating profile
DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- Insert default config
INSERT INTO configuracoes (nome_empresa, telefone, endereco)
VALUES ('Minha Empresa', '(00) 0000-0000', 'Endereco da empresa')
ON CONFLICT DO NOTHING;