// ============================================================================
// Thermal Barcode & Label Printer Service (Background TSPL Engine)
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
}

const PRINTER_CONFIG_KEY = 'xp246b_printer_config';

export const defaultPrinterConfig: PrinterServiceConfig = {
  printerName: 'Xprinter XP-246B',
  labelWidthMm: 25,
  labelHeightMm: 50,
  serviceUrl: 'http://localhost:9100/print'
};

export const getPrinterConfig = (): PrinterServiceConfig => {
  const stored = localStorage.getItem(PRINTER_CONFIG_KEY);
  if (stored) {
    try {
      return { ...defaultPrinterConfig, ...JSON.parse(stored) };
    } catch (e) {
      console.error('Failed to parse stored printer config', e);
    }
  }
  return defaultPrinterConfig;
};

/**
 * Generates Native TSPL Command Stream formatted for thermal label printers (203 dpi)
 * Layout: Strict Vertical (Portrait) 4-Element Stack:
 * 1. Element 1 (Top): Centered QR Code
 * 2. Element 2 (Below QR): Product Name
 * 3. Element 3 (Below Name): Serial Number
 * 4. Element 4 (Bottom): Price Level 4 value ONLY (raw number, e.g. "150")
 */
export function generateTSPLCommands(job: PrintLabelJob): string {
  const width = job.labelWidthMm || 25;
  const height = job.labelHeightMm || 50;
  const copies = Math.max(1, job.copies || 1);
  const serial = (job.product.serial || '').trim();
  const name = (job.product.name || '').trim();
  const rawPrice4 = job.product.price4 !== undefined && job.product.price4 !== null
    ? String(job.product.price4).trim()
    : '';

  // 203 DPI: 1mm = 8 dots.
  // For width 38mm -> 304 dots. Center X ~ 152.
  // Center of QR with cell width 3 (~84 dots wide): X = 110
  const qrX = Math.max(10, Math.round(((width * 8) - 84) / 2));
  const textWidth = Math.round(width * 8 - 20);

  const commands = [
    `SIZE ${width} mm, ${height} mm`,
    `GAP 2 mm, 0 mm`,
    `DIRECTION 1`,
    `CLS`,
    `; --- Element 1 (Top): QR Code centered ---`,
    `QRCODE ${qrX},8,L,3,A,0,"${serial}"`,
    `; --- Element 2: Product Name (Centered block below QR) ---`,
    `BLOCK 10,105,${textWidth},40,"TSS24.BF2",0,1,1,2,1,"${name}"`,
    `; --- Element 3: Serial Number (Centered below Name) ---`,
    `TEXT 152,150,"2",0,1,1,2,"${serial}"`,
  ];

  if (rawPrice4) {
    commands.push(
      `; --- Element 4 (Bottom): Price Level 4 ONLY (raw number) ---`,
      `TEXT 152,178,"3",0,1,1,2,"${rawPrice4}"`
    );
  }

  commands.push(`PRINT 1, ${copies}`);

  return commands.join('\r\n');
}

/**
 * Checks connection status of Local Printer Agent
 */
export async function checkPrinterServiceStatus(): Promise<PrinterStatus> {
  const config = getPrinterConfig();
  try {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 1200);

    const response = await fetch(`${config.serviceUrl}/status`, {
      method: 'GET',
      signal: controller.signal
    }).catch(() => null);

    clearTimeout(timeoutId);

    if (response && response.ok) {
      return {
        connected: true,
        serviceRunning: true,
        message: 'متصل'
      };
    }
  } catch (e) {
    // Service not reachable
  }

  return {
    connected: false,
    serviceRunning: false,
    message: 'غير متصل'
  };
}

/**
 * Sends a thermal label print job to the Local Printer Service
 */
export async function sendPrintJobToLocalService(job: PrintLabelJob): Promise<{ success: boolean; message: string }> {
  const config = getPrinterConfig();
  const tsplCommands = generateTSPLCommands(job);

  const payload = {
    printer: config.printerName,
    copies: job.copies,
    labelWidthMm: job.labelWidthMm,
    labelHeightMm: job.labelHeightMm,
    product: {
      id: job.product.id,
      name: job.product.name,
      serial: job.product.serial
    },
    rawTSPL: tsplCommands
  };

  try {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 2500);

    const response = await fetch(config.serviceUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
      signal: controller.signal
    });

    clearTimeout(timeoutId);

    if (response.ok) {
      return {
        success: true,
        message: `تم إرسال أمر الطباعة بنجاح!`
      };
    } else {
      return {
        success: false,
        message: `لم تتم الاستجابة من خدمة الطباعة.`
      };
    }
  } catch (err: any) {
    return {
      success: false,
      message: `خدمة الطباعة غير متصلة حالياً.`
    };
  }
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
