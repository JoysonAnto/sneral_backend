import puppeteer from 'puppeteer';
import prisma from '../config/database';

export class PDFGeneratorService {
    async generateInvoicePDF(invoiceId: string): Promise<Buffer> {
        // Fetch invoice with all related data
        const invoice = await prisma.offlineInvoice.findUnique({
            where: { id: invoiceId },
            include: {
                customer: true,
                items: {
                    include: {
                        service: true,
                    },
                },
                payments: true,
                business_partner: {
                    include: {
                        user: true,
                    },
                },
            },
        });

        if (!invoice) {
            throw new Error('Invoice not found');
        }

        const html = this.generateInvoiceHTML(invoice);

        // Generate PDF using puppeteer
        const browser = await puppeteer.launch({
            headless: true,
            args: ['--no-sandbox', '--disable-setuid-sandbox'],
        });

        const page = await browser.newPage();
        await page.setContent(html, { waitUntil: 'networkidle0' });

        const pdf = await page.pdf({
            format: 'A4',
            printBackground: true,
            margin: {
                top: '20mm',
                right: '15mm',
                bottom: '20mm',
                left: '15mm',
            },
        });

        await browser.close();

        return Buffer.from(pdf);
    }

    private generateInvoiceHTML(invoice: any): string {
        const businessPartner = invoice.business_partner;
        const customer = invoice.customer;
        const items = invoice.items;

        return `
<!DOCTYPE html>
<html>
<head>
    <meta charset="UTF-8">
    <style>
        * {
            margin: 0;
            padding: 0;
            box-sizing: border-box;
        }
        body {
            font-family: 'Arial', sans-serif;
            color: #333;
            line-height: 1.6;
        }
        .invoice-container {
            max-width: 800px;
            margin: 0 auto;
            padding: 40px;
        }
        .header {
            display: flex;
            justify-content: space-between;
            align-items: start;
            margin-bottom: 40px;
            border-bottom: 3px solid #8b5cf6;
            padding-bottom: 20px;
        }
        .company-info h1 {
            color: #8b5cf6;
            font-size: 32px;
            margin-bottom: 10px;
        }
        .company-info p {
            color: #666;
            font-size: 14px;
        }
        .invoice-info {
            text-align: right;
        }
        .invoice-number {
            font-size: 24px;
            font-weight: bold;
            color: #8b5cf6;
            margin-bottom: 10px;
        }
        .invoice-status {
            display: inline-block;
            padding: 5px 15px;
            border-radius: 20px;
            font-size: 12px;
            font-weight: bold;
            ${invoice.status === 'PAID' ? 'background: #10b981; color: white;' :
                invoice.status === 'SENT' ? 'background: #3b82f6; color: white;' :
                    invoice.status === 'OVERDUE' ? 'background: #ef4444; color: white;' :
                        'background: #e5e7eb; color: #6b7280;'}
        }
        .addresses {
            display: flex;
            justify-content: space-between;
            margin-bottom: 40px;
        }
        .address-block {
            flex: 1;
        }
        .address-block h3 {
            color: #8b5cf6;
            font-size: 14px;
            margin-bottom: 10px;
            text-transform: uppercase;
        }
        .address-block p {
            font-size: 14px;
            margin-bottom: 5px;
        }
        .items-table {
            width: 100%;
            border-collapse: collapse;
            margin-bottom: 30px;
        }
        .items-table thead {
            background: #f3f4f6;
        }
        .items-table th {
            padding: 15px;
            text-align: left;
            font-size: 12px;
            font-weight: bold;
            color: #6b7280;
            text-transform: uppercase;
            border-bottom: 2px solid #e5e7eb;
        }
        .items-table td {
            padding: 15px;
            border-bottom: 1px solid #e5e7eb;
            font-size: 14px;
        }
        .items-table .text-right {
            text-align: right;
        }
        .totals {
            margin-left: auto;
            width: 300px;
        }
        .total-row {
            display: flex;
            justify-content: space-between;
            padding: 10px 0;
            font-size: 14px;
        }
        .total-row.subtotal {
            border-top: 1px solid #e5e7eb;
        }
        .total-row.grand-total {
            border-top: 2px solid #8b5cf6;
            font-size: 18px;
            font-weight: bold;
            color: #8b5cf6;
            padding-top: 15px;
            margin-top: 10px;
        }
        .notes {
            margin-top: 40px;
            padding: 20px;
            background: #f9fafb;
            border-left: 4px solid #8b5cf6;
        }
        .notes h3 {
            color: #8b5cf6;
            margin-bottom: 10px;
            font-size: 14px;
        }
        .notes p {
            font-size: 13px;
            color: #666;
        }
        .footer {
            margin-top: 50px;
            padding-top: 20px;
            border-top: 1px solid #e5e7eb;
            text-align: center;
            color: #9ca3af;
            font-size: 12px;
        }
        .payment-info {
            margin-top: 30px;
            padding: 15px;
            background: #fef3c7;
            border-left: 4px solid #f59e0b;
        }
        .payment-info h3 {
            color: #d97706;
            margin-bottom: 10px;
            font-size: 14px;
        }
    </style>
</head>
<body>
    <div class="invoice-container">
        <!-- Header -->
        <div class="header">
            <div class="company-info">
                ${businessPartner.logo_url ? `<img src="${businessPartner.logo_url}" alt="Logo" style="max-height: 60px; margin-bottom: 10px;">` : `<h1>${businessPartner.business_name || 'Your Business'}</h1>`}
                ${businessPartner.logo_url ? `<p><strong>${businessPartner.business_name}</strong></p>` : ''}
                <p>${businessPartner.address || ''}</p>
                <p>${businessPartner.city || ''} ${businessPartner.state || ''} ${businessPartner.postal_code || ''}</p>
                <p>${businessPartner.user.email}</p>
                <p>${businessPartner.user.phone_number}</p>
            </div>
            <div class="invoice-info">
                <div class="invoice-number">INVOICE</div>
                <div class="invoice-number">${invoice.invoice_number}</div>
                <div class="invoice-status">${invoice.status}</div>
            </div>
        </div>

        <!-- Addresses -->
        <div class="addresses">
            <div class="address-block">
                <h3>Bill To:</h3>
                <p><strong>${customer.name}</strong></p>
                ${customer.company_name ? `<p>${customer.company_name}</p>` : ''}
                ${customer.email ? `<p>${customer.email}</p>` : ''}
                <p>${customer.phone_number}</p>
                ${customer.address ? `<p>${customer.address}</p>` : ''}
                ${customer.city || customer.state ? `<p>${customer.city || ''} ${customer.state || ''} ${customer.postal_code || ''}</p>` : ''}
                ${customer.gst_number ? `<p>GST: ${customer.gst_number}</p>` : ''}
            </div>
            <div class="address-block">
                <h3>Invoice Details:</h3>
                <p><strong>Invoice Date:</strong> ${new Date(invoice.invoice_date).toLocaleDateString()}</p>
                <p><strong>Due Date:</strong> ${new Date(invoice.due_date).toLocaleDateString()}</p>
                ${invoice.sent_at ? `<p><strong>Sent Date:</strong> ${new Date(invoice.sent_at).toLocaleDateString()}</p>` : ''}
            </div>
        </div>

        <!-- Items Table -->
        <table class="items-table">
            <thead>
                <tr>
                    <th>Description</th>
                    <th class="text-right">Qty</th>
                    <th class="text-right">Unit Price</th>
                    <th class="text-right">Amount</th>
                </tr>
            </thead>
            <tbody>
                ${items.map((item: any) => `
                    <tr>
                        <td>${item.description}</td>
                        <td class="text-right">${item.quantity}</td>
                        <td class="text-right">₹${item.unit_price.toLocaleString('en-IN', { minimumFractionDigits: 2 })}</td>
                        <td class="text-right">₹${item.total_price.toLocaleString('en-IN', { minimumFractionDigits: 2 })}</td>
                    </tr>
                `).join('')}
            </tbody>
        </table>

        <!-- Totals -->
        <div class="totals">
            <div class="total-row subtotal">
                <span>Subtotal:</span>
                <span>₹${invoice.subtotal.toLocaleString('en-IN', { minimumFractionDigits: 2 })}</span>
            </div>
            ${invoice.tax_amount > 0 ? `
                <div class="total-row">
                    <span>Tax (${invoice.tax_rate}%):</span>
                    <span>₹${invoice.tax_amount.toLocaleString('en-IN', { minimumFractionDigits: 2 })}</span>
                </div>
            ` : ''}
            ${invoice.discount_amount > 0 ? `
                <div class="total-row">
                    <span>Discount:</span>
                    <span>-₹${invoice.discount_amount.toLocaleString('en-IN', { minimumFractionDigits: 2 })}</span>
                </div>
            ` : ''}
            <div class="total-row grand-total">
                <span>Total:</span>
                <span>₹${invoice.total_amount.toLocaleString('en-IN', { minimumFractionDigits: 2 })}</span>
            </div>
            ${invoice.paid_amount > 0 ? `
                <div class="total-row">
                    <span>Paid:</span>
                    <span>₹${invoice.paid_amount.toLocaleString('en-IN', { minimumFractionDigits: 2 })}</span>
                </div>
                <div class="total-row" style="font-weight: bold; color: #ef4444;">
                    <span>Balance Due:</span>
                    <span>₹${invoice.balance_amount.toLocaleString('en-IN', { minimumFractionDigits: 2 })}</span>
                </div>
            ` : ''}
        </div>

        <!-- Payment Info -->
        ${invoice.balance_amount > 0 ? `
            <div class="payment-info">
                <h3>Payment Instructions</h3>
                <p>${invoice.payment_instructions || 'Please make payment within the due date to avoid late fees.'}</p>
            </div>
        ` : ''}

        <!-- Notes -->
        ${invoice.notes || invoice.terms_conditions ? `
            <div class="notes">
                ${invoice.notes ? `
                    <h3>Notes</h3>
                    <p>${invoice.notes}</p>
                ` : ''}
                ${invoice.terms_conditions ? `
                    <h3>Terms & Conditions</h3>
                    <p>${invoice.terms_conditions}</p>
                ` : ''}
            </div>
        ` : ''}

        <!-- Footer -->
        <div class="footer">
            <p>Thank you for your business!</p>
            <p>This is a computer-generated invoice and does not require a signature.</p>
        </div>
    </div>
</body>
</html>
        `;
    }
}

export const pdfGeneratorService = new PDFGeneratorService();
