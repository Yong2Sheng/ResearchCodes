import fs from 'node:fs/promises';
import {build} from 'esbuild';
import {inlineMathStyles} from './build-math-assets.mjs';
const result=await build({entryPoints:['src/reconstruction.js'],bundle:true,minify:true,format:'iife',target:['chrome100','safari15','firefox102'],write:false,legalComments:'none'});
const template=await inlineMathStyles(await fs.readFile('src/reconstruction.template.html','utf8'));
await fs.writeFile('reconstruction.html',template.replace('/*__APP_BUNDLE__*/',()=>result.outputFiles[0].text.replaceAll('</script','<\\/script')));
console.log('Built reconstruction.html (standalone, offline)');
