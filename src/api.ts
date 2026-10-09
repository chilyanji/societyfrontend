export type Row = Record<string, any>;
export type User = {id:string; name:string; username:string; role:string; person_id:string|null; flat_id:string|null; csrf:string;setup_required:string[];email?:string|null;email_verified:boolean;mfa_enabled:boolean};
let csrf='';
export function setCsrf(value:string){csrf=value;}
export async function api<T=any>(path:string,method='GET',body?:unknown):Promise<T>{
  const headers:Record<string,string>={};
  if(method!=='GET')headers['X-CSRF-Token']=csrf;
  if(body && !(body instanceof FormData))headers['Content-Type']='application/json';
  
const requestHeaders = new Headers(headers);

requestHeaders.set('ngrok-skip-browser-warning', '1');

const response = await fetch('/api' + path, {
  method,
  credentials: 'same-origin',
  headers: requestHeaders,
  body: body instanceof FormData
    ? body
    : body === undefined
      ? undefined
      : JSON.stringify(body),
});

  const data=await response.json().catch(()=>({detail:'Server returned an unexpected response'}));
  if(response.status===401&&!path.startsWith('/auth/'))window.dispatchEvent(new Event('society-session-expired'));
  if(!response.ok)throw new Error(typeof data.detail==='string'?data.detail:'Request failed. Check the form and retry.');
  return data as T;
}
export const money=(value:number=0)=>new Intl.NumberFormat('en-IN',{style:'currency',currency:'INR',maximumFractionDigits:2}).format(value/100);
export const stamp=(value:string)=>value?new Date(value).toLocaleString('en-IN',{dateStyle:'medium',timeStyle:'short'}):'—';
export const label=(value:string)=>value?.replaceAll('_',' ').replaceAll('-',' ')||'—';
export function localInput(value?:string){const d=value?new Date(value):new Date();return new Date(d.getTime()-d.getTimezoneOffset()*60000).toISOString().slice(0,16);}
