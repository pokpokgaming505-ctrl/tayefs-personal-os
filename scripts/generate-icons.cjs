const fs = require("node:fs");
const path = require("node:path");
const zlib = require("node:zlib");

const root = path.resolve(__dirname, "..");
const background = [16, 18, 15];
const foreground = [214, 243, 106];
const polygon = [[104,112],[408,112],[408,188],[292,188],[292,400],[220,400],[220,188],[104,188]];

function inRoundedSquare(x,y) {
  const size=512, radius=112;
  const cx=Math.max(radius,Math.min(size-radius,x));
  const cy=Math.max(radius,Math.min(size-radius,y));
  return (x-cx)**2+(y-cy)**2 <= radius**2;
}
function inPolygon(x,y) {
  let inside=false;
  for(let i=0,j=polygon.length-1;i<polygon.length;j=i++){
    const [xi,yi]=polygon[i], [xj,yj]=polygon[j];
    if(((yi>y)!==(yj>y)) && x<(xj-xi)*(y-yi)/(yj-yi)+xi) inside=!inside;
  }
  return inside;
}
function crc32(buffer) {
  let crc=0xffffffff;
  for(const byte of buffer){crc^=byte;for(let i=0;i<8;i++)crc=(crc>>>1)^((crc&1)?0xedb88320:0);}
  return (crc^0xffffffff)>>>0;
}
function pngChunk(type,data) {
  const name=Buffer.from(type), length=Buffer.alloc(4), checksum=Buffer.alloc(4);
  length.writeUInt32BE(data.length);
  checksum.writeUInt32BE(crc32(Buffer.concat([name,data])));
  return Buffer.concat([length,name,data,checksum]);
}
function renderPng(size, foregroundOnly=false) {
  const channels=4, rowBytes=size*channels, raw=Buffer.alloc(size*(rowBytes+1));
  for(let y=0;y<size;y++){
    const row=y*(rowBytes+1);raw[row]=0;
    for(let x=0;x<size;x++){
      let bgCount=0,fgCount=0;
      for(let sy=0;sy<4;sy++)for(let sx=0;sx<4;sx++){
        const px=(x+(sx+.5)/4)*512/size, py=(y+(sy+.5)/4)*512/size;
        const spark=Math.abs(px-382)+Math.abs(py-326)<38;
        const shape=inPolygon(px,py)||spark;
        if(shape)fgCount++;
        else if(!foregroundOnly && inRoundedSquare(px,py))bgCount++;
      }
      const total=bgCount+fgCount, out=row+1+x*4;
      if(total){
        const rgb=foregroundOnly?foreground:foreground.map((c,i)=>Math.round((c*fgCount+background[i]*bgCount)/total));
        raw[out]=rgb[0];raw[out+1]=rgb[1];raw[out+2]=rgb[2];raw[out+3]=Math.round(total/16*255);
      }
    }
  }
  const ihdr=Buffer.alloc(13);ihdr.writeUInt32BE(size,0);ihdr.writeUInt32BE(size,4);ihdr[8]=8;ihdr[9]=6;
  return Buffer.concat([Buffer.from([137,80,78,71,13,10,26,10]),pngChunk("IHDR",ihdr),pngChunk("IDAT",zlib.deflateSync(raw)),pngChunk("IEND",Buffer.alloc(0))]);
}
function writeIco(file,sizes) {
  const images=sizes.map(size=>renderPng(size));
  const header=Buffer.alloc(6+sizes.length*16);header.writeUInt16LE(0,0);header.writeUInt16LE(1,2);header.writeUInt16LE(sizes.length,4);
  let offset=header.length;
  sizes.forEach((size,index)=>{
    const start=6+index*16;
    header[start]=size===256?0:size;header[start+1]=size===256?0:size;header[start+2]=0;header[start+3]=0;
    header.writeUInt16LE(1,start+4);header.writeUInt16LE(32,start+6);header.writeUInt32LE(images[index].length,start+8);header.writeUInt32LE(offset,start+12);
    offset+=images[index].length;
  });
  fs.writeFileSync(file,Buffer.concat([header,...images]));
}

const assets=path.join(root,"assets");fs.mkdirSync(assets,{recursive:true});
writeIco(path.join(assets,"tayefs.ico"),[16,24,32,48,64,128,256]);
fs.writeFileSync(path.join(assets,"tayefs-512.png"),renderPng(512));
const res=path.join(root,"android","app","src","main","res");
const densities={mdpi:48,hdpi:72,xhdpi:96,xxhdpi:144,xxxhdpi:192};
for(const [density,size] of Object.entries(densities)){
  const dir=path.join(res,`mipmap-${density}`);fs.mkdirSync(dir,{recursive:true});
  fs.writeFileSync(path.join(dir,"ic_launcher.png"),renderPng(size));
  fs.writeFileSync(path.join(dir,"ic_launcher_round.png"),renderPng(size));
  fs.writeFileSync(path.join(dir,"ic_launcher_foreground.png"),renderPng(size,true));
}
console.log("TAYEF'S Windows and Android icons generated.");
