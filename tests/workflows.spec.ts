import {test,expect,type Page} from '@playwright/test';
const password=process.env.SOCIETY_BROWSER_TEST_PASSWORD||'Disposable-browser-test-4096';
async function login(page:Page,role='admin'){
  await page.goto('/');await page.getByLabel('Username or email').fill(role);await page.getByLabel('Password',{exact:true}).fill(password);await page.getByRole('button',{name:'Sign in',exact:true}).click();await expect(page.getByRole('heading',{name:/Welcome,/})).toBeVisible();
}
async function nav(page:Page,name:string){await page.getByRole('navigation').getByRole('link',{name,exact:true}).click();await expect(page.getByRole('heading',{name,exact:true}).first()).toBeVisible();}
async function add(page:Page){await page.getByRole('button',{name:'Add record',exact:true}).click();return page.getByRole('dialog').last();}
async function save(page:Page){await page.getByRole('button',{name:'Save record',exact:true}).click();await expect(page.getByRole('dialog')).toHaveCount(0);}
async function open(page:Page,name:string){await page.getByRole('button',{name,exact:true}).first().click();await expect(page.getByRole('dialog')).toBeVisible();return page.getByRole('dialog').first();}

test('admin creates a home and member, verifies every module, desktop and dark theme',async({page})=>{
  const errors:string[]=[];page.on('pageerror',e=>errors.push(e.message));
  await login(page);
  await page.screenshot({path:'test-results/society-dashboard.png',fullPage:true,animations:"disabled"});
  await nav(page,'Towers & flats');await add(page);await page.getByLabel('Tower / block').fill('C');await page.getByLabel('Flat number').fill('201');await page.getByLabel('Monthly maintenance (₹)').fill('4200');await save(page);await expect(page.getByRole('button',{name:'C · 201',exact:true})).toBeVisible();
  await nav(page,'Residents & families');await add(page);await page.getByLabel('Full name').fill('Fictional Test Resident');await page.getByLabel('Flat',{exact:false}).selectOption({label:'C · 201'});await save(page);
  await open(page,'Fictional Test Resident');await expect(page.getByAltText('Entry pass QR code')).toBeVisible();await expect(page.getByRole('heading',{name:'Occupancy history'})).toBeVisible();await page.getByLabel('Close dialog').click();
  const links=await page.getByRole('navigation').getByRole('link').allTextContents();
  for(const link of links){await page.getByRole('navigation').getByRole('link',{name:link,exact:true}).click();await expect(page.locator('.main-content .loading')).toHaveCount(0);await expect(page.locator('.main-content .error-box')).toHaveCount(0);await expect(page.locator('.main-content')).not.toContainText('Your role cannot perform');await expect(page.locator('.main-content')).not.toContainText('Server returned an unexpected');}
  await page.getByRole('navigation').getByRole('link',{name:'Community overview'}).click();await page.getByLabel('Use dark theme').click();await expect(page.locator('html')).toHaveAttribute('data-theme','dark');await page.screenshot({path:'test-results/society-dashboard-dark.png',fullPage:true,animations:"disabled"});
  expect(errors).toEqual([]);
});

test('resident pass, guard entry and exit, parcel collection and mobile navigation',async({browser})=>{
  const resident=await browser.newPage(),guard=await browser.newPage();
  await login(resident,'resident');await nav(resident,'Visitors & passes');await add(resident);await resident.getByLabel('Visitor name').fill('UI Visitor');await resident.getByLabel('Purpose of visit').fill('Family gathering');await save(resident);await open(resident,'UI Visitor');const code=(await resident.locator('.pass-card code').textContent())!;await resident.getByLabel('Close dialog').click();
  await login(guard,'guard');await nav(guard,'Gate console');await guard.getByLabel('Duty gate').selectOption({label:'Main Entry'});await guard.getByLabel('Scan or type pass code').fill(code);await guard.getByRole('button',{name:'Verify & record entry'}).click();await expect(guard.getByRole('heading',{name:'Access allowed'})).toBeVisible();await guard.getByRole('button',{name:'Exit',exact:true}).click();await guard.getByLabel('Duty gate').selectOption({label:'Main Exit'});await guard.getByRole('button',{name:'Verify & record exit'}).click();await expect(guard.getByRole('heading',{name:'Access allowed'})).toBeVisible();
  await nav(guard,'Parcel desk');await add(guard);await guard.getByLabel('Flat',{exact:false}).selectOption({label:'A · 101'});await guard.getByLabel('Courier / sender').fill('UI Courier');await guard.getByLabel('Tracking reference').fill('UI-PARCEL-001');await save(guard);
  await nav(resident,'Parcel desk');await open(resident,'UI Courier');const parcelCode=(await resident.locator('.code-banner strong').textContent())!;await resident.getByLabel('Close dialog').click();
  await open(guard,'UI Courier');await guard.getByRole('button',{name:'Confirm collection'}).click();await guard.getByLabel('Resident collection code').fill(parcelCode);await guard.getByRole('button',{name:'Confirm action'}).click();await expect(guard.getByRole('dialog').first().getByText('collected',{exact:true})).toBeVisible();
  await resident.setViewportSize({width:390,height:844});await resident.goto('/#overview');await expect(resident.getByRole('heading',{name:/Welcome,/})).toBeVisible();await expect.poll(()=>resident.evaluate(()=>document.documentElement.scrollWidth<=window.innerWidth)).toBe(true);if(await resident.getByLabel('Dismiss notification').count())await resident.getByLabel('Dismiss notification').click();await resident.screenshot({path:'test-results/society-mobile.png',fullPage:true,animations:"disabled"});await resident.getByLabel('Open menu').click();await resident.getByRole('navigation').getByRole('link',{name:'Helpdesk & requests'}).click();await expect(resident.getByRole('heading',{name:'Helpdesk & requests',exact:true})).toBeVisible();
  await resident.close();await guard.close();
});

test('accountant billing and receipt, resident request, assigned staff resolution',async({browser})=>{
  const accounts=await browser.newPage(),resident=await browser.newPage(),admin=await browser.newPage(),staff=await browser.newPage();
  await login(accounts,'accountant');await nav(accounts,'Maintenance & dues');await accounts.getByRole('button',{name:'Generate monthly bills'}).click();await accounts.getByLabel('Billing month').fill('2026-10');await accounts.getByLabel('Due date').fill('2026-10-20');await accounts.getByRole('button',{name:'Generate invoices'}).click();await expect(accounts.getByRole('dialog')).toHaveCount(0);const first=accounts.locator('tbody tr').first();await first.locator('.row-title').click();await accounts.getByRole('button',{name:'Record payment',exact:true}).click();await accounts.getByLabel('Amount received (₹)').fill('100');await accounts.getByLabel('Unique transaction / receipt reference').fill('UI-BANK-001');await accounts.getByRole('button',{name:'Save record'}).click();await expect(accounts.getByRole('dialog').first().getByText('UI-BANK-001')).toBeVisible();
  await login(resident,'resident');await nav(resident,'Helpdesk & requests');await add(resident);await resident.getByLabel('Request title').fill('UI kitchen repair');await resident.getByLabel('Describe the issue').fill('A leaking tap needs inspection');await save(resident);
  await login(admin);await nav(admin,'Helpdesk & requests');await open(admin,'UI kitchen repair');await admin.getByRole('button',{name:'Assign staff'}).click();await admin.getByLabel('Assign to staff').selectOption({label:'Ravi Kumar'});await admin.getByRole('button',{name:'Confirm action'}).click();await expect(admin.getByRole('dialog')).toHaveCount(1);
  await login(staff,'staff');await nav(staff,'Helpdesk & requests');await open(staff,'UI kitchen repair');await staff.getByRole('button',{name:'Resolve request'}).click();await staff.getByLabel('Note / reason').fill('Replaced washer; tested and working');await staff.getByRole('button',{name:'Confirm action'}).click();await expect(staff.getByRole('dialog').first().getByText('resolved',{exact:true})).toBeVisible();
  await resident.getByLabel('Refresh records').click();await open(resident,'UI kitchen repair');await resident.getByRole('button',{name:'Confirm & close'}).click();await resident.getByRole('button',{name:'Confirm action'}).click();await expect(resident.getByRole('dialog').first().getByText('closed',{exact:true})).toBeVisible();
  for(const page of [accounts,resident,admin,staff])await page.close();
});

test('new account verifies email, enrolls MFA, changes password and signs in with recovery code',async({page})=>{
  const {execFileSync}=await import('node:child_process');
  const path=await import('node:path');
  const python=process.env.SOCIETY_TEST_PYTHON!;
  await page.goto('/');await page.getByLabel('Username or email').fill('bootstrap');await page.getByLabel('Password',{exact:true}).fill(password);await page.getByRole('button',{name:'Sign in',exact:true}).click();
  await expect(page.getByRole('heading',{name:'Verify and protect your account'})).toBeVisible();
  const contacts=page.locator('.settings-panel').filter({has:page.getByRole('heading',{name:'Contact & notifications'})});
  await contacts.getByLabel('Email address',{exact:true}).fill('bootstrap@example.com');await contacts.getByLabel('Current password',{exact:true}).fill(password);await contacts.getByRole('button',{name:'Save contacts'}).click();
  await expect(page.getByText('Contact saved. Verify any changed destination.')).toBeVisible();
  const email=page.locator('.verify-contact').filter({has:page.getByRole('heading',{name:'Email verification',exact:true})});
  await email.getByRole('button',{name:'Send verification code'}).click();await expect(email.getByPlaceholder('6-digit code')).toBeVisible();
  const otp=(await (await page.request.get('/__test/bootstrap-email-code')).json()).code;
  await email.getByPlaceholder('6-digit code').fill(otp);await email.getByRole('button',{name:'Verify',exact:true}).click();await expect(contacts.getByText(/Email: Verified/)).toBeVisible();
  const authenticator=page.locator('.settings-panel').filter({has:page.getByRole('heading',{name:'Authenticator app',exact:true})});
  await authenticator.getByLabel('Current password',{exact:true}).first().fill(password);await authenticator.getByRole('button',{name:'Set up authenticator'}).click();
  await expect(page.getByAltText('Scan with your authenticator app')).toBeVisible();
  const secret=(await page.locator('.break-anywhere').textContent())!;
  const code=execFileSync(python,['-c','import pyotp,sys; print(pyotp.TOTP(sys.argv[1]).now())',secret]).toString().trim();
  await page.getByLabel('Code from your authenticator').fill(code);await page.getByRole('button',{name:'Enable two-factor sign-in'}).click();
  const codes=(await page.locator('.recovery-codes pre').textContent())!.trim().split('\n');expect(codes).toHaveLength(10);
  await page.getByRole('button',{name:'I have saved my recovery codes'}).click();
  const change=authenticator.locator('form').last();const newPassword='Updated-browser-password-8877';
  await change.getByLabel('Current password',{exact:true}).fill(password);await change.getByLabel('New password (12+ characters)').fill(newPassword);await change.getByLabel('Authenticator / recovery code').fill(codes[0]);await change.getByRole('button',{name:'Update password'}).click();
  await expect(page.getByRole('heading',{name:/Welcome,/})).toBeVisible();await page.getByLabel('Sign out',{exact:true}).click();
  await page.getByLabel('Username or email').fill('bootstrap');await page.getByLabel('Password',{exact:true}).fill(newPassword);await page.getByRole('button',{name:'Sign in',exact:true}).click();await expect(page.getByRole('heading',{name:'Verify your sign-in'})).toBeVisible();
  await page.getByLabel('Authenticator / recovery code').fill(codes[1]);await page.getByRole('button',{name:'Verify sign-in',exact:true}).click();await expect(page.getByRole('heading',{name:/Welcome,/})).toBeVisible();
  await page.goto('/#settings');await expect(page.getByRole('heading',{name:'Active sessions'})).toBeVisible();
  await page.screenshot({path:'test-results/society-account-security.png',fullPage:true,animations:'disabled'});
});
