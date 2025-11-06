const price = 150;       // kr per enhet
const shippingFlat = 0;  // Gratis frakt (ord. 200 kr – rabatt)

function kr(n){ return `${n} kr`; }

function recalc(){
  const qty = Math.max(1, parseInt(document.querySelector('#qty').value || '1', 10));
  const subtotal = price * qty;
  const shipping = shippingFlat;
  const total = subtotal + shipping;
  document.querySelector('#subtotal').textContent = kr(subtotal);
  document.querySelector('#shipping').textContent = kr(shipping);
  document.querySelector('#total').textContent = kr(total);
}

document.addEventListener('DOMContentLoaded', () => {
  const y = document.getElementById('year');
  if (y) y.textContent = new Date().getFullYear();
  const qtyEl = document.querySelector('#qty');
  if (qtyEl) qtyEl.addEventListener('input', recalc);
  recalc();

  const form = document.getElementById('orderForm');
  form.addEventListener('submit', async (e) => {
    e.preventDefault();

    const qty = Math.max(1, parseInt(document.querySelector('#qty').value || '1', 10));
    const name = document.getElementById('name').value.trim();
    const email = document.getElementById('email').value.trim();
    const address = document.getElementById('address').value.trim();
    if(!name || !email || !address){
      alert('Fyll i namn, e-post och adress.');
      return;
    }

    const subtotal = price * qty;
    const total = subtotal + shippingFlat;

    try {
      const res = await fetch('/api/checkout', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name, email, address, qty, total })
      });
      const data = await res.json();
      if(!res.ok){ throw new Error(data.error || 'Något gick fel'); }
      window.location.href = `/pay.html?orderId=${encodeURIComponent(data.orderId)}`;
    } catch (err){
      alert(err.message || 'Kunde inte skapa beställning.');
    }
  });
});
