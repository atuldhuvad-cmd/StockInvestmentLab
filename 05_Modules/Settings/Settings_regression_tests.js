#!/usr/bin/env node
const fs = require('fs');
const path = require('path');
let passed = 0, failed = 0;
function check(label, actual, expected) {
  const ok = JSON.stringify(actual) === JSON.stringify(expected);
  console.log(`  [${ok ? 'PASS' : 'FAIL'}] ${label}`);
  ok ? passed++ : failed++;
}
const root = path.resolve(__dirname, '..', '..', '01_Source', 'wealth-suite');
eval(fs.readFileSync(path.join(root, 'js/data-model.js'), 'utf8') + '\nglobal.WealthData=WealthData;');
eval(fs.readFileSync(path.join(root, 'js/modules/settings.js'), 'utf8') + '\nglobal.SettingsModule=SettingsModule;');

console.log('=== SET-01/02: defaults and read API ===');
WealthData.reset();
check('satellite allocation default', WealthData.getSetting('intradaySatelliteAllocationPct'), 15);
check('minimum risk/reward default', WealthData.getSetting('minRiskRewardRatio'), 2);
check('settings contain only active compatibility keys', Object.keys(WealthData.getAllSettings()).sort(), ['intradaySatelliteAllocationPct','minRiskRewardRatio']);
check('unknown setting is absent', WealthData.getSetting('dcfGrowthRate'), undefined);

console.log('=== SET-03: backup compatibility ===');
WealthData.replaceAll({ settings: { intradaySatelliteAllocationPct: 12, minRiskRewardRatio: 2.5 } });
check('recognized values survive replaceAll', WealthData.getAllSettings(), { intradaySatelliteAllocationPct: 12, minRiskRewardRatio: 2.5 });
WealthData.reset();
check('reset restores defaults', WealthData.getAllSettings(), { intradaySatelliteAllocationPct: 15, minRiskRewardRatio: 2 });

console.log('=== SET-04: inactive shell render ===');
const container = { innerHTML: '' };
SettingsModule.render(container);
check('render identifies inactive compatibility status', container.innerHTML.includes('Inactive compatibility module.'), true);
check('render explains preserved legacy data', container.innerHTML.includes('Existing legacy Intraday data remains preserved in backups.'), true);
check('public API exposes render only', Object.keys(SettingsModule), ['render']);

console.log(`=== SUMMARY: ${passed} passed, ${failed} failed (out of ${passed + failed}) ===`);
process.exit(failed ? 1 : 0);
