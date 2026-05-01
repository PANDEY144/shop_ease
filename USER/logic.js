
// ── CONFIG — REPLACE THESE ──
    //const SUPABASE_URL  = 'https://YOUR_PROJECT_ID.supabase.co';
    //const SUPABASE_ANON = 'YOUR_ANON_PUBLIC_KEY';

    const SUPABASE_URL = 'https://jhrefpiuklbfamrbqpro.supabase.co';
    const SUPABASE_ANON = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImpocmVmcGl1a2xiZmFtcmJxcHJvIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzY1MDY5ODMsImV4cCI6MjA5MjA4Mjk4M30.zkKbT4ByzyHPVIGR-1SRw4_fXc1wKbusvtrXHP2jz4M';
    // ────────────────────────────

    const { createClient } = supabase;
    const db = createClient(SUPABASE_URL, SUPABASE_ANON);
    const API_BASE_URL = (
      window.SHOP_EASE_API_BASE_URL ||
      'https://paying-outward-entrap.ngrok-free.dev'
    ).replace(/\/$/, '');
    const API_HEADERS = {
      'Content-Type': 'application/json',
      'ngrok-skip-browser-warning': 'true'
    };

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

    function normalizePaymentStatus(rawStatus) {
      return rawStatus === 'paid' ? 'success' : 'failed';
    }

    function renderOrderHistory(orders) {
      const list = document.getElementById('order-history-list');
      if (!orders.length) {
        list.innerHTML = '<div class="empty-state"><div class="em-icon">📭</div><p>No orders found for this name.</p></div>';
        return;
      }

      list.innerHTML = orders.map(order => {
        const items = Array.isArray(order.items) ? order.items : [];
        const paymentStatus = normalizePaymentStatus(order.payment_status);
        const createdAt = order.created_at
          ? new Date(order.created_at).toLocaleString('en-IN')
          : 'Unknown time';

        const itemLines = items.length
          ? items.map(item => {
            const qty = Number(item.qty || 0);
            const price = Number(item.price || 0);
            return `<div class="history-item-row"><span>${esc(item.name || 'Item')} × ${qty}</span><span>₹${(price * qty).toLocaleString('en-IN')}</span></div>`;
          }).join('')
          : '<div class="history-item-row"><span>No items found</span><span>—</span></div>';

        return `<article class="order-history-card">
          <div class="order-history-top">
            <div>
              <div class="order-history-name">${esc(order.customer_name || 'Customer')}</div>
              <div class="order-history-time">${esc(createdAt)}</div>
            </div>
            <span class="payment-badge ${paymentStatus}">${paymentStatus}</span>
          </div>
          ${itemLines}
        </article>`;
      }).join('');
    }

    async function loadOrderHistory() {
      const nameInput = document.getElementById('history-name');
      const name = nameInput.value.trim();
      if (!name) {
        toast('Enter your name to view order history');
        nameInput.focus();
        return;
      }

      const list = document.getElementById('order-history-list');
      list.innerHTML = '<div class="loader"><div class="loader-ring"></div><p style="color:var(--muted)">Loading order history…</p></div>';

      const { data, error } = await db
        .from('orders')
        .select('customer_name,items,payment_status,created_at')
        .ilike('customer_name', name)
        .order('created_at', { ascending: false });

      if (error) {
        list.innerHTML = '<div class="empty-state"><div class="em-icon">⚠️</div><p>Could not load order history.</p></div>';
        toast('Failed to load order history');
        return;
      }

      renderOrderHistory(data || []);
    }

    async function decrementProductStock(items) {
      const ids = items.map(item => item.id).filter(Boolean);
      if (!ids.length) return;

      const { data: products, error: fetchError } = await db
        .from('products')
        .select('id,quantity')
        .in('id', ids);

      if (fetchError) throw new Error(fetchError.message);

      const productById = new Map((products || []).map(product => [product.id, product]));
      const updatedAt = new Date().toISOString();
      const updates = items.map(item => {
        const product = productById.get(item.id);
        const orderedQty = Number(item.qty || 0);
        if (!product) throw new Error(`${item.name} is no longer available`);

        const currentQty = Number(product.quantity || 0);
        if (orderedQty <= 0 || currentQty < orderedQty) {
          throw new Error(`${item.name} has only ${currentQty} left`);
        }

        return {
          id: item.id,
          quantity: currentQty - orderedQty,
          updated_at: updatedAt
        };
      });

      const results = await Promise.all(updates.map(({ id, ...payload }) =>
        db.from('products').update(payload).eq('id', id)
      ));
      const failedUpdate = results.find(result => result.error);
      if (failedUpdate) throw new Error(failedUpdate.error.message);

      allProducts = allProducts.map(product => {
        const update = updates.find(item => item.id === product.id);
        return update ? { ...product, quantity: update.quantity, updated_at: update.updated_at } : product;
      });
      renderProducts();
    }

    async function placeOrder() {
      if (cart.length === 0) { toast('Cart is empty'); return; }

      const name = document.getElementById('c-name').value.trim();
      if (!name) { toast('Enter your name'); return; }

      const email = "noemail@shop.com";
      const phone = "0000000000";
      const addr = "Not provided";
      const totalInRupees = cartTotal();
      const totalInPaise = Math.round(totalInRupees * 100);
      if (totalInPaise < 100) { toast('Minimum order value is ₹1'); return; }

      const btn = document.querySelector('.btn-place');
      btn.disabled = true;
      btn.textContent = 'Preparing payment…';

      try {
        const createOrderRes = await fetch(`${API_BASE_URL}/api/create-order`, {
          method: 'POST',
          headers: API_HEADERS,
          body: JSON.stringify({
            amount: totalInPaise,
            currency: 'INR',
            receipt: `receipt_${Date.now()}`
          })
        });

        const createOrderData = await createOrderRes.json();
        if (!createOrderRes.ok) {
          throw new Error(createOrderData.error || 'Failed to create payment order');
        }

        const options = {
          key: createOrderData.key_id,
          amount: createOrderData.amount,
          currency: createOrderData.currency,
          name: 'ShopEase',
          description: 'Order payment',
          order_id: createOrderData.order_id,
          prefill: { name, email, contact: phone },
          theme: { color: '#6c63ff' },
          handler: async function (response) {
            try {
              const verifyRes = await fetch(`${API_BASE_URL}/api/verify-payment`, {
                method: 'POST',
                headers: API_HEADERS,
                body: JSON.stringify({
                  razorpay_order_id: response.razorpay_order_id,
                  razorpay_payment_id: response.razorpay_payment_id,
                  razorpay_signature: response.razorpay_signature
                })
              });

              const verifyData = await verifyRes.json();
              if (!verifyRes.ok || !verifyData.success) {
                throw new Error(verifyData.error || 'Payment verification failed');
              }

              const orderItems = cart.map(i => ({ id: i.id, name: i.name, price: i.price, qty: i.qty }));
              const order = {
                customer_name: name,
                customer_email: email,
                customer_phone: phone,
                delivery_address: addr,
                notes: null,
                items: orderItems,
                total: totalInRupees,
                status: 'pending',
                payment_id: response.razorpay_payment_id,
                payment_order_id: response.razorpay_order_id,
                payment_status: 'paid',
                created_at: new Date().toISOString()
              };

              const { error } = await db.from('orders').insert([order]);
              if (error) throw new Error(error.message);
              await decrementProductStock(orderItems);

              try {
                const emailHtml = `
                  <h2>New Order Received!</h2>
                  <p><strong>Customer Name:</strong> ${name}</p>
                  <p><strong>Order ID:</strong> ${response.razorpay_order_id}</p>
                  <p><strong>Payment ID:</strong> ${response.razorpay_payment_id}</p>
                  <p><strong>Total:</strong> ₹${totalInRupees.toLocaleString('en-IN')}</p>
                  <h3>Items Ordered:</h3>
                  <ul>
                    ${orderItems.map(i => `<li>${i.name} &times; ${i.qty} (&#8377;${(i.price * i.qty).toLocaleString('en-IN')})</li>`).join('')}
                  </ul>
                `;
                
                await fetch(`${API_BASE_URL}/api/send-email`, {
                  method: 'POST',
                  headers: API_HEADERS,
                  body: JSON.stringify({
                    to: 'pamdeygaurav911@gmail.com',
                    subject: `New Order Placed by ${name}`,
                    html: emailHtml
                  })
                });
              } catch (emailErr) {
                console.error('Failed to send email notification:', emailErr);
              }

              cart = [];
              saveCart();
              closeCheckout();
              document.getElementById('success-msg').textContent = `Thank you, ${name}! Your payment was successful and your order has been received.`;
              document.getElementById('history-name').value = name;
              loadOrderHistory();
              document.querySelector('.hero').style.display = 'none';
              document.querySelector('.filters').style.display = 'none';
              document.querySelector('.products-section').style.display = 'none';
              document.getElementById('success-screen').style.display = 'flex';
              renderCart();
              toast('Payment successful');
            } catch (err) {
              toast(`Order failed: ${err.message}`);
            } finally {
              btn.disabled = false;
              btn.textContent = 'Place Order 🎉';
            }
          },
          modal: {
            ondismiss: function () {
              btn.disabled = false;
              btn.textContent = 'Place Order 🎉';
              toast('Payment cancelled');
            }
          }
        };

        const rzp = new Razorpay(options);
        rzp.on('payment.failed', function (response) {
          btn.disabled = false;
          btn.textContent = 'Place Order 🎉';
          toast(response.error && response.error.description ? response.error.description : 'Payment failed');
        });
        rzp.open();
      } catch (error) {
        toast(error.message || 'Unable to start checkout');
        btn.disabled = false;
        btn.textContent = 'Place Order 🎉';
      }
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
