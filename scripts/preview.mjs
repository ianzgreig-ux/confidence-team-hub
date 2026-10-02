import {spawn} from 'node:child_process';
import {mkdirSync} from 'node:fs';
mkdirSync('.sites-runtime',{recursive:true});
const input=process.argv.slice(2);
const portIndex=input.indexOf('--port');
const args=portIndex<0?[]:['--port',input[portIndex+1]];
const child=spawn(process.execPath,['node_modules/wrangler/bin/wrangler.js','dev','--ip','0.0.0.0',...args],{stdio:'inherit',env:{...process.env,WRANGLER_SEND_METRICS:'false',WRANGLER_LOG_PATH:process.cwd()+'/.sites-runtime/wrangler.log'}});
for(const signal of ['SIGTERM','SIGINT'])process.on(signal,()=>child.kill(signal));
child.on('exit',code=>process.exit(code??1));
