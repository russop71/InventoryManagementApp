import { access, readFile, readdir } from 'node:fs/promises';
import { brandViolations } from './brand-policy.mjs';

const requiredText = [
  ['src/styles/theme.css', ['--primary: #F58220;', "'DM Serif Display'"]],
  ['src/styles/index.css', ["./lime-preview.css"]],
  ['src/app/components/ZestIQBrand.tsx', ['/zestiq-orange-vector.svg']],
  ['src/app/pages/Orders.tsx', ["const Y = '#F58220'"]],
  ['src/app/pages/Landing.tsx', [
    'Forecast-to-order intelligence',
    'Know what it costs.',
    'product-orange-dashboard.png',
    'Model the opportunity',
    'The working product',
    'One website. Two apps.',
  ]],
  ['src/app/components/Layout.tsx', [
    'w-[264px]',
    "label: 'Items & Setup'",
    "label: 'Cost & COGS'",
    "label: 'My schedule'",
  ]],
  ['src/app/routes.tsx', [
    'PrivateAppProviders',
    'LaborEmployeeForm',
    'RestaurantSeoGuides',
    'path: "/employee"',
  ]],
  ['src/app/pages/Inventory.tsx', [
    'handleMergeSelected',
    'Merge items',
    'All storage areas',
  ]],
  ['src/app/pages/InventoryDetail.tsx', [
    'Storage area added',
    'Storage areas',
  ]],
];

const failures = [];

async function verifyBrandDirectory(directory) {
  for (const entry of await readdir(new URL(`../${directory}`, import.meta.url), { withFileTypes: true })) {
    const file = `${directory}/${entry.name}`;
    if (entry.isDirectory()) await verifyBrandDirectory(file);
    else if (/\.(tsx?|jsx?|css|svg)$/.test(file) && !/\.test\./.test(file)) {
      failures.push(...brandViolations(file, await readFile(new URL(`../${file}`, import.meta.url), 'utf8')));
    }
  }
}
await verifyBrandDirectory('src');

for (const [file, markers] of requiredText) {
  let source = '';
  try {
    source = await readFile(new URL(`../${file}`, import.meta.url), 'utf8');
  } catch {
    failures.push(`${file} is missing`);
    continue;
  }

  for (const marker of markers) {
    if (!source.toLowerCase().includes(marker.toLowerCase())) {
      failures.push(`${file} is missing the current-design marker: ${marker}`);
    }
  }
}

try {
  await access(new URL('../public/zestiq-orange-vector.svg', import.meta.url));
} catch {
  failures.push('public/zestiq-orange-vector.svg is missing');
}

if (failures.length) {
  console.error('\nZestIQ production design verification failed:\n');
  failures.forEach(failure => console.error(`- ${failure}`));
  console.error('\nDeployment stopped. Restore the approved current design before building.\n');
  process.exit(1);
}

console.log('ZestIQ current-design baseline verified.');
