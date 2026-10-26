import fs from 'node:fs/promises';
import {demoProject,synthesizeDemo,wavBlob} from '../src/demo.mjs';
import {toVtt} from '../src/core.mjs';
await fs.mkdir(new URL('../public/samples/',import.meta.url),{recursive:true});
const p=demoProject();await fs.writeFile(new URL('../public/samples/texture-demo.json',import.meta.url),JSON.stringify(p,null,2));
await fs.writeFile(new URL('../public/samples/texture-demo.wav',import.meta.url),Buffer.from(await wavBlob(synthesizeDemo()).arrayBuffer()));
await fs.writeFile(new URL('../public/samples/dialogue.vtt',import.meta.url),'WEBVTT\n\n00:00:00.500 --> 00:00:03.500\n손끝에 닿는 종이의 결.\n\n00:00:04.400 --> 00:00:07.300\n톡, 작은 소리가 남아요.\n');
await fs.writeFile(new URL('../public/samples/texture-demo.vtt',import.meta.url),toVtt(p));
