'use client';

import { useState, useEffect, useRef } from 'react';
import {
  HardDrive, FolderOpen, File, Upload, Trash2, RefreshCw, Loader2,
  FolderPlus, ChevronRight, Home, ArrowLeft, Edit2, Archive,
  CheckSquare, Square, RotateCcw, AlertTriangle
} from 'lucide-react';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { api, getErrorMessage } from '@/lib/api';
import toast from 'react-hot-toast';

interface FileEntry {
  name: string;
  type: 'file' | 'directory';
  size: number;
  mtime: string;
  permissions?: string;
}

interface TrashItem {
  trashName: string;
  originalName: string;
  originalPath: string;
  deletedAt: string;
  type: 'file' | 'directory';
  size: number;
}

interface Domain { id: string; name: string; }

const formatSize = (bytes: number) => {
  if (!bytes) return '—';
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
};

const formatDate = (iso: string) => {
  try {
    return new Date(iso).toLocaleString('tr-TR', { dateStyle: 'short', timeStyle: 'short' });
  } catch { return iso; }
};

export default function FilesPage() {
  const [domains, setDomains] = useState<Domain[]>([]);
  const [domainId, setDomainId] = useState('');
  const [path, setPath] = useState('/');
  const [entries, setEntries] = useState<FileEntry[]>([]);
  const [loading, setLoading] = useState(false);
  const [showMkdir, setShowMkdir] = useState(false);
  const [showRename, setShowRename] = useState<FileEntry | null>(null);
  const [newName, setNewName] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [selectedNames, setSelectedNames] = useState<Set<string>>(new Set());
  const [showTrash, setShowTrash] = useState(false);
  const [trashItems, setTrashItems] = useState<TrashItem[]>([]);
  const [trashLoading, setTrashLoading] = useState(false);
  const [selectedTrash, setSelectedTrash] = useState<Set<string>>(new Set());
  const [showEmptyConfirm, setShowEmptyConfirm] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    api.get('/domains').then(r => {
      const list = r.data.data || [];
      setDomains(list);
      if (list.length > 0) setDomainId(list[0].id);
    }).catch(() => {});
  }, []);

  const fetchFiles = async (targetPath = path) => {
    if (!domainId) return;
    setLoading(true);
    setSelectedNames(new Set());
    try {
      const res = await api.get(`/files/${domainId}`, { params: { path: targetPath } });
      setEntries(res.data.data || []);
      setPath(targetPath);
    } catch (err) {
      toast.error(getErrorMessage(err));
    } finally {
      setLoading(false);
    }
  };

  const fetchTrash = async () => {
    if (!domainId) return;
    setTrashLoading(true);
    setSelectedTrash(new Set());
    try {
      const res = await api.get(`/files/${domainId}/trash`);
      setTrashItems(res.data.data || []);
    } catch (err) {
      toast.error(getErrorMessage(err));
    } finally {
      setTrashLoading(false);
    }
  };

  useEffect(() => {
    if (domainId) { setPath('/'); fetchFiles('/'); setShowTrash(false); setTrashItems([]); }
  }, [domainId]);

  useEffect(() => {
    if (showTrash && domainId) fetchTrash();
  }, [showTrash]);

  const navigateTo = (name: string) => {
    const newPath = path === '/' ? `/${name}` : `${path}/${name}`;
    fetchFiles(newPath);
  };

  const navigateUp = () => {
    if (path === '/') return;
    const parts = path.split('/').filter(Boolean);
    parts.pop();
    fetchFiles(parts.length === 0 ? '/' : `/${parts.join('/')}`);
  };

  const breadcrumbs = path.split('/').filter(Boolean);

  const handleUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !domainId) return;
    const formData = new FormData();
    formData.append('file', file);
    formData.append('domainId', domainId);
    formData.append('path', path);
    try {
      await api.post(`/files/${domainId}/upload`, formData, { headers: { 'Content-Type': 'multipart/form-data' } });
      toast.success(`${file.name} yüklendi.`);
      fetchFiles();
    } catch (err) {
      toast.error(getErrorMessage(err));
    }
    e.target.value = '';
  };

  const handleMkdir = async () => {
    if (!newName.trim()) return;
    setSubmitting(true);
    try {
      await api.post(`/files/${domainId}/mkdir`, { path: `${path}/${newName}` });
      toast.success('Klasör oluşturuldu.');
      setShowMkdir(false);
      setNewName('');
      fetchFiles();
    } catch (err) {
      toast.error(getErrorMessage(err));
    } finally {
      setSubmitting(false);
    }
  };

  const handleDelete = async (entry: FileEntry) => {
    if (!confirm(`"${entry.name}" çöp kutusuna taşınsın mı?`)) return;
    try {
      await api.post(`/files/${domainId}/trash/move`, { paths: [`${path}/${entry.name}`] });
      toast.success(`"${entry.name}" çöp kutusuna taşındı.`);
      setEntries(prev => prev.filter(e => e.name !== entry.name));
    } catch (err) {
      toast.error(getErrorMessage(err));
    }
  };

  const toggleSelect = (name: string) => {
    const next = new Set(selectedNames);
    if (next.has(name)) next.delete(name);
    else next.add(name);
    setSelectedNames(next);
  };

  const toggleSelectAll = () => {
    if (selectedNames.size === sortedEntries.length) {
      setSelectedNames(new Set());
    } else {
      setSelectedNames(new Set(sortedEntries.map(e => e.name)));
    }
  };

  const handleDeleteSelected = async () => {
    if (selectedNames.size === 0) return;
    const count = selectedNames.size;
    if (!confirm(`${count} öğe çöp kutusuna taşınsın mı?`)) return;
    setSubmitting(true);
    try {
      const paths = Array.from(selectedNames).map(name => `${path}/${name}`);
      await api.post(`/files/${domainId}/trash/move`, { paths });
      toast.success(`${count} öğe çöp kutusuna taşındı.`);
      setSelectedNames(new Set());
      fetchFiles();
    } catch (err) {
      toast.error(getErrorMessage(err));
    } finally {
      setSubmitting(false);
    }
  };

  const handleRename = async () => {
    if (!showRename || !newName.trim()) return;
    setSubmitting(true);
    try {
      await api.post(`/files/${domainId}/rename`, {
        oldPath: `${path}/${showRename.name}`,
        newPath: `${path}/${newName}`,
      });
      toast.success('Yeniden adlandırıldı.');
      setShowRename(null);
      setNewName('');
      fetchFiles();
    } catch (err) {
      toast.error(getErrorMessage(err));
    } finally {
      setSubmitting(false);
    }
  };

  const toggleSelectTrash = (name: string) => {
    const next = new Set(selectedTrash);
    if (next.has(name)) next.delete(name);
    else next.add(name);
    setSelectedTrash(next);
  };

  const toggleSelectAllTrash = () => {
    if (selectedTrash.size === trashItems.length) setSelectedTrash(new Set());
    else setSelectedTrash(new Set(trashItems.map(i => i.trashName)));
  };

  const handleTrashRestore = async () => {
    if (selectedTrash.size === 0) return;
    setSubmitting(true);
    try {
      await api.post(`/files/${domainId}/trash/restore`, { trashNames: Array.from(selectedTrash) });
      toast.success(`${selectedTrash.size} öğe geri yüklendi.`);
      fetchTrash();
    } catch (err) {
      toast.error(getErrorMessage(err));
    } finally {
      setSubmitting(false);
    }
  };

  const handleTrashDelete = async () => {
    if (selectedTrash.size === 0) return;
    if (!confirm(`${selectedTrash.size} öğe kalıcı olarak silinsin mi? Bu işlem geri alınamaz.`)) return;
    setSubmitting(true);
    try {
      await api.post(`/files/${domainId}/trash/delete`, { trashNames: Array.from(selectedTrash) });
      toast.success(`${selectedTrash.size} öğe kalıcı olarak silindi.`);
      fetchTrash();
    } catch (err) {
      toast.error(getErrorMessage(err));
    } finally {
      setSubmitting(false);
    }
  };

  const handleEmptyTrash = async () => {
    setSubmitting(true);
    try {
      await api.delete(`/files/${domainId}/trash/empty`);
      toast.success('Çöp kutusu temizlendi.');
      setShowEmptyConfirm(false);
      fetchTrash();
    } catch (err) {
      toast.error(getErrorMessage(err));
    } finally {
      setSubmitting(false);
    }
  };

  const sortedEntries = [...entries].sort((a, b) => {
    if (a.type === 'directory' && b.type !== 'directory') return -1;
    if (a.type !== 'directory' && b.type === 'directory') return 1;
    return a.name.localeCompare(b.name);
  });

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 border-b border-[#23252a]/70 pb-6">
        <div>
          <h2 className="text-3xl font-extrabold text-white tracking-tight bg-gradient-to-r from-white via-slate-200 to-slate-400 bg-clip-text text-transparent">Dosya Yöneticisi</h2>
          <p className="text-[#8a8f98] mt-1 text-sm">Domain dosya sisteminizi tarayın ve yönetin.</p>
        </div>
        <div className="flex gap-2 items-center">
          <Select value={domainId} onValueChange={setDomainId}>
            <SelectTrigger className="w-48 bg-[#07080b] border-[#23252a] text-white rounded-xl">
              <SelectValue placeholder="Domain seçin" />
            </SelectTrigger>
            <SelectContent className="bg-[#0b0c10] border-[#23252a] text-white">
              {domains.map(d => <SelectItem key={d.id} value={d.id} className="hover:bg-[#14151a]">{d.name}</SelectItem>)}
            </SelectContent>
          </Select>
          {domainId && (
            <Button
              onClick={() => setShowTrash(v => !v)}
              variant="outline"
              className={`rounded-xl gap-1.5 text-xs relative ${showTrash ? 'border-red-600 bg-red-950/30 text-red-400' : 'border-[#23252a] hover:bg-[#14151a] text-[#8a8f98] hover:text-white'}`}
            >
              <Trash2 className="h-3.5 w-3.5" />
              Çöp Kutusu
              {!showTrash && trashItems.length > 0 && (
                <span className="absolute -top-1.5 -right-1.5 bg-red-600 text-white text-[9px] rounded-full h-4 w-4 flex items-center justify-center font-bold">{trashItems.length}</span>
              )}
            </Button>
          )}
        </div>
      </div>

      {domainId && !showTrash && (
        <>
          <div className="flex items-center justify-between flex-wrap gap-3">
            <div className="flex items-center gap-1 text-sm text-[#8a8f98] flex-wrap">
              <button onClick={() => fetchFiles('/')} className="hover:text-white transition-colors"><Home className="h-4 w-4" /></button>
              {breadcrumbs.map((crumb, i) => (
                <div key={i} className="flex items-center gap-1">
                  <ChevronRight className="h-3 w-3" />
                  <button
                    onClick={() => fetchFiles('/' + breadcrumbs.slice(0, i + 1).join('/'))}
                    className="hover:text-white transition-colors"
                  >{crumb}</button>
                </div>
              ))}
            </div>
            <div className="flex gap-2">
              {path !== '/' && (
                <Button onClick={navigateUp} variant="outline" className="border-[#23252a] hover:bg-[#14151a] text-white rounded-xl gap-1.5 text-xs">
                  <ArrowLeft className="h-3.5 w-3.5" />Geri
                </Button>
              )}
              <Button onClick={() => { setNewName(''); setShowMkdir(true); }} variant="outline" className="border-[#23252a] hover:bg-[#14151a] text-white rounded-xl gap-1.5 text-xs">
                <FolderPlus className="h-3.5 w-3.5" />Klasör
              </Button>
              <input type="file" ref={fileInputRef} onChange={handleUpload} className="hidden" />
              <Button onClick={toggleSelectAll} variant="outline" className="border-[#23252a] hover:bg-[#14151a] text-white rounded-xl gap-1.5 text-xs">
                {selectedNames.size === sortedEntries.length && sortedEntries.length > 0
                  ? <CheckSquare className="h-3.5 w-3.5" />
                  : <Square className="h-3.5 w-3.5" />}
                Tümünü Seç
              </Button>
              {selectedNames.size > 0 && (
                <Button onClick={handleDeleteSelected} disabled={submitting} variant="outline" className="border-red-900/50 hover:bg-red-950/30 text-red-400 rounded-xl gap-1.5 text-xs">
                  {submitting ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Trash2 className="h-3.5 w-3.5" />}
                  Çöpe Taşı ({selectedNames.size})
                </Button>
              )}
              <Button onClick={() => fileInputRef.current?.click()} className="bg-gradient-to-r from-primary to-[#828fff] text-white rounded-xl gap-1.5 text-xs">
                <Upload className="h-3.5 w-3.5" />Dosya Yükle
              </Button>
              <Button onClick={() => fetchFiles()} variant="outline" className="border-[#23252a] hover:bg-[#14151a] text-white rounded-xl">
                <RefreshCw className="h-3.5 w-3.5" />
              </Button>
            </div>
          </div>

          <Card className="bg-[#0b0c10]/50 backdrop-blur-xl border border-[#23252a]">
            <CardContent className="p-0">
              {loading ? (
                <div className="flex justify-center items-center py-16"><Loader2 className="h-8 w-8 animate-spin text-primary" /></div>
              ) : sortedEntries.length === 0 ? (
                <div className="flex flex-col items-center justify-center py-16 text-center">
                  <FolderOpen className="h-12 w-12 text-[#8a8f98] mb-3" />
                  <p className="text-white font-semibold">Klasör boş</p>
                </div>
              ) : (
                <div className="divide-y divide-[#23252a]/50">
                  <div className="grid grid-cols-12 gap-4 px-5 py-2.5 text-[10px] font-semibold text-[#8a8f98] uppercase tracking-wider">
                    <div className="col-span-1 flex items-center">
                      <button onClick={toggleSelectAll} className="hover:text-white transition-colors">
                        {selectedNames.size === sortedEntries.length && sortedEntries.length > 0
                          ? <CheckSquare className="h-3.5 w-3.5" />
                          : <Square className="h-3.5 w-3.5" />}
                      </button>
                    </div>
                    <div className="col-span-5">Ad</div>
                    <div className="col-span-2 text-center">Tür</div>
                    <div className="col-span-2 text-right">Boyut</div>
                    <div className="col-span-2 text-right">İşlemler</div>
                  </div>
                  {sortedEntries.map((entry) => (
                    <div key={entry.name} className="grid grid-cols-12 gap-4 px-5 py-3 items-center hover:bg-[#0a0b10]/50 transition-colors group">
                      <div className="col-span-1 flex items-center">
                        <button onClick={() => toggleSelect(entry.name)} className="hover:text-white transition-colors">
                          {selectedNames.has(entry.name)
                            ? <CheckSquare className="h-4 w-4 text-cyan-400" />
                            : <Square className="h-4 w-4 text-[#8a8f98]" />}
                        </button>
                      </div>
                      <div className="col-span-5 flex items-center gap-3 min-w-0">
                        {entry.type === 'directory' ? (
                          <FolderOpen className="h-4 w-4 text-yellow-400 shrink-0" />
                        ) : (
                          <File className="h-4 w-4 text-[#8a8f98] shrink-0" />
                        )}
                        <button
                          onClick={() => entry.type === 'directory' && navigateTo(entry.name)}
                          className={`text-sm truncate ${entry.type === 'directory' ? 'text-white hover:text-cyan-400 cursor-pointer font-medium' : 'text-slate-300 cursor-default'}`}
                        >
                          {entry.name}
                        </button>
                      </div>
                      <div className="col-span-2 text-center">
                        <Badge variant="outline" className={`text-[10px] ${entry.type === 'directory' ? 'bg-yellow-950/20 text-yellow-400 border-yellow-900/30' : 'bg-[#14151a] text-[#8a8f98] border-[#23252a]'}`}>
                          {entry.type === 'directory' ? 'Klasör' : 'Dosya'}
                        </Badge>
                      </div>
                      <div className="col-span-2 text-right text-xs font-mono text-[#8a8f98]">{formatSize(entry.size)}</div>
                      <div className="col-span-2 flex items-center justify-end gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                        <Button onClick={() => { setShowRename(entry); setNewName(entry.name); }} variant="ghost" className="h-7 w-7 p-0 text-[#8a8f98] hover:text-white rounded-lg">
                          <Edit2 className="h-3.5 w-3.5" />
                        </Button>
                        <Button onClick={() => handleDelete(entry)} variant="ghost" className="h-7 w-7 p-0 text-[#8a8f98] hover:text-red-400 rounded-lg" title="Çöp kutusuna taşı">
                          <Trash2 className="h-3.5 w-3.5" />
                        </Button>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </>
      )}

      {domainId && showTrash && (
        <>
          <div className="flex items-center justify-between flex-wrap gap-3">
            <div className="flex items-center gap-2">
              <Trash2 className="h-4 w-4 text-red-400" />
              <span className="text-white font-semibold">Çöp Kutusu</span>
              <span className="text-[#8a8f98] text-sm">({trashItems.length} öğe)</span>
            </div>
            <div className="flex gap-2">
              <Button onClick={toggleSelectAllTrash} variant="outline" className="border-[#23252a] hover:bg-[#14151a] text-white rounded-xl gap-1.5 text-xs">
                {selectedTrash.size === trashItems.length && trashItems.length > 0
                  ? <CheckSquare className="h-3.5 w-3.5" />
                  : <Square className="h-3.5 w-3.5" />}
                Tümünü Seç
              </Button>
              {selectedTrash.size > 0 && (
                <>
                  <Button onClick={handleTrashRestore} disabled={submitting} variant="outline" className="border-emerald-900/50 hover:bg-emerald-950/30 text-emerald-400 rounded-xl gap-1.5 text-xs">
                    {submitting ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <RotateCcw className="h-3.5 w-3.5" />}
                    Geri Yükle ({selectedTrash.size})
                  </Button>
                  <Button onClick={handleTrashDelete} disabled={submitting} variant="outline" className="border-red-900/50 hover:bg-red-950/30 text-red-400 rounded-xl gap-1.5 text-xs">
                    {submitting ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Trash2 className="h-3.5 w-3.5" />}
                    Kalıcı Sil ({selectedTrash.size})
                  </Button>
                </>
              )}
              {trashItems.length > 0 && (
                <Button onClick={() => setShowEmptyConfirm(true)} variant="outline" className="border-red-900/50 hover:bg-red-950/30 text-red-400 rounded-xl gap-1.5 text-xs">
                  <AlertTriangle className="h-3.5 w-3.5" />
                  Çöp Kutusunu Boşalt
                </Button>
              )}
              <Button onClick={fetchTrash} variant="outline" className="border-[#23252a] hover:bg-[#14151a] text-white rounded-xl">
                <RefreshCw className="h-3.5 w-3.5" />
              </Button>
            </div>
          </div>

          <Card className="bg-[#0b0c10]/50 backdrop-blur-xl border border-[#23252a]">
            <CardContent className="p-0">
              {trashLoading ? (
                <div className="flex justify-center items-center py-16"><Loader2 className="h-8 w-8 animate-spin text-primary" /></div>
              ) : trashItems.length === 0 ? (
                <div className="flex flex-col items-center justify-center py-16 text-center">
                  <Trash2 className="h-12 w-12 text-[#8a8f98] mb-3" />
                  <p className="text-white font-semibold">Çöp kutusu boş</p>
                  <p className="text-[#8a8f98] text-sm mt-1">Silinen dosyalar burada görünecek</p>
                </div>
              ) : (
                <div className="divide-y divide-[#23252a]/50">
                  <div className="grid grid-cols-12 gap-4 px-5 py-2.5 text-[10px] font-semibold text-[#8a8f98] uppercase tracking-wider">
                    <div className="col-span-1 flex items-center">
                      <button onClick={toggleSelectAllTrash} className="hover:text-white transition-colors">
                        {selectedTrash.size === trashItems.length && trashItems.length > 0
                          ? <CheckSquare className="h-3.5 w-3.5" />
                          : <Square className="h-3.5 w-3.5" />}
                      </button>
                    </div>
                    <div className="col-span-4">Ad</div>
                    <div className="col-span-3">Orijinal Konum</div>
                    <div className="col-span-2 text-center">Silinme Tarihi</div>
                    <div className="col-span-2 text-right">İşlemler</div>
                  </div>
                  {trashItems.map((item) => (
                    <div key={item.trashName} className="grid grid-cols-12 gap-4 px-5 py-3 items-center hover:bg-[#0a0b10]/50 transition-colors group">
                      <div className="col-span-1 flex items-center">
                        <button onClick={() => toggleSelectTrash(item.trashName)} className="hover:text-white transition-colors">
                          {selectedTrash.has(item.trashName)
                            ? <CheckSquare className="h-4 w-4 text-cyan-400" />
                            : <Square className="h-4 w-4 text-[#8a8f98]" />}
                        </button>
                      </div>
                      <div className="col-span-4 flex items-center gap-3 min-w-0">
                        {item.type === 'directory'
                          ? <FolderOpen className="h-4 w-4 text-yellow-400 shrink-0" />
                          : <File className="h-4 w-4 text-[#8a8f98] shrink-0" />}
                        <span className="text-sm text-slate-300 truncate">{item.originalName}</span>
                      </div>
                      <div className="col-span-3 text-xs text-[#8a8f98] truncate font-mono">{item.originalPath}</div>
                      <div className="col-span-2 text-center text-xs text-[#8a8f98]">{formatDate(item.deletedAt)}</div>
                      <div className="col-span-2 flex items-center justify-end gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                        <Button
                          onClick={() => { setSelectedTrash(new Set([item.trashName])); handleTrashRestore(); }}
                          variant="ghost" className="h-7 w-7 p-0 text-[#8a8f98] hover:text-emerald-400 rounded-lg" title="Geri yükle"
                        >
                          <RotateCcw className="h-3.5 w-3.5" />
                        </Button>
                        <Button
                          onClick={async () => {
                            if (!confirm(`"${item.originalName}" kalıcı olarak silinsin mi?`)) return;
                            try {
                              await api.post(`/files/${domainId}/trash/delete`, { trashNames: [item.trashName] });
                              toast.success('Kalıcı olarak silindi.');
                              fetchTrash();
                            } catch (err) { toast.error(getErrorMessage(err)); }
                          }}
                          variant="ghost" className="h-7 w-7 p-0 text-[#8a8f98] hover:text-red-400 rounded-lg" title="Kalıcı sil"
                        >
                          <Trash2 className="h-3.5 w-3.5" />
                        </Button>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </>
      )}

      {!domainId && (
        <Card className="bg-[#0b0c10]/50 backdrop-blur-xl border border-[#23252a]">
          <CardContent className="flex flex-col items-center justify-center py-16">
            <HardDrive className="h-12 w-12 text-[#8a8f98] mb-4" />
            <p className="text-white font-semibold">Lütfen domain seçin</p>
          </CardContent>
        </Card>
      )}

      <Dialog open={showMkdir} onOpenChange={setShowMkdir}>
        <DialogContent className="bg-[#0b0c10] border border-[#23252a] text-white max-w-sm">
          <DialogHeader><DialogTitle className="text-white text-lg font-bold">Yeni Klasör</DialogTitle></DialogHeader>
          <Input value={newName} onChange={e => setNewName(e.target.value)} placeholder="Klasör adı" className="bg-[#07080b] border-[#23252a] text-white rounded-xl" onKeyDown={e => e.key === 'Enter' && handleMkdir()} />
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowMkdir(false)} className="border-[#23252a] text-white hover:bg-[#14151a] rounded-xl">İptal</Button>
            <Button onClick={handleMkdir} disabled={submitting} className="bg-gradient-to-r from-primary to-[#828fff] text-white rounded-xl gap-2">
              {submitting ? <Loader2 className="h-4 w-4 animate-spin" /> : <FolderPlus className="h-4 w-4" />}Oluştur
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={!!showRename} onOpenChange={() => setShowRename(null)}>
        <DialogContent className="bg-[#0b0c10] border border-[#23252a] text-white max-w-sm">
          <DialogHeader><DialogTitle className="text-white text-lg font-bold">Yeniden Adlandır</DialogTitle></DialogHeader>
          <Input value={newName} onChange={e => setNewName(e.target.value)} placeholder="Yeni ad" className="bg-[#07080b] border-[#23252a] text-white rounded-xl" onKeyDown={e => e.key === 'Enter' && handleRename()} />
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowRename(null)} className="border-[#23252a] text-white hover:bg-[#14151a] rounded-xl">İptal</Button>
            <Button onClick={handleRename} disabled={submitting} className="bg-gradient-to-r from-primary to-[#828fff] text-white rounded-xl gap-2">
              {submitting ? <Loader2 className="h-4 w-4 animate-spin" /> : <Edit2 className="h-4 w-4" />}Kaydet
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={showEmptyConfirm} onOpenChange={setShowEmptyConfirm}>
        <DialogContent className="bg-[#0b0c10] border border-[#23252a] text-white max-w-sm">
          <DialogHeader><DialogTitle className="text-white text-lg font-bold flex items-center gap-2"><AlertTriangle className="h-5 w-5 text-red-400" />Çöp Kutusunu Boşalt</DialogTitle></DialogHeader>
          <p className="text-[#8a8f98] text-sm">{trashItems.length} öğenin tamamı <strong className="text-white">kalıcı olarak silinecek</strong>. Bu işlem geri alınamaz.</p>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowEmptyConfirm(false)} className="border-[#23252a] text-white hover:bg-[#14151a] rounded-xl">İptal</Button>
            <Button onClick={handleEmptyTrash} disabled={submitting} className="bg-red-700 hover:bg-red-600 text-white rounded-xl gap-2">
              {submitting ? <Loader2 className="h-4 w-4 animate-spin" /> : <Trash2 className="h-4 w-4" />}Tümünü Kalıcı Sil
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
