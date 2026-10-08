import {useState} from 'react';
import {FaceEnrollment} from './FaceEnrollment';
import {OnlinePayment} from './OnlinePayment';
import {Plus,Download,ArrowUpRight,FileText,Printer,Upload,ChevronRight} from 'lucide-react';
import {api,label,money,stamp,type Row,type User} from './api';
import {modules,managers,finance,security,type Module} from './modules';
import {useData,Status,Empty,ErrorBox,Loading,Modal,Form,SearchBox,Pagination,type Field} from './ui';

export type Shared={user:User;options:Row;version:number;refresh:()=>void;notify:(message:string)=>void};
const statuses=new Set(['status','presence','decision','direction','severity','priority','role']);
export function cell(key:string,value:any,options:Row,definition?:Module){
  if(value===undefined||value===null||value==='')return <span className="muted">—</span>;
  if(key.endsWith('_paise'))return <span className="amount">{money(value)}</span>;
  if(statuses.has(key))return <Status value={String(value)}/>;
  if(typeof value==='boolean')return <span className={value?'boolean yes':'boolean'}>{value?'Yes':'No'}</span>;
  if(key.endsWith('_at')||['valid_from','valid_until'].includes(key))return stamp(value);
  if(key.endsWith('_id')){const lookup=definition?.fields?.find(f=>f.key===key)?.lookup;return lookup?(options[lookup]||[]).find((x:Row)=>x.id===value)?.label||'Unlinked':value;}
  if(Array.isArray(value))return value.join(', ');
  if(typeof value==='object')return Object.entries(value).map(([k,v])=>`${label(k)}: ${v}`).join(' · ');
  return String(value);
}

function Attachments({resource,id,version,refresh,notify}:{resource:string;id:string;version:number;refresh:()=>void;notify:(message:string)=>void}){
  const state=useData<Row[]>(`/files/${resource}/${id}`,version),[error,setError]=useState(''),[busy,setBusy]=useState(false);
  async function upload(file?:File){if(!file)return;setBusy(true);setError('');try{const data=new FormData();data.append('file',file);await api(`/files/${resource}/${id}`,'POST',data);refresh();notify('Attachment saved');}catch(e){setError((e as Error).message);}finally{setBusy(false);}}
  return <section className="detail-section"><h3>Attachments & evidence</h3><p className="muted small">PDF, JPEG or PNG · up to 5 MB each</p><div className="file-list">{state.data?.map(f=><a key={f.id} href={'/api/download/'+f.id} className="file-link"><FileText size={18}/><span>{f.name}<small>{Math.ceil(f.size/1024)} KB</small></span><Download size={16}/></a>)}</div><label className="button file-picker"><Upload size={16}/>{busy?'Uploading…':'Attach file'}<input type="file" accept=".pdf,.png,.jpg,.jpeg" disabled={busy} onChange={e=>upload(e.target.files?.[0])}/></label><ErrorBox message={error||state.error}/></section>;
}

function Thread({id,version}:{id:string;version:number}){const state=useData<Row[]>(`/complaints/${id}/comments`,version);return <section className="detail-section"><h3>Conversation</h3>{state.data?.length?state.data.map(x=><div className="thread-item" key={x.id}><strong>{x.author}</strong><small>{stamp(x.created_at)}</small><p>{x.body}</p></div>):<p className="muted">No comments yet.</p>}</section>;}
function Ledger({id,version}:{id:string;version:number}){const state=useData<Row[]>(`/invoices/${id}/ledger`,version);return <section className="detail-section"><h3>Payment history</h3>{state.data?.length?state.data.map(x=><div className="ledger-line" key={x.id}><span>{x.reference}<small>{stamp(x.created_at)} · {label(x.method)}</small></span><strong>{money(x.amount_paise)}{x.refunded&&' · refunded'}</strong></div>):<p className="muted">No payment recorded.</p>}</section>;}
function Occupancy({id,version}:{id:string;version:number}){const state=useData<Row[]>(`/people/${id}/occupancy`,version);return <section className="detail-section"><h3>Occupancy history</h3>{state.data?.map(x=><div className="ledger-line" key={x.id}><strong>{x.flat_label}</strong><span>{stamp(x.created_at)}<small>{x.ended_at?'Until '+stamp(x.ended_at):'Current home'}</small></span></div>)}</section>;}

export function Records({definition,...shared}:Shared&{definition:Module}){
  const {user,options,version,refresh,notify}=shared;
  const resource=definition.resource||definition.id;
  const [query,setQuery]=useState(''),[offset,setOffset]=useState(0),[edit,setEdit]=useState<Row|null>(null),[selected,setSelected]=useState<Row|null>(null),[billing,setBilling]=useState(false),[attendance,setAttendance]=useState(false);
  const result=useData<Row>(`/${resource}?limit=50&offset=${offset}&q=${encodeURIComponent(query)}${definition.fixed?.kind?'&kind='+definition.fixed.kind:''}`,version);
  const canWrite=definition.writers?.includes(user.role);
  function openForm(row:Row={}){const start=new Date(),end=new Date(start.getTime()+6*3600000);setEdit({flat_id:user.flat_id||'',valid_from:start.toISOString(),valid_until:end.toISOString(),starts_on:start.toISOString().slice(0,10),ends_on:start.toISOString().slice(0,10),period:start.toISOString().slice(0,7),spent_on:start.toISOString().slice(0,10),...row});}
  return <><div className="page-title"><div><p className="eyebrow">{definition.group}</p><h1>{definition.title}</h1><p>{definition.subtitle}</p></div><div className="page-actions">{definition.export&&<a className="button" href={'/api/export/'+resource}><Download size={16}/>Export</a>}{definition.id==='staff'&&[...managers,'staff'].includes(user.role)&&<button className="button" onClick={()=>setAttendance(true)}><FileText size={16}/>Attendance report</button>}{definition.id==='invoices'&&finance.includes(user.role)&&<button className="button" onClick={()=>setBilling(true)}>Generate monthly bills</button>}{canWrite&&<button className="button primary" onClick={()=>openForm()}><Plus size={17}/>Add {definition.id==='people'?'person':'record'}</button>}</div></div>
  <section className="panel"><div className="table-toolbar"><SearchBox value={query} onChange={value=>{setQuery(value);setOffset(0);}}/><span className="muted small">{result.data?.total??'…'} records · updates automatically</span></div><ErrorBox message={result.error}/>{result.loading?<Loading/>:!result.data?.items?.length?<Empty title={query?'No matching records':'Your '+definition.title.toLowerCase()+' start here'}>{query?'Try a different search.':canWrite?'Use Add record to create the first one.':'Records shared with your account will appear here.'}</Empty>:<div className="table-scroll"><table><thead><tr>{definition.columns?.map(([key,name])=><th key={key}>{name}</th>)}<th><span className="sr-only">Open</span></th></tr></thead><tbody>{result.data.items.map((row:Row)=><tr key={row.id}>{definition.columns?.map(([key],i)=><td key={key}>{i===0?<button className="row-title" onClick={()=>setSelected(row)}>{cell(key,row[key],options,definition)}</button>:cell(key,row[key],options,definition)}{key==='status'&&(row.overdue||row.expired)&&<span className="badge badge-high">{row.overdue?'Overdue':'Expired'}</span>}</td>)}<td><button className="icon-button" aria-label={'Open '+(row.name||row.title||row.number||'record')} onClick={()=>setSelected(row)}><ChevronRight size={17}/></button></td></tr>)}</tbody></table></div>}<Pagination offset={offset} total={result.data?.total||0} onChange={setOffset}/></section>
  {edit&&<Modal title={(edit.id?'Edit ':'Add ')+definition.title.toLowerCase()} onClose={()=>setEdit(null)} wide><Form fields={definition.fields||[]} initial={edit} options={options} onClose={()=>setEdit(null)} onSave={async values=>{await api(`/${resource}${edit.id?'/'+edit.id:''}`,edit.id?'PUT':'POST',{...values,...definition.fixed});refresh();notify('Record saved');}}/></Modal>}
  {selected&&<Detail definition={definition} item={selected} {...shared} onClose={()=>setSelected(null)} onEdit={row=>{setSelected(null);openForm(row);}}/>}
  {billing&&<Modal title="Generate monthly maintenance" subtitle="Uses each active flat’s monthly maintenance amount. Existing bills for this month are skipped." onClose={()=>setBilling(false)}><Form fields={[{key:'period',label:'Billing month',type:'month',required:true,default:new Date().toISOString().slice(0,7)},{key:'due_on',label:'Due date',type:'date',required:true}]} options={options} submit="Generate invoices" onClose={()=>setBilling(false)} onSave={async data=>{const r=await api('/billing/run','POST',data);refresh();notify(`${r.created} invoices generated; ${r.skipped} already existed`);}}/></Modal>}
  {attendance&&<Modal title="Staff attendance report" subtitle="Attendance is calculated from allowed staff gate movements, including open visits." onClose={()=>setAttendance(false)}><Form fields={[{key:'start',label:'From',type:'date',required:true},{key:'end',label:'Through',type:'date',required:true}]} options={options} submit="Download CSV" onClose={()=>setAttendance(false)} onSave={async data=>{window.location.assign(`/api/reports/staff-attendance?start=${data.start}&end=${data.end}`);}}/></Modal>}
  </>;
}

function Detail({definition,item,onClose,onEdit,...shared}:Shared&{definition:Module;item:Row;onClose:()=>void;onEdit:(r:Row)=>void}){
  const {user,options,version,refresh,notify}=shared,resource=definition.resource||definition.id;
  const current=useData<Row>(`/${resource}/${item.id}`,version),[action,setAction]=useState<string|null>(null),[error,setError]=useState(''),[deviceKey,setDeviceKey]=useState(''),[pay,setPay]=useState(false);
  const row=current.data||item,canManage=managers.includes(user.role),canSecurity=security.includes(user.role),canFinance=finance.includes(user.role);
  const available:[string,string][]=[];
  if(resource==='visitors'){
    if(row.status==='pending'&&(canManage||user.role==='resident'))available.push(['approve','Approve visit'],['reject','Reject visit']);
    if(['pending','approved'].includes(row.status)&&(canManage||user.role==='resident'))available.push(['cancel','Cancel pass']);
    if(row.status==='approved'&&canSecurity)available.push(['gate_in','Check in at gate']);
    if(row.status==='inside'&&canSecurity)available.push(['gate_out','Check out at gate']);
  }
  if(resource==='leaves'&&row.status==='pending'&&canManage)available.push(['approve','Approve leave'],['reject','Reject leave']);
  if(resource==='deliveries'&&row.status==='received'){available.push(['collect','Confirm collection']);if(canSecurity)available.push(['return','Return to courier']);}
  if(resource==='complaints'){
    if(canManage&&row.status!=='closed')available.push(['assign','Assign staff']);
    if((canManage||user.person_id===row.assigned_to)&&['open','assigned','in_progress'].includes(row.status))available.push(['start','Mark in progress'],['resolve','Resolve request']);
    if(canManage||user.id===row.reporter_id){if(row.status==='resolved')available.push(['close','Confirm & close']);if(['closed','resolved'].includes(row.status))available.push(['reopen','Reopen request']);}
    available.push(['comment','Add comment']);
  }
  if(resource==='invoices'&&!row.cancelled&&row.paid_paise===0&&canFinance)available.push(['cancel','Cancel invoice']);
  if(resource==='expenses'&&row.status==='pending'&&canManage)available.push(['approve','Approve expense'],['reject','Reject expense']);
  if(resource==='payments'&&!row.refunded&&!row.gateway_payment_id&&canFinance)available.push(['refund','Record full refund']);
  if(resource==='bookings'&&row.status==='confirmed')available.push(['cancel','Cancel reservation']);
  if(resource==='incidents'&&canSecurity){if(row.status==='open')available.push(['acknowledge','Acknowledge']);if(row.status!=='resolved')available.push(['resolve','Resolve incident']);}
  if(resource==='cameras'&&canManage)available.push(['rotate_key','Generate / rotate device key']);
  if(resource==='guard-assignments'&&canManage)available.push(['unassign','Remove assignment']);
  const fields:Field[]=[];
  if(action==='assign')fields.push({key:'assigned_to',label:'Assign to staff',lookup:'people',filter:x=>x.kind==='staff'&&x.status==='active',required:true});
  if(action==='collect')fields.push({key:'code',label:'Resident collection code',required:!canManage});
  if(action?.startsWith('gate_'))fields.push({key:'gate_id',label:'Gate',lookup:'gates',filter:x=>x.direction==='both'||x.direction===(action==='gate_in'?'in':'out'),required:true});
  fields.push({key:'note',label:action==='refund'?'External refund reference and reason':'Note / reason',type:'textarea',required:['resolve','cancel','comment','return','refund'].includes(action||'')});
  async function perform(data:Row){
    setError('');
    if(action?.startsWith('gate_')){const r=await api('/gate/movements','POST',{event_key:crypto.randomUUID(),gate_id:data.gate_id,visitor_id:row.id,direction:action==='gate_in'?'in':'out',note:data.note});refresh();if(r.decision!=='allowed')throw new Error('Access denied: '+r.reason);}
    else if(action==='unassign'){await api('/guard-assignments/'+row.id,'DELETE');onClose();}
    else{const result=await api(`/${resource}/${row.id}/actions`,'POST',{action,...data});if(result.device_key)setDeviceKey(result.device_key);}
    refresh();notify('Action recorded');
  }
  const showFields=Array.from(new Set([...(definition.fields||[]).map(x=>x.key),...(definition.columns||[]).map(x=>x[0]),'created_at','resolution'])).filter(k=>row[k]!==undefined&&row[k]!==null&&k!=='password'&&!['user_id','person_id','flat_id','gate_id','vendor_id','vehicle_id','amenity_id','invoice_id'].includes(k));
  return <Modal title={row.title||row.name||row.number||row.subject_name||row.reference||definition.title} subtitle={row.flat_label||definition.title} wide onClose={onClose}>
    <ErrorBox message={error||current.error}/><div className="detail-body">
    {resource==='cameras'&&row.online&&row.snapshot_available&&<img className="camera-preview" src={`/api/cameras/${row.id}/snapshot?t=${Math.floor(Date.now()/15000)}`} alt={'Latest frame from '+row.name}/>}
    {(row.pass_code||row.credential)&&<div className="pass-card"><img src={`/api/passes/${resource}/${row.id}.svg`} alt="Entry pass QR code"/><div><p className="eyebrow">{resource==='visitors'?'VISITOR PASS':'MEMBER PASS'}</p><h3>{row.name}</h3><code>{row.pass_code||row.credential}</code><p className="small muted">Present this code at the security gate. Approval, membership and time restrictions still apply.</p></div></div>}
    {row.collection_code&&row.status==='received'&&<div className="code-banner"><span>Parcel collection code</span><strong>{row.collection_code}</strong><small>Share with the guard only when collecting this parcel.</small></div>}
    {deviceKey&&<div className="code-banner"><span>Device key — shown once</span><code>{deviceKey}</code><small>Camera ID: <code>{row.id}</code></small><small>Store this securely for the camera worker. Rotating again revokes the previous key.</small><button className="button" onClick={()=>navigator.clipboard.writeText(deviceKey).then(()=>notify('Device key copied')).catch(()=>setError('Select and copy the key manually.'))}>Copy key</button></div>}
    <dl className="details-grid">{showFields.map(k=><div key={k} className={['body','description','resolution','notes','note'].includes(k)?'full':''}><dt>{definition.fields?.find(f=>f.key===k)?.label||definition.columns?.find(f=>f[0]===k)?.[1]||label(k)}</dt><dd>{cell(k,row[k],options,definition)}</dd></div>)}</dl>
    <div className="record-actions no-print">{definition.editable&&definition.writers?.includes(user.role)&&<button className="button primary" onClick={()=>onEdit(row)}>Edit details</button>}{resource==='invoices'&&row.balance_paise>0&&canFinance&&<button className="button primary" onClick={()=>setPay(true)}>Record payment</button>}{available.map(([key,text])=><button key={key} className="button" onClick={()=>setAction(key)}>{text}</button>)}{['invoices','payments','visitors','people'].includes(resource)&&<button className="button" onClick={()=>window.print()}><Printer size={16}/>Print</button>}</div>
    {resource==='invoices'&&<OnlinePayment invoice={row} user={user} version={version} refresh={refresh} notify={notify}/>}
    {resource==='payments'&&row.gateway_payment_id&&<p className="muted">Gateway refunds are issued in the Razorpay dashboard and synced through signed webhooks or the invoice’s Check status action. Unallocated credit: {money(row.unallocated_paise)}. Refunded: {money(row.refunded_paise)}.</p>}
    {resource==='people'&&(canManage||user.person_id===row.id)&&<FaceEnrollment person={row} user={user} version={version} refresh={refresh} notify={notify}/>}
    {resource==='invoices'&&<Ledger id={row.id} version={version}/>}
    {resource==='people'&&row.kind==='resident'&&<Occupancy id={row.id} version={version}/>}
    {resource==='complaints'&&<Thread id={row.id} version={version}/>}
    {['complaints','incidents','visitors','assets','vendors','expenses'].includes(resource)&&<div className="no-print"><Attachments resource={resource} id={row.id} version={version} refresh={refresh} notify={notify}/></div>}
    </div>
    {action&&<Modal title={available.find(x=>x[0]===action)?.[1]||'Confirm action'} subtitle={action==='refund'?'Record a refund that has already been completed outside this application.':undefined} onClose={()=>setAction(null)}><Form fields={fields} options={options} onClose={()=>setAction(null)} onSave={perform} submit="Confirm action"/></Modal>}
    {pay&&<Modal title="Record received payment" subtitle="Enter a verified cash, bank, UPI or cheque payment. This form does not charge a bank account." onClose={()=>setPay(false)}><Form fields={(modules.find(x=>x.id==='payments')?.fields||[]).filter(x=>x.key!=='invoice_id')} initial={{amount_paise:row.balance_paise}} options={options} onClose={()=>setPay(false)} onSave={async data=>{await api('/payments','POST',{...data,invoice_id:row.id});refresh();notify('Payment and receipt recorded');}}/></Modal>}
  </Modal>;
}
