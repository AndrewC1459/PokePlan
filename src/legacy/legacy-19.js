// Update 1.1: broaden the habitat roster and keep the Pokédex strip clear of long lists.
habitatWildlife.pikachu.meadow.push([17,'fly'],[21,'fly'],[187,'float']);
habitatWildlife.pikachu.forest.push([17,'fly'],[48,'fly'],[187,'float']);
habitatWildlife.pikachu.river.push([72,'float'],[130,'fly'],[283,'fly']);
habitatWildlife.charizard.volcano.push([22,'fly'],[42,'fly'],[58,'walk']);
habitatWildlife.charizard.sky.push([22,'fly'],[42,'fly'],[149,'fly']);
habitatWildlife.charizard.cave.push([42,'fly'],[126,'walk'],[218,'walk']);
habitatWildlife.gengar.haunted.push([93,'float'],[429,'float'],[442,'float']);
habitatWildlife.gengar.ruins.push([93,'float'],[429,'float'],[442,'float']);
habitatWildlife.gengar.marsh.push([93,'float'],[109,'float'],[317,'float']);

drawResidents=function(){
  let biome=activeBiome?.type||'meadow',key=pokemon+':'+biome;
  if(wildlifeKey===key)return;
  wildlifeKey=key;
  ambientLayer.replaceChildren();
  let waterBiome=biome==='river'||biome==='marsh';
  let candidates=(habitatWildlife[pokemon]?.[biome]||[])
    .map(([id,kind])=>[id,waterBiome&&waterSpeciesIds.has(id)?'swim':kind])
    .filter(([id,kind])=>kind!=='perch'&&(kind!=='walk'||animatedWalkIds.has(id)));
  candidates=[...new Map(candidates.map(entry=>[entry[0],entry])).values()];
  let pool=[...candidates].sort(()=>Math.random()-.5).slice(0,7);
  pool.forEach(([id,kind],i)=>{
    let wrap=document.createElement('div'),img=document.createElement('img'),fromRight=i%2===1;
    wrap.className='resident-wrap '+kind+(fromRight?' from-right':'');
    wrap.style.setProperty('--lane',kind==='swim'?`${73+(i%4)*4}%`:kind==='walk'?`${5+(i%4)*2}%`:`${10+(i%5)*9}%`);
    wrap.style.setProperty('--ground',`${3+(i%3)*2}%`);
    let duration=kind==='walk'?12+i*.8:kind==='swim'?22+i*1.5:19+i*1.5;
    wrap.style.setProperty('--delay',`${-Math.random()*duration}s`);
    wrap.style.setProperty('--speed',`${duration}s`);
    img.className='resident';img.alt='';img.draggable=false;
    img.src=`https://raw.githubusercontent.com/PokeAPI/sprites/master/sprites/pokemon/versions/generation-v/black-white/animated/${id}.gif`;
    img.addEventListener('error',()=>wrap.remove());wrap.appendChild(img);ambientLayer.appendChild(wrap);
  });
};
wildlifeKey='';
drawResidents();

const style=document.createElement('style');
style.textContent=`
.task-list{max-height:min(40vh,390px);overflow-y:auto;overscroll-behavior:contain;scrollbar-width:thin;scrollbar-color:#b6a276 #f3efdf}
.task-list::-webkit-scrollbar{width:9px}.task-list::-webkit-scrollbar-thumb{background:#b6a276;border:2px solid #f3efdf}
.footnote{position:relative;z-index:2;max-width:min(760px,calc(100vw - 24px));margin:12px auto 8px;padding:5px 12px;text-align:center}
.live-clock{font:16px VT323,monospace;color:#e3eadc;white-space:nowrap}
.addrow #customCategory{flex:0 1 154px;width:154px}
.addrow input.time-input{flex:0 0 104px;width:104px}
@media(min-width:601px) and (max-width:980px){.addrow{flex-wrap:wrap}.addrow #taskInput{flex:1 1 220px}}
.update-notes-card{width:min(920px,100%);max-height:min(86vh,760px);overflow:auto;padding:22px}
.update-notes-layout{display:grid;grid-template-columns:minmax(180px,240px) minmax(0,1fr);gap:18px}
.update-version-list{display:flex;flex-direction:column;gap:8px}
.update-version-list button{display:grid;gap:4px;text-align:left;border:2px solid #b77a32;background:#181b1d;color:#ff8b19;padding:12px;font:inherit}
.update-version-list button.active{border-color:#75d900;color:#8cff00}
.update-version-list strong{font:700 16px 'DM Sans',sans-serif}
.update-version-list small{font:italic 13px 'DM Sans',sans-serif;color:#fff0d4}
.update-version-content{min-width:0;padding:6px 10px}
.update-version-content h2{font:clamp(14px,2vw,22px) 'Press Start 2P',monospace;line-height:1.6}
.update-notes-date{font:8px 'Press Start 2P',monospace;color:#7c806e;line-height:1.8}
.update-version-content ul{font:21px VT323,monospace;line-height:1.3}
@media(max-width:600px){.update-notes-layout{grid-template-columns:1fr}.update-version-list{flex-direction:row}.update-version-list button{flex:1;padding:8px}.update-version-list strong{font-size:12px}.live-clock{font-size:14px}.topright{gap:7px}.addrow input.time-input{flex-basis:92px;width:92px}}
`;
document.head.appendChild(style);

// Rebind sign-in after all legacy setup has completed; the account data stays in the same local store.
(()=>{
  const currentForm=document.querySelector('#accountForm');
  if(!currentForm)return;
  const form=currentForm.cloneNode(true);
  currentForm.replaceWith(form);
  form.addEventListener('submit',event=>{
    event.preventDefault();
    const email=document.querySelector('#email').value.trim().toLowerCase();
    const password=document.querySelector('#password').value;
    const name=document.querySelector('#trainerName').value.trim()||'Trainer';
    const error=document.querySelector('#authError');
    error.textContent='';
    try{
      const all=accounts(),key=accountKey(all,email);
      if(authMode==='signup'){
        if(key){error.textContent='An account already exists for this email. Choose Log in.';return}
        all[email]={email,name,password,pokemon:null,tasks:[],selectedDate:localDateKey(new Date())};
        if(!saveAccounts(all)){error.textContent='The browser could not save this account. Check site storage settings.';return}
        openAccount(email);return;
      }
      if(!key||all[key].password!==password){error.textContent='Email or password is incorrect. Check the spelling and try again.';return}
      if(key!==email){all[email]=all[key];delete all[key];if(!saveAccounts(all)){error.textContent='Could not update this account in browser storage. Try again.';return}}
      openAccount(email);
    }catch{error.textContent='The browser could not access this account. Check that site storage is enabled.'}
  });
})();
