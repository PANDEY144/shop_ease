
// ── CONFIG — REPLACE THESE ──
    //const SUPABASE_URL  = 'https://YOUR_PROJECT_ID.supabase.co';
    //const SUPABASE_ANON = 'YOUR_ANON_PUBLIC_KEY';

    const SUPABASE_URL = 'https://jhrefpiuklbfamrbqpro.supabase.co';
    const SUPABASE_ANON = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImpocmVmcGl1a2xiZmFtcmJxcHJvIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzY1MDY5ODMsImV4cCI6MjA5MjA4Mjk4M30.zkKbT4ByzyHPVIGR-1SRw4_fXc1wKbusvtrXHP2jz4M';
    // ────────────────────────────

    const { createClient } = supabase;
    const db = createClient(SUPABASE_URL, SUPABASE_ANON);

    let allProducts = [];
    let cart = JSON.parse(localStorage.getItem('shopease_cart') || '[]');
    let activeCategory = '';

    // ── Load Products ──
    async function loadProducts() {
      const { data, error } = await db.from('products').select('*').order('created_at', { ascending: false });
      if (error) {
        document.getElementById('products-grid').innerHTML = '<div class="empty-state"><div class="em-icon">⚠️</div><p>Could not load products. Please try again.</p></div>';
        return;
      }
      allProducts = data || [];
      buildCategoryFilters();
      renderProducts();
    }

    function buildCategoryFilters() {
      const cats = [...new Set(allProducts.map(p => p.category).filter(Boolean))];
      const row = document.getElementById('filters-row');
      const search = row.querySelector('.search-wrap');
      cats.forEach(c => {
        const btn = document.createElement('button');
        btn.className = 'filter-btn'; btn.textContent = c;
        btn.onclick = () => setCategory(c);
        row.insertBefore(btn, search);
      });
    }

    function setCategory(cat) {
      activeCategory = cat;
      document.querySelectorAll('.filter-btn').forEach(b => b.classList.toggle('active', b.textContent === (cat || 'All')));
      renderProducts();
    }

    function renderProducts() {
      const q = (document.getElementById('search-input').value || '').toLowerCase();
      let items = allProducts;
      if (activeCategory) items = items.filter(p => p.category === activeCategory);
      if (q) items = items.filter(p => p.name.toLowerCase().includes(q) || (p.description || '').toLowerCase().includes(q) || (p.category || '').toLowerCase().includes(q));

      if (!items.length) {
        document.getElementById('products-grid').innerHTML = '<div class="empty-state"><div class="em-icon">🔍</div><p>No products found.</p></div>';
        return;
      }

      const grid = document.createElement('div');
      grid.className = 'grid';
      grid.innerHTML = items.map(p => {
        const stockBadge = p.quantity === 0
          ? '<span class="stock-badge out">Out of Stock</span>'
          : p.quantity <= 5
            ? `<span class="stock-badge low">Only ${p.quantity} left</span>`
            : '<span class="stock-badge in">In Stock</span>';
        const img = p.image_url
          ? `<img class="product-img" src="${p.image_url}" alt="${esc(p.name)}" loading="lazy" onerror="this.parentElement.innerHTML='<div class=product-img-ph>🛍</div>'">`
          : '<div class="product-img-ph">🛍</div>';
        const inCart = cart.find(c => c.id === p.id);
        const addLabel = p.quantity === 0 ? 'Out of Stock' : inCart ? `In Cart (${inCart.qty})` : '+ Add to Cart';
        return `<div class="product-card">
      ${img}
      <div class="card-body">
        <div class="card-category">${esc(p.category || 'Product')}</div>
        <div class="card-name">${esc(p.name)}</div>
        <div class="card-desc">${esc(p.description || '')}</div>
        <div class="card-footer">
          <div class="card-price">₹${Number(p.price).toLocaleString('en-IN')}</div>
          ${stockBadge}
        </div>
        <button class="add-btn" ${p.quantity === 0 ? 'disabled' : ''} onclick="addToCart('${p.id}')">${addLabel}</button>
      </div>
    </div>`;
      }).join('');
      document.getElementById('products-grid').replaceChildren(grid);
    }

    // ── Cart ──
    function addToCart(productId) {
      const p = allProducts.find(x => x.id === productId);
      if (!p || p.quantity === 0) return;
      const existing = cart.find(c => c.id === productId);
      const currQty = existing?.qty || 0;
      if (currQty >= p.quantity) { toast(`Max stock reached (${p.quantity})`); return; }
      if (existing) existing.qty++;
      else cart.push({ id: p.id, name: p.name, price: p.price, qty: 1, image_url: p.image_url });
      saveCart();
      toast(`${p.name} added to cart ✓`);
      renderProducts();
      renderCart();
    }

    function removeFromCart(id) {
      cart = cart.filter(c => c.id !== id);
      saveCart();
      renderCart();
      renderProducts();
    }

    function changeQty(id, delta) {
      const item = cart.find(c => c.id === id);
      const prod = allProducts.find(p => p.id === id);
      if (!item) return;
      item.qty += delta;
      if (item.qty <= 0) { removeFromCart(id); return; }
      if (prod && item.qty > prod.quantity) { item.qty = prod.quantity; toast('Max stock reached'); }
      saveCart();
      renderCart();
    }

    function saveCart() {
      localStorage.setItem('shopease_cart', JSON.stringify(cart));
      document.getElementById('cart-count').textContent = cart.reduce((s, c) => s + c.qty, 0);
    }

    function cartTotal() { return cart.reduce((s, c) => s + (c.price * c.qty), 0); }

    function renderCart() {
      const list = document.getElementById('cart-items-list');
      const total = cartTotal();
      document.getElementById('cart-total').textContent = '₹' + total.toLocaleString('en-IN');
      document.getElementById('checkout-btn').disabled = cart.length === 0;
      if (!cart.length) { list.innerHTML = '<div class="cart-empty"><div class="ce-icon">🛒</div><p>Your cart is empty</p></div>'; return; }
      list.innerHTML = cart.map(item => {
        const imgHtml = item.image_url
          ? `<img src="${item.image_url}" style="width:54px;height:54px;border-radius:10px;object-fit:cover;" onerror="this.parentElement.innerHTML='<div class=cart-item-img>🛍</div>'">`
          : `<div class="cart-item-img">🛍</div>`;
        return `<div class="cart-item">
      ${imgHtml}
      <div class="cart-item-info">
        <div class="cart-item-name">${esc(item.name)}</div>
        <div class="cart-item-price">₹${Number(item.price).toLocaleString('en-IN')} each</div>
        <div class="qty-ctrl">
          <button class="qty-btn" onclick="changeQty('${item.id}',-1)">−</button>
          <span class="qty-num">${item.qty}</span>
          <button class="qty-btn" onclick="changeQty('${item.id}',1)">+</button>
        </div>
      </div>
      <button class="remove-item" onclick="removeFromCart('${item.id}')">🗑</button>
    </div>`;
      }).join('');
    }

    function openCart() {
      document.getElementById('cart-drawer').classList.add('open');
      document.getElementById('overlay').classList.add('open');
      renderCart();
    }
    function closeCart() {
      document.getElementById('cart-drawer').classList.remove('open');
      document.getElementById('overlay').classList.remove('open');
    }

    // ── Checkout ──
    function openCheckout() {
      if (cart.length === 0) {
  toast('Add items first');
  return;
}
      closeCart();
      const summary = document.getElementById('order-summary');
      const total = cartTotal();
      summary.innerHTML = `<div class="order-summary-title">Order Summary</div>`
        + cart.map(i => `<div class="order-item-line"><span>${esc(i.name)} × ${i.qty}</span><span>₹${(i.price * i.qty).toLocaleString('en-IN')}</span></div>`).join('')
        + `<div class="order-item-line"><span>Total</span><span>₹${total.toLocaleString('en-IN')}</span></div>`;
      document.getElementById('checkout-modal').classList.add('show');
    }
    function closeCheckout() {
      document.getElementById('checkout-modal').classList.remove('show');
    }

    async function placeOrder() {

        // ❌ Block empty cart
  if (cart.length === 0) {
    toast('Cart is empty');
    return;
  }

      const name = document.getElementById('c-name').value.trim();
      if (!name) {
  toast('Enter your name');
  return;
}
      // const email = document.getElementById('c-email').value.trim();
      // const phone = document.getElementById('c-phone').value.trim();
      // const addr  = document.getElementById('c-addr').value.trim();
      // if (!name||!email||!phone||!addr) { toast('Please fill all required fields'); return; }
      const email = "noemail@shop.com";
      const phone = "0000000000";
      const addr = "Not provided";

      const btn = document.querySelector('.btn-place');
      btn.disabled = true; btn.textContent = 'Placing order…';

      const order = {
        customer_name: name,
        customer_email: email,
        customer_phone: phone,
        delivery_address: addr,
        // notes: document.getElementById('c-notes').value.trim()||null,
        notes: null,
        items: cart.map(i => ({ id: i.id, name: i.name, price: i.price, qty: i.qty })),
        total: cartTotal(),
        status: 'pending',
        created_at: new Date().toISOString()
      };

      const { error } = await db.from('orders').insert([order]);
      if (error) {
        toast('Failed to place order: ' + error.message);
        btn.disabled = false; btn.textContent = 'Place Order 🎉';
        return;
      }

      cart = [];
      saveCart();
      closeCheckout();
      document.getElementById('success-msg').textContent = `Thank you, ${name}! Your order has been received. We'll contact you on ${phone} shortly.`;
      document.querySelector('.hero').style.display = 'none';
      document.querySelector('.filters').style.display = 'none';
      document.querySelector('.products-section').style.display = 'none';
      document.getElementById('success-screen').style.display = 'flex';
      renderCart();
      btn.disabled = false;
      btn.textContent = 'Place Order 🎉';
    }

    function backToShop() {
      document.querySelector('.hero').style.display = '';
      document.querySelector('.filters').style.display = '';
      document.querySelector('.products-section').style.display = '';
      document.getElementById('success-screen').style.display = 'none';
    }

    // ── Real-time product updates ──
    db.channel('store-products')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'products' }, () => loadProducts())
      .subscribe();

    // ── Utilities ──
    function esc(s) { const d = document.createElement('div'); d.textContent = s || ''; return d.innerHTML }
    function toast(msg) {
      const t = document.getElementById('toast');
      t.textContent = msg; t.classList.add('show');
      setTimeout(() => t.classList.remove('show'), 2500);
    }

    // ── Init ──
    saveCart();
    renderCart();
    loadProducts();
