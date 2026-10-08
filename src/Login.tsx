import {useState} from 'react';
import {Building2,ShieldCheck,ArrowRight} from 'lucide-react';
import {api,type User,type Row} from './api';
import {ErrorBox} from './ui';

export function Login({onLogin}:{onLogin:(u:User)=>void}){
  const resetToken=location.hash.startsWith('#reset=')?location.hash.slice(7):'';
  const [mode,setMode]=useState(resetToken?'reset':'login'),[challenge,setChallenge]=useState(''),[error,setError]=useState(''),[message,setMessage]=useState(''),[busy,setBusy]=useState(false);
  async function submit(e:React.FormEvent<HTMLFormElement>){
    e.preventDefault();setBusy(true);setError('');setMessage('');const data=Object.fromEntries(new FormData(e.currentTarget));
    try{
      if(mode==='forgot'){const r=await api('/auth/reset/request','POST',{email:data.email});setMessage(r.message);}
      else if(mode==='reset'){await api('/auth/reset/confirm','POST',{token:resetToken,password:data.password});window.dispatchEvent(new Event('society-session-expired'));location.hash='overview';setMode('login');setMessage('Password updated. Sign in with your new password and authenticator.');}
      else{
        const result=await api<Row>(challenge?'/auth/mfa/login':'/auth/login','POST',challenge?{challenge,code:data.code}:data);
        if(result.mfa_required)setChallenge(result.challenge);else onLogin(result as User);
      }
    }catch(e){setError((e as Error).message);}finally{setBusy(false);}
  }
  return <main className="login-page"><section className="login-story"><a className="brand" href="#"><span className="brand-mark"><Building2 size={26}/></span><span>NAYANTRA<small>SOCIETY</small></span></a><div><span className="hero-tag"><ShieldCheck size={15}/> BUILT AROUND YOUR COMMUNITY</span><h1>Every home.<br/>Every arrival.<br/><em>One connected society.</em></h1><p>Gate access, residents, staff and everyday society life, connected in one secure workspace.</p><div className="login-features"><span><ShieldCheck size={18}/> Verified accounts</span><span><Building2 size={18}/> Connected community</span></div></div><small>Nayantra Society · Your independent society workspace</small><div className="login-decoration" aria-hidden="true"/></section><section className="login-form-side"><div className="login-form"><span className="login-overline">WELCOME HOME</span><h2>{mode==='forgot'?'Recover your account':mode==='reset'?'Set a new password':challenge?'Verify your sign-in':'Sign in to your society'}</h2><p>{challenge?'Enter your authenticator code or one unused recovery code.':'Use the individual account provided by your administrator.'}</p><form onSubmit={submit} key={mode+challenge}>
  {mode==='forgot'?<label className="field"><span>Verified email address</span><input name="email" type="email" required autoComplete="email"/></label>:challenge?<label className="field"><span>Authenticator / recovery code</span><input name="code" required autoComplete="one-time-code" maxLength={80}/></label>:<>{mode==='login'&&<label className="field"><span>Username or email</span><input name="username" required autoComplete="username"/></label>}<label className="field"><span>{mode==='reset'?'New password (12+ characters)':'Password'}</span><input name="password" type="password" required minLength={mode==='reset'?12:1} maxLength={128} autoComplete={mode==='reset'?'new-password':'current-password'}/></label></>}
  <ErrorBox message={error}/>{message&&<p className="success-note" role="status">{message}</p>}<button className="button primary full-button" disabled={busy}>{busy?'Please wait…':mode==='forgot'?'Email reset link':mode==='reset'?'Update password':challenge?'Verify sign-in':'Sign in'}<ArrowRight size={18}/></button></form><div className="login-help"><button className="button" onClick={()=>{setMode(mode==='login'?'forgot':'login');setChallenge('');setError('');setMessage('');}}>{mode==='login'?'Forgot password?':'Back to sign in'}</button>{challenge&&<button className="button" onClick={()=>setChallenge('')}>Restart sign-in</button>}</div><div className="login-lock"><ShieldCheck size={17}/> Access follows your verified account and assigned role.</div></div></section></main>;
}
