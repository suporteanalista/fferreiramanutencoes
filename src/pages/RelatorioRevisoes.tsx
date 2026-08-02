import { useState, useEffect } from 'react';
import { useToast } from '../components/ui/Toast';
import { fetchWithRelations } from '../lib/dataService';
import { Calendar, FileText, Table, Download, Search } from 'lucide-react';
import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';
import * as XLSX from 'xlsx';
import { saveAs } from 'file-saver';

type RevisaoRow = {
  numero_os: number;
  cliente_nome: string;
  produto_nome: string;
  data_revisao_futura: string | null;
};

export default function RelatorioRevisoes() {
  const [rows, setRows] = useState<RevisaoRow[]>([]);
  const [filtered, setFiltered] = useState<RevisaoRow[]>([]);
  const [dateFrom, setDateFrom] = useState('');
  const [dateTo, setDateTo] = useState('');
  const [loading, setLoading] = useState(false);
  const [generating, setGenerating] = useState(false);
  const { showToast } = useToast();

  const loadData = async () => {
    setLoading(true);
    try {
      const data = await fetchWithRelations(
        'ordens_servico',
        'numero_os, data_revisao_futura, cliente:clientes(nome), os_produtos(produto:produtos(nome))',
        { order: 'data_revisao_futura', ascending: true }
      );

      const mapped: RevisaoRow[] = (data || [])
        .filter((os: any) => os.data_revisao_futura)
        .flatMap((os: any) => {
          const produtos = (os.os_produtos || []).map((op: any) => op.produto?.nome || '-');
          const produtoNome = produtos.length > 0 ? produtos.join(', ') : '-';
          return [{
            numero_os: os.numero_os,
            cliente_nome: os.cliente?.nome || '-',
            produto_nome: produtoNome,
            data_revisao_futura: os.data_revisao_futura,
          }];
        });

      setRows(mapped);
      applyFilter(mapped, dateFrom, dateTo);
    } catch (err) {
      console.error('Erro ao carregar revisoes:', err);
      showToast('Erro ao carregar dados');
    } finally {
      setLoading(false);
    }
  };

  const applyFilter = (data: RevisaoRow[], from: string, to: string) => {
    let result = data;
    if (from) result = result.filter(r => r.data_revisao_futura! >= from);
    if (to) result = result.filter(r => r.data_revisao_futura! <= to + 'T23:59:59');
    setFiltered(result);
  };

  useEffect(() => {
    loadData();
  }, []);

  const handleFilter = () => {
    applyFilter(rows, dateFrom, dateTo);
  };

  const clearFilter = () => {
    setDateFrom('');
    setDateTo('');
    setFiltered(rows);
  };

  const generatePDF = async () => {
    setGenerating(true);
    try {
      const doc = new jsPDF();
      const pageWidth = doc.internal.pageSize.getWidth();

      doc.setFillColor(15, 23, 42);
      doc.rect(0, 0, pageWidth, 38, 'F');
      doc.setTextColor(255, 255, 255);
      doc.setFontSize(16);
      doc.setFont('helvetica', 'bold');
      doc.text('Relatorio de Revisoes Futuras', 14, 16);
      doc.setFontSize(9);
      doc.setFont('helvetica', 'normal');
      doc.text('Manutencao preventiva agendada', 14, 23);

      doc.setTextColor(0, 0, 0);
      doc.setFontSize(14);
      doc.setFont('helvetica', 'bold');
      doc.text('Clientes em periodo de revisao', 14, 48);

      if (dateFrom || dateTo) {
        doc.setFontSize(9);
        doc.setFont('helvetica', 'normal');
        doc.setTextColor(100, 100, 100);
        doc.text(`Periodo: ${dateFrom ? new Date(dateFrom).toLocaleDateString('pt-BR') : 'inicio'} a ${dateTo ? new Date(dateTo).toLocaleDateString('pt-BR') : 'fim'}`, 14, 55);
      }

      const startY = dateFrom || dateTo ? 60 : 55;

      autoTable(doc, {
        startY,
        head: [['OS', 'Cliente', 'Produto/Peça', 'Data Revisao']],
        body: filtered.map(r => [
          `#${r.numero_os}`,
          r.cliente_nome,
          r.produto_nome,
          r.data_revisao_futura ? new Date(r.data_revisao_futura).toLocaleDateString('pt-BR') : '-',
        ]),
        styles: { fontSize: 8, cellPadding: 3 },
        headStyles: { fillColor: [16, 185, 129], textColor: [255, 255, 255], fontStyle: 'bold' },
        alternateRowStyles: { fillColor: [248, 250, 252] },
      });

      const pageCount = doc.getNumberOfPages();
      for (let i = 1; i <= pageCount; i++) {
        doc.setPage(i);
        doc.setFontSize(8);
        doc.setTextColor(150, 150, 150);
        doc.text(`Gerado em ${new Date().toLocaleString('pt-BR')} - Pagina ${i} de ${pageCount}`, pageWidth / 2, doc.internal.pageSize.getHeight() - 10, { align: 'center' });
      }

      doc.save(`relatorio_revisoes_${new Date().toISOString().split('T')[0]}.pdf`);
      showToast('PDF gerado com sucesso');
    } catch (err) {
      console.error('Erro ao gerar PDF:', err);
      showToast('Erro ao gerar PDF');
    } finally {
      setGenerating(false);
    }
  };

  const generateExcel = async () => {
    setGenerating(true);
    try {
      const excelData = filtered.map(r => ({
        'OS': r.numero_os,
        'Cliente': r.cliente_nome,
        'Produto/Peça': r.produto_nome,
        'Data Revisao': r.data_revisao_futura ? new Date(r.data_revisao_futura).toLocaleDateString('pt-BR') : '-',
      }));

      const ws = XLSX.utils.json_to_sheet(excelData);
      const wb = XLSX.utils.book_new();
      XLSX.utils.book_append_sheet(wb, ws, 'Revisoes');
      const excelBuffer = XLSX.write(wb, { bookType: 'xlsx', type: 'array' });
      const blob = new Blob([excelBuffer], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' });
      saveAs(blob, `relatorio_revisoes_${new Date().toISOString().split('T')[0]}.xlsx`);
      showToast('Planilha gerada com sucesso');
    } catch (err) {
      console.error('Erro ao gerar planilha:', err);
      showToast('Erro ao gerar planilha');
    } finally {
      setGenerating(false);
    }
  };

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-white">Relatorio de Revisoes Futuras</h1>
        <p className="text-slate-400 text-sm mt-1">Identifique clientes no prazo de manutencao preventiva</p>
      </div>

      <div className="bg-slate-800/50 border border-slate-700/50 rounded-xl p-5">
        <div className="flex items-center gap-2 mb-4">
          <Calendar className="w-4 h-4 text-slate-400" />
          <span className="text-sm font-medium text-slate-300">Filtrar por periodo</span>
        </div>
        <div className="flex flex-wrap gap-4 items-end">
          <div>
            <label className="block text-xs text-slate-400 mb-1">Data Inicial</label>
            <input type="date" value={dateFrom} onChange={(e) => setDateFrom(e.target.value)} className="px-3 py-2 bg-slate-700/50 border border-slate-600 rounded-lg text-white text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500/50" />
          </div>
          <div>
            <label className="block text-xs text-slate-400 mb-1">Data Final</label>
            <input type="date" value={dateTo} onChange={(e) => setDateTo(e.target.value)} className="px-3 py-2 bg-slate-700/50 border border-slate-600 rounded-lg text-white text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500/50" />
          </div>
          <button onClick={handleFilter} className="flex items-center gap-2 px-4 py-2 bg-emerald-500/10 border border-emerald-500/30 text-emerald-400 rounded-lg hover:bg-emerald-500/20 transition-all text-sm font-medium">
            <Search className="w-4 h-4" />
            Filtrar
          </button>
          <button onClick={clearFilter} className="px-4 py-2 text-slate-400 hover:text-white text-sm transition-colors">
            Limpar
          </button>
        </div>
      </div>

      <div className="flex flex-wrap gap-4">
        <button
          onClick={generatePDF}
          disabled={generating || filtered.length === 0}
          className="flex items-center gap-2 px-6 py-3 bg-red-500/10 border border-red-500/30 text-red-400 rounded-xl hover:bg-red-500/20 transition-all font-medium disabled:opacity-50"
        >
          <FileText className="w-5 h-5" />
          <span>Gerar PDF</span>
          <Download className="w-4 h-4 ml-1" />
        </button>
        <button
          onClick={generateExcel}
          disabled={generating || filtered.length === 0}
          className="flex items-center gap-2 px-6 py-3 bg-emerald-500/10 border border-emerald-500/30 text-emerald-400 rounded-xl hover:bg-emerald-500/20 transition-all font-medium disabled:opacity-50"
        >
          <Table className="w-5 h-5" />
          <span>Gerar Planilha</span>
          <Download className="w-4 h-4 ml-1" />
        </button>
      </div>

      <div className="bg-slate-800/50 border border-slate-700/50 rounded-xl overflow-hidden">
        {loading ? (
          <div className="p-12 flex items-center justify-center">
            <div className="w-8 h-8 border-2 border-emerald-500 border-t-transparent rounded-full animate-spin" />
          </div>
        ) : filtered.length === 0 ? (
          <div className="p-12 text-center text-slate-400">
            <Calendar className="w-10 h-10 mx-auto mb-3 opacity-40" />
            <p className="text-sm">Nenhuma revisao agendada encontrada</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="bg-slate-900/50 border-b border-slate-700/50">
                  <th className="px-4 py-3 text-left text-xs font-semibold text-slate-400 uppercase tracking-wider">OS</th>
                  <th className="px-4 py-3 text-left text-xs font-semibold text-slate-400 uppercase tracking-wider">Cliente</th>
                  <th className="px-4 py-3 text-left text-xs font-semibold text-slate-400 uppercase tracking-wider">Produto/Peça</th>
                  <th className="px-4 py-3 text-left text-xs font-semibold text-slate-400 uppercase tracking-wider">Data da Revisao</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-700/30">
                {filtered.map((r, i) => (
                  <tr key={i} className="hover:bg-slate-700/20 transition-colors">
                    <td className="px-4 py-3 text-sm text-slate-300">#{r.numero_os}</td>
                    <td className="px-4 py-3 text-sm text-white font-medium">{r.cliente_nome}</td>
                    <td className="px-4 py-3 text-sm text-slate-300">{r.produto_nome}</td>
                    <td className="px-4 py-3 text-sm text-sky-400 font-medium">
                      {r.data_revisao_futura ? new Date(r.data_revisao_futura).toLocaleDateString('pt-BR') : '-'}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {!loading && filtered.length > 0 && (
        <p className="text-sm text-slate-400">
          {filtered.length} {filtered.length === 1 ? 'revisao encontrada' : 'revisoes encontradas'}
        </p>
      )}
    </div>
  );
}
