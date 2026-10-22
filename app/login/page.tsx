'use client';
import { useState, type FormEvent } from 'react';
import { ArrowRight, LockKeyhole, Mail, Sparkles } from 'lucide-react';
import { createClient } from '../../lib/supabase/client';
import { useRouter } from 'next/navigation';

type Mode = 'login' | 'signup' | 'reset' | 'magic';
function authMessage(error: unknown) {
  const code = error && typeof error === 'object' && 'code' in error ? String(error.code) : '';
  const messages: Record<string, string> = { invalid_credentials: 'E-mail ou senha incorretos.', email_not_confirmed: 'Confirme seu e-mail antes de entrar.', user_already_exists: 'Este e-mail já tem uma conta.', over_email_send_rate_limit: 'Muitos e-mails enviados. Tente novamente mais tarde.', weak_password: 'Escolha uma senha mais forte.' };
  return messages[code] || (error instanceof Error ? error.message : 'Não foi possível continuar.');
}
export default function Login() {
  const router = useRouter();
  const googleEnabled = process.env.NEXT_PUBLIC_ENABLE_GOOGLE_AUTH === 'true';
  const githubEnabled = process.env.NEXT_PUBLIC_ENABLE_GITHUB_AUTH === 'true';
  const [mode, setMode] = useState<Mode>('login');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [message, setMessage] = useState('');
  const [busy, setBusy] = useState(false);
  const callback = () => `${window.location.origin}/auth/callback`;
  const changeMode = (next: Mode) => { setMode(next); setMessage(''); setPassword(''); };
  const submit = async (event: FormEvent) => {
    event.preventDefault(); setBusy(true); setMessage('');
    try {
      const auth = createClient().auth;
      const address = email.trim().toLowerCase();
      if (mode === 'reset') {
        const { error } = await auth.resetPasswordForEmail(address, { redirectTo: `${window.location.origin}/auth/recovery` });
        if (error) throw error;
        setMessage('Se houver uma conta para este e-mail, enviaremos um link para redefinir a senha.');
      } else if (mode === 'magic') {
        const { error } = await auth.signInWithOtp({ email: address, options: { emailRedirectTo: callback(), shouldCreateUser: false } });
        if (error) throw error;
        setMessage('Se houver uma conta para este e-mail, enviaremos um link de acesso.');
      } else if (mode === 'signup') {
        if (password.length < 8) throw new Error('Use uma senha com pelo menos 8 caracteres.');
        const { data, error } = await auth.signUp({ email: address, password, options: { emailRedirectTo: callback() } });
        if (error) throw error;
        if (data.session) { router.push('/'); router.refresh(); }
        else setMessage('Conta criada. Verifique o e-mail para confirmar o cadastro e entrar.');
      } else {
        const { error } = await auth.signInWithPassword({ email: address, password });
        if (error) throw error;
        router.push('/'); router.refresh();
      }
    } catch (error) { setMessage(authMessage(error)); }
    finally { setBusy(false); }
  };
  const social = async (provider: 'google' | 'github') => {
    setBusy(true); setMessage('');
    try {
      const { error } = await createClient().auth.signInWithOAuth({ provider, options: { redirectTo: callback() } });
      if (error) throw error;
    } catch (error) { setMessage(error instanceof Error ? error.message : 'Não foi possível iniciar o login.'); setBusy(false); }
  };
  const title = { login: 'Entre no seu espaço de ideias', signup: 'Crie sua conta', reset: 'Redefina sua senha', magic: 'Entre com um link' }[mode];
  return <main className="login-page"><div className="login-card"><div className="login-brand"><span className="brand-symbol"><Sparkles size={21}/></span><span>nodum<span className="brand-dot">.</span></span></div><p className="eyebrow">SEUS MAPAS, EM QUALQUER LUGAR</p><h1>{title}</h1><p>Seus mapas ficam salvos na sua conta e aparecem no computador e no celular.</p><form onSubmit={submit}><label htmlFor="login-email">Seu e-mail</label><input id="login-email" type="email" autoComplete="email" required placeholder="voce@exemplo.com" value={email} onChange={event => setEmail(event.target.value)}/>{(mode === 'login' || mode === 'signup') && <><label htmlFor="login-password">Senha</label><input id="login-password" type="password" autoComplete={mode === 'signup' ? 'new-password' : 'current-password'} minLength={mode === 'signup' ? 8 : undefined} required value={password} onChange={event => setPassword(event.target.value)} placeholder={mode === 'signup' ? 'Mínimo de 8 caracteres' : 'Sua senha'}/></>}<button type="submit" disabled={busy}>{mode === 'reset' || mode === 'magic' ? <Mail size={17}/> : <LockKeyhole size={17}/>} {({ login: 'Entrar', signup: 'Criar conta', reset: 'Enviar link de recuperação', magic: 'Enviar link de acesso' })[mode]} <ArrowRight size={16}/></button></form><div className="login-links">{mode === 'login' ? <><button onClick={() => changeMode('signup')}>Criar conta</button><button onClick={() => changeMode('reset')}>Esqueci minha senha</button><button onClick={() => changeMode('magic')}>Entrar sem senha</button></> : <button onClick={() => changeMode('login')}>Voltar para entrar</button>}</div>{(googleEnabled || githubEnabled) && <><div className="login-divider">ou continue com</div><div className="login-social">{googleEnabled && <button disabled={busy} onClick={() => social('google')}>Google</button>}{githubEnabled && <button disabled={busy} onClick={() => social('github')}>GitHub</button>}</div></>}{message && <p className="login-message" role="status">{message}</p>}</div></main>;
}
