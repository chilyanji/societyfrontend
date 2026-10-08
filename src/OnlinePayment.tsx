import {useState} from 'react';
import {api,money,type Row,type User} from './api';
import {ErrorBox,useData,Status,Modal,Form} from './ui';
declare global {interface Window {Razorpay?:new(options:Row)=>{open:()=>void;on:(event:string,handler:(data:Row)=>void)=>void}}}
let checkoutLoad:Promise<void>|null=null;
function loadCheckout(){
 if(window.Razorpay)return Promise.resolve();
 if(!checkoutLoad)checkoutLoad=new Promise((resolve,reject)=>{const script=document.createElement('script');script.src='https://checkout.razorpay.com/v1/checkout.js';script.async=true;script.onload=()=>resolve();script.onerror=()=>{checkoutLoad=null;script.remove();reject(new Error('Unable to load Razorpay checkout. Check your connection.'));};document.head.appendChild(script);});
 return checkoutLoad;
}
export function OnlinePayment({invoice,user,version,refresh,notify}:{invoice:Row;user:User;version:number;refresh:()=>void;notify:(text:string)=>void}){
 const [error,setError]=useState(''),[busy,setBusy]=useState(false),[resolve,setResolve]=useState<Row|null>(null),orders=useData<Row[]>(`/payments-online/invoices/${invoice.id}/orders`,version);
 async function pay(){setBusy(true);setError('');try{
  await loadCheckout();const order=await api(`/payments-online/invoices/${invoice.id}/order`,'POST');
  if(!window.Razorpay)throw new Error('Checkout did not load');
  const checkout=new window.Razorpay({key:order.key,amount:order.amount,currency:order.currency,order_id:order.order_id,name:'Nayantra Society',description:invoice.number,
    prefill:{name:user.name,email:user.email||''},theme:{color:'#078a86'},
    handler:async(response:Row)=>{try{const result=await api('/payments-online/verify','POST',{order_id:order.order_id,payment_id:response.razorpay_payment_id,signature:response.razorpay_signature});notify(result.status==='paid'?'Payment verified and receipt saved':result.status==='paid_review'?'Payment received; accounts will review the extra balance':'Payment is awaiting capture. Use Check status shortly.');refresh();}catch(e){setError((e as Error).message+' Use Check status before making another payment.');}finally{setBusy(false);}},
    modal:{ondismiss:()=>{setBusy(false);refresh();}}
  });checkout.on('payment.failed',()=>{setError('Payment was not completed. Check the order status before retrying.');setBusy(false);refresh();});checkout.open();refresh();
 }catch(e){setError((e as Error).message);setBusy(false);}}
 async function reconcile(order:Row){setBusy(true);setError('');try{const result=await api(`/payments-online/orders/${order.id}/reconcile`,'POST');notify('Order status: '+result.status);refresh();}catch(e){setError((e as Error).message);}finally{setBusy(false);}}
 return <section className="detail-section no-print"><h3>Online payment</h3><ErrorBox message={error||orders.error}/>{invoice.balance_paise>0&&!invoice.cancelled&&<button className="button primary" disabled={busy} onClick={pay}>{busy?'Please wait…':'Pay '+money(invoice.balance_paise)+' securely'}</button>}<p className="small muted">UPI, cards and net banking are handled by Razorpay. A receipt is issued after the server verifies capture.</p>{orders.data?.map(order=><div className="session-line" key={order.id}><span><strong>{order.order_id||'Order awaiting reconciliation'}</strong><small>{money(order.amount)} · {order.test_mode?'Test mode':'Live mode'} · <Status value={order.status}/></small></span><div className="record-actions"><button className="button" disabled={busy} onClick={()=>reconcile(order)}>Check status</button>{['admin','manager','accountant'].includes(user.role)&&['creating','uncertain'].includes(order.status)&&<button className="button" onClick={()=>setResolve(order)}>Resolve failed order</button>}</div></div>)}{resolve&&<Modal title="Resolve an uncertain order" subtitle="Available after 15 minutes. Review the receipt in Razorpay first. The server also checks that no matching provider order exists." onClose={()=>setResolve(null)}><Form fields={[{key:'password',label:'Current password',type:'password',required:true},{key:'code',label:'Authenticator / recovery code',required:user.mfa_enabled},{key:'note',label:'Provider review note (8+ characters)',type:'textarea',required:true}]} options={{}} onClose={()=>setResolve(null)} onSave={async payload=>{const result=await api(`/payments-online/orders/${resolve.id}/resolve-failed`,'POST',payload);notify(result.message);refresh();}}/></Modal>}</section>;
}
