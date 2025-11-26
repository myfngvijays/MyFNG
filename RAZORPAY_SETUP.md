# 💳 Razorpay Payment Integration - Setup Complete

**Date:** November 26, 2025  
**Status:** ✅ **COMPLETE**

---

## 🔑 Razorpay Keys Configured

### Live Keys (Production):
- **Key ID:** `rzp_live_Rgt6qLXXubyJqO`
- **Key Secret:** `tyYNU0O5YumXdWH20imreikK`

---

## 📋 Environment Variables

Add these to your `.env.local` file (for local development):

```env
# Razorpay Configuration
NEXT_PUBLIC_RAZORPAY_KEY_ID=rzp_live_Rgt6qLXXubyJqO
RAZORPAY_KEY_SECRET=tyYNU0O5YumXdWH20imreikK
RAZORPAY_WEBHOOK_SECRET=your_webhook_secret_here
```

**Note:** 
- `NEXT_PUBLIC_RAZORPAY_KEY_ID` - Public key (safe to expose in frontend)
- `RAZORPAY_KEY_SECRET` - Secret key (server-side only, never expose)
- `RAZORPAY_WEBHOOK_SECRET` - Get from Razorpay Dashboard → Settings → Webhooks

---

## ✅ What's Implemented

### 1. **Payment Order Creation API** ✅
**File:** `apps/web/src/app/api/payments/create-order/route.ts`

- ✅ Creates Razorpay order via API
- ✅ Validates invoice
- ✅ Creates payment transaction record
- ✅ Returns order details for checkout

**Endpoint:** `POST /api/payments/create-order`

**Request:**
```json
{
  "invoiceId": "uuid",
  "amount": 6890.00,
  "customerEmail": "customer@example.com",
  "customerPhone": "+919876543210"
}
```

**Response:**
```json
{
  "success": true,
  "order": {
    "orderId": "order_xxxxx",
    "amount": 689000,
    "currency": "INR",
    "receipt": "INV_2025-000178"
  }
}
```

---

### 2. **Payment Verification API** ✅
**File:** `apps/web/src/app/api/payments/verify/route.ts`

- ✅ Verifies payment signature
- ✅ Fetches payment details from Razorpay
- ✅ Updates invoice status
- ✅ Updates lead status
- ✅ Creates payment transaction record
- ✅ Logs payment in history

**Endpoint:** `POST /api/payments/verify`

**Request:**
```json
{
  "orderId": "order_xxxxx",
  "paymentId": "pay_xxxxx",
  "signature": "signature_hash",
  "invoiceId": "uuid"
}
```

---

### 3. **Webhook Handler** ✅
**File:** `apps/web/src/app/api/payments/webhook/route.ts`

- ✅ Handles Razorpay webhook events
- ✅ Verifies webhook signature
- ✅ Processes payment.captured event
- ✅ Processes payment.failed event
- ✅ Updates database automatically

**Endpoint:** `POST /api/payments/webhook`

**Webhook URL to configure in Razorpay Dashboard:**
```
https://yourdomain.com/api/payments/webhook
```

**Events to Subscribe:**
- `payment.captured`
- `payment.authorized`
- `payment.failed`
- `order.paid`

---

### 4. **Payment Button Component** ✅
**File:** `apps/web/src/components/payment/RazorpayPaymentButton.tsx`

- ✅ Loads Razorpay script dynamically
- ✅ Creates payment order
- ✅ Opens Razorpay checkout
- ✅ Handles payment success/failure
- ✅ Verifies payment on server
- ✅ Updates UI based on status

**Usage:**
```tsx
<RazorpayPaymentButton
  invoiceId={invoice.id}
  amount={invoice.final_amount}
  customerName="Rahul Sharma"
  customerEmail="rahul@example.com"
  customerPhone="+919876543210"
  invoiceNumber={invoice.invoice_number}
  onPaymentSuccess={(data) => {
    console.log('Payment successful:', data);
  }}
  onPaymentFailure={(error) => {
    console.error('Payment failed:', error);
  }}
/>
```

---

### 5. **Payment Service** ✅
**File:** `apps/web/src/lib/services/paymentService.ts`

- ✅ `createPaymentOrder()` - Create Razorpay order
- ✅ `verifyPayment()` - Verify payment signature
- ✅ `initializeRazorpayCheckout()` - Open checkout modal
- ✅ `loadRazorpayScript()` - Load Razorpay SDK
- ✅ `savePaymentRecord()` - Save to database
- ✅ Utility functions for amount conversion

---

## 🔧 Razorpay Dashboard Setup

### 1. **Configure Webhook URL**

1. Go to [Razorpay Dashboard](https://dashboard.razorpay.com)
2. Navigate to **Settings** → **Webhooks**
3. Click **Add New Webhook**
4. Enter URL: `https://yourdomain.com/api/payments/webhook`
5. Select Events:
   - ✅ `payment.captured`
   - ✅ `payment.authorized`
   - ✅ `payment.failed`
   - ✅ `order.paid`
6. Copy **Webhook Secret** and add to `.env.local`

### 2. **Test Mode (Optional)**

For testing, you can use test keys:
- Test Key ID: `rzp_test_xxxxx`
- Test Key Secret: `xxxxx`

Update `.env.local` with test keys for development.

---

## 📱 Payment Flow

### Step-by-Step:

1. **Customer clicks "Pay Now"**
   - Component calls `createPaymentOrder()`
   - API creates Razorpay order
   - Returns order details

2. **Razorpay Checkout Opens**
   - Customer enters payment details
   - Selects payment method (UPI/Card/Netbanking/Wallet)

3. **Payment Success**
   - Razorpay returns payment response
   - Component calls `verifyPayment()` API
   - API verifies signature
   - Updates invoice & lead status
   - Shows success message

4. **Webhook (Backup)**
   - Razorpay sends webhook event
   - Webhook handler processes event
   - Updates database if needed

---

## 🧪 Testing

### Test Payment Methods:

1. **UPI:**
   - Use any UPI ID: `success@razorpay`
   - Payment will be successful

2. **Card:**
   - Card Number: `4111 1111 1111 1111`
   - CVV: Any 3 digits
   - Expiry: Any future date

3. **Netbanking:**
   - Select any bank
   - Use test credentials

### Test Scenarios:

1. ✅ Successful payment
2. ✅ Failed payment
3. ✅ Payment verification
4. ✅ Webhook processing
5. ✅ Invoice status update
6. ✅ Lead status update

---

## 🔒 Security Notes

1. ✅ **Never expose `RAZORPAY_KEY_SECRET`** in frontend code
2. ✅ **Always verify payment signature** on server
3. ✅ **Use HTTPS** in production
4. ✅ **Validate webhook signature** before processing
5. ✅ **Store webhook secret** securely

---

## 📊 Database Updates

Payment transactions are stored in:
- `payment_transactions` table
- `invoices` table (payment status)
- `service_leads` table (payment status)
- `lead_status_history` table (payment logs)

---

## 🚀 Production Checklist

- [x] Razorpay keys configured
- [x] Payment order API implemented
- [x] Payment verification API implemented
- [x] Webhook handler implemented
- [x] Payment button component created
- [ ] Webhook URL configured in Razorpay Dashboard
- [ ] Webhook secret added to environment variables
- [ ] Test payments completed
- [ ] Production domain configured
- [ ] HTTPS enabled

---

## 📝 API Endpoints Summary

| Endpoint | Method | Purpose |
|----------|--------|---------|
| `/api/payments/create-order` | POST | Create Razorpay order |
| `/api/payments/verify` | POST | Verify payment |
| `/api/payments/webhook` | POST | Handle Razorpay webhooks |
| `/api/payments/invoices/[id]/record-payment` | POST | Record offline payment |
| `/api/payments/invoices/[id]/add-remarks` | POST | Add payment remarks |

---

## 🎯 Next Steps

1. **Add Webhook Secret** to `.env.local`
2. **Configure Webhook URL** in Razorpay Dashboard
3. **Test Payment Flow** with test cards
4. **Integrate Payment Button** in invoice pages
5. **Test Webhook** events

---

**Status:** ✅ **READY FOR TESTING**  
**Last Updated:** November 26, 2025

