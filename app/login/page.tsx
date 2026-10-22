'use client';
import { useState, type FormEvent } from 'react';
import { ArrowRight, Mail, Sparkles } from 'lucide-react';
import { createClient } from '../../lib/supabase/client';

export default function Login() {
  const [email, setEmail] = useState('');
  const [message, setMessage] = useState('');
  const [busy, setBusy] = useState(false);
  const callback = () => `${window.location.origin}/auth/callback`;
  const sendLink = async (event: FormEvent) => {
    event.preventDefault(); setBusy(true); setMessage('');
    try {
      const { error } = await createClient().auth.signInWithOtp({ email: email.trim(), options: { emailRedirectTo: callback() } });
      if (error) throw error;
      setMessage('Enviamos um link de acesso para o seu e-mail. Abra-o neste dispositivo para entrar.');
    } catch (error) { setMessage(error instanceof Error ? error.message : 'Não foi possível enviar o link.'); }
    finally { setBusy(false); }
  };
  const social = async (provider: 'google' | 'github') => {
    setBusy(true); setMessage('');
    try {
      const { error } = await createClient().auth.signInWithOAuth({ provider, options: { redirectTo: callback() } });
      if (error) throw error;
    } catch (error) { setMessage(error instanceof Error ? error.message : 'Não foi possível iniciar o login.'); setBusy(false); }
  };
  return <main className="login-page"><div className="login-card"><div className="login-brand"><span className="brand-symbol"><Sparkles size={21}/></span><span>mindora<span className="brand-dot">.</span></span></div><p className="eyebrow">SEUS MAPAS, EM QUALQUER LUGAR</p><h1>Entre no seu espaço de ideias</h1><p>Seus mapas ficam salvos com segurança e aparecem no computador e no celular.</p><form onSubmit={sendLink}><label htmlFor="login-email">Seu e-mail</label><input id="login-email" type="email" autoComplete="email" required placeholder="voce@exemplo.com" value={email} onChange={event => setEmail(event.target.value)}/><button type="submit" disabled={busy}><Mail size={17}/> Enviar link de acesso <ArrowRight size={16}/></button></form><div className="login-divider">ou continue com</div><div className="login-social"><button disabled={busy} onClick={() => social('google')}>Google</button><button disabled={busy} onClick={() => social('github')}>GitHub</button></div>{message && <p className="login-message" role="status">{message}</p>}</div></main>;
}
