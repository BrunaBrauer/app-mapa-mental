'use client';
import { useState, type FormEvent } from 'react';
import { LockKeyhole, Sparkles } from 'lucide-react';
import { createClient } from '../../lib/supabase/client';
import { useRouter } from 'next/navigation';

export default function ResetPassword() {
  const router = useRouter();
  const [password, setPassword] = useState('');
  const [repeat, setRepeat] = useState('');
  const [message, setMessage] = useState('');
  const [busy, setBusy] = useState(false);
  const submit = async (event: FormEvent) => {
    event.preventDefault();
    if (password !== repeat) { setMessage('As senhas não coincidem.'); return; }
    setBusy(true); setMessage('');
    try {
      const client = createClient();
      const { data: { user } } = await client.auth.getUser();
      if (!user) throw new Error('Este link expirou. Peça outro link na tela de login.');
      const { error } = await client.auth.updateUser({ password });
      if (error) throw error;
      router.push('/'); router.refresh();
    } catch (error) { setMessage(error instanceof Error ? error.message : 'Não foi possível alterar a senha.'); setBusy(false); }
  };
  return <main className="login-page"><div className="login-card"><div className="login-brand"><span className="brand-symbol"><Sparkles size={21}/></span><span>nodum<span className="brand-dot">.</span></span></div><h1>Crie uma nova senha</h1><p>Use pelo menos 8 caracteres. O link de recuperação só funciona uma vez.</p><form onSubmit={submit}><label htmlFor="new-password">Nova senha</label><input id="new-password" type="password" autoComplete="new-password" minLength={8} required value={password} onChange={e => setPassword(e.target.value)}/><label htmlFor="repeat-password">Repita a senha</label><input id="repeat-password" type="password" autoComplete="new-password" minLength={8} required value={repeat} onChange={e => setRepeat(e.target.value)}/><button disabled={busy}><LockKeyhole size={17}/> Salvar nova senha</button></form>{message && <p className="login-message" role="status">{message}</p>}</div></main>;
}
