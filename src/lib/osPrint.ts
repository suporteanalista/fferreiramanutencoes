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

export async function printOS(os: OrdemServico, config: Partial<Configuracao> | null) {
  const cliente = os.cliente as any;
  const equip = os.equipamento as any;
  const tecnico = os.tecnico as any;
  const produtos = os.os_produtos || [];
  const servicos = os.os_servicos || [];
  const prodTotal = produtos.reduce((s, p) => s + (p.preco_total || 0), 0);
  const svcTotal = servicos.reduce((s, sv) => s + (sv.preco_total || 0), 0);
  const logoBase64 = await loadLogoBase64();

  const logoImg = logoBase64 ? `<img src="${logoBase64}" alt="Logo"/>` : '';

  const companyAddr = [config?.endereco, config?.bairro, config?.cidade, config?.estado].filter(Boolean).join(', ');
  const companyContacts = [
    config?.telefone ? `Tel: ${config.telefone}` : '',
    config?.celular ? `Cel: ${config.celular}` : '',
    config?.email || '',
  ].filter(Boolean).join(' | ');

  const html = `<!DOCTYPE html>
<html lang="pt-BR">
<head>
<meta charset="UTF-8"/>
<title>OS #${os.numero_os}</title>
<style>
  * { margin: 0; padding: 0; box-sizing: border-box; }
  body { font-family: 'Segoe UI', Arial, sans-serif; font-size: 12px; color: #0f172a; padding: 20px; max-width: 210mm; margin: 0 auto; }
  .header { display: flex; align-items: center; justify-content: space-between; margin-bottom: 16px; padding-bottom: 12px; border-bottom: 2px solid #1e88e5; }
  .header-left { display: flex; align-items: center; gap: 12px; }
  .header-left img { width: 56px; height: 56px; object-fit: contain; }
  .company-name { font-size: 16px; font-weight: 700; color: #0a2540; }
  .company-info { font-size: 10px; color: #64748b; margin-top: 2px; line-height: 1.5; }
  .os-badge { background: #0a2540; color: white; padding: 10px 18px; border-radius: 4px; text-align: center; }
  .os-badge-label { font-size: 8px; font-weight: 600; letter-spacing: 0.5px; text-transform: uppercase; opacity: 0.9; }
  .os-badge-number { font-size: 18px; font-weight: 800; margin-top: 2px; }
  .meta-row { display: grid; grid-template-columns: repeat(4, 1fr); gap: 12px; margin-bottom: 14px; padding: 8px 0; }
  .meta-item label { display: block; font-size: 8px; text-transform: uppercase; color: #64748b; font-weight: 600; letter-spacing: 0.3px; }
  .meta-item span { font-size: 12px; font-weight: 600; color: #0f172a; }
  .section { margin-bottom: 14px; }
  .section-title { background: #f8fafc; padding: 5px 10px; font-size: 9px; font-weight: 700; text-transform: uppercase; color: #0a2540; letter-spacing: 0.5px; border-left: 3px solid #1e88e5; margin-bottom: 8px; }
  .fields-grid { display: grid; grid-template-columns: repeat(3, 1fr); gap: 8px; padding: 0 4px; }
  .fields-grid-2 { display: grid; grid-template-columns: 2fr 1fr; gap: 8px; padding: 0 4px; }
  .fields-grid-2b { display: grid; grid-template-columns: 2fr 1fr; gap: 8px; padding: 0 4px; margin-top: 6px; }
  .field label { display: block; font-size: 8px; text-transform: uppercase; color: #64748b; font-weight: 600; }
  .field span { font-size: 11px; color: #0f172a; font-weight: 500; }
  .text-block { font-size: 11px; line-height: 1.6; color: #334155; padding: 8px 10px; border-radius: 3px; border: 1px solid #cbd5e1; min-height: 28px; }
  table { width: 100%; border-collapse: collapse; font-size: 10px; margin-top: 4px; }
  table th { background: #0a2540; color: white; padding: 6px 10px; text-align: left; font-weight: 600; font-size: 9px; }
  table td { padding: 6px 10px; border-bottom: 1px solid #e2e8f0; }
  table tr:nth-child(even) { background: #f8fafc; }
  .financial { border: 1px solid #cbd5e1; border-radius: 4px; overflow: hidden; margin-top: 8px; }
  .fin-row { display: flex; justify-content: space-between; padding: 6px 12px; border-bottom: 1px solid #e2e8f0; font-size: 11px; }
  .fin-row:last-child { border-bottom: none; }
  .fin-total { background: #0a2540; padding: 8px 12px; display: flex; justify-content: space-between; align-items: center; font-size: 14px; font-weight: 700; color: #ffffff; }
  .tecnico-info { font-size: 10px; color: #64748b; margin-top: 8px; }
  .signatures { display: grid; grid-template-columns: 1fr 1fr; gap: 60px; margin-top: 40px; padding-top: 10px; }
  .sig-line { border-top: 1px solid #0a2540; padding-top: 6px; text-align: center; font-size: 9px; color: #64748b; }
  .footer { margin-top: 20px; text-align: center; font-size: 8px; color: #94a3b8; border-top: 1px solid #e2e8f0; padding-top: 8px; }
  @media print { body { padding: 10px; } @page { margin: 8mm; } }
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
    <div class="fields-grid" style="margin-top: 6px;">
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

  ${servicos.length > 0 ? `
  <div class="section">
    <div class="section-title">Servicos Executados</div>
    <table>
      <thead><tr><th>Servico</th><th style="text-align:center">Qtd</th><th style="text-align:right">Preco Unit.</th><th style="text-align:right">Total</th></tr></thead>
      <tbody>
        ${servicos.map(s => `<tr><td>${s.descricao || '-'}</td><td style="text-align:center">${s.quantidade}</td><td style="text-align:right">${formatCurrency(s.preco_unitario)}</td><td style="text-align:right">${formatCurrency(s.preco_total)}</td></tr>`).join('')}
      </tbody>
    </table>
  </div>` : ''}

  ${produtos.length > 0 ? `
  <div class="section">
    <div class="section-title">Produtos / Pecas</div>
    <table>
      <thead><tr><th>Produto</th><th style="text-align:center">Qtd</th><th style="text-align:right">Preco Unit.</th><th style="text-align:right">Total</th></tr></thead>
      <tbody>
        ${produtos.map(p => `<tr><td>${(p.produto as any)?.nome || '-'}</td><td style="text-align:center">${p.quantidade}</td><td style="text-align:right">${formatCurrency(p.preco_unitario)}</td><td style="text-align:right">${formatCurrency(p.preco_total)}</td></tr>`).join('')}
      </tbody>
    </table>
  </div>` : ''}

  <div class="section">
    <div class="section-title">Resumo Financeiro</div>
    <div class="financial">
      ${svcTotal > 0 ? `<div class="fin-row"><span>Valor dos Servicos</span><span>${formatCurrency(svcTotal)}</span></div>` : ''}
      ${prodTotal > 0 ? `<div class="fin-row"><span>Valor das Pecas</span><span>${formatCurrency(prodTotal)}</span></div>` : ''}
      ${svcTotal === 0 && prodTotal === 0 ? `<div class="fin-row"><span>Valor do Servico</span><span>${formatCurrency(os.valor_servico)}</span></div>` : ''}
      <div class="fin-total"><span>TOTAL</span><span>${formatCurrency(os.valor_total)}</span></div>
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
