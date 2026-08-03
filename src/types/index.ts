export type Recurso = 'dashboard' | 'ordens' | 'clientes' | 'equipamentos' | 'tecnicos' | 'produtos' | 'relatorios';
export type Acao = 'ver' | 'criar' | 'editar' | 'excluir';

export type PermissoesRecursos = {
  [key in Recurso]?: Partial<Record<Acao, boolean>>;
};

export interface Profile {
  id: string;
  nome: string;
  email: string;
  permissao: 'administrador' | 'operador' | 'vendedor' | 'visualizador';
  ativo: boolean;
  criado_em: string;
  permissoes_recursos?: PermissoesRecursos;
}

export interface Cliente {
  id: string;
  nome: string;
  cpf_cnpj: string;
  telefone: string;
  celular: string;
  email: string;
  endereco: string;
  bairro: string;
  cidade: string;
  estado: string;
  cep: string;
  observacoes: string;
  criado_em: string;
  atualizado_em: string;
}

export interface Equipamento {
  id: string;
  cliente_id: string;
  tipo: string;
  marca: string;
  modelo: string;
  numero_serie: string;
  imei: string;
  cor: string;
  condicao_entrada: string;
  acessorios: string;
  observacoes: string;
  criado_em: string;
  cliente?: Cliente;
}

export interface Tecnico {
  id: string;
  nome: string;
  especialidade: string;
  telefone: string;
  email: string;
  ativo: boolean;
  criado_em: string;
}

export interface Produto {
  id: string;
  nome: string;
  descricao: string;
  codigo: string;
  quantidade_estoque: number;
  preco_custo: number;
  preco_venda: number;
  categoria: string;
  tipo_item: 'produto' | 'servico';
  ativo: boolean;
  criado_em: string;
  atualizado_em: string;
}

export interface OrdemServico {
  id: string;
  numero_os: number;
  cliente_id: string;
  equipamento_id: string | null;
  tecnico_id: string | null;
  status: 'aberta' | 'em_andamento' | 'aguardando_peca' | 'concluida' | 'entregue';
  prioridade: 'baixa' | 'normal' | 'alta' | 'urgente';
  defeito_relatado: string;
  laudo_tecnico: string;
  servico_executado: string;
  data_entrada: string;
  data_previsao: string | null;
  data_conclusao: string | null;
  data_revisao_futura: string | null;
  valor_servico: number;
  valor_total: number;
  observacoes: string;
  criado_por: string | null;
  criado_em: string;
  atualizado_em: string;
  cliente?: Cliente;
  equipamento?: Equipamento;
  tecnico?: Tecnico;
  os_produtos?: OsProduto[];
  os_servicos?: OsServico[];
}

export interface OsProduto {
  id: string;
  ordem_servico_id: string;
  produto_id: string;
  quantidade: number;
  preco_unitario: number;
  preco_total: number;
  produto?: Produto;
}

export interface OsServico {
  id: string;
  ordem_servico_id: string;
  descricao: string;
  quantidade: number;
  preco_unitario: number;
  preco_total: number;
}

export interface Configuracao {
  id: string;
  nome_empresa: string;
  razao_social: string;
  cnpj: string;
  logo_url: string;
  telefone: string;
  celular: string;
  email: string;
  endereco: string;
  bairro: string;
  cidade: string;
  estado: string;
  cep: string;
  inscricao_estadual: string;
  inscricao_municipal: string;
  responsavel: string;
  site: string;
  criado_em: string;
  atualizado_em: string;
}
