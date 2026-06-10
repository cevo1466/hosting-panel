'use client';

import { useState, useEffect } from 'react';
import { FileText, RefreshCw, Loader2, Search, Download, Globe, Mail, FolderOpen, Shield, Monitor } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { api, getErrorMessage } from '@/lib/api';
import { normalizeLogContent } from '@/lib/response-normalizers';
import toast from 'react-hot-toast';

interface Domain { id: string; name: string; }

const LOG_TYPES = [
  { value: 'access', label: 'Access Log', icon: Globe, needsDomain: true },
  { value: 'error', label: 'Error Log', icon: Globe, needsDomain: true },
  { value: 'mail', label: 'Mail Log', icon: Mail, needsDomain: false },
  { value: 'ftp', label: 'FTP Log', icon: FolderOpen, needsDomain: false },
  { value: 'panel', label: 'Panel Log', icon: Monitor, needsDomain: false },
  { value: 'ssl', label: 'SSL Log', icon: Shield, needsDomain: false },
];

export default function LogsPage() {
  const [domains, setDomains] = useState<Domain[]>([]);
  const [logType, setLogType] = useState('panel');
  const [domainId, setDomainId] = useState('');
  const [logContent, setLogContent] = useState('');
  const [loading, setLoading] = useState(false);
  const [search, setSearch] = useState('');

  useEffect(() => {
    api.get('/domains').then(r => {
      const list = r.data.data || [];
      setDomains(list);
      if (list.length > 0) setDomainId(list[0].id);
    }).catch(() => {});
  }, []);

  const fetchLogs = async () => {
    setLoading(true);
    try {
      const currentType = LOG_TYPES.find(t => t.value === logType);
      let url = '';
      if (currentType?.needsDomain) {
        if (!domainId) return toast.error('Lütfen domain seçin.');
        url = `/logs/domains/${domainId}/${logType}`;
      } else {
        url = `/logs/${logType}`;
      }
      const res = await api.get(url);
      setLogContent(normalizeLogContent(res.data.data) || 'Log içeriği bulunamadı.');
    } catch (err) {
      toast.error(getErrorMessage(err));
      setLogContent('');
    } finally {
      setLoading(false);
    }
  };

  const currentLogType = LOG_TYPES.find(t => t.value === logType);
  const filteredLines = logContent
    ? logContent.split('\n').filter(line => !search || line.toLowerCase().includes(search.toLowerCase()))
    : [];

  const downloadLog = () => {
    const blob = new Blob([logContent], { type: 'text/plain' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${logType}-${Date.now()}.log`;
    a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 border-b border-[#23252a]/70 pb-6">
        <div>
          <h2 className="text-3xl font-extrabold text-white tracking-tight bg-gradient-to-r from-white via-slate-200 to-slate-400 bg-clip-text text-transparent">Log Yönetimi</h2>
          <p className="text-[#8a8f98] mt-1 text-sm">Sistem, domain ve servis loglarını görüntüleyin.</p>
        </div>
      </div>

      <div className="grid grid-cols-3 sm:grid-cols-6 gap-3">
        {LOG_TYPES.map(type => {
          const Icon = type.icon;
          const isActive = logType === type.value;
          return (
            <button
              key={type.value}
              onClick={() => setLogType(type.value)}
              className={`flex flex-col items-center gap-2 p-4 rounded-xl border transition-all text-sm font-medium ${isActive ? 'bg-primary/10 border-primary/30 text-primary' : 'bg-[#0b0c10]/50 border-[#23252a] text-[#8a8f98] hover:border-[#34343a] hover:text-white'}`}
            >
              <Icon className="h-5 w-5" />
              <span className="text-[10px] text-center leading-tight">{type.label}</span>
            </button>
          );
        })}
      </div>

      <Card className="bg-[#0b0c10]/50 backdrop-blur-xl border border-[#23252a]">
        <CardContent className="p-5">
          <div className="flex flex-wrap gap-3 items-end">
            {currentLogType?.needsDomain && (
              <div className="space-y-1.5 flex-1 min-w-[200px]">
                <label className="text-xs font-semibold text-slate-300 uppercase tracking-wider">Domain</label>
                <Select value={domainId} onValueChange={setDomainId}>
                  <SelectTrigger className="bg-[#07080b] border-[#23252a] text-white rounded-xl">
                    <SelectValue placeholder="Domain seçin" />
                  </SelectTrigger>
                  <SelectContent className="bg-[#0b0c10] border-[#23252a] text-white">
                    {domains.map(d => <SelectItem key={d.id} value={d.id} className="hover:bg-[#14151a]">{d.name}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
            )}
            <Button onClick={fetchLogs} disabled={loading} className="bg-gradient-to-r from-primary to-[#828fff] text-white rounded-xl gap-2 py-5">
              {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : <FileText className="h-4 w-4" />}
              Logları Yükle
            </Button>
          </div>
        </CardContent>
      </Card>

      {logContent && (
        <Card className="bg-[#0b0c10]/50 backdrop-blur-xl border border-[#23252a]">
          <CardHeader className="pb-3">
            <div className="flex items-center justify-between flex-wrap gap-3">
              <CardTitle className="text-white text-base font-bold flex items-center gap-2">
                <FileText className="h-4 w-4 text-[#8a8f98]" />
                {currentLogType?.label}
                <Badge variant="outline" className="bg-[#14151a] text-[#8a8f98] border-[#23252a] text-[10px]">{filteredLines.length} satır</Badge>
              </CardTitle>
              <div className="flex gap-3 items-center">
                <div className="relative">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-[#8a8f98]" />
                  <Input
                    value={search}
                    onChange={e => setSearch(e.target.value)}
                    placeholder="Ara..."
                    className="pl-9 bg-[#07080b] border-[#23252a] text-white rounded-lg text-sm h-8 w-48"
                  />
                </div>
                <Button onClick={downloadLog} variant="outline" className="border-[#23252a] hover:bg-[#14151a] text-white rounded-xl h-8 text-xs gap-1.5">
                  <Download className="h-3.5 w-3.5" />İndir
                </Button>
              </div>
            </div>
          </CardHeader>
          <CardContent className="p-0">
            <div className="bg-[#030405] border-t border-[#23252a]/50 rounded-b-xl overflow-hidden">
              <div className="overflow-auto max-h-[500px] p-4">
                <pre className="text-xs font-mono text-[#8a8f98] leading-relaxed whitespace-pre-wrap">
                  {filteredLines.map((line, i) => {
                    const isError = line.toLowerCase().includes('error') || line.toLowerCase().includes('crit');
                    const isWarn = line.toLowerCase().includes('warn');
                    return (
                      <div key={i} className={`hover:bg-[#0a0b0f] px-2 py-0.5 rounded ${isError ? 'text-red-400' : isWarn ? 'text-yellow-400' : ''}`}>
                        <span className="text-[#3a3c45] select-none mr-4">{i + 1}</span>
                        {line}
                      </div>
                    );
                  })}
                  {filteredLines.length === 0 && <span className="text-[#8a8f98]">Sonuç bulunamadı.</span>}
                </pre>
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      {!logContent && !loading && (
        <Card className="bg-[#0b0c10]/50 backdrop-blur-xl border border-[#23252a]">
          <CardContent className="flex flex-col items-center justify-center py-16">
            <FileText className="h-12 w-12 text-[#8a8f98] mb-4" />
            <p className="text-white font-semibold">Log türü seçin ve yükleyin</p>
            <p className="text-[#8a8f98] text-sm mt-1">Yukarıdan log türünü seçip "Logları Yükle" butonuna tıklayın.</p>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
