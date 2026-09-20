import { access, readFile } from 'node:fs/promises';

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

for (const file of ['src/styles/theme.css', 'src/app/components/Layout.tsx', 'src/app/pages/Orders.tsx']) {
  const source = await readFile(new URL(`../${file}`, import.meta.url), 'utf8');
  if (/#(?:F5D62E|F5C10E)\b/i.test(source)) failures.push(`${file} restores obsolete yellow branding`);
}

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
