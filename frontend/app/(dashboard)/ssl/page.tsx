'use client';

import { useState, useEffect } from 'react';
import { Shield, Plus, Trash2, RefreshCw, Loader2, AlertTriangle, CheckCircle, Clock } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Input } from '@/components/ui/input';
import { api, getErrorMessage } from '@/lib/api';
import toast from 'react-hot-toast';

interface SSLCert {
  id: string;
  domain: string;
  issuer: string;
  validFrom: string;
  validTo: string;
  status: 'active' | 'expired' | 'pending' | 'revoked';
  autoRenew: boolean;
  type: string;
  domainId: string;
}

interface Domain {
  id: string;
  name: string;
  sslEnabled?: boolean;
  sslCertificate?: { status: string } | null;
}

export default function SSLPage() {
  const [certs, setCerts] = useState<SSLCert[]>([]);
  const [domains, setDomains] = useState<Domain[]>([]);
  const [loading, setLoading] = useState(true);
  const [showInstall, setShowInstall] = useState(false);
  const [form, setForm] = useState({ domainId: '', email: '' });
  const [submitting, setSubmitting] = useState(false);
  const [renewingId, setRenewingId] = useState<string | null>(null);
  const [deletingId, setDeletingId] = useState<string | null>(null);

  const fetchData = async () => {
    try {
      setLoading(true);
      const [certsRes, domsRes] = await Promise.all([api.get('/ssl'), api.get('/domains')]);
      // Backend şekli (commonName, issuedAt, expiresAt, provider, domain: {name}) ile
      // bu sayfanın beklediği şekli (domain string, validFrom/validTo, type) eşle.
      // domain bir OBJE gelirse JSX'e basınca React çöker — burada string'e indirilir.
      const mapped = (certsRes.data.data || []).map((c: any) => ({
        id: c.id,
        domain: (c.domain && typeof c.domain === 'object' ? c.domain.name : c.domain) || c.commonName || '-',
        issuer: c.issuer || "Let's Encrypt",
        validFrom: c.issuedAt || c.validFrom || null,
        validTo: c.expiresAt || c.validTo || null,
        status: c.status || 'active',
        autoRenew: c.autoRenew ?? true,
        type: c.provider || c.type || 'letsencrypt',
        domainId: c.domainId,
      }));
      setCerts(mapped);
      setDomains(domsRes.data.data || []);
    } catch (err) {
      toast.error(getErrorMessage(err));
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { fetchData(); }, []);

  const handleInstall = async () => {
    if (!form.domainId) return toast.error('Lütfen domain seçin.');
    setSubmitting(true);
    try {
      await api.post('/ssl/install', { domainId: form.domainId, email: form.email || undefined });
      toast.success('SSL kurulumu başlatıldı. Bu işlem birkaç dakika sürebilir.');
      setShowInstall(false);
      setForm({ domainId: '', email: '' });
      fetchData();
    } catch (err) {
      toast.error(getErrorMessage(err));
    } finally {
      setSubmitting(false);
    }
  };

  const handleRenew = async (cert: SSLCert) => {
    setRenewingId(cert.id);
    try {
      await api.post(`/ssl/${cert.id}/renew`);
      toast.success('SSL sertifikası yenileme başlatıldı.');
      fetchData();
    } catch (err) {
      toast.error(getErrorMessage(err));
    } finally {
      setRenewingId(null);
    }
  };

  const handleRevoke = async (cert: SSLCert) => {
    if (!confirm(`"${cert.domain}" için SSL sertifikasını iptal etmek istediğinizden emin misiniz?`)) return;
    setDeletingId(cert.id);
    try {
      await api.delete(`/ssl/${cert.id}`);
      toast.success('SSL sertifikası iptal edildi.');
      setCerts((prev) => prev.filter((c) => c.id !== cert.id));
    } catch (err) {
      toast.error(getErrorMessage(err));
    } finally {
      setDeletingId(null);
    }
  };

  const daysLeft = (validTo: string) => {
    const diff = new Date(validTo).getTime() - Date.now();
    return Math.ceil(diff / (1000 * 60 * 60 * 24));
  };

  const statusConfig = {
    active: { label: 'Aktif', class: 'bg-emerald-950/20 text-emerald-400 border-emerald-900/30', icon: CheckCircle },
    expired: { label: 'Süresi Dolmuş', class: 'bg-red-950/20 text-red-400 border-red-900/30', icon: AlertTriangle },
    pending: { label: 'Beklemede', class: 'bg-yellow-950/20 text-yellow-400 border-yellow-900/30', icon: Clock },
    revoked: { label: 'İptal Edildi', class: 'bg-[#23252a] text-[#8a8f98] border-[#23252a]', icon: AlertTriangle },
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 border-b border-[#23252a]/70 pb-6">
        <div>
          <h2 className="text-3xl font-extrabold text-white tracking-tight bg-gradient-to-r from-white via-slate-200 to-slate-400 bg-clip-text text-transparent">
            SSL Sertifikaları
          </h2>
          <p className="text-[#8a8f98] mt-1 text-sm">Let's Encrypt SSL kurulumu, yenileme ve yönetimi.</p>
        </div>
        <div className="flex gap-3">
          <Button onClick={fetchData} variant="outline" className="border-[#23252a] hover:bg-[#14151a] text-white rounded-xl">
            <RefreshCw className="h-4 w-4" />
          </Button>
          <Button onClick={() => setShowInstall(true)} className="bg-gradient-to-r from-primary to-[#828fff] hover:from-[#828fff] hover:to-[#5e6ad2] text-white rounded-xl py-5 px-5 gap-2">
            <Plus className="h-4 w-4" />
            SSL Kur
          </Button>
        </div>
      </div>

      {loading ? (
        <div className="flex items-center justify-center py-20">
          <Loader2 className="h-8 w-8 animate-spin text-primary" />
        </div>
      ) : certs.length === 0 ? (
        <Card className="bg-[#0b0c10]/50 backdrop-blur-xl border border-[#23252a]">
          <CardContent className="flex flex-col items-center justify-center py-16 text-center">
            <Shield className="h-12 w-12 text-[#8a8f98] mb-4" />
            <p className="text-white font-semibold text-lg">SSL sertifikası bulunamadı</p>
            <p className="text-[#8a8f98] text-sm mt-1">Domainleriniz için ücretsiz Let's Encrypt SSL kurun.</p>
          </CardContent>
        </Card>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
          {certs.map((cert) => {
            const days = daysLeft(cert.validTo);
            const cfg = statusConfig[cert.status] || statusConfig.active;
            const StatusIcon = cfg.icon;
            return (
              <Card key={cert.id} className="bg-[#0b0c10]/50 backdrop-blur-xl border border-[#23252a] hover:border-[#34343a] transition-all relative overflow-hidden">
                {days <= 14 && cert.status === 'active' && (
                  <div className="absolute top-0 left-0 right-0 h-[2px] bg-gradient-to-r from-yellow-400 to-orange-400" />
                )}
                {cert.status === 'active' && days > 14 && (
                  <div className="absolute top-0 left-0 right-0 h-[2px] bg-gradient-to-r from-emerald-500 to-cyan-500" />
                )}
                <CardHeader className="pb-3">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      <div className="h-10 w-10 rounded-xl bg-emerald-950/20 border border-emerald-800/30 flex items-center justify-center">
                        <Shield className="h-5 w-5 text-emerald-400" />
                      </div>
                      <div>
                        <CardTitle className="text-white text-base font-bold">{cert.domain}</CardTitle>
                        <CardDescription className="text-[#8a8f98] text-xs">{cert.issuer || "Let's Encrypt"}</CardDescription>
                      </div>
                    </div>
                    <Badge variant="outline" className={`${cfg.class} text-[10px] flex items-center gap-1`}>
                      <StatusIcon className="h-3 w-3" />
                      {cfg.label}
                    </Badge>
                  </div>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="grid grid-cols-2 gap-4 text-xs">
                    <div>
                      <span className="text-[#8a8f98] block uppercase tracking-wider font-semibold mb-1">Başlangıç</span>
                      <span className="text-slate-300 font-mono">{cert.validFrom ? new Date(cert.validFrom).toLocaleDateString('tr-TR') : '-'}</span>
                    </div>
                    <div>
                      <span className="text-[#8a8f98] block uppercase tracking-wider font-semibold mb-1">Bitiş</span>
                      <span className={`font-mono ${days <= 14 ? 'text-yellow-400' : 'text-slate-300'}`}>
                        {cert.validTo ? new Date(cert.validTo).toLocaleDateString('tr-TR') : '-'}
                        {cert.status === 'active' && <span className="ml-1 text-[10px]">({days} gün)</span>}
                      </span>
                    </div>
                    <div>
                      <span className="text-[#8a8f98] block uppercase tracking-wider font-semibold mb-1">Tür</span>
                      <span className="text-slate-300 font-mono">{cert.type === 'letsencrypt' ? "Let's Encrypt" : 'Özel'}</span>
                    </div>
                    <div>
                      <span className="text-[#8a8f98] block uppercase tracking-wider font-semibold mb-1">Otomatik Yenileme</span>
                      <Badge variant="outline" className={cert.autoRenew ? 'bg-emerald-950/20 text-emerald-400 border-emerald-900/30 text-[10px]' : 'bg-[#14151a] text-[#8a8f98] border-[#23252a] text-[10px]'}>
                        {cert.autoRenew ? 'Açık' : 'Kapalı'}
                      </Badge>
                    </div>
                  </div>
                  <div className="flex gap-2.5 pt-2 border-t border-[#23252a]/50">
                    <Button
                      onClick={() => handleRenew(cert)}
                      disabled={renewingId === cert.id}
                      variant="outline"
                      className="flex-1 border-[#23252a] hover:bg-[#14151a] text-white hover:text-white rounded-xl text-xs gap-1.5"
                    >
                      {renewingId === cert.id ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <RefreshCw className="h-3.5 w-3.5" />}
                      Yenile
                    </Button>
                    <Button
                      onClick={() => handleRevoke(cert)}
                      disabled={deletingId === cert.id}
                      variant="ghost"
                      className="h-9 w-9 p-0 text-red-400 hover:text-red-300 hover:bg-red-950/20 rounded-xl"
                    >
                      {deletingId === cert.id ? <Loader2 className="h-4 w-4 animate-spin" /> : <Trash2 className="h-4 w-4" />}
                    </Button>
                  </div>
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}

      <Dialog open={showInstall} onOpenChange={setShowInstall}>
        <DialogContent className="bg-[#0b0c10] border border-[#23252a] text-white max-w-md">
          <DialogHeader>
            <DialogTitle className="text-white text-lg font-bold">SSL Sertifikası Kur</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <div className="space-y-1.5">
              <label className="text-xs font-semibold text-slate-300 uppercase tracking-wider">Domain</label>
              <Select value={form.domainId} onValueChange={(v) => setForm({ ...form, domainId: v })}>
                <SelectTrigger className="bg-[#07080b] border-[#23252a] text-white rounded-xl">
                  <SelectValue placeholder="Domain seçin" />
                </SelectTrigger>
                <SelectContent className="bg-[#0b0c10] border-[#23252a] text-white">
                  {domains.filter(d => !d.sslCertificate && !d.sslEnabled).map((d) => (
                    <SelectItem key={d.id} value={d.id} className="hover:bg-[#14151a]">{d.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <label className="text-xs font-semibold text-slate-300 uppercase tracking-wider">E-posta (Opsiyonel)</label>
              <Input
                value={form.email}
                onChange={(e) => setForm({ ...form, email: e.target.value })}
                placeholder="ssl-bildirim@example.com"
                type="email"
                className="bg-[#07080b] border-[#23252a] text-white rounded-xl"
              />
            </div>
            <div className="bg-[#0a0b10] border border-[#23252a]/60 rounded-xl p-4 text-xs text-[#8a8f98] space-y-1">
              <p>• DNS kayıtlarınızın doğru yapılandırıldığından emin olun.</p>
              <p>• www ve non-www versiyonları için SSL kurulacaktır.</p>
              <p>• Let's Encrypt sertifikaları ücretsiz ve otomatik yenilenir.</p>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowInstall(false)} className="border-[#23252a] text-white hover:bg-[#14151a] rounded-xl">İptal</Button>
            <Button onClick={handleInstall} disabled={submitting} className="bg-gradient-to-r from-primary to-[#828fff] text-white rounded-xl gap-2">
              {submitting ? <Loader2 className="h-4 w-4 animate-spin" /> : <Shield className="h-4 w-4" />}
              SSL Kur
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
