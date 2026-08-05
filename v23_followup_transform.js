const fs=require('fs'),file=process.argv[2];let s=fs.readFileSync(file).toString('latin1');
function once(a,b){if(!s.includes(a))throw new Error('Missing: '+a);s=s.replace(a,b)}
once('$("style").value=STYLES.includes(rec.Style)?rec.Style:"Royal Greeting"','$("style").value=STYLES.includes(rec.Style)?rec.Style:"Classic Inspiration"');
once('if(!STYLES.includes(r.Style))failures.push(`${r.Date}: unsupported style ${r.Style}`);','if(!r.Style)failures.push(`${r.Date}: blank source style`);');
once('function applyPreferences(){const p=preferences();$("signature").value=p.signature||"Dr. Atul";if(PALETTES[p.palette])palette=p.palette;if(STYLES.includes(p.style))$("style").value=p.style}','function applyPreferences(){const p=preferences();$("signature").value=p.signature||"Dr. Atul";if(PALETTES[p.palette])palette=p.palette;$("style").value=STYLES.includes(p.style)?p.style:"Classic Inspiration"}');
fs.writeFileSync(file,Buffer.from(s,'latin1'));
