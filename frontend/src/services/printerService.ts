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
  labelWidthMm: 38,
  labelHeightMm: 25,
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
 * Layout: Horizontal Landscape (38x25mm / 50x25mm):
 * - Large QR Code filling height on one side
 * - Name, Serial, Price 4 stacked beside it
 */
export function generateTSPLCommands(job: PrintLabelJob): string {
  const width = job.labelWidthMm || 38;
  const height = job.labelHeightMm || 25;
  const copies = Math.max(1, job.copies || 1);
  const serial = (job.product.serial || '').trim();
  const name = (job.product.name || '').trim();
  const rawPrice4 = job.product.price4 !== undefined && job.product.price4 !== null
    ? String(job.product.price4).trim()
    : '';

  // 203 DPI: 1mm = 8 dots.
  // 38mm width = 304 dots, 25mm height = 200 dots.
  const qrX = 12;
  const textX = width >= 50 ? 190 : 150;
  const textWidth = Math.max(80, (width * 8) - textX - 12);

  const commands = [
    `SIZE ${width} mm, ${height} mm`,
    `GAP 2 mm, 0 mm`,
    `DIRECTION 1`,
    `CLS`,
    `; --- Large QR Code filling height ---`,
    `QRCODE ${qrX},16,L,${width >= 50 ? 5 : 4},A,0,"${serial}"`,
    `; --- Text column beside QR Code ---`,
    `BLOCK ${textX},16,${textWidth},60,"TSS24.BF2",0,1,1,2,1,"${name}"`,
    `TEXT ${textX + 60},95,"2",0,1,1,2,"${serial}"`,
  ];

  if (rawPrice4) {
    commands.push(
      `; --- Price Level 4 ONLY (raw number) ---`,
      `TEXT ${textX + 60},140,"3",0,1,1,2,"${rawPrice4}"`
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
