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

const PRINTER_CONFIG_KEY = 'xp420b_printer_config';

export const defaultPrinterConfig: PrinterServiceConfig = {
  printerName: 'Xprinter XP-420B',
  labelWidthMm: 40,
  labelHeightMm: 30,
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
 * Generates Native TSPL Command Stream specifically formatted for XP-420B (203 dpi)
 * Default Label Size: 40mm x 30mm
 */
export function generateTSPLCommands(job: PrintLabelJob): string {
  const width = job.labelWidthMm || 40;
  const height = job.labelHeightMm || 30;
  const copies = Math.max(1, job.copies || 1);
  const serial = job.product.serial.trim();
  const name = job.product.name.trim();

  // 203 dpi = ~8 dots/mm
  const totalDotsWidth = Math.round(width * 8);
  // QR size approx 24mm = 192 dots
  const qrX = Math.max(10, Math.round((totalDotsWidth - 140) / 2));

  return [
    `SIZE ${width} mm, ${height} mm`,
    `GAP 2 mm, 0 mm`,
    `DIRECTION 1`,
    `CLS`,
    `; --- QR Code carrying strictly the Product Serial / SKU ---`,
    `QRCODE ${qrX},15,L,4,A,0,"${serial}"`,
    `; --- Product Name Underneath QR ---`,
    `TEXT 20,135,"TSS24.BF2",0,1,1,"${name}"`,
    `; --- Serial Number Underneath Product Name ---`,
    `TEXT 20,165,"3",0,1,1,"${serial}"`,
    `; --- Execute Print Job for N copies ---`,
    `PRINT 1, ${copies}`
  ].join('\r\n');
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
