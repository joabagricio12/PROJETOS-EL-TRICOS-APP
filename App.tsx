
import React, { useState, useEffect, useRef } from 'react';
import { WegMotorData, BlockData, ProjectData, PageData, ComparisonData, ProjectSummary } from './types';
import { WEG_MOTORS, getMotorByCv } from './motorData';
import { calculateDimensioning, calculateGeneralSummary } from './calculations';

// @ts-ignore
const html2canvas = window.html2canvas;
// @ts-ignore
const { jsPDF } = window.jspdf;

// Ícones SVG para a barra de tarefas
const Icons = {
  Plus: () => <svg className="w-9 h-9" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M12 4v16m8-8H4"/></svg>,
  Folder: () => <svg className="w-9 h-9" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M3 7v10a2 2 0 002 2h14a2 2 0 002-2V9a2 2 0 00-2-2h-6l-2-2H5a2 2 0 00-2 2z"/></svg>,
  Pdf: () => <svg className="w-9 h-9" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M7 21h10a2 2 0 002-2V9.414a1 1 0 00-.293-.707l-5.414-5.414A1 1 0 0012.586 3H7a2 2 0 00-2 2v14a2 2 0 002 2z"/><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M9 15h6M9 11h6M9 19h6"/></svg>,
  Lock: () => <svg className="w-9 h-9" fill="none" stroke="currentColor" viewBox="0 0 24 24"><rect x="3" y="11" width="18" height="11" rx="2" ry="2" strokeWidth="2.5"/><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M7 11V7a5 5 0 0110 0v4"/></svg>,
  Unlock: () => <svg className="w-9 h-9" fill="none" stroke="currentColor" viewBox="0 0 24 24"><rect x="3" y="11" width="18" height="11" rx="2" ry="2" strokeWidth="2.5"/><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M7 11V7a5 5 0 019.9-1"/></svg>,
  Trash: () => <svg className="w-10 h-10" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16"/></svg>,
  Lightning: () => (
    <svg className="w-8 h-8 text-yellow-400 fill-current" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
      <path d="M13 2L3 14H12L11 22L21 10H12L13 2Z" />
    </svg>
  ),
};

const WegMotorIcon = ({ color = "#005792", size = "w-10 h-10" }: { color?: string, size?: string }) => (
  <div className="flex flex-col items-center shrink-0">
    <svg viewBox="0 0 128 128" className={`${size}`} fill="none" xmlns="http://www.w3.org/2000/svg">
      <rect x="30" y="45" width="60" height="45" rx="2" fill={color} />
      <path d="M35 45V90M45 45V90M55 45V90M65 45V90M75 45V90" stroke="white" strokeWidth="1" strokeOpacity="0.2"/>
      <rect x="45" y="35" width="25" height="12" rx="1" fill={color} stroke="white" strokeWidth="0.5"/>
      <circle cx="30" cy="67.5" r="18" fill={color} />
      <circle cx="30" cy="67.5" r="13" stroke="white" strokeWidth="1" strokeDasharray="2 2" strokeOpacity="0.3"/>
      <rect x="90" y="62" width="12" height="10" fill="#94a3b8" />
      <rect x="35" y="88" width="50" height="4" fill="#1e293b" />
    </svg>
    <span className="text-[5px] font-black uppercase tracking-[0.1em] text-slate-500 -mt-0.5">MOTOR</span>
  </div>
);

const INITIAL_PROJECT_STATE: ProjectData = {
  title: 'MEMORIAL DESCRITIVO TÉCNICO',
  clientName: '[NOME DO CLIENTE]',
  techResponsible: '[RESPONSÁVEL TÉCNICO]',
  pages: [{
    id: 'p1',
    blocks: [
      { id: 'b1', type: 'text', value: 'MEMORIAL DESCRITIVO TÉCNICO', fontSize: 18, bold: true, align: 'center' }
    ]
  }]
};

interface SavedProjectEntry {
  id: string;
  timestamp: number;
  data: ProjectData;
  name: string;
}

const App: React.FC = () => {
  const [project, setProject] = useState<ProjectData>(() => {
    const saved = localStorage.getItem('pe_current_v4');
    return saved ? JSON.parse(saved) : INITIAL_PROJECT_STATE;
  });

  const [directory, setDirectory] = useState<SavedProjectEntry[]>(() => {
    const saved = localStorage.getItem('pe_directory_v4');
    return saved ? JSON.parse(saved) : [];
  });

  const [headerImage, setHeaderImage] = useState<string | null>(() => localStorage.getItem('pe_logo_v4'));
  const [isLocked, setIsLocked] = useState(false);
  const [isGeneratingPdf, setIsGeneratingPdf] = useState(false);
  const [showDirectory, setShowDirectory] = useState(false);
  const [selectedBlockIds, setSelectedBlockIds] = useState<string[]>([]);
  const [activePageId, setActivePageId] = useState<string>(project.pages[0].id);
  const pagesRef = useRef<HTMLDivElement>(null);

  useEffect(() => { localStorage.setItem('pe_current_v4', JSON.stringify(project)); }, [project]);
  useEffect(() => { localStorage.setItem('pe_directory_v4', JSON.stringify(directory)); }, [directory]);
  useEffect(() => { if (headerImage) localStorage.setItem('pe_logo_v4', headerImage); }, [headerImage]);

  const handleNewProject = () => {
    if (!window.confirm("Isso arquivará o projeto atual na PASTA e iniciará um novo memorial. Deseja prosseguir?")) return;
    const timestamp = new Date().getTime();
    const newEntry: SavedProjectEntry = {
      id: Math.random().toString(36).substr(2, 9),
      timestamp,
      data: JSON.parse(JSON.stringify(project)),
      name: `PROJETO ${new Date().toLocaleDateString()} ${new Date().toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'})}`
    };
    
    setDirectory(prev => [newEntry, ...prev]);
    setProject(INITIAL_PROJECT_STATE);
    setSelectedBlockIds([]);
  };

  const toggleSelection = (id: string) => {
    if (isLocked) return;
    setSelectedBlockIds(prev => 
      prev.includes(id) ? prev.filter(i => i !== id) : [...prev, id]
    );
  };

  const addBlock = (type: 'text' | 'comparison') => {
    const defaultMotor = getMotorByCv(1)!;
    const defaultCable = calculateDimensioning(defaultMotor, 10).cableSize.replace('mm²', '');
    const newBlock: BlockData = {
      id: Math.random().toString(36).substr(2, 9),
      type,
      value: type === 'comparison' ? { 
        before: { cv: 1, cable: defaultCable, breaker: '', starter: '' }, 
        after: { cv: 1, distance: 10 } 
      } : '',
      fontSize: 10,
      align: 'left'
    };
    setProject(prev => ({
      ...prev,
      pages: prev.pages.map(p => p.id === activePageId ? { ...p, blocks: [...p.blocks, newBlock] } : p)
    }));
    setSelectedBlockIds([newBlock.id]);
  };

  const addSummaryPage = () => {
    const newPage: PageData = {
      id: Math.random().toString(36).substr(2, 9),
      blocks: [{
        id: Math.random().toString(36).substr(2, 9),
        type: 'summary_table',
        value: '',
        fontSize: 10
      }]
    };
    setProject(prev => ({
      ...prev,
      pages: [...prev.pages, newPage]
    }));
    setActivePageId(newPage.id);
    setTimeout(() => {
      const el = document.getElementById(newPage.id);
      el?.scrollIntoView({ behavior: 'smooth' });
    }, 100);
  };

  const deleteSelectedBlocks = () => {
    if (selectedBlockIds.length === 0) return;
    
    const idsToRemove = new Set(selectedBlockIds);
    
    setProject(prev => ({
      ...prev,
      pages: prev.pages.map(p => ({
        ...p,
        blocks: p.blocks.filter(b => !idsToRemove.has(b.id))
      })).filter(p => p.blocks.length > 0 || p.id === 'p1')
    }));
    
    setSelectedBlockIds([]);
  };

  const handleExportPdf = async () => {
    if (!pagesRef.current) return;
    setIsGeneratingPdf(true);
    const originalSelected = [...selectedBlockIds];
    setSelectedBlockIds([]);
    
    try {
      await new Promise(resolve => setTimeout(resolve, 800));
      const pdf = new jsPDF('p', 'mm', 'a4');
      const pages = pagesRef.current.querySelectorAll('.a4-page');
      
      for (let i = 0; i < pages.length; i++) {
        const pageElement = pages[i] as HTMLElement;
        const canvas = await html2canvas(pageElement, {
          scale: 3, 
          useCORS: true,
          logging: false,
          backgroundColor: '#ffffff',
          windowWidth: 1240, 
          height: pageElement.offsetHeight,
          width: pageElement.offsetWidth,
          onclone: (clonedDoc) => {
             const el = clonedDoc.getElementById(pageElement.id) as HTMLElement;
             if(el) {
                el.style.boxShadow = 'none';
                el.style.border = 'none';
                el.style.margin = '0';
             }
          }
        });
        
        const imgData = canvas.toDataURL('image/png', 1.0);
        if (i > 0) pdf.addPage();
        pdf.addImage(imgData, 'PNG', 0, 0, 210, 297, undefined, 'FAST');
      }
      
      pdf.save(`CAMPO_FORTE_${new Date().getTime()}.pdf`);
    } catch (e) { 
      alert("Erro na exportação de PDF."); 
    } finally { 
      setSelectedBlockIds(originalSelected);
      setIsGeneratingPdf(false); 
    }
  };

  const updateBlock = (blockId: string, updates: Partial<BlockData>) => {
    setProject(prev => ({
      ...prev,
      pages: prev.pages.map(p => ({
        ...p,
        blocks: p.blocks.map(b => b.id === blockId ? { ...b, ...updates } : b)
      }))
    }));
  };

  const renderSummaryTable = (summary: ProjectSummary) => (
    <div className="border border-[#001d3d] rounded-sm overflow-hidden bg-white w-full shadow-lg">
      <div className="bg-[#001d3d] text-white p-1.5 font-black text-[10px] uppercase text-center border-b border-[#001d3d] tracking-[0.05em]">
        QUADRO DE ESPECIFICAÇÕES TÉCNICAS E DIMENSIONAMENTO - WEG IE3 PREMIUM
      </div>
      <table className="w-full text-[6.5px] border-collapse leading-none table-fixed">
        <thead>
          <tr className="bg-[#f1f5f9] border-b border-slate-300 font-black uppercase text-[#475569] text-[7px]">
            <th className="p-1 border-r border-slate-300 w-[5%] text-center">ITEM</th>
            <th className="p-1 border-r border-slate-300 w-[45%] text-left">MOTOR / FICHA TÉCNICA DETALHADA</th>
            <th className="p-1 border-r border-slate-300 w-[25%] text-left">DIMENSIONAMENTO ELÉTRICO</th>
            <th className="p-1 w-[25%] text-left">COMPONENTES WEG</th>
          </tr>
        </thead>
        <tbody>
          {summary.details.map((d, i) => (
            <tr key={i} className="border-b border-slate-200 align-top hover:bg-slate-50">
              <td className="p-1 border-r border-slate-300 text-center font-black text-slate-400 text-[8px] align-middle">{i + 1}</td>
              <td className="p-1 border-r border-slate-300">
                <div className="flex gap-2 items-start">
                   <div className="flex flex-col items-center gap-0.5 mt-0.5">
                      <WegMotorIcon color="#005792" size="w-8 h-8" />
                      <span className="text-[5px] font-black text-blue-800 bg-blue-50 px-0.5 rounded uppercase leading-none">W22 IE3</span>
                   </div>
                   <div className="flex flex-col flex-1 overflow-hidden">
                      <div className="font-black text-[9px] text-[#001d3d] mb-0.5 truncate">
                         {d.motor.cv} CV ({d.motor.kw} kW) <span className="text-slate-400 text-[6px] font-black">{d.motor.model}</span>
                      </div>
                      <div className="grid grid-cols-3 gap-y-0.5 gap-x-1 text-[6.5px] font-bold text-slate-600">
                         <div className="flex gap-1">
                            <span className="text-[5px] text-slate-400 uppercase font-black">CARC:</span> {d.motor.frame}
                         </div>
                         <div className="flex gap-1">
                            <span className="text-[5px] text-slate-400 uppercase font-black">IN:</span> {d.motor.currentIn}A
                         </div>
                         <div className="flex gap-1">
                            <span className="text-[5px] text-slate-400 uppercase font-black">RPM:</span> {d.motor.rpm}
                         </div>
                         <div className="flex gap-1">
                            <span className="text-[5px] text-slate-400 uppercase font-black">REND:</span> {d.motor.efficiency}%
                         </div>
                         <div className="flex gap-1">
                            <span className="text-[5px] text-slate-400 uppercase font-black">PESO:</span> {d.motor.weight}kg
                         </div>
                         <div className="flex gap-1">
                            <span className="text-[5px] text-slate-400 uppercase font-black">FP:</span> {d.motor.powerFactor}
                         </div>
                      </div>
                   </div>
                </div>
              </td>
              <td className="p-1 border-r border-slate-300">
                <div className="flex flex-col gap-0.5">
                   <div className="flex justify-between items-center">
                      <span className="text-[6px] font-black text-blue-900 uppercase">CONDUTOR (CABO)</span>
                      <span className="text-[9px] font-black text-[#001d3d]">{d.cableSize}</span>
                   </div>
                   <div className="flex justify-between items-center border-t border-slate-50 pt-0.5">
                      <span className="text-[6px] font-black text-blue-900 uppercase">DISJUNTOR MOTOR</span>
                      <span className="text-[8px] font-black text-[#001d3d]">{d.circuitBreaker}</span>
                   </div>
                   <div className="flex justify-between items-center border-t border-slate-50 pt-0.5">
                      <span className="text-[6px] font-black text-blue-900 uppercase">REGIME PARTIDA</span>
                      <span className="text-[8px] font-black text-orange-600 uppercase">{d.starterType}</span>
                   </div>
                </div>
              </td>
              <td className="p-1">
                 <ul className="space-y-0.5 list-none m-0 p-0 text-[7px] font-bold text-slate-700">
                    <li className="flex items-center gap-1 leading-none">
                       <span className="w-1 h-1 rounded-full bg-blue-800 shrink-0"></span>
                       <span className="uppercase whitespace-nowrap overflow-hidden text-ellipsis">CONTATOR: {d.contactor}</span>
                    </li>
                    <li className="flex items-center gap-1 leading-none">
                       <span className="w-1 h-1 rounded-full bg-blue-800 shrink-0"></span>
                       <span className="uppercase whitespace-nowrap overflow-hidden text-ellipsis">INVERSOR: {d.inverter}</span>
                    </li>
                    <li className="flex items-center gap-1 leading-none">
                       <span className="w-1 h-1 rounded-full bg-blue-800 shrink-0"></span>
                       <span className="uppercase whitespace-nowrap overflow-hidden text-ellipsis">RELÉ: {d.thermalRelay}</span>
                    </li>
                 </ul>
              </td>
            </tr>
          ))}
        </tbody>
        <tfoot className="border-t border-[#001d3d]">
          <tr className="bg-[#001d3d] text-white font-black text-[9px] uppercase">
            <td colSpan={2} className="p-2 border-r border-blue-900 text-left pl-3 tracking-tight">
              PROJETO: {summary.motorCount} UNID | {summary.totalCv} CV TOTAL ({summary.totalKw} kW)
            </td>
            <td className="p-2 text-center border-r border-blue-900 tracking-tight">
              IN TOTAL: {summary.totalIn} A
            </td>
            <td className="p-2 text-center bg-blue-700 tracking-tight">
              {summary.recommendedMainBreaker.toUpperCase()}
            </td>
          </tr>
        </tfoot>
      </table>
    </div>
  );

  return (
    <div className="min-h-screen bg-slate-200 flex flex-col">
      
      {/* BARRA DE TAREFAS */}
      <div className="fixed top-0 left-0 w-full h-16 bg-[#001d3d] shadow-2xl z-[9999] no-print flex items-center border-b-2 border-blue-900">
        <div className="w-1/2 flex items-center justify-evenly px-4 border-r border-blue-800/40 h-full">
          <div className="flex items-center gap-2">
            <Icons.Lightning />
            <span className="text-white font-black text-[14px] uppercase tracking-tighter leading-none">CAMPO FORTE</span>
          </div>
          <div className="flex items-center gap-4">
            <button onClick={() => addBlock('text')} className="btn-nav text-[11px] px-6">TEXTO</button>
            <button onClick={() => addBlock('comparison')} className="btn-nav text-[11px] px-6">MOTOR</button>
            <button onClick={addSummaryPage} className="btn-nav bg-blue-800 text-white border-blue-700 text-[11px] px-6">QUADRO</button>
          </div>
        </div>
        
        <div className="w-1/2 flex items-center justify-evenly px-4 h-full">
          <button onClick={handleNewProject} title="Novo Projeto" className="btn-icon bg-blue-600 border-none"><Icons.Plus /></button>
          <button onClick={() => setShowDirectory(true)} title="Pasta de Projetos" className="btn-icon bg-amber-600 border-none"><Icons.Folder /></button>
          <button onClick={handleExportPdf} title="Exportar PDF" className="btn-icon bg-emerald-600 border-none"><Icons.Pdf /></button>
          
          <button 
            onClick={() => setIsLocked(!isLocked)} 
            className={`btn-icon transition-all shadow-lg ${isLocked ? 'bg-red-700 ring-4 ring-red-400/30' : 'bg-slate-700 hover:bg-slate-600'}`}
          >
            {isLocked ? <Icons.Lock /> : <Icons.Unlock />}
          </button>

          <button 
            onClick={(e) => { e.stopPropagation(); deleteSelectedBlocks(); }} 
            disabled={selectedBlockIds.length === 0}
            className={`transition-all duration-300 relative ${selectedBlockIds.length > 0 ? 'text-red-500 scale-125 opacity-100 drop-shadow-[0_0_15px_rgba(239,68,68,0.8)]' : 'text-slate-500 opacity-20 cursor-not-allowed'}`}
          >
            <Icons.Trash />
            {selectedBlockIds.length > 0 && (
              <span className="absolute -top-2 -right-2 bg-red-600 text-white text-[10px] font-black px-1.5 py-0.5 rounded-full border-2 border-[#001d3d] scale-75">
                {selectedBlockIds.length}
              </span>
            )}
          </button>
        </div>
      </div>

      {/* ÁREA DE TRABALHO */}
      <div className="mt-28 mb-20 flex flex-col items-center gap-10 px-4" ref={pagesRef}>
        {project.pages.map((page) => (
          <div 
            key={page.id} 
            id={page.id}
            onClick={() => setActivePageId(page.id)}
            className={`a4-page bg-white w-[210mm] min-h-[297mm] pt-8 px-16 pb-24 relative flex flex-col shadow-[0_40px_80px_-20px_rgba(0,0,0,0.3)] transition-all ${activePageId === page.id ? 'ring-8 ring-blue-500/5' : ''}`}
          >
            {/* Header / Logo */}
            <div className="w-full flex justify-center mb-2 border-b border-slate-100 pb-2">
              {headerImage ? (
                <img src={headerImage} className="max-h-20 cursor-pointer hover:opacity-80 transition-all" alt="Logo" onClick={() => !isLocked && document.getElementById('logo-up')?.click()} />
              ) : (
                <div className="p-6 border-4 border-dashed border-slate-100 text-slate-200 font-black text-xs uppercase cursor-pointer hover:bg-slate-50 transition-all rounded-lg" onClick={() => !isLocked && document.getElementById('logo-up')?.click()}>
                  LOGOTIPO DA EMPRESA
                </div>
              )}
              <input type="file" id="logo-up" className="hidden" onChange={(e) => {
                const f = e.target.files?.[0];
                if(f){ const r = new FileReader(); r.onloadend = () => setHeaderImage(r.result as string); r.readAsDataURL(f); }
              }} />
            </div>

            {/* Blocos */}
            <div className="flex flex-col flex-1 gap-1">
              {page.blocks.map((block) => {
                const isSelected = selectedBlockIds.includes(block.id);
                if (block.type === 'text') {
                  return (
                    <div 
                      key={block.id} 
                      className={`w-full mb-1 p-1 rounded transition-all cursor-pointer ${isSelected ? 'bg-blue-100 ring-2 ring-blue-500' : 'hover:bg-blue-50/50'}`} 
                      onClick={(e) => { e.stopPropagation(); toggleSelection(block.id); }}
                    >
                      <textarea
                        className="w-full bg-transparent border-none outline-none resize-none overflow-hidden text-slate-800 leading-relaxed rounded pointer-events-none"
                        style={{ fontSize: `${block.fontSize}px`, fontWeight: block.bold ? '900' : '500', textAlign: block.align }}
                        value={block.value as string}
                        onChange={(e) => updateBlock(block.id, { value: e.target.value })}
                        disabled={isLocked}
                        rows={1}
                        onInput={(e) => {
                          const target = e.target as HTMLTextAreaElement;
                          target.style.height = 'auto';
                          target.style.height = target.scrollHeight + 'px';
                        }}
                      />
                    </div>
                  );
                }

                if (block.type === 'summary_table') {
                  return (
                    <div 
                      key={block.id} 
                      className={`w-full mb-6 cursor-pointer transition-all ${isSelected ? 'ring-4 ring-blue-500 rounded-lg p-1' : 'hover:ring-2 hover:ring-blue-100'}`} 
                      onClick={(e) => { e.stopPropagation(); toggleSelection(block.id); }}
                    >
                      {renderSummaryTable(calculateGeneralSummary(
                        project.pages.flatMap(p => p.blocks)
                          .filter(b => b.type === 'comparison')
                          .map(b => ({
                            motor: getMotorByCv((b.value as ComparisonData).after.cv)!,
                            distance: (b.value as ComparisonData).after.distance
                          }))
                          .filter(item => !!item.motor)
                      ))}
                    </div>
                  );
                }

                const compData = block.value as ComparisonData;
                const motorAfter = getMotorByCv(compData.after.cv)!;
                const dimAfter = calculateDimensioning(motorAfter, compData.after.distance);

                return (
                  <div 
                    key={block.id} 
                    className={`py-4 border-b border-slate-50 flex items-center justify-between w-full hover:bg-slate-50 px-2 rounded-lg transition-all cursor-pointer ${isSelected ? 'bg-blue-100 ring-2 ring-blue-500 shadow-inner' : ''}`} 
                    onClick={(e) => { e.stopPropagation(); toggleSelection(block.id); }}
                  >
                    <div className="flex-[0.45] flex items-center gap-3">
                      <WegMotorIcon color="#cbd5e1" size="w-10 h-10" />
                      <div className="flex flex-col">
                        <span className="text-[7px] font-black text-slate-400 uppercase tracking-widest">ATUAL</span>
                        <select className="text-[10px] font-black bg-transparent border-none outline-none text-slate-600 p-0 pointer-events-auto" value={compData.before.cv} onClick={(e) => e.stopPropagation()} onChange={(e) => updateBlock(block.id, { value: { ...compData, before: { ...compData.before, cv: parseFloat(e.target.value) } } })} disabled={isLocked}>
                          {WEG_MOTORS.map(m => <option key={m.cv} value={m.cv}>{m.cv} CV</option>)}
                        </select>
                      </div>
                    </div>

                    <div className="text-slate-200 px-2"><svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M17 8l4 4m0 0l-4 4m4-4H3"/></svg></div>

                    <div className="flex-[0.52] flex items-center gap-3 pl-4 border-l-2 border-slate-100">
                      <WegMotorIcon color="#005792" size="w-10 h-10" />
                      <div className="flex flex-col flex-1">
                        <div className="flex justify-between items-center">
                          <span className="text-[7px] font-black text-blue-900 uppercase">W22 IE3 PREMIUM</span>
                          <div className="flex items-center gap-1 bg-blue-50 px-1.5 py-0.5 rounded-full border border-blue-100 pointer-events-auto">
                            <input type="number" className="w-6 text-[9px] font-black text-blue-900 bg-transparent text-center outline-none" value={compData.after.distance} onClick={(e) => e.stopPropagation()} onChange={(e) => updateBlock(block.id, { value: { ...compData, after: { ...compData.after, distance: parseFloat(e.target.value) || 1 } } })} disabled={isLocked} />
                            <span className="text-[6px] font-black text-blue-400 uppercase">M</span>
                          </div>
                        </div>
                        <select className="text-[12px] font-black text-blue-900 bg-transparent w-full border-none outline-none p-0 pointer-events-auto" value={compData.after.cv} onClick={(e) => e.stopPropagation()} onChange={(e) => updateBlock(block.id, { value: { ...compData, after: { ...compData.after, cv: parseFloat(e.target.value) } } })} disabled={isLocked}>
                          {WEG_MOTORS.map(m => <option key={m.cv} value={m.cv}>{m.cv} CV / {m.kw} kW</option>)}
                        </select>
                        <div className="flex items-center gap-3 mt-1">
                          <span className="text-[12px] font-black text-emerald-600 leading-none">{dimAfter.cableSize}</span>
                          <span className="text-[8px] font-black text-slate-800 leading-none uppercase">{dimAfter.voltageDrop}</span>
                        </div>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>

            {/* Rodapé Dinâmico */}
            <div className="absolute bottom-10 left-16 right-16 flex justify-between items-end border-t border-slate-100 pt-4">
              <div className="flex flex-col gap-1">
                <span className="text-[7px] font-black text-slate-400 uppercase tracking-widest text-left">RESPONSÁVEL TÉCNICO</span>
                <input 
                  type="text" 
                  className="bg-transparent border-none outline-none font-bold text-slate-700 text-[9px] uppercase w-48 text-left"
                  value={project.techResponsible}
                  onChange={(e) => setProject(prev => ({ ...prev, techResponsible: e.target.value }))}
                  disabled={isLocked}
                />
              </div>
              <div className="flex flex-col gap-1">
                <span className="text-[7px] font-black text-slate-400 uppercase tracking-widest text-right">CLIENTE</span>
                <input 
                  type="text" 
                  className="bg-transparent border-none outline-none font-bold text-slate-700 text-[9px] uppercase w-48 text-right"
                  value={project.clientName}
                  onChange={(e) => setProject(prev => ({ ...prev, clientName: e.target.value }))}
                  disabled={isLocked}
                />
              </div>
            </div>
          </div>
        ))}
      </div>

      {showDirectory && (
        <div className="fixed inset-0 bg-slate-900/80 z-[10000] flex items-center justify-center p-4 backdrop-blur-sm">
          <div className="bg-white w-full max-w-lg rounded-2xl shadow-2xl overflow-hidden flex flex-col max-h-[70vh]">
            <div className="bg-slate-100 p-5 border-b flex justify-between items-center">
              <h3 className="font-black text-slate-800 uppercase text-xs tracking-widest">DIRETÓRIO DE ARQUIVOS</h3>
              <button onClick={() => setShowDirectory(false)} className="text-slate-400 hover:text-red-500 font-black text-2xl">×</button>
            </div>
            <div className="flex-1 overflow-y-auto p-4 space-y-2">
              {directory.map(entry => (
                <div key={entry.id} className="bg-slate-50 p-3 rounded-xl flex items-center justify-between border border-transparent hover:border-blue-400 transition-all">
                  <div className="flex flex-col">
                    <span className="font-black text-slate-700 text-[10px] uppercase">{entry.name}</span>
                  </div>
                  <div className="flex gap-2">
                    <button onClick={() => { setProject(entry.data); setShowDirectory(false); }} className="px-3 py-1 bg-blue-600 text-white font-black text-[9px] rounded-lg">ABRIR</button>
                    <button onClick={() => setDirectory(prev => prev.filter(d => d.id !== entry.id))} className="px-3 py-1 bg-slate-200 text-slate-500 font-black text-[9px] rounded-lg hover:bg-red-500 hover:text-white">DELETAR</button>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      <style>{`
        body { background-color: #f1f5f9; -webkit-print-color-adjust: exact; overflow-x: hidden; }
        .btn-nav { font-size: 11px; font-weight: 900; color: #94a3b8; border: 2px solid #1e293b; border-radius: 8px; text-transform: uppercase; cursor: pointer; transition: 0.2s; white-space: nowrap; height: 38px; display: flex; align-items: center; justify-content: center; }
        .btn-nav:hover { color: white; background: #1e293b; border-color: #3b82f6; }
        .btn-icon { width: 44px; height: 44px; display: flex; align-items: center; justify-content: center; border-radius: 12px; color: white; cursor: pointer; transition: 0.2s; }
        .btn-icon:hover { transform: translateY(-2px); filter: brightness(1.1); }
        .btn-icon:active { transform: translateY(0); }
        input[type=number]::-webkit-inner-spin-button { -webkit-appearance: none; margin: 0; }
        
        @media (max-width: 215mm) {
          .a4-page { 
            width: 98vw !important; 
            margin: 10px auto !important; 
            padding: 30px 15px 120px 15px !important; 
            height: auto !important;
            box-shadow: none !important;
          }
          .mt-28 { margin-top: 80px !important; }
          .w-1/2 { width: 50% !important; }
          .absolute.bottom-10 { position: relative !important; bottom: 0 !important; left: 0 !important; right: 0 !important; margin-top: 40px !important; }
        }
      `}</style>
    </div>
  );
};

export default App;
