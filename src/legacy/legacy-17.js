
// Close-range physical moves lunge into the target and resolve with distinct pixel impacts.
(()=>{
  const projectileDraw=drawMove,physicalMoves=new Set(['FIRE CLAW','FLAME CHARGE','VOLT TACKLE','LICK','SHADOW SNEAK']);
  const stage=$('#attackStage'),attacker=$('#attacker');
  const style=document.createElement('style');
  style.textContent=`#attackStage.physical-attack #attacker{animation:none!important;transform:translateX(var(--lunge-x,0px)) scaleX(-1) scale(var(--attacker-scale,.82));transform-origin:center bottom;filter:drop-shadow(0 5px 0 #0c1623) brightness(var(--attacker-brightness,1))}#attackStage.physical-attack #attackCanvas{z-index:1}`;
  document.head.appendChild(style);
  function pixelLine(ctx,x1,y1,x2,y2,color,size,grid){const length=Math.max(Math.abs(x2-x1),Math.abs(y2-y1)),steps=Math.max(1,Math.ceil(length/grid)),block=Math.max(grid,Math.round(size/grid)*grid);ctx.fillStyle=color;for(let i=0;i<=steps;i++){const f=i/steps;ctx.fillRect(Math.round((x1+(x2-x1)*f)/grid)*grid,Math.round((y1+(y2-y1)*f)/grid)*grid,block,block)}}
  function physicalFrame(t,type,move){
    const box=stage.getBoundingClientRect(),dpr=Math.min(devicePixelRatio||1,2),cw=Math.round(box.width*dpr),ch=Math.round(box.height*dpr);
    if(attackCanvas.width!==cw||attackCanvas.height!==ch){attackCanvas.width=cw;attackCanvas.height=ch}
    actx.setTransform(dpr,0,0,dpr,0,0);actx.clearRect(0,0,box.width,box.height);actx.imageSmoothingEnabled=false;
    const W=box.width,H=box.height,grid=5,growth=Math.min(1,Math.max(0,(levelNow()-1)/49)),scale=.7+growth*.55,sx=W*.25,sy=H*.66,tx=W*.76,ty=H*.5;
    let dash=t<260?0:t<680?(t-260)/420:t<900?1-(t-680)/220:0;dash=Math.max(0,Math.min(1,dash));
    const lunge=Math.round(W*.39*dash);attacker.style.setProperty('--lunge-x',lunge+'px');attacker.style.setProperty('--attacker-scale',(.82+growth*.35).toFixed(2));attacker.style.setProperty('--attacker-brightness',(1+growth*.25).toFixed(2));
    const tile=(x,y,color,size=grid)=>{const block=Math.max(grid,Math.round(size/grid)*grid);actx.fillStyle=color;actx.fillRect(Math.round(x/grid)*grid,Math.round(y/grid)*grid,block,block)};
    const electric=move==='VOLT TACKLE',fire=move==='FIRE CLAW'||move==='FLAME CHARGE',ghost=move==='LICK'||move==='SHADOW SNEAK';
    if(t<300){const charge=Math.max(0,1-t/300);for(let i=0;i<Math.ceil(8+growth*10);i++){const a=i*Math.PI/4+t*.006,r=18+Math.sin(t*.035+i)*8;tile(sx+Math.cos(a)*r,sy+Math.sin(a)*r,electric?'#ffe85a':fire?'#ff9b44':'#a88aff',grid*(.7+charge*.35))}}
    if(dash>0){for(let i=1;i<=Math.ceil(5+growth*5);i++){let x=sx+lunge-i*(10+growth*5),y=sy-10+(i%3)*11;tile(x,y,electric?'#fff0a0':fire?'#ffb354':'#a68be5',grid*(i%2?1:1.5))}}
    if(electric&&dash>.15){for(let i=0;i<5;i++){const f=i/5,x=sx+(tx-sx)*f+lunge*.65,y=sy+(ty-sy)*f+(i%2? -1:1)*18;pixelLine(actx,x,y,x+10,y-14,'#fff8b0',grid,grid);pixelLine(actx,x+10,y-14,x+18,y+5,'#ffd92f',grid,grid)}}
    if(ghost&&dash>.2){const reach=Math.min(1,dash*1.4),endX=sx+(tx-sx)*reach+lunge*.35;for(let i=0;i<12;i++){const f=i/12,x=sx+(endX-sx)*f,y=sy+(ty-sy)*f+Math.sin(f*Math.PI*2+t*.01)*22;tile(x,y,i%3?'#7351bb':'#c5a9ff',grid*(i%3?1:1.5))}}
    const hit=Math.max(0,Math.min(1,(t-650)/320)),size=(10+growth*26)*scale;
    if(hit>0&&fire){for(let i=-1;i<=1;i++){const ox=i*size*.65,lean=i===0?1:i<0?-.5:.65;pixelLine(actx,tx-size+ox,ty+size*.65,tx+size*.35+ox,ty-size*.75*lean,'#8e382e',size*.42,grid);pixelLine(actx,tx-size+ox+grid,ty+size*.65-grid,tx+size*.35+ox+grid,ty-size*.75*lean-grid,i===1?'#fff0a1':'#ffbd42',size*.22,grid)}}
    if(hit>0&&electric){for(let i=0;i<16;i++){const a=i*Math.PI/8,r=(12+hit*(26+growth*27));tile(tx+Math.cos(a)*r,ty+Math.sin(a)*r,i%2?'#ffe143':'#fffbd0',grid*(i%3?1:1.5))}pixelLine(actx,tx-size*.8,ty-size*.4,tx-size*.2,ty+size*.4,'#fff8c3',grid*2,grid);pixelLine(actx,tx-size*.2,ty+size*.4,tx+size*.25,ty-size*.25,'#ffd83c',grid*2,grid)}
    if(hit>0&&ghost){if(move==='LICK'){for(let i=0;i<14;i++){const f=i/14,x=tx-size+f*size*2,y=ty+Math.sin(f*Math.PI)*size*.7;tile(x,y,i%3?'#ac75d8':'#ead0ff',grid*1.5)}}else{for(let i=0;i<7;i++){const x=tx-size+i*grid*2,y=ty+Math.sin(i*.7)*size*.5;tile(x,y,i%2?'#7651b4':'#c5a9ff',grid*2)}}for(let i=0;i<12;i++){const a=i*Math.PI/6,r=hit*(14+growth*30);tile(tx+Math.cos(a)*r,ty+Math.sin(a)*r,i%2?'#9d77e3':'#e2d2ff',grid)}}
    if(t<1500)attackRaf=requestAnimationFrame(()=>drawMove(performance.now()-window.attackStart,type));
    else{stage.classList.remove('physical-attack');attacker.style.removeProperty('--lunge-x')}
  }
  drawMove=function(t,type){const move=String(P[pokemon]?.move||'').replaceAll('!','').trim().toUpperCase();if(!physicalMoves.has(move)){stage.classList.remove('physical-attack');attacker.style.removeProperty('--lunge-x');return projectileDraw(t,type)}stage.classList.add('physical-attack');return physicalFrame(t,type,move)};
})();
