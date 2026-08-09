/* ==========================================================
   CravingGo frontend logic - now backed by the Express API
   (see backend/ for the server, and config.js for API_BASE_URL)
   ========================================================== */

var swiper = new Swiper('.mySwiper', {
    loop: true,
    navigation: {
        nextEl: '#next',
        prevEl: '#prev',
    },
});

// ---- DOM references ----
const cartIcon = document.querySelector('.cart-icon');
const cartTab = document.querySelector('.cart-tab');
const closeBtn = document.querySelector('.close-btn');
const cardList = document.querySelector('.card-list');
const cartList = document.querySelector('.cart-list');
const cartTotal = document.querySelector('.cart-total');
const cartValue = document.querySelector('.cart-value');
const hamburger = document.querySelector('.hamburger');
const mobileMenu = document.querySelector('.mobile-menu');
const bars = document.querySelector('.fa-bars');
const authButtons = document.querySelectorAll('.auth-btn');
const checkoutBtn = document.getElementById('checkout-btn');

const authModal = document.getElementById('auth-modal');
const authModalClose = document.getElementById('auth-modal-close');
const tabLogin = document.getElementById('tab-login');
const tabRegister = document.getElementById('tab-register');
const loginForm = document.getElementById('login-form');
const registerForm = document.getElementById('register-form');
const authError = document.getElementById('auth-error');

const checkoutModal = document.getElementById('checkout-modal');
const checkoutModalClose = document.getElementById('checkout-modal-close');
const checkoutForm = document.getElementById('checkout-form');
const checkoutError = document.getElementById('checkout-error');
const checkoutSuccess = document.getElementById('checkout-success');
const checkoutOrderId = document.getElementById('checkout-order-id');
const checkoutSuccessClose = document.getElementById('checkout-success-close');

cartIcon.addEventListener('click', () => cartTab.classList.add('cart-tab-active'));
closeBtn.addEventListener('click', () => cartTab.classList.remove('cart-tab-active'));
hamburger.addEventListener('click', () => mobileMenu.classList.toggle('mobile-menu-active'));
hamburger.addEventListener('click', () => bars.classList.toggle('fa-x'));

// ---- App state ----
let productList = [];       // products loaded from the API
let localCart = [];         // used only for guests (not persisted)
let backendCartItems = [];  // used once the user is logged in (persisted server-side)
let currentUser = JSON.parse(localStorage.getItem('cravinggo_user') || 'null');
let authToken = localStorage.getItem('cravinggo_token') || null;

// ==========================================================
// API helper
// ==========================================================
const apiFetch = async (path, options = {}) => {
    const headers = { 'Content-Type': 'application/json', ...(options.headers || {}) };
    if (authToken) headers.Authorization = `Bearer ${authToken}`;

    const res = await fetch(`${API_BASE_URL}${path}`, { ...options, headers });
    let data = null;
    try {
        data = await res.json();
    } catch (e) {
        // no JSON body
    }

    if (!res.ok) {
        throw new Error((data && data.message) || `Request failed (${res.status})`);
    }
    return data;
};

const formatPrice = (price) => `$${Number(price).toFixed(2)}`;

// ==========================================================
// Auth
// ==========================================================
const setSession = (user, token) => {
    currentUser = user;
    authToken = token;
    localStorage.setItem('cravinggo_user', JSON.stringify(user));
    localStorage.setItem('cravinggo_token', token);
    updateAuthUI();
};

const clearSession = () => {
    currentUser = null;
    authToken = null;
    localStorage.removeItem('cravinggo_user');
    localStorage.removeItem('cravinggo_token');
    backendCartItems = [];
    localCart = [];
    updateAuthUI();
    renderCart([]);
};

const updateAuthUI = () => {
    authButtons.forEach((btn) => {
        if (currentUser) {
            btn.innerHTML = `<i class="fa-solid fa-user"></i>&nbsp; ${currentUser.name.split(' ')[0]}`;
        } else {
            btn.innerHTML = `Sign in&nbsp;<i class="fa-solid fa-right-to-bracket"></i>`;
        }
    });
};

const openAuthModal = () => {
    authError.textContent = '';
    authModal.classList.add('modal-active');
};
const closeAuthModal = () => authModal.classList.remove('modal-active');

authButtons.forEach((btn) => {
    btn.addEventListener('click', (e) => {
        e.preventDefault();
        if (currentUser) {
            if (confirm(`Sign out of ${currentUser.name}'s account?`)) clearSession();
        } else {
            openAuthModal();
        }
    });
});

authModalClose.addEventListener('click', (e) => { e.preventDefault(); closeAuthModal(); });

tabLogin.addEventListener('click', (e) => {
    e.preventDefault();
    tabLogin.classList.add('active');
    tabRegister.classList.remove('active');
    loginForm.classList.remove('hidden');
    registerForm.classList.add('hidden');
    authError.textContent = '';
});

tabRegister.addEventListener('click', (e) => {
    e.preventDefault();
    tabRegister.classList.add('active');
    tabLogin.classList.remove('active');
    registerForm.classList.remove('hidden');
    loginForm.classList.add('hidden');
    authError.textContent = '';
});

// Merge any guest cart items into the backend cart once the user logs in
const syncGuestCartToBackend = async () => {
    for (const item of localCart) {
        try {
            await apiFetch('/cart', {
                method: 'POST',
                body: JSON.stringify({ productId: item.productId, quantity: item.quantity }),
            });
        } catch (err) {
            console.error('Failed to sync guest cart item:', err.message);
        }
    }
    localCart = [];
    await loadBackendCart();
};

loginForm.addEventListener('submit', async (e) => {
    e.preventDefault();
    authError.textContent = '';
    const email = document.getElementById('login-email').value.trim();
    const password = document.getElementById('login-password').value;

    try {
        const data = await apiFetch('/auth/login', { method: 'POST', body: JSON.stringify({ email, password }) });
        setSession(data.user, data.token);
        await syncGuestCartToBackend();
        closeAuthModal();
        loginForm.reset();
    } catch (err) {
        authError.textContent = err.message;
    }
});

registerForm.addEventListener('submit', async (e) => {
    e.preventDefault();
    authError.textContent = '';
    const name = document.getElementById('register-name').value.trim();
    const email = document.getElementById('register-email').value.trim();
    const password = document.getElementById('register-password').value;

    try {
        const data = await apiFetch('/auth/register', { method: 'POST', body: JSON.stringify({ name, email, password }) });
        setSession(data.user, data.token);
        await syncGuestCartToBackend();
        closeAuthModal();
        registerForm.reset();
    } catch (err) {
        authError.textContent = err.message;
    }
});

// ==========================================================
// Products
// ==========================================================
const showCards = () => {
    cardList.innerHTML = '';

    productList.forEach((product) => {
        const orderCard = document.createElement('div');
        orderCard.classList.add('order-card');

        orderCard.innerHTML = `
        <div class="card-image">
            <img src="${product.image}">
        </div>
        <h5>${product.name}</h5>
        <h5 class="price">${formatPrice(product.price)}</h5>
        <a href="#" class="btn  card-btn">Add to cart</a>
        `;

        cardList.appendChild(orderCard);

        const cardBtn = orderCard.querySelector('.card-btn');
        cardBtn.addEventListener('click', (e) => {
            e.preventDefault();
            addToCart(product);
        });
    });
};

// ==========================================================
// Cart (guest: local only | logged-in: synced with backend)
// ==========================================================
const renderCart = (items) => {
    cartList.innerHTML = '';

    items.forEach((item) => {
        const itemId = item.productId || item.product;
        const cartItem = document.createElement('div');
        cartItem.classList.add('item');
        cartItem.dataset.productId = itemId;

        cartItem.innerHTML = `
        <div class="item-image">
            <img src="${item.image}">
        </div>

        <div class="detail">
            <h4>${item.name}</h4>
            <h4 class="item-total">${formatPrice(item.price * item.quantity)}</h4>
        </div>
        <div class="flex">
            <a href="#" class="quantity-btn  minus">
                <i class="fa-solid fa-minus"></i>
            </a>
            <h4 class="quantity-value">${item.quantity}</h4>
            <a href="#" class="quantity-btn  plus">
                <i class="fa-solid fa-plus"></i>
            </a>
        </div>
        `;

        cartList.appendChild(cartItem);

        cartItem.querySelector('.plus').addEventListener('click', (e) => {
            e.preventDefault();
            changeQuantity(itemId, item.quantity + 1);
        });

        cartItem.querySelector('.minus').addEventListener('click', (e) => {
            e.preventDefault();
            changeQuantity(itemId, item.quantity - 1);
        });
    });

    updateTotals(items);
};

const updateTotals = (items) => {
    const totalPrice = items.reduce((sum, item) => sum + item.price * item.quantity, 0);
    const totalQuantity = items.reduce((sum, item) => sum + item.quantity, 0);
    cartTotal.textContent = formatPrice(totalPrice);
    cartValue.textContent = totalQuantity;
};

const loadBackendCart = async () => {
    try {
        const data = await apiFetch('/cart');
        backendCartItems = data.cart.items.map((i) => ({
            productId: i.product,
            name: i.name,
            price: i.price,
            image: i.image,
            quantity: i.quantity,
        }));
        renderCart(backendCartItems);
    } catch (err) {
        console.error('Failed to load cart:', err.message);
    }
};

const addToCart = async (product) => {
    if (currentUser) {
        try {
            const data = await apiFetch('/cart', {
                method: 'POST',
                body: JSON.stringify({ productId: product._id, quantity: 1 }),
            });
            backendCartItems = data.cart.items.map((i) => ({
                productId: i.product, name: i.name, price: i.price, image: i.image, quantity: i.quantity,
            }));
            renderCart(backendCartItems);
        } catch (err) {
            alert(err.message);
        }
        return;
    }

    // Guest flow - local only, not persisted
    const existing = localCart.find((item) => item.productId === product._id);
    if (existing) {
        alert('Item already in your cart!');
        return;
    }
    localCart.push({ productId: product._id, name: product.name, price: product.price, image: product.image, quantity: 1 });
    renderCart(localCart);
};

const changeQuantity = async (productId, newQuantity) => {
    if (currentUser) {
        try {
            const data = newQuantity < 1
                ? await apiFetch(`/cart/${productId}`, { method: 'DELETE' })
                : await apiFetch(`/cart/${productId}`, { method: 'PUT', body: JSON.stringify({ quantity: newQuantity }) });

            backendCartItems = data.cart.items.map((i) => ({
                productId: i.product, name: i.name, price: i.price, image: i.image, quantity: i.quantity,
            }));
            renderCart(backendCartItems);
        } catch (err) {
            alert(err.message);
        }
        return;
    }

    if (newQuantity < 1) {
        localCart = localCart.filter((item) => item.productId !== productId);
    } else {
        const item = localCart.find((item) => item.productId === productId);
        if (item) item.quantity = newQuantity;
    }
    renderCart(localCart);
};

// ==========================================================
// Checkout
// ==========================================================
const openCheckoutModal = () => {
    checkoutError.textContent = '';
    checkoutSuccess.classList.add('hidden');
    checkoutForm.classList.remove('hidden');
    checkoutModal.classList.add('modal-active');
};
const closeCheckoutModal = () => checkoutModal.classList.remove('modal-active');

checkoutBtn.addEventListener('click', (e) => {
    e.preventDefault();

    if (!currentUser) {
        alert('Please sign in to check out.');
        openAuthModal();
        return;
    }

    if (backendCartItems.length === 0) {
        alert('Your cart is empty.');
        return;
    }

    cartTab.classList.remove('cart-tab-active');
    openCheckoutModal();
});

checkoutModalClose.addEventListener('click', (e) => { e.preventDefault(); closeCheckoutModal(); });
checkoutSuccessClose.addEventListener('click', (e) => { e.preventDefault(); closeCheckoutModal(); });

checkoutForm.addEventListener('submit', async (e) => {
    e.preventDefault();
    checkoutError.textContent = '';

    const shippingAddress = {
        line1: document.getElementById('checkout-line1').value.trim(),
        city: document.getElementById('checkout-city').value.trim(),
        postalCode: document.getElementById('checkout-postal').value.trim(),
        country: document.getElementById('checkout-country').value.trim(),
        phone: document.getElementById('checkout-phone').value.trim(),
    };
    const paymentMethod = document.querySelector('input[name="payment-method"]:checked').value;

    try {
        const orderData = await apiFetch('/orders', {
            method: 'POST',
            body: JSON.stringify({ shippingAddress, paymentMethod }),
        });
        const order = orderData.order;

        // Card payments: create a payment intent and confirm it.
        // In mock/dev mode (no Stripe key on the server) this auto-confirms so the
        // flow works end to end. In real Stripe mode, replace this block with
        // Stripe.js/Elements to collect card details and confirm the PaymentIntent
        // using the returned clientSecret.
        if (paymentMethod === 'card') {
            const intentData = await apiFetch('/payments/create-intent', {
                method: 'POST',
                body: JSON.stringify({ orderId: order._id }),
            });

            if (intentData.mode === 'mock') {
                await apiFetch('/payments/confirm-mock', {
                    method: 'POST',
                    body: JSON.stringify({ orderId: order._id }),
                });
            }
        }

        backendCartItems = [];
        renderCart([]);
        checkoutForm.classList.add('hidden');
        checkoutOrderId.textContent = `Order ID: ${order._id}`;
        checkoutSuccess.classList.remove('hidden');
        checkoutForm.reset();
    } catch (err) {
        checkoutError.textContent = err.message;
    }
});

// ==========================================================
// Init
// ==========================================================
const initApp = async () => {
    updateAuthUI();

    try {
        const data = await apiFetch('/products');
        productList = data.products;
    } catch (err) {
        console.error('Failed to load products from API, falling back to local products.json:', err.message);
        const res = await fetch('products.json');
        const raw = await res.json();
        productList = raw.map((p) => ({ ...p, _id: String(p.id), price: parseFloat(String(p.price).replace('$', '')) }));
    }

    showCards();

    if (currentUser) {
        await loadBackendCart();
    }
};

initApp();
