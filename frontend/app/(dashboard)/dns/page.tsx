'use client';

import { useState, useEffect } from 'react';
import { Network, Plus, Trash2, Edit2, RefreshCw, Loader2, Search } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { api, getErrorMessage } from '@/lib/api';
import toast from 'react-hot-toast';

interface DNSRecord {
  id: string;
  domain: string;
  type: string;
  name: string;
  value: string;
  ttl: number;
  priority?: number;
  domainId?: string;
}

interface Domain { id: string; name: string; }

const DNS_TYPES = ['A', 'AAAA', 'CNAME', 'MX', 'TXT', 'NS', 'SRV', 'CAA'];

const typeColors: Record<string, string> = {
  A: 'bg-cyan-950/20 text-cyan-400 border-cyan-900/30',
  AAAA: 'bg-blue-950/20 text-blue-400 border-blue-900/30',
  CNAME: 'bg-purple-950/20 text-purple-400 border-purple-900/30',
  MX: 'bg-orange-950/20 text-orange-400 border-orange-900/30',
  TXT: 'bg-yellow-950/20 text-yellow-400 border-yellow-900/30',
  NS: 'bg-green-950/20 text-green-400 border-green-900/30',
  SRV: 'bg-pink-950/20 text-pink-400 border-pink-900/30',
  CAA: 'bg-red-950/20 text-red-400 border-red-900/30',
};

export default function DNSPage() {
  const [records, setRecords] = useState<DNSRecord[]>([]);
  const [domains, setDomains] = useState<Domain[]>([]);
  const [selectedDomainId, setSelectedDomainId] = useState('');
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [filterType, setFilterType] = useState('ALL');
  const [showAdd, setShowAdd] = useState(false);
  const [editRecord, setEditRecord] = useState<DNSRecord | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [form, setForm] = useState({ type: 'A', name: '', value: '', ttl: '3600', priority: '' });

  const fetchDomains = async () => {
    try {
      const res = await api.get('/domains');
      const list = res.data.data || [];
      setDomains(list);
      if (list.length > 0 && !selectedDomainId) setSelectedDomainId(list[0].id);
    } catch (err) {
      toast.error(getErrorMessage(err));
    }
  };

  const fetchRecords = async (domainId?: string) => {
    const id = domainId || selectedDomainId;
    if (!id) return;
    setLoading(true);
    try {
      const res = await api.get(`/dns/${id}`);
      const zone = res.data.data;
      setRecords((zone?.records || []).map((r: DNSRecord) => ({ ...r, domainId: id })));
    } catch (err) {
      toast.error(getErrorMessage(err));
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { fetchDomains(); }, []);
  useEffect(() => { if (selectedDomainId) fetchRecords(selectedDomainId); }, [selectedDomainId]);

  const handleAdd = async () => {
    if (!form.name || !form.value || !selectedDomainId) return toast.error('Zorunlu alanları doldurun.');
    setSubmitting(true);
    try {
      const payload = {
        domainId: selectedDomainId,
        type: form.type,
        name: form.name,
        value: form.value,
        ttl: parseInt(form.ttl) || 3600,
        priority: form.priority ? parseInt(form.priority) : undefined,
      };
      if (editRecord) {
        await api.put(`/dns/${selectedDomainId}/records/${editRecord.id}`, payload);
        toast.success('DNS kaydı güncellendi.');
      } else {
        await api.post(`/dns/${selectedDomainId}/records`, payload);
        toast.success('DNS kaydı eklendi.');
      }
      setShowAdd(false);
      setEditRecord(null);
      setForm({ type: 'A', name: '', value: '', ttl: '3600', priority: '' });
      fetchRecords();
    } catch (err) {
      toast.error(getErrorMessage(err));
    } finally {
      setSubmitting(false);
    }
  };

  const handleEdit = (record: DNSRecord) => {
    setEditRecord(record);
    setForm({ type: record.type, name: record.name, value: record.value, ttl: String(record.ttl), priority: record.priority ? String(record.priority) : '' });
    setShowAdd(true);
  };

  const handleDelete = async (record: DNSRecord) => {
    if (!confirm(`"${record.name}" DNS kaydını silmek istediğinizden emin misiniz?`)) return;
    setDeletingId(record.id);
    try {
      await api.delete(`/dns/${record.domainId || selectedDomainId}/records/${record.id}`);
      toast.success('DNS kaydı silindi.');
      setRecords(prev => prev.filter(r => r.id !== record.id));
    } catch (err) {
      toast.error(getErrorMessage(err));
    } finally {
      setDeletingId(null);
    }
  };

  const filtered = records.filter(r => {
    const matchType = filterType === 'ALL' || r.type === filterType;
    const matchSearch = !search || r.name.toLowerCase().includes(search.toLowerCase()) || r.value.toLowerCase().includes(search.toLowerCase());
    return matchType && matchSearch;
  });

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 border-b border-[#23252a]/70 pb-6">
        <div>
          <h2 className="text-3xl font-extrabold text-white tracking-tight bg-gradient-to-r from-white via-slate-200 to-slate-400 bg-clip-text text-transparent">DNS Yönetimi</h2>
          <p className="text-[#8a8f98] mt-1 text-sm">Domain DNS zone kayıtlarını yönetin.</p>
        </div>
        <div className="flex gap-3">
          <Button onClick={() => fetchRecords()} variant="outline" className="border-[#23252a] hover:bg-[#14151a] text-white rounded-xl"><RefreshCw className="h-4 w-4" /></Button>
          <Button onClick={() => { setEditRecord(null); setForm({ type: 'A', name: '', value: '', ttl: '3600', priority: '' }); setShowAdd(true); }} className="bg-gradient-to-r from-primary to-[#828fff] hover:from-[#828fff] hover:to-[#5e6ad2] text-white rounded-xl py-5 px-5 gap-2">
            <Plus className="h-4 w-4" />DNS Kaydı Ekle
          </Button>
        </div>
      </div>

      <div className="flex flex-wrap gap-3">
        <Select value={selectedDomainId} onValueChange={setSelectedDomainId}>
          <SelectTrigger className="w-56 bg-[#07080b] border-[#23252a] text-white rounded-xl">
            <SelectValue placeholder="Domain seçin" />
          </SelectTrigger>
          <SelectContent className="bg-[#0b0c10] border-[#23252a] text-white">
            {domains.map(d => <SelectItem key={d.id} value={d.id} className="hover:bg-[#14151a]">{d.name}</SelectItem>)}
          </SelectContent>
        </Select>
        <div className="relative flex-1 min-w-[200px]">
          <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 h-4 w-4 text-[#8a8f98]" />
          <Input value={search} onChange={e => setSearch(e.target.value)} placeholder="Ad veya değer ara..." className="pl-11 bg-[#0b0c10]/60 border-[#23252a] text-white rounded-xl placeholder-[#62666d]" />
        </div>
        <div className="flex gap-2 flex-wrap">
          {['ALL', ...DNS_TYPES].map(t => (
            <button key={t} onClick={() => setFilterType(t)} className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-all border ${filterType === t ? 'bg-primary text-white border-primary' : 'border-[#23252a] text-[#8a8f98] hover:text-white hover:border-[#34343a]'}`}>{t}</button>
          ))}
        </div>
      </div>

      {loading ? (
        <div className="flex items-center justify-center py-20"><Loader2 className="h-8 w-8 animate-spin text-primary" /></div>
      ) : (
        <Card className="bg-[#0b0c10]/50 backdrop-blur-xl border border-[#23252a]">
          <CardContent className="p-0">
            <div className="grid grid-cols-12 gap-2 px-5 py-2.5 text-[10px] font-semibold text-[#8a8f98] uppercase tracking-wider border-b border-[#23252a]/50">
              <div className="col-span-2">Tür</div>
              <div className="col-span-3">Ad</div>
              <div className="col-span-4">Değer</div>
              <div className="col-span-1">TTL</div>
              <div className="col-span-2 text-right">İşlemler</div>
            </div>
            <div className="divide-y divide-[#23252a]/50">
              {filtered.map((record) => (
                <div key={record.id} className="grid grid-cols-12 gap-2 px-5 py-3.5 items-center hover:bg-[#0a0b10]/50 transition-colors group">
                  <div className="col-span-2">
                    <Badge variant="outline" className={`${typeColors[record.type] || 'bg-[#14151a] text-[#8a8f98] border-[#23252a]'} text-[10px] font-bold`}>{record.type}</Badge>
                  </div>
                  <div className="col-span-3 text-sm text-white font-mono truncate">{record.name}</div>
                  <div className="col-span-4 text-sm text-[#8a8f98] font-mono truncate">
                    {record.priority ? `[${record.priority}] ` : ''}{record.value}
                  </div>
                  <div className="col-span-1 text-xs text-[#8a8f98] font-mono">{record.ttl}s</div>
                  <div className="col-span-2 flex items-center justify-end gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                    <Button onClick={() => handleEdit(record)} variant="ghost" className="h-7 w-7 p-0 text-[#8a8f98] hover:text-white rounded-lg"><Edit2 className="h-3.5 w-3.5" /></Button>
                    <Button onClick={() => handleDelete(record)} disabled={deletingId === record.id} variant="ghost" className="h-7 w-7 p-0 text-[#8a8f98] hover:text-red-400 rounded-lg">
                      {deletingId === record.id ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Trash2 className="h-3.5 w-3.5" />}
                    </Button>
                  </div>
                </div>
              ))}
              {filtered.length === 0 && (
                <div className="flex flex-col items-center justify-center py-12 text-center">
                  <Network className="h-10 w-10 text-[#8a8f98] mb-3" />
                  <p className="text-white font-semibold">DNS kaydı bulunamadı</p>
                </div>
              )}
            </div>
          </CardContent>
        </Card>
      )}

      <Dialog open={showAdd} onOpenChange={(v) => { setShowAdd(v); if (!v) { setEditRecord(null); setForm({ type: 'A', name: '', value: '', ttl: '3600', priority: '' }); } }}>
        <DialogContent className="bg-[#0b0c10] border border-[#23252a] text-white max-w-md">
          <DialogHeader><DialogTitle className="text-white text-lg font-bold">{editRecord ? 'DNS Kaydını Düzenle' : 'DNS Kaydı Ekle'}</DialogTitle></DialogHeader>
          <div className="space-y-4 py-2">
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <label className="text-xs font-semibold text-slate-300 uppercase tracking-wider">Kayıt Türü</label>
                <Select value={form.type} onValueChange={(v) => setForm({ ...form, type: v })}>
                  <SelectTrigger className="bg-[#07080b] border-[#23252a] text-white rounded-xl"><SelectValue /></SelectTrigger>
                  <SelectContent className="bg-[#0b0c10] border-[#23252a] text-white">
                    {DNS_TYPES.map(t => <SelectItem key={t} value={t} className="hover:bg-[#14151a]">{t}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1.5">
                <label className="text-xs font-semibold text-slate-300 uppercase tracking-wider">TTL (sn)</label>
                <Input value={form.ttl} onChange={e => setForm({ ...form, ttl: e.target.value })} placeholder="3600" type="number" className="bg-[#07080b] border-[#23252a] text-white rounded-xl" />
              </div>
            </div>
            <div className="space-y-1.5">
              <label className="text-xs font-semibold text-slate-300 uppercase tracking-wider">Ad (Host)</label>
              <Input value={form.name} onChange={e => setForm({ ...form, name: e.target.value })} placeholder="@ veya subdomain" className="bg-[#07080b] border-[#23252a] text-white rounded-xl font-mono" />
            </div>
            <div className="space-y-1.5">
              <label className="text-xs font-semibold text-slate-300 uppercase tracking-wider">Değer (Value)</label>
              <Input value={form.value} onChange={e => setForm({ ...form, value: e.target.value })} placeholder="IP adresi, domain veya içerik" className="bg-[#07080b] border-[#23252a] text-white rounded-xl font-mono" />
            </div>
            {(form.type === 'MX' || form.type === 'SRV') && (
              <div className="space-y-1.5">
                <label className="text-xs font-semibold text-slate-300 uppercase tracking-wider">Öncelik (Priority)</label>
                <Input value={form.priority} onChange={e => setForm({ ...form, priority: e.target.value })} placeholder="10" type="number" className="bg-[#07080b] border-[#23252a] text-white rounded-xl" />
              </div>
            )}
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowAdd(false)} className="border-[#23252a] text-white hover:bg-[#14151a] rounded-xl">İptal</Button>
            <Button onClick={handleAdd} disabled={submitting} className="bg-gradient-to-r from-primary to-[#828fff] text-white rounded-xl gap-2">
              {submitting ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
              {editRecord ? 'Güncelle' : 'Ekle'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
