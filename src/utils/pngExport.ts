/**
 * Utility to prepare elements for PNG export with html2canvas
 * html2canvas doesn't support oklab() or oklch() colors from Tailwind v4
 */

// Map of common Tailwind oklch colors to hex equivalents
const colorMap: Record<string, string> = {
  // Grays (zinc scale)
  'oklch(0.985 0 0)': '#fafafa',     // zinc-50
  'oklch(0.967 0.001 286.375)': '#f4f4f5', // zinc-100
  'oklch(0.92 0.004 286.32)': '#e4e4e7',   // zinc-200
  'oklch(0.871 0.006 286.286)': '#d4d4d8', // zinc-300
  'oklch(0.705 0.015 286.067)': '#a1a1aa', // zinc-400
  'oklch(0.552 0.016 285.938)': '#71717a', // zinc-500
  'oklch(0.442 0.017 285.786)': '#52525b', // zinc-600
  'oklch(0.371 0.013 285.805)': '#3f3f46', // zinc-700
  'oklch(0.274 0.006 286.033)': '#27272a', // zinc-800
  'oklch(0.21 0.006 285.885)': '#18181b',  // zinc-900
  'oklch(0.141 0.005 285.823)': '#09090b', // zinc-950

  // Greens
  'oklch(0.723 0.219 142.495)': '#22c55e', // green-500
  'oklch(0.627 0.194 142.565)': '#16a34a', // green-600
  'oklch(0.792 0.209 151.711)': '#4ade80', // green-400
  'oklch(0.871 0.15 154.449)': '#86efac',  // green-300

  // Reds
  'oklch(0.637 0.237 25.331)': '#ef4444',  // red-500
  'oklch(0.577 0.245 27.325)': '#dc2626',  // red-600
  'oklch(0.704 0.191 22.216)': '#f87171',  // red-400

  // Blues
  'oklch(0.623 0.214 259.815)': '#3b82f6', // blue-500
  'oklch(0.546 0.245 262.881)': '#2563eb', // blue-600
  'oklch(0.707 0.165 254.624)': '#60a5fa', // blue-400

  // Corals/Oranges
  'oklch(0.705 0.213 47.604)': '#fb923c',  // orange-400
  'oklch(0.646 0.222 41.116)': '#f97316',  // orange-500

  // Purples
  'oklch(0.714 0.203 305.504)': '#a855f7', // purple-500
  'oklch(0.627 0.265 303.9)': '#9333ea',   // purple-600

  // Yellows
  'oklch(0.852 0.199 91.936)': '#facc15',  // yellow-400
  'oklch(0.795 0.184 86.047)': '#eab308',  // yellow-500

  // White/Black
  'oklch(1 0 0)': '#ffffff',
  'oklch(0 0 0)': '#000000',
};

/**
 * Convert a color string with oklab/oklch to hex
 */
function modernColorToHex(colorStr: string): string {
  if (!colorStr) return colorStr;

  // Return as-is if not a modern color function
  if (!colorStr.includes('oklab') && !colorStr.includes('oklch')) {
    return colorStr;
  }

  // Check exact match in color map first
  const normalized = colorStr.trim().toLowerCase();
  for (const [oklch, hex] of Object.entries(colorMap)) {
    if (normalized.includes(oklch.toLowerCase()) || colorStr.includes(oklch)) {
      return hex;
    }
  }

  // Parse oklch values and estimate hex
  // oklch(L C H) or oklch(L C H / A)
  const oklchMatch = colorStr.match(/oklch\(\s*([\d.]+)\s+([\d.]+)\s+([\d.]+)/i);
  if (oklchMatch) {
    const L = parseFloat(oklchMatch[1]); // Lightness 0-1
    const C = parseFloat(oklchMatch[2]); // Chroma 0-0.4+
    const H = parseFloat(oklchMatch[3]); // Hue 0-360

    // Simple conversion based on lightness and hue
    if (L > 0.95) return '#ffffff';
    if (L < 0.15) return '#09090b';

    // Detect color by hue range
    if (C < 0.02) {
      // Achromatic (gray)
      const gray = Math.round(L * 255);
      return `#${gray.toString(16).padStart(2, '0').repeat(3)}`;
    }

    // Green hues (120-180)
    if (H >= 120 && H <= 180) {
      if (L > 0.7) return '#4ade80';
      if (L > 0.6) return '#22c55e';
      return '#16a34a';
    }

    // Red hues (0-30, 330-360)
    if (H <= 30 || H >= 330) {
      if (L > 0.65) return '#f87171';
      if (L > 0.55) return '#ef4444';
      return '#dc2626';
    }

    // Blue hues (200-280)
    if (H >= 200 && H <= 280) {
      if (L > 0.65) return '#60a5fa';
      if (L > 0.55) return '#3b82f6';
      return '#2563eb';
    }

    // Purple hues (280-330)
    if (H >= 280 && H < 330) {
      if (L > 0.65) return '#c084fc';
      return '#a855f7';
    }

    // Yellow/Orange hues (30-80)
    if (H > 30 && H <= 80) {
      if (H < 50) return '#fb923c'; // orange
      return '#facc15'; // yellow
    }
  }

  // Parse oklab values
  const oklabMatch = colorStr.match(/oklab\(\s*([\d.]+)\s+([-\d.]+)\s+([-\d.]+)/i);
  if (oklabMatch) {
    const L = parseFloat(oklabMatch[1]);
    if (L > 0.95) return '#ffffff';
    if (L < 0.15) return '#09090b';

    // Estimate based on lightness
    const gray = Math.round(L * 255);
    return `#${gray.toString(16).padStart(2, '0').repeat(3)}`;
  }

  // Default fallback
  return '#71717a';
}

/**
 * Recursively convert all oklab/oklch colors in an element tree to hex
 */
function convertColorsInElement(el: HTMLElement): void {
  const computed = window.getComputedStyle(el);

  // Properties to check and convert
  const colorProps = [
    { computed: 'background-color', style: 'backgroundColor' },
    { computed: 'color', style: 'color' },
    { computed: 'border-color', style: 'borderColor' },
    { computed: 'border-top-color', style: 'borderTopColor' },
    { computed: 'border-right-color', style: 'borderRightColor' },
    { computed: 'border-bottom-color', style: 'borderBottomColor' },
    { computed: 'border-left-color', style: 'borderLeftColor' },
  ];

  colorProps.forEach(({ computed: compProp, style: styleProp }) => {
    const value = computed.getPropertyValue(compProp);
    if (value && (value.includes('oklab') || value.includes('oklch'))) {
      (el.style as any)[styleProp] = modernColorToHex(value);
    }
  });

  // Process all children
  Array.from(el.children).forEach(child => {
    if (child instanceof HTMLElement) {
      convertColorsInElement(child);
    }
  });
}

/**
 * Prepare an element for html2canvas by converting oklab/oklch colors to hex
 * Returns a cleanup function to restore original inline styles
 */
export function prepareForCapture(element: HTMLElement): () => void {
  const originalStyles: { el: HTMLElement; style: string }[] = [];

  function processElement(el: HTMLElement) {
    // Save original inline style
    originalStyles.push({ el, style: el.getAttribute('style') || '' });

    const computed = window.getComputedStyle(el);

    const colorProps = [
      { computed: 'background-color', style: 'backgroundColor' },
      { computed: 'color', style: 'color' },
      { computed: 'border-color', style: 'borderColor' },
      { computed: 'border-top-color', style: 'borderTopColor' },
      { computed: 'border-right-color', style: 'borderRightColor' },
      { computed: 'border-bottom-color', style: 'borderBottomColor' },
      { computed: 'border-left-color', style: 'borderLeftColor' },
    ];

    colorProps.forEach(({ computed: compProp, style: styleProp }) => {
      const value = computed.getPropertyValue(compProp);
      if (value && (value.includes('oklab') || value.includes('oklch'))) {
        (el.style as any)[styleProp] = modernColorToHex(value);
      }
    });

    // Process children
    Array.from(el.children).forEach(child => {
      if (child instanceof HTMLElement) {
        processElement(child);
      }
    });
  }

  processElement(element);

  // Return cleanup function
  return () => {
    originalStyles.forEach(({ el, style }) => {
      if (style) {
        el.setAttribute('style', style);
      } else {
        el.removeAttribute('style');
      }
    });
  };
}

/**
 * Alternative: Use onclone callback to convert colors in cloned element
 * This is safer as it doesn't modify the original DOM
 */
export function getOnCloneHandler() {
  return (_doc: Document, element: HTMLElement) => {
    convertColorsInElement(element);
  };
}
