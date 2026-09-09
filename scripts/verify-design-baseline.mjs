import { access, readFile } from 'node:fs/promises';

const requiredText = [
  ['src/app/pages/Landing.tsx', [
    'Forecast-to-order intelligence',
    'AI-powered restaurant control',
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
  await access(new URL('../public/zestiq-mark-exact.png', import.meta.url));
} catch {
  failures.push('public/zestiq-mark-exact.png is missing');
}

if (failures.length) {
  console.error('\nZestIQ production design verification failed:\n');
  failures.forEach(failure => console.error(`- ${failure}`));
  console.error('\nDeployment stopped. Restore the approved current design before building.\n');
  process.exit(1);
}

console.log('ZestIQ current-design baseline verified.');
