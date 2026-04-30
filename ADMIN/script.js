const SUPABASE_URL  = 'https://jhrefpiuklbfamrbqpro.supabase.co';
const SUPABASE_ANON = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImpocmVmcGl1a2xiZmFtcmJxcHJvIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzY1MDY5ODMsImV4cCI6MjA5MjA4Mjk4M30.zkKbT4ByzyHPVIGR-1SRw4_fXc1wKbusvtrXHP2jz4M';

// ────────────────────────────

const { createClient } = supabase;
const db = createClient(SUPABASE_URL, SUPABASE_ANON);

let allProducts = [];
let allOrders   = [];
let currentUser = null;

// ── Auth ──
async function doLogin() {
  const email = document.getElementById('a-email').value.trim();
  const pass  = document.getElementById('a-pass').value;
  document.getElementById('auth-err').textContent = '';
  const { data, error } = await db.auth.signInWithPassword({ email, password: pass });
  if (error) { document.getElementById('auth-err').textContent = error.message; return; }
  currentUser = data.user;
  showApp();
}

async function doLogout() {
  await db.auth.signOut();
  location.reload();
}

function showApp() {
  document.getElementById('auth-screen').style.display = 'none';
  document.getElementById('app').style.display = 'flex';
  document.getElementById('admin-email-display').textContent = currentUser.email;
  loadData();
}

// ── Tab ──
function switchTab(t) {
  document.getElementById('tab-products').style.display = t==='products'?'block':'none';
  document.getElementById('tab-orders').style.display   = t==='orders'?'block':'none';
  document.querySelectorAll('.tab').forEach((el,i)=>el.classList.toggle('active',(t==='products'&&i===0)||(t==='orders'&&i===1)));
}

// ── Load ──
async function loadData() {
  const [{ data: prods }, { data: ords }] = await Promise.all([
    db.from('products').select('*').order('created_at', { ascending: true }),
    db.from('orders').select('*').order('created_at', { ascending: true })
  ]);
  allProducts = prods || [];
  allOrders   = ords  || [];
  updateStats();
  renderProducts();
  renderOrders();
}

function updateStats() {
  document.getElementById('stat-products').textContent = allProducts.length;
  document.getElementById('stat-orders').textContent   = allOrders.length;
  const rev = allOrders.filter(o=>o.payment_status==='paid').reduce((s,o)=>s+(o.total||0),0);
  document.getElementById('stat-revenue').textContent  = '₹'+rev.toLocaleString('en-IN');
  document.getElementById('stat-low').textContent      = allProducts.filter(p=>p.quantity<=5).length;
}

// ── Products ──
function renderProducts() {
  const q   = (document.getElementById('prod-search').value||'').toLowerCase();
  const rows = allProducts.filter(p=>!q||p.name.toLowerCase().includes(q)||((p.category||'').toLowerCase().includes(q)));
  const tbody = document.getElementById('products-body');
  if (!rows.length) { tbody.innerHTML='<tr><td colspan="6"><div class="empty-state"><div class="em-icon">📦</div><p>No products yet — add your first one!</p></div></td></tr>'; return; }
  tbody.innerHTML = rows.map(p=>{
    const stockBadge = p.quantity===0 ? '<span class="badge out">Out of Stock</span>' :
      p.quantity<=5 ? '<span class="badge low-stock">Low Stock</span>' :
      '<span class="badge in-stock">In Stock</span>';
    const img = p.image_url
      ? `<img class="prod-img" src="${p.image_url}" alt="" onerror="this.style.display='none'">`
      : `<div class="prod-img-placeholder">🛍</div>`;
    return `<tr>
      <td style="display:flex;align-items:center;gap:12px">${img}<div><div style="font-weight:600">${esc(p.name)}</div><div style="font-size:12px;color:var(--muted)">${esc(p.description||'')}</div></div></td>
      <td style="color:var(--muted)">${esc(p.category||'—')}</td>
      <td class="price-cell">₹${Number(p.price).toLocaleString('en-IN')}</td>
      <td>${p.quantity}</td>
      <td>${stockBadge}</td>
      <td>
        <button class="icon-btn edit" onclick="openEditModal(${JSON.stringify(p).replace(/"/g,'&quot;')})">✏</button>
        <button class="icon-btn" onclick="deleteProduct('${p.id}')">🗑</button>
      </td>
    </tr>`;
  }).join('');
}

function openAddModal() {
  document.getElementById('modal-title').textContent = 'Add Product';
  document.getElementById('edit-id').value = '';
  ['p-name','p-cat','p-desc','p-price','p-qty','p-img'].forEach(id=>document.getElementById(id).value='');
  document.getElementById('prod-modal').classList.add('show');
}

function openEditModal(p) {
  document.getElementById('modal-title').textContent = 'Edit Product';
  document.getElementById('edit-id').value  = p.id;
  document.getElementById('p-name').value   = p.name;
  document.getElementById('p-cat').value    = p.category||'';
  document.getElementById('p-desc').value   = p.description||'';
  document.getElementById('p-price').value  = p.price;
  document.getElementById('p-qty').value    = p.quantity;
  document.getElementById('p-img').value    = p.image_url||'';
  document.getElementById('prod-modal').classList.add('show');
}

function closeModal() {
  document.getElementById('prod-modal').classList.remove('show');
}

async function saveProduct() {
  const id    = document.getElementById('edit-id').value;
  const name  = document.getElementById('p-name').value.trim();
  const price = parseFloat(document.getElementById('p-price').value);
  const qty   = parseInt(document.getElementById('p-qty').value);
  if (!name||isNaN(price)||isNaN(qty)) { toast('Fill in all required fields','error'); return; }
  const payload = {
    name, price, quantity: qty,
    category: document.getElementById('p-cat').value.trim()||null,
    description: document.getElementById('p-desc').value.trim()||null,
    image_url: document.getElementById('p-img').value.trim()||null,
    updated_at: new Date().toISOString()
  };
  let err;
  if (id) {
    ({ error: err } = await db.from('products').update(payload).eq('id', id));
  } else {
    payload.created_at = new Date().toISOString();
    ({ error: err } = await db.from('products').insert([payload]));
  }
  if (err) { toast('Error: '+err.message,'error'); return; }
  toast(id ? 'Product updated!' : 'Product added!','success');
  closeModal();
  loadData();
}

async function deleteProduct(id) {
  if (!confirm('Delete this product?')) return;
  const { error } = await db.from('products').delete().eq('id', id);
  if (error) { toast('Error: '+error.message,'error'); return; }
  toast('Product deleted','success');
  loadData();
}

// ── Orders ──
function renderOrders() {
  let rows = allOrders.filter(o => o.payment_status === 'paid');
  rows = [...rows].reverse();
  const tbody = document.getElementById('orders-body');
  if (!rows.length) { tbody.innerHTML='<tr><td colspan="6"><div class="empty-state"><div class="em-icon">📋</div><p>No orders yet.</p></div></td></tr>'; return; }
  tbody.innerHTML = rows.map((o, i)=>{
    const badge = '<span class="badge confirmed">success</span>';
    const items = (o.items||[]).map(i=>`${i.name} ×${i.qty}`).join(', ');
    const date  = new Date(o.created_at).toLocaleDateString('en-IN',{day:'2-digit',month:'short',year:'numeric'});
    return `<tr>
      <td style="font-family:monospace;font-size:12px;color:var(--muted)">#${allOrders.length - i}</td>
      <td><div style="font-weight:600">${esc(o.customer_name||'')}</div></td>
      <td style="font-size:12px;color:var(--muted);max-width:200px">${esc(items)}</td>
      <td class="price-cell">₹${Number(o.total||0).toLocaleString('en-IN')}</td>
      <td>${badge}</td>
      <td style="font-size:12px;color:var(--muted)">${date}</td>
    </tr>`;
  }).join('');
}

// ── Real-time ──
db.channel('admin-channel')
  .on('postgres_changes',{event:'*',schema:'public',table:'orders'},()=>loadData())
  .on('postgres_changes',{event:'*',schema:'public',table:'products'},()=>loadData())
  .subscribe();

// ── Utilities ──
function esc(s){ const d=document.createElement('div');d.textContent=s||'';return d.innerHTML }
function toast(msg, type='success') {
  const t=document.getElementById('toast');
  t.textContent=msg; t.className='show '+type;
  setTimeout(()=>t.className='',3000);
}

// ── Session check ──
(async()=>{
  const { data:{ session } } = await db.auth.getSession();
  if (session) { currentUser=session.user; showApp(); }
})();