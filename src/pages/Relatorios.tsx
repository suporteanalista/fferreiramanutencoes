import { useState } from 'react';
import { useToast } from '../components/ui/Toast';
import { fetchAll, fetchWithRelations } from '../lib/dataService';
import { getAllLocal } from '../lib/offlineDB';
import { loadLogoBase64 } from '../lib/pdfLogo';
import { FileText, Table, Download, Calendar } from 'lucide-react';
import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';
import * as XLSX from 'xlsx';
import { saveAs } from 'file-saver';

type ReportType = 'os_periodo' | 'os_tecnico' | 'clientes' | 'produtos';

export default function Relatorios() {
  const [reportType, setReportType] = useState<ReportType>('os_periodo');
  const [dateFrom, setDateFrom] = useState('');
  const [dateTo, setDateTo] = useState('');
  const [loading, setLoading] = useState(false);
  const { showToast } = useToast();

  const getConfiguracao = async () => {
    const configs = await getAllLocal('configuracoes');
    return configs[0] || null;
  };

  const getOSWithRelations = async () => {
    const data = await fetchWithRelations('ordens_servico', '*, cliente:clientes(nome), tecnico:tecnicos(nome)', { order: 'data_entrada', ascending: false });
    return data || [];
  };

  const generatePDF = async () => {
    setLoading(true);
    const config = await getConfiguracao();
    const logo = await loadLogoBase64();
    const doc = new jsPDF();
    const pageWidth = doc.internal.pageSize.getWidth();

    doc.setFillColor(15, 23, 42);
    doc.rect(0, 0, pageWidth, 38, 'F');
    if (logo) {
      doc.addImage(logo, 'PNG', 10, 3, 24, 24);
    }
    const textX = logo ? 38 : 14;
    doc.setTextColor(255, 255, 255);
    doc.setFontSize(16);
    doc.setFont('helvetica', 'bold');
    doc.text(config?.nome_empresa || 'Rede Tecnologia', textX, 16);
    doc.setFontSize(9);
    doc.setFont('helvetica', 'normal');
    doc.text(config?.endereco || '', textX, 23);
    doc.text(config?.telefone || '', textX, 28);

    doc.setTextColor(0, 0, 0);
    doc.setFontSize(14);
    doc.setFont('helvetica', 'bold');
    const titles: Record<ReportType, string> = {
      os_periodo: 'Relatorio de Ordens de Servico por Periodo',
      os_tecnico: 'Relatorio de OS por Tecnico',
      clientes: 'Relatorio de Clientes',
      produtos: 'Relatório de Produtos e Serviços',
    };
    doc.text(titles[reportType], 14, 48);

    if (dateFrom || dateTo) {
      doc.setFontSize(9);
      doc.setFont('helvetica', 'normal');
      doc.setTextColor(100, 100, 100);
      doc.text(`Periodo: ${dateFrom ? new Date(dateFrom).toLocaleDateString('pt-BR') : 'inicio'} a ${dateTo ? new Date(dateTo).toLocaleDateString('pt-BR') : 'hoje'}`, 14, 55);
    }

    let startY = dateFrom || dateTo ? 60 : 55;

    if (reportType === 'os_periodo') {
      let data = await getOSWithRelations();
      if (dateFrom) data = data.filter((os: any) => os.data_entrada >= dateFrom);
      if (dateTo) data = data.filter((os: any) => os.data_entrada <= dateTo + 'T23:59:59');

      autoTable(doc, {
        startY,
        head: [['OS', 'Cliente', 'Tecnico', 'Status', 'Data', 'Valor']],
        body: data.map((os: any) => [
          `#${os.numero_os}`,
          os.cliente?.nome || '-',
          os.tecnico?.nome || '-',
          os.status,
          new Date(os.data_entrada).toLocaleDateString('pt-BR'),
          `R$ ${Number(os.valor_total).toFixed(2)}`
        ]),
        styles: { fontSize: 8, cellPadding: 3 },
        headStyles: { fillColor: [16, 185, 129], textColor: [255, 255, 255], fontStyle: 'bold' },
        alternateRowStyles: { fillColor: [248, 250, 252] },
      });

      const total = data.reduce((s: number, o: any) => s + Number(o.valor_total), 0);
      const finalY = (doc as any).lastAutoTable?.finalY || startY + 20;
      doc.setFontSize(10);
      doc.setFont('helvetica', 'bold');
      doc.setTextColor(16, 185, 129);
      doc.text(`Total: R$ ${total.toFixed(2)}`, pageWidth - 14, finalY + 10, { align: 'right' });

    } else if (reportType === 'os_tecnico') {
      const data = await getOSWithRelations();
      const grouped: Record<string, { nome: string; total: number; count: number }> = {};
      data.forEach((os: any) => {
        const nome = os.tecnico?.nome || 'Sem tecnico';
        if (!grouped[nome]) grouped[nome] = { nome, total: 0, count: 0 };
        grouped[nome].total += Number(os.valor_total);
        grouped[nome].count++;
      });

      autoTable(doc, {
        startY,
        head: [['Tecnico', 'Qtd OS', 'Valor Total']],
        body: Object.values(grouped).map(g => [g.nome, String(g.count), `R$ ${g.total.toFixed(2)}`]),
        styles: { fontSize: 9, cellPadding: 4 },
        headStyles: { fillColor: [16, 185, 129], textColor: [255, 255, 255], fontStyle: 'bold' },
        alternateRowStyles: { fillColor: [248, 250, 252] },
      });

    } else if (reportType === 'clientes') {
      const data = await fetchAll('clientes', { order: 'nome' });
      autoTable(doc, {
        startY,
        head: [['Nome', 'CPF/CNPJ', 'Celular', 'Email', 'Cidade']],
        body: data.map((c: any) => [c.nome, c.cpf_cnpj || '-', c.celular || '-', c.email || '-', c.cidade || '-']),
        styles: { fontSize: 8, cellPadding: 3 },
        headStyles: { fillColor: [16, 185, 129], textColor: [255, 255, 255], fontStyle: 'bold' },
        alternateRowStyles: { fillColor: [248, 250, 252] },
      });

    } else if (reportType === 'produtos') {
      const data = await fetchAll('produtos', { order: 'nome' });
      autoTable(doc, {
        startY,
        head: [['Codigo', 'Produto', 'Categoria', 'Estoque', 'Preco Venda']],
        body: data.map((p: any) => [p.codigo || '-', p.nome, p.categoria || '-', String(p.quantidade_estoque), `R$ ${Number(p.preco_venda).toFixed(2)}`]),
        styles: { fontSize: 8, cellPadding: 3 },
        headStyles: { fillColor: [16, 185, 129], textColor: [255, 255, 255], fontStyle: 'bold' },
        alternateRowStyles: { fillColor: [248, 250, 252] },
      });
    }

    const pageCount = doc.getNumberOfPages();
    for (let i = 1; i <= pageCount; i++) {
      doc.setPage(i);
      doc.setFontSize(8);
      doc.setTextColor(150, 150, 150);
      doc.text(`Gerado em ${new Date().toLocaleString('pt-BR')} - Pagina ${i} de ${pageCount}`, pageWidth / 2, doc.internal.pageSize.getHeight() - 10, { align: 'center' });
    }

    doc.save(`relatorio_${reportType}_${new Date().toISOString().split('T')[0]}.pdf`);
    showToast('PDF gerado com sucesso');
    setLoading(false);
  };

  const generateExcel = async () => {
    setLoading(true);
    let data: any[] = [];
    let filename = '';

    if (reportType === 'os_periodo') {
      let osData = await getOSWithRelations();
      if (dateFrom) osData = osData.filter((os: any) => os.data_entrada >= dateFrom);
      if (dateTo) osData = osData.filter((os: any) => os.data_entrada <= dateTo + 'T23:59:59');
      data = osData.map((os: any) => ({
        'OS': os.numero_os,
        'Cliente': os.cliente?.nome || '',
        'Tecnico': os.tecnico?.nome || '',
        'Status': os.status,
        'Prioridade': os.prioridade,
        'Data Entrada': new Date(os.data_entrada).toLocaleDateString('pt-BR'),
        'Valor Servico': Number(os.valor_servico),
        'Valor Total': Number(os.valor_total),
        'Defeito': os.defeito_relatado,
      }));
      filename = 'ordens_servico';
    } else if (reportType === 'clientes') {
      const cData = await fetchAll('clientes', { order: 'nome' });
      data = cData.map((c: any) => ({
        'Nome': c.nome,
        'CPF/CNPJ': c.cpf_cnpj,
        'Telefone': c.telefone,
        'Celular': c.celular,
        'Email': c.email,
        'Cidade': c.cidade,
        'Estado': c.estado,
      }));
      filename = 'clientes';
    } else if (reportType === 'produtos') {
      const pData = await fetchAll('produtos', { order: 'nome' });
      data = pData.map((p: any) => ({
        'Codigo': p.codigo,
        'Nome': p.nome,
        'Categoria': p.categoria,
        'Estoque': p.quantidade_estoque,
        'Preco Custo': Number(p.preco_custo),
        'Preco Venda': Number(p.preco_venda),
      }));
      filename = 'produtos';
    } else {
      const osData = await getOSWithRelations();
      const grouped: Record<string, any> = {};
      osData.forEach((os: any) => {
        const nome = os.tecnico?.nome || 'Sem tecnico';
        if (!grouped[nome]) grouped[nome] = { 'Tecnico': nome, 'Qtd OS': 0, 'Valor Total': 0 };
        grouped[nome]['Qtd OS']++;
        grouped[nome]['Valor Total'] += Number(os.valor_total);
      });
      data = Object.values(grouped);
      filename = 'os_por_tecnico';
    }

    const ws = XLSX.utils.json_to_sheet(data);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'Relatorio');
    const excelBuffer = XLSX.write(wb, { bookType: 'xlsx', type: 'array' });
    const blob = new Blob([excelBuffer], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' });
    saveAs(blob, `${filename}_${new Date().toISOString().split('T')[0]}.xlsx`);
    showToast('Planilha gerada com sucesso');
    setLoading(false);
  };

  const reports = [
    { id: 'os_periodo' as ReportType, title: 'OS por Periodo', desc: 'Ordens de servico filtradas por data' },
    { id: 'os_tecnico' as ReportType, title: 'OS por Tecnico', desc: 'Resumo de OS agrupadas por tecnico' },
    { id: 'clientes' as ReportType, title: 'Clientes', desc: 'Lista completa de clientes cadastrados' },
    { id: 'produtos' as ReportType, title: 'Produtos e Serviços', desc: 'Inventário de produtos, peças e serviços' },
  ];

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-white">Relatorios</h1>
        <p className="text-slate-400 text-sm mt-1">Gere relatorios em PDF ou planilha Excel</p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        {reports.map((r) => (
          <button
            key={r.id}
            onClick={() => setReportType(r.id)}
            className={`p-5 rounded-xl border text-left transition-all ${reportType === r.id ? 'bg-emerald-500/10 border-emerald-500/30' : 'bg-slate-800/50 border-slate-700/50 hover:border-slate-600'}`}
          >
            <h3 className={`font-semibold ${reportType === r.id ? 'text-emerald-400' : 'text-white'}`}>{r.title}</h3>
            <p className="text-xs text-slate-400 mt-1">{r.desc}</p>
          </button>
        ))}
      </div>

      {(reportType === 'os_periodo') && (
        <div className="bg-slate-800/50 border border-slate-700/50 rounded-xl p-5">
          <div className="flex items-center gap-2 mb-4">
            <Calendar className="w-4 h-4 text-slate-400" />
            <span className="text-sm font-medium text-slate-300">Filtrar por periodo</span>
          </div>
          <div className="flex flex-wrap gap-4">
            <div>
              <label className="block text-xs text-slate-400 mb-1">Data Inicial</label>
              <input type="date" value={dateFrom} onChange={(e) => setDateFrom(e.target.value)} className="px-3 py-2 bg-slate-700/50 border border-slate-600 rounded-lg text-white text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500/50" />
            </div>
            <div>
              <label className="block text-xs text-slate-400 mb-1">Data Final</label>
              <input type="date" value={dateTo} onChange={(e) => setDateTo(e.target.value)} className="px-3 py-2 bg-slate-700/50 border border-slate-600 rounded-lg text-white text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500/50" />
            </div>
          </div>
        </div>
      )}

      <div className="flex flex-wrap gap-4">
        <button
          onClick={generatePDF}
          disabled={loading}
          className="flex items-center gap-2 px-6 py-3 bg-red-500/10 border border-red-500/30 text-red-400 rounded-xl hover:bg-red-500/20 transition-all font-medium disabled:opacity-50"
        >
          <FileText className="w-5 h-5" />
          <span>Gerar PDF</span>
          <Download className="w-4 h-4 ml-1" />
        </button>
        <button
          onClick={generateExcel}
          disabled={loading}
          className="flex items-center gap-2 px-6 py-3 bg-emerald-500/10 border border-emerald-500/30 text-emerald-400 rounded-xl hover:bg-emerald-500/20 transition-all font-medium disabled:opacity-50"
        >
          <Table className="w-5 h-5" />
          <span>Gerar Planilha</span>
          <Download className="w-4 h-4 ml-1" />
        </button>
      </div>
    </div>
  );
}
