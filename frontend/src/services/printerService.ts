// ============================================================================
// Thermal Barcode & QR Code Label Printer Service (Desktop Agent Bridge)
// ============================================================================

export interface PrintLabelJob {
  printerName: string;
  labelWidthMm: number;
  labelHeightMm: number;
  copies: number;
  product: {
    id: string;
    name: string;
    serial: string;
    price4?: number | string;
  };
}

export interface BatchLabelItem {
  id?: string;
  serial: string;
  name: string;
  price?: number | string;
  price4?: number | string;
  storeName?: string;
  copies?: number;
}

export interface PrinterServiceConfig {
  printerName: string;
  labelWidthMm: number;
  labelHeightMm: number;
  serviceUrl: string;
}

export interface PrinterStatus {
  connected: boolean;
  serviceRunning: boolean;
  message: string;
  details?: any;
}

const PRINTER_CONFIG_KEY = 'xp246b_printer_config';

export const defaultPrinterConfig: PrinterServiceConfig = {
  printerName: 'Xprinter XP-246B',
  labelWidthMm: 50,
  labelHeightMm: 25,
  serviceUrl: 'http://127.0.0.1:18240'
};

export const getPrinterConfig = (): PrinterServiceConfig => {
  const stored = localStorage.getItem(PRINTER_CONFIG_KEY);
  if (stored) {
    try {
      const parsed = JSON.parse(stored);
      // Migrate old port 9100 or '/print' suffix to clean base url
      if (parsed.serviceUrl && (parsed.serviceUrl.includes('9100') || parsed.serviceUrl.endsWith('/print'))) {
        parsed.serviceUrl = 'http://127.0.0.1:18240';
      }
      return { ...defaultPrinterConfig, ...parsed };
    } catch (e) {
      console.error('Failed to parse stored printer config', e);
    }
  }
  return defaultPrinterConfig;
};

export const savePrinterConfig = (config: Partial<PrinterServiceConfig>) => {
  const current = getPrinterConfig();
  const updated = { ...current, ...config };
  localStorage.setItem(PRINTER_CONFIG_KEY, JSON.stringify(updated));
  return updated;
};

/**
 * Triggers the custom protocol to wake up or launch the Desktop App if it's closed
 */
export function wakeDesktopAgent(): void {
  try {
    const iframe = document.createElement('iframe');
    iframe.style.display = 'none';
    iframe.src = 'posprint://open';
    document.body.appendChild(iframe);
    setTimeout(() => {
      if (document.body.contains(iframe)) {
        document.body.removeChild(iframe);
      }
    }, 1500);
  } catch (e) {
    console.warn('Failed to invoke protocol posprint://', e);
  }
}

/**
 * Invokes the desktop app protocol with encoded job data so it launches and opens the print dialog
 */
export function wakeDesktopAgentWithData(jobData: any): void {
  try {
    const iframe = document.createElement('iframe');
    iframe.style.display = 'none';
    const encoded = encodeURIComponent(JSON.stringify(jobData));
    iframe.src = `posprint://open-job?data=${encoded}`;
    document.body.appendChild(iframe);
    setTimeout(() => {
      if (document.body.contains(iframe)) {
        document.body.removeChild(iframe);
      }
    }, 1500);
  } catch (e) {
    console.warn('Failed to invoke protocol posprint://open-job', e);
  }
}

/**
 * Sends a print job to the Desktop Agent and pops up its window for immediate printing
 */
export async function openPrintJobInDesktopAgent(jobData: any): Promise<{ success: boolean; message: string }> {
  const config = getPrinterConfig();
  const baseUrl = config.serviceUrl.replace(/\/incoming-job$/, '').replace(/\/print$/, '').replace(/\/+$/, '');
  const url = `${baseUrl}/incoming-job`;

  try {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 2000);

    const res = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(jobData),
      signal: controller.signal
    });
    clearTimeout(timeoutId);

    if (res.ok) {
      return { success: true, message: 'تم فتح أمر الطباعة في تطبيق الديسكتوب بنجاح 🖨️' };
    }
  } catch (e) {
    // App not listening, fallback to protocol launch
  }

  // Fallback: launch through Windows registered protocol
  wakeDesktopAgentWithData(jobData);
  return { success: true, message: 'جاري تشغيل وفتح وسيط الطباعة المكتبي 🖨️' };
}

/**
 * Checks connection status of Local Desktop Printer Agent
 */
export async function checkPrinterServiceStatus(): Promise<PrinterStatus> {
  const config = getPrinterConfig();
  const baseUrl = config.serviceUrl.replace(/\/print$/, '').replace(/\/+$/, '');

  try {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 1200);

    const response = await fetch(`${baseUrl}/status`, {
      method: 'GET',
      signal: controller.signal
    }).catch(() => null);

    clearTimeout(timeoutId);

    if (response && response.ok) {
      const data = await response.json().catch(() => null);
      return {
        connected: true,
        serviceRunning: true,
        message: 'متصل وجاهز',
        details: data
      };
    }
  } catch (e) {
    // Service unreachable
  }

  return {
    connected: false,
    serviceRunning: false,
    message: 'غير متصل (التطبيق المكتبي غير مشغل)'
  };
}

/**
 * Prints a batch of thermal labels using the Desktop Silent Print Agent
 */
export async function printBatchLabelsViaAgent(
  items: BatchLabelItem[],
  options: {
    printerName?: string;
    widthMm?: number;
    heightMm?: number;
    storeName?: string;
    autoWake?: boolean;
  } = {}
): Promise<{ success: boolean; message: string; printer?: string }> {
  const config = getPrinterConfig();
  const baseUrl = config.serviceUrl.replace(/\/print$/, '').replace(/\/+$/, '');
  const printUrl = `${baseUrl}/print`;

  const payload = {
    printerName: options.printerName || config.printerName,
    widthMm: options.widthMm || config.labelWidthMm || 50,
    heightMm: options.heightMm || config.labelHeightMm || 25,
    storeName: options.storeName || 'Salla',
    items: items.map(item => ({
      serial: (item.serial || item.id || '').trim(),
      name: (item.name || '').trim(),
      price: item.price !== undefined ? item.price : (item.price4 !== undefined ? item.price4 : ''),
      storeName: item.storeName || options.storeName || 'Salla',
      copies: Math.max(1, item.copies || 1)
    }))
  };

  const attemptSend = async (): Promise<Response | null> => {
    try {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 4000);

      const res = await fetch(printUrl, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
        signal: controller.signal
      });

      clearTimeout(timeoutId);
      return res;
    } catch (err) {
      return null;
    }
  };

  // First Attempt
  let response = await attemptSend();

  // If unreachable and autoWake is enabled, wake up the desktop app and retry once
  if (!response && options.autoWake !== false) {
    wakeDesktopAgent();
    // Wait for the desktop app to start its server
    await new Promise(resolve => setTimeout(resolve, 2000));
    response = await attemptSend();
  }

  if (response && response.ok) {
    const resData = await response.json().catch(() => ({}));
    return {
      success: true,
      printer: resData.printer || config.printerName,
      message: resData.message || 'تم إرسال أمر الطباعة بنجاح!'
    };
  } else {
    return {
      success: false,
      message: 'تعذر الاتصال بتطبيق وسيط الطباعة (POS Print Agent). يرجى التأكد من تشغيله على جهاز الكاشير.'
    };
  }
}

/**
 * Sends a single product thermal label print job to the Local Printer Service
 */
export async function sendPrintJobToLocalService(
  job: PrintLabelJob
): Promise<{ success: boolean; message: string; printer?: string }> {
  return await printBatchLabelsViaAgent([
    {
      id: job.product.id,
      serial: job.product.serial,
      name: job.product.name,
      price: job.product.price4,
      copies: job.copies
    }
  ], {
    printerName: job.printerName,
    widthMm: job.labelWidthMm,
    heightMm: job.labelHeightMm
  });
}

/**
 * Fallback TSPL generator
 */
export function generateTSPLCommands(job: PrintLabelJob): string {
  const width = job.labelWidthMm || 50;
  const height = job.labelHeightMm || 25;
  const copies = Math.max(1, job.copies || 1);
  const serial = (job.product.serial || '').trim();
  const name = (job.product.name || '').trim();
  const rawPrice4 = job.product.price4 !== undefined && job.product.price4 !== null
    ? String(job.product.price4).trim()
    : '';

  const qrX = 12;
  const textX = width >= 50 ? 190 : 150;
  const textWidth = Math.max(80, (width * 8) - textX - 12);

  const commands = [
    `SIZE ${width} mm, ${height} mm`,
    `GAP 2 mm, 0 mm`,
    `DIRECTION 1`,
    `CLS`,
    `; --- Large QR Code ---`,
    `QRCODE ${qrX},16,L,${width >= 50 ? 5 : 4},A,0,"${serial}"`,
    `; --- Arabic / Text details ---`,
    `BLOCK ${textX},16,${textWidth},60,"TSS24.BF2",0,1,1,2,1,"${name}"`,
    `TEXT ${textX + 60},95,"2",0,1,1,2,"${serial}"`,
  ];

  if (rawPrice4) {
    commands.push(
      `; --- Price ---`,
      `TEXT ${textX + 60},140,"3",0,1,1,2,"${rawPrice4}"`
    );
  }

  commands.push(`PRINT 1, ${copies}`);
  return commands.join('\r\n');
}

/**
 * Downloads the native TSPL file for direct transmission or offline printing tool
 */
export function downloadTSPLFile(job: PrintLabelJob) {
  const tspl = generateTSPLCommands(job);
  const blob = new Blob([tspl], { type: 'text/plain;charset=utf-8' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `label_${job.product.serial}_x${job.copies}.tspl`;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}
