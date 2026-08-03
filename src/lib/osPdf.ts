import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';
import { loadLogoBase64 } from './pdfLogo';
import { OrdemServico, Configuracao } from '../types';

const NAVY = [10, 37, 64] as const;
const BLUE_ACCENT = [30, 136, 229] as const;
const GRAY_TEXT = [100, 116, 139] as const;
const DARK_TEXT = [15, 23, 42] as const;
const LIGHT_BG = [248, 250, 252] as const;
const BORDER_COLOR = [203, 213, 225] as const;

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

interface ClassifiedItems {
  produtos: { nome: string; quantidade: number; preco_unitario: number; preco_total: number }[];
  servicos: { nome: string; quantidade: number; preco_unitario: number; preco_total: number }[];
  totalProdutos: number;
  totalServicos: number;
  totalGeral: number;
}

function classifyItems(os: OrdemServico): ClassifiedItems {
  const produtos: ClassifiedItems['produtos'] = [];
  const servicos: ClassifiedItems['servicos'] = [];

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

export async function generateOSPdf(os: OrdemServico, config: Partial<Configuracao> | null) {
  const doc = new jsPDF();
  const pageWidth = doc.internal.pageSize.getWidth();
  const pageHeight = doc.internal.pageSize.getHeight();
  const margin = 14;
  const contentWidth = pageWidth - margin * 2;
  const logo = await loadLogoBase64();

  let y = 12;

  // ─── HEADER ───────────────────────────────────────────────
  if (logo) {
    doc.addImage(logo, 'PNG', margin, y, 24, 24);
  }

  const textX = logo ? margin + 28 : margin;

  doc.setFontSize(20);
  doc.setFont('helvetica', 'bold');
  doc.setTextColor(...NAVY);
  doc.text(config?.nome_empresa || 'FF Manutencoes', textX, y + 8);

  doc.setFontSize(10);
  doc.setFont('helvetica', 'normal');
  doc.setTextColor(...GRAY_TEXT);

  let infoY = y + 14;
  if (config?.endereco) {
    const addr = [config.endereco, config.bairro, config.cidade, config.estado].filter(Boolean).join(', ');
    doc.text(addr, textX, infoY);
    infoY += 5;
  }
  const contacts = [
    config?.telefone ? `Tel: ${config.telefone}` : '',
    config?.celular ? `Cel: ${config.celular}` : '',
    config?.email || '',
  ].filter(Boolean).join(' | ');
  if (contacts) {
    doc.text(contacts, textX, infoY);
    infoY += 5;
  }
  if (config?.cnpj) {
    doc.text(`CNPJ: ${config.cnpj}`, textX, infoY);
  }

  // OS number badge (right side)
  const badgeW = 52;
  const badgeH = 24;
  const badgeX = pageWidth - margin - badgeW;
  doc.setFillColor(...NAVY);
  doc.roundedRect(badgeX, y, badgeW, badgeH, 2, 2, 'F');
  doc.setTextColor(255, 255, 255);
  doc.setFontSize(10);
  doc.setFont('helvetica', 'bold');
  doc.text('ORDEM DE SERVICO', badgeX + badgeW / 2, y + 9, { align: 'center' });
  doc.setFontSize(18);
  doc.text(`#${os.numero_os}`, badgeX + badgeW / 2, y + 19, { align: 'center' });

  y += 32;

  // Header separator
  doc.setDrawColor(...BLUE_ACCENT);
  doc.setLineWidth(0.8);
  doc.line(margin, y, pageWidth - margin, y);
  y += 9;

  // ─── META ROW (Status, Prioridade, Datas) ─────────────────
  const colW = contentWidth / 4;
  const metaLabels = ['STATUS', 'PRIORIDADE', 'DATA ENTRADA', 'PREVISAO'];
  const metaValues = [
    statusLabels[os.status] || os.status,
    prioridadeLabels[os.prioridade] || os.prioridade,
    formatDate(os.data_entrada),
    formatDate(os.data_previsao),
  ];

  doc.setFontSize(10);
  doc.setFont('helvetica', 'bold');
  doc.setTextColor(...GRAY_TEXT);
  metaLabels.forEach((label, i) => {
    doc.text(label, margin + i * colW, y);
  });
  y += 6;
  doc.setFontSize(13);
  doc.setFont('helvetica', 'bold');
  doc.setTextColor(...DARK_TEXT);
  metaValues.forEach((val, i) => {
    doc.text(val, margin + i * colW, y);
  });
  y += 11;

  // ─── DADOS DO CLIENTE ──────────────────────────────────────
  y = drawSectionHeader(doc, 'DADOS DO CLIENTE', margin, y, contentWidth);
  const cliente = os.cliente as any;

  drawFieldRow(doc, margin, y, contentWidth, [
    { label: 'Nome', value: cliente?.nome || '-', flex: 2 },
    { label: 'Telefone/Celular', value: cliente?.celular || cliente?.telefone || '-', flex: 1 },
  ]);
  y += 14;

  if (cliente?.endereco || cliente?.cidade) {
    drawFieldRow(doc, margin, y, contentWidth, [
      { label: 'Endereco', value: cliente?.endereco || '-', flex: 2 },
      { label: 'Cidade/UF', value: [cliente?.cidade, cliente?.estado].filter(Boolean).join('/') || '-', flex: 1 },
    ]);
    y += 14;
  }

  y += 3;

  // ─── DADOS DO EQUIPAMENTO ──────────────────────────────────
  y = drawSectionHeader(doc, 'DADOS DO EQUIPAMENTO', margin, y, contentWidth);
  const equip = os.equipamento as any;

  drawFieldRow(doc, margin, y, contentWidth, [
    { label: 'Tipo', value: equip?.tipo || '-', flex: 1 },
    { label: 'Marca', value: equip?.marca || '-', flex: 1 },
    { label: 'Modelo', value: equip?.modelo || '-', flex: 1 },
  ]);
  y += 14;

  if (equip?.numero_serie) {
    drawFieldRow(doc, margin, y, contentWidth, [
      { label: 'N. Serie', value: equip.numero_serie, flex: 1 },
      { label: 'Cor', value: equip?.cor || '-', flex: 1 },
      { label: 'Condicao', value: equip?.condicao_entrada || '-', flex: 1 },
    ]);
    y += 14;
  }

  y += 3;

  // ─── DEFEITO RELATADO ──────────────────────────────────────
  y = drawSectionHeader(doc, 'DEFEITO RELATADO PELO CLIENTE', margin, y, contentWidth);
  y = drawTextBlock(doc, os.defeito_relatado || 'Nenhum defeito relatado', margin, y, contentWidth);
  y += 5;

  // ─── LAUDO TECNICO ─────────────────────────────────────────
  if (os.laudo_tecnico) {
    if (y > 230) { doc.addPage(); y = 20; }
    y = drawSectionHeader(doc, 'LAUDO TECNICO', margin, y, contentWidth);
    y = drawTextBlock(doc, os.laudo_tecnico, margin, y, contentWidth);
    y += 5;
  }

  // ─── NOTA TECNICA ────────────────────────────────────────────
  if (os.servico_executado) {
    if (y > 230) { doc.addPage(); y = 20; }
    y = drawSectionHeader(doc, 'NOTA TECNICA', margin, y, contentWidth);
    y = drawTextBlock(doc, os.servico_executado, margin, y, contentWidth);
    y += 5;
  }

  // ─── CLASSIFY ITEMS ────────────────────────────────────────
  const items = classifyItems(os);

  // ─── PRODUTOS / PECAS ─────────────────────────────────────
  if (y > 220) { doc.addPage(); y = 20; }
  y = drawSectionHeader(doc, 'PRODUTOS / PECAS', margin, y, contentWidth);

  if (items.produtos.length > 0) {
    autoTable(doc, {
      startY: y,
      head: [['Produto / Peca', 'Quantidade', 'Preco Unit.', 'Total']],
      body: items.produtos.map(p => [
        p.nome,
        String(p.quantidade),
        formatCurrency(p.preco_unitario),
        formatCurrency(p.preco_total),
      ]),
      styles: { fontSize: 12, cellPadding: 4, textColor: [...DARK_TEXT], lineColor: [...BORDER_COLOR], lineWidth: 0.2 },
      headStyles: { fillColor: [...NAVY], textColor: [255, 255, 255], fontStyle: 'bold', fontSize: 12 },
      alternateRowStyles: { fillColor: [...LIGHT_BG] },
      columnStyles: {
        0: { cellWidth: 'auto' },
        1: { cellWidth: 28, halign: 'center' },
        2: { cellWidth: 36, halign: 'right' },
        3: { cellWidth: 36, halign: 'right' },
      },
      margin: { left: margin, right: margin },
      rowPageBreak: 'avoid',
      didDrawPage: () => {},
    });
    y = (doc as any).lastAutoTable?.finalY || y + 20;
  } else {
    autoTable(doc, {
      startY: y,
      body: [['Nenhum produto ou peca informado']],
      styles: { fontSize: 12, cellPadding: 4, textColor: [...GRAY_TEXT], lineColor: [...BORDER_COLOR], lineWidth: 0.2, halign: 'center', fontStyle: 'italic' },
      columnStyles: { 0: { cellWidth: contentWidth } },
      margin: { left: margin, right: margin },
    });
    y = (doc as any).lastAutoTable?.finalY || y + 10;
  }
  y += 8;

  // ─── SERVICOS ─────────────────────────────────────────────
  if (y > 220) { doc.addPage(); y = 20; }
  y = drawSectionHeader(doc, 'SERVICOS', margin, y, contentWidth);

  if (items.servicos.length > 0) {
    autoTable(doc, {
      startY: y,
      head: [['Servico', 'Quantidade', 'Preco Unit.', 'Total']],
      body: items.servicos.map(s => [
        s.nome,
        String(s.quantidade),
        formatCurrency(s.preco_unitario),
        formatCurrency(s.preco_total),
      ]),
      styles: { fontSize: 12, cellPadding: 4, textColor: [...DARK_TEXT], lineColor: [...BORDER_COLOR], lineWidth: 0.2 },
      headStyles: { fillColor: [...NAVY], textColor: [255, 255, 255], fontStyle: 'bold', fontSize: 12 },
      alternateRowStyles: { fillColor: [...LIGHT_BG] },
      columnStyles: {
        0: { cellWidth: 'auto' },
        1: { cellWidth: 28, halign: 'center' },
        2: { cellWidth: 36, halign: 'right' },
        3: { cellWidth: 36, halign: 'right' },
      },
      margin: { left: margin, right: margin },
      rowPageBreak: 'avoid',
      didDrawPage: () => {},
    });
    y = (doc as any).lastAutoTable?.finalY || y + 20;
  } else {
    autoTable(doc, {
      startY: y,
      body: [['Nenhum servico informado']],
      styles: { fontSize: 12, cellPadding: 4, textColor: [...GRAY_TEXT], lineColor: [...BORDER_COLOR], lineWidth: 0.2, halign: 'center', fontStyle: 'italic' },
      columnStyles: { 0: { cellWidth: contentWidth } },
      margin: { left: margin, right: margin },
    });
    y = (doc as any).lastAutoTable?.finalY || y + 10;
  }
  y += 8;

  // ─── RESUMO FINANCEIRO ─────────────────────────────────────
  if (y > 235) { doc.addPage(); y = 20; }
  y = drawSectionHeader(doc, 'RESUMO FINANCEIRO', margin, y, contentWidth);

  const finBoxY = y;
  const finH = 40;
  doc.setDrawColor(...BORDER_COLOR);
  doc.setLineWidth(0.3);
  doc.rect(margin, finBoxY, contentWidth, finH);

  doc.setFontSize(14);
  doc.setFont('helvetica', 'normal');
  doc.setTextColor(...DARK_TEXT);

  let finRowY = finBoxY + 9;
  doc.text('Total de Produtos / Pecas:', margin + 5, finRowY);
  doc.text(formatCurrency(items.totalProdutos), pageWidth - margin - 5, finRowY, { align: 'right' });
  finRowY += 9;

  doc.text('Total de Servicos:', margin + 5, finRowY);
  doc.text(formatCurrency(items.totalServicos), pageWidth - margin - 5, finRowY, { align: 'right' });
  finRowY += 9;

  // Total row with background
  doc.setFillColor(...NAVY);
  doc.rect(margin, finBoxY + finH - 13, contentWidth, 13, 'F');
  doc.setFontSize(17);
  doc.setFont('helvetica', 'bold');
  doc.setTextColor(255, 255, 255);
  doc.text('TOTAL GERAL:', margin + 5, finBoxY + finH - 4);
  doc.text(formatCurrency(items.totalGeral), pageWidth - margin - 5, finBoxY + finH - 4, { align: 'right' });

  y = finBoxY + finH + 6;

  // ─── TECNICO RESPONSAVEL ───────────────────────────────────
  const tecnico = os.tecnico as any;
  if (tecnico?.nome) {
    doc.setFontSize(12);
    doc.setFont('helvetica', 'normal');
    doc.setTextColor(...GRAY_TEXT);
    doc.text(`Tecnico responsavel: ${tecnico.nome}`, margin, y);
    y += 9;
  }

  // ─── ASSINATURAS ───────────────────────────────────────────
  if (y > pageHeight - 50) { doc.addPage(); y = 20; }
  y += 18;

  const sigLineLen = 75;
  const sig1X = margin + 10;
  const sig2X = pageWidth - margin - sigLineLen - 10;

  doc.setDrawColor(...NAVY);
  doc.setLineWidth(0.4);
  doc.line(sig1X, y, sig1X + sigLineLen, y);
  doc.line(sig2X, y, sig2X + sigLineLen, y);
  y += 6;

  doc.setFontSize(11);
  doc.setFont('helvetica', 'normal');
  doc.setTextColor(...GRAY_TEXT);
  doc.text('Assinatura do Cliente', sig1X + sigLineLen / 2, y, { align: 'center' });
  doc.text('Assinatura do Tecnico', sig2X + sigLineLen / 2, y, { align: 'center' });

  // ─── FOOTER ────────────────────────────────────────────────
  const pageCount = doc.getNumberOfPages();
  for (let i = 1; i <= pageCount; i++) {
    doc.setPage(i);
    const footerY = pageHeight - 8;
    doc.setDrawColor(...BORDER_COLOR);
    doc.setLineWidth(0.3);
    doc.line(margin, footerY - 4, pageWidth - margin, footerY - 4);
    doc.setFontSize(9);
    doc.setTextColor(...GRAY_TEXT);
    doc.text(
      `${config?.nome_empresa || 'FF Manutencoes'} - Documento gerado em ${new Date().toLocaleString('pt-BR')} - Pagina ${i} de ${pageCount}`,
      pageWidth / 2,
      footerY,
      { align: 'center' }
    );
  }

  doc.save(`OS_${os.numero_os}_${new Date().toISOString().split('T')[0]}.pdf`);
}

function drawSectionHeader(doc: jsPDF, title: string, x: number, y: number, width: number): number {
  doc.setFillColor(...LIGHT_BG);
  doc.rect(x, y - 5, width, 10, 'F');
  doc.setDrawColor(...BLUE_ACCENT);
  doc.setLineWidth(0.8);
  doc.line(x, y - 5, x, y + 5);
  doc.setFontSize(16);
  doc.setFont('helvetica', 'bold');
  doc.setTextColor(...NAVY);
  doc.text(title, x + 5, y + 2);
  return y + 10;
}

function drawTextBlock(doc: jsPDF, text: string, x: number, y: number, width: number): number {
  doc.setDrawColor(...BORDER_COLOR);
  doc.setLineWidth(0.3);

  doc.setFont('helvetica', 'normal');
  doc.setFontSize(12);
  doc.setTextColor(...DARK_TEXT);
  const lines = doc.splitTextToSize(text, width - 10);
  const blockH = Math.max(lines.length * 6 + 8, 18);

  doc.rect(x, y, width, blockH);
  doc.text(lines, x + 5, y + 7);
  return y + blockH + 2;
}

interface FieldDef {
  label: string;
  value: string;
  flex: number;
}

function drawFieldRow(doc: jsPDF, x: number, y: number, totalWidth: number, fields: FieldDef[]) {
  const totalFlex = fields.reduce((s, f) => s + f.flex, 0);
  let curX = x;

  fields.forEach(field => {
    const w = (field.flex / totalFlex) * totalWidth;
    doc.setFontSize(10);
    doc.setFont('helvetica', 'normal');
    doc.setTextColor(...GRAY_TEXT);
    doc.text(field.label + ':', curX, y);

    doc.setFontSize(13);
    doc.setFont('helvetica', 'bold');
    doc.setTextColor(...DARK_TEXT);
    doc.text(field.value, curX, y + 6);
    curX += w;
  });
}
