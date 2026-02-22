export function calculatePrice(pricePerDay, pickupDate, returnDate) {
    if (!pickupDate || !returnDate) return { days: 0, total: 0, deposit: 0 };

    const pickup = new Date(pickupDate);
    const returnD = new Date(returnDate);
    const diffTime = returnD.getTime() - pickup.getTime();
    const days = Math.ceil(diffTime / (1000 * 60 * 60 * 24));

    if (days <= 0) return { days: 0, total: 0, deposit: 0 };

    const total = days * pricePerDay;
    const deposit = Math.ceil(total * 0.3); // 30% deposit

    return { days, total, deposit };
}

export function formatMYR(amount) {
    return new Intl.NumberFormat('ms-MY', {
        style: 'currency',
        currency: 'MYR',
        minimumFractionDigits: 0,
        maximumFractionDigits: 0,
    }).format(amount);
}
