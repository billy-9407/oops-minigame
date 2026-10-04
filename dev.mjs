// Local preview has no external packages. Vercel uses api/ as Node functions.
import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import './build.mjs';
const root=path.dirname(fileURLToPath(import.meta.url));
const env=path.join(root,'.env');if(fs.existsSync(env)){for(const line of fs.readFileSync(env,'utf8').split('\n')){const m=line.match(/^([A-Z_]+)=(.*)$/);if(m&&!process.env[m[1]])process.env[m[1]]=m[2].trim().replace(/^['"]|['"]$/g,'');}}
const endpoints={};for(const name of ['access','start','finish','leaderboard'])endpoints['/api/'+name]=(await import('./api/'+name+'.mjs')).default;
const mime={'.html':'text/html; charset=utf-8','.mjs':'text/javascript; charset=utf-8','.css':'text/css; charset=utf-8','.svg':'image/svg+xml','.png':'image/png','.webp':'image/webp','.json':'application/json','.ogg':'audio/ogg','.mp3':'audio/mpeg'};
const server=http.createServer(async(req,res)=>{
 const pathname=new URL(req.url,'http://localhost').pathname;
 if(endpoints[pathname]){let body='';try{for await(const chunk of req){body+=chunk;if(Buffer.byteLength(body)>180000){res.writeHead(413);res.end();return;}}req.body=body;res.status=n=>(res.statusCode=n,res);res.json=data=>res.end(JSON.stringify(data));return await endpoints[pathname](req,res);}catch{res.writeHead(400);res.end();return;}}
 const file=path.resolve(root,'public','.'+(pathname==='/'?'/index.html':decodeURIComponent(pathname)));if(!file.startsWith(path.join(root,'public')+path.sep)){res.writeHead(403);res.end();return;}
 try{const data=fs.readFileSync(file);res.setHeader('Content-Type',mime[path.extname(file)]||'application/octet-stream');res.end(data);}catch{res.writeHead(404);res.end('Not found');}
});server.listen(Number(process.env.PORT)||4173,'0.0.0.0',()=>console.log('Pony Extraction ready'));
