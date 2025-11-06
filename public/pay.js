function getParam(name){ return new URLSearchParams(location.search).get(name); }

document.addEventListener('DOMContentLoaded', () => {
  const orderId = getParam('orderId');
  if(!orderId){
    document.querySelector('.buy__card').innerHTML = '<p>Saknar orderId. Gå tillbaka till <a href="/">butiken</a>.</p>';
    return;
  }
  document.getElementById('orderInfo').textContent = `Order-ID: ${orderId}`;

  document.getElementById('payForm').addEventListener('submit', async (e) => {
    e.preventDefault();
    const cardName = document.getElementById('cardName').value.trim();
    const cardNumber = document.getElementById('cardNumber').value.replace(/\s+/g,'');
    const exp = document.getElementById('exp').value.trim();
    const cvc = document.getElementById('cvc').value.trim();
    if(!cardName || !cardNumber || !exp || !cvc){ alert('Fyll i alla kortuppgifter.'); return; }

    try {
      const res = await fetch('/api/pay', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ orderId, cardName, cardNumber, exp, cvc })
      });
      const data = await res.json();
      if(!res.ok){ throw new Error(data.error || 'Betalning misslyckades'); }
      alert('Betalning klar! Tack för ditt köp.');
      window.location.href = '/';
    } catch (err){
      alert(err.message || 'Betalning misslyckades.');
    }
  });
});
