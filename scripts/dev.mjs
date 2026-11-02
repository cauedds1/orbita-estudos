import {spawn} from 'node:child_process';
import {bootstrapOwner,dataDirectory} from '../lib/persistence.mjs';
process.env.DATA_DIR=dataDirectory();bootstrapOwner();
const child=spawn(process.execPath,['node_modules/next/dist/bin/next','dev','--hostname','127.0.0.1',...process.argv.slice(2)],{stdio:'inherit',env:process.env});
child.on('exit',code=>{process.exitCode=code||0});
