async function api(path, options={}){
  const res = await fetch(path, {
    headers: { 'Content-Type': 'application/json' },
    credentials: 'same-origin',
    ...options
  });
  const data = await res.json().catch(()=>({}));
  if(!res.ok) throw new Error(data.error || 'Något gick fel');
  return data;
}

async function deleteOrder(id){
  if(!confirm('Ta bort denna beställning?')) return;
  await api(`/api/admin/orders/${encodeURIComponent(id)}`, { method: 'DELETE' });
  await loadOrders();
}

async function loadOrders(){
  const data = await api('/api/admin/orders');
  const tbody = document.querySelector('#ordersTable tbody');
  tbody.innerHTML = '';
  data.orders.forEach(o => {
    const tr = document.createElement('tr');
    const paid = o.status === 'paid';
    tr.innerHTML = `
      <td>${new Date(o.createdAt).toLocaleString()}</td>
      <td>${o.name}</td>
      <td>${o.email}</td>
      <td class="addr">${o.address || ''}</td>
      <td>${o.qty}</td>
      <td>${o.total} ${o.currency || 'SEK'}</td>
      <td>${paid ? 'Betald' : 'Väntar'}</td>
      <td>${o.payment && o.payment.last4 ? o.payment.last4 : '-'}</td>
      <td class="actions">
        <button class="btn btn-danger" data-id="${o.id}">Radera</button>
      </td>
    `;
    tbody.appendChild(tr);
  });

  // Bind delete buttons
  tbody.querySelectorAll('button.btn-danger').forEach(btn => {
    btn.addEventListener('click', () => deleteOrder(btn.getAttribute('data-id')));
  });
}

document.addEventListener('DOMContentLoaded', () => {
  const loginBox = document.getElementById('loginBox');
  const adminBox = document.getElementById('adminBox');

  document.getElementById('loginForm').addEventListener('submit', async (e) => {
    e.preventDefault();
    const username = document.getElementById('username').value.trim();
    const password = document.getElementById('password').value.trim();
    try {
      await api('/api/admin/login', { method: 'POST', body: JSON.stringify({ username, password }) });
      loginBox.style.display = 'none';
      adminBox.style.display = 'block';
      loadOrders();
    } catch (err){
      alert(err.message);
    }
  });

  document.getElementById('logoutBtn').addEventListener('click', async () => {
    await api('/api/admin/logout', { method: 'POST' });
    adminBox.style.display = 'none';
    loginBox.style.display = 'block';
  });
});
