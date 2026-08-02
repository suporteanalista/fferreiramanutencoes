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

  doc.setFontSize(14);
  doc.setFont('helvetica', 'bold');
  doc.setTextColor(...NAVY);
  doc.text(config?.nome_empresa || 'FF Manutencoes', textX, y + 8);

  doc.setFontSize(8);
  doc.setFont('helvetica', 'normal');
  doc.setTextColor(...GRAY_TEXT);

  let infoY = y + 13;
  if (config?.endereco) {
    const addr = [config.endereco, config.bairro, config.cidade, config.estado].filter(Boolean).join(', ');
    doc.text(addr, textX, infoY);
    infoY += 4;
  }
  const contacts = [
    config?.telefone ? `Tel: ${config.telefone}` : '',
    config?.celular ? `Cel: ${config.celular}` : '',
    config?.email || '',
  ].filter(Boolean).join(' | ');
  if (contacts) {
    doc.text(contacts, textX, infoY);
    infoY += 4;
  }
  if (config?.cnpj) {
    doc.text(`CNPJ: ${config.cnpj}`, textX, infoY);
  }

  // OS number badge (right side)
  const badgeW = 48;
  const badgeH = 22;
  const badgeX = pageWidth - margin - badgeW;
  doc.setFillColor(...NAVY);
  doc.roundedRect(badgeX, y, badgeW, badgeH, 2, 2, 'F');
  doc.setTextColor(255, 255, 255);
  doc.setFontSize(8);
  doc.setFont('helvetica', 'bold');
  doc.text('ORDEM DE SERVICO', badgeX + badgeW / 2, y + 8, { align: 'center' });
  doc.setFontSize(14);
  doc.text(`#${os.numero_os}`, badgeX + badgeW / 2, y + 17, { align: 'center' });

  y += 30;

  // Header separator
  doc.setDrawColor(...BLUE_ACCENT);
  doc.setLineWidth(0.8);
  doc.line(margin, y, pageWidth - margin, y);
  y += 8;

  // ─── META ROW (Status, Prioridade, Datas) ─────────────────
  const colW = contentWidth / 4;
  const metaLabels = ['STATUS', 'PRIORIDADE', 'DATA ENTRADA', 'PREVISAO'];
  const metaValues = [
    statusLabels[os.status] || os.status,
    prioridadeLabels[os.prioridade] || os.prioridade,
    formatDate(os.data_entrada),
    formatDate(os.data_previsao),
  ];

  doc.setFontSize(7);
  doc.setFont('helvetica', 'bold');
  doc.setTextColor(...GRAY_TEXT);
  metaLabels.forEach((label, i) => {
    doc.text(label, margin + i * colW, y);
  });
  y += 5;
  doc.setFontSize(10);
  doc.setFont('helvetica', 'bold');
  doc.setTextColor(...DARK_TEXT);
  metaValues.forEach((val, i) => {
    doc.text(val, margin + i * colW, y);
  });
  y += 10;

  // ─── DADOS DO CLIENTE ──────────────────────────────────────
  y = drawSectionHeader(doc, 'DADOS DO CLIENTE', margin, y, contentWidth);
  const cliente = os.cliente as any;

  drawFieldRow(doc, margin, y, contentWidth, [
    { label: 'Nome', value: cliente?.nome || '-', flex: 2 },
    { label: 'Telefone/Celular', value: cliente?.celular || cliente?.telefone || '-', flex: 1 },
  ]);
  y += 12;

  if (cliente?.endereco || cliente?.cidade) {
    drawFieldRow(doc, margin, y, contentWidth, [
      { label: 'Endereco', value: cliente?.endereco || '-', flex: 2 },
      { label: 'Cidade/UF', value: [cliente?.cidade, cliente?.estado].filter(Boolean).join('/') || '-', flex: 1 },
    ]);
    y += 12;
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
  y += 12;

  if (equip?.numero_serie) {
    drawFieldRow(doc, margin, y, contentWidth, [
      { label: 'N. Serie', value: equip.numero_serie, flex: 1 },
      { label: 'Cor', value: equip?.cor || '-', flex: 1 },
      { label: 'Condicao', value: equip?.condicao_entrada || '-', flex: 1 },
    ]);
    y += 12;
  }

  y += 3;

  // ─── DEFEITO RELATADO ──────────────────────────────────────
  y = drawSectionHeader(doc, 'DEFEITO RELATADO PELO CLIENTE', margin, y, contentWidth);
  y = drawTextBlock(doc, os.defeito_relatado || 'Nenhum defeito relatado', margin, y, contentWidth);
  y += 5;

  // ─── LAUDO TECNICO ─────────────────────────────────────────
  if (os.laudo_tecnico) {
    if (y > 240) { doc.addPage(); y = 20; }
    y = drawSectionHeader(doc, 'LAUDO TECNICO', margin, y, contentWidth);
    y = drawTextBlock(doc, os.laudo_tecnico, margin, y, contentWidth);
    y += 5;
  }

  // ─── SERVICO EXECUTADO (note) ────────────────────────────────
  if (os.servico_executado) {
    if (y > 240) { doc.addPage(); y = 20; }
    y = drawSectionHeader(doc, 'NOTA TECNICA', margin, y, contentWidth);
    y = drawTextBlock(doc, os.servico_executado, margin, y, contentWidth);
    y += 5;
  }

  // ─── SERVICOS EXECUTADOS (tabela) ─────────────────────────────
  if (os.os_servicos && os.os_servicos.length > 0) {
    if (y > 220) { doc.addPage(); y = 20; }
    y = drawSectionHeader(doc, 'SERVICOS EXECUTADOS', margin, y, contentWidth);

    autoTable(doc, {
      startY: y,
      head: [['Servico', 'Qtd', 'Preco Unit.', 'Total']],
      body: os.os_servicos.map(s => [
        s.descricao || '-',
        String(s.quantidade),
        formatCurrency(s.preco_unitario),
        formatCurrency(s.preco_total),
      ]),
      styles: { fontSize: 8, cellPadding: 3, textColor: [...DARK_TEXT] },
      headStyles: { fillColor: [...NAVY], textColor: [255, 255, 255], fontStyle: 'bold', fontSize: 8 },
      alternateRowStyles: { fillColor: [...LIGHT_BG] },
      columnStyles: {
        0: { cellWidth: 'auto' },
        1: { cellWidth: 20, halign: 'center' },
        2: { cellWidth: 30, halign: 'right' },
        3: { cellWidth: 30, halign: 'right' },
      },
      margin: { left: margin, right: margin },
    });

    y = (doc as any).lastAutoTable?.finalY || y + 20;
    y += 8;
  }

  // ─── PRODUTOS / PECAS ─────────────────────────────────────
  if (os.os_produtos && os.os_produtos.length > 0) {
    if (y > 220) { doc.addPage(); y = 20; }
    y = drawSectionHeader(doc, 'PRODUTOS / PECAS', margin, y, contentWidth);

    autoTable(doc, {
      startY: y,
      head: [['Produto', 'Qtd', 'Preco Unit.', 'Total']],
      body: os.os_produtos.map(p => [
        (p.produto as any)?.nome || '-',
        String(p.quantidade),
        formatCurrency(p.preco_unitario),
        formatCurrency(p.preco_total),
      ]),
      styles: { fontSize: 8, cellPadding: 3, textColor: [...DARK_TEXT] },
      headStyles: { fillColor: [...NAVY], textColor: [255, 255, 255], fontStyle: 'bold', fontSize: 8 },
      alternateRowStyles: { fillColor: [...LIGHT_BG] },
      columnStyles: {
        0: { cellWidth: 'auto' },
        1: { cellWidth: 20, halign: 'center' },
        2: { cellWidth: 30, halign: 'right' },
        3: { cellWidth: 30, halign: 'right' },
      },
      margin: { left: margin, right: margin },
    });

    y = (doc as any).lastAutoTable?.finalY || y + 20;
    y += 8;
  }

  // ─── RESUMO FINANCEIRO ─────────────────────────────────────
  if (y > 230) { doc.addPage(); y = 20; }
  y = drawSectionHeader(doc, 'RESUMO FINANCEIRO', margin, y, contentWidth);

  const prodTotal = (os.os_produtos || []).reduce((s, p) => s + (p.preco_total || 0), 0);
  const svcTotal = (os.os_servicos || []).reduce((s, sv) => s + (sv.preco_total || 0), 0);

  const finBoxY = y;
  const finH = svcTotal > 0 && prodTotal > 0 ? 35 : 28;
  doc.setDrawColor(...BORDER_COLOR);
  doc.setLineWidth(0.3);
  doc.rect(margin, finBoxY, contentWidth, finH);

  doc.setFontSize(9);
  doc.setFont('helvetica', 'normal');
  doc.setTextColor(...DARK_TEXT);

  let finRowY = finBoxY + 7;
  if (svcTotal > 0) {
    doc.text('Valor dos Servicos:', margin + 4, finRowY);
    doc.text(formatCurrency(svcTotal), pageWidth - margin - 4, finRowY, { align: 'right' });
    finRowY += 7;
  }
  if (prodTotal > 0) {
    doc.text('Valor das Pecas:', margin + 4, finRowY);
    doc.text(formatCurrency(prodTotal), pageWidth - margin - 4, finRowY, { align: 'right' });
    finRowY += 7;
  }
  if (svcTotal === 0 && prodTotal === 0) {
    doc.text('Valor do Servico:', margin + 4, finRowY);
    doc.text(formatCurrency(os.valor_servico), pageWidth - margin - 4, finRowY, { align: 'right' });
    finRowY += 7;
  }

  // Total row with background
  doc.setFillColor(...NAVY);
  doc.rect(margin, finBoxY + finH - 10, contentWidth, 10, 'F');
  doc.setFontSize(11);
  doc.setFont('helvetica', 'bold');
  doc.setTextColor(255, 255, 255);
  doc.text('TOTAL:', margin + 4, finBoxY + finH - 3);
  doc.text(formatCurrency(os.valor_total), pageWidth - margin - 4, finBoxY + finH - 3, { align: 'right' });

  y = finBoxY + finH + 6;

  // ─── TECNICO RESPONSAVEL ───────────────────────────────────
  const tecnico = os.tecnico as any;
  if (tecnico?.nome) {
    doc.setFontSize(9);
    doc.setFont('helvetica', 'normal');
    doc.setTextColor(...GRAY_TEXT);
    doc.text(`Tecnico responsavel: ${tecnico.nome}`, margin, y);
    y += 8;
  }

  // ─── ASSINATURAS ───────────────────────────────────────────
  if (y > pageHeight - 45) { doc.addPage(); y = 20; }
  y += 15;

  const sigLineLen = 70;
  const sig1X = margin + 10;
  const sig2X = pageWidth - margin - sigLineLen - 10;

  doc.setDrawColor(...NAVY);
  doc.setLineWidth(0.4);
  doc.line(sig1X, y, sig1X + sigLineLen, y);
  doc.line(sig2X, y, sig2X + sigLineLen, y);
  y += 5;

  doc.setFontSize(8);
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
    doc.setFontSize(7);
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
  doc.rect(x, y - 4, width, 8, 'F');
  doc.setDrawColor(...BLUE_ACCENT);
  doc.setLineWidth(0.8);
  doc.line(x, y - 4, x, y + 4);
  doc.setFontSize(8);
  doc.setFont('helvetica', 'bold');
  doc.setTextColor(...NAVY);
  doc.text(title, x + 4, y + 1);
  return y + 8;
}

function drawTextBlock(doc: jsPDF, text: string, x: number, y: number, width: number): number {
  doc.setDrawColor(...BORDER_COLOR);
  doc.setLineWidth(0.3);

  doc.setFont('helvetica', 'normal');
  doc.setFontSize(9);
  doc.setTextColor(...DARK_TEXT);
  const lines = doc.splitTextToSize(text, width - 8);
  const blockH = Math.max(lines.length * 4.5 + 6, 14);

  doc.rect(x, y, width, blockH);
  doc.text(lines, x + 4, y + 5);
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
    doc.setFontSize(7);
    doc.setFont('helvetica', 'normal');
    doc.setTextColor(...GRAY_TEXT);
    doc.text(field.label + ':', curX, y);

    doc.setFontSize(9);
    doc.setFont('helvetica', 'bold');
    doc.setTextColor(...DARK_TEXT);
    doc.text(field.value, curX, y + 5);
    curX += w;
  });
}
