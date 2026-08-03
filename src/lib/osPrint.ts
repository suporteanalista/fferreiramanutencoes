import { OrdemServico, Configuracao } from '../types';
import { loadLogoBase64 } from './pdfLogo';

const statusLabels: Record<string, string> = {
  aberta: 'Aberta',
  em_andamento: 'Em Andamento',
  aguardando_peca: 'Aguardando Peca',
  concluida: 'Concluida',
  entregue: 'Entregue',
};

const prioridadeLabels: Record<string, string> = {
  baixa: 'Baixa',
  normal: 'Normal',
  alta: 'Alta',
  urgente: 'Urgente',
};

function formatCurrency(v: number): string {
  return new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(v || 0);
}

function formatDate(d: string | null): string {
  if (!d) return '-';
  return new Date(d).toLocaleDateString('pt-BR');
}

interface ClassifiedItem {
  nome: string;
  quantidade: number;
  preco_unitario: number;
  preco_total: number;
}

interface ClassifiedItems {
  produtos: ClassifiedItem[];
  servicos: ClassifiedItem[];
  totalProdutos: number;
  totalServicos: number;
  totalGeral: number;
}

function classifyItems(os: OrdemServico): ClassifiedItems {
  const produtos: ClassifiedItem[] = [];
  const servicos: ClassifiedItem[] = [];

  (os.os_produtos || []).forEach(p => {
    const prod = p.produto as any;
    const nome = prod?.nome || '-';
    const isServico = prod?.tipo_item === 'servico';
    if (isServico) {
      servicos.push({ nome, quantidade: p.quantidade, preco_unitario: p.preco_unitario, preco_total: p.preco_total });
    } else {
      produtos.push({ nome, quantidade: p.quantidade, preco_unitario: p.preco_unitario, preco_total: p.preco_total });
    }
  });

  (os.os_servicos || []).forEach(s => {
    servicos.push({ nome: s.descricao || '-', quantidade: s.quantidade, preco_unitario: s.preco_unitario, preco_total: s.preco_total });
  });

  const totalProdutos = produtos.reduce((sum, p) => sum + (p.preco_total || 0), 0);
  const totalServicos = servicos.reduce((sum, s) => sum + (s.preco_total || 0), 0);
  const totalGeral = totalProdutos + totalServicos;

  return { produtos, servicos, totalProdutos, totalServicos, totalGeral };
}

export async function printOS(os: OrdemServico, config: Partial<Configuracao> | null) {
  const cliente = os.cliente as any;
  const equip = os.equipamento as any;
  const tecnico = os.tecnico as any;
  const items = classifyItems(os);
  const logoBase64 = await loadLogoBase64();

  const logoImg = logoBase64 ? `<img src="${logoBase64}" alt="Logo"/>` : '';

  const companyAddr = [config?.endereco, config?.bairro, config?.cidade, config?.estado].filter(Boolean).join(', ');
  const companyContacts = [
    config?.telefone ? `Tel: ${config.telefone}` : '',
    config?.celular ? `Cel: ${config.celular}` : '',
    config?.email || '',
  ].filter(Boolean).join(' | ');

  const produtosTable = items.produtos.length > 0
    ? `<table class="item-table">
        <thead><tr><th>Produto / Peca</th><th class="col-qtd">Quantidade</th><th class="col-preco">Preco Unit.</th><th class="col-total">Total</th></tr></thead>
        <tbody>
          ${items.produtos.map(p => `<tr><td class="col-nome">${p.nome}</td><td class="col-qtd">${p.quantidade}</td><td class="col-preco">${formatCurrency(p.preco_unitario)}</td><td class="col-total">${formatCurrency(p.preco_total)}</td></tr>`).join('')}
        </tbody>
      </table>`
    : `<table class="item-table">
        <tbody><tr><td class="empty-msg">Nenhum produto ou peca informado</td></tr></tbody>
      </table>`;

  const servicosTable = items.servicos.length > 0
    ? `<table class="item-table">
        <thead><tr><th>Servico</th><th class="col-qtd">Quantidade</th><th class="col-preco">Preco Unit.</th><th class="col-total">Total</th></tr></thead>
        <tbody>
          ${items.servicos.map(s => `<tr><td class="col-nome">${s.nome}</td><td class="col-qtd">${s.quantidade}</td><td class="col-preco">${formatCurrency(s.preco_unitario)}</td><td class="col-total">${formatCurrency(s.preco_total)}</td></tr>`).join('')}
        </tbody>
      </table>`
    : `<table class="item-table">
        <tbody><tr><td class="empty-msg">Nenhum servico informado</td></tr></tbody>
      </table>`;

  const html = `<!DOCTYPE html>
<html lang="pt-BR">
<head>
<meta charset="UTF-8"/>
<title>OS #${os.numero_os}</title>
<style>
  * { margin: 0; padding: 0; box-sizing: border-box; }
  body { font-family: 'Segoe UI', Arial, sans-serif; font-size: 14px; color: #0f172a; padding: 12mm; max-width: 210mm; margin: 0 auto; }
  .header { display: flex; align-items: center; justify-content: space-between; margin-bottom: 16px; padding-bottom: 12px; border-bottom: 2px solid #1e88e5; }
  .header-left { display: flex; align-items: center; gap: 12px; }
  .header-left img { width: 60px; height: 60px; object-fit: contain; }
  .company-name { font-size: 22px; font-weight: 700; color: #0a2540; }
  .company-info { font-size: 12px; color: #64748b; margin-top: 3px; line-height: 1.5; }
  .os-badge { background: #0a2540; color: white; padding: 10px 18px; border-radius: 4px; text-align: center; }
  .os-badge-label { font-size: 10px; font-weight: 600; letter-spacing: 0.5px; text-transform: uppercase; opacity: 0.9; }
  .os-badge-number { font-size: 20px; font-weight: 800; margin-top: 3px; }
  .meta-row { display: grid; grid-template-columns: repeat(4, 1fr); gap: 12px; margin-bottom: 16px; padding: 10px 0; }
  .meta-item label { display: block; font-size: 10px; text-transform: uppercase; color: #64748b; font-weight: 600; letter-spacing: 0.3px; margin-bottom: 3px; }
  .meta-item span { font-size: 14px; font-weight: 600; color: #0f172a; }
  .section { margin-bottom: 16px; }
  .section-title { background: #f8fafc; padding: 7px 12px; font-size: 16px; font-weight: 700; text-transform: uppercase; color: #0a2540; letter-spacing: 0.5px; border-left: 4px solid #1e88e5; margin-bottom: 10px; }
  .fields-grid { display: grid; grid-template-columns: repeat(3, 1fr); gap: 10px; padding: 0 4px; }
  .fields-grid-2 { display: grid; grid-template-columns: 2fr 1fr; gap: 10px; padding: 0 4px; }
  .fields-grid-2b { display: grid; grid-template-columns: 2fr 1fr; gap: 10px; padding: 0 4px; margin-top: 8px; }
  .field label { display: block; font-size: 10px; text-transform: uppercase; color: #64748b; font-weight: 600; margin-bottom: 3px; }
  .field span { font-size: 13px; color: #0f172a; font-weight: 500; }
  .text-block { font-size: 13px; line-height: 1.6; color: #334155; padding: 10px 12px; border-radius: 3px; border: 1px solid #cbd5e1; min-height: 32px; }
  .item-table { width: 100%; border-collapse: collapse; font-size: 13px; margin-top: 6px; }
  .item-table th { background: #0a2540; color: white; padding: 8px 12px; text-align: left; font-weight: 700; font-size: 13px; }
  .item-table td { padding: 8px 12px; border-bottom: 1px solid #e2e8f0; }
  .item-table tr:nth-child(even) { background: #f8fafc; }
  .col-nome { text-align: left; word-wrap: break-word; word-break: break-word; }
  .col-qtd { text-align: center; white-space: nowrap; }
  .col-preco { text-align: right; white-space: nowrap; }
  .col-total { text-align: right; white-space: nowrap; }
  .empty-msg { text-align: center; font-style: italic; color: #94a3b8; padding: 12px; font-size: 13px; }
  .financial { border: 1px solid #cbd5e1; border-radius: 4px; overflow: hidden; margin-top: 10px; page-break-inside: avoid; }
  .fin-row { display: flex; justify-content: space-between; padding: 8px 14px; border-bottom: 1px solid #e2e8f0; font-size: 14px; }
  .fin-row:last-child { border-bottom: none; }
  .fin-total { background: #0a2540; padding: 10px 14px; display: flex; justify-content: space-between; align-items: center; font-size: 17px; font-weight: 700; color: #ffffff; }
  .tecnico-info { font-size: 12px; color: #64748b; margin-top: 10px; }
  .signatures { display: grid; grid-template-columns: 1fr 1fr; gap: 60px; margin-top: 50px; padding-top: 10px; page-break-inside: avoid; }
  .sig-line { border-top: 1px solid #0a2540; padding-top: 8px; text-align: center; font-size: 11px; color: #64748b; }
  .footer { margin-top: 24px; text-align: center; font-size: 10px; color: #94a3b8; border-top: 1px solid #e2e8f0; padding-top: 10px; }
  @media print {
    body { padding: 0; max-width: none; }
    @page { margin: 12mm; size: A4 portrait; }
    .item-table { page-break-inside: auto; }
    .item-table tr { page-break-inside: avoid; page-break-after: auto; }
    .item-table thead { display: table-header-group; }
    .financial { page-break-inside: avoid; }
    .signatures { page-break-inside: avoid; }
    .section { page-break-inside: avoid; }
  }
</style>
</head>
<body>
  <div class="header">
    <div class="header-left">
      ${logoImg}
      <div>
        <div class="company-name">${config?.nome_empresa || 'FF Manutencoes'}</div>
        ${companyAddr ? `<div class="company-info">${companyAddr}</div>` : ''}
        ${companyContacts ? `<div class="company-info">${companyContacts}</div>` : ''}
        ${config?.cnpj ? `<div class="company-info">CNPJ: ${config.cnpj}</div>` : ''}
      </div>
    </div>
    <div class="os-badge">
      <div class="os-badge-label">Ordem de Servico</div>
      <div class="os-badge-number">#${os.numero_os}</div>
    </div>
  </div>

  <div class="meta-row">
    <div class="meta-item"><label>Status</label><span>${statusLabels[os.status] || os.status}</span></div>
    <div class="meta-item"><label>Prioridade</label><span>${prioridadeLabels[os.prioridade] || os.prioridade}</span></div>
    <div class="meta-item"><label>Data Entrada</label><span>${formatDate(os.data_entrada)}</span></div>
    <div class="meta-item"><label>Previsao</label><span>${formatDate(os.data_previsao)}</span></div>
  </div>

  <div class="section">
    <div class="section-title">Dados do Cliente</div>
    <div class="fields-grid-2">
      <div class="field"><label>Nome</label><span>${cliente?.nome || '-'}</span></div>
      <div class="field"><label>Telefone/Celular</label><span>${cliente?.celular || cliente?.telefone || '-'}</span></div>
    </div>
    ${(cliente?.endereco || cliente?.cidade) ? `
    <div class="fields-grid-2b">
      <div class="field"><label>Endereco</label><span>${cliente?.endereco || '-'}</span></div>
      <div class="field"><label>Cidade/UF</label><span>${[cliente?.cidade, cliente?.estado].filter(Boolean).join('/') || '-'}</span></div>
    </div>` : ''}
  </div>

  <div class="section">
    <div class="section-title">Dados do Equipamento</div>
    <div class="fields-grid">
      <div class="field"><label>Tipo</label><span>${equip?.tipo || '-'}</span></div>
      <div class="field"><label>Marca</label><span>${equip?.marca || '-'}</span></div>
      <div class="field"><label>Modelo</label><span>${equip?.modelo || '-'}</span></div>
    </div>
    ${equip?.numero_serie ? `
    <div class="fields-grid" style="margin-top: 8px;">
      <div class="field"><label>N. Serie</label><span>${equip.numero_serie}</span></div>
      <div class="field"><label>Cor</label><span>${equip?.cor || '-'}</span></div>
      <div class="field"><label>Condicao</label><span>${equip?.condicao_entrada || '-'}</span></div>
    </div>` : ''}
  </div>

  <div class="section">
    <div class="section-title">Defeito Relatado pelo Cliente</div>
    <div class="text-block">${os.defeito_relatado || 'Nenhum defeito relatado'}</div>
  </div>

  ${os.laudo_tecnico ? `
  <div class="section">
    <div class="section-title">Laudo Tecnico</div>
    <div class="text-block">${os.laudo_tecnico}</div>
  </div>` : ''}

  ${os.servico_executado ? `
  <div class="section">
    <div class="section-title">Nota Tecnica</div>
    <div class="text-block">${os.servico_executado}</div>
  </div>` : ''}

  <div class="section">
    <div class="section-title">Produtos / Pecas</div>
    ${produtosTable}
  </div>

  <div class="section">
    <div class="section-title">Servicos</div>
    ${servicosTable}
  </div>

  <div class="section">
    <div class="section-title">Resumo Financeiro</div>
    <div class="financial">
      <div class="fin-row"><span>Total de Produtos / Pecas</span><span>${formatCurrency(items.totalProdutos)}</span></div>
      <div class="fin-row"><span>Total de Servicos</span><span>${formatCurrency(items.totalServicos)}</span></div>
      <div class="fin-total"><span>TOTAL GERAL</span><span>${formatCurrency(items.totalGeral)}</span></div>
    </div>
  </div>

  ${tecnico?.nome ? `<div class="tecnico-info"><strong>Tecnico responsavel:</strong> ${tecnico.nome}</div>` : ''}

  <div class="signatures">
    <div class="sig-line">Assinatura do Cliente</div>
    <div class="sig-line">Assinatura do Tecnico</div>
  </div>

  <div class="footer">
    ${config?.nome_empresa || 'FF Manutencoes'} - Documento gerado em ${new Date().toLocaleString('pt-BR')}
  </div>
</body>
</html>`;

  const printWindow = window.open('', '_blank');
  if (!printWindow) return;
  printWindow.document.open();
  printWindow.document.write(html);
  printWindow.document.close();
  setTimeout(() => {
    printWindow.focus();
    printWindow.print();
  }, 400);
}
