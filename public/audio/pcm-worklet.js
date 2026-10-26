class SorimoiPCM extends AudioWorkletProcessor {
 constructor(){super();this.buffer=new Float32Array(2048);this.offset=0;}
 process(inputs,outputs){const channels=inputs[0];if(!channels?.length)return true;const length=channels[0].length;
  for(let i=0;i<length;i++){let sample=0;for(const c of channels)sample+=c[i]||0;this.buffer[this.offset++]=sample/channels.length;if(this.offset===this.buffer.length){this.port.postMessage(this.buffer,[this.buffer.buffer]);this.buffer=new Float32Array(2048);this.offset=0;}}
  for(const output of outputs)for(const c of output)c.fill(0);return true;
 }
}
registerProcessor('sorimoi-pcm',SorimoiPCM);
